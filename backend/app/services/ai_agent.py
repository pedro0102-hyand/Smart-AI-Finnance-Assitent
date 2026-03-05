import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

model = genai.GenerativeModel("gemini-2.5-flash-lite")

def chat_with_ai(message: str, financial_context: dict):

    system_prompt = f"""
    Você é um assistente financeiro inteligente.

    Dados financeiros atuais do usuário:
    - Salário: {financial_context['salary']}
    - Total de despesas: {financial_context['total_expenses']}
    - Percentual comprometido: {financial_context.get('percentage_spent', 0)}%

    Use esses dados para responder com precisão.
    """

    full_prompt = system_prompt + "\n\nPergunta do usuário:\n" + message

    response = model.generate_content(full_prompt)

    return response.text
