from fastapi import FastAPI
from app.database import engine, Base
from app.models import Expense

app = FastAPI(title="Smart Finance Assistant API")

Base.metadata.create_all(bind=engine)

@app.get("/")
def root():
    return {"status": "API Running 🚀"}