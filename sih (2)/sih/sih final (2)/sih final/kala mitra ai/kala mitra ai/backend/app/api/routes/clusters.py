"""
Artisan Cluster Matching, Allocation, AI Auto-Replacement, and Unified Order Conversion.
Implements KALA-MITRA USP:
"AI transforms scattered artisan capacity into a dependable collective supply network."
"Many artisans. One order. One coordinated delivery."
"""

from datetime import date, timedelta
from typing import Dict, List, Optional, Any
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from ...services.store import store
from ...services.notification_service import notification_service

router = APIRouter(prefix="/clusters", tags=["Artisan Cluster"])

class ClusterCreateRequest(BaseModel):
    product: str = "Handwoven Bamboo Basket"
    quantity: int = Field(1000, gt=0)
    delivery_days: int = Field(14, gt=0)
    budget: float = Field(150000, gt=0)
    location: str = "East Godavari"
    category: str = "Bamboo Crafts"
    buyer_id: str = "buyer-demo"

class SelectedArtisanInput(BaseModel):
    artisan_id: int
    proposed_contribution: int = Field(..., gt=0)

class ProvisionalClusterRequest(BaseModel):
    product: str = "Handwoven Bamboo Basket"
    quantity: int = Field(500, gt=0)
    delivery_days: int = Field(14, gt=0)
    budget: float = Field(75000, gt=0)
    location: str = "East Godavari"
    category: str = "Bamboo Crafts"
    buyer_id: str = "buyer-demo"
    required_by_date: Optional[str] = None
    selected_artisans: List[SelectedArtisanInput] = []

class AddArtisanRequest(BaseModel):
    artisan_id: int
    proposed_contribution: int = Field(..., gt=0)

class ClusterResponseAction(BaseModel):
    artisan_id: int
    action: str  # "accept" or "decline"

class ProductionUpdate(BaseModel):
    artisan_id: int
    produced_quantity: int = Field(..., ge=0)

class ClusterPaymentUpdate(BaseModel):
    stage: str = "advance"  # "advance" or "remaining"
    amount: float = 0.0
    txn_id: Optional[str] = None

