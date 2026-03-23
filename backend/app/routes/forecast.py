from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from calendar import monthrange
from app.database import get_db
from app.deps import get_current_user
from app.models.expense import Expense
from app.models.salary import Salary
from app.models.user import User
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/summary/forecast", tags=["Forecast"])


# ── Schema de resposta ────────────────────────────────────────────────────────

class ForecastResponse(BaseModel):
    today:                  int
    days_in_month:          int
    days_remaining:         int
    days_elapsed:           int

    total_expenses:         float
    salary:                 float

    daily_average:          float
    daily_average_all:      float

    projected_total:        float
    projected_percent:      float
    projected_remaining:    float

    will_exceed_threshold:  bool
    threshold_percent:      float
    threshold_amount:       float
    exceed_day:             Optional[int]
    exceed_date:            Optional[str]

    pace:                   str
    pace_message:           str

    daily_expenses:         list[dict]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _days_with_expenses(expenses: list) -> dict[int, float]:
    by_day: dict[int, float] = {}
    for exp in expenses:
        if exp.created_at:
            day = exp.created_at.day
            by_day[day] = by_day.get(day, 0.0) + exp.amount
    return by_day


def _find_exceed_day(
    total_expenses: float,
    daily_average: float,
    threshold_amount: float,
    today: int,
    days_in_month: int,
) -> Optional[int]:
    if daily_average <= 0:
        return None
    cumulative = total_expenses
    for day in range(today + 1, days_in_month + 1):
        cumulative += daily_average
        if cumulative >= threshold_amount:
            return day
    return None


# ── Rota ─────────────────────────────────────────────────────────────────────

@router.get("/", response_model=ForecastResponse)
def get_forecast(
    threshold: float = 80.0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Projeta o comportamento financeiro até o fim do mês corrente.
    Filtra dados exclusivamente pelo usuário autenticado.
    """
    salary_row = (
        db.query(Salary)
        .filter(Salary.user_id == current_user.id, Salary.is_current == True)
        .first()
    )
    if not salary_row:
        raise HTTPException(status_code=400, detail="Nenhum salário cadastrado.")

    salary = salary_row.amount

    now            = datetime.now(timezone.utc)
    today          = now.day
    year           = now.year
    month          = now.month
    days_in_month  = monthrange(year, month)[1]
    days_elapsed   = today
    days_remaining = days_in_month - today

    expenses_this_month = (
        db.query(Expense)
        .filter(
            Expense.user_id == current_user.id,
            Expense.created_at >= datetime(year, month, 1, tzinfo=timezone.utc),
            Expense.created_at < datetime(year, month, days_in_month, 23, 59, 59, tzinfo=timezone.utc),
        )
        .all()
    )

    total_expenses = sum(e.amount for e in expenses_this_month)

    by_day         = _days_with_expenses(expenses_this_month)
    days_with_data = len(by_day) or 1

    daily_average     = total_expenses / days_with_data
    daily_average_all = total_expenses / days_elapsed if days_elapsed > 0 else 0.0

    projected_total     = total_expenses + (daily_average * days_remaining)
    projected_percent   = (projected_total / salary * 100) if salary > 0 else 0.0
    projected_remaining = salary - projected_total

    threshold_amount = salary * (threshold / 100)
    already_exceeded = total_expenses >= threshold_amount
    will_exceed      = already_exceeded or projected_total >= threshold_amount

    exceed_day: Optional[int]  = None
    exceed_date: Optional[str] = None

    if already_exceeded:
        exceed_day  = today
        exceed_date = f"dia {today} (hoje)"
    elif will_exceed:
        exceed_day = _find_exceed_day(
            total_expenses, daily_average, threshold_amount, today, days_in_month
        )
        if exceed_day:
            exceed_date = f"dia {exceed_day}"

    if projected_percent <= 70:
        pace         = "saudável"
        pace_message = "Seu ritmo de gastos está saudável. Você deve fechar o mês com saldo positivo."
    elif projected_percent <= 85:
        pace         = "atenção"
        pace_message = "Ritmo de gastos elevado. Reduza despesas não essenciais para fechar o mês no azul."
    else:
        pace         = "crítico"
        pace_message = "Ritmo crítico. No ritmo atual, seus gastos vão ultrapassar a renda antes do fim do mês."

    current_pct = (total_expenses / salary * 100) if salary > 0 else 0
    if current_pct >= threshold and days_remaining > 10:
        pace         = "crítico"
        pace_message = (
            f"Você já comprometeu {current_pct:.0f}% da renda e ainda faltam "
            f"{days_remaining} dias. Evite novos gastos não essenciais."
        )

    daily_expenses = [
        {"day": day, "amount": round(by_day.get(day, 0.0), 2)}
        for day in range(1, today + 1)
    ]

    return ForecastResponse(
        today                 = today,
        days_in_month         = days_in_month,
        days_remaining        = days_remaining,
        days_elapsed          = days_elapsed,
        total_expenses        = round(total_expenses, 2),
        salary                = round(salary, 2),
        daily_average         = round(daily_average, 2),
        daily_average_all     = round(daily_average_all, 2),
        projected_total       = round(projected_total, 2),
        projected_percent     = round(projected_percent, 1),
        projected_remaining   = round(projected_remaining, 2),
        will_exceed_threshold = will_exceed,
        threshold_percent     = threshold,
        threshold_amount      = round(threshold_amount, 2),
        exceed_day            = exceed_day,
        exceed_date           = exceed_date,
        pace                  = pace,
        pace_message          = pace_message,
        daily_expenses        = daily_expenses,
    )