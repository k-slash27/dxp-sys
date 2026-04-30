"""COG（Cloud Optimized GeoTIFF）変換サービス"""
import asyncio
import subprocess
from pathlib import Path


async def convert_to_cog(input_path: str) -> str:
    """
    TIF を Cloud Optimized GeoTIFF（COG）に変換する。

    変換後のファイルは元のパス（input_path）に上書きされる。
    変換中は一時ファイル（.cog.tmp.tif）に書き込み、
    完了後にアトミックにリネームするため中断しても元ファイルが残る。

    仕様書§3.4:
      Cog=true / CogRangeReader は indexer.properties で設定済み。
      COGフォーマットにより GeoServer が適切なズームレベルの
      オーバービューを参照し、時系列タイルレンダリングを高速化する。

    仕様書§3.5:
      1エリアあたり月4回撮影・年間120GB超の granule 蓄積を前提とするため
      初回から COG 変換を適用し、スケールアップ時のパフォーマンス劣化を防ぐ。

    Args:
        input_path: 変換対象の TIF ファイルパス

    Returns:
        変換後のファイルパス（input_path と同じ）

    Raises:
        RuntimeError: gdal_translate が失敗した場合
        FileNotFoundError: 入力ファイルが存在しない場合
    """
    input_p = Path(input_path)
    if not input_p.exists():
        raise FileNotFoundError(f"入力ファイルが存在しません: {input_path}")

    tmp_path = input_p.with_suffix(".cog.tmp.tif")

    cmd = [
        "gdal_translate",
        "-of", "COG",
        "-co", "TILED=YES",
        "-co", "BLOCKSIZE=512",        # 512×512px タイル（Web地図に最適）
        "-co", "COMPRESS=DEFLATE",     # 可逆圧縮（品質劣化なし、約30-50%削減）
        "-co", "OVERVIEW_RESAMPLING=NEAREST",  # 空撮画像は最近傍補間（色変化なし）
        "-co", "NUM_THREADS=ALL_CPUS", # マルチスレッド変換
        str(input_p),
        str(tmp_path),
    ]

    loop = asyncio.get_event_loop()
    try:
        result = await loop.run_in_executor(
            None,
            lambda: subprocess.run(cmd, capture_output=True, text=True),
        )
    except Exception as e:
        tmp_path.unlink(missing_ok=True)
        raise RuntimeError(f"gdal_translate 実行エラー: {e}") from e

    if result.returncode != 0:
        tmp_path.unlink(missing_ok=True)
        raise RuntimeError(
            f"COG変換失敗 (returncode={result.returncode}): {result.stderr.strip()}"
        )

    # アトミックに元ファイルを上書き
    tmp_path.replace(input_p)
    return str(input_p)
