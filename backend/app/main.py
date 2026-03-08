from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routes.expense import router as expense_router
from app.routes.salary import router as salary_router
from app.routes.summary import router as summary_router
from app.routes.purchase import router as purchase_router
from app.routes.chat import router as chat_router

app = FastAPI(title="Smart Finance Assistant API")

# ── CORS ──────────────────────────────────────────────────────────────────────
# Permite que o frontend React (Vite roda em :5173 por padrão) consuma a API.
# Em produção, substitua allow_origins pela URL real do frontend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Banco de dados ────────────────────────────────────────────────────────────
Base.metadata.create_all(bind=engine)

# ── Rotas ─────────────────────────────────────────────────────────────────────
app.include_router(expense_router)
app.include_router(salary_router)
app.include_router(summary_router)
app.include_router(purchase_router)
app.include_router(chat_router)


@app.get("/")
def root():
    return {"status": "API Running 🚀"}