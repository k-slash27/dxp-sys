from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import webhook, journal
from app.services.db import init_db, close_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    await close_db()


app = FastAPI(
    title="DXP Register Service",
    description="GeoServer ImageMosaic granule 登録・管理サービス（Lambda 2本 → FastAPI 1本に統合）",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(webhook.router, prefix="/webhook", tags=["webhook"])
app.include_router(journal.router, prefix="/journal", tags=["journal"])


@app.get("/health")
async def health():
    return {"status": "ok"}
