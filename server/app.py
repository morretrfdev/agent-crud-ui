"""CRUD REST API + chat agent (steps 2–3)."""

from __future__ import annotations

import json
import re
import sqlite3
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from starlette.responses import FileResponse

load_dotenv(Path(__file__).resolve().parent / ".env")

from agent import run_chat  # noqa: E402

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "data" / "app.db"
ENTITIES_DIR = ROOT / "entities"

ALLOWED_STATUSES = {"Одобрено", "Возвращено", "На рассмотрении", "Черновик"}
ENTITY_KEYS = {"organizations", "users"}

app = FastAPI(title="agent-crud-ui demo API", version="0.3.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def db() -> sqlite3.Connection:
    if not DB_PATH.exists():
        raise HTTPException(
            status_code=503,
            detail="DB missing. Run: python3 init_db.py",
        )
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def org_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {"id": row["id"], "name": row["name"], "status": row["status"]}


def user_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "fullName": row["full_name"],
        "registeredAt": row["registered_at"],
    }


class CreateOrg(BaseModel):
    name: str = Field(min_length=1)
    status: str = Field(min_length=1)


class UpdateOrg(BaseModel):
    name: str | None = None
    status: str | None = None


class CreateUser(BaseModel):
    fullName: str = Field(min_length=1)
    registeredAt: str = Field(min_length=1)


class UpdateUser(BaseModel):
    fullName: str | None = None
    registeredAt: str | None = None


def validate_status(status: str) -> None:
    if status not in ALLOWED_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Allowed: {sorted(ALLOWED_STATUSES)}",
        )


def validate_date(value: str) -> None:
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise HTTPException(
            status_code=400,
            detail="registeredAt must be YYYY-MM-DD",
        )


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/entities")
def list_entities() -> list[dict[str, str]]:
    return [
        {"key": "organizations", "title": "Организации"},
        {"key": "users", "title": "Пользователи"},
    ]


@app.get("/api/entities/{entity_key}/schema")
def entity_schema(entity_key: str) -> dict[str, Any]:
    if entity_key not in ENTITY_KEYS:
        raise HTTPException(status_code=404, detail="Unknown entity")
    path = ENTITIES_DIR / f"{entity_key}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Schema not found")
    return json.loads(path.read_text(encoding="utf-8"))


