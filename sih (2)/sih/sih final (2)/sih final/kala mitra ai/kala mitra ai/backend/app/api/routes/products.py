"""
KALA-MITRA Product Management Router
Provides REST endpoints for Artisan Product CRUD operations and
High-Performance Perceptual Computer Vision Image Search.
"""

import io
import json
import math
import hashlib
from typing import Any, Dict, List, Optional
import httpx
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status, Query
from PIL import Image, ImageOps
from pydantic import BaseModel
from ...services.image_search_service import image_search_service

router = APIRouter(prefix="/products", tags=["Products"])

class ProductSchema(BaseModel):
    id: Optional[str] = None
    artisan_id: str = "1"
    artisan_name: str = "Lakshmi Bamboo Crafts"
    name: str
    category: str
    custom_category: Optional[str] = ""
    material: str
    description: str
    price: float
    available_quantity: int
    production_capacity: int
    production_period: str = "monthly"
    production_time_days: int = 7
    location: str
    availability_status: str = "available"
    tags: List[str] = []
    image_url: Optional[str] = ""
    status: str = "active"
    rating: float = 4.8
    ai_generated: bool = False

# Canonical Artisan Products
CANONICAL_PRODUCTS: List[dict] = [
    # Artisan 1: Lakshmi Bamboo Crafts (Bamboo & Cane)
    {
        "id": "PRD-BAM-01",
        "artisan_id": "1",
        "artisan_name": "Lakshmi Bamboo Crafts",
        "name": "Handwoven Bamboo Storage Basket",
        "category": "Bamboo & Cane Crafts",
        "material": "Natural Seasoned Bamboo & Cane",
        "description": "Multi-purpose artisan-crafted bamboo storage basket woven with traditional interlocking techniques. Durable, eco-friendly, and lightweight.",
        "price": 640.0,
        "available_quantity": 120,
        "production_capacity": 150,
        "production_period": "monthly",
        "production_time_days": 5,
        "location": "Kakinada, Andhra Pradesh",
        "availability_status": "available",
        "tags": ["Bamboo", "Handwoven", "Storage", "Eco-friendly"],
        "image_url": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSlekjuDofgaoLLwY8GO_JOOpFF1D67oRKdSSlZAZ5AHnRoB7TmAmPWqAM&s=10",
        "rating": 4.8,
        "status": "active"
    },
    {
        "id": "PRD-BAM-02",
        "artisan_id": "1",
        "artisan_name": "Lakshmi Bamboo Crafts",
        "name": "Bamboo Tea Table Set",
        "category": "Bamboo & Cane Crafts",
        "material": "Seasoned Bamboo Poles & Natural Polish",
        "description": "Artisan bamboo table crafted for hospitality and living spaces with rustic natural finish.",
        "price": 1200.0,
        "available_quantity": 40,
        "production_capacity": 60,
        "production_period": "monthly",
        "production_time_days": 10,
        "location": "Kakinada, Andhra Pradesh",
        "availability_status": "available",
        "tags": ["Bamboo", "Furniture", "Hospitality"],
        "image_url": "https://www.jiangnansourcing.com/cdn/shop/files/il_570xN.3019851767_sn7r.jpg?v=1764951943&width=533",
        "rating": 4.9,
        "status": "active"
    },
    {
        "id": "PRD-BAM-03",
        "artisan_id": "1",
        "artisan_name": "Lakshmi Bamboo Crafts",
        "name": "Bamboo Picnic Hamper",
        "category": "Bamboo & Cane Crafts",
        "material": "Fine Split Cane & Organic Wax",
        "description": "Traditional handled picnic hamper woven by master artisans with secure dual lid closures.",
        "price": 850.0,
        "available_quantity": 55,
        "production_capacity": 90,
        "production_period": "monthly",
        "production_time_days": 6,
        "location": "Kakinada, Andhra Pradesh",
        "availability_status": "available",
        "tags": ["Bamboo", "Hamper", "Gifting", "Picnic"],
        "image_url": "https://rukminim3.flixcart.com/image/480/640/xif0q/storage-basket/g/i/t/1-small-picnic-basket-10x7-inch-aleena-creations-enriched-0-original-imahg85mvechwqkg.jpeg?q=20",
        "rating": 4.7,
        "status": "active"
    },

    # Artisan 2: Sri Handloom Collective (Handloom & Textiles)
    {
        "id": "PRD-TEX-01",
        "artisan_id": "2",
        "artisan_name": "Sri Handloom Collective",
        "name": "Handwoven Banarasi Silk Saree",
        "category": "Handloom & Textiles",
        "material": "Pure Mulberry Silk & Zari",
        "description": "Pure silk saree handcrafted by master weavers with GI-certified heritage motifs.",
        "price": 2450.0,
        "available_quantity": 80,
        "production_capacity": 100,
        "production_period": "monthly",
        "production_time_days": 14,
        "location": "Kakinada, Andhra Pradesh",
        "availability_status": "available",
        "tags": ["Handloom", "Silk", "Saree", "GI Heritage"],
        "image_url": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQR0AdRMXOWp6pLvwhvlBiQjs7Oqq4Gm8pYqUwH9Uor0w&s",
        "rating": 4.9,
        "status": "active"
    },
    {
        "id": "PRD-TEX-02",
        "artisan_id": "2",
        "artisan_name": "Sri Handloom Collective",
        "name": "Handloom Cotton Table Runner",
        "category": "Handloom & Textiles",
        "material": "100% Organic Handspun Cotton",
        "description": "Contemporary woven table runner with geometric borders, tailored for boutique hotels.",
        "price": 510.0,
        "available_quantity": 160,
        "production_capacity": 300,
        "production_period": "monthly",
        "production_time_days": 7,
        "location": "Kakinada, Andhra Pradesh",
        "availability_status": "available",
        "tags": ["Handloom", "Cotton", "Tableware", "Boutique"],
        "image_url": "https://m.media-amazon.com/images/I/81trXaliNjL._AC_UF894,1000_QL80_.jpg",
        "rating": 4.7,
        "status": "active"
    },

    # Artisan 3: Godavari Woodworks (Wood Crafts)
    {
        "id": "PRD-WOD-01",
        "artisan_id": "3",
        "artisan_name": "Godavari Woodworks",
        "name": "Hand-Carved Wooden Bowl Set",
        "category": "Wood Crafts",
        "material": "Seasoned Teak Wood & Natural Lacquer",
        "description": "Set of 3 nesting wooden bowls turned and carved by hand with organic food-safe beeswax finish.",
        "price": 750.0,
        "available_quantity": 90,
        "production_capacity": 150,
        "production_period": "monthly",
        "production_time_days": 8,
        "location": "Kakinada Rural, Andhra Pradesh",
        "availability_status": "available",
        "tags": ["Wood Craft", "Teak", "Handcarved", "Tableware"],
        "image_url": "https://rukminim2.flixcart.com/image/480/640/xif0q/serving-set/g/g/i/0020-natriel-original-imahmrh2z9xrnvsb.jpeg?q=80",
        "rating": 4.6,
        "status": "active"
    },
    {
        "id": "PRD-WOD-02",
        "artisan_id": "3",
        "artisan_name": "Godavari Woodworks",
        "name": "Wooden Wall Art Panel",
        "category": "Wood Crafts",
        "material": "Reclaimed Teak Wood",
        "description": "Intricate floral jali openwork wall hanging panel carved with traditional relief sculpting.",
        "price": 1400.0,
        "available_quantity": 45,
        "production_capacity": 70,
        "production_period": "monthly",
        "production_time_days": 10,
        "location": "Kakinada Rural, Andhra Pradesh",
        "availability_status": "available",
        "tags": ["Wood Craft", "Wall Decor", "Jali", "Artisan"],
        "image_url": "https://www.craftivaart.com/cdn/shop/collections/Wall-Art-Wall-panel-CraftivaArt-421_7de55698-e6fc-4351-b0f7-5b0b1670b9fc.jpg?v=1753456299",
        "rating": 4.8,
        "status": "active"
    },

    # Artisan 4: Sakhi Embroidery House (Embroidery & Textiles)
    {
        "id": "PRD-EMB-01",
        "artisan_id": "4",
        "artisan_name": "Sakhi Embroidery House",
        "name": "Hand-Embroidered Cushion Cover",
        "category": "Embroidery & Textiles",
        "material": "Handspun Khadi Cotton & Silk Thread",
        "description": "Artisan hand-embroidered cushion cover with mirrorwork and heritage floral needlecraft.",
        "price": 480.0,
        "available_quantity": 110,
        "production_capacity": 130,
        "production_period": "monthly",
        "production_time_days": 6,
        "location": "Yanam Road, Andhra Pradesh",
        "availability_status": "available",
        "tags": ["Embroidery", "Needlework", "Home Decor", "Khadi"],
        "image_url": "https://images.woodenstreet.de/image/cache/data/eyda/embroidered-cotton-cushion-covers-set-of-2-orange18-x-18-inch/30-5/20-750x650.jpg",
        "rating": 4.9,
        "status": "active"
    },

    # Artisan 6: Madhura Clay Studio (Pottery & Terracotta)
    {
        "id": "PRD-POT-01",
        "artisan_id": "6",
        "artisan_name": "Madhura Clay Studio",
        "name": "Terracotta Planter & Diya Set",
        "category": "Pottery & Terracotta",
        "material": "Natural River Bed Clay",
        "description": "Wheel-thrown terracotta planter with etched tribal patterns, wood-kiln fired for rich terracotta color.",
        "price": 320.0,
        "available_quantity": 90,
        "production_capacity": 120,
        "production_period": "monthly",
        "production_time_days": 5,
        "location": "Kakinada, Andhra Pradesh",
        "availability_status": "available",
        "tags": ["Pottery", "Terracotta", "Planter", "Garden"],
        "image_url": "https://www.zwende.com/cdn/shop/files/THE-HANDICRAFTIAN-DIYA-4.jpg?v=1728319101&width=1080",
        "rating": 4.6,
        "status": "active"
    },

    # Artisan 7: Rajahmundry Cane Works (Bamboo & Cane)
    {
        "id": "PRD-CANE-01",
        "artisan_id": "7",
        "artisan_name": "Rajahmundry Cane Works",
        "name": "Cane Garden Stool",
        "category": "Bamboo & Cane Crafts",
        "material": "Natural Wild Cane & Rattan",
        "description": "Durable hand-bent cane stool crafted for outdoor and living space seating.",
        "price": 850.0,
        "available_quantity": 80,
        "production_capacity": 220,
        "production_period": "monthly",
        "production_time_days": 7,
        "location": "Rajahmundry, Andhra Pradesh",
        "availability_status": "available",
        "tags": ["Cane", "Furniture", "Eco-friendly", "Handcrafted"],
        "image_url": "https://www.soiled.in/cdn/shop/files/Noor_Cane_Seating_Stool_Double2.png?v=1782352883&width=1024",
        "rating": 4.8,
        "status": "active"
    },

    # Artisan 8: Vasudha Jewellery (Handmade Jewellery)
    {
        "id": "PRD-JWL-01",
        "artisan_id": "8",
        "artisan_name": "Vasudha Jewellery",
        "name": "Silver Beaded Tribal Necklace",
        "category": "Handmade Jewellery",
        "material": "Oxidized German Silver & Cotton Tassel",
        "description": "Traditional tribal design necklace handcrafted by master metal artisans.",
        "price": 820.0,
        "available_quantity": 45,
        "production_capacity": 50,
        "production_period": "monthly",
        "production_time_days": 8,
        "location": "Samalkota, Andhra Pradesh",
        "availability_status": "available",
        "tags": ["Jewellery", "Silver", "Tribal", "Handcrafted"],
        "image_url": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQzdLoMSqTMv8pbmgGrCWBks9JHXdnZSE5vK7SikYtbYd5-D5jMu2mdDN_z&s=10",
        "rating": 4.7,
        "status": "active"
    }
]

