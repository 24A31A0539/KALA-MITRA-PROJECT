"""
KALA-MITRA FastAPI Application Entry Point
Exposes AI Product Cataloging API (/api/v1/catalog/analyze) and Health Check endpoints.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .api.routes.catalog import router as catalog_router
from .api.routes.copilot import router as copilot_router
from .api.routes.products import router as products_router
from .api.routes.capacity import router as capacity_router
from .api.routes.orders import router as orders_router
from .api.routes.opportunities import router as opportunities_router
from .api.routes.notifications import router as notifications_router
from .api.routes.artisans import router as artisans_router
from .api.routes.clusters import router as clusters_router
from .api.routes.payments import router as payments_router
from .api.routes.users import router as users_router
from .api.routes.auth import router as auth_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="KALA-MITRA AI Engine — Vision Cataloging (YOLOv8 + SAM + LLM), Copilot Assistant, and Artisan Services."
)

# Configure CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(catalog_router, prefix=settings.API_V1_STR)

app.include_router(copilot_router, prefix=settings.API_V1_STR)
app.include_router(products_router, prefix=settings.API_V1_STR)
app.include_router(capacity_router, prefix=settings.API_V1_STR)
app.include_router(orders_router, prefix=settings.API_V1_STR)
app.include_router(opportunities_router, prefix=settings.API_V1_STR)
app.include_router(notifications_router, prefix=settings.API_V1_STR)
app.include_router(artisans_router, prefix=settings.API_V1_STR)
app.include_router(clusters_router, prefix=settings.API_V1_STR)
app.include_router(payments_router, prefix=settings.API_V1_STR)
app.include_router(users_router, prefix=settings.API_V1_STR)

@app.get("/", tags=["System"])
async def root():
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "operational",
        "docs_url": "/docs",
        "endpoints": {
            "catalog": f"{settings.API_V1_STR}/catalog/analyze",
            "copilot": f"{settings.API_V1_STR}/copilot/chat",
            "products": f"{settings.API_V1_STR}/products",
            "capacity": f"{settings.API_V1_STR}/artisans/{{artisan_id}}/capacity",
            "orders": f"{settings.API_V1_STR}/orders",
            "opportunities": f"{settings.API_V1_STR}/opportunities",
            "notifications": f"{settings.API_V1_STR}/notifications",
            "nearby_artisans": f"{settings.API_V1_STR}/artisans/nearby",
            "clusters": f"{settings.API_V1_STR}/clusters",
            "payments": f"{settings.API_V1_STR}/payments",
            "users": f"{settings.API_V1_STR}/users/profile"
        }
    }

@app.get("/api/v1/health", tags=["System"])
async def health_check():
    return {
        "status": "healthy",
        "vision_service": "ready",
        "yolo_service": "initialized",
        "sam_service": "initialized",
        "llm_service": "ready",
        "copilot_service": "ready"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=True)

