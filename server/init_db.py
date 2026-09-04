#!/usr/bin/env python3
"""Init SQLite DB + seed organizations and users."""

from __future__ import annotations

import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "data" / "app.db"

ORG_SEED = [
    ("Гимназия №7 Санкт-Петербурга", "Одобрено"),
    ("ИП Кравцова Юлия Романовна", "Возвращено"),
    ("ООО «Канцтовары Плюс»", "На рассмотрении"),
    ("АО «Северная логистика»", "Черновик"),
    ("ООО «Дом и сад»", "Одобрено"),
    ("Гимназия №77 Санкт-Петербург", "Одобрено"),
]

USER_SEED = [
    ("Иванов Иван Иванович", "2024-01-15"),
    ("Петрова Анна Сергеевна", "2024-03-02"),
    ("Сидоров Пётр Алексеевич", "2024-06-18"),
    ("Козлова Мария Дмитриевна", "2025-01-09"),
]


def main() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS organizations (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              status TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              full_name TEXT NOT NULL,
              registered_at TEXT NOT NULL
            )
            """
        )

        org_count = conn.execute("SELECT COUNT(*) FROM organizations").fetchone()[0]
        if org_count == 0:
            conn.executemany(
                "INSERT INTO organizations (name, status) VALUES (?, ?)",
                ORG_SEED,
            )
            print(f"Seeded {len(ORG_SEED)} organizations.")
        else:
            print(f"organizations: {org_count} rows — seed skipped.")

        user_count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        if user_count == 0:
            conn.executemany(
                "INSERT INTO users (full_name, registered_at) VALUES (?, ?)",
                USER_SEED,
            )
            print(f"Seeded {len(USER_SEED)} users.")
        else:
            print(f"users: {user_count} rows — seed skipped.")

        conn.commit()
        print(f"DB ready: {DB_PATH}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
