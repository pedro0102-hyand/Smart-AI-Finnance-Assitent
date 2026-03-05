from app.models.salary import Salary
from app.models.expense import Expense
from app.services.financial_analyzer import classify_expense
from sqlalchemy.orm import Session


def get_financial_summary(db: Session) -> dict | None:
    """
    Retorna o resumo financeiro completo do usuário.
    Única fonte de verdade — usada pelo chat, summary e purchase.
    """
    salary = db.query(Salary).order_by(Salary.id.desc()).first()
    if not salary:
        return None

    expenses = db.query(Expense).all()

    salary_amount = salary.amount
    total_expenses = sum(exp.amount for exp in expenses)
    remaining = salary_amount - total_expenses
    percent_spent = (total_expenses / salary_amount) * 100 if salary_amount else 0
    percent_remaining = 100 - percent_spent

    detailed_expenses = []
    for exp in expenses:
        impact_percent = (exp.amount / salary_amount) * 100
        detailed_expenses.append({
            "id": exp.id,
            "description": exp.description,
            "amount": exp.amount,
            "category": exp.category,
            "urgency": classify_expense(exp.category),
            "impact_percent": round(impact_percent, 2)
        })

    return {
        "salary": salary_amount,
        "total_expenses": round(total_expenses, 2),
        "remaining": round(remaining, 2),
        "percent_spent": round(percent_spent, 2),
        "percent_remaining": round(percent_remaining, 2),
        "expenses": detailed_expenses,
    }    