# Multi-Craft Verified Artisan Network Pool
ARTISANS_POOL = [
    # --- Bamboo Crafts ---
    {"id": 1, "name": "Lakshmi Bamboo Crafts", "craft": "Bamboo Crafts", "location": "Kakinada", "capacity": 250, "price": 140, "rating": 4.8, "verified": True, "reliability": 98, "lead_days": 12, "available": True},
    {"id": 2, "name": "Sri Durga Bamboo Works", "craft": "Bamboo Crafts", "location": "Samalkota", "capacity": 200, "price": 142, "rating": 4.7, "verified": True, "reliability": 96, "lead_days": 14, "available": True},
    {"id": 3, "name": "Godavari Cane Crafters", "craft": "Bamboo Crafts", "location": "Rajahmundry", "capacity": 300, "price": 138, "rating": 4.9, "verified": True, "reliability": 99, "lead_days": 10, "available": True},
    {"id": 4, "name": "Venkateswara Bamboo Guild", "craft": "Bamboo Crafts", "location": "Yanam Road", "capacity": 250, "price": 140, "rating": 4.6, "verified": True, "reliability": 95, "lead_days": 14, "available": True},
    {"id": 5, "name": "Coastal Bamboo & Rattan", "craft": "Bamboo Crafts", "location": "Pithapuram", "capacity": 220, "price": 139, "rating": 4.7, "verified": True, "reliability": 97, "lead_days": 13, "available": True},
    {"id": 6, "name": "Konaseema Eco-Crafts", "craft": "Bamboo Crafts", "location": "Amalapuram", "capacity": 250, "price": 141, "rating": 4.8, "verified": True, "reliability": 98, "lead_days": 12, "available": True},

    # --- Handloom & Kalamkari ---
    {"id": 11, "name": "Sri Handloom Collective", "craft": "Handloom", "location": "Kakinada", "capacity": 250, "price": 480, "rating": 4.9, "verified": True, "reliability": 99, "lead_days": 15, "available": True},
    {"id": 12, "name": "Vastra Weavers Guild", "craft": "Handloom", "location": "Mangalagiri", "capacity": 200, "price": 490, "rating": 4.8, "verified": True, "reliability": 97, "lead_days": 14, "available": True},
    {"id": 13, "name": "Krishna Valley Handlooms", "craft": "Handloom", "location": "Machilipatnam", "capacity": 300, "price": 475, "rating": 4.7, "verified": True, "reliability": 95, "lead_days": 16, "available": True},
    {"id": 14, "name": "Pedana Kalamkari Cooperative", "craft": "Handloom", "location": "Pedana", "capacity": 250, "price": 485, "rating": 4.9, "verified": True, "reliability": 98, "lead_days": 14, "available": True},
    {"id": 15, "name": "Godavari Silk & Cotton", "craft": "Handloom", "location": "Dharmavaram", "capacity": 250, "price": 480, "rating": 4.8, "verified": True, "reliability": 97, "lead_days": 15, "available": True},

    # --- Wood Crafts ---
    {"id": 21, "name": "Godavari Woodworks", "craft": "Wood Crafts", "location": "Kakinada Rural", "capacity": 250, "price": 320, "rating": 4.7, "verified": True, "reliability": 96, "lead_days": 14, "available": True},
    {"id": 22, "name": "Etikoppaka Lacquer Artisans", "craft": "Wood Crafts", "location": "Etikoppaka", "capacity": 200, "price": 310, "rating": 4.9, "verified": True, "reliability": 98, "lead_days": 12, "available": True},
    {"id": 23, "name": "Kondapalli Toy Cluster", "craft": "Wood Crafts", "location": "Kondapalli", "capacity": 300, "price": 330, "rating": 4.8, "verified": True, "reliability": 97, "lead_days": 15, "available": True},
    {"id": 24, "name": "Eastern Ghats Carvers", "craft": "Wood Crafts", "location": "Rajahmundry", "capacity": 250, "price": 315, "rating": 4.6, "verified": True, "reliability": 95, "lead_days": 14, "available": True},
    {"id": 25, "name": "Simhachalam Wood Crafts", "craft": "Wood Crafts", "location": "Visakhapatnam", "capacity": 250, "price": 320, "rating": 4.8, "verified": True, "reliability": 97, "lead_days": 14, "available": True},

    # --- Pottery & Terracotta ---
    {"id": 31, "name": "Madhura Clay Studio", "craft": "Pottery", "location": "Kakinada", "capacity": 250, "price": 180, "rating": 4.8, "verified": True, "reliability": 97, "lead_days": 10, "available": True},
    {"id": 32, "name": "Riverbank Terracotta Guild", "craft": "Pottery", "location": "Rajahmundry", "capacity": 200, "price": 175, "rating": 4.9, "verified": True, "reliability": 99, "lead_days": 12, "available": True},
    {"id": 33, "name": "Andhra Clay Arts", "craft": "Pottery", "location": "Samalkota", "capacity": 300, "price": 185, "rating": 4.7, "verified": True, "reliability": 95, "lead_days": 11, "available": True},
    {"id": 34, "name": "Godavari Earthwares", "craft": "Pottery", "location": "Pithapuram", "capacity": 250, "price": 180, "rating": 4.6, "verified": True, "reliability": 96, "lead_days": 12, "available": True},
    {"id": 35, "name": "Coastal Terracotta Works", "craft": "Pottery", "location": "Yanam", "capacity": 250, "price": 178, "rating": 4.8, "verified": True, "reliability": 98, "lead_days": 10, "available": True},

    # --- Jute & Eco Crafts ---
    {"id": 41, "name": "Coastal Jute Works", "craft": "Jute Crafts", "location": "Pithapuram", "capacity": 250, "price": 120, "rating": 4.8, "verified": True, "reliability": 97, "lead_days": 12, "available": True},
    {"id": 42, "name": "GreenFiber Crafts", "craft": "Jute Crafts", "location": "Kakinada", "capacity": 200, "price": 125, "rating": 4.7, "verified": True, "reliability": 96, "lead_days": 14, "available": True},
    {"id": 43, "name": "EcoBasket Artisans", "craft": "Jute Crafts", "location": "Rajahmundry", "capacity": 300, "price": 118, "rating": 4.9, "verified": True, "reliability": 99, "lead_days": 10, "available": True},
    {"id": 44, "name": "Delta Natural Weaves", "craft": "Jute Crafts", "location": "Yanam", "capacity": 250, "price": 122, "rating": 4.6, "verified": True, "reliability": 95, "lead_days": 12, "available": True},
    {"id": 45, "name": "Godavari Eco Works", "craft": "Jute Crafts", "location": "Amalapuram", "capacity": 250, "price": 120, "rating": 4.8, "verified": True, "reliability": 98, "lead_days": 12, "available": True},

    # --- Jewellery ---
    {"id": 51, "name": "Machilipatnam Imitation Jewellery", "craft": "Jewellery", "location": "Machilipatnam", "capacity": 450, "price": 220, "rating": 4.9, "verified": True, "reliability": 98, "lead_days": 10, "available": True},
    {"id": 52, "name": "Lac & Terracotta Beads Guild", "craft": "Jewellery", "location": "Kakinada", "capacity": 300, "price": 180, "rating": 4.8, "verified": True, "reliability": 97, "lead_days": 9, "available": True},
    {"id": 53, "name": "Tribal Shell & Bead Artisans", "craft": "Jewellery", "location": "Araku Valley", "capacity": 250, "price": 200, "rating": 4.7, "verified": True, "reliability": 95, "lead_days": 12, "available": True},
    {"id": 54, "name": "Heritage Thread Jewellery Crafters", "craft": "Jewellery", "location": "Vijayawada", "capacity": 350, "price": 210, "rating": 4.8, "verified": True, "reliability": 98, "lead_days": 11, "available": True},
    {"id": 55, "name": "Godavari Artisan Jewels", "craft": "Jewellery", "location": "Rajahmundry", "capacity": 280, "price": 195, "rating": 4.6, "verified": True, "reliability": 96, "lead_days": 10, "available": True},

    # --- Kalamkari ---
    {"id": 61, "name": "Srikalahasti Kalamkari Guild", "craft": "Kalamkari", "location": "Srikalahasti", "capacity": 200, "price": 550, "rating": 4.9, "verified": True, "reliability": 99, "lead_days": 14, "available": True},
    {"id": 62, "name": "Pedana Block Print Artisans", "craft": "Kalamkari", "location": "Pedana", "capacity": 250, "price": 520, "rating": 4.8, "verified": True, "reliability": 97, "lead_days": 12, "available": True},
    {"id": 63, "name": "Machilipatnam Tree of Life Art", "craft": "Kalamkari", "location": "Machilipatnam", "capacity": 180, "price": 580, "rating": 4.9, "verified": True, "reliability": 98, "lead_days": 16, "available": True},

    # --- Metal Crafts ---
    {"id": 71, "name": "Dokra Tribal Metal Guild", "craft": "Metal Crafts", "location": "Araku Valley", "capacity": 180, "price": 650, "rating": 4.9, "verified": True, "reliability": 98, "lead_days": 20, "available": True},
    {"id": 72, "name": "Chinthoor Bell Metal Crafters", "craft": "Metal Crafts", "location": "Chinthoor", "capacity": 150, "price": 620, "rating": 4.8, "verified": True, "reliability": 96, "lead_days": 18, "available": True},
    {"id": 73, "name": "Budithi Brassware Artisans", "craft": "Metal Crafts", "location": "Budithi", "capacity": 220, "price": 580, "rating": 4.7, "verified": True, "reliability": 95, "lead_days": 16, "available": True},

    # --- Leather Crafts ---
    {"id": 81, "name": "Nimmalakunta Shadow Puppets", "craft": "Leather Crafts", "location": "Nimmalakunta", "capacity": 150, "price": 420, "rating": 4.9, "verified": True, "reliability": 98, "lead_days": 16, "available": True},
    {"id": 82, "name": "Tholu Bommalata Heritage Guild", "craft": "Leather Crafts", "location": "Anantapur", "capacity": 180, "price": 450, "rating": 4.8, "verified": True, "reliability": 97, "lead_days": 15, "available": True},

    # --- Stone Crafts ---
    {"id": 91, "name": "Allagadda Stone Carvings", "craft": "Stone Crafts", "location": "Allagadda", "capacity": 120, "price": 850, "rating": 4.9, "verified": True, "reliability": 99, "lead_days": 25, "available": True},
    {"id": 92, "name": "Durgi Marble & Stone Guild", "craft": "Stone Crafts", "location": "Durgi", "capacity": 150, "price": 800, "rating": 4.8, "verified": True, "reliability": 97, "lead_days": 22, "available": True},

    # --- Embroidery ---
    {"id": 101, "name": "Banjara Needlework Crafters", "craft": "Embroidery", "location": "Guntur", "capacity": 250, "price": 320, "rating": 4.9, "verified": True, "reliability": 98, "lead_days": 14, "available": True},
    {"id": 102, "name": "Zardozi & Embroidery Guild", "craft": "Embroidery", "location": "Hyderabad", "capacity": 220, "price": 380, "rating": 4.8, "verified": True, "reliability": 96, "lead_days": 16, "available": True},

    # --- Bags & Accessories ---
    {"id": 111, "name": "Coastal Handmade Bag Guild", "craft": "Bags & Accessories", "location": "Kakinada", "capacity": 350, "price": 280, "rating": 4.8, "verified": True, "reliability": 97, "lead_days": 10, "available": True},
    {"id": 112, "name": "Earthy Jute & Tote Crafters", "craft": "Bags & Accessories", "location": "Samalkota", "capacity": 300, "price": 260, "rating": 4.7, "verified": True, "reliability": 95, "lead_days": 9, "available": True},

    # --- Folk Art ---
    {"id": 121, "name": "Cheriyal Scroll Painters", "craft": "Folk Art", "location": "Warangal", "capacity": 150, "price": 750, "rating": 4.9, "verified": True, "reliability": 98, "lead_days": 18, "available": True},
    {"id": 122, "name": "Tanjore Gold Foil Artisans", "craft": "Folk Art", "location": "Tirupati", "capacity": 120, "price": 950, "rating": 4.9, "verified": True, "reliability": 99, "lead_days": 20, "available": True},

    # --- Other Traditional Crafts ---
    {"id": 131, "name": "Multi-Craft Artisan Collective", "craft": "Other Traditional Crafts", "location": "Kakinada", "capacity": 250, "price": 300, "rating": 4.8, "verified": True, "reliability": 97, "lead_days": 12, "available": True},
    {"id": 132, "name": "Heritage Andhra Crafts Guild", "craft": "Other Traditional Crafts", "location": "Rajahmundry", "capacity": 200, "price": 320, "rating": 4.7, "verified": True, "reliability": 96, "lead_days": 14, "available": True},
]

