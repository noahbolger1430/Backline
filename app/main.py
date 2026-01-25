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

# Add a custom middleware to normalize paths and handle redirects
class PathNormalizationMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Normalize path: handle double slashes and missing /api/v1 prefix
        # This prevents redirects on preflight requests which can break CORS
        path = request.url.path
        changed = False
        if "//" in path:
            path = path.replace("//", "/")
            changed = True
        
        # List of top-level API routes that should have /api/v1 prefix
        api_prefixes = ["/auth", "/users", "/bands", "/venues", "/events", "/tours", "/availability", "/notifications", "/recommendations", "/band-events", "/event-applications", "/equipment", "/physical-tickets", "/setlists", "/stage-plots", "/youtube", "/venue-favorites", "/rehearsals"]
        if not path.startswith("/api/v1") and path != "/":
            for prefix in api_prefixes:
                if path.startswith(prefix):
                    path = f"/api/v1{path}"
                    changed = True
                    break
        
        # Ensure trailing slash for top-level collection endpoints
        # This prevents 405 errors or redirects that break CORS
        if path.startswith("/api/v1/"):
            # Split path and query string
            path_parts = path.split("?", 1)
            base_path = path_parts[0]
            query_string = path_parts[1] if len(path_parts) > 1 else None
            
            for prefix in api_prefixes:
                if base_path == f"/api/v1{prefix}":
                    # Add trailing slash to base path
                    base_path = f"{base_path}/"
                    # Reconstruct path with query string if present
                    path = base_path if query_string is None else f"{base_path}?{query_string}"
                    changed = True
                    break
        
        if changed:
            request.scope["path"] = path
        
        return await call_next(request)

app.add_middleware(PathNormalizationMiddleware)

# Add CORS middleware LAST so it wraps everything else
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "https://backline-black.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

# Add exception handlers to ensure errors are properly formatted
# CORS middleware should add headers, but we'll add them explicitly as fallback
def get_cors_headers(request: Request = None):
    """
    Get CORS headers based on the request origin.
    If no request is provided, returns headers that allow the production frontend.
    """
    allowed_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "https://backline-black.vercel.app",
    ]
    
    origin = "https://backline-black.vercel.app"  # Default to production
    if request:
        request_origin = request.headers.get("origin")
        if request_origin in allowed_origins:
            origin = request_origin
    
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "*",
        "Access-Control-Allow-Headers": "*",
    }

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=get_cors_headers(request),
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
        headers=get_cors_headers(request),
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
        headers=get_cors_headers(request),
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

