from google import genai

from app.config import get_google_api_key

_client: genai.Client | None = None
_cached_api_key: str | None = None


def get_gemini_client() -> genai.Client:
    """Cliente Gemini compartilhado; recriado se a API key mudar."""
    global _client, _cached_api_key

    api_key = get_google_api_key()
    if _client is None or _cached_api_key != api_key:
        _client = genai.Client(api_key=api_key)
        _cached_api_key = api_key

    return _client
