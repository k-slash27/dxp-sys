"""
asyncpg 接続プール管理。
アプリ起動時に init_db() を呼び出し、マイグレーションを冪等に実行する。
"""
import os
from pathlib import Path

import asyncpg

_pool: asyncpg.Pool | None = None

MIGRATIONS_DIR = Path(__file__).parent.parent.parent / "migrations"


async def init_db() -> None:
    """接続プールを初期化し、マイグレーションを実行する。"""
    global _pool
    database_url = os.environ.get(
        "DATABASE_URL", "postgresql://dxp:dxp@postgis:5432/dxp"
    )
    _pool = await asyncpg.create_pool(database_url, min_size=2, max_size=10)

    migration_file = MIGRATIONS_DIR / "001_production_records.sql"
    if migration_file.exists():
        sql = migration_file.read_text()
        async with _pool.acquire() as conn:
            await conn.execute(sql)


async def close_db() -> None:
    """接続プールを閉じる。"""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


def get_pool() -> asyncpg.Pool:
    """初期化済みプールを返す。init_db() 未呼び出しの場合は RuntimeError。"""
    if _pool is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")
    return _pool
