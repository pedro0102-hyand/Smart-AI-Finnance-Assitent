"""
auth_service.py
───────────────
Responsável por:
  - Hash e verificação de senhas (bcrypt via passlib)
  - Geração e validação de JWT (access + refresh tokens)
  - Helpers para criar e buscar usuários
"""

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.models.user import User

# ── Configurações ──────────────────────────────────────────────────────────────
# SECRET_KEY DEVE ser definida via variável de ambiente.
# Em desenvolvimento coloque no .env:  SECRET_KEY=<string longa e aleatória>
# Gere uma com:  python -c "import secrets; print(secrets.token_hex(32))"
#
# A aplicação recusa iniciar em produção sem a variável definida.
# Em desenvolvimento aceita um fallback APENAS se APP_ENV != "production".

_APP_ENV   = os.getenv("APP_ENV", "development")
_secret_env = os.getenv("SECRET_KEY", "")

if not _secret_env:
    if _APP_ENV == "production":
        raise RuntimeError(
            "SECRET_KEY não definida. "
            "Defina a variável de ambiente SECRET_KEY antes de iniciar em produção."
        )
    # Desenvolvimento: usa um valor fixo mas emite aviso claro no log
    import warnings
    _secret_env = "dev-only-insecure-secret-change-me"
    warnings.warn(
        "⚠️  SECRET_KEY não definida — usando valor inseguro de desenvolvimento. "
        "Defina SECRET_KEY no seu .env antes de ir para produção.",
        stacklevel=1,
    )

SECRET_KEY            = _secret_env
ALGORITHM             = "HS256"
ACCESS_TOKEN_MINUTES  = 30        # access token: 30 minutos
REFRESH_TOKEN_DAYS    = 30        # refresh token: 30 dias

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Senha ──────────────────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ── JWT ────────────────────────────────────────────────────────────────────────

def _create_token(data: dict, expires_delta: timedelta) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + expires_delta
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_access_token(user_id: int, email: str) -> str:
    return _create_token(
        {"sub": str(user_id), "email": email, "type": "access"},
        timedelta(minutes=ACCESS_TOKEN_MINUTES),
    )


def create_refresh_token(user_id: int) -> str:
    return _create_token(
        {"sub": str(user_id), "type": "refresh"},
        timedelta(days=REFRESH_TOKEN_DAYS),
    )


def decode_access_token(token: str) -> Optional[dict]:
    """Retorna o payload se válido e do tipo 'access', None caso contrário."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "access":
            return None
        return payload
    except JWTError:
        return None


def decode_refresh_token(token: str) -> Optional[int]:
    """Retorna o user_id se o refresh token for válido, None caso contrário."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            return None
        return int(payload["sub"])
    except JWTError:
        return None


# ── CRUD de usuário ────────────────────────────────────────────────────────────

def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email.lower()).first()


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()


def create_user(db: Session, name: str, email: str, password: str) -> User:
    user = User(
        name=name,
        email=email.lower(),
        hashed_password=hash_password(password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    user = get_user_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    if not user.is_active:
        return None
    return user