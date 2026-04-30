"""
Webhook エンドポイント
operator がアップロード完了後に呼び出す。Lambda 2本 (s3-trigger + geoserver-register) を 1本に統合。
"""
import asyncio
import json
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import AsyncGenerator

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from app.services import geoserver as gs
from app.services.cog import convert_to_cog

router = APIRouter()

DATA_DIR = os.environ.get("DATA_DIR", "/data/ortho")

# タスクの進捗をメモリで管理（単一ノード運用前提）
_tasks: dict[str, dict] = {}

# SSE 最大待機時間（秒）: COG変換は2.5GBで最大15分程度かかるため余裕を持たせる
_SSE_TIMEOUT_SECONDS = 1800  # 30分


# ---------- スキーマ ----------

class UploadWebhookRequest(BaseModel):
    workspace: str
    filename: str       # ortho_20240601.tif 形式
    date: str           # YYYY-MM-DD


class DeleteGranuleRequest(BaseModel):
    workspace: str
    granule_id: str


class UpdateGranuleRequest(BaseModel):
    workspace: str
    granule_id: str
    new_filename: str   # 変更後のファイル名


# ---------- ヘルパー ----------

def _ortho_path(workspace: str, filename: str) -> str:
    return str(Path(DATA_DIR) / workspace / filename)


def _task_update(task_id: str, status: str, message: str, result: dict | None = None) -> None:
    _tasks[task_id] = {
        "task_id": task_id,
        "status": status,
        "message": message,
        "result": result,
        "updated_at": datetime.utcnow().isoformat(),
    }


async def _process_cog_and_register(task_id: str, workspace: str, file_path: str) -> None:
    """
    COG変換 → GeoServer登録 をバックグラウンドで実行する。
    進捗は _tasks[task_id] 経由で SSE に反映される。

    仕様書§3.4: アップロード後に gdal_translate -of COG で変換してから登録する。
    変換に数分かかるため、ファイル保存完了後にバックグラウンドタスクとして実行し
    operator には task_id を即時返却する。
    """
    try:
        # Step 1: COG変換
        _task_update(task_id, "converting", "COG変換中... (数分かかります)")
        cog_path = await convert_to_cog(file_path)

        # Step 2: GeoServer登録
        _task_update(task_id, "processing", "GeoServer に登録中...")
        result = await gs.add_granule(workspace, cog_path)

        _task_update(task_id, "completed", "登録完了", result)

    except Exception as e:
        _task_update(task_id, "failed", str(e))


# ---------- エンドポイント ----------

@router.post("/upload")
async def webhook_upload(request: UploadWebhookRequest):
    """
    アップロード完了通知を受けて COG変換 → GeoServer ImageMosaic granule 登録を行う。
    ファイルは operator が /data/ortho/{workspace}/{filename} に保存済みであること。
    COG変換をバックグラウンドで実行し、task_id を即時返却する。
    """
    task_id = str(uuid.uuid4())
    file_path = _ortho_path(request.workspace, request.filename)

    if not Path(file_path).exists():
        raise HTTPException(
            status_code=404,
            detail=f"ファイルが見つかりません: {file_path}",
        )

    _task_update(task_id, "converting", "COG変換中... (数分かかります)")
    asyncio.create_task(_process_cog_and_register(task_id, request.workspace, file_path))

    return {"task_id": task_id, "status": "processing"}


