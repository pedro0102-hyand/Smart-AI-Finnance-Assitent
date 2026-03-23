"""
migrate_v2.py
─────────────
Migração para as correções de multi-usuário e consistência de dados.

O que este script faz:
  1. Adiciona coluna `user_id` em `chat_sessions`
  2. Adiciona coluna `impact_percent` em `expenses` (default 0.0)
  3. Recalcula `impact_percent` para todos os gastos existentes,
     usando o salário atual do dono do gasto

Uso:
    cd backend
    python migrate_v2.py

    # Modo dry-run (mostra o que faria sem alterar):
    python migrate_v2.py --dry-run
"""

import sys
import argparse
import sqlite3

sys.path.insert(0, ".")

from app.database import SessionLocal, engine, Base
from app.models.expense import Expense
from app.models.salary import Salary


def parse_args():
    parser = argparse.ArgumentParser(description="Migração v2: user_id em chat_sessions e impact_percent em expenses.")
    parser.add_argument("--dry-run", action="store_true", help="Apenas simula, sem salvar")
    return parser.parse_args()


def add_column_if_missing(conn, table: str, column: str, col_type: str):
    cursor = conn.execute(f"PRAGMA table_info({table})")
    columns = [row[1] for row in cursor.fetchall()]
    if column not in columns:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")
        print(f"  ✅ Coluna '{column}' adicionada à tabela '{table}'")
    else:
        print(f"  ℹ️  Coluna '{column}' já existe em '{table}' — pulando")


def main():
    args = parse_args()

    print("\n" + "=" * 60)
    print(f"  Migração v2 — Modo: {'DRY-RUN' if args.dry_run else 'PRODUÇÃO'}")
    print("=" * 60 + "\n")

    # ── Passo 1: adicionar colunas via SQLite direto ──────────────────────────
    print("📋 Passo 1: Adicionando novas colunas...")
    raw_conn = sqlite3.connect("./finance_assistant.db")
    try:
        add_column_if_missing(raw_conn, "chat_sessions", "user_id", "INTEGER")
        add_column_if_missing(raw_conn, "expenses", "impact_percent", "REAL NOT NULL DEFAULT 0.0")
        if not args.dry_run:
            raw_conn.commit()
        else:
            print("  [DRY-RUN] Nenhuma alteração estrutural salva.")
    finally:
        raw_conn.close()

    # ── Passo 2: sincronizar modelos SQLAlchemy ───────────────────────────────
    print("\n📋 Passo 2: Sincronizando tabelas com SQLAlchemy...")
    Base.metadata.create_all(bind=engine)
    print("  ✅ Tabelas sincronizadas")

    if args.dry_run:
        print("\n  ℹ️  Dry-run concluído. Nenhuma alteração foi salva.\n")
        return

    # ── Passo 3: recalcular impact_percent para gastos existentes ─────────────
    print("\n📋 Passo 3: Recalculando impact_percent dos gastos existentes...")
    db = SessionLocal()
    try:
        expenses = db.query(Expense).all()
        updated  = 0
        skipped  = 0

        for exp in expenses:
            salary = None
            if exp.user_id:
                salary = (
                    db.query(Salary)
                    .filter(Salary.user_id == exp.user_id, Salary.is_current == True)
                    .first()
                )

            if salary and salary.amount > 0:
                new_pct = round((exp.amount / salary.amount) * 100, 2)
                exp.impact_percent = new_pct
                updated += 1
            else:
                # Sem salário associado: mantém 0.0
                skipped += 1

        db.commit()
        print(f"  ✅ {updated} gasto(s) com impact_percent recalculado.")
        if skipped:
            print(f"  ⚠️  {skipped} gasto(s) sem salário associado (mantidos em 0.0).")

    except Exception as e:
        db.rollback()
        print(f"  ❌ Falha ao recalcular: {e}")
        sys.exit(1)
    finally:
        db.close()

    print("\n" + "=" * 60)
    print("  ✅ Migração v2 concluída com sucesso!")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()