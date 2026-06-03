import os
import sys
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


# ── Constantes ─────────────────────────────────────────────────────────────────

APP_ENV = os.getenv("APP_ENV", "development")
IS_PRODUCTION = APP_ENV == "production"

# Comprimento mínimo para SECRET_KEY (32 bytes hex = 64 chars)
MIN_SECRET_KEY_LENGTH = 32


# ── Validações de segurança ─────────────────────────────────────────────────────

def _abort(message: str) -> None:
    """Encerra o processo com mensagem de erro clara."""
    logger.critical(message)
    print(f"\n🚨  ERRO DE CONFIGURAÇÃO:\n{message}\n", file=sys.stderr)
    sys.exit(1)


def validate_env() -> None:
    """
    Valida variáveis de ambiente sensíveis no startup.
    Aborta o servidor se qualquer verificação falhar.
    """

    # 1. GOOGLE_API_KEY não deve existir com prefixo VITE_
    #    (indicaria que o usuário copiou a variável errada do frontend)
    vite_google_key = os.getenv("VITE_GOOGLE_API_KEY")
    if vite_google_key:
        _abort(
            "A variável VITE_GOOGLE_API_KEY foi encontrada no ambiente do BACKEND.\n"
            "  Isso indica uma configuração incorreta: variáveis VITE_* pertencem\n"
            "  apenas ao frontend e seriam expostas publicamente se usadas lá.\n"
            "  Use GOOGLE_API_KEY (sem o prefixo VITE_) neste backend."
        )

    # 2. GOOGLE_API_KEY deve estar presente
    google_api_key = os.getenv("GOOGLE_API_KEY", "").strip()
    if not google_api_key:
        if IS_PRODUCTION:
            _abort(
                "GOOGLE_API_KEY não está definida.\n"
                "  Defina a variável de ambiente antes de iniciar em produção."
            )
        else:
            logger.warning(
                "⚠️  GOOGLE_API_KEY não definida. "
                "Funcionalidades de IA estarão indisponíveis."
            )

    # 3. SECRET_KEY deve ter entropia mínima
    secret_key = os.getenv("SECRET_KEY", "").strip()
    insecure_defaults = {
        "dev-only-insecure-secret-change-me",
        "secret",
        "changeme",
        "your-secret-key",
        "",
    }

    if secret_key in insecure_defaults or len(secret_key) < MIN_SECRET_KEY_LENGTH:
        if IS_PRODUCTION:
            _abort(
                f"SECRET_KEY inválida ou muito curta (mínimo {MIN_SECRET_KEY_LENGTH} caracteres).\n"
                "  Gere uma com: python -c \"import secrets; print(secrets.token_hex(32))\""
            )
        else:
            logger.warning(
                "⚠️  SECRET_KEY não definida ou insegura. "
                "Tokens JWT estarão vulneráveis. "
                "Defina SECRET_KEY no backend/.env antes de ir para produção."
            )

    # 4. Em produção, DATABASE_URL deve ser PostgreSQL (não SQLite)
    database_url = os.getenv("DATABASE_URL", "")
    if IS_PRODUCTION and database_url.startswith("sqlite"):
        _abort(
            "DATABASE_URL aponta para SQLite em produção.\n"
            "  SQLite não é adequado para produção — use PostgreSQL."
        )

    logger.info("✅  Validação de configuração concluída (APP_ENV=%s)", APP_ENV)


# ── Acessores tipados ──────────────────────────────────────────────────────────

def get_google_api_key() -> str:
    """Retorna GOOGLE_API_KEY ou string vazia se não configurada."""
    return os.getenv("GOOGLE_API_KEY", "").strip()


def get_secret_key() -> str:
    """
    Retorna SECRET_KEY.
    Em desenvolvimento, usa fallback inseguro com aviso.
    Em produção, o startup já teria abortado se não estivesse configurada.
    """
    key = os.getenv("SECRET_KEY", "").strip()
    if not key:
        return "dev-only-insecure-secret-change-me"
    return key