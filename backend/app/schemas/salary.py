from pydantic import BaseModel

class SalaryCreate(BaseModel):
    amount: float

class SalaryResponse(SalaryCreate):
    id: int

    class Config:
        from_attributes = True