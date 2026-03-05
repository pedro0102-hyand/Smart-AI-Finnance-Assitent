from fastapi import APIRouter
from pydantic import BaseModel
from app.services.ai_agent import chat_with_ai

router = APIRouter(prefix="/chat", tags=["AI"])

class ChatRequest(BaseModel):
    message: str

@router.post("/")
def chat(request: ChatRequest):
    reply = chat_with_ai(request.message)
    return {"response": reply}