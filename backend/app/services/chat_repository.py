"""
Repositório responsável por toda a persistência de sessões de chat no SQLite.

Mantém um cache em memória na frente do banco para evitar uma query
a cada mensagem enviada. O fluxo é:

  leitura : cache hit → retorna direto | cache miss → lê banco → preenche cache
  escrita : salva no banco → atualiza cache (nunca escreve só no cache)
  deleção : apaga do banco → remove do cache
"""

import json
import logging
from sqlalchemy.orm import Session
from app.models.chat_session import ChatSession

logger = logging.getLogger(__name__)

# ── Cache em memória ──────────────────────────────────────────────────────────
# Estrutura espelhada do banco:
# { session_id: {"history": [...], "system_prompt": str, "context_hash": str} }
_cache: dict[str, dict] = {}


def load_session(session_id: str, db: Session) -> dict | None:
    """
    Carrega uma sessão do cache ou do banco.
    Retorna None se a sessão não existir.
    """
    if session_id in _cache:
        return _cache[session_id]

    row = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
    if not row:
        return None

    data = _deserialize(row)
    _cache[session_id] = data
    return data


def save_session(session_id: str, data: dict, db: Session) -> None:
    """
    Persiste a sessão no banco e atualiza o cache.
    Faz upsert: cria se não existir, atualiza se já existir.
    """
    row = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()

    serialized_history = json.dumps(data["history"], ensure_ascii=False)

    if row:
        row.history       = serialized_history
        row.system_prompt = data["system_prompt"]
        row.context_hash  = data["context_hash"]
    else:
        row = ChatSession(
            session_id    = session_id,
            history       = serialized_history,
            system_prompt = data["system_prompt"],
            context_hash  = data["context_hash"],
        )
        db.add(row)

    try:
        db.commit()
        _cache[session_id] = data
    except Exception:
        db.rollback()
        logger.exception("Falha ao persistir sessão '%s' no banco.", session_id)
        raise


def delete_session(session_id: str, db: Session) -> None:
    """
    Remove a sessão do banco e do cache.
    Não lança erro se a sessão não existir.
    """
    db.query(ChatSession).filter(ChatSession.session_id == session_id).delete()
    try:
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Falha ao deletar sessão '%s' do banco.", session_id)
        raise
    finally:
        _cache.pop(session_id, None)


def invalidate_cache(session_id: str) -> None:
    """Remove apenas a entrada do cache, sem tocar no banco."""
    _cache.pop(session_id, None)


# ── Helpers internos ─────────────────────────────────────────────────────────

def _deserialize(row: ChatSession) -> dict:
    try:
        history = json.loads(row.history)
    except (json.JSONDecodeError, TypeError):
        logger.warning("Histórico corrompido para sessão '%s'. Iniciando do zero.", row.session_id)
        history = []

    return {
        "history":       history,
        "system_prompt": row.system_prompt or "",
        "context_hash":  row.context_hash  or "",
    }