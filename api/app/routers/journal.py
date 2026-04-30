"""
生産者日誌 CRUD ルーター。

エンドポイント一覧:
  POST   /journal                              — 記録作成
  GET    /journal                              — 記録一覧（workspace 必須）
  GET    /journal/export/csv                   — CSV エクスポート
  GET    /journal/photos/{workspace}/{record_id}/{filename} — 写真配信
  GET    /journal/{id}                         — 記録取得
  PUT    /journal/{id}                         — 記録更新
  DELETE /journal/{id}                         — 記録削除（写真ファイルも削除）
  POST   /journal/{id}/photos                  — 写真アップロード
  DELETE /journal/{id}/photos/{filename}       — 写真削除

注意: FastAPI はパスパラメータのマッチを宣言順に行うため、
      固定パス（export/csv、photos/...）は {id} より先に定義すること。
"""
import csv
import io
import json
import os
import shutil
from datetime import date
from pathlib import Path
from typing import List, Optional

import aiofiles
from fastapi import APIRouter, HTTPException, Query, UploadFile, File
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from app.services.db import get_pool

router = APIRouter()

PHOTOS_DIR = Path(os.environ.get("PHOTOS_DIR", "/data/photos"))


# ---------------------------------------------------------------------------
# Pydantic スキーマ
# ---------------------------------------------------------------------------

class LocationSchema(BaseModel):
    lat: float
    lng: float


class RecordCreateRequest(BaseModel):
    workspace: str
    record_date: date
    text_content: Optional[str] = None
    location: Optional[LocationSchema] = None
    created_by: str


class RecordUpdateRequest(BaseModel):
    record_date: Optional[date] = None
    text_content: Optional[str] = None
    # None を明示的に送ることで位置情報を削除できる。
    # フィールド自体が欠如している場合は更新しない。
    location: Optional[LocationSchema | None] = ...  # type: ignore[assignment]

    class Config:
        # location フィールドを「送られなかった」と「null で送られた」で区別する
        # ために model_fields_set を利用する。
        pass


# ---------------------------------------------------------------------------
# ヘルパー
# ---------------------------------------------------------------------------

def _format_record(row) -> dict:
    """asyncpg Record を JSON シリアライズ可能な dict に変換する。"""
    photos = row["photos"]
    if isinstance(photos, str):
        photos = json.loads(photos)

    location = None
    if row["lat"] is not None and row["lng"] is not None:
        location = {"lat": row["lat"], "lng": row["lng"]}

    return {
        "id": str(row["id"]),
        "workspace": row["workspace"],
        "record_date": row["record_date"].isoformat(),
        "text_content": row["text_content"],
        "photos": photos,
        "location": location,
        "created_by": row["created_by"],
        "created_at": row["created_at"].isoformat(),
        "updated_at": row["updated_at"].isoformat(),
    }


_SELECT_COLS = """
    id,
    workspace,
    record_date,
    text_content,
    photos,
    CASE WHEN location IS NOT NULL THEN ST_Y(location) END AS lat,
    CASE WHEN location IS NOT NULL THEN ST_X(location) END AS lng,
    created_by,
    created_at,
    updated_at
"""


# ---------------------------------------------------------------------------
# エンドポイント（固定パスを {id} より先に定義）
# ---------------------------------------------------------------------------

@router.get("/export/csv")
async def export_csv(
    workspace: str = Query(..., description="ワークスペース名"),
    from_date: Optional[str] = Query(None, description="開始日 YYYY-MM-DD"),
    to_date: Optional[str] = Query(None, description="終了日 YYYY-MM-DD"),
):
    """
    記録を CSV 形式でエクスポートする。
    UTF-8 BOM 付き（Excel で直接開いても文字化けしない）。
    """
    pool = get_pool()

    conditions = ["workspace = $1"]
    params: list = [workspace]

    if from_date:
        try:
            params.append(date.fromisoformat(from_date))
        except ValueError:
            raise HTTPException(status_code=400, detail="from_date は YYYY-MM-DD 形式で指定してください")
        conditions.append(f"record_date >= ${len(params)}")
    if to_date:
        try:
            params.append(date.fromisoformat(to_date))
        except ValueError:
            raise HTTPException(status_code=400, detail="to_date は YYYY-MM-DD 形式で指定してください")
        conditions.append(f"record_date <= ${len(params)}")

    where = " AND ".join(conditions)
    query = f"""
        SELECT {_SELECT_COLS}
        FROM production_records
        WHERE {where}
        ORDER BY record_date DESC, created_at DESC
    """

    async with pool.acquire() as conn:
        rows = await conn.fetch(query, *params)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["記録日", "ワークスペース", "作業内容", "緯度", "経度", "登録者", "登録日時", "写真枚数"])

    for row in rows:
        photos = row["photos"]
        if isinstance(photos, str):
            photos = json.loads(photos)

        lat = row["lat"]
        lng = row["lng"]

        writer.writerow([
            row["record_date"].isoformat(),
            row["workspace"],
            row["text_content"] or "",
            lat if lat is not None else "",
            lng if lng is not None else "",
            row["created_by"],
            row["created_at"].isoformat(),
            len(photos),
        ])

    csv_bytes = "\ufeff" + output.getvalue()  # UTF-8 BOM

    return StreamingResponse(
        iter([csv_bytes]),
        media_type="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": f"attachment; filename=records_{workspace}.csv"},
    )


