from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import webhook

app = FastAPI(
    title="DXP Register Service",
    description="GeoServer ImageMosaic granule 登録・管理サービス（Lambda 2本 → FastAPI 1本に統合）",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(webhook.router, prefix="/webhook", tags=["webhook"])


@app.get("/health")
async def health():
    return {"status": "ok"}
