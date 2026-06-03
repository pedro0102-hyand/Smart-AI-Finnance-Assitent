import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

APP_ENV = os.getenv("APP_ENV", "development")

if APP_ENV == "production":
    DATABASE_URL = os.getenv("DATABASE_URL")
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL must be set in production environment")
    
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    
    connect_args = {}
else:
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./finance_assistant.db")
    connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def ensure_schema() -> None:
    """Aplica alterações incrementais de schema em bancos já existentes."""
    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("users")}
    if "token_version" not in columns:
        with engine.begin() as conn:
            conn.execute(text(
                "ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 1"
            ))


def get_db():
    """Fornece uma sessão de banco de dados para as rotas."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()