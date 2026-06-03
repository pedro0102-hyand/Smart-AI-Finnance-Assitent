import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base, ensure_schema
from app.config import validate_env
import app.models  # noqa: F401 — registra modelos antes do create_all
from app.routes.expense import router as expense_router
from app.routes.salary import router as salary_router
from app.routes.summary import router as summary_router
from app.routes.purchase import router as purchase_router
from app.routes.chat import router as chat_router
from app.routes.forecast import router as forecast_router
from app.routes.auth import router as auth_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Gerenciador de ciclo de vida da aplicação.

    Ordem de inicialização:
      1. validate_env()  — aborta se configuração de segurança estiver errada
      2. create_all()    — cria tabelas no banco
      3. yield           — servidor aceita requisições
    """
    # Valida variáveis de ambiente ANTES de iniciar qualquer coisa.
    # Se falhar em produção, o processo encerra com exit code 1.
    validate_env()

    Base.metadata.create_all(bind=engine)
    ensure_schema()
    yield


app = FastAPI(title="Smart Finance Assistant API", lifespan=lifespan)

_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
ALLOWED_ORIGINS: list[str] = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(expense_router)
app.include_router(salary_router)
app.include_router(summary_router)
app.include_router(purchase_router)
app.include_router(chat_router)
app.include_router(forecast_router)


@app.get("/")
def root():
    return {"status": "API Running 🚀"}