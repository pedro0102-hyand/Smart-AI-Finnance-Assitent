from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.expense import Expense
from app.schemas import ExpenseCreate, ExpenseResponse, ExpenseUpdate

router = APIRouter(prefix="/expenses", tags=["Expenses"])


@router.post("/", response_model=ExpenseResponse, status_code=201)
def create_expense(expense: ExpenseCreate, db: Session = Depends(get_db)):
    db_expense = Expense(**expense.model_dump())
    db_expense.set_urgency()
    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)
    return db_expense


@router.get("/", response_model=list[ExpenseResponse])
def list_expenses(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Lista gastos com paginação simples via skip/limit."""
    return db.query(Expense).order_by(Expense.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/{expense_id}", response_model=ExpenseResponse)
def get_expense(expense_id: int, db: Session = Depends(get_db)):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Gasto não encontrado.")
    return expense


@router.put("/{expense_id}", response_model=ExpenseResponse)
def update_expense(expense_id: int, updates: ExpenseUpdate, db: Session = Depends(get_db)):
    """
    Atualiza um gasto existente.
    Recalcula a urgência automaticamente se a categoria foi alterada.
    """
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Gasto não encontrado.")

    update_data = updates.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(expense, field, value)

    # Recalcula urgência se categoria mudou
    if "category" in update_data:
        expense.set_urgency()

    db.commit()
    db.refresh(expense)
    return expense


@router.delete("/{expense_id}", status_code=204)
def delete_expense(expense_id: int, db: Session = Depends(get_db)):
    """Remove um gasto pelo ID."""
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Gasto não encontrado.")
    db.delete(expense)
    db.commit()


@router.delete("/", status_code=204)
def delete_all_expenses(db: Session = Depends(get_db)):
    """Remove todos os gastos (zerar o mês)."""
    db.query(Expense).delete()
    db.commit()