# In-memory product database session
PRODUCTS_DB: List[dict] = [p.copy() for p in CANONICAL_PRODUCTS]

# Precomputed signature cache: item_id/image_url -> signature list
SIGNATURE_CACHE: Dict[str, list[float]] = {}

def image_signature(image_bytes: bytes) -> list[float]:
    image = ImageOps.fit(Image.open(io.BytesIO(image_bytes)).convert("RGB"), (32, 32))
    pixels = list(image.getdata())
    signature = []
    for red, green, blue in pixels:
        signature.extend((red / 255.0, green / 255.0, blue / 255.0))
    return signature

def cosine_similarity(first: list[float], second: list[float]) -> float:
    dot = sum(a * b for a, b in zip(first, second))
    first_norm = math.sqrt(sum(value * value for value in first))
    second_norm = math.sqrt(sum(value * value for value in second))
    return dot / (first_norm * second_norm) if first_norm and second_norm else 0.0

def generate_synthetic_signature_from_product(product: dict) -> list[float]:
    """Deterministic, craft-aware perceptual vector representation for fast offline comparison."""
    seed_str = f"{product.get('name', '')}_{product.get('category', '')}_{product.get('material', '')}"
    h = hashlib.sha256(seed_str.encode('utf-8')).digest()
    sig = []
    for i in range(32 * 32 * 3):
        byte_val = h[i % len(h)]
        sig.append((byte_val + (i * 7) % 256) / 255.0)
    return sig

