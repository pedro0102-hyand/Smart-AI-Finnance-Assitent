from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models.salary import Salary
from app.models.user import User
from app.schemas import SalaryCreate, SalaryResponse

router = APIRouter(prefix="/salary", tags=["Salary"])


@router.post("/", response_model=SalaryResponse, status_code=201)
def create_salary(
    salary: SalaryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cadastra um novo salário e marca os anteriores do usuário como inativos."""
    db.query(Salary).filter(
        Salary.user_id == current_user.id,
        Salary.is_current == True,
    ).update({"is_current": False})

    db_salary = Salary(amount=salary.amount, is_current=True, user_id=current_user.id)
    db.add(db_salary)
    db.commit()
    db.refresh(db_salary)
    return db_salary


@router.get("/current", response_model=SalaryResponse)
def get_current_salary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retorna o salário ativo atual do usuário autenticado."""
    salary = (
        db.query(Salary)
        .filter(Salary.user_id == current_user.id, Salary.is_current == True)
        .first()
    )
    if not salary:
        raise HTTPException(status_code=404, detail="Nenhum salário cadastrado.")
    return salary


@router.get("/history", response_model=list[SalaryResponse])
def get_salary_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retorna o histórico completo de salários do usuário autenticado,
    do mais recente ao mais antigo.
    """
    salaries = (
        db.query(Salary)
        .filter(Salary.user_id == current_user.id)
        .order_by(Salary.created_at.desc())
        .all()
    )
    if not salaries:
        raise HTTPException(status_code=404, detail="Nenhum histórico de salário encontrado.")
    return salaries