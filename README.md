# SmartFinance — Assistente Financeiro Inteligente

Um assistente financeiro pessoal full-stack com IA, que analisa seus gastos, projeta seu orçamento e responde perguntas sobre suas finanças em linguagem natural.

---

## Funcionalidades

- **Dashboard** — visão geral do orçamento com gráficos de categorias, projeção do mês e sugestões da IA
- **Gestão de gastos** — cadastro, edição, exclusão e busca de despesas com classificação automática de urgência por IA
- **Salário** — histórico completo de renda com variação percentual entre períodos
- **Posso comprar?** — análise inteligente de compras com sugestão de parcelamento e commentary da IA
- **Chat com IA** — assistente conversacional com histórico persistido, focado exclusivamente em finanças pessoais
- **Projeção mensal** — previsão de gastos até o fim do mês com alertas de ritmo (saudável / atenção / crítico)
- **Autenticação JWT** — registro, login e refresh token automático

---

## Stack

### Backend
- **Python 3.11+** com FastAPI
- **SQLite** via SQLAlchemy ORM
- **Google Gemini** (gemini-2.5-flash-lite) para classificação de gastos, sugestões e chat
- **JWT** com `python-jose` + `passlib` para autenticação

### Frontend
- **React 19** + **TypeScript** + **Vite 8**
- **Tailwind CSS 3** com tema dark/light
- **Recharts** para gráficos
- **React Router 7**

---

## Pré-requisitos

- Python 3.11+
- Node.js 20+ / npm
- Chave de API do Google Gemini ([obtenha aqui](https://aistudio.google.com/app/apikey))

---

## Instalação e execução local

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/smartfinance.git
cd smartfinance
```

### 2. Backend

```bash
cd backend

# Crie e ative o ambiente virtual
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Instale as dependências
pip install -r ../requirements.txt

# Configure as variáveis de ambiente
cp .env.example .env
# Edite .env e adicione sua GOOGLE_API_KEY e SECRET_KEY
```

Exemplo de `.env`:

```env
GOOGLE_API_KEY=sua_chave_aqui
SECRET_KEY=uma_string_longa_e_aleatoria
APP_ENV=development
ALLOWED_ORIGINS=http://localhost:5173
```

```bash
# Inicie o servidor
uvicorn app.main:app --reload --port 8000
```

A API estará disponível em `http://localhost:8000`. Documentação interativa em `http://localhost:8000/docs`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

O app estará disponível em `http://localhost:5173`.

---

## Migrações de banco de dados

Se você já tem um banco de dados de uma versão anterior, execute os scripts de migração:

```bash
cd backend

# Adiciona suporte a múltiplos usuários (migração inicial)
python migrate_add_auth.py --email seu@email.com --name "Seu Nome" --password suasenha

# Adiciona user_id em chat_sessions e impact_percent em expenses
python migrate_v2.py

# Recalcula urgência de gastos existentes com o novo critério
python migrate_urgency.py
```

Use a flag `--dry-run` em qualquer script para simular sem salvar alterações.

---

## Estrutura do projeto

```
smartfinance/
├── backend/
│   ├── app/
│   │   ├── models/          # SQLAlchemy models (User, Expense, Salary, ChatSession)
│   │   ├── routes/          # Endpoints FastAPI (auth, expenses, salary, chat, etc.)
│   │   ├── schemas/         # Pydantic schemas de validação
│   │   ├── services/        # Lógica de negócio e integração com Gemini
│   │   │   ├── ai_agent.py          # Chat com histórico persistido
│   │   │   ├── financial_analyzer.py # Classificação de urgência e sugestões
│   │   │   └── api_retry.py         # Retry com backoff para rate limits
│   │   ├── database.py      # Configuração SQLite + SQLAlchemy
│   │   ├── deps.py          # Dependências de autenticação
│   │   └── main.py          # Aplicação FastAPI
│   ├── migrate_add_auth.py
│   ├── migrate_v2.py
│   └── migrate_urgency.py
├── frontend/
│   └── src/
│       ├── components/      # Layout, PrivateRoute
│       ├── context/         # Auth, Theme, Toast
│       ├── pages/           # Dashboard, Expenses, Salary, Purchase, Chat, Auth
│       ├── services/        # api.ts com todos os endpoints
│       └── types/           # Interfaces TypeScript
├── requirements.txt
└── render.yaml              # Deploy no Render
```

---

## Endpoints principais da API

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/auth/register` | Criar conta |
| POST | `/auth/login` | Login com JWT |
| POST | `/auth/refresh` | Renovar access token |
| GET | `/summary/` | Resumo financeiro com sugestão da IA |
| GET | `/summary/forecast/` | Projeção do mês |
| GET/POST | `/expenses/` | Listar / criar gastos |
| PUT/DELETE | `/expenses/{id}` | Editar / excluir gasto |
| GET/POST | `/salary/` | Histórico / cadastrar salário |
| POST | `/can-i-buy/` | Análise de compra |
| POST | `/chat/` | Mensagem ao assistente |
| DELETE | `/chat/history/{session_id}` | Limpar histórico do chat |

---

## Deploy no Render

O arquivo `render.yaml` na raiz do projeto já está configurado para deploy do backend. Defina as variáveis de ambiente no painel do Render:

- `GOOGLE_API_KEY`
- `SECRET_KEY`
- `APP_ENV=production`
- `ALLOWED_ORIGINS=https://seu-frontend.vercel.app`

Para o frontend, faça deploy em Vercel ou Netlify apontando para a pasta `frontend/` e configure a variável de ambiente:

```
VITE_API_URL=https://seu-backend.onrender.com
```

---

## Testes

```bash
cd backend

# Testes do mecanismo de retry da API Gemini
pytest test_api_retry.py -v

# Testes de persistência do histórico de chat
pytest test_chat_persistence.py -v
```

---

## Variáveis de ambiente

| Variável | Descrição | Obrigatória |
|----------|-----------|-------------|
| `GOOGLE_API_KEY` | Chave da API do Google Gemini | Sim |
| `SECRET_KEY` | Chave secreta para JWT (string aleatória longa) | Sim em produção |
| `APP_ENV` | `development` ou `production` | Não (padrão: development) |
| `ALLOWED_ORIGINS` | URLs permitidas no CORS (separadas por vírgula) | Não (padrão: localhost:5173) |
| `VITE_API_URL` | URL base da API (frontend) | Não (padrão: localhost:8000) |

---

