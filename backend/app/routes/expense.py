from fastapi import APIRouter, Depends 
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import Expense
from app.schemas import ExpenseCreate, ExpenseResponse  
from app.database import get_db

router = APIRouter()

@router.post("/expenses", response_model=ExpenseResponse)

def create_expense(expense: ExpenseCreate, db: Session = Depends(get_db)):
    db_expense = Expense(**expense.model_dump())
    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)
    return db_expense

@router.get("/expenses", response_model=list[ExpenseResponse])

def list_expenses(db: Session = Depends(get_db)):
    return db.query(Expense).all()