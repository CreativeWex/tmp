Запуск
Терминал 1: cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && alembic upgrade head && uvicorn app.main:app --reload --port 8000
Терминал 2: cd frontend && npm install && npm run dev
Кабинет: http://localhost:5173 — войти как врач/админ.
Онлайн-запись: http://localhost:5173/book/demo-clinic