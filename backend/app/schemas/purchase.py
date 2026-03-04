from pydantic import BaseModel

class PurchaseRequest(BaseModel):

    description: str
    amount: float

class PurchaseResponse(BaseModel):

    can_buy:  bool
    current_percent_spent: float
    new_percent_spent: float
    impact_percent: float
    suggested_installments: int
    recommendation: str

