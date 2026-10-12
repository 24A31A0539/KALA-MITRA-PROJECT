"""
KALA-MITRA Pydantic Schemas for AI Cataloging Pipeline
Defines strict input context and structured output schemas for FastAPI.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class ArtisanContext(BaseModel):
    category_hint: Optional[str] = Field(None, description="Optional craft category provided by artisan")
    material_hint: Optional[str] = Field(None, description="Optional raw material hint provided by artisan")
    price_hint: Optional[float] = Field(None, description="Artisan's expected price if known")
    location: Optional[str] = Field(None, description="Artisan craft location (e.g. East Godavari, AP)")
    notes: Optional[str] = Field(None, description="Any additional context provided by artisan")

class PipelineStepResult(BaseModel):
    step: str
    status: str  # "success", "fallback", "skipped", "error"
    message: str
    execution_ms: Optional[float] = None
    details: Optional[Dict[str, Any]] = None

class DetectionBox(BaseModel):
    x_min: float
    y_min: float
    x_max: float
    y_max: float
    label: str
    confidence: float

class CatalogAnalysisResponse(BaseModel):
    # Detection info
    detectedProduct: str = Field(..., description="Name of the detected product object")
    detectionConfidence: float = Field(..., description="YOLO detection confidence score (0.0 to 1.0)")
    boundingBox: Optional[DetectionBox] = Field(None, description="Primary bounding box coordinates")
    
    # Generated Catalog Fields
    title: str = Field(..., description="Suggested product title")
    category: str = Field(..., description="Classified craft category")
    material: str = Field(..., description="Identified or prompted craft material")
    materialConfidence: float = Field(1.0, description="Confidence in material assessment")
    description: str = Field(..., description="Rich narrative craft description")
    tags: List[str] = Field(default_factory=list, description="Relevant search & indexing tags")
    
    # Pricing & Production (Respects artisan context or marks for confirmation)
    suggestedPrice: Optional[float] = Field(None, description="Artisan price or market baseline")
    priceNote: Optional[str] = Field(None, description="Note regarding price estimation status")
    suggestedLeadDays: Optional[int] = Field(7, description="Estimated production days per batch")
    
    # Image outputs
    segmentedImageBase64: Optional[str] = Field(None, description="SAM background-removed PNG in base64 if available")
    
    # Execution metadata & honest disclosures
    processingStatus: str = Field("success", description="Overall processing status: success, partial, or fallback")
    pipelineSteps: List[PipelineStepResult] = Field(default_factory=list, description="Step-by-step pipeline trace")
    warnings: List[str] = Field(default_factory=list, description="Any uncertainty or model limitation disclosures")
    modelVersions: Dict[str, str] = Field(default_factory=dict, description="Versions of models used in inference")