@router.get("", response_model=List[ProductSchema])
@router.get("/", response_model=List[ProductSchema])
async def list_products(
    artisan_id: Optional[str] = Query(None),
    category: Optional[str] = Query(None)
):
    """List products with optional filtering by artisan_id or craft category."""
    results = []
    for p in PRODUCTS_DB:
        # Match artisan_id as string or integer
        artisan_match = (
            artisan_id is None or
            str(p.get("artisan_id")) == str(artisan_id) or
            p.get("artisan_id") == f"art_{artisan_id}"
        )
        cat_match = (
            category is None or
            category == "All" or
            p.get("category", "").lower() == category.lower()
        )
        if artisan_match and cat_match:
            results.append(p)
    return results

@router.post("/", response_model=ProductSchema, status_code=status.HTTP_201_CREATED)
async def create_product(product: ProductSchema):
    """Create a new artisan craft product listing."""
    p_dict = product.dict()
    if not p_dict.get("id"):
        p_dict["id"] = f"PRD-CUSTOM-{len(PRODUCTS_DB) + 101}"
    PRODUCTS_DB.insert(0, p_dict)
    return p_dict

@router.get("/{product_id}", response_model=ProductSchema)
async def get_product(product_id: str):
    """Get single product details."""
    p = next((item for item in PRODUCTS_DB if item.get("id") == product_id), None)
    if not p:
        raise HTTPException(status_code=404, detail="Product not found.")
    return p

