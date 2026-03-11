import pytest
from unittest.mock import patch, MagicMock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.models.chat_session import ChatSession
from app.services import chat_repository as repo
from app.services.ai_agent import chat_with_ai, clear_history

# ── Banco em memória — isolado, não toca o banco real ──
@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()

financial_context = {
    "salary": 5000.0, "total_expenses": 1000.0,
    "remaining": 4000.0, "percent_spent": 20.0,
    "percent_remaining": 80.0, "expenses": []
}

# ── Teste 1: sessão é criada no banco na primeira mensagem ──
def test_session_persisted_after_first_message(db):
    with patch("app.services.ai_agent._send_message", return_value="resposta mock"):
        chat_with_ai("oi", financial_context, "sessao-1", db)

    row = db.query(ChatSession).filter_by(session_id="sessao-1").first()
    assert row is not None
    assert "sessao-1" == row.session_id


# ── Teste 2: histórico sobrevive ao restart (cache zerado, banco preservado) ──
def test_history_survives_cache_clear(db):
    # Mock do objeto turn retornado pelo chat.history do Gemini
    mock_part = MagicMock()
    mock_part.text = "resposta mock"

    mock_turn_user = MagicMock()
    mock_turn_user.role = "user"
    mock_turn_user.parts = [mock_part]

    mock_turn_model = MagicMock()
    mock_turn_model.role = "model"
    mock_turn_model.parts = [mock_part]

    mock_chat = MagicMock()
    mock_chat.history = [mock_turn_user, mock_turn_model]

    with patch("app.services.ai_agent._send_message", return_value="resposta mock"), \
         patch("google.generativeai.GenerativeModel") as mock_model:
        mock_model.return_value.start_chat.return_value = mock_chat
        chat_with_ai("primeira mensagem", financial_context, "sessao-2", db)

    repo._cache.clear()

    session = repo.load_session("sessao-2", db)
    assert session is not None
    assert len(session["history"]) > 0


# ── Teste 3: clear_history apaga do banco e do cache ──
def test_clear_history_removes_from_db_and_cache(db):
    with patch("app.services.ai_agent._send_message", return_value="resposta mock"):
        chat_with_ai("msg", financial_context, "sessao-3", db)

    clear_history("sessao-3", db)

    row = db.query(ChatSession).filter_by(session_id="sessao-3").first()
    assert row is None
    assert "sessao-3" not in repo._cache