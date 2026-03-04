from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.salary import Salary
from app.schemas import SalaryCreate, SalaryResponse

router = APIRouter(prefix="/salary", tags=["Salary"])

@router.post("/", response_model=SalaryResponse)
def create_salary(salary: SalaryCreate, db: Session = Depends(get_db)):
    db_salary = Salary(amount=salary.amount)
    db.add(db_salary)
    db.commit()
    db.refresh(db_salary)
    return db_salary