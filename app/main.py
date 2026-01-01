from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import traceback
import os

from app.api.v1 import api_router
from app.database import Base, engine

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Band Scheduling Platform",
    description="API for coordinating band member schedules, venues, and shows",
    version="0.1.0",
)

# Add CORS middleware FIRST, before any other middleware or routes
# This must be added before any routes or exception handlers
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

# Add a custom middleware to ensure CORS headers are always present
class EnsureCORSHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            response = await call_next(request)
            # Ensure CORS headers are present
            origin = request.headers.get("origin")
            if origin in ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:8000", "http://127.0.0.1:8000"]:
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Access-Control-Allow-Credentials"] = "true"
                response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
                response.headers["Access-Control-Allow-Headers"] = "*"
            return response
        except Exception as e:
            raise

app.add_middleware(EnsureCORSHeadersMiddleware)

# Add exception handlers to ensure errors are properly formatted
# CORS middleware should add headers, but we'll add them explicitly as fallback
def get_cors_headers():
    return {
        "Access-Control-Allow-Origin": "http://localhost:3000",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "*",
        "Access-Control-Allow-Headers": "*",
    }

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=get_cors_headers(),
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
        headers=get_cors_headers(),
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    # Log the error for debugging
    import logging
    logger = logging.getLogger(__name__)
    logger.error(f"Unhandled exception: {type(exc).__name__}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
        headers=get_cors_headers(),
    )

app.include_router(api_router, prefix="/api/v1")

# Static file mounts are no longer needed when using GCP Storage
# Files are now served directly from Google Cloud Storage buckets
# If GCP is not configured, files will still be stored locally but won't be served
# through these endpoints (they'll be served with their full GCS URLs or local paths)

# Legacy local storage mounts (commented out - files now served from GCP)
# images_dir = "images"
# if not os.path.exists(images_dir):
#     os.makedirs(images_dir)
# app.mount("/images", StaticFiles(directory=images_dir), name="images")
#
# rehearsal_attachments_dir = "rehearsal_attachments"
# if not os.path.exists(rehearsal_attachments_dir):
#     os.makedirs(rehearsal_attachments_dir)
# app.mount("/rehearsal_attachments", StaticFiles(directory=rehearsal_attachments_dir), name="rehearsal_attachments")


@app.get("/")
def root() -> dict[str, str]:
    """
    Root endpoint for health check.
    """
    return {"status": "ok", "message": "Band Scheduling Platform API"}

