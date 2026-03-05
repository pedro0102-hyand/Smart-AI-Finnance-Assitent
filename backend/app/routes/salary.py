from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.salary import Salary
from app.schemas import SalaryCreate, SalaryResponse

router = APIRouter(prefix="/salary", tags=["Salary"])

@router.post("/", response_model=SalaryResponse)
def create_salary(salary: SalaryCreate, db: Session = Depends(get_db)):
    # Marca todos os salários anteriores como não-atuais
    db.query(Salary).filter(Salary.is_current == True).update({"is_current": False})

    db_salary = Salary(amount=salary.amount, is_current=True)
    db.add(db_salary)
    db.commit()
    db.refresh(db_salary)
    return db_salary

@router.get("/current", response_model=SalaryResponse)
def get_current_salary(db: Session = Depends(get_db)):
    salary = db.query(Salary).filter(Salary.is_current == True).first()
    if not salary:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Nenhum salário cadastrado.")
    return salary