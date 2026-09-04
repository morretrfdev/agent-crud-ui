FROM node:22-slim AS frontend
WORKDIR /web
COPY demo/package.json demo/package-lock.json* ./
RUN npm install
COPY demo/ ./
RUN npm run build

FROM python:3.12-slim

WORKDIR /app

COPY server/requirements.txt ./server/requirements.txt
RUN pip install --no-cache-dir -r server/requirements.txt

COPY SKILL.md data-model.md ui-rules.md examples.md tools.md ./
COPY server ./server
COPY --from=frontend /web/dist ./demo/dist

WORKDIR /app/server

ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD python init_db.py && uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}
