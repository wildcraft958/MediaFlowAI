FROM python:3.11-slim-bookworm

# System deps for WeasyPrint (PDF generation) + curl for health probes
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcairo2 libpango-1.0-0 libpangocairo-1.0-0 \
    libgdk-pixbuf2.0-0 libffi-dev shared-mime-info \
    fonts-liberation curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install uv (fast Python package manager)
RUN pip install uv --quiet

# Install Python dependencies (layer-cached separately from source)
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen

# Copy full source (includes data/, agents/, api/, frontend/dist/, SA key)
COPY . .

# GCP credentials — service account key baked in for demo
ENV GOOGLE_APPLICATION_CREDENTIALS=/app/service-account-key.json

# Web search uses Vertex AI Google Search grounding — no extra API key needed

# Pre-download Chronos-Bolt-Tiny model at build time so cold starts are instant.
# (~150 MB, cached in /root/.cache/huggingface inside the image layer)
RUN uv run python -c "\
import torch; \
from chronos import BaseChronosPipeline; \
BaseChronosPipeline.from_pretrained('amazon/chronos-bolt-tiny', device_map='cpu', dtype=torch.float32); \
print('Chronos model cached.')"

# Build DuckDB fully at image build time: shift dates + star schema + KPI views.
# Nothing runs at container start — uvicorn boots instantly.
RUN uv run python data/shift_dates.py \
 && uv run python data/schema.py \
 && echo "analytics.duckdb pre-built."

# Cloud Run always uses 8080
EXPOSE 8080

# Instant startup — DB and Chronos model are already baked into the image
CMD ["uv", "run", "uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