@router.post("/upload-file")
async def webhook_upload_file(
    file: UploadFile = File(...),
    workspace: str = Form(...),
    date: str = Form(...),
):
    """
    マルチパートでファイルを受け取り、保存後に COG変換 → granule 登録する。
    operator の /api/upload から直接呼ばれる。
    ファイル保存完了後すぐに task_id を返却し、変換・登録はバックグラウンドで実行する。
    """
    if not (file.filename or "").lower().endswith((".tif", ".tiff")):
        raise HTTPException(status_code=400, detail="GeoTiff (.tif, .tiff) のみ対応")

    date_str = date.replace("-", "")
    filename = f"ortho_{date_str}.tif"
    dest_dir = Path(DATA_DIR) / workspace
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / filename

    task_id = str(uuid.uuid4())
    _task_update(task_id, "uploading", "ファイル保存中...")

    # ストリーミング書き込み（大容量TIFでもメモリに全展開しない）
    CHUNK_SIZE = 1024 * 1024  # 1MB
    with open(dest_path, "wb") as f:
        while chunk := await file.read(CHUNK_SIZE):
            f.write(chunk)

    # COG変換 + GeoServer登録をバックグラウンドで実行（数分かかるため即時返却）
    _task_update(task_id, "converting", "COG変換中... (数分かかります)")
    asyncio.create_task(_process_cog_and_register(task_id, workspace, str(dest_path)))

    return {"task_id": task_id, "status": "processing", "filename": filename}


@router.delete("/granule")
async def delete_granule(request: DeleteGranuleRequest):
    """指定 granule を GeoServer から削除し、ファイルも削除する"""
    try:
        granules = await gs.list_granules(request.workspace)
        target = next((g for g in granules if g["id"] == request.granule_id), None)

        await gs.delete_granule(request.workspace, request.granule_id)

        # 対応するファイルも削除
        if target:
            file_path = Path(target["location"].replace("file://", ""))
            if file_path.exists():
                file_path.unlink()

        return {"status": "deleted", "granule_id": request.granule_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/granule")
async def update_granule(request: UpdateGranuleRequest):
    """granule の日付を変更する（既存ファイルをリネーム → 削除 → 再登録）"""
    try:
        # 現在の granule 情報からファイルパスを取得
        granules = await gs.list_granules(request.workspace)
        target = next((g for g in granules if g["id"] == request.granule_id), None)
        if not target:
            raise HTTPException(status_code=404, detail=f"granule が見つかりません: {request.granule_id}")

        old_path = Path(target["location"].replace("file://", ""))
        new_path = Path(_ortho_path(request.workspace, request.new_filename))

        if not old_path.exists():
            raise HTTPException(status_code=404, detail=f"元ファイルが見つかりません: {old_path}")

        # 新旧ファイル名が異なる場合はリネーム
        if old_path != new_path:
            old_path.rename(new_path)

        result = await gs.update_granule_date(
            request.workspace, request.granule_id, str(new_path)
        )
        return {"status": "updated", "result": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/granules/{workspace}")
async def list_granules(workspace: str):
    """指定ワークスペースの登録済み granule 一覧を返す"""
    try:
        granules = await gs.list_granules(workspace)
        return {"workspace": workspace, "granules": granules}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/areas")
async def list_areas():
    """
    GeoServer のワークスペース一覧を撮影エリアとして返す。
    operator の /api/areas の代替エンドポイント。
    """
    try:
        workspaces = await gs.get_workspace_list()
        areas = []
        settings_results = await asyncio.gather(
            *[gs.get_workspace_settings(ws) for ws in workspaces],
            return_exceptions=True,
        )
        for i, ws in enumerate(workspaces):
            settings = settings_results[i] if not isinstance(settings_results[i], Exception) else {}
            contact = (settings or {}).get("contact", {})
            areas.append({
                "id": ws,
                "label": ws,
                "workspace": ws,
                "storagePath": f"/data/ortho/{ws}",
                "contact": {
                    "contactOrganization": contact.get("contactOrganization") if contact else None,
                },
            })
        return areas
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/progress/{task_id}")
async def progress_sse(task_id: str):
    """
    Server-Sent Events でタスク進捗を配信する。
    COG変換（最大15分）を考慮し、最大30分待機する。
    """

    async def event_generator() -> AsyncGenerator[str, None]:
        for _ in range(_SSE_TIMEOUT_SECONDS):
            task = _tasks.get(task_id)
            if task:
                yield f"data: {json.dumps(task)}\n\n"
                if task["status"] in ("completed", "failed"):
                    break
            else:
                yield f"data: {json.dumps({'task_id': task_id, 'status': 'pending'})}\n\n"
            await asyncio.sleep(1)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