def map_category_to_craft(category: str, product: str) -> str:
    cat_lower = (category + " " + product).lower()
    if any(w in cat_lower for w in ["jewel", "necklace", "ring", "bangle", "earring", "bead", "ornament"]):
        return "Jewellery"
    if any(w in cat_lower for w in ["kalamkari"]):
        return "Kalamkari"
    if any(w in cat_lower for w in ["brass", "metal", "dokra", "bronze", "bell"]):
        return "Metal Crafts"
    if any(w in cat_lower for w in ["leather", "puppet"]):
        return "Leather Crafts"
    if any(w in cat_lower for w in ["stone", "sculpture", "marble"]):
        return "Stone Crafts"
    if any(w in cat_lower for w in ["embroidery", "needle", "stitch"]):
        return "Embroidery"
    if any(w in cat_lower for w in ["bag", "accessory", "purse", "wallet", "tote"]):
        return "Bags & Accessories"
    if any(w in cat_lower for w in ["folk", "wall", "decor", "painting", "tanjore", "pattachitra", "cheriyal"]):
        return "Folk Art"
    if any(w in cat_lower for w in ["bamboo", "cane", "basket", "rattan"]):
        return "Bamboo Crafts"
    if any(w in cat_lower for w in ["handloom", "sari", "saree", "stole", "fabric", "textile", "weav"]):
        return "Handloom"
    if any(w in cat_lower for w in ["wood", "toy", "carv", "lacquer", "etikoppaka"]):
        return "Wood Crafts"
    if any(w in cat_lower for w in ["pottery", "clay", "terracotta", "diya", "planter"]):
        return "Pottery"
    if any(w in cat_lower for w in ["jute", "fiber", "eco"]):
        return "Jute Crafts"
    return "Bamboo Crafts"

