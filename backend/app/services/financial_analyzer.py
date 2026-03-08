import os
import time
import hashlib
import json
import unicodedata
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

model = genai.GenerativeModel("gemini-2.5-flash-lite")

# ──────────────────────────────────────────────
# Classificação de urgência
# ──────────────────────────────────────────────
HIGH_URGENCY = {"moradia", "alimentacao", "saude", "transporte"}
MEDIUM_URGENCY = {"educacao", "internet", "servicos", "utilidades"}


def _normalize(text: str) -> str:
    """
    Normaliza uma string para comparação segura:
    - Remove espaços extras e converte para lowercase
    - Remove acentos via decomposição Unicode (NFD)

    Exemplos:
        "Saúde"       → "saude"
        "Alimentação" → "alimentacao"
        "  Serviços " → "servicos"
    """
    text = text.strip().lower()
    nfd = unicodedata.normalize("NFD", text)
    return "".join(char for char in nfd if unicodedata.category(char) != "Mn")


def classify_expense(category: str) -> str:
    """
    Classifica a urgência de um gasto com base na categoria.
    Resistente a acentos, maiúsculas e espaços extras.
    """
    normalized = _normalize(category)

    if normalized in HIGH_URGENCY:
        return "Alta urgência"
    elif normalized in MEDIUM_URGENCY:
        return "Média urgência"
    else:
        return "Baixa urgência"


# ──────────────────────────────────────────────
# Cache para generate_suggestion
# ──────────────────────────────────────────────
SUGGESTION_CACHE_TTL = 300  # segundos (5 minutos)

# Estrutura: { cache_key: { "result": str, "expires_at": float } }
_suggestion_cache: dict[str, dict] = {}


def _build_cache_key(expenses: list[dict], salary: float, percent_spent: float) -> str:
    """
    Gera uma chave de cache baseada nos dados financeiros.
    Se qualquer valor mudar, uma nova sugestão será gerada.
    """
    payload = {
        "expenses": expenses,
        "salary": round(salary, 2),
        "percent_spent": round(percent_spent, 2),
    }
    serialized = json.dumps(payload, sort_keys=True)
    return hashlib.md5(serialized.encode()).hexdigest()


def _get_cached_suggestion(cache_key: str) -> str | None:
    """Retorna sugestão cacheada se ainda válida, ou None se expirada/inexistente."""
    entry = _suggestion_cache.get(cache_key)
    if entry and time.time() < entry["expires_at"]:
        return entry["result"]
    # Remove entrada expirada
    if entry:
        del _suggestion_cache[cache_key]
    return None


def _set_cached_suggestion(cache_key: str, result: str) -> None:
    """Armazena sugestão no cache com TTL."""
    _suggestion_cache[cache_key] = {
        "result": result,
        "expires_at": time.time() + SUGGESTION_CACHE_TTL,
    }


def generate_suggestion(expenses: list[dict], salary: float, percent_spent: float) -> str:
    """
    Usa o Gemini para gerar sugestões financeiras personalizadas.

    Melhorias aplicadas:
    - Cache em memória com TTL de SUGGESTION_CACHE_TTL segundos
    - Evita chamadas repetidas à API se os dados financeiros não mudaram
    - Erros da API tratados com mensagem amigável ao usuário
    """
    if not expenses:
        return "Nenhum gasto cadastrado para análise."

    cache_key = _build_cache_key(expenses, salary, percent_spent)

    # ── Retorna do cache se disponível ──
    cached = _get_cached_suggestion(cache_key)
    if cached:
        return cached

    # ── Monta prompt e chama a API ──
    expenses_text = "\n".join(
        f"- {exp['description']} ({exp['category']}): R$ {exp['amount']:.2f} "
        f"[{exp.get('urgency', 'Não classificado')}] — {exp.get('impact_percent', 0):.1f}% da renda"
        for exp in expenses
    )

    prompt = f"""
Você é um consultor financeiro pessoal experiente e empático.

O usuário possui as seguintes informações financeiras:
- Salário mensal: R$ {salary:.2f}
- Total comprometido: {percent_spent:.1f}% da renda

Lista de gastos:
{expenses_text}

Com base nesses dados, forneça sugestões financeiras personalizadas e práticas. Inclua:
1. Quais gastos de baixa urgência podem ser cortados ou reduzidos
2. Se há gastos desproporcionais em relação à renda
3. Uma estimativa de quanto o usuário pode economizar com as sugestões
4. Um conselho motivacional ao final

Seja direto, claro e use linguagem acessível. Responda em português.
"""

    try:
        response = model.generate_content(prompt)
        result = response.text

        if not result or not result.strip():
            raise ValueError("Resposta vazia recebida do modelo.")

        _set_cached_suggestion(cache_key, result)
        return result

    except ValueError as e:
        return f"Não foi possível gerar sugestões no momento. (Detalhe: {e})"

    except Exception as e:
        error_type = type(e).__name__
        return (
            f"Erro ao gerar sugestões financeiras ({error_type}). "
            "Tente novamente em instantes."
        )