import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

model = genai.GenerativeModel("gemini-2.5-flash-lite")

# Histórico em memória por session_id
# Formato: { session_id: [ {"role": "user"|"model", "parts": "..."}, ... ] }
conversation_history: dict[str, list[dict]] = {}


def chat_with_ai(message: str, financial_context: dict, session_id: str) -> str:
    """
    Envia uma mensagem ao Gemini com o contexto financeiro completo do usuário.
    Mantém histórico de conversa por session_id em memória.
    """
    expenses_text = "\n".join(
        f"  - {exp['description']} ({exp['category']}): R$ {exp['amount']:.2f} "
        f"[{exp['urgency']}] — {exp['impact_percent']}% da renda"
        for exp in financial_context.get("expenses", [])
    ) or "  Nenhum gasto cadastrado."

    system_prompt = f"""
Você é um assistente financeiro inteligente e empático.

Dados financeiros atuais do usuário:
- Salário: R$ {financial_context['salary']:.2f}
- Total de despesas: R$ {financial_context['total_expenses']:.2f}
- Percentual comprometido: {financial_context['percent_spent']}%
- Valor restante: R$ {financial_context['remaining']:.2f} ({financial_context['percent_remaining']}% da renda)

Gastos detalhados:
{expenses_text}

Use esses dados para responder com precisão e personalização.
Responda sempre em português, de forma clara e acessível.
Lembre-se do contexto das mensagens anteriores para manter uma conversa coerente.
"""

    # Inicializa histórico da sessão se não existir
    if session_id not in conversation_history:
        conversation_history[session_id] = []

    history = conversation_history[session_id]

    # Monta histórico + nova mensagem como prompt completo
    history_text = ""
    for entry in history:
        role = "Usuário" if entry["role"] == "user" else "Assistente"
        history_text += f"{role}: {entry['parts']}\n"

    full_prompt = system_prompt + "\n\nHistórico da conversa:\n" + history_text + "\nUsuário: " + message

    response = model.generate_content(full_prompt)
    reply = response.text

    # Persiste a nova troca no histórico
    history.append({"role": "user", "parts": message})
    history.append({"role": "model", "parts": reply})

    return reply


def clear_history(session_id: str) -> None:
    """Limpa o histórico de uma sessão específica."""
    if session_id in conversation_history:
        del conversation_history[session_id]
