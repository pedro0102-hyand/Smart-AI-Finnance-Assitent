from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.expense import Expense
from app.models.salary import Salary
from app.schemas.purchase import PurchaseRequest, PurchaseResponse

router = APIRouter(prefix="/can-i-buy", tags=["Purchase"])


def _suggest_installments(purchase_amount: float, total_expenses: float, salary_amount: float) -> int:
    """
    Determina o menor número de parcelas que mantém o orçamento saudável (≤ 70%).

    Lógica corrigida:
    - Testa 1x primeiro (à vista) — se já cabe no orçamento, retorna 1
    - Caso contrário, itera de 2 a 12 até encontrar o menor parcelamento viável
    - Se nenhuma opção couber em 12x, retorna 12 como máximo sugerido
    """
    for installments in range(1, 13):
        monthly_cost = purchase_amount / installments
        projected_percent = ((total_expenses + monthly_cost) / salary_amount) * 100
        if projected_percent <= 70:
            return installments

    return 12  # retorna 12 se nenhuma opção ficou abaixo de 70%


@router.post("/", response_model=PurchaseResponse)
def can_i_buy(purchase: PurchaseRequest, db: Session = Depends(get_db)):

    salary = db.query(Salary).filter(Salary.is_current == True).first()
    if not salary:
        return {"error": "Nenhum salário cadastrado."}

    expenses = db.query(Expense).all()

    salary_amount = salary.amount
    total_expenses = sum(exp.amount for exp in expenses)

    current_percent_spent = (total_expenses / salary_amount) * 100

    # Simula a compra à vista para calcular impacto total
    new_total = total_expenses + purchase.amount
    new_percent_spent = (new_total / salary_amount) * 100
    impact_percent = (purchase.amount / salary_amount) * 100

    # ── Decisão de compra ──
    if new_percent_spent <= 70:
        can_buy = True
        recommendation = "✅ Compra financeiramente saudável. Você tem margem confortável."
    elif new_percent_spent <= 85:
        can_buy = True
        recommendation = "⚠️ Compra possível, mas exige cautela. Considere parcelar para aliviar o impacto mensal."
    elif new_percent_spent <= 95:
        can_buy = False
        recommendation = "🔴 Compra não recomendada. Comprometeria quase toda a sua renda disponível."
    else:
        can_buy = False
        recommendation = "🚫 Compra inviável. O valor ultrapassa sua capacidade financeira atual."

    # ── Parcelamento sugerido (lógica corrigida) ──
    suggested_installments = _suggest_installments(purchase.amount, total_expenses, salary_amount)
    installment_value = round(purchase.amount / suggested_installments, 2)

    return PurchaseResponse(
        can_buy=can_buy,
        current_percent_spent=round(current_percent_spent, 2),
        new_percent_spent=round(new_percent_spent, 2),
        impact_percent=round(impact_percent, 2),
        suggested_installments=suggested_installments,
        installment_value=installment_value,
        recommendation=recommendation,
    )