@router.get("/photos/{workspace}/{record_id}/{filename}")
async def serve_photo(workspace: str, record_id: str, filename: str):
    """写真ファイルを返す。"""
    safe_filename = Path(filename).name
    file_path = PHOTOS_DIR / workspace / record_id / safe_filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="写真が見つかりません")

    return FileResponse(str(file_path))


# ---------------------------------------------------------------------------
# 基本 CRUD
# ---------------------------------------------------------------------------

@router.post("")
async def create_record(body: RecordCreateRequest):
    """記録を新規作成する。"""
    pool = get_pool()

    if body.location:
        geom_sql = f"ST_GeomFromText('POINT({body.location.lng} {body.location.lat})', 4326)"
        query = f"""
            INSERT INTO production_records
                (workspace, record_date, text_content, photos, location, created_by)
            VALUES ($1, $2, $3, '[]'::jsonb, {geom_sql}, $4)
            RETURNING {_SELECT_COLS}
        """
        params = [body.workspace, body.record_date, body.text_content, body.created_by]
    else:
        query = f"""
            INSERT INTO production_records
                (workspace, record_date, text_content, photos, location, created_by)
            VALUES ($1, $2, $3, '[]'::jsonb, NULL, $4)
            RETURNING {_SELECT_COLS}
        """
        params = [body.workspace, body.record_date, body.text_content, body.created_by]

    async with pool.acquire() as conn:
        row = await conn.fetchrow(query, *params)

    return _format_record(row)


@router.get("")
async def list_records(
    workspace: str = Query(..., description="ワークスペース名"),
    from_date: Optional[str] = Query(None, description="開始日 YYYY-MM-DD"),
    to_date: Optional[str] = Query(None, description="終了日 YYYY-MM-DD"),
):
    """記録一覧を返す。"""
    pool = get_pool()

    conditions = ["workspace = $1"]
    params: list = [workspace]

    if from_date:
        try:
            params.append(date.fromisoformat(from_date))
        except ValueError:
            raise HTTPException(status_code=400, detail="from_date は YYYY-MM-DD 形式で指定してください")
        conditions.append(f"record_date >= ${len(params)}")
    if to_date:
        try:
            params.append(date.fromisoformat(to_date))
        except ValueError:
            raise HTTPException(status_code=400, detail="to_date は YYYY-MM-DD 形式で指定してください")
        conditions.append(f"record_date <= ${len(params)}")

    where = " AND ".join(conditions)
    query = f"""
        SELECT {_SELECT_COLS}
        FROM production_records
        WHERE {where}
        ORDER BY record_date DESC, created_at DESC
    """
    count_query = f"SELECT COUNT(*) FROM production_records WHERE {where}"

    async with pool.acquire() as conn:
        rows = await conn.fetch(query, *params)
        total = await conn.fetchval(count_query, *params)

    return {
        "records": [_format_record(r) for r in rows],
        "total": total,
    }


@router.get("/{record_id}")
async def get_record(record_id: str):
    """単一記録を取得する。"""
    pool = get_pool()
    query = f"SELECT {_SELECT_COLS} FROM production_records WHERE id = $1::uuid"

    async with pool.acquire() as conn:
        row = await conn.fetchrow(query, record_id)

    if row is None:
        raise HTTPException(status_code=404, detail="記録が見つかりません")

    return _format_record(row)


