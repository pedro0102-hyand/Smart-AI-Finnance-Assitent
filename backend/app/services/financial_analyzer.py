import os
import time
import hashlib
import json
import unicodedata
import logging

from google import genai
from dotenv import load_dotenv
from app.services.api_retry import with_gemini_retry

load_dotenv()

# ── Cliente único compartilhado ───────────────────────────────────────────────
_client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

logger = logging.getLogger(__name__)

MODEL_NAME = "gemini-2.5-flash-lite"

# ──────────────────────────────────────────────
# Categorias de urgência expandidas
# ──────────────────────────────────────────────
HIGH_URGENCY = {
    "moradia", "aluguel", "condominio", "iptu", "financiamento",
    "alimentacao", "supermercado", "mercado", "feira", "padaria",
    "saude", "medico", "consulta", "farmacia", "remedio", "hospital",
    "plano de saude", "odontologico", "dentista", "exame",
    "agua", "luz", "energia", "gas", "energia eletrica",
    "transporte", "combustivel", "gasolina", "onibus", "metro",
    "uber", "taxi", "estacionamento", "seguro veiculo",
}

MEDIUM_URGENCY = {
    "educacao", "escola", "faculdade", "curso", "mensalidade",
    "livros", "material escolar",
    "internet", "telefone", "celular", "plano celular",
    "servicos", "utilidades", "streaming", "assinatura",
    "academia", "seguro", "seguro vida", "previdencia",
    "higiene", "cuidado pessoal",
}

# ──────────────────────────────────────────────
# Cache para classificação via IA
# ──────────────────────────────────────────────
URGENCY_CACHE_TTL = 86400  # 24h
_urgency_cache: dict[str, dict] = {}


def _normalize(text: str) -> str:
    text = text.strip().lower()
    nfd = unicodedata.normalize("NFD", text)
    return "".join(c for c in nfd if unicodedata.category(c) != "Mn")


def _get_cached_urgency(category: str) -> str | None:
    entry = _urgency_cache.get(category)
    if entry and time.time() < entry["expires_at"]:
        return entry["result"]
    if entry:
        del _urgency_cache[category]
    return None


def _set_cached_urgency(category: str, result: str) -> None:
    _urgency_cache[category] = {
        "result": result,
        "expires_at": time.time() + URGENCY_CACHE_TTL,
    }


# ──────────────────────────────────────────────
# Chamadas à API isoladas — decorator aplicado aqui
# ──────────────────────────────────────────────

@with_gemini_retry(max_retries=3, base_delay=2.0, fallback_value="Baixa urgência")
def _call_classify_api(prompt: str) -> str:
    """
    Chama a API para classificar a urgência de uma categoria desconhecida.
    Usa generate_content do novo SDK em vez de model.generate_content().
    """
    response = _client.models.generate_content(
        model=MODEL_NAME,
        contents=prompt,
    )
    raw = response.text.strip().strip("*_`\n ")

    valid = {"Alta urgência", "Média urgência", "Baixa urgência"}
    return raw if raw in valid else "Baixa urgência"


@with_gemini_retry(max_retries=3, base_delay=2.0, fallback_value=None)
def _call_suggestion_api(prompt: str) -> str:
    """
    Chama a API para gerar sugestões financeiras personalizadas.
    Lança ValueError se a resposta vier vazia (será tratado pelo chamador).
    """
    response = _client.models.generate_content(
        model=MODEL_NAME,
        contents=prompt,
    )

    if not response.text or not response.text.strip():
        raise ValueError("Resposta vazia recebida do modelo.")

    return response.text


# ──────────────────────────────────────────────
# Interface pública
# ──────────────────────────────────────────────

def _classify_via_ai(category: str) -> str:
    cached = _get_cached_urgency(category)
    if cached:
        return cached

    prompt = f"""Classifique a urgência do seguinte tipo de gasto financeiro pessoal.

Gasto: "{category}"

Responda APENAS com uma dessas três opções exatas (sem pontuação, sem explicação):
- Alta urgência
- Média urgência
- Baixa urgência

Critérios:
- Alta urgência: essencial para sobrevivência/saúde/moradia/mobilidade básica
- Média urgência: importante mas não emergencial (educação, conectividade, seguros)
- Baixa urgência: supérfluo, lazer, desejo, conforto não essencial"""

    result = _call_classify_api(prompt)
    _set_cached_urgency(category, result)
    return result


def classify_expense(category: str) -> str:
    """
    Classifica a urgência de um gasto com base na categoria.
    1. Verifica sets locais (sem custo de API)
    2. Fallback para Gemini (com cache de 24h)
    """
    normalized = _normalize(category)

    if normalized in HIGH_URGENCY:
        return "Alta urgência"
    elif normalized in MEDIUM_URGENCY:
        return "Média urgência"
    else:
        return _classify_via_ai(category)


# ──────────────────────────────────────────────
# Cache para generate_suggestion
# ──────────────────────────────────────────────
SUGGESTION_CACHE_TTL = 300  # 5 minutos
_suggestion_cache: dict[str, dict] = {}


def _build_cache_key(expenses: list[dict], salary: float, percent_spent: float) -> str:
    payload = {
        "expenses": expenses,
        "salary": round(salary, 2),
        "percent_spent": round(percent_spent, 2),
    }
    return hashlib.md5(json.dumps(payload, sort_keys=True).encode()).hexdigest()


def _get_cached_suggestion(cache_key: str) -> str | None:
    entry = _suggestion_cache.get(cache_key)
    if entry and time.time() < entry["expires_at"]:
        return entry["result"]
    if entry:
        del _suggestion_cache[cache_key]
    return None


def _set_cached_suggestion(cache_key: str, result: str) -> None:
    _suggestion_cache[cache_key] = {
        "result": result,
        "expires_at": time.time() + SUGGESTION_CACHE_TTL,
    }


def generate_suggestion(expenses: list[dict], salary: float, percent_spent: float) -> str:
    """
    Gera sugestões financeiras personalizadas via Gemini.
    Resultado cacheado por SUGGESTION_CACHE_TTL segundos.
    """
    if not expenses:
        return "Nenhum gasto cadastrado para análise."

    cache_key = _build_cache_key(expenses, salary, percent_spent)
    cached = _get_cached_suggestion(cache_key)
    if cached:
        return cached

    expenses_text = "\n".join(
        f"- {exp['description']} ({exp['category']}): R$ {exp['amount']:.2f} "
        f"[{exp.get('urgency', 'Não classificado')}] — {exp.get('impact_percent', 0):.1f}% da renda"
        for exp in expenses
    )

    prompt = f"""Você é um consultor financeiro pessoal experiente e empático.

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

Seja direto, claro e use linguagem acessível. Responda em português."""

    try:
        result = _call_suggestion_api(prompt)
        if result is None:
            return (
                "O serviço de sugestões está temporariamente indisponível por sobrecarga. "
                "Tente novamente em alguns instantes."
            )
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