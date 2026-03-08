import pytest
from unittest.mock import patch, MagicMock
from app.services.api_retry import with_gemini_retry

# Simula a exceção que o Gemini lança em rate limit
class ResourceExhausted(Exception):
    pass

# ── Teste 1: sucesso na primeira tentativa ──
def test_retry_success_first_attempt():
    @with_gemini_retry(max_retries=3, base_delay=0)
    def func():
        return "ok"

    assert func() == "ok"


# ── Teste 2: falha por rate limit, sucede no 2º retry ──
def test_retry_succeeds_on_second_attempt():
    calls = {"count": 0} 

    @with_gemini_retry(max_retries=3, base_delay=0)
    def func():
        calls["count"] += 1
        if calls["count"] < 2:
            raise ResourceExhausted("429 quota")
        return "ok after retry"

    with patch("app.services.api_retry.time.sleep"):  # evita esperar de verdade
        result = func()

    assert result == "ok after retry"
    assert calls["count"] == 2


# ── Teste 3: esgota todos os retries, retorna fallback ──
def test_retry_exhausted_returns_fallback():
    @with_gemini_retry(max_retries=2, base_delay=0, fallback_value="serviço indisponível")
    def func():
        raise ResourceExhausted("429 quota")

    with patch("app.services.api_retry.time.sleep"):
        result = func()

    assert result == "serviço indisponível"


# ── Teste 4: erro que NÃO é rate limit não faz retry ──
def test_no_retry_on_non_rate_limit_error():
    calls = {"count": 0}

    @with_gemini_retry(max_retries=3, base_delay=0)
    def func():
        calls["count"] += 1
        raise ValueError("erro de validação")

    with pytest.raises(ValueError):
        func()

    assert calls["count"] == 1  # não tentou de novo