from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import Optional


class ExpenseBase(BaseModel):
    description: str
    amount: float
    category: str

    @field_validator("amount")
    @classmethod
    def amount_must_be_positive(cls, v):
        if v <= 0:
            raise ValueError("O valor do gasto deve ser maior que zero.")
        return round(v, 2)

    @field_validator("description")
    @classmethod
    def description_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("A descrição não pode ser vazia.")
        return v.strip()

    @field_validator("category")
    @classmethod
    def category_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("A categoria não pode ser vazia.")
        return v.strip()


class ExpenseCreate(ExpenseBase):
    pass


class ExpenseUpdate(BaseModel):
    """Todos os campos são opcionais para permitir atualização parcial (PATCH-like)."""
    description: Optional[str] = None
    amount: Optional[float] = None
    category: Optional[str] = None

    @field_validator("amount")
    @classmethod
    def amount_must_be_positive(cls, v):
        if v is not None and v <= 0:
            raise ValueError("O valor do gasto deve ser maior que zero.")
        return round(v, 2) if v is not None else v

    @field_validator("description")
    @classmethod
    def description_not_empty(cls, v):
        if v is not None and not v.strip():
            raise ValueError("A descrição não pode ser vazia.")
        return v.strip() if v else v

    @field_validator("category")
    @classmethod
    def category_not_empty(cls, v):
        if v is not None and not v.strip():
            raise ValueError("A categoria não pode ser vazia.")
        return v.strip() if v else v


class ExpenseResponse(ExpenseBase):
    id: int
    urgency: str
    created_at: datetime

    class Config:
        from_attributes = True