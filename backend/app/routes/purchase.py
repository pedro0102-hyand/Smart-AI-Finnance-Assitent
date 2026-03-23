from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models.expense import Expense
from app.models.salary import Salary
from app.models.user import User
from app.schemas.purchase import PurchaseRequest, PurchaseResponse
from app.services.financial_analyzer import analyze_purchase

router = APIRouter(prefix="/can-i-buy", tags=["Purchase"])


def _suggest_installments(purchase_amount: float, total_expenses: float, salary_amount: float) -> int:
    """
    Determina o menor número de parcelas que mantém o orçamento saudável (≤ 70%).

    - Testa 1x primeiro (à vista) — se já cabe no orçamento, retorna 1
    - Itera de 2 a 12 até encontrar o menor parcelamento viável
    - Se nenhuma opção couber em 12x, retorna 12 como máximo sugerido
    """
    for installments in range(1, 13):
        monthly_cost = purchase_amount / installments
        projected_percent = ((total_expenses + monthly_cost) / salary_amount) * 100
        if projected_percent <= 70:
            return installments
    return 12


@router.post("/", response_model=PurchaseResponse)
def can_i_buy(
    purchase: PurchaseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    salary = (
        db.query(Salary)
        .filter(Salary.user_id == current_user.id, Salary.is_current == True)
        .first()
    )
    if not salary:
        return {"error": "Nenhum salário cadastrado."}

    expenses = db.query(Expense).filter(Expense.user_id == current_user.id).all()

    salary_amount  = salary.amount
    total_expenses = sum(exp.amount for exp in expenses)

    current_percent_spent = (total_expenses / salary_amount) * 100

    new_total         = total_expenses + purchase.amount
    new_percent_spent = (new_total / salary_amount) * 100
    impact_percent    = (purchase.amount / salary_amount) * 100

    # ── Decisão numérica ──────────────────────────────────────────────────────
    if new_percent_spent <= 70:
        can_buy        = True
        recommendation = "✅ Compra financeiramente saudável. Você tem margem confortável."
    elif new_percent_spent <= 85:
        can_buy        = True
        recommendation = "⚠️ Compra possível, mas exige cautela. Considere parcelar para aliviar o impacto mensal."
    elif new_percent_spent <= 95:
        can_buy        = False
        recommendation = "🔴 Compra não recomendada. Comprometeria quase toda a sua renda disponível."
    else:
        can_buy        = False
        recommendation = "🚫 Compra inviável. O valor ultrapassa sua capacidade financeira atual."

    # ── Parcelamento sugerido ─────────────────────────────────────────────────
    suggested_installments = _suggest_installments(purchase.amount, total_expenses, salary_amount)
    installment_value      = round(purchase.amount / suggested_installments, 2)

    # ── Análise qualitativa via IA ────────────────────────────────────────────
    detailed_expenses = [
        {
            "description": exp.description,
            "amount":      exp.amount,
            "category":    exp.category,
            "urgency":     exp.urgency,
        }
        for exp in expenses
    ]

    ai_analysis = analyze_purchase(
        description            = purchase.description,
        amount                 = purchase.amount,
        salary                 = salary_amount,
        current_percent_spent  = current_percent_spent,
        new_percent_spent      = new_percent_spent,
        suggested_installments = suggested_installments,
        installment_value      = installment_value,
        can_buy                = can_buy,
        expenses               = detailed_expenses,
    )

    return PurchaseResponse(
        can_buy                = can_buy,
        current_percent_spent  = round(current_percent_spent, 2),
        new_percent_spent      = round(new_percent_spent, 2),
        impact_percent         = round(impact_percent, 2),
        suggested_installments = suggested_installments,
        installment_value      = installment_value,
        recommendation         = recommendation,
        ai_analysis            = ai_analysis,
    )