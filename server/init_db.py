#!/usr/bin/env python3
"""Init SQLite DB + seed organizations (step 1)."""

from __future__ import annotations

import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "data" / "app.db"

SEED = [
    ("Гимназия №7 Санкт-Петербурга", "Одобрено"),
    ("ИП Кравцова Юлия Романовна", "Возвращено"),
    ("ООО «Канцтовары Плюс»", "На рассмотрении"),
    ("АО «Северная логистика»", "Черновик"),
    ("ООО «Дом и сад»", "Одобрено"),
    ("Гимназия №77 Санкт-Петербург", "Одобрено"),
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
        count = conn.execute("SELECT COUNT(*) FROM organizations").fetchone()[0]
        if count == 0:
            conn.executemany(
                "INSERT INTO organizations (name, status) VALUES (?, ?)",
                SEED,
            )
            conn.commit()
            print(f"Created {DB_PATH} and seeded {len(SEED)} rows.")
        else:
            print(f"{DB_PATH} already has {count} rows — seed skipped.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
