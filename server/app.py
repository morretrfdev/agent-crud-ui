"""CRUD REST API + chat agent (steps 2–3)."""

from __future__ import annotations

import json
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
SCHEMA_PATH = ROOT / "entities" / "organizations.json"

ALLOWED_STATUSES = {"Одобрено", "Возвращено", "На рассмотрении", "Черновик"}

app = FastAPI(title="agent-crud-ui demo API", version="0.2.0")
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


def row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {"id": row["id"], "name": row["name"], "status": row["status"]}


class CreateOrg(BaseModel):
    name: str = Field(min_length=1)
    status: str = Field(min_length=1)


class UpdateOrg(BaseModel):
    name: str | None = None
    status: str | None = None


def validate_status(status: str) -> None:
    if status not in ALLOWED_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Allowed: {sorted(ALLOWED_STATUSES)}",
        )


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/entities/organizations/schema")
def org_schema() -> dict[str, Any]:
    if not SCHEMA_PATH.exists():
        raise HTTPException(status_code=404, detail="Schema not found")
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


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
        return [row_to_dict(r) for r in rows]
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
        return row_to_dict(row)
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
        return row_to_dict(row)
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
        return row_to_dict(updated)
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
