"""Nearby artisan discovery endpoints."""

from math import asin, cos, radians, sin, sqrt
from typing import List, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

router = APIRouter(tags=["Artisans"])


class NearbyArtisan(BaseModel):
    id: int
    name: str
    craft: str
    latitude: float
    longitude: float
    location: str
    distance: float
    rating: float
    capacity: int
    products: int
    verified: bool
    phone: str
    product: str
    available_units: int


ARTISANS = [
    {"id": 1, "name": "Lakshmi Bamboo Crafts", "craft": "Bamboo & Cane", "latitude": 16.9891, "longitude": 82.2475, "location": "Kakinada", "rating": 4.8, "capacity": 150, "products": 12, "verified": True},
    {"id": 2, "name": "Sri Handloom Collective", "craft": "Handloom", "latitude": 16.9740, "longitude": 82.2420, "location": "Kakinada", "rating": 4.7, "capacity": 300, "products": 18, "verified": True},
    {"id": 3, "name": "Madhura Clay Studio", "craft": "Pottery", "latitude": 16.9955, "longitude": 82.2175, "location": "Kakinada", "rating": 4.6, "capacity": 90, "products": 9, "verified": True},
    {"id": 4, "name": "Godavari Woodworks", "craft": "Wood Crafts", "latitude": 17.0042, "longitude": 82.2692, "location": "Kakinada Rural", "rating": 4.5, "capacity": 120, "products": 15, "verified": False},
    {"id": 5, "name": "Sakhi Embroidery House", "craft": "Embroidery", "latitude": 16.9560, "longitude": 82.2640, "location": "Yanam Road", "rating": 4.9, "capacity": 80, "products": 11, "verified": True},
    {"id": 7, "name": "Rajahmundry Cane Works", "craft": "Bamboo & Cane", "latitude": 16.9897, "longitude": 81.7794, "location": "Rajahmundry", "rating": 4.8, "capacity": 220, "products": 14, "verified": True},
    {"id": 8, "name": "Vasudha Jewellery", "craft": "Jewellery", "latitude": 16.9750, "longitude": 82.2910, "location": "Samalkota", "rating": 4.7, "capacity": 45, "products": 21, "verified": True},
]


def haversine_distance(latitude_a: float, longitude_a: float, latitude_b: float, longitude_b: float) -> float:
    earth_radius_km = 6371.0
    delta_latitude = radians(latitude_b - latitude_a)
    delta_longitude = radians(longitude_b - longitude_a)
    value = sin(delta_latitude / 2) ** 2 + cos(radians(latitude_a)) * cos(radians(latitude_b)) * sin(delta_longitude / 2) ** 2
    return earth_radius_km * 2 * asin(sqrt(value))


@router.get("/artisans/nearby", response_model=List[NearbyArtisan])
async def get_nearby_artisans(
    latitude: float = Query(16.9891, ge=-90, le=90),
    longitude: float = Query(82.2475, ge=-180, le=180),
    radius: float = Query(25, gt=0, le=500),
    category: Optional[str] = Query(None),
):
    products_by_craft = {
        "Bamboo & Cane": "Handwoven Bamboo Baskets",
        "Handloom": "Handloom Cotton Stoles",
        "Pottery": "Terracotta Planters",
        "Wood Crafts": "Carved Wooden Trays",
        "Embroidery": "Embroidered Home Linens",
        "Jewellery": "Handcrafted Silver Jewellery",
        "Folk Art": "Traditional Folk Paintings",
    }
    nearby = []
    for artisan in ARTISANS:
        distance = haversine_distance(latitude, longitude, artisan["latitude"], artisan["longitude"])
        category_matches = not category or category == "All" or artisan["craft"] == category
        if distance <= radius and category_matches:
            nearby.append({
                **artisan,
                "distance": round(distance, 1),
                "phone": str(9000000000 + artisan["id"] * 137531),
                "product": products_by_craft.get(artisan["craft"], "Handmade Artisan Products"),
                "available_units": artisan["capacity"],
            })
    return sorted(nearby, key=lambda artisan: artisan["distance"])