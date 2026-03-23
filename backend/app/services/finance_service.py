from app.models.salary import Salary
from app.models.expense import Expense
from sqlalchemy.orm import Session


def get_financial_summary(db: Session, user_id: int) -> dict | None:
    """
    Retorna o resumo financeiro do usuário especificado.
    Única fonte de verdade — usada pelo chat, summary e purchase.

    impact_percent é lido diretamente da coluna persistida no banco,
    calculada e gravada no momento da criação/edição de cada gasto.
    """
    salary = (
        db.query(Salary)
        .filter(Salary.user_id == user_id, Salary.is_current == True)
        .first()
    )
    if not salary:
        return None

    expenses = db.query(Expense).filter(Expense.user_id == user_id).all()

    salary_amount  = salary.amount
    total_expenses = sum(exp.amount for exp in expenses)
    remaining      = salary_amount - total_expenses
    percent_spent  = (total_expenses / salary_amount) * 100 if salary_amount else 0
    percent_remaining = 100 - percent_spent

    detailed_expenses = []
    for exp in expenses:
        detailed_expenses.append({
            "id":             exp.id,
            "description":    exp.description,
            "amount":         exp.amount,
            "category":       exp.category,
            "urgency":        exp.urgency,
            # Lido da coluna — não recalculado aqui
            "impact_percent": exp.impact_percent,
            "created_at":     exp.created_at.isoformat() if exp.created_at else None,
        })

    return {
        "salary":             salary_amount,
        "total_expenses":     round(total_expenses, 2),
        "remaining":          round(remaining, 2),
        "percent_spent":      round(percent_spent, 2),
        "percent_remaining":  round(percent_remaining, 2),
        "expenses":           detailed_expenses,
    }