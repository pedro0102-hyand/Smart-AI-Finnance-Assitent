import hashlib
import json
import logging
import os

from google import genai
from google.genai import types
from dotenv import load_dotenv
from sqlalchemy.orm import Session

from app.services.api_retry import with_gemini_retry
from app.services import chat_repository as repo

load_dotenv()

# ── Cliente único compartilhado — novo SDK usa Client() em vez de configure() ──
_client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
# Configurações
# ──────────────────────────────────────────────
MODEL_NAME        = "gemini-2.5-flash-lite"
MAX_HISTORY_TURNS = 10

_RATE_LIMIT_FALLBACK = (
    "O assistente está temporariamente indisponível devido a sobrecarga. "
    "Por favor, aguarde alguns instantes e tente novamente."
)


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _hash_context(financial_context: dict) -> str:
    return hashlib.md5(
        json.dumps(financial_context, sort_keys=True).encode()
    ).hexdigest()


def _build_system_prompt(financial_context: dict) -> str:
    expenses_text = "\n".join(
        f"  - {exp['description']} ({exp['category']}): R$ {exp['amount']:.2f} "
        f"[{exp['urgency']}] — {exp['impact_percent']}% da renda"
        for exp in financial_context.get("expenses", [])
    ) or "  Nenhum gasto cadastrado."

    return f"""Você é um assistente financeiro inteligente e empático.

Dados financeiros atuais do usuário:
- Salário: R$ {financial_context['salary']:.2f}
- Total de despesas: R$ {financial_context['total_expenses']:.2f}
- Percentual comprometido: {financial_context['percent_spent']}%
- Valor restante: R$ {financial_context['remaining']:.2f} ({financial_context['percent_remaining']}% da renda)

Gastos detalhados:
{expenses_text}

Use esses dados para responder com precisão e personalização.
Responda sempre em português, de forma clara e acessível.
Lembre-se do contexto das mensagens anteriores para manter uma conversa coerente."""


def _trim_history(history: list[dict]) -> list[dict]:
    """
    Mantém apenas os últimos MAX_HISTORY_TURNS turnos.
    Garante que o histórico sempre começa com uma mensagem do user.
    """
    max_entries = MAX_HISTORY_TURNS * 2
    trimmed = history[-max_entries:] if len(history) > max_entries else history
    while trimmed and trimmed[0]["role"] != "user":
        trimmed = trimmed[1:]
    return trimmed


def _deserialize_history(raw: list[dict]) -> list[types.Content]:
    """
    Converte o histórico persistido no banco (lista de dicts) para
    objetos types.Content que o novo SDK aceita no parâmetro history.

    Formato do banco: [{"role": "user"|"model", "parts": ["texto"]}, ...]
    Formato do SDK  : [types.Content(role=..., parts=[types.Part(text=...)]), ...]
    """
    result = []
    for turn in raw:
        parts = [types.Part(text=p) for p in turn.get("parts", [])]
        result.append(types.Content(role=turn["role"], parts=parts))
    return result


def _append_turn(history: list[dict], user_message: str, model_reply: str) -> list[dict]:
    """
    Acrescenta um novo turno ao histórico sem depender de chat.history.

    O novo SDK não garante uma propriedade pública .history no objeto Chat,
    por isso construímos o histórico manualmente: pegamos o que já estava
    persistido e adicionamos a nova troca (user + model).
    """
    return history + [
        {"role": "user",  "parts": [user_message]},
        {"role": "model", "parts": [model_reply]},
    ]


def _get_or_create_session(session_id: str, financial_context: dict, db: Session) -> dict:
    new_hash = _hash_context(financial_context)
    session  = repo.load_session(session_id, db)

    if session is None:
        session = {
            "history":       [],
            "context_hash":  new_hash,
            "system_prompt": _build_system_prompt(financial_context),
        }
        repo.save_session(session_id, session, db)
        return session

    if session["context_hash"] != new_hash:
        session["context_hash"]  = new_hash
        session["system_prompt"] = _build_system_prompt(financial_context)

    return session


# ──────────────────────────────────────────────
# Chamada à API isolada — decorator de retry aplicado aqui
# ──────────────────────────────────────────────

@with_gemini_retry(max_retries=3, base_delay=2.0, fallback_value=_RATE_LIMIT_FALLBACK)
def _send_message(chat: genai.chats.Chat, message: str) -> str:
    """
    Envia uma mensagem para o chat session do novo SDK.
    Isolada para que o decorator de retry capture a exceção corretamente.
    """
    response = chat.send_message(message)

    if not response.text or not response.text.strip():
        raise ValueError("Resposta vazia recebida do modelo.")

    return response.text


# ──────────────────────────────────────────────
# Interface pública
# ──────────────────────────────────────────────

def chat_with_ai(message: str, financial_context: dict, session_id: str, db: Session) -> str:
    """
    Envia uma mensagem ao Gemini e persiste o histórico no SQLite.

    Diferenças do novo SDK vs. antigo:
    - Cliente instanciado via genai.Client() — não há mais genai.configure()
    - Chat criado via client.chats.create(model, config, history)
    - system_instruction e temperature ficam dentro de types.GenerateContentConfig
    - Histórico é list[types.Content] — precisa deserializar do banco antes de usar
    """
    session = _get_or_create_session(session_id, financial_context, db)

    chat = _client.chats.create(
        model=MODEL_NAME,
        config=types.GenerateContentConfig(
            system_instruction=session["system_prompt"],
        ),
        history=_deserialize_history(session["history"]),
    )

    try:
        reply = _send_message(chat, message)
    except ValueError as e:
        return (
            "Desculpe, não consegui gerar uma resposta no momento. "
            f"Tente reformular sua pergunta. (Detalhe: {e})"
        )
    except Exception as e:
        error_type = type(e).__name__
        return (
            f"Ocorreu um erro ao se comunicar com o assistente ({error_type}). "
            "Por favor, tente novamente em instantes."
        )

    session["history"] = _trim_history(_append_turn(session["history"], message, reply))

    try:
        repo.save_session(session_id, session, db)
    except Exception:
        logger.exception(
            "Não foi possível persistir o histórico da sessão '%s'. "
            "A conversa continuará apenas em memória até o próximo restart.",
            session_id,
        )

    return reply


def clear_history(session_id: str, db: Session) -> None:
    """Remove o histórico do banco e do cache para uma sessão específica."""
    repo.delete_session(session_id, db)
