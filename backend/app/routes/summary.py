from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.expense import Expense
from app.models.salary import Salary

router = APIRouter(prefix="/summary", tags=["Summary"])

@router.get("/")
def financial_summary(db: Session = Depends(get_db)):
    expenses = db.query(Expense).all()
    salary = db.query(Salary).order_by(Salary.id.desc()).first()

    total_expenses = sum(exp.amount for exp in expenses)

    if not salary:
        return {"error": "No salary registered."}

    salary_amount = salary.amount
    remaining = salary_amount - total_expenses
    percent_spent = (total_expenses / salary_amount) * 100 if salary_amount else 0
    percent_remaining = 100 - percent_spent

    return {
        "salary": salary_amount,
        "total_expenses": total_expenses,
        "remaining": remaining,
        "percent_spent": round(percent_spent, 2),
        "percent_remaining": round(percent_remaining, 2),
    }