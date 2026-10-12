"""
KALA-MITRA Artisan Capacity Router
Endpoints:
GET /api/v1/artisans/{artisan_id}/capacity
PUT /api/v1/artisans/{artisan_id}/capacity
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

router = APIRouter(tags=["Capacity"])

class CapacitySchema(BaseModel):
    id: Optional[str] = "cap_default"
    artisan_id: str
    available_stock: int
    production_capacity: int
    production_period: str = "monthly"
    production_time_days: int = 7
    location_name: str
    latitude: Optional[float] = 16.9891
    longitude: Optional[float] = 81.7840
    availability_status: str = "available"

@router.get("/artisans/{artisan_id}/capacity", response_model=CapacitySchema)
async def get_artisan_capacity(artisan_id: str):
    """Get capacity overview for an artisan."""
    return CapacitySchema(
        id=f"cap_{artisan_id}",
        artisan_id=artisan_id,
        available_stock=120,
        production_capacity=300,
        production_period="monthly",
        production_time_days=7,
        location_name="Rajahmundry, Andhra Pradesh",
        latitude=16.9891,
        longitude=81.7840,
        availability_status="available"
    )

@router.put("/artisans/{artisan_id}/capacity", response_model=CapacitySchema)
async def update_artisan_capacity(artisan_id: str, payload: CapacitySchema):
    """Update artisan workshop capacity."""
    return payload
