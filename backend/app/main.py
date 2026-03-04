from fastapi import FastAPI
from app.database import engine, Base
from app.routes.expense import router as expense_router
from app.routes.salary import router as salary_router

app = FastAPI(title="Smart Finance Assistant API")

Base.metadata.create_all(bind=engine)

app.include_router(expense_router)
app.include_router(salary_router)

@app.get("/")
def root():
    return {"status": "API Running 🚀"}