def score_artisan(artisan: dict, request: ClusterCreateRequest, target_craft: str) -> int:
    # Craft Match: 35 pts
    craft_score = 35 if artisan["craft"] == target_craft else 15
    # Quality & Reliability: 25 pts
    quality_score = round((artisan["rating"] / 5.0) * 15) + (10 if artisan["verified"] else 5)
    # Capacity Fit: 20 pts
    capacity_score = min(20, round((artisan["capacity"] / 300) * 20))
    # Reliability Rate: 10 pts
    reliability_score = round((artisan.get("reliability", 95) / 100) * 10)
    # Lead Time within target: 10 pts
    speed_score = 10 if artisan.get("lead_days", 14) <= request.delivery_days else 5

    total = craft_score + quality_score + capacity_score + reliability_score + speed_score
    return min(99, max(60, total))

def select_artisans(request: ClusterCreateRequest) -> List[dict]:
    target_craft = map_category_to_craft(request.category, request.product)
    # Filter candidates by craft
    candidates = [a for a in ARTISANS_POOL if a["craft"] == target_craft and a["available"]]
    if not candidates:
        candidates = [a for a in ARTISANS_POOL if a["available"]]

    # Rank by AI composite score
    ranked = sorted(candidates, key=lambda a: (-score_artisan(a, request, target_craft), -a.get("reliability", 90)))
    
    selected = []
    remaining = request.quantity
    deadline_date = str(date.today() + timedelta(days=request.delivery_days))

    for artisan in ranked:
        if remaining <= 0:
            break
        assigned = min(artisan["capacity"], remaining)
        earnings = assigned * artisan["price"]
        selected.append({
            "id": artisan["id"],
            "name": artisan["name"],
            "craft": artisan["craft"],
            "location": artisan["location"],
            "capacity": artisan["capacity"],
            "price": artisan["price"],
            "rating": artisan["rating"],
            "verified": artisan["verified"],
            "reliability": artisan.get("reliability", 97),
            "lead_days": artisan.get("lead_days", request.delivery_days),
            "assigned_quantity": assigned,
            "earnings": earnings,
            "produced_quantity": 0,
            "status": "Waiting for Acceptance",
            "match_score": score_artisan(artisan, request, target_craft),
            "deadline": deadline_date,
            "contribution_pct": round((assigned / request.quantity) * 100, 1)
        })
        remaining -= assigned

    return selected

def build_cluster(request: ClusterCreateRequest, cluster_id: str) -> dict:
    members = select_artisans(request)
    allocated = sum(member["assigned_quantity"] for member in members)
    total_cost = sum(member["earnings"] for member in members)
    target_craft = map_category_to_craft(request.category, request.product)
    
    # Recalculate accurate contribution percentages
    for m in members:
        m["contribution_pct"] = round((m["assigned_quantity"] / request.quantity) * 100, 1) if request.quantity > 0 else 0

    return {
        "id": cluster_id,
        "order_id": f"ORD-{cluster_id[-6:].upper()}",
        "buyer_id": request.buyer_id,
        "product": request.product,
        "category": target_craft,
        "required_quantity": request.quantity,
        "total_allocated": allocated,
        "accepted_quantity": 0,
        "budget": request.budget,
        "delivery_days": request.delivery_days,
        "delivery_date": str(date.today() + timedelta(days=request.delivery_days)),
        "location": request.location,
        "match_score": round(sum(m["match_score"] for m in members) / len(members)) if members else 96,
        "estimated_total_cost": total_cost,
        "status": "Cluster Proposed",
        "members": members,
        "replacement_history": [],
        "capacity_deficit": max(0, request.quantity - allocated),
        "is_fulfilled": allocated >= request.quantity,
        "created_at": str(date.today()),
        "usp_tagline": "Many artisans. One order. One coordinated delivery."
    }

@router.post("/create")
async def create_cluster(request: ClusterCreateRequest):
    """Creates a new AI-optimized Artisan Cluster recommendation."""
    cluster_id = f"CL-{uuid4().hex[:8].upper()}"
    cluster = build_cluster(request, cluster_id)
    store.clusters[cluster_id] = cluster
    store.save()

    notification_service.notify_bulk_requirement(
        buyer_id=request.buyer_id,
        product_name=request.product,
        quantity=request.quantity,
        cluster_id=cluster_id
    )

    for member in cluster["members"]:
        notification_service.notify_cluster_invitation(
            artisan_id=member["id"],
            artisan_name=member["name"],
            product_name=cluster["product"],
            assigned_quantity=member["assigned_quantity"],
            cluster_id=cluster_id
        )

    return cluster

