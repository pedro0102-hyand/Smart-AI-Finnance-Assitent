from app.models.salary import Salary
from app.models.expense import Expense
from sqlalchemy.orm import Session

def get_financial_summary(db: Session):

    salary = db.query(Salary).order_by(Salary.id.desc()).first()
    if not salary:
        return None
    
    expenses = db.query(Expense).all()

    total_expenses = sum(exp.amount for exp in expenses)
    percentage_spent = (total_expenses / salary.amount) * 100 

    return {
        "salary": salary.amount,
        "total_expenses": total_expenses,
        "percentage_spent": round(percentage_spent, 2)
    }       