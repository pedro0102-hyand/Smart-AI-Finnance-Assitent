"""
migrate_add_auth.py
────────────────────
Migração para adicionar autenticação ao banco existente.

O que este script faz:
  1. Cria as novas colunas user_id em 'expenses' e 'salaries' (se não existirem)
  2. Cria a tabela 'users'
  3. Cria um usuário padrão (você define email/senha via args ou .env)
  4. Atribui todos os registros órfãos ao usuário padrão

Uso:
    cd backend
    python migrate_add_auth.py --email seu@email.com --name "Seu Nome" --password suasenha

    # Modo dry-run (mostra o que faria sem alterar):
    python migrate_add_auth.py --email seu@email.com --name "Seu Nome" --password suasenha --dry-run
"""

import sys
import argparse
import sqlite3

sys.path.insert(0, ".")

from app.database import SessionLocal, engine, Base
from app.models.user import User
from app.models.expense import Expense
from app.models.salary import Salary
from app.services.auth_service import hash_password, get_user_by_email


def parse_args():
    parser = argparse.ArgumentParser(description="Migra banco existente para suporte a multi-usuário.")
    parser.add_argument("--email",    required=True, help="E-mail do usuário padrão")
    parser.add_argument("--name",     required=True, help="Nome do usuário padrão")
    parser.add_argument("--password", required=True, help="Senha do usuário padrão (mín. 6 chars)")
    parser.add_argument("--dry-run",  action="store_true", help="Apenas simula, sem salvar")
    return parser.parse_args()


def add_column_if_missing(conn, table: str, column: str, col_type: str):
    """Adiciona uma coluna ao SQLite sem erro se já existir."""
    cursor = conn.execute(f"PRAGMA table_info({table})")
    columns = [row[1] for row in cursor.fetchall()]
    if column not in columns:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")
        print(f"  ✅ Coluna '{column}' adicionada à tabela '{table}'")
    else:
        print(f"  ℹ️  Coluna '{column}' já existe em '{table}' — pulando")


def main():
    args = parse_args()

    if len(args.password) < 6:
        print("❌ A senha deve ter pelo menos 6 caracteres.")
        sys.exit(1)

    print("\n" + "=" * 60)
    print(f"  Modo: {'DRY-RUN' if args.dry_run else 'PRODUÇÃO'}")
    print("=" * 60 + "\n")

    # ── Passo 1: adicionar colunas user_id via SQLite direto ──────────────────
    print("📋 Passo 1: Adicionando colunas user_id nas tabelas existentes...")
    raw_conn = sqlite3.connect("./finance_assistant.db")
    try:
        add_column_if_missing(raw_conn, "expenses", "user_id", "INTEGER")
        add_column_if_missing(raw_conn, "salaries", "user_id", "INTEGER")
        if not args.dry_run:
            raw_conn.commit()
    finally:
        raw_conn.close()

    # ── Passo 2: criar tabelas novas (users, etc.) ────────────────────────────
    print("\n📋 Passo 2: Criando tabelas que não existem (users, ...)...")
    Base.metadata.create_all(bind=engine)
    print("  ✅ Tabelas sincronizadas")

    # ── Passo 3: criar usuário padrão ─────────────────────────────────────────
    print(f"\n📋 Passo 3: Criando usuário padrão ({args.email})...")
    db = SessionLocal()
    try:
        existing = get_user_by_email(db, args.email)

        if existing:
            default_user = existing
            print(f"  ℹ️  Usuário '{args.email}' já existe (id={default_user.id}) — usando existente")
        else:
            if not args.dry_run:
                default_user = User(
                    name=args.name,
                    email=args.email.lower(),
                    hashed_password=hash_password(args.password),
                )
                db.add(default_user)
                db.commit()
                db.refresh(default_user)
                print(f"  ✅ Usuário criado com id={default_user.id}")
            else:
                print(f"  [DRY-RUN] Criaria usuário '{args.name}' <{args.email}>")
                print("\n  ℹ️  Dry-run concluído. Nenhuma alteração foi salva.\n")
                return

        # ── Passo 4: atribuir registros órfãos ────────────────────────────────
        print(f"\n📋 Passo 4: Atribuindo registros sem dono ao usuário id={default_user.id}...")

        orphan_expenses = db.query(Expense).filter(Expense.user_id == None).all()
        orphan_salaries = db.query(Salary).filter(Salary.user_id == None).all()

        print(f"  → Gastos órfãos encontrados: {len(orphan_expenses)}")
        print(f"  → Salários órfãos encontrados: {len(orphan_salaries)}")

        if not args.dry_run:
            for exp in orphan_expenses:
                exp.user_id = default_user.id
            for sal in orphan_salaries:
                sal.user_id = default_user.id
            db.commit()
            print(f"  ✅ {len(orphan_expenses)} gastos e {len(orphan_salaries)} salários migrados")
        else:
            print("  [DRY-RUN] Nenhuma alteração salva")

    finally:
        db.close()

    print("\n" + "=" * 60)
    print("  ✅ Migração concluída com sucesso!")
    print(f"  Login: {args.email} / {args.password}")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()