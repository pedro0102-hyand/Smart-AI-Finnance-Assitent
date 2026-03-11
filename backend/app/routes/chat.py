from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
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
def chat(request: ChatRequest, db: Session = Depends(get_db)):
    financial_context = get_financial_summary(db)

    if not financial_context:
        raise HTTPException(
            status_code=400,
            detail="Nenhum salário cadastrado. Cadastre um salário antes de usar o chat."
        )

    reply = chat_with_ai(
        message=request.message,
        financial_context=financial_context,
        session_id=request.session_id,
        db=db,                          # ← db agora passado para persistência
    )

    return ChatResponse(response=reply, session_id=request.session_id)


@router.delete("/history/{session_id}")
def delete_history(session_id: str, db: Session = Depends(get_db)):
    """Limpa o histórico de conversa de uma sessão específica."""
    clear_history(session_id, db)       # ← db agora passado para deleção no banco
    return {"message": f"Histórico da sessão '{session_id}' apagado com sucesso."}