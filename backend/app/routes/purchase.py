from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.expense import Expense
from app.models.salary import Salary
from app.schemas.purchase import  PurchaseResponse
from app.schemas import PurchaseRequest

router = APIRouter(prefix="/can-i-buy", tags=["Purchase"])


@router.post("/", response_model=PurchaseResponse)
def can_i_buy(purchase: PurchaseRequest, db: Session = Depends(get_db)):

    salary = db.query(Salary).order_by(Salary.id.desc()).first()
    if not salary:
        return {"error": "No salary registered."}

    expenses = db.query(Expense).all()

    salary_amount = salary.amount
    total_expenses = sum(exp.amount for exp in expenses)

    current_percent_spent = (total_expenses / salary_amount) * 100

    # Simulação da nova compra
    new_total = total_expenses + purchase.amount
    new_percent_spent = (new_total / salary_amount) * 100

    impact_percent = (purchase.amount / salary_amount) * 100

    # Regra de decisão
    if new_percent_spent <= 70:
        can_buy = True
        recommendation = "Compra financeiramente saudável."
    elif new_percent_spent <= 85:
        can_buy = True
        recommendation = "Compra possível, mas exige cautela."
    else:
        can_buy = False
        recommendation = "Compra não recomendada. Compromete excessivamente sua renda."

    # Sugestão simples de parcelamento saudável
    suggested_installments = 1
    for i in range(2, 13):
        installment_value = purchase.amount / i
        if (installment_value + total_expenses) / salary_amount * 100 <= 70:
            suggested_installments = i
            break

    return PurchaseResponse(
        can_buy=can_buy,
        current_percent_spent=round(current_percent_spent, 2),
        new_percent_spent=round(new_percent_spent, 2),
        impact_percent=round(impact_percent, 2),
        suggested_installments=suggested_installments,
        recommendation=recommendation
    )