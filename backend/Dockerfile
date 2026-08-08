FROM python:3.11-slim

# INSTALL_PLAYWRIGHT=true bakes a headless Chromium (JS-render fallback) into
# the image (~500MB). Default off: the platform crawls via HTTP and uses the
# Firecrawl provider (optional) for JS-heavy websites.
ARG INSTALL_PLAYWRIGHT=false

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && if [ "$INSTALL_PLAYWRIGHT" = "true" ]; then \
        pip install --no-cache-dir playwright && \
        playwright install --with-deps chromium ; \
    fi

COPY . .

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s \
    CMD curl -fsS http://localhost:8000/api/v1/health || exit 1

# Entrypoint runs Alembic migrations when RUN_MIGRATIONS=true, then serves.
CMD ["sh", "-c", "if [ \"$RUN_MIGRATIONS\" = \"true\" ]; then alembic upgrade head; fi && \
     uvicorn app.main:app --host 0.0.0.0 --port 8000"]
