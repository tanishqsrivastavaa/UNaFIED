FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:0.11 /uv /bin/uv
WORKDIR /app

# The venv lives outside /app so a mounted source folder can't hide it.
ENV UV_PROJECT_ENVIRONMENT=/opt/venv PATH="/opt/venv/bin:$PATH"
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project

COPY . .
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port 8000"]