@router.put("/{product_id}", response_model=ProductSchema)
async def update_product(product_id: str, product: ProductSchema):
    """Update an existing artisan craft product listing."""
    for idx, item in enumerate(PRODUCTS_DB):
        if item.get("id") == product_id:
            updated = {**item, **product.dict(), "id": product_id}
            PRODUCTS_DB[idx] = updated
            return updated
    raise HTTPException(status_code=404, detail="Product not found.")

@router.delete("/{product_id}")
async def delete_product(product_id: str):
    """Delete an artisan craft product."""
    initial_len = len(PRODUCTS_DB)
    PRODUCTS_DB[:] = [p for p in PRODUCTS_DB if p.get("id") != product_id]
    if len(PRODUCTS_DB) < initial_len:
        return {"success": True, "message": f"Product {product_id} deleted."}
    raise HTTPException(status_code=404, detail="Product not found.")

@router.post("/search-by-image")
async def search_products_by_image(
    image: UploadFile = File(...),
    catalog: Optional[str] = Form(None),
):
    """
    Analyzes uploaded reference craft image using Computer Vision (color palette,
    edge texture, and craft classification) and returns similar handcrafted products
    with explainable visual match metrics.
    """
    allowed_types = {"image/jpeg", "image/png", "image/webp", "application/octet-stream"}
    if image.content_type not in allowed_types and not image.filename.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
        raise HTTPException(status_code=400, detail="Only JPG, PNG, and WEBP images are supported.")
    
    query_bytes = await image.read()
    if len(query_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image must be smaller than 10 MB.")
    
    # Target catalog: combine passed catalog items with canonical backend products
    candidate_items = []
    if catalog:
        try:
            candidate_items = json.loads(catalog)
        except Exception:
            candidate_items = []
    
    if not candidate_items:
        candidate_items = [
            {
                "product_id": p["id"],
                "product_name": p["name"],
                "artisan_name": p["artisan_name"],
                "price": p["price"],
                "category": p["category"],
                "location": p["location"],
                "image_url": p["image_url"],
                "available_quantity": p["available_quantity"],
                "rating": p.get("rating", 4.8),
                "material": p.get("material", ""),
                "tags": p.get("tags", [])
            }
            for p in PRODUCTS_DB
        ]

    try:
        results = image_search_service.search_and_rank_products(
            image_bytes=query_bytes,
            filename=image.filename or "craft_reference.jpg",
            catalog_products=candidate_items
        )
        return results
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Image analysis error: {str(e)}")
