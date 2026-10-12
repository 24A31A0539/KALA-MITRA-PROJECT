"""
KALA-MITRA AI Catalog API Routes
Provides the POST /api/v1/catalog/analyze endpoint for artisan mobile/web apps.
"""

from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status
from ...schemas.catalog import CatalogAnalysisResponse, ArtisanContext
from ...services.catalog_service import catalog_service

router = APIRouter(prefix="/catalog", tags=["AI Cataloging"])

@router.post(
    "/analyze",
    response_model=CatalogAnalysisResponse,
    summary="Analyze craft photo and generate structured product catalog",
    description="Takes an uploaded craft photo, runs YOLOv8 detection, SAM segmentation, and LLM understanding."
)
async def analyze_craft_photo(
    file: UploadFile = File(..., description="Uploaded craft image (JPG, PNG, WebP)"),
    category_hint: Optional[str] = Form(None, description="Optional craft category hint"),
    material_hint: Optional[str] = Form(None, description="Optional raw material hint"),
    price_hint: Optional[float] = Form(None, description="Optional artisan expected price"),
    location: Optional[str] = Form(None, description="Artisan craft location (e.g. East Godavari, AP)"),
    notes: Optional[str] = Form(None, description="Additional artisan notes")
):
    # 1. Content validation
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must be a valid image (JPEG, PNG, WebP)."
        )

    # 2. Read bytes
    try:
        image_bytes = await file.read()
        if len(image_bytes) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty."
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read image payload: {str(e)}"
        )

    # 3. Construct Artisan Context
    context = ArtisanContext(
        category_hint=category_hint,
        material_hint=material_hint,
        price_hint=price_hint,
        location=location,
        notes=notes
    )

    # 4. Run AI Pipeline
    try:
        response = await catalog_service.analyze_product_image(
            image_bytes=image_bytes,
            mime_type=file.content_type,
            context=context
        )
        return response
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI Vision Catalog pipeline encountered an error: {str(e)}"
        )
