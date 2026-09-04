## Demo UI (React + Vite + Radix Themes)

## Dev

```bash
# терминал 1 — API
cd server && source .venv/bin/activate && uvicorn app:app --reload --host 127.0.0.1 --port 8000

# терминал 2 — React
cd demo && npm install && npm run dev
```

Открыть: http://127.0.0.1:5173/ (прокси `/api` → :8000)

## Production build

```bash
cd demo && npm install && npm run build
```

Статика попадает в `demo/dist`. FastAPI отдаёт её с http://127.0.0.1:8000/
