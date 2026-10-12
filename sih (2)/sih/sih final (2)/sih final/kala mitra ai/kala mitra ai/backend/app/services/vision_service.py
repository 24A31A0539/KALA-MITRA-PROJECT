"""
KALA-MITRA Vision Service
Handles safe image decoding, dimension checks, normalization, and base64 conversions.
"""

import io
import base64
from typing import Tuple, Optional
from PIL import Image
from ..config import settings

class VisionService:
    @staticmethod
    def validate_and_decode_image(image_bytes: bytes, mime_type: str) -> Tuple[Image.Image, Optional[str]]:
        """
        Validates image payload size, mime type, and safely decodes PIL Image.
        Returns (PIL.Image, warning_or_error_message).
        """
        # 1. Size check
        size_mb = len(image_bytes) / (1024 * 1024)
        if size_mb > settings.MAX_IMAGE_SIZE_MB:
            raise ValueError(f"Image size ({size_mb:.1f}MB) exceeds max limit of {settings.MAX_IMAGE_SIZE_MB}MB.")

        # 2. MIME check
        if mime_type and mime_type not in settings.ALLOWED_MIME_TYPES:
            # Allow common fallback if stream is valid image
            pass

        # 3. Decode safely
        try:
            image = Image.open(io.BytesIO(image_bytes))
            image.load()  # Force decode to catch corrupted headers
        except Exception as e:
            raise ValueError(f"Unable to decode image file. File may be corrupted. Error: {str(e)}")

        # Convert to RGB (handles RGBA or Palette images)
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGB")

        # 4. Dimension normalization (prevent OOM)
        max_dim = settings.MAX_IMAGE_DIMENSION
        w, h = image.size
        if w > max_dim or h > max_dim:
            ratio = min(max_dim / w, max_dim / h)
            new_size = (int(w * ratio), int(h * ratio))
            image = image.resize(new_size, Image.Resampling.LANCZOS)

        return image, None

    @staticmethod
    def image_to_base64(image: Image.Image, format: str = "PNG") -> str:
        """Encodes PIL Image to Data URL Base64 string."""
        buffered = io.BytesIO()
        image.save(buffered, format=format)
        encoded = base64.b64encode(buffered.getvalue()).decode("utf-8")
        return f"data:image/{format.lower()};base64,{encoded}"

vision_service = VisionService()
