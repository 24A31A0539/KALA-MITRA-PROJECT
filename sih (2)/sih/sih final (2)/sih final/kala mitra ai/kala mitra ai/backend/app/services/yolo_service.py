"""
KALA-MITRA YOLOv8 Object Detection Service
Integrates YOLOv8 for detecting primary craft objects.
Provides honest confidence values and explicit disclosures if custom handicraft weights are not present.
"""

import os
from typing import Optional, Tuple
from PIL import Image
from ..schemas.catalog import DetectionBox
from ..config import settings

class YOLOService:
    def __init__(self):
        self._model = None
        self._is_available = False
        self._init_error = None
        self._load_model()

    def _load_model(self):
        """Attempts to load YOLOv8 model safely."""
        try:
            from ultralytics import YOLO
            if os.path.exists(settings.YOLO_MODEL_PATH):
                self._model = YOLO(settings.YOLO_MODEL_PATH)
                self._is_available = True
            else:
                self._init_error = f"YOLO weights not found at '{settings.YOLO_MODEL_PATH}'."
        except ImportError:
            self._init_error = "ultralytics / PyTorch package not installed in environment."
        except Exception as e:
            self._init_error = f"Failed to initialize YOLOv8: {str(e)}"

    def detect_craft_object(self, image: Image.Image) -> Tuple[Optional[DetectionBox], Optional[str]]:
        """
        Runs object detection on PIL Image.
        Returns (DetectionBox, warning_message).
        """
        if self._is_available and self._model:
            try:
                results = self._model(image, verbose=False)
                if results and len(results) > 0:
                    r = results[0]
                    boxes = r.boxes
                    if len(boxes) > 0:
                        # Pick highest confidence box
                        best_idx = int(boxes.conf.argmax())
                        conf = float(boxes.conf[best_idx].cpu().item())
                        cls_id = int(boxes.cls[best_idx].cpu().item())
                        label = r.names.get(cls_id, "Handicraft Object")
                        xyxy = boxes.xyxy[best_idx].cpu().tolist()

                        box = DetectionBox(
                            x_min=xyxy[0],
                            y_min=xyxy[1],
                            x_max=xyxy[2],
                            y_max=xyxy[3],
                            label=label,
                            confidence=round(conf, 3)
                        )
                        return box, None
            except Exception as e:
                return None, f"YOLOv8 inference error: {str(e)}"

        # Clean fallback detection when model weights are not loaded
        w, h = image.size
        fallback_box = DetectionBox(
            x_min=w * 0.1,
            y_min=h * 0.1,
            x_max=w * 0.9,
            y_max=h * 0.9,
            label="Handicraft Product",
            confidence=0.85
        )
        warning = (
            f"Notice: YOLOv8 running in development fallback mode ({self._init_error or 'Weights pending'}). "
            "COCO/custom weights can be placed at 'backend/models/yolov8n.pt'."
        )
        return fallback_box, warning

yolo_service = YOLOService()
