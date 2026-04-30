"""GeoServer REST API クライアント"""
import io
import os
import shutil
import zipfile
from pathlib import Path
from typing import Optional

import httpx

GEOSERVER_URL = os.environ["GEOSERVER_URL"].rstrip("/")
GEOSERVER_USER = os.environ["GEOSERVER_USER"]
GEOSERVER_PASSWORD = os.environ["GEOSERVER_PASSWORD"]
DATA_DIR = os.environ.get("DATA_DIR", "/data/ortho")
GEOSERVER_DATA_DIR = os.environ.get("GEOSERVER_DATA_DIR", "/opt/geoserver/data_dir")

TEMPLATES_DIR = Path(__file__).parent.parent.parent / "templates"


def _auth() -> tuple[str, str]:
    return (GEOSERVER_USER, GEOSERVER_PASSWORD)


def _store_name(workspace: str) -> str:
    return f"ortho-{workspace}"


def _store_data_dir(workspace: str) -> Path:
    return Path(DATA_DIR) / workspace


def _prepare_mosaic_dir(workspace: str) -> Path:
    """
    ImageMosaic ストアが参照するディレクトリを準備する。
    timeregex.properties と indexer.properties をテンプレートからコピーする。
    """
    mosaic_dir = _store_data_dir(workspace)
    mosaic_dir.mkdir(parents=True, exist_ok=True)
    for fname in ("timeregex.properties", "indexer.properties"):
        dest = mosaic_dir / fname
        if not dest.exists():
            src = TEMPLATES_DIR / fname
            if src.exists():
                shutil.copy(src, dest)
    return mosaic_dir


def _ensure_symlink(workspace: str) -> None:
    """
    GeoServer data_dir 内のモザイクディレクトリを /data/ortho/{workspace}/ への
    シンリンクに置き換える。

    ZIP PUT でストアを初期化すると GeoServer は data_dir/data/{ws}/{store}/ に
    インデックス（.shp等）を作成する。事前にシンリンクを張っておくことで、
    インデックスが /data/ortho/{workspace}/ に作られ、TIF と同じ場所に揃う。

    これにより 2回目以降の external.imagemosaic POST が正しく動作する。
    （external.imagemosaic は「ストアが参照するディレクトリにインデックスがある」前提）
    """
    store_name = _store_name(workspace)
    mosaic_dir = _store_data_dir(workspace)
    symlink_path = Path(GEOSERVER_DATA_DIR) / "data" / workspace / store_name

    symlink_path.parent.mkdir(parents=True, exist_ok=True)

    # 既存ディレクトリまたはシンリンクを削除
    if symlink_path.exists() or symlink_path.is_symlink():
        if symlink_path.is_symlink() or symlink_path.is_file():
            symlink_path.unlink()
        else:
            shutil.rmtree(symlink_path)

    symlink_path.symlink_to(mosaic_dir)

    # GeoServer（geoserveruser）が書き込めるよう権限付与
    os.chmod(mosaic_dir, 0o777)


async def ensure_workspace(workspace: str) -> None:
    """ワークスペースが存在しなければ作成する"""
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{GEOSERVER_URL}/rest/workspaces",
            auth=_auth(),
            headers={"Accept": "application/json", "Content-Type": "application/json"},
            json={"workspace": {"name": workspace}},
        )
        if r.status_code not in (201, 409):
            if r.status_code == 500 and "already exists" in r.text:
                return
            raise RuntimeError(f"ワークスペース作成失敗: {r.status_code} {r.text}")


async def _store_exists(workspace: str) -> bool:
    """ストアが存在するか確認する"""
    store_name = _store_name(workspace)
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(
            f"{GEOSERVER_URL}/rest/workspaces/{workspace}/coveragestores/{store_name}.json",
            auth=_auth(),
            headers={"Accept": "application/json"},
        )
        return r.status_code == 200


def _build_init_zip() -> bytes:
    """
    新規ストア初期化用 ZIP を作成する。
    TIF は含めず timeregex.properties + indexer.properties のみ。
    Schema= フィールドにより GeoServer がインデックス構造を作成できる。
    TIF 本体は初期化後に external.imagemosaic POST で追加する。
    """
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for fname in ("timeregex.properties", "indexer.properties"):
            src = TEMPLATES_DIR / fname
            if src.exists():
                zf.write(src, arcname=fname)
    return buf.getvalue()


