import os
import sys

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# Configure environment defaults
os.environ.setdefault("KERAS_HOME", "/tmp/.keras")
os.environ.setdefault("YOLO_CONFIG_DIR", "/tmp/.ultralytics")
os.environ.setdefault("MPLCONFIGDIR", "/tmp/.matplotlib")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes import health, classify, detect, analyze, verify
from .config import PORT, HOST

app = FastAPI(
    title="SwachhMap AI 2.0 Inference Engine",
    description="Multimodal Computer Vision and Evidence Intelligence Service for Civic Waste Management",
    version="2.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers (both root and /api/ai prefixes)
app.include_router(health.router)
app.include_router(classify.router)
app.include_router(detect.router)
app.include_router(analyze.router)
app.include_router(verify.router)

app.include_router(health.router, prefix="/api/ai")
app.include_router(classify.router, prefix="/api/ai")
app.include_router(detect.router, prefix="/api/ai")
app.include_router(analyze.router, prefix="/api/ai")
app.include_router(verify.router, prefix="/api/ai")

@app.get("/")
def root():
    return {
        "message": "SwachhMap AI 2.0 Inference Service is running",
        "endpoints": [
            "GET /health",
            "GET /model-info",
            "POST /classify",
            "POST /detect",
            "POST /analyze",
            "POST /verify"
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("ai_service.app.main:app", host=HOST, port=PORT, reload=True)

