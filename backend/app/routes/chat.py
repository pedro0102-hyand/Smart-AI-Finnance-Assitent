from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.services.ai_agent import chat_with_ai
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.database import get_db
from app.services.finance_service import get_financial_summary

router = APIRouter(prefix="/chat", tags=["AI"])

class ChatRequest(BaseModel):
    message: str

@router.post("/")
def chat(request: ChatRequest, db: Session = Depends(get_db)):
    financial_context = get_financial_summary(db)

    if not financial_context:
        raise HTTPException(status_code=400, detail="Nenhum salário cadastrado. Cadastre um salário antes de usar o chat.")

    reply = chat_with_ai(request.message, financial_context)
    return {"response": reply}