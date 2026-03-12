"""
Repositório responsável por toda a persistência de sessões de chat no SQLite.

Mantém um cache em memória na frente do banco para evitar uma query
a cada mensagem enviada. O fluxo é:

  leitura : cache hit → retorna direto | cache miss → lê banco → preenche cache
  escrita : salva no banco → atualiza cache (nunca escreve só no cache)
  deleção : apaga do banco → remove do cache

Thread-safety:
  O Uvicorn com múltiplos workers usa threads para processar requisições
  concorrentes. O _cache dict é protegido por um threading.Lock em todas
  as operações de leitura e escrita para evitar RuntimeError e race conditions.

  Importante: o lock protege APENAS o cache em memória. O banco de dados
  (SQLite) tem seu próprio mecanismo de controle de concorrência via
  check_same_thread=False + serialização de writes pelo SQLAlchemy.
"""

import json
import logging
import threading
from sqlalchemy.orm import Session
from app.models.chat_session import ChatSession

logger = logging.getLogger(__name__)

# ── Cache em memória com lock ─────────────────────────────────────────────────
# Estrutura: { session_id: {"history": [...], "system_prompt": str, "context_hash": str} }
#
# Por que Lock e não RLock?
# - Lock (não-reentrante) é suficiente — nenhuma função do repositório chama
#   outra função do repositório enquanto segura o lock.
# - RLock seria necessário apenas se houvesse chamadas aninhadas na mesma thread.
_cache: dict[str, dict] = {}
_cache_lock = threading.Lock()


def load_session(session_id: str, db: Session) -> dict | None:
    """
    Carrega uma sessão do cache ou do banco.
    Retorna None se a sessão não existir.

    Fluxo thread-safe:
    1. Tenta ler do cache com lock (rápido)
    2. Se não encontrar, lê do banco SEM lock (I/O pode ser lento)
    3. Popula o cache com lock após leitura do banco
    """
    with _cache_lock:
        if session_id in _cache:
            return _cache[session_id]

    # Leitura do banco fora do lock — evita bloquear outras threads durante I/O
    row = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
    if not row:
        return None

    data = _deserialize(row)

    with _cache_lock:
        # Double-check: outra thread pode ter populado o cache entre a leitura
        # do banco e a aquisição do lock — nesse caso, o valor mais recente vence.
        _cache[session_id] = data

    return data


def save_session(session_id: str, data: dict, db: Session) -> None:
    """
    Persiste a sessão no banco e atualiza o cache.
    Faz upsert: cria se não existir, atualiza se já existir.

    O cache só é atualizado APÓS o commit bem-sucedido no banco —
    nunca ficará em estado inconsistente com o banco.
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
    except Exception:
        db.rollback()
        logger.exception("Falha ao persistir sessão '%s' no banco.", session_id)
        raise

    # Atualiza cache apenas após commit bem-sucedido
    with _cache_lock:
        _cache[session_id] = data


def delete_session(session_id: str, db: Session) -> None:
    """
    Remove a sessão do banco e do cache.
    Não lança erro se a sessão não existir.

    O cache é limpo no bloco finally para garantir remoção mesmo se
    o commit falhar — é melhor um cache miss do que dados stale.
    """
    db.query(ChatSession).filter(ChatSession.session_id == session_id).delete()
    try:
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Falha ao deletar sessão '%s' do banco.", session_id)
        raise
    finally:
        with _cache_lock:
            _cache.pop(session_id, None)


def invalidate_cache(session_id: str) -> None:
    """Remove apenas a entrada do cache, sem tocar no banco."""
    with _cache_lock:
        _cache.pop(session_id, None)


# ── Helpers internos ──────────────────────────────────────────────────────────

def _deserialize(row: ChatSession) -> dict:
    try:
        history = json.loads(row.history)
    except (json.JSONDecodeError, TypeError):
        logger.warning(
            "Histórico corrompido para sessão '%s'. Iniciando do zero.",
            row.session_id,
        )
        history = []

    return {
        "history":       history,
        "system_prompt": row.system_prompt or "",
        "context_hash":  row.context_hash  or "",
    }