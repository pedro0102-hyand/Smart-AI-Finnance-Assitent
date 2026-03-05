from fastapi import APIRouter
from pydantic import BaseModel
from app.services.ai_agent import chat_with_ai
from sqlalchemy.orm import Session
from fastapi import Depends
from app.database import get_db
from app.services.finance_service import get_financial_summary

router = APIRouter(prefix="/chat", tags=["AI"])

class ChatRequest(BaseModel):
    message: str

@router.post("/")
def chat(request: ChatRequest, db: Session = Depends(get_db)):
    financial_context = get_financial_summary(db)
    reply = chat_with_ai(request.message, financial_context)
    return {"response": reply}

@router.post("/")
def chat(request: ChatRequest):
    reply = chat_with_ai(request.message)
    return {"response": reply}