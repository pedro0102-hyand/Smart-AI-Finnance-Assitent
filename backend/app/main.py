from fastapi import FastAPI
from app.database import engine, Base
from app.routes.expense import router as expense_router
from app.routes.salary import router as salary_router
from app.routes.summary import router as summary_router
from app.routes.purchase import router as purchase_router
from app.routes.chat import router as chat_router

app = FastAPI(title="Smart Finance Assistant API")

Base.metadata.create_all(bind=engine)

app.include_router(expense_router)
app.include_router(salary_router)
app.include_router(summary_router)
app.include_router(purchase_router)
app.include_router(chat_router)

@app.get("/")
def root():
    return {"status": "API Running 🚀"}