@router.post("/provisional")
async def create_provisional_cluster(request: ProvisionalClusterRequest):
    """
    Creates a new PROVISIONAL Artisan Cluster where buyer selects artisans
    and specifies proposed contribution per artisan.
    """
    cluster_id = f"CL-PROV-{uuid4().hex[:8].upper()}"
    target_craft = map_category_to_craft(request.category, request.product)
    members = []
    deadline_date = request.required_by_date or str(date.today() + timedelta(days=request.delivery_days))

    for item in request.selected_artisans:
        artisan = next((a for a in ARTISANS_POOL if a["id"] == item.artisan_id), None)
        if not artisan:
            continue
        if item.proposed_contribution > artisan["capacity"]:
            raise HTTPException(
                status_code=400,
                detail=f"Proposed contribution ({item.proposed_contribution}) exceeds available capacity ({artisan['capacity']}) for {artisan['name']}"
            )
        assigned = item.proposed_contribution
        earnings = assigned * artisan["price"]
        members.append({
            "id": artisan["id"],
            "name": artisan["name"],
            "craft": artisan["craft"],
            "location": artisan["location"],
            "address": artisan.get("address", f"{artisan['location']} Artisans Colony, Main Road, Andhra Pradesh"),
            "phone": artisan.get("phone", f"+91 98765 {artisan['id']:05d}"),
            "capacity": artisan["capacity"],
            "price": artisan["price"],
            "rating": artisan["rating"],
            "verified": artisan["verified"],
            "reliability": artisan.get("reliability", 97),
            "lead_days": artisan.get("lead_days", request.delivery_days),
            "assigned_quantity": assigned,
            "earnings": earnings,
            "produced_quantity": 0,
            "status": "Provisional",
            "match_score": score_artisan(artisan, ClusterCreateRequest(product=request.product, quantity=request.quantity, delivery_days=request.delivery_days, budget=request.budget, location=request.location, category=request.category, buyer_id=request.buyer_id), target_craft),
            "deadline": deadline_date,
            "contribution_pct": round((assigned / request.quantity) * 100, 1) if request.quantity > 0 else 0
        })

    allocated = sum(m["assigned_quantity"] for m in members)
    total_cost = sum(m["earnings"] for m in members)

    cluster = {
        "id": cluster_id,
        "buyer_id": request.buyer_id,
        "product": request.product,
        "category": target_craft,
        "required_quantity": request.quantity,
        "total_allocated": allocated,
        "accepted_quantity": 0,
        "budget": request.budget,
        "delivery_days": request.delivery_days,
        "delivery_date": deadline_date,
        "location": request.location,
        "match_score": round(sum(m["match_score"] for m in members) / len(members)) if members else 95,
        "estimated_total_cost": total_cost,
        "status": "PROVISIONAL",
        "members": members,
        "replacement_history": [],
        "capacity_deficit": max(0, request.quantity - allocated),
        "is_fulfilled": allocated >= request.quantity,
        "created_at": str(date.today()),
        "usp_tagline": "Many artisans. One order. One coordinated delivery."
    }

    store.clusters[cluster_id] = cluster
    store.save()
    return cluster

@router.post("/{cluster_id}/send-requests")
async def send_cluster_requests(cluster_id: str):
    """Dispatches cluster invitation notifications to all selected artisans."""
    if cluster_id not in store.clusters:
        raise HTTPException(status_code=404, detail="Cluster not found")
    cluster = store.clusters[cluster_id]

    cluster["status"] = "PENDING"
    all_members = cluster.get("members", [])
    all_names = [m["name"] for m in all_members]

    for member in all_members:
        if member.get("status") in ["Provisional", "Waiting for Acceptance"]:
            member["status"] = "Pending"
        other_names = [name for name in all_names if name != member["name"]]
        co_str = ", ".join(other_names) if other_names else "Self"
        notification_service.notify_cluster_invitation(
            artisan_id=member["id"],
            artisan_name=member["name"],
            product_name=cluster["product"],
            assigned_quantity=member["assigned_quantity"],
            cluster_id=cluster_id,
            buyer_name="EcoMarket India",
            buyer_location=cluster.get("location", "Kakinada"),
            co_artisans=co_str
        )

    store.save()
    return cluster

@router.post("/{cluster_id}/respond")
async def respond_cluster_invitation(cluster_id: str, action: str = Query(...), artisan_id: int = Query(...)):
    """Artisan responds (ACCEPT or DECLINE) to a cluster request."""
    if cluster_id not in store.clusters:
        raise HTTPException(status_code=404, detail="Cluster not found")
    cluster = store.clusters[cluster_id]
    member = next((item for item in cluster["members"] if item["id"] == artisan_id), None)
    if not member:
        raise HTTPException(status_code=404, detail="Artisan is not part of this cluster")

    action_clean = action.strip().lower()
    if action_clean == "accept":
        member["status"] = "Accepted"
        notification_service.notify_artisan_accepted(
            buyer_id=cluster.get("buyer_id", "buyer-demo"),
            artisan_name=member["name"],
            assigned_quantity=member["assigned_quantity"],
            cluster_id=cluster_id
        )
    elif action_clean == "decline":
        member["status"] = "Declined"
        notification_service.notify_artisan_declined(
            buyer_id=cluster.get("buyer_id", "buyer-demo"),
            artisan_name=member["name"],
            cluster_id=cluster_id
        )
    else:
        raise HTTPException(status_code=400, detail="Action must be 'accept' or 'decline'")

    accepted_qty = sum(m["assigned_quantity"] for m in cluster["members"] if m["status"] == "Accepted")
    cluster["accepted_quantity"] = accepted_qty

    if accepted_qty >= cluster["required_quantity"] and cluster["status"] != "CONFIRMED":
        cluster["status"] = "PROVISIONAL"  # Ready for buyer confirmation

    store.save()
    return cluster

