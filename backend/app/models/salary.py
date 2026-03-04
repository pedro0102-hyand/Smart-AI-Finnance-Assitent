from sqlalchemy import Column, Integer, Float
from app.database import Base

class Salary(Base):

    __tablename__ = "salaries"

    id = Column(Integer, primary_key=True, index=True)
    amount = Column(Float)

