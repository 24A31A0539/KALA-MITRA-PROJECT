"""
KALA-MITRA Users & Profiles Router
Handles profile creation, retrieval, and updates for both Buyers and Artisans.
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field
from ...services.store import store

router = APIRouter(prefix="/users", tags=["Users"])

class UserProfileSchema(BaseModel):
    id: Optional[str] = "buyer-demo"
    role: str = "Buyer"
    name: str
    business_type: Optional[str] = ""
    craft_type: Optional[str] = ""
    location: str
    preferred_language: str = "English"
    phone: Optional[str] = ""
    email: Optional[str] = ""
    is_profile_complete: bool = True

@router.post("/profile", response_model=UserProfileSchema, status_code=status.HTTP_200_OK)
async def save_profile(profile: UserProfileSchema):
    """Save or update user profile."""
    user_id = profile.id or "buyer-demo"
    profile_data = profile.dict()
    profile_data["id"] = user_id
    store.users[user_id] = profile_data
    store.save()
    return profile_data

@router.get("/profile", response_model=UserProfileSchema)
async def get_profile(user_id: str = Query("buyer-demo")):
    """Get user profile by user_id."""
    user = store.users.get(user_id)
    if not user:
        # Default fallback demo profile
        return {
            "id": user_id,
            "role": "Buyer" if "buyer" in user_id else "Artisan",
            "name": "GreenLeaf Hotels" if "buyer" in user_id else "Lakshmi Devi",
            "business_type": "Hospitality Chain" if "buyer" in user_id else "",
            "craft_type": "" if "buyer" in user_id else "Bamboo Handicrafts",
            "location": "East Godavari, Andhra Pradesh",
            "preferred_language": "English",
            "phone": "+91 98765 43210",
            "email": "buyer@example.com",
            "is_profile_complete": True
        }
    return user
