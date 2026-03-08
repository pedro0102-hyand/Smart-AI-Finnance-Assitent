from pydantic import BaseModel, field_validator
from datetime import datetime


class SalaryCreate(BaseModel):
    amount: float

    @field_validator("amount")
    @classmethod
    def amount_must_be_positive(cls, v):
        if v <= 0:
            raise ValueError("O salário deve ser maior que zero.")
        return round(v, 2)


class SalaryResponse(SalaryCreate):
    id: int
    is_current: bool
    created_at: datetime

    class Config:
        from_attributes = True