@router.post("/{cluster_id}/add-artisan")
async def add_artisan_to_cluster(cluster_id: str, req: AddArtisanRequest):
    """Buyer adds a replacement/suitable artisan with proposed contribution."""
    if cluster_id not in store.clusters:
        raise HTTPException(status_code=404, detail="Cluster not found")
    cluster = store.clusters[cluster_id]
    artisan = next((a for a in ARTISANS_POOL if a["id"] == req.artisan_id), None)
    if not artisan:
        raise HTTPException(status_code=404, detail="Artisan not found in pool")

    if req.proposed_contribution > artisan["capacity"]:
        raise HTTPException(
            status_code=400,
            detail=f"Proposed contribution ({req.proposed_contribution}) exceeds available capacity ({artisan['capacity']})"
        )

    existing = next((m for m in cluster["members"] if m["id"] == req.artisan_id), None)
    if existing:
        existing["assigned_quantity"] = req.proposed_contribution
        existing["earnings"] = req.proposed_contribution * artisan["price"]
        existing["status"] = "Pending" if cluster["status"] == "PENDING" else "Provisional"
    else:
        deadline_date = cluster.get("delivery_date", str(date.today() + timedelta(days=14)))
        new_member = {
            "id": artisan["id"],
            "name": artisan["name"],
            "craft": artisan["craft"],
            "location": artisan["location"],
            "capacity": artisan["capacity"],
            "price": artisan["price"],
            "rating": artisan["rating"],
            "verified": artisan["verified"],
            "reliability": artisan.get("reliability", 97),
            "lead_days": artisan.get("lead_days", cluster.get("delivery_days", 14)),
            "assigned_quantity": req.proposed_contribution,
            "earnings": req.proposed_contribution * artisan["price"],
            "produced_quantity": 0,
            "status": "Pending" if cluster["status"] == "PENDING" else "Provisional",
            "match_score": 95,
            "deadline": deadline_date,
            "contribution_pct": round((req.proposed_contribution / cluster["required_quantity"]) * 100, 1) if cluster["required_quantity"] > 0 else 0
        }
        cluster["members"].append(new_member)
        if cluster["status"] == "PENDING":
            notification_service.notify_cluster_invitation(
                artisan_id=artisan["id"],
                artisan_name=artisan["name"],
                product_name=cluster["product"],
                assigned_quantity=req.proposed_contribution,
                cluster_id=cluster_id
            )

    cluster["total_allocated"] = sum(m["assigned_quantity"] for m in cluster["members"] if m["status"] != "Declined")
    cluster["capacity_deficit"] = max(0, cluster["required_quantity"] - cluster["total_allocated"])
    store.save()
    return cluster

@router.post("/{cluster_id}/confirm")
async def confirm_cluster(cluster_id: str):
    """
    Final confirmation of cluster by Buyer when accepted capacity >= requested quantity.
    Changes status from PROVISIONAL/PENDING to CONFIRMED.
    IMPORTANT: Does NOT create an order or payment automatically.
    Dispatches confirmation notifications to Buyer and Artisans.
    """
    if cluster_id not in store.clusters:
        raise HTTPException(status_code=404, detail="Cluster not found")
    cluster = store.clusters[cluster_id]

    accepted_qty = sum(m["assigned_quantity"] for m in cluster["members"] if m["status"] == "Accepted")
    total_qty = sum(m["assigned_quantity"] for m in cluster["members"] if m["status"] != "Declined")
    
    effective_qty = accepted_qty if accepted_qty > 0 else total_qty

    if effective_qty < cluster["required_quantity"]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot confirm cluster: Accepted capacity ({effective_qty}) is less than requested quantity ({cluster['required_quantity']})"
        )

    cluster["status"] = "CONFIRMED"
    cluster["accepted_quantity"] = effective_qty

    # Build artisan names list
    active_members = [m for m in cluster["members"] if m.get("status") != "Declined"]
    active_names = [m["name"] for m in active_members]
    artisan_names_str = ", ".join(active_names)

    # Notify Buyer
    notification_service.notify_cluster_formed(
        buyer_id=cluster.get("buyer_id", "buyer-demo"),
        product_name=cluster["product"],
        total_quantity=effective_qty,
        cluster_id=cluster_id,
        artisan_names=artisan_names_str
    )

    # Notify Artisans
    for m in active_members:
        co_names = [name for name in active_names if name != m["name"]]
        co_str = ", ".join(co_names) if co_names else "Self"
        notification_service.notify_artisan_cluster_confirmed(
            artisan_id=m["id"],
            product_name=cluster["product"],
            total_quantity=effective_qty,
            cluster_id=cluster_id,
            co_artisans=co_str
        )

    store.save()
    return cluster

@router.post("/{cluster_id}/payment")
async def record_cluster_payment(cluster_id: str, req: ClusterPaymentUpdate):
    """
    Records milestone escrow payment (advance 40% or remaining 60%) for a cluster.
    Updates payment_status, amounts, transaction ID, and cluster status.
    """
    if cluster_id not in store.clusters:
        store.clusters[cluster_id] = {
            "id": cluster_id,
            "status": "IN PRODUCTION" if req.stage == "advance" else "COMPLETED",
            "payment_status": "ADVANCE_PAID" if req.stage == "advance" else "FULLY_PAID",
            "advance_paid_amount": req.amount if req.stage == "advance" else 0.0,
            "advance_txn_id": req.txn_id or f"TXN-CLUST-{uuid4().hex[:6].upper()}",
            "remaining_paid_amount": req.amount if req.stage == "remaining" else 0.0,
            "remaining_txn_id": req.txn_id if req.stage == "remaining" else None,
            "order_completed": req.stage == "remaining"
        }
        store.save()
        return store.clusters[cluster_id]

    cluster = store.clusters[cluster_id]
    if req.stage == "advance":
        cluster["payment_status"] = "ADVANCE_PAID"
        cluster["advance_paid_amount"] = req.amount
        cluster["advance_txn_id"] = req.txn_id or f"TXN-CLUST-{uuid4().hex[:6].upper()}"
        cluster["status"] = "IN PRODUCTION"
        for m in cluster.get("members", []):
            if m.get("status") != "Declined":
                m["status"] = "Accepted"
    elif req.stage == "remaining":
        cluster["payment_status"] = "FULLY_PAID"
        cluster["remaining_paid_amount"] = req.amount
        cluster["remaining_txn_id"] = req.txn_id or f"TXN-CLUST-{uuid4().hex[:6].upper()}"
        cluster["status"] = "COMPLETED"
        cluster["order_completed"] = True

    store.save()
    return cluster

@router.get("/pool/artisans")
async def get_artisans_pool(craft: Optional[str] = None):
    """Returns available artisans pool for cluster selection."""
    if craft:
        return [a for a in ARTISANS_POOL if a["craft"].lower() == craft.lower() and a["available"]]
    return ARTISANS_POOL

@router.get("")
@router.get("/")
async def list_clusters():
    """Lists all active clusters."""
    return list(store.clusters.values())

