import os
import time
import hashlib
import json
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

# ──────────────────────────────────────────────
# Configurações
# ──────────────────────────────────────────────
MAX_HISTORY_TURNS = 10   # máximo de turnos (1 turno = 1 user + 1 model)
SESSION_TTL = 3600       # tempo de vida da sessão em segundos (1 hora)

# ──────────────────────────────────────────────
# Estrutura interna de sessão
# {
#   session_id: {
#     "history": [{"role": "user"|"model", "parts": [str]}, ...],
#     "last_active": float,
#     "context_hash": str,
#     "system_prompt": str,
#   }
# }
# ──────────────────────────────────────────────
_sessions: dict[str, dict] = {}


# ──────────────────────────────────────────────
# Helpers internos
# ──────────────────────────────────────────────

def _hash_context(financial_context: dict) -> str:
    """Gera um hash do contexto financeiro para detectar mudanças."""
    serialized = json.dumps(financial_context, sort_keys=True)
    return hashlib.md5(serialized.encode()).hexdigest()


def _build_system_prompt(financial_context: dict) -> str:
    """Monta o system prompt com o contexto financeiro do usuário."""
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


def _get_or_create_session(session_id: str, financial_context: dict) -> dict:
    """
    Retorna a sessão existente ou cria uma nova.
    Recria o system prompt apenas se o contexto financeiro mudou.
    """
    now = time.time()
    new_hash = _hash_context(financial_context)
    session = _sessions.get(session_id)

    # Sessão não existe ou expirou → cria do zero
    if session is None or (now - session["last_active"]) > SESSION_TTL:
        _sessions[session_id] = {
            "history": [],           # lista de {"role": str, "parts": [str]}
            "last_active": now,
            "context_hash": new_hash,
            "system_prompt": _build_system_prompt(financial_context),
        }
        return _sessions[session_id]

    # Sessão existe mas contexto financeiro mudou → atualiza só o prompt
    if session["context_hash"] != new_hash:
        session["context_hash"] = new_hash
        session["system_prompt"] = _build_system_prompt(financial_context)

    session["last_active"] = now
    return session


def _trim_history(history: list[dict]) -> list[dict]:
    """
    Mantém apenas os últimos MAX_HISTORY_TURNS turnos.
    Cada turno = 1 mensagem user + 1 mensagem model = 2 entradas.
    Garante que o histórico sempre começa com uma mensagem do user (invariante da API).
    """
    max_entries = MAX_HISTORY_TURNS * 2
    trimmed = history[-max_entries:] if len(history) > max_entries else history

    # A API do Gemini exige que o histórico comece sempre com "user"
    while trimmed and trimmed[0]["role"] != "user":
        trimmed = trimmed[1:]

    return trimmed


def _purge_expired_sessions() -> None:
    """Remove sessões que ultrapassaram o TTL. Chamado a cada interação."""
    now = time.time()
    expired = [
        sid for sid, data in _sessions.items()
        if (now - data["last_active"]) > SESSION_TTL
    ]
    for sid in expired:
        del _sessions[sid]


# ──────────────────────────────────────────────
# Interface pública
# ──────────────────────────────────────────────

def chat_with_ai(message: str, financial_context: dict, session_id: str) -> str:
    """
    Envia uma mensagem ao Gemini usando ChatSession nativa com histórico estruturado.

    Vantagens sobre a abordagem de string concatenada:
    - Usa a API de multi-turn do Gemini corretamente (roles user/model separados)
    - Menos tokens desperdiçados com formatação manual de histórico
    - O modelo entende melhor a estrutura de turnos
    - Histórico limitado a MAX_HISTORY_TURNS para evitar crescimento ilimitado
    """
    _purge_expired_sessions()

    session = _get_or_create_session(session_id, financial_context)

    # ── Cria o model com system instruction e inicia chat com histórico ──
    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash-lite",
        system_instruction=session["system_prompt"],
    )

    chat = model.start_chat(history=session["history"])

    # ── Chamada à API com tratamento de erro ──
    try:
        response = chat.send_message(message)
        reply = response.text

        if not reply or not reply.strip():
            raise ValueError("Resposta vazia recebida do modelo.")

    except ValueError as e:
        return f"Desculpe, não consegui gerar uma resposta no momento. Tente reformular sua pergunta. (Detalhe: {e})"

    except Exception as e:
        error_type = type(e).__name__
        return (
            f"Ocorreu um erro ao se comunicar com o assistente ({error_type}). "
            "Por favor, tente novamente em instantes."
        )

    # ── Persiste o histórico atualizado (vindo do ChatSession, já estruturado) ──
    # chat.history retorna lista de glm.Content com role e parts nativos
    raw_history = chat.history
    structured_history = [
        {"role": turn.role, "parts": [part.text for part in turn.parts]}
        for turn in raw_history
    ]

    session["history"] = _trim_history(structured_history)

    return reply


def clear_history(session_id: str) -> None:
    """Limpa o histórico de uma sessão específica."""
    if session_id in _sessions:
        del _sessions[session_id]
