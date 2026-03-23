from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base
from app.services.financial_analyzer import classify_expense


class Expense(Base):
    __tablename__ = "expenses"

    id             = Column(Integer, primary_key=True, index=True)
    user_id        = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    description    = Column(String, index=True)
    amount         = Column(Float)
    category       = Column(String, index=True)
    urgency        = Column(String, index=True)
    # Persistido no banco para evitar recalcular a cada leitura e garantir
    # consistência mesmo que o salário mude depois do registro.
    impact_percent = Column(Float, nullable=False, default=0.0)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())

    def set_urgency(self):
        combined = f"{self.description} {self.category}"
        self.urgency = classify_expense(combined)