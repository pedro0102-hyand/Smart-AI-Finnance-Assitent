from pydantic import BaseModel
from datetime import datetime

class SalaryCreate(BaseModel):
    amount: float

class SalaryResponse(SalaryCreate):
    id: int
    is_current: bool
    created_at: datetime

    class Config:
        from_attributes = True