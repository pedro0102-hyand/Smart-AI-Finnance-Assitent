
import hashlib
import bcrypt
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.config import get_secret_key         

# ── Configurações ──────────────────────────────────────────────────────────────

SECRET_KEY            = get_secret_key()      
ALGORITHM             = "HS256"
ACCESS_TOKEN_MINUTES  = 30
REFRESH_TOKEN_DAYS    = 30


# ── Senha ──────────────────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    pwd_bytes = plain.encode("utf-8")
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


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
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "access":
            return None
        return payload
    except JWTError:
        return None


def decode_refresh_token(token: str) -> Optional[int]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            return None
        return int(payload["sub"])
    except JWTError:
        return None


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _get_token_expires_at(token: str) -> Optional[datetime]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        exp = payload.get("exp")
        if exp is None:
            return None
        return datetime.fromtimestamp(exp, tz=timezone.utc)
    except JWTError:
        return None


def store_refresh_token(db: Session, user_id: int, token: str) -> None:
    expires_at = _get_token_expires_at(token)
    if expires_at is None:
        return

    db.add(RefreshToken(
        user_id=user_id,
        token_hash=_hash_token(token),
        expires_at=expires_at,
    ))
    db.commit()


def revoke_refresh_token(db: Session, token: str) -> bool:
    token_hash = _hash_token(token)
    record = db.query(RefreshToken).filter(
        RefreshToken.token_hash == token_hash,
        RefreshToken.revoked_at.is_(None),
    ).first()

    if not record:
        return False

    record.revoked_at = datetime.now(timezone.utc)
    db.commit()
    return True


def validate_stored_refresh_token(db: Session, token: str) -> Optional[int]:
    user_id = decode_refresh_token(token)
    if user_id is None:
        return None

    token_hash = _hash_token(token)
    record = db.query(RefreshToken).filter(
        RefreshToken.token_hash == token_hash,
        RefreshToken.revoked_at.is_(None),
        RefreshToken.expires_at > datetime.now(timezone.utc),
    ).first()

    if not record or record.user_id != user_id:
        return None

    return user_id


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