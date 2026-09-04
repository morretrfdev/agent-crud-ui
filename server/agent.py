"""Chat agent bound to agent-crud-ui skill + organization tools."""

from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path
from typing import Any

from openai import OpenAI

ROOT = Path(__file__).resolve().parent
SKILL_ROOT = ROOT.parent
DB_PATH = ROOT / "data" / "app.db"
ENTITIES_DIR = ROOT / "entities"
ENTITY_KEYS = ("organizations", "users")

SKILL_FILES = [
    "SKILL.md",
    "data-model.md",
    "ui-rules.md",
    "examples.md",
    "tools.md",
]

ALLOWED_STATUSES = {"Одобрено", "Возвращено", "На рассмотрении", "Черновик"}

# sessionId -> { pendingConfirm?: {entity, id, operation} }
SESSIONS: dict[str, dict[str, Any]] = {}


def _db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _org_row(row: sqlite3.Row) -> dict[str, Any]:
    return {"id": row["id"], "name": row["name"], "status": row["status"]}


def _user_row(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "fullName": row["full_name"],
        "registeredAt": row["registered_at"],
    }


def _load_schema(entity: str) -> dict[str, Any]:
    path = ENTITIES_DIR / f"{entity}.json"
    return json.loads(path.read_text(encoding="utf-8"))


def load_skill_prompt() -> str:
    chunks: list[str] = [
        "Ты агент чат-админки. Следуй скиллу agent-crud-ui строго.",
        "Entities в этом демо: organizations (Организации), users (Пользователи).",
        "Ключ entity в view: organizations | users.",
        "После инструментов верни ТОЛЬКО JSON объекта ответа (без markdown):",
        '{"message":"строка или пусто","view":{...},"pendingConfirm":null|объект}',
        "view.type: table|form|empty|error; view.entity; view.source:{slot,entity}; view.data.",
        "source.slot: list|get|create|update|delete.",
        "",
    ]
    for name in SKILL_FILES:
        path = SKILL_ROOT / name
        if path.exists():
            chunks.append(f"## {name}\n{path.read_text(encoding='utf-8')}\n")
    for key in ENTITY_KEYS:
        path = ENTITIES_DIR / f"{key}.json"
        if path.exists():
            chunks.append(
                f"## entity schema {key}.json\n"
                + path.read_text(encoding="utf-8")
            )
    return "\n".join(chunks)


