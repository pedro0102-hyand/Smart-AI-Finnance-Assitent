from sqlalchemy import Column, Integer, Float, DateTime, Boolean
from sqlalchemy.sql import func
from app.database import Base

class Salary(Base):

    __tablename__ = "salaries"

    id = Column(Integer, primary_key=True, index=True)
    amount = Column(Float)
    is_current = Column(Boolean, default=True)                          # indica se é o salário ativo
    created_at = Column(DateTime(timezone=True), server_default=func.now())  # data do registro
