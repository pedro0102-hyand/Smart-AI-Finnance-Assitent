from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.auth import (
    LoginRequest, RegisterRequest, RefreshRequest,
    TokenResponse, UserResponse, MeResponse,
)
from app.services.auth_service import (
    authenticate_user, create_user, get_user_by_email,
    create_access_token, create_refresh_token, decode_refresh_token,
    get_user_by_id,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=MeResponse, status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    """Cria uma nova conta de usuário."""
    if get_user_by_email(db, body.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Já existe uma conta com esse e-mail.",
        )

    user = create_user(db, name=body.name, email=body.email, password=body.password)

    return MeResponse(
        user=UserResponse.model_validate(user),
        access_token=create_access_token(user.id, user.email),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/login", response_model=MeResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    """Autentica email + senha e retorna tokens JWT."""
    user = authenticate_user(db, body.email, body.password)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos.",
        )

    return MeResponse(
        user=UserResponse.model_validate(user),
        access_token=create_access_token(user.id, user.email),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    """Gera um novo access token a partir de um refresh token válido."""
    user_id = decode_refresh_token(body.refresh_token)

    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido ou expirado.",
        )

    user = get_user_by_id(db, user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário não encontrado.",
        )

    return TokenResponse(
        access_token=create_access_token(user.id, user.email),
        refresh_token=create_refresh_token(user.id),
    )


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    """Retorna os dados do usuário autenticado."""
    return UserResponse.model_validate(current_user)