TOOL_DEFS = [
    {
        "type": "function",
        "function": {
            "name": "get_schema",
            "description": "Схема полей entity organizations или users",
            "parameters": {
                "type": "object",
                "properties": {
                    "entity": {
                        "type": "string",
                        "enum": ["organizations", "users"],
                    }
                },
                "required": ["entity"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_organizations",
            "description": "Список организаций. Опциональный фильтр status.",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {
                        "type": "string",
                        "enum": sorted(ALLOWED_STATUSES),
                    }
                },
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_organization",
            "description": "Одна организация по id",
            "parameters": {
                "type": "object",
                "properties": {"id": {"type": "integer"}},
                "required": ["id"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_organization",
            "description": "Создать организацию. id назначит БД.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "status": {"type": "string", "enum": sorted(ALLOWED_STATUSES)},
                },
                "required": ["name", "status"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_organization",
            "description": "Обновить организацию по id",
            "parameters": {
                "type": "object",
                "properties": {
                    "id": {"type": "integer"},
                    "name": {"type": "string"},
                    "status": {"type": "string", "enum": sorted(ALLOWED_STATUSES)},
                },
                "required": ["id"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_organization",
            "description": "Удалить организацию по id (только после confirm)",
            "parameters": {
                "type": "object",
                "properties": {"id": {"type": "integer"}},
                "required": ["id"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_users",
            "description": "Список пользователей (ФИО, дата регистрации, id)",
            "parameters": {
                "type": "object",
                "properties": {},
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_user",
            "description": "Один пользователь по id",
            "parameters": {
                "type": "object",
                "properties": {"id": {"type": "integer"}},
                "required": ["id"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_user",
            "description": "Создать пользователя. id назначит БД. registeredAt: YYYY-MM-DD",
            "parameters": {
                "type": "object",
                "properties": {
                    "fullName": {"type": "string"},
                    "registeredAt": {"type": "string"},
                },
                "required": ["fullName", "registeredAt"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_user",
            "description": "Обновить пользователя по id",
            "parameters": {
                "type": "object",
                "properties": {
                    "id": {"type": "integer"},
                    "fullName": {"type": "string"},
                    "registeredAt": {"type": "string"},
                },
                "required": ["id"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_user",
            "description": "Удалить пользователя по id (только после confirm)",
            "parameters": {
                "type": "object",
                "properties": {"id": {"type": "integer"}},
                "required": ["id"],
                "additionalProperties": False,
            },
        },
    },
]


def run_tool(name: str, args: dict[str, Any]) -> Any:
    if name == "get_schema":
        entity = args.get("entity", "organizations")
        if entity not in ENTITY_KEYS:
            return {"error": f"unknown_entity:{entity}"}
        return _load_schema(entity)

    conn = _db()
    try:
        if name == "list_organizations":
            status = args.get("status")
            if status:
                rows = conn.execute(
                    "SELECT id, name, status FROM organizations WHERE status = ? ORDER BY id",
                    (status,),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT id, name, status FROM organizations ORDER BY id"
                ).fetchall()
            return [_org_row(r) for r in rows]

        if name == "get_organization":
            row = conn.execute(
                "SELECT id, name, status FROM organizations WHERE id = ?",
                (args["id"],),
            ).fetchone()
            return _org_row(row) if row else {"error": "not_found"}

        if name == "create_organization":
            cur = conn.execute(
                "INSERT INTO organizations (name, status) VALUES (?, ?)",
                (args["name"].strip(), args["status"]),
            )
            conn.commit()
            row = conn.execute(
                "SELECT id, name, status FROM organizations WHERE id = ?",
                (cur.lastrowid,),
            ).fetchone()
            return _org_row(row)

        if name == "update_organization":
            row = conn.execute(
                "SELECT id, name, status FROM organizations WHERE id = ?",
                (args["id"],),
            ).fetchone()
            if not row:
                return {"error": "not_found"}
            name_v = args["name"].strip() if args.get("name") else row["name"]
            status_v = args.get("status") or row["status"]
            conn.execute(
                "UPDATE organizations SET name = ?, status = ? WHERE id = ?",
                (name_v, status_v, args["id"]),
            )
            conn.commit()
            updated = conn.execute(
                "SELECT id, name, status FROM organizations WHERE id = ?",
                (args["id"],),
            ).fetchone()
            return _org_row(updated)

        if name == "delete_organization":
            row = conn.execute(
                "SELECT id FROM organizations WHERE id = ?",
                (args["id"],),
            ).fetchone()
            if not row:
                return {"error": "not_found"}
            conn.execute("DELETE FROM organizations WHERE id = ?", (args["id"],))
            conn.commit()
            return {"deleted": True, "id": args["id"]}

        if name == "list_users":
            rows = conn.execute(
                "SELECT id, full_name, registered_at FROM users ORDER BY id"
            ).fetchall()
            return [_user_row(r) for r in rows]

        if name == "get_user":
            row = conn.execute(
                "SELECT id, full_name, registered_at FROM users WHERE id = ?",
                (args["id"],),
            ).fetchone()
            return _user_row(row) if row else {"error": "not_found"}

        if name == "create_user":
            cur = conn.execute(
                "INSERT INTO users (full_name, registered_at) VALUES (?, ?)",
                (args["fullName"].strip(), args["registeredAt"]),
            )
            conn.commit()
            row = conn.execute(
                "SELECT id, full_name, registered_at FROM users WHERE id = ?",
                (cur.lastrowid,),
            ).fetchone()
            return _user_row(row)

        if name == "update_user":
            row = conn.execute(
                "SELECT id, full_name, registered_at FROM users WHERE id = ?",
                (args["id"],),
            ).fetchone()
            if not row:
                return {"error": "not_found"}
            full_name = (
                args["fullName"].strip()
                if args.get("fullName")
                else row["full_name"]
            )
            registered_at = args.get("registeredAt") or row["registered_at"]
            conn.execute(
                "UPDATE users SET full_name = ?, registered_at = ? WHERE id = ?",
                (full_name, registered_at, args["id"]),
            )
            conn.commit()
            updated = conn.execute(
                "SELECT id, full_name, registered_at FROM users WHERE id = ?",
                (args["id"],),
            ).fetchone()
            return _user_row(updated)

        if name == "delete_user":
            row = conn.execute(
                "SELECT id FROM users WHERE id = ?",
                (args["id"],),
            ).fetchone()
            if not row:
                return {"error": "not_found"}
            conn.execute("DELETE FROM users WHERE id = ?", (args["id"],))
            conn.commit()
            return {"deleted": True, "id": args["id"]}

        return {"error": f"unknown_tool:{name}"}
    finally:
        conn.close()


def _extract_json(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:].strip()
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end < 0:
        raise ValueError("No JSON object in model response")
    return json.loads(text[start : end + 1])


def require_api_key() -> str:
    key = os.getenv("OPENAI_API_KEY", "").strip()
    if not key:
        raise RuntimeError(
            "OPENAI_API_KEY не задан. Создай server/.env "
            "(см. .env.example) или экспортируй переменную в shell."
        )
    return key


def run_chat(session_id: str, message: str) -> dict[str, Any]:
    api_key = require_api_key()
    model = os.getenv("OPENAI_MODEL", "deepseek-chat")
    base_url = os.getenv("OPENAI_BASE_URL", "https://api.deepseek.com").strip()
    client = OpenAI(api_key=api_key, base_url=base_url or None)

    session = SESSIONS.setdefault(session_id, {})
    pending = session.get("pendingConfirm")

    system = load_skill_prompt()
    user_payload = {
        "message": message,
        "session": {"pendingConfirm": pending},
    }

    messages: list[dict[str, Any]] = [
        {"role": "system", "content": system},
        {
            "role": "user",
            "content": json.dumps(user_payload, ensure_ascii=False),
        },
    ]

    for _ in range(8):
        resp = client.chat.completions.create(
            model=model,
            messages=messages,
            tools=TOOL_DEFS,
            tool_choice="auto",
            temperature=0.2,
        )
        msg = resp.choices[0].message
        tool_calls = msg.tool_calls or []

        if tool_calls:
            messages.append(
                {
                    "role": "assistant",
                    "content": msg.content or "",
                    "tool_calls": [
                        {
                            "id": tc.id,
                            "type": "function",
                            "function": {
                                "name": tc.function.name,
                                "arguments": tc.function.arguments or "{}",
                            },
                        }
                        for tc in tool_calls
                    ],
                }
            )
            for tc in tool_calls:
                args = json.loads(tc.function.arguments or "{}")
                result = run_tool(tc.function.name, args)
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": json.dumps(result, ensure_ascii=False),
                    }
                )
            continue

        content = msg.content or ""
        messages.append({"role": "assistant", "content": content})
        # Force JSON packaging if needed
        if "{" not in content:
            messages.append(
                {
                    "role": "user",
                    "content": (
                        "Верни только JSON ответа {message, view, pendingConfirm} "
                        "по скиллу. Без пояснений."
                    ),
                }
            )
            resp2 = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0,
            )
            content = resp2.choices[0].message.content or ""

        data = _extract_json(content)
        if "view" not in data:
            raise ValueError("Response JSON missing view")
        session["pendingConfirm"] = data.get("pendingConfirm")
        return {
            "message": data.get("message") or "",
            "view": data["view"],
            "pendingConfirm": session.get("pendingConfirm"),
        }

    raise RuntimeError("Agent tool loop exceeded")
