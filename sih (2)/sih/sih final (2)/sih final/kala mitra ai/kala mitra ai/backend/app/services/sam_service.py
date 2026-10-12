"""
KALA-MITRA SAM (Segment Anything Model) Service
Isolates the craft item from background clutter using SAM or safe fallback segmentation.
"""

import os
from typing import Optional, Tuple
from PIL import Image
from ..schemas.catalog import DetectionBox
from ..config import settings
from .vision_service import vision_service

class SAMService:
    def __init__(self):
        self._sam_predictor = None
        self._is_available = False
        self._init_error = None
        self._load_model()

    def _load_model(self):
        """Attempts to load SAM predictor safely."""
        try:
            import torch
            from segment_anything import sam_model_registry, SamPredictor
            if os.path.exists(settings.SAM_CHECKPOINT_PATH):
                device = "cuda" if torch.cuda.is_available() else "cpu"
                sam = sam_model_registry[settings.SAM_MODEL_TYPE](checkpoint=settings.SAM_CHECKPOINT_PATH)
                sam.to(device=device)
                self._sam_predictor = SamPredictor(sam)
                self._is_available = True
            else:
                self._init_error = f"SAM checkpoint not found at '{settings.SAM_CHECKPOINT_PATH}'."
        except ImportError:
            self._init_error = "segment_anything / PyTorch not installed in current environment."
        except Exception as e:
            self._init_error = f"Failed to initialize SAM: {str(e)}"

    def segment_product(self, image: Image.Image, box: Optional[DetectionBox]) -> Tuple[Optional[str], Optional[str]]:
        """
        Segments the craft product using bounding box prompt.
        Returns (base64_segmented_png, warning_message).
        """
        if self._is_available and self._sam_predictor and box:
            try:
                import numpy as np
                image_np = np.array(image.convert("RGB"))
                self._sam_predictor.set_image(image_np)
                input_box = np.array([box.x_min, box.y_min, box.x_max, box.y_max])
                masks, scores, _ = self._sam_predictor.predict(
                    box=input_box[None, :],
                    multimask_output=False
                )
                if masks is not None and len(masks) > 0:
                    mask = masks[0]
                    # Apply alpha mask
                    rgba = image.convert("RGBA")
                    alpha = Image.fromarray((mask * 255).astype(np.uint8))
                    rgba.putalpha(alpha)
                    return vision_service.image_to_base64(rgba, format="PNG"), None
            except Exception as e:
                return None, f"SAM segmentation error: {str(e)}"

        # Non-breaking fallback: crop bounding box or use clean preview
        if box:
            w, h = image.size
            crop_box = (
                max(0, int(box.x_min)),
                max(0, int(box.y_min)),
                min(w, int(box.x_max)),
                min(h, int(box.y_max))
            )
            cropped = image.crop(crop_box)
            segmented_b64 = vision_service.image_to_base64(cropped, format="JPEG")
            warning = (
                f"Notice: SAM running in development crop mode ({self._init_error or 'Checkpoint pending'}). "
                "Checkpoints can be placed at 'backend/models/sam_vit_b_01ec64.pth'."
            )
            return segmented_b64, warning

        return None, "Segmentation skipped: No bounding box available."

sam_service = SAMService()