@app.get("/api/organizations")
def list_orgs(status: str | None = None) -> list[dict[str, Any]]:
    conn = db()
    try:
        if status:
            validate_status(status)
            rows = conn.execute(
                "SELECT id, name, status FROM organizations WHERE status = ? ORDER BY id",
                (status,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT id, name, status FROM organizations ORDER BY id"
            ).fetchall()
        return [org_to_dict(r) for r in rows]
    finally:
        conn.close()


@app.get("/api/organizations/{org_id}")
def get_org(org_id: int) -> dict[str, Any]:
    conn = db()
    try:
        row = conn.execute(
            "SELECT id, name, status FROM organizations WHERE id = ?",
            (org_id,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Not found")
        return org_to_dict(row)
    finally:
        conn.close()


@app.post("/api/organizations", status_code=201)
def create_org(body: CreateOrg) -> dict[str, Any]:
    validate_status(body.status)
    conn = db()
    try:
        cur = conn.execute(
            "INSERT INTO organizations (name, status) VALUES (?, ?)",
            (body.name.strip(), body.status),
        )
        conn.commit()
        org_id = cur.lastrowid
        row = conn.execute(
            "SELECT id, name, status FROM organizations WHERE id = ?",
            (org_id,),
        ).fetchone()
        return org_to_dict(row)
    finally:
        conn.close()


@app.patch("/api/organizations/{org_id}")
def update_org(org_id: int, body: UpdateOrg) -> dict[str, Any]:
    if body.name is None and body.status is None:
        raise HTTPException(status_code=400, detail="No fields to update")
    if body.status is not None:
        validate_status(body.status)

    conn = db()
    try:
        row = conn.execute(
            "SELECT id, name, status FROM organizations WHERE id = ?",
            (org_id,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Not found")

        name = body.name.strip() if body.name is not None else row["name"]
        status = body.status if body.status is not None else row["status"]
        if body.name is not None and not name:
            raise HTTPException(status_code=400, detail="name cannot be empty")

        conn.execute(
            "UPDATE organizations SET name = ?, status = ? WHERE id = ?",
            (name, status, org_id),
        )
        conn.commit()
        updated = conn.execute(
            "SELECT id, name, status FROM organizations WHERE id = ?",
            (org_id,),
        ).fetchone()
        return org_to_dict(updated)
    finally:
        conn.close()


@app.delete("/api/organizations/{org_id}")
def delete_org(org_id: int) -> dict[str, Any]:
    conn = db()
    try:
        row = conn.execute(
            "SELECT id, name, status FROM organizations WHERE id = ?",
            (org_id,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Not found")
        conn.execute("DELETE FROM organizations WHERE id = ?", (org_id,))
        conn.commit()
        return {"deleted": True, "id": org_id}
    finally:
        conn.close()


@app.get("/api/users")
def list_users() -> list[dict[str, Any]]:
    conn = db()
    try:
        rows = conn.execute(
            "SELECT id, full_name, registered_at FROM users ORDER BY id"
        ).fetchall()
        return [user_to_dict(r) for r in rows]
    finally:
        conn.close()


@app.get("/api/users/{user_id}")
def get_user(user_id: int) -> dict[str, Any]:
    conn = db()
    try:
        row = conn.execute(
            "SELECT id, full_name, registered_at FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Not found")
        return user_to_dict(row)
    finally:
        conn.close()


@app.post("/api/users", status_code=201)
def create_user(body: CreateUser) -> dict[str, Any]:
    validate_date(body.registeredAt)
    conn = db()
    try:
        cur = conn.execute(
            "INSERT INTO users (full_name, registered_at) VALUES (?, ?)",
            (body.fullName.strip(), body.registeredAt),
        )
        conn.commit()
        row = conn.execute(
            "SELECT id, full_name, registered_at FROM users WHERE id = ?",
            (cur.lastrowid,),
        ).fetchone()
        return user_to_dict(row)
    finally:
        conn.close()


@app.patch("/api/users/{user_id}")
def update_user(user_id: int, body: UpdateUser) -> dict[str, Any]:
    if body.fullName is None and body.registeredAt is None:
        raise HTTPException(status_code=400, detail="No fields to update")
    if body.registeredAt is not None:
        validate_date(body.registeredAt)

    conn = db()
    try:
        row = conn.execute(
            "SELECT id, full_name, registered_at FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Not found")

        full_name = (
            body.fullName.strip() if body.fullName is not None else row["full_name"]
        )
        registered_at = (
            body.registeredAt
            if body.registeredAt is not None
            else row["registered_at"]
        )
        if body.fullName is not None and not full_name:
            raise HTTPException(status_code=400, detail="fullName cannot be empty")

        conn.execute(
            "UPDATE users SET full_name = ?, registered_at = ? WHERE id = ?",
            (full_name, registered_at, user_id),
        )
        conn.commit()
        updated = conn.execute(
            "SELECT id, full_name, registered_at FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
        return user_to_dict(updated)
    finally:
        conn.close()


@app.delete("/api/users/{user_id}")
def delete_user(user_id: int) -> dict[str, Any]:
    conn = db()
    try:
        row = conn.execute(
            "SELECT id FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Not found")
        conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
        conn.commit()
        return {"deleted": True, "id": user_id}
    finally:
        conn.close()


class ChatRequest(BaseModel):
    sessionId: str = Field(min_length=1)
    message: str = Field(min_length=1)


@app.post("/api/chat")
def chat(body: ChatRequest) -> dict[str, Any]:
    try:
        return run_chat(body.sessionId, body.message.strip())
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


DEMO_DIR = ROOT.parent / "demo"


@app.get("/")
def demo_index() -> FileResponse:
    return FileResponse(DEMO_DIR / "index.html")


app.mount("/", StaticFiles(directory=str(DEMO_DIR), html=False), name="demo")
