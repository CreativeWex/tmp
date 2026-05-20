# Запускать
1)
```bash
docker compose up --build
```
2) http://localhost:5173

**Тестовые учётные записи**

| Роль   | Email               | Пароль    |
|--------|---------------------|-----------|
| Админ  | admin@example.com   | admin123  |
| Врач   | doctor@example.com  | doctor123 |
| Клиент | client@example.com  | client123 |

## Стек

- **Backend:** FastAPI, SQLAlchemy 2, Alembic, JWT, fpdf2, httpx
- **Frontend:** React 19, Vite 8, TypeScript, Tailwind CSS 4, TanStack Query, React Router, Radix UI, react-day-picker

---

# BeautyTrack MVP

CRM для косметологов: клиенты и фото визитов, онлайн-запись, база уходовых средств с подбором и PDF, роли (админ / врач / клиент), демо-уведомления (Telegram / SMS).
