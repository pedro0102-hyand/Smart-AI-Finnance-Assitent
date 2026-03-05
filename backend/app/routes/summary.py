from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.finance_service import get_financial_summary
from app.services.financial_analyzer import generate_suggestion

router = APIRouter(prefix="/summary", tags=["Summary"])

@router.get("/")
def financial_summary(db: Session = Depends(get_db)):
    summary = get_financial_summary(db)

    if not summary:
        raise HTTPException(status_code=400, detail="Nenhum salário cadastrado.")

    suggestion = generate_suggestion(
        expenses=summary["expenses"],
        salary=summary["salary"],
        percent_spent=summary["percent_spent"]
    )

    return {**summary, "suggestion": suggestion}