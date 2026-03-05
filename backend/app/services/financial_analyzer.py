import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

model = genai.GenerativeModel("gemini-2.5-flash-lite")

# Mapeamento normalizado de categorias para urgência
HIGH_URGENCY = ["moradia", "alimentação", "alimentacao", "saúde", "saude", "transporte"]
MEDIUM_URGENCY = ["educação", "educacao", "internet", "serviços", "servicos", "utilidades"]


def classify_expense(category: str) -> str:
    """
    Classifica a urgência de um gasto com base na categoria.
    A comparação é feita em lowercase e sem acento para evitar erros de digitação.
    """
    normalized = category.strip().lower()

    if normalized in HIGH_URGENCY:
        return "Alta urgência"
    elif normalized in MEDIUM_URGENCY:
        return "Média urgência"
    else:
        return "Baixa urgência"


def generate_suggestion(expenses: list[dict], salary: float, percent_spent: float) -> str:
    """
    Usa o Gemini para gerar sugestões financeiras inteligentes e personalizadas
    com base nos gastos individuais do usuário.
    """
    if not expenses:
        return "Nenhum gasto cadastrado para análise."

    expenses_text = "\n".join(
        f"- {exp['description']} ({exp['category']}): R$ {exp['amount']:.2f} "
        f"[{exp.get('urgency', 'Não classificado')}] — {exp.get('impact_percent', 0):.1f}% da renda"
        for exp in expenses
    )

    prompt = f"""
Você é um consultor financeiro pessoal experiente e empático.

O usuário possui as seguintes informações financeiras:
- Salário mensal: R$ {salary:.2f}
- Total comprometido: {percent_spent:.1f}% da renda

Lista de gastos:
{expenses_text}

Com base nesses dados, forneça sugestões financeiras personalizadas e práticas. Inclua:
1. Quais gastos de baixa urgência podem ser cortados ou reduzidos
2. Se há gastos desproporcionais em relação à renda
3. Uma estimativa de quanto o usuário pode economizar com as sugestões
4. Um conselho motivacional ao final

Seja direto, claro e use linguagem acessível. Responda em português.
"""

    response = model.generate_content(prompt)
    return response.text