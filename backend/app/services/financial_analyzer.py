def classify_expense(category: str) -> str:
    high = ["Moradia", "Alimentação", "Saúde", "Transporte"]
    medium = ["Educação", "Internet", "Serviços"]

    if category in high:
        return "Alta urgência"
    elif category in medium:
        return "Média urgência"
    else:
        return "Baixa urgência"


def generate_suggestion(percent_spent: float) -> str:
    if percent_spent >= 80:
        return "Seus gastos estão muito altos. Considere cortar despesas de baixa urgência."
    elif percent_spent >= 60:
        return "Atenção ao orçamento. Avalie reduzir gastos não essenciais."
    else:
        return "Sua situação financeira está controlada."