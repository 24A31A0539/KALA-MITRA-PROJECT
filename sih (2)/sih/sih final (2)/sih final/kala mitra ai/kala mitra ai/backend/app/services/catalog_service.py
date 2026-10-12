"""
KALA-MITRA AI Cataloging Pipeline Orchestrator
Coordinates:
Image Preprocessing -> YOLOv8 Detection -> SAM Segmentation -> LLM Catalog Understanding -> Pydantic Validation
"""

import time
from typing import Optional
from ..schemas.catalog import (
    CatalogAnalysisResponse,
    ArtisanContext,
    PipelineStepResult
)
from .vision_service import vision_service
from .yolo_service import yolo_service
from .sam_service import sam_service
from .llm_service import llm_service

class CatalogService:
    async def analyze_product_image(
        self,
        image_bytes: bytes,
        mime_type: str,
        context: Optional[ArtisanContext] = None
    ) -> CatalogAnalysisResponse:
        """
        Executes end-to-end AI vision + LLM catalog pipeline.
        Never throws unhandled exceptions that break the artisan workflow.
        """
        if context is None:
            context = ArtisanContext()

        pipeline_steps = []
        warnings = []
        start_time = time.time()

        # Step 1: Image Validation & Preprocessing
        t0 = time.time()
        try:
            image, val_warn = vision_service.validate_and_decode_image(image_bytes, mime_type)
            if val_warn:
                warnings.append(val_warn)
            pipeline_steps.append(PipelineStepResult(
                step="Image Preprocessing",
                status="success",
                message=f"Image decoded and normalized ({image.size[0]}x{image.size[1]}px).",
                execution_ms=round((time.time() - t0) * 1000, 1)
            ))
        except Exception as e:
            pipeline_steps.append(PipelineStepResult(
                step="Image Preprocessing",
                status="error",
                message=f"Image decoding failed: {str(e)}",
                execution_ms=round((time.time() - t0) * 1000, 1)
            ))
            raise e

        # Step 2: YOLOv8 Object Detection
        t0 = time.time()
        box, yolo_warn = yolo_service.detect_craft_object(image)
        if yolo_warn:
            warnings.append(yolo_warn)
        pipeline_steps.append(PipelineStepResult(
            step="YOLOv8 Detection",
            status="success" if not yolo_warn else "fallback",
            message=f"Detected primary object '{box.label}' (confidence: {box.confidence:.2f}).",
            execution_ms=round((time.time() - t0) * 1000, 1),
            details={"label": box.label, "confidence": box.confidence}
        ))

        # Step 3: SAM Segmentation
        t0 = time.time()
        segmented_b64, sam_warn = sam_service.segment_product(image, box)
        if sam_warn:
            warnings.append(sam_warn)
        pipeline_steps.append(PipelineStepResult(
            step="SAM Segmentation",
            status="success" if not sam_warn else "fallback",
            message="Craft product isolated from background." if segmented_b64 else "Segmentation skipped.",
            execution_ms=round((time.time() - t0) * 1000, 1)
        ))

        # Step 4: LLM Product Understanding & Narrative Generation
        t0 = time.time()
        llm_data, llm_warn = await llm_service.generate_catalog_fields(box, context)
        if llm_warn:
            warnings.append(llm_warn)
        pipeline_steps.append(PipelineStepResult(
            step="LLM Understanding",
            status="success" if not llm_warn else "fallback",
            message="Catalog title, category, description, and tags generated.",
            execution_ms=round((time.time() - t0) * 1000, 1)
        ))

        # Determine Material Confidence
        material_val = llm_data.get("material", "Material needs artisan confirmation")
        material_conf = 1.0 if context.material_hint else (0.85 if "needs artisan confirmation" not in material_val else 0.4)

        # Price Handling: Do not invent AI market prices randomly
        price_note = (
            "Price specified by artisan." if context.price_hint
            else "Price suggestion will be available after market intelligence is connected."
        )

        overall_status = "success" if not warnings else "fallback"

        return CatalogAnalysisResponse(
            detectedProduct=box.label,
            detectionConfidence=box.confidence,
            boundingBox=box,
            title=llm_data.get("title", f"Handcrafted {box.label}"),
            category=llm_data.get("category", context.category_hint or "Home Decor"),
            material=material_val,
            materialConfidence=material_conf,
            description=llm_data.get("description", "Handcrafted authentic craft piece."),
            tags=llm_data.get("tags", ["Handicraft", "Artisan"]),
            suggestedPrice=context.price_hint or None,
            priceNote=price_note,
            suggestedLeadDays=7,
            segmentedImageBase64=segmented_b64,
            processingStatus=overall_status,
            pipelineSteps=pipeline_steps,
            warnings=warnings,
            modelVersions={
                "yolo": "yolov8n",
                "sam": "sam_vit_b",
                "llm": "ollama/llama3.2-vision (with craft heuristic fallback)",
                "pipeline": "1.0.0"
            }
        )

catalog_service = CatalogService()
