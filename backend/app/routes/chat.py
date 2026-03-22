from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.services.finance_service import get_financial_summary
from app.services.ai_agent import chat_with_ai, clear_history

router = APIRouter(prefix="/chat", tags=["AI"])


class ChatRequest(BaseModel):
    message: str
    session_id: str


class ChatResponse(BaseModel):
    response: str
    session_id: str


@router.post("/", response_model=ChatResponse)
def chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    financial_context = get_financial_summary(db, user_id=current_user.id)

    if not financial_context:
        raise HTTPException(
            status_code=400,
            detail="Nenhum salário cadastrado. Cadastre um salário antes de usar o chat.",
        )

    reply = chat_with_ai(
        message=request.message,
        financial_context=financial_context,
        session_id=f"{current_user.id}_{request.session_id}",
        db=db,
    )

    return ChatResponse(response=reply, session_id=request.session_id)


@router.delete("/history/{session_id}")
def delete_history(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    clear_history(f"{current_user.id}_{session_id}", db)
    return {"message": f"Histórico da sessão '{session_id}' apagado com sucesso."}