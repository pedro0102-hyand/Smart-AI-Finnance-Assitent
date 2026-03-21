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

# ──────────────────────────────────────────────────────────────────────────────
# Sets de classificação local — primeira linha de defesa (sem custo de API)
# ──────────────────────────────────────────────────────────────────────────────

HIGH_URGENCY = {
    # Moradia
    "moradia", "aluguel", "condominio", "iptu", "financiamento",
    "financiamento imovel", "financiamento casa", "hipoteca",
    # Alimentação
    "alimentacao", "supermercado", "mercado", "feira", "padaria",
    "acougue", "hortifruti", "sacolao",
    # Saúde
    "saude", "medico", "consulta", "farmacia", "remedio", "hospital",
    "plano de saude", "odontologico", "dentista", "exame", "laboratorio",
    "clinica", "emergencia", "urgencia", "cirurgia", "internacao",
    # Contas essenciais
    "agua", "luz", "energia", "gas", "energia eletrica", "saneamento",
    # Transporte essencial
    "transporte", "combustivel", "gasolina", "onibus", "metro",
    "uber", "taxi", "estacionamento",
    # Parcelas / dívidas / financiamentos — CRÍTICO
    "parcela", "prestacao", "financiamento", "emprestimo", "divida",
    "credito", "cartao de credito", "fatura", "boleto",
    "parcela moto", "parcela carro", "parcela moto", "financiamento moto",
    "financiamento carro", "financiamento veiculo", "leasing",
    "consorcio", "cheque especial", "juros",
    # Seguro veículo (obrigação legal/financeira)
    "seguro veiculo", "seguro carro", "seguro moto", "seguro obrigatorio",
    "dpvat", "ipva",
}

MEDIUM_URGENCY = {
    # Educação
    "educacao", "escola", "faculdade", "curso", "mensalidade",
    "livros", "material escolar", "universidade", "pos graduacao",
    "ingles", "idioma",
    # Conectividade
    "internet", "telefone", "celular", "plano celular", "banda larga",
    # Serviços recorrentes importantes
    "servicos", "utilidades", "streaming", "assinatura",
    "academia", "gym", "ginasio",
    # Seguros pessoais
    "seguro", "seguro vida", "previdencia", "plano odontologico",
    # Higiene básica
    "higiene", "cuidado pessoal", "farmacia higiene",
    # Pet (dependente)
    "veterinario", "pet", "animal", "racao",
}

# Tudo que não cair nos sets acima vai para a IA


# ──────────────────────────────────────────────────────────────────────────────
# Normalização de texto
# ──────────────────────────────────────────────────────────────────────────────

def _normalize(text: str) -> str:
    text = text.strip().lower()
    nfd = unicodedata.normalize("NFD", text)
    return "".join(c for c in nfd if unicodedata.category(c) != "Mn")


def _normalize_words(text: str) -> set[str]:
    """Retorna conjunto de palavras normalizadas para busca parcial."""
    return set(_normalize(text).split())


# ──────────────────────────────────────────────────────────────────────────────
# Busca nos sets com suporte a matching parcial por palavras-chave
# ──────────────────────────────────────────────────────────────────────────────

# Palavras-chave que sozinhas já determinam Alta urgência
_HIGH_KEYWORDS = {
    "parcela", "prestacao", "financiamento", "emprestimo", "divida",
    "fatura", "boleto", "aluguel", "hipoteca", "consorcio", "leasing",
    "juros", "ipva", "dpvat", "agua", "luz", "gas", "energia",
    "gasolina", "combustivel", "remedio", "farmacia", "hospital",
    "medico", "consulta", "exame", "cirurgia", "internacao",
}

# Palavras-chave que sozinhas já determinam Média urgência
_MEDIUM_KEYWORDS = {
    "internet", "celular", "telefone", "escola", "faculdade", "curso",
    "mensalidade", "academia", "seguro", "streaming", "assinatura",
    "veterinario", "racao", "pet",
}


def _classify_local(category: str) -> str | None:
    """
    Tenta classificar localmente usando:
    1. Match exato no set completo
    2. Match parcial por palavras-chave individuais

    Retorna None se não conseguir classificar localmente.
    """
    normalized = _normalize(category)
    words = _normalize_words(category)

    # 1. Match exato
    if normalized in HIGH_URGENCY:
        return "Alta urgência"
    if normalized in MEDIUM_URGENCY:
        return "Média urgência"

    # 2. Match parcial — qualquer palavra-chave de alta urgência presente
    if words & _HIGH_KEYWORDS:
        return "Alta urgência"

    # 3. Match parcial — qualquer palavra-chave de média urgência presente
    if words & _MEDIUM_KEYWORDS:
        return "Média urgência"

    return None


# ──────────────────────────────────────────────────────────────────────────────
# Cache para classificação via IA
# ──────────────────────────────────────────────────────────────────────────────

URGENCY_CACHE_TTL = 86400  # 24h
_urgency_cache: dict[str, dict] = {}


def _get_cached_urgency(key: str) -> str | None:
    entry = _urgency_cache.get(key)
    if entry and time.time() < entry["expires_at"]:
        return entry["result"]
    if entry:
        del _urgency_cache[key]
    return None