@router.get("/{cluster_id}")
async def get_cluster(cluster_id: str):
    """Retrieves cluster details by ID."""
    if cluster_id not in store.clusters:
        raise HTTPException(status_code=404, detail="Cluster not found")
    return store.clusters[cluster_id]

@router.get("/artisan/{artisan_id}")
async def get_artisan_cluster_invitations(artisan_id: int):
    """
    Returns only invitations for this specific artisan.
    Artisan sees strictly their assigned quantity, earnings, and deadline.
    """
    results = []
    for cluster in store.clusters.values():
        member = next((m for m in cluster.get("members", []) if m["id"] == artisan_id), None)
        if member:
            results.append({
                "cluster_id": cluster["id"],
                "product": cluster["product"],
                "category": cluster["category"],
                "total_order_quantity": cluster["required_quantity"],
                "your_assigned_quantity": member["assigned_quantity"],
                "your_earnings": member["earnings"],
                "your_deadline": member["deadline"],
                "your_status": member["status"],
                "cluster_status": cluster["status"],
                "buyer_id": cluster.get("buyer_id", "Verified Buyer")
            })
    return results

@router.post("/{cluster_id}/accept")
async def accept_cluster_invitation(cluster_id: str, artisan_id: int = Query(...)):
    """Artisan accepts their assigned contribution in the cluster."""
    if cluster_id not in store.clusters:
        raise HTTPException(status_code=404, detail="Cluster not found")
    cluster = store.clusters[cluster_id]
    member = next((item for item in cluster["members"] if item["id"] == artisan_id), None)
    if not member:
        raise HTTPException(status_code=404, detail="Artisan is not part of this cluster")

    member["status"] = "Accepted"
    accepted_qty = sum(m["assigned_quantity"] for m in cluster["members"] if m["status"] == "Accepted")
    cluster["accepted_quantity"] = accepted_qty

    buyer_id = cluster.get("buyer_id", "buyer-demo")
    notification_service.notify_artisan_accepted(
        buyer_id=buyer_id,
        artisan_name=member["name"],
        assigned_quantity=member["assigned_quantity"],
        cluster_id=cluster_id
    )

    if accepted_qty >= cluster["required_quantity"]:
        cluster["status"] = "Cluster Formed & Confirmed"
        notification_service.notify_cluster_formed(
            buyer_id=buyer_id,
            product_name=cluster["product"],
            total_quantity=accepted_qty,
            cluster_id=cluster_id
        )
    else:
        cluster["status"] = "Waiting for Artisan Confirmations"

    store.save()
    return cluster

@router.post("/{cluster_id}/decline")
async def decline_cluster_invitation(cluster_id: str, artisan_id: int = Query(...)):
    """
    KEY INNOVATION:
    When an artisan declines, AI automatically finds a suitable replacement
    instead of failing the entire order.
    """
    if cluster_id not in store.clusters:
        raise HTTPException(status_code=404, detail="Cluster not found")
    cluster = store.clusters[cluster_id]
    declined_member = next((item for item in cluster["members"] if item["id"] == artisan_id), None)
    if not declined_member:
        raise HTTPException(status_code=404, detail="Artisan is not part of this cluster")

    declined_name = declined_member["name"]
    needed_qty = declined_member["assigned_quantity"]
    target_craft = cluster.get("category", "Bamboo Crafts")
    buyer_id = cluster.get("buyer_id", "buyer-demo")

    # Notify buyer of decline
    notification_service.notify_artisan_declined(
        buyer_id=buyer_id,
        artisan_name=declined_name,
        cluster_id=cluster_id
    )

    # Search for replacement candidate in the pool who is NOT currently in the cluster
    existing_ids = {m["id"] for m in cluster["members"] if m.get("status") != "Declined"}
    candidates = [
        a for a in ARTISANS_POOL
        if a["craft"] == target_craft and a["id"] not in existing_ids and a["available"]
    ]
    if not candidates:
        candidates = [a for a in ARTISANS_POOL if a["id"] not in existing_ids and a["available"]]

    replacement_artisan = None
    if candidates:
        # Sort candidates by reliability and rating
        candidates.sort(key=lambda a: (-a.get("reliability", 90), -a["rating"]))
        replacement_artisan = candidates[0]

    if replacement_artisan:
        # Create replacement member
        new_member = {
            "id": replacement_artisan["id"],
            "name": replacement_artisan["name"],
            "craft": replacement_artisan["craft"],
            "location": replacement_artisan["location"],
            "capacity": replacement_artisan["capacity"],
            "price": replacement_artisan["price"],
            "rating": replacement_artisan["rating"],
            "verified": replacement_artisan["verified"],
            "reliability": replacement_artisan.get("reliability", 97),
            "lead_days": replacement_artisan.get("lead_days", cluster.get("delivery_days", 14)),
            "assigned_quantity": needed_qty,
            "earnings": needed_qty * replacement_artisan["price"],
            "produced_quantity": 0,
            "status": "Accepted",  # Auto-matched backup accepted
            "match_score": 96,
            "deadline": cluster.get("delivery_date", str(date.today() + timedelta(days=14))),
            "contribution_pct": round((needed_qty / cluster["required_quantity"]) * 100, 1),
            "is_replacement": True,
            "replaced_from": declined_name
        }

        # Log replacement event
        replacement_event = {
            "replaced_artisan_id": artisan_id,
            "replaced_artisan_name": declined_name,
            "replacement_artisan_id": replacement_artisan["id"],
            "replacement_artisan_name": replacement_artisan["name"],
            "quantity": needed_qty,
            "reason": f"Artisan {declined_name} was unavailable; AI automatically secured {replacement_artisan['name']} to guarantee order continuity.",
            "timestamp": str(date.today())
        }
        if "replacement_history" not in cluster:
            cluster["replacement_history"] = []
        cluster["replacement_history"].append(replacement_event)

        # Replace declined member in the active members list
        idx = cluster["members"].index(declined_member)
        cluster["members"][idx] = new_member

        # Recalculate totals
        cluster["total_allocated"] = sum(m["assigned_quantity"] for m in cluster["members"])
        cluster["estimated_total_cost"] = sum(m["earnings"] for m in cluster["members"])
        accepted_qty = sum(m["assigned_quantity"] for m in cluster["members"] if m["status"] == "Accepted")
        cluster["accepted_quantity"] = accepted_qty

        if accepted_qty >= cluster["required_quantity"]:
            cluster["status"] = "Cluster Formed & Confirmed"
        else:
            cluster["status"] = "Waiting for Artisan Confirmations"

        # Dispatch real notification
        notification_service.notify_artisan_replaced(
            buyer_id=buyer_id,
            original_name=declined_name,
            replacement_name=replacement_artisan["name"],
            quantity=needed_qty,
            cluster_id=cluster_id
        )
    else:
        # Fallback if no backup artisan exists
        declined_member["status"] = "Declined"
        cluster["status"] = "Artisan Replacement Needed"

    store.save()
    return cluster

