from pydantic import BaseModel, field_validator
from typing import Optional


class PurchaseRequest(BaseModel):
    description: str
    amount: float

    @field_validator("amount")
    @classmethod
    def amount_must_be_positive(cls, v):
        if v <= 0:
            raise ValueError("O valor da compra deve ser maior que zero.")
        return round(v, 2)

    @field_validator("description")
    @classmethod
    def description_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("A descrição não pode ser vazia.")
        return v.strip()


class PurchaseResponse(BaseModel):
    can_buy: bool
    current_percent_spent: float
    new_percent_spent: float
    impact_percent: float
    suggested_installments: int
    installment_value: float
    recommendation: str
    ai_analysis: Optional[str] = None  # análise qualitativa gerada pela IA
