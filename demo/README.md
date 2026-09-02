# Demo UI + live agent

## Запуск всего стека

```bash
cd server
source .venv/bin/activate
# .env с OPENAI_API_KEY (DeepSeek) уже нужен
uvicorn app:app --reload --host 127.0.0.1 --port 8000
```

Открыть: **http://127.0.0.1:8000/**

Чат ходит в `POST /api/chat`.

Примеры в чате:
- Покажи список организаций
- Открой организацию №1