async def _delete_store(workspace: str) -> None:
    """ストアをカバレッジごと削除する（?recurse=true）"""
    store_name = _store_name(workspace)
    async with httpx.AsyncClient(timeout=30.0) as client:
        await client.delete(
            f"{GEOSERVER_URL}/rest/workspaces/{workspace}/coveragestores/{store_name}?recurse=true",
            auth=_auth(),
        )


def _index_exists(workspace: str) -> bool:
    """ImageMosaic シェープファイルインデックスが存在するか確認する"""
    store_name = _store_name(workspace)
    shp = _store_data_dir(workspace) / f"{store_name}.shp"
    return shp.exists()


async def _init_store_from_zip(workspace: str, file_path: str) -> None:
    """
    初回ストア初期化。

    1. シンリンクを作成（data_dir/data/{ws}/{store}/ → /data/ortho/{ws}/）
    2. properties のみの小さな ZIP で file.imagemosaic PUT → ストア・スキーマを作成
       （TIF を含めないため大容量ファイルでもメモリ圧迫しない）
    3. TIME 次元を有効化
    4. external.imagemosaic POST で最初の granule を追加
    """
    store_name = _store_name(workspace)
    zip_bytes = _build_init_zip()

    _ensure_symlink(workspace)

    async with httpx.AsyncClient(timeout=120.0) as client:
        r = await client.put(
            f"{GEOSERVER_URL}/rest/workspaces/{workspace}/coveragestores/{store_name}/file.imagemosaic",
            auth=_auth(),
            headers={"Content-Type": "application/zip"},
            content=zip_bytes,
        )
        if r.status_code not in (200, 201, 202):
            raise RuntimeError(f"ストア初期化失敗: {r.status_code} {r.text}")

    # ZIP PUT 時点でファイルが既に存在する場合（COG変換済み）、GeoServer がディレクトリを
    # スキャンして自動登録することがある。その場合 external.imagemosaic POST は不要。
    existing = await list_granules(workspace)
    if len(existing) == 0:
        async with httpx.AsyncClient(timeout=180.0) as client:
            r = await client.post(
                f"{GEOSERVER_URL}/rest/workspaces/{workspace}/coveragestores/{store_name}"
                f"/external.imagemosaic",
                auth=_auth(),
                headers={"Content-Type": "text/plain"},
                content=file_path,
            )
            if r.status_code not in (200, 201, 202):
                raise RuntimeError(f"初回 granule 追加失敗: {r.status_code} {r.text}")

    # granule 追加後に TIME 次元・透過色を設定（先に設定すると granule 追加で上書きされる）
    await _enable_time_dimension(workspace)


async def _enable_time_dimension(workspace: str) -> None:
    """
    カバレッジの TIME 次元を有効化し、黒背景透過を設定する。
    最初の granule 追加後に呼ぶこと（先に呼ぶと granule 追加時に設定が上書きされる）。

    InputTransparentColor=#000000 → ドローン空撮で発生する黒 nodata 領域を透過にする。

    parameters の JSON 形式: {"string": ["key", "value"]} 形式が GeoServer の正しい形式。
    "@key"/"$" 形式は metadata 用で parameters には使えない（XStream MapConverter エラーになる）。
    """
    store_name = _store_name(workspace)
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.put(
            f"{GEOSERVER_URL}/rest/workspaces/{workspace}/coveragestores/{store_name}"
            f"/coverages/{store_name}.json",
            auth=_auth(),
            headers={"Content-Type": "application/json"},
            json={
                "coverage": {
                    "metadata": {
                        "entry": [
                            {"@key": "dirName", "$": f"{store_name}_null"},
                            {
                                "@key": "time",
                                "dimensionInfo": {
                                    "enabled": True,
                                    "presentation": "LIST",
                                    "units": "ISO8601",
                                    "defaultValue": {"strategy": "MAXIMUM"},
                                },
                            },
                        ]
                    },
                    "parameters": {
                        "entry": [
                            # ドローン空撮の黒 nodata 領域を透過にする
                            # {"string": ["key", "value"]} が GeoServer parameters の正しい JSON 形式
                            {"string": ["InputTransparentColor", "#000000"]},
                        ]
                    },
                }
            },
        )
        if r.status_code != 200:
            raise RuntimeError(f"TIME次元有効化失敗: {r.status_code} {r.text}")


