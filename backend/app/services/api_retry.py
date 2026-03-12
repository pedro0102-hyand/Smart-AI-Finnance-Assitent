import time
import logging
from functools import wraps
from typing import Callable

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
# Constantes de retry
# ──────────────────────────────────────────────
DEFAULT_MAX_RETRIES = 3
DEFAULT_BASE_DELAY  = 2.0   # segundos — delay inicial antes do primeiro retry
DEFAULT_MAX_DELAY   = 30.0  # segundos — teto para o backoff exponencial


def _is_rate_limit_error(exc: Exception) -> bool:
    """
    Detecta erros de rate limit / quota esgotada da API Gemini.

    No novo SDK (google-genai), o erro correto é:
        google.genai.errors.APIError  com  exc.code == 429

    Mantemos também a detecção por nome de tipo e mensagem como fallback,
    para cobrir eventuais variações entre versões do SDK.
    """
    # ── Detecção primária: novo SDK google-genai ──────────────────────────────
    try:
        from google.genai import errors as genai_errors
        if isinstance(exc, genai_errors.APIError):
            return getattr(exc, "code", None) == 429
    except ImportError:
        pass

    # ── Fallback: detecção por nome do tipo (google-api-core) ─────────────────
    error_type = type(exc).__name__
    if error_type in ("ResourceExhausted", "TooManyRequests"):
        return True

    # ── Fallback: detecção por mensagem ───────────────────────────────────────
    error_msg = str(exc).lower()
    return "429" in error_msg or "resource exhausted" in error_msg or "quota" in error_msg


def with_gemini_retry(
    max_retries: int = DEFAULT_MAX_RETRIES,
    base_delay: float = DEFAULT_BASE_DELAY,
    max_delay: float = DEFAULT_MAX_DELAY,
    fallback_value: str | None = None,
) -> Callable:
    """
    Decorator que aplica retry com backoff exponencial em chamadas à API Gemini.

    Comportamento:
    - Só faz retry em erros de rate limit / quota (429 / ResourceExhausted)
    - Outros erros são relançados imediatamente (sem retry desnecessário)
    - Backoff: base_delay * 2^tentativa  (ex: 2s → 4s → 8s para base_delay=2)
    - Se todos os retries esgotarem e fallback_value for fornecido, retorna o fallback
    - Se fallback_value for None, relança a última exceção

    Params:
        max_retries:    número máximo de tentativas após a primeira falha
        base_delay:     delay em segundos antes do primeiro retry
        max_delay:      delay máximo (evita esperas absurdas)
        fallback_value: valor retornado se todos os retries esgotarem (None = relança)
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_exc: Exception | None = None

            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)

                except Exception as exc:
                    if not _is_rate_limit_error(exc):
                        raise  # não é rate limit — relança imediatamente

                    last_exc = exc
                    if attempt == max_retries:
                        break  # esgotou as tentativas

                    delay = min(base_delay * (2 ** attempt), max_delay)
                    logger.warning(
                        "Rate limit atingido em '%s'. "
                        "Tentativa %d/%d. Aguardando %.1fs antes de tentar novamente.",
                        func.__name__, attempt + 1, max_retries, delay,
                    )
                    time.sleep(delay)

            logger.error(
                "Todas as %d tentativas falharam em '%s' por rate limit.",
                max_retries + 1, func.__name__,
            )

            if fallback_value is not None:
                return fallback_value

            raise last_exc  # type: ignore[misc]

        return wrapper
    return decorator