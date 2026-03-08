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
# Categorias de urgência expandidas
# ──────────────────────────────────────────────
HIGH_URGENCY = {
    # Moradia
    "moradia", "aluguel", "condominio", "iptu", "financiamento",
    # Alimentação
    "alimentacao", "supermercado", "mercado", "feira", "padaria",
    # Saúde
    "saude", "medico", "consulta", "farmacia", "remedio", "hospital",
    "plano de saude", "odontologico", "dentista", "exame",
    # Contas essenciais
    "agua", "luz", "energia", "gas", "energia eletrica",
    # Transporte
    "transporte", "combustivel", "gasolina", "onibus", "metro",
    "uber", "taxi", "estacionamento", "seguro veiculo",
}

MEDIUM_URGENCY = {
    # Educação
    "educacao", "escola", "faculdade", "curso", "mensalidade",
    "livros", "material escolar",
    # Conectividade
    "internet", "telefone", "celular", "plano celular",
    # Serviços e utilidades
    "servicos", "utilidades", "streaming", "assinatura",
    "academia", "seguro", "seguro vida", "previdencia",
    # Cuidado pessoal básico
    "higiene", "cuidado pessoal",
}

# Tudo fora desses dois sets é classificado como "Baixa urgência"
# a menos que o fallback via IA decida diferente

# ──────────────────────────────────────────────
# Cache para classificação via IA (fallback)
# ──────────────────────────────────────────────
URGENCY_CACHE_TTL = 86400  # 24h — categorias raramente mudam de sentido
_urgency_cache: dict[str, dict] = {}


def _normalize(text: str) -> str:
    """
    Normaliza uma string para comparação segura:
    - Remove espaços extras e converte para lowercase
    - Remove acentos via decomposição Unicode (NFD)
    """
    text = text.strip().lower()
    nfd = unicodedata.normalize("NFD", text)
    return "".join(char for char in nfd if unicodedata.category(char) != "Mn")


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


def _classify_via_ai(category: str) -> str:
    """
    Fallback: usa o Gemini para classificar categorias desconhecidas.
    Retorna apenas uma das três strings de urgência.
    """
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

    try:
        response = model.generate_content(prompt)
        raw = response.text.strip()

        # Valida que a resposta é uma das opções esperadas
        valid = {"Alta urgência", "Média urgência", "Baixa urgência"}
        result = raw if raw in valid else "Baixa urgência"

        _set_cached_urgency(category, result)
        return result

    except Exception:
        return "Baixa urgência"  # fallback seguro em caso de erro


def classify_expense(category: str) -> str:
    """
    Classifica a urgência de um gasto com base na categoria.

    Fluxo:
    1. Normaliza o texto (remove acentos, lowercase, espaços)
    2. Verifica contra os sets de alta e média urgência (rápido, sem custo de API)
    3. Se não encontrar, usa o Gemini como fallback (com cache de 24h)
    """
    normalized = _normalize(category)

    if normalized in HIGH_URGENCY:
        return "Alta urgência"
    elif normalized in MEDIUM_URGENCY:
        return "Média urgência"
    else:
        # Tenta via IA antes de assumir baixa urgência
        return _classify_via_ai(category)


# ──────────────────────────────────────────────
# Cache para generate_suggestion
# ──────────────────────────────────────────────
SUGGESTION_CACHE_TTL = 300  # segundos (5 minutos)
_suggestion_cache: dict[str, dict] = {}


def _build_cache_key(expenses: list[dict], salary: float, percent_spent: float) -> str:
    payload = {
        "expenses": expenses,
        "salary": round(salary, 2),
        "percent_spent": round(percent_spent, 2),
    }
    serialized = json.dumps(payload, sort_keys=True)
    return hashlib.md5(serialized.encode()).hexdigest()


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
    Usa o Gemini para gerar sugestões financeiras personalizadas.
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