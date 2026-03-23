from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models.expense import Expense
from app.models.user import User
from app.models.salary import Salary
from app.schemas import ExpenseCreate, ExpenseResponse, ExpenseUpdate

router = APIRouter(prefix="/expenses", tags=["Expenses"])


@router.post("/", response_model=ExpenseResponse, status_code=201)
def create_expense(
    expense: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    salary = db.query(Salary).filter(
        Salary.user_id == current_user.id,
        Salary.is_current == True,
    ).first()

    db_expense = Expense(**expense.model_dump(), user_id=current_user.id)
    db_expense.set_urgency()

    # Calcula e persiste impact_percent no momento da criação
    if salary and salary.amount > 0:
        db_expense.impact_percent = round((db_expense.amount / salary.amount) * 100, 2)
    else:
        db_expense.impact_percent = 0.0

    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)
    return db_expense


@router.get("/", response_model=list[ExpenseResponse])
def list_expenses(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Expense)
        .filter(Expense.user_id == current_user.id)
        .order_by(Expense.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get("/{expense_id}", response_model=ExpenseResponse)
def get_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    expense = (
        db.query(Expense)
        .filter(Expense.id == expense_id, Expense.user_id == current_user.id)
        .first()
    )
    if not expense:
        raise HTTPException(status_code=404, detail="Gasto não encontrado.")
    return expense


@router.put("/{expense_id}", response_model=ExpenseResponse)
def update_expense(
    expense_id: int,
    updates: ExpenseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    expense = (
        db.query(Expense)
        .filter(Expense.id == expense_id, Expense.user_id == current_user.id)
        .first()
    )
    if not expense:
        raise HTTPException(status_code=404, detail="Gasto não encontrado.")

    update_data = updates.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(expense, field, value)

    if "category" in update_data:
        expense.set_urgency()

    # Recalcula impact_percent se o valor foi alterado
    if "amount" in update_data:
        salary = db.query(Salary).filter(
            Salary.user_id == current_user.id,
            Salary.is_current == True,
        ).first()
        if salary and salary.amount > 0:
            expense.impact_percent = round((expense.amount / salary.amount) * 100, 2)
        else:
            expense.impact_percent = 0.0

    db.commit()
    db.refresh(expense)
    return expense


@router.delete("/{expense_id}", status_code=204)
def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    expense = (
        db.query(Expense)
        .filter(Expense.id == expense_id, Expense.user_id == current_user.id)
        .first()
    )
    if not expense:
        raise HTTPException(status_code=404, detail="Gasto não encontrado.")
    db.delete(expense)
    db.commit()


@router.delete("/", status_code=204)
def delete_all_expenses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db.query(Expense).filter(Expense.user_id == current_user.id).delete()
    db.commit()