@router.post("/{cluster_id}/convert-to-order")
async def convert_cluster_to_order(cluster_id: str):
    """
    Turns the confirmed cluster into ONE unified Buyer Order.
    The buyer sees ONE order and ONE progress tracker.
    Each artisan sees only their assigned portion.
    """
    if cluster_id not in store.clusters:
        raise HTTPException(status_code=404, detail="Cluster not found")
    cluster = store.clusters[cluster_id]

    order_id = f"KM-ORD-{cluster_id[-6:].upper()}"
    today_str = date.today().strftime("%d %b %Y")
    expected_str = cluster.get("delivery_date", (date.today() + timedelta(days=14)).strftime("%d %b %Y"))

    order_members = [
        {
            "artisan_id": m["id"],
            "name": m["name"],
            "location": m["location"],
            "assigned": m["assigned_quantity"],
            "completed": 0,
            "earnings": m["earnings"],
            "deadline": m["deadline"],
            "status": "In Production"
        }
        for m in cluster["members"]
    ]

    total_amount = cluster.get("estimated_total_cost", 0)

    unified_order = {
        "id": order_id,
        "product": cluster["product"],
        "category": cluster["category"],
        "quantity": cluster["required_quantity"],
        "buyer": cluster.get("buyer_id", "Corporate Buyer"),
        "order_date": today_str,
        "expected_delivery": expected_str,
        "total_amount": total_amount,
        "status": "Production Started",
        "payment_status": "Paid",
        "cluster": True,
        "cluster_id": cluster_id,
        "members": order_members,
        "shipment": {
            "tracking_number": f"KM-SHIP-{uuid4().hex[:5].upper()}",
            "carrier": "KALA-MITRA Collective Logistics",
            "current_location": f"{cluster.get('location', 'East Godavari')} Hub",
            "status": "Production Started",
            "estimated_delivery": expected_str
        },
        "timeline": [
            "Order Placed",
            "Artisan Cluster Formed",
            "Production Started"
        ]
    }

    store.orders[order_id] = unified_order
    cluster["status"] = "Production Started"
    cluster["order_id"] = order_id
    store.save()

    notification_service.notify_order_created(
        buyer_id=cluster.get("buyer_id", "buyer-demo"),
        order_id=order_id,
        product_name=cluster["product"],
        quantity=cluster["required_quantity"]
    )

    return unified_order

@router.put("/{cluster_id}/production")
async def update_cluster_production(cluster_id: str, update: ProductionUpdate):
    """Updates production progress for an artisan in the cluster."""
    if cluster_id not in store.clusters:
        raise HTTPException(status_code=404, detail="Cluster not found")
    cluster = store.clusters[cluster_id]
    member = next((item for item in cluster["members"] if item["id"] == update.artisan_id), None)
    if not member:
        raise HTTPException(status_code=404, detail="Artisan is not part of this cluster")

    member["produced_quantity"] = min(update.produced_quantity, member["assigned_quantity"])
    member["status"] = "Completed" if member["produced_quantity"] == member["assigned_quantity"] else "Production in Progress"
    produced = sum(item.get("produced_quantity", 0) for item in cluster["members"])
    cluster["produced_quantity"] = produced
    cluster["status"] = "Completed" if produced >= cluster["required_quantity"] else "Production in Progress"

    # Synchronize with unified order if present
    order_id = cluster.get("order_id")
    if order_id and order_id in store.orders:
        order = store.orders[order_id]
        order_member = next((m for m in order.get("members", []) if m["artisan_id"] == update.artisan_id), None)
        if order_member:
            order_member["completed"] = member["produced_quantity"]
            order_member["status"] = member["status"]
        if cluster["status"] == "Completed":
            order["status"] = "Quality Check"

    store.save()
    return cluster

@router.get("/{cluster_id}/progress")
async def cluster_progress(cluster_id: str):
    """Retrieves live cluster production progress metrics."""
    if cluster_id not in store.clusters:
        raise HTTPException(status_code=404, detail="Cluster not found")
    cluster = store.clusters[cluster_id]
    produced = sum(item.get("produced_quantity", 0) for item in cluster["members"])
    return {
        "cluster_id": cluster_id,
        "status": cluster.get("status"),
        "produced": produced,
        "required": cluster["required_quantity"],
        "percentage": round(produced / cluster["required_quantity"] * 100) if cluster["required_quantity"] else 0,
        "members": cluster["members"],
        "replacement_history": cluster.get("replacement_history", [])
    }
