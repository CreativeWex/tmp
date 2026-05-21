FROM mirror.gcr.io/library/python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY . .

# Создаём директории, которые монтируются как volumes
RUN mkdir -p /app/data /app/uploads

EXPOSE 8000

# Применяем миграции и только потом стартуем сервер
CMD ["sh", "-c", "mkdir -p /app/data /app/uploads && alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
