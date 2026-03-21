from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func
from app.database import Base
from app.services.financial_analyzer import classify_expense

class Expense(Base):

    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    description = Column(String, index=True)
    amount = Column(Float)
    category = Column(String, index=True)
    urgency = Column(String, index=True)                        # persistido no banco
    created_at = Column(DateTime(timezone=True), server_default=func.now())  # data do gasto

    def set_urgency(self):
        """
        Define urgency automaticamente combinando descrição + categoria.

        Usar apenas a categoria era insuficiente — o usuário pode colocar
        categoria "Outros" e descrição "Parcela da moto", fazendo a IA
        classificar errado por falta de contexto.

        Combinando os dois campos, o classificador local captura palavras-chave
        como "parcela", "financiamento", "remédio" direto da descrição,
        e a IA recebe um texto muito mais rico quando o fallback é necessário.

        Exemplos:
            descrição="Parcela da moto"  categoria="Outros"
            → combined="Parcela da moto Outros"
            → keyword "parcela" detectada → Alta urgência ✅

            descrição="Netflix"  categoria="Streaming"
            → combined="Netflix Streaming"
            → keyword "streaming" detectada → Média urgência ✅

            descrição="Jantar no restaurante"  categoria="Lazer"
            → nenhuma keyword de alta/média → IA classifica → Baixa urgência ✅
        """
        combined = f"{self.description} {self.category}"
        self.urgency = classify_expense(combined)