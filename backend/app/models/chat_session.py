from sqlalchemy import Column, String, Text, DateTime
from sqlalchemy.sql import func
from app.database import Base


class ChatSession(Base):
    """
    Persiste o histórico de conversa de cada sessão do chat.

    - session_id : identificador único da sessão (vindo do frontend)
    - history    : histórico serializado em JSON
                   formato: [{"role": "user"|"model", "parts": ["texto"]}, ...]
    - system_prompt : system prompt atual da sessão (contém contexto financeiro)
    - context_hash  : hash do contexto financeiro — detecta mudanças sem re-serializar
    - updated_at    : atualizado a cada mensagem — usado para ordenação e futura limpeza
    """

    __tablename__ = "chat_sessions"

    session_id    = Column(String, primary_key=True, index=True)
    history       = Column(Text, nullable=False, default="[]")
    system_prompt = Column(Text, nullable=False, default="")
    context_hash  = Column(String, nullable=False, default="")
    updated_at    = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )