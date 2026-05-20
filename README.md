# Запускать
1)
```bash
docker compose up --build
```
2) http://localhost:5173









---

# BeautyTrack MVP

CRM для косметологов: клиенты и фото визитов, онлайн-запись, база уходовых средств с подбором и PDF, роли (админ / врач / клиент), демо-уведомления (Telegram / SMS).

## Требования

- Python 3.9+ и Node.js 20+ (для локального запуска)
- или Docker 20.10+ с Docker Compose v2 (для запуска одной командой)

## Запуск через Docker (рекомендуется)

```bash
docker compose up --build
```

Эта команда соберёт образы и запустит оба сервиса:

- Backend (FastAPI): http://localhost:8000 — Swagger: http://localhost:8000/docs
- Frontend (Vite): http://localhost:5173

Данные SQLite и загруженные фото визитов сохраняются в именованных Docker-томах (`backend-data`, `backend-uploads`) и переживают перезапуск контейнеров. Остановить: `docker compose down`. Полностью сбросить данные: `docker compose down -v`.

### Доступ с другого ПК в той же сети

По умолчанию фронтенд обращается к API по `http://localhost:8000`. Чтобы открыть приложение с другого устройства в локальной сети, создайте `.env` рядом с `docker-compose.yml`:

```bash
VITE_API_URL=http://<IP-хоста>:8000/api/v1
CORS_ORIGINS=http://<IP-хоста>:5173
```

и перезапустите: `docker compose up --build`.

## Быстрый старт (без Docker)

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example .env     # при необходимости поправьте переменные
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

При первом запуске создаётся SQLite БД `beautytrack.db`, сиды пользователей и 100 продуктов (если таблицы пустые).

**Тестовые учётные записи**

| Роль   | Email               | Пароль    |
|--------|---------------------|-----------|
| Админ  | admin@example.com   | admin123  |
| Врач   | doctor@example.com  | doctor123 |
| Клиент | client@example.com  | client123 |

Документация API: http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
cp ../.env.example .env
npm run dev
```

Откройте http://localhost:5173

Публичная запись: `/book/demo-clinic` (slug совпадает с `PUBLIC_CLINIC_SLUG` / настройкой клиники в БД).

## Стек

- **Backend:** FastAPI, SQLAlchemy 2, Alembic, JWT, fpdf2, httpx
- **Frontend:** React 19, Vite 8, TypeScript, Tailwind CSS 4, TanStack Query, React Router, Radix UI, react-day-picker

## Лицензия

Учебный проект.
