from pydantic import BaseModel
from datetime import datetime

class ExpenseBase(BaseModel):
    description: str
    amount: float
    category: str

class ExpenseCreate(ExpenseBase):
    pass

class ExpenseResponse(ExpenseBase):
    id: int
    urgency: str
    created_at: datetime

    class Config:
        from_attributes = True