def _set_cached_urgency(key: str, result: str) -> None:
    _urgency_cache[key] = {
        "result": result,
        "expires_at": time.time() + URGENCY_CACHE_TTL,
    }


# ──────────────────────────────────────────────────────────────────────────────
# Chamada à API com prompt muito mais robusto
# ──────────────────────────────────────────────────────────────────────────────

@with_gemini_retry(max_retries=3, base_delay=2.0, fallback_value="Média urgência")
def _call_classify_api(category: str) -> str:
    """
    Classifica a urgência de um gasto via Gemini com prompt financeiro detalhado.
    Fallback padrão é 'Média urgência' (conservador) em vez de 'Baixa urgência'.
    """
    prompt = f"""Você é um especialista em finanças pessoais brasileiras. Sua tarefa é classificar a URGÊNCIA FINANCEIRA de um gasto.

GASTO A CLASSIFICAR: "{category}"

## CRITÉRIOS DE CLASSIFICAÇÃO

### 🔴 ALTA URGÊNCIA — Gasto essencial ou compromisso financeiro inadiável
Inclui OBRIGATORIAMENTE:
- Qualquer tipo de PARCELA, PRESTAÇÃO, FINANCIAMENTO ou EMPRÉSTIMO (moto, carro, imóvel, pessoal, etc.)
- DÍVIDAS, BOLETOS, FATURAS, CONSÓRCIO, LEASING
- Aluguel, condomínio, IPTU, IPVA, DPVAT
- Contas básicas: água, luz, gás, energia elétrica
- Alimentação: supermercado, mercado, feira, açougue
- Saúde: médico, farmácia, remédio, plano de saúde, exame, hospital
- Combustível, transporte público, Uber para trabalho
- Qualquer gasto que SE NÃO PAGO gera multa, juros, negativação ou perda de bem

### 🟡 MÉDIA URGÊNCIA — Gasto importante mas com alguma flexibilidade
- Educação: escola, faculdade, curso, mensalidade
- Telefone, internet, plano celular
- Academia, gym
- Seguros (vida, residencial)
- Streaming e assinaturas de serviços digitais
- Veterinário, ração para pet
- Higiene e cuidados pessoais

### 🟢 BAIXA URGÊNCIA — Gasto supérfluo, lazer ou desejo não essencial
- Restaurante, delivery, fast food, bar, balada
- Roupas, calçados, acessórios não essenciais
- Eletrônicos, gadgets, games por lazer
- Viagens, turismo, hotel por lazer
- Beleza: salão, manicure, estética por vaidade
- Entretenimento: cinema, shows, parques
- Presentes, decoração, artigos de luxo

## REGRA MAIS IMPORTANTE
Se o gasto envolver qualquer tipo de PARCELA, PRESTAÇÃO, FINANCIAMENTO, EMPRÉSTIMO ou DÍVIDA — independentemente do objeto (moto, carro, celular, móveis, etc.) — classifique SEMPRE como **Alta urgência**, pois representa um compromisso financeiro que gera consequências graves se não pago.

## RESPOSTA
Responda APENAS com uma destas três opções exatas (sem pontuação, sem explicação):
- Alta urgência
- Média urgência
- Baixa urgência"""

    response = _client.models.generate_content(
        model=MODEL_NAME,
        contents=prompt,
    )
    raw = response.text.strip().strip("*_`\n ")

    valid = {"Alta urgência", "Média urgência", "Baixa urgência"}
    if raw in valid:
        return raw

    # Tenta recuperar mesmo se a IA adicionou texto extra
    for v in valid:
        if v.lower() in raw.lower():
            return v

    # Fallback conservador — não classifica como baixa por padrão
    logger.warning("Resposta inesperada da IA para '%s': '%s'. Usando fallback 'Média urgência'.", category, raw)
    return "Média urgência"


# ──────────────────────────────────────────────────────────────────────────────
# Interface pública
# ──────────────────────────────────────────────────────────────────────────────

def classify_expense(category: str) -> str:
    """
    Classifica a urgência de um gasto com base na categoria/descrição.

    Fluxo:
    1. Busca local exata nos sets pré-definidos
    2. Busca local por palavras-chave individuais (match parcial)
    3. Fallback para Gemini com prompt financeiro rico (com cache de 24h)
    """
    # Cache usa a string normalizada como chave
    cache_key = _normalize(category)
    cached = _get_cached_urgency(cache_key)
    if cached:
        return cached

    # Tenta classificar localmente primeiro
    local_result = _classify_local(category)
    if local_result:
        _set_cached_urgency(cache_key, local_result)
        return local_result

    # Fallback para IA
    logger.info("Classificando via IA: '%s'", category)
    result = _call_classify_api(category)
    _set_cached_urgency(cache_key, result)
    return result


# ──────────────────────────────────────────────────────────────────────────────
# Cache para generate_suggestion
# ──────────────────────────────────────────────────────────────────────────────

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


@with_gemini_retry(max_retries=3, base_delay=2.0, fallback_value=None)
def _call_suggestion_api(prompt: str) -> str:
    """
    Chama a API para gerar sugestões financeiras personalizadas.
    """
    response = _client.models.generate_content(
        model=MODEL_NAME,
        contents=prompt,
    )

    if not response.text or not response.text.strip():
        raise ValueError("Resposta vazia recebida do modelo.")

    return response.text 