"""
migrate_urgency.py
──────────────────
Script de migração para recalcular a urgência de todos os gastos
existentes no banco usando o novo critério: descrição + categoria.

Uso:
    cd backend
    python migrate_urgency.py

    # Modo dry-run (só mostra o que mudaria, sem salvar):
    python migrate_urgency.py --dry-run

    # Limpar cache de urgência antes de rodar (recomendado):
    python migrate_urgency.py --clear-cache
"""

import sys
import argparse
from sqlalchemy.orm import Session

# Garante que o módulo app é encontrado ao rodar da pasta backend/
sys.path.insert(0, ".")

from app.database import SessionLocal, engine, Base
from app.models.expense import Expense
from app.services.financial_analyzer import classify_expense, _urgency_cache


def parse_args():
    parser = argparse.ArgumentParser(description="Recalcula urgência de todos os gastos.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Mostra as mudanças sem salvar no banco.",
    )
    parser.add_argument(
        "--clear-cache",
        action="store_true",
        help="Limpa o cache de urgência antes de classificar.",
    )
    return parser.parse_args()


def migrate(db: Session, dry_run: bool) -> None:
    expenses = db.query(Expense).all()
    total    = len(expenses)

    if total == 0:
        print("Nenhum gasto encontrado no banco.")
        return

    print(f"\n{'=' * 60}")
    print(f"  Modo: {'DRY-RUN (sem salvar)' if dry_run else 'PRODUÇÃO (salvando)'}")
    print(f"  Total de gastos: {total}")
    print(f"{'=' * 60}\n")

    changed = 0
    unchanged = 0
    errors = 0

    for exp in expenses:
        try:
            combined     = f"{exp.description} {exp.category}"
            new_urgency  = classify_expense(combined)
            old_urgency  = exp.urgency

            if new_urgency != old_urgency:
                changed += 1
                status = "ALTERADO"
                arrow  = f"{old_urgency!r:25} → {new_urgency!r}"
            else:
                unchanged += 1
                status = "ok"
                arrow  = f"{old_urgency!r} (sem mudança)"

            print(f"  [{status:8}] #{exp.id:<4} {exp.description[:30]:<30} | {arrow}")

            if not dry_run and new_urgency != old_urgency:
                exp.urgency = new_urgency

        except Exception as e:
            errors += 1
            print(f"  [ERRO    ] #{exp.id} {exp.description[:30]} — {e}")

    print(f"\n{'=' * 60}")
    print(f"  Alterados  : {changed}")
    print(f"  Sem mudança: {unchanged}")
    print(f"  Erros      : {errors}")
    print(f"{'=' * 60}\n")

    if not dry_run and changed > 0:
        try:
            db.commit()
            print(f"  ✅ {changed} gasto(s) atualizados com sucesso no banco.\n")
        except Exception as e:
            db.rollback()
            print(f"  ❌ Falha ao salvar: {e}\n")
            sys.exit(1)
    elif dry_run:
        print("  ℹ️  Dry-run concluído. Nenhuma alteração foi salva.\n")
    else:
        print("  ✅ Nenhuma alteração necessária.\n")


def main() -> None:
    args = parse_args()

    if args.clear_cache:
        _urgency_cache.clear()
        print("  🗑️  Cache de urgência limpo.\n")

    # Garante que as tabelas existem (seguro rodar mesmo em banco já criado)
    Base.metadata.create_all(bind=engine)

    db: Session = SessionLocal()
    try:
        migrate(db, dry_run=args.dry_run)
    finally:
        db.close()


if __name__ == "__main__":
    main()