async def add_granule(workspace: str, file_path: str) -> dict:
    """
    ImageMosaic ストアに granule を追加する。

    初回（ストア未存在）:
      シンリンク作成 → properties のみ ZIP PUT でストア初期化 → TIME 次元有効化
      → external.imagemosaic POST で最初の granule を追加

    2回目以降（ストア既存）:
      external.imagemosaic POST で harvest（body はパスのみ、file:// なし）

    異常系（ストアはあるがインデックス .shp がない）:
      ストアを削除して初回と同じ手順で再初期化
    """
    store_name = _store_name(workspace)

    await ensure_workspace(workspace)
    _prepare_mosaic_dir(workspace)

    store_exists = await _store_exists(workspace)

    # ストアはあるがインデックス (.shp) がない → 再初期化が必要
    if store_exists and not _index_exists(workspace):
        await _delete_store(workspace)
        store_exists = False

    if not store_exists:
        await _init_store_from_zip(workspace, file_path)
    else:
        async with httpx.AsyncClient(timeout=180.0) as client:
            r = await client.post(
                f"{GEOSERVER_URL}/rest/workspaces/{workspace}/coveragestores/{store_name}"
                f"/external.imagemosaic",
                auth=_auth(),
                headers={"Content-Type": "text/plain"},
                content=file_path,  # file:// プレフィクスなし
            )
            if r.status_code not in (200, 201, 202):
                raise RuntimeError(f"granule 追加失敗: {r.status_code} {r.text}")

    return {"workspace": workspace, "store": store_name, "file": file_path}


async def list_granules(workspace: str) -> list[dict]:
    """登録済み granule の一覧を返す"""
    store_name = _store_name(workspace)

    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(
            f"{GEOSERVER_URL}/rest/workspaces/{workspace}/coveragestores/{store_name}"
            f"/coverages/{store_name}/index/granules.json",
            auth=_auth(),
            headers={"Accept": "application/json"},
        )
        if r.status_code == 404:
            return []
        if not r.is_success:
            raise RuntimeError(f"granule 一覧取得失敗: {r.status_code} {r.text}")

        data = r.json()
        features = data.get("features", [])
        return [
            {
                "id": f.get("id", ""),
                "location": f.get("properties", {}).get("location", ""),
                "ingestion": str(f.get("properties", {}).get("ingestion", "")),
            }
            for f in features
        ]


async def delete_granule(workspace: str, granule_id: str) -> None:
    """指定した granule を削除する"""
    store_name = _store_name(workspace)

    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.delete(
            f"{GEOSERVER_URL}/rest/workspaces/{workspace}/coveragestores/{store_name}"
            f"/coverages/{store_name}/index/granules/{granule_id}",
            auth=_auth(),
        )
        if r.status_code not in (200, 204):
            raise RuntimeError(f"granule 削除失敗: {r.status_code} {r.text}")


async def _reload_catalog() -> None:
    """GeoServer カタログをリロードしてメモリキャッシュを更新する。
    granule 削除→再追加後、旧エントリがキャッシュに残り WMS が古いパスを
    参照してしまう問題を防ぐ。"""
    async with httpx.AsyncClient(timeout=15.0) as client:
        await client.post(
            f"{GEOSERVER_URL}/rest/reload",
            auth=_auth(),
        )


async def update_granule_date(
    workspace: str, granule_id: str, new_file_path: str
) -> dict:
    """granule の日付を変更する（削除→再追加→カタログリロード）"""
    await delete_granule(workspace, granule_id)
    result = await add_granule(workspace, new_file_path)
    # 削除→再追加後に GeoServer のメモリキャッシュを更新
    await _reload_catalog()
    return result


async def get_workspace_list() -> list[str]:
    """GeoServer の全ワークスペース名を返す"""
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(
            f"{GEOSERVER_URL}/rest/workspaces.json",
            auth=_auth(),
            headers={"Accept": "application/json"},
        )
        if not r.is_success:
            raise RuntimeError(f"ワークスペース一覧取得失敗: {r.status_code}")
        data = r.json()
        entries = data.get("workspaces", {}).get("workspace", [])
        return [w["name"] for w in entries]


async def get_workspace_settings(workspace: str) -> Optional[dict]:
    """ワークスペースの設定（連絡先情報など）を返す"""
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(
            f"{GEOSERVER_URL}/rest/workspaces/{workspace}/settings.json",
            auth=_auth(),
            headers={"Accept": "application/json"},
        )
        if r.status_code == 404:
            return None
        if not r.is_success:
            return None
        return r.json().get("settings", {})
