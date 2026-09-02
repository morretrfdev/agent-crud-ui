# Server

## Step 1 — DB + entity

```bash
cd server
python3 init_db.py
```

## Step 2–3 — API + chat agent

```bash
cd server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # впиши OPENAI_API_KEY
uvicorn app:app --reload --host 127.0.0.1 --port 8000
```

### CRUD

| Method | Path |
|---|---|
| GET | `/api/health` |
| GET | `/api/entities/organizations/schema` |
| GET | `/api/organizations` |
| GET | `/api/organizations/{id}` |
| POST | `/api/organizations` |
| PATCH | `/api/organizations/{id}` |
| DELETE | `/api/organizations/{id}` |

### Chat agent

`POST /api/chat`

```json
{ "sessionId": "demo-1", "message": "Покажи список организаций" }
```

Ответ:

```json
{
  "message": "...",
  "view": {
    "type": "table",
    "entity": "organizations",
    "source": { "slot": "list", "entity": "organizations" },
    "data": []
  },
  "pendingConfirm": null
}
```

Нужен `OPENAI_API_KEY` в `server/.env`.

Docs: http://127.0.0.1:8000/docs

## Deploy on Railway

Репо должен быть на GitHub. В корне уже есть `Dockerfile` и `railway.toml`.

1. Запушьте проект на GitHub (без `server/.env`).
2. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**.
3. Выберите репозиторий. Root Directory оставьте пустым (корень репо).
4. **Variables** → добавьте:
   - `OPENAI_API_KEY` — ваш ключ DeepSeek/OpenAI
   - `OPENAI_BASE_URL` = `https://api.deepseek.com`
   - `OPENAI_MODEL` = `deepseek-chat`
5. Дождитесь деплоя → **Settings → Networking → Generate Domain**.
6. Откройте `https://<ваш-домен>.up.railway.app/` — там UI и API.

Проверка: `GET /api/health` и в чате «Покажи список организаций».

Замечания: SQLite и in-memory сессии сбрасываются при редеплое; не публикуйте ключ в git.