@router.put("/{record_id}")
async def update_record(record_id: str, body: RecordUpdateRequest):
    """記録を更新する。送信されたフィールドのみ更新する。"""
    pool = get_pool()

    # 現在の記録を取得（存在確認）
    check_query = "SELECT id, workspace FROM production_records WHERE id = $1::uuid"
    async with pool.acquire() as conn:
        existing = await conn.fetchrow(check_query, record_id)

    if existing is None:
        raise HTTPException(status_code=404, detail="記録が見つかりません")

    set_clauses: list[str] = ["updated_at = NOW()"]
    params: list = []

    if body.record_date is not None:
        params.append(body.record_date)
        set_clauses.append(f"record_date = ${len(params)}")

    if "text_content" in body.model_fields_set:
        params.append(body.text_content)
        set_clauses.append(f"text_content = ${len(params)}")

    if "location" in body.model_fields_set:
        if body.location is None:
            set_clauses.append("location = NULL")
        else:
            set_clauses.append(
                f"location = ST_GeomFromText('POINT({body.location.lng} {body.location.lat})', 4326)"
            )

    params.append(record_id)
    set_sql = ", ".join(set_clauses)
    query = f"""
        UPDATE production_records
        SET {set_sql}
        WHERE id = ${len(params)}::uuid
        RETURNING {_SELECT_COLS}
    """

    async with pool.acquire() as conn:
        row = await conn.fetchrow(query, *params)

    return _format_record(row)


@router.delete("/{record_id}")
async def delete_record(record_id: str):
    """記録を削除し、関連する写真ファイルもディスクから削除する。"""
    pool = get_pool()
    check_query = "SELECT id, workspace FROM production_records WHERE id = $1::uuid"

    async with pool.acquire() as conn:
        existing = await conn.fetchrow(check_query, record_id)

    if existing is None:
        raise HTTPException(status_code=404, detail="記録が見つかりません")

    workspace = existing["workspace"]

    async with pool.acquire() as conn:
        await conn.execute(
            "DELETE FROM production_records WHERE id = $1::uuid", record_id
        )

    # 写真ディレクトリを削除
    photo_dir = PHOTOS_DIR / workspace / record_id
    if photo_dir.exists():
        shutil.rmtree(str(photo_dir))

    return {"status": "deleted", "id": record_id}


# ---------------------------------------------------------------------------
# 写真管理
# ---------------------------------------------------------------------------

@router.post("/{record_id}/photos")
async def upload_photos(record_id: str, files: List[UploadFile] = File(...)):
    """写真をアップロードし、DB の photos JSONB を更新する。"""
    pool = get_pool()
    check_query = f"SELECT {_SELECT_COLS} FROM production_records WHERE id = $1::uuid"

    async with pool.acquire() as conn:
        row = await conn.fetchrow(check_query, record_id)

    if row is None:
        raise HTTPException(status_code=404, detail="記録が見つかりません")

    workspace = row["workspace"]
    current_photos = row["photos"]
    if isinstance(current_photos, str):
        current_photos = json.loads(current_photos)

    photo_dir = PHOTOS_DIR / workspace / record_id
    photo_dir.mkdir(parents=True, exist_ok=True)

    new_entries: list[dict] = []
    for upload in files:
        safe_name = Path(upload.filename).name
        dest = photo_dir / safe_name

        async with aiofiles.open(str(dest), "wb") as f:
            while chunk := await upload.read(1024 * 1024):  # 1MB chunks
                await f.write(chunk)

        new_entries.append({
            "filename": safe_name,
            "url": f"/journal/photos/{workspace}/{record_id}/{safe_name}",
        })

    updated_photos = current_photos + new_entries
    update_query = f"""
        UPDATE production_records
        SET photos = $1::jsonb, updated_at = NOW()
        WHERE id = $2::uuid
        RETURNING {_SELECT_COLS}
    """

    async with pool.acquire() as conn:
        updated_row = await conn.fetchrow(
            update_query, json.dumps(updated_photos), record_id
        )

    return _format_record(updated_row)


@router.delete("/{record_id}/photos/{filename}")
async def delete_photo(record_id: str, filename: str):
    """指定した写真をディスクおよび DB の JSONB から削除する。"""
    pool = get_pool()
    check_query = f"SELECT {_SELECT_COLS} FROM production_records WHERE id = $1::uuid"

    async with pool.acquire() as conn:
        row = await conn.fetchrow(check_query, record_id)

    if row is None:
        raise HTTPException(status_code=404, detail="記録が見つかりません")

    workspace = row["workspace"]
    safe_name = Path(filename).name

    current_photos = row["photos"]
    if isinstance(current_photos, str):
        current_photos = json.loads(current_photos)

    updated_photos = [p for p in current_photos if p.get("filename") != safe_name]

    # ファイル削除
    file_path = PHOTOS_DIR / workspace / record_id / safe_name
    if file_path.exists():
        file_path.unlink()

    update_query = f"""
        UPDATE production_records
        SET photos = $1::jsonb, updated_at = NOW()
        WHERE id = $2::uuid
        RETURNING {_SELECT_COLS}
    """

    async with pool.acquire() as conn:
        updated_row = await conn.fetchrow(
            update_query, json.dumps(updated_photos), record_id
        )

    return _format_record(updated_row)
