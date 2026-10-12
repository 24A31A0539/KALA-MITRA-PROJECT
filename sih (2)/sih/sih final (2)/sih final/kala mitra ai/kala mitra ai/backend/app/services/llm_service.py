"""
KALA-MITRA LLM Catalog Understanding & Text Generation Service
Generates structured catalog titles, categories, descriptions, and tags from vision features and artisan hints.
Supports Ollama, local OpenAI-compatible endpoints, and graceful structured fallback.
"""

import json
import httpx
from typing import Dict, Any, Tuple
from ..schemas.catalog import ArtisanContext, DetectionBox
from ..config import settings

VALID_CATEGORIES = [
    "Bamboo Crafts",
    "Pottery",
    "Handloom & Weaving",
    "Textiles",
    "Wood Crafts",
    "Metal Crafts",
    "Jewelry",
    "Home Decor",
    "Traditional Art",
    "Other"
]

class LLMService:
    def __init__(self):
        self.base_url = settings.OLLAMA_BASE_URL
        self.model = settings.OLLAMA_MODEL

    async def generate_catalog_fields(
        self,
        box: DetectionBox,
        context: ArtisanContext,
        image_summary: str = "Handicraft item"
    ) -> Tuple[Dict[str, Any], str]:
        """
        Generates structured catalog fields using Ollama or structured heuristic engine.
        Returns (data_dict, provider_status_or_warning).
        """
        # Try Ollama endpoint if available
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                prompt = self._build_prompt(box, context, image_summary)
                response = await client.post(
                    f"{self.base_url}/api/generate",
                    json={
                        "model": self.model,
                        "prompt": prompt,
                        "format": "json",
                        "stream": False
                    }
                )
                if response.status_code == 200:
                    res_json = response.json()
                    raw_text = res_json.get("response", "{}")
                    parsed = json.loads(raw_text)
                    if self._validate_llm_json(parsed):
                        return parsed, "Generated via local Ollama LLM service."
        except Exception:
            # Fallback when Ollama service is not running locally
            pass

        # Robust, domain-aware structured heuristic catalog generator
        fallback_data = self._generate_structured_fallback(box, context)
        warning = (
            "Notice: Catalog text synthesized using KALA-MITRA Craft Knowledge Base "
            "(Ollama service offline or not reached at localhost:11434). "
            "Please review all fields before publishing."
        )
        return fallback_data, warning

    def _build_prompt(self, box: DetectionBox, context: ArtisanContext, image_summary: str) -> str:
        return f"""
You are an expert catalog assistant for Indian traditional artisans on KALA-MITRA.
Generate structured JSON for a product listing based ONLY on provided details.

Context:
- Detected object: {box.label} (confidence: {box.confidence})
- Artisan category hint: {context.category_hint or 'None'}
- Artisan material hint: {context.material_hint or 'None'}
- Location: {context.location or 'India'}
- Additional notes: {context.notes or 'None'}

Valid Categories: {', '.join(VALID_CATEGORIES)}

Respond with valid JSON ONLY in this format:
{{
  "title": "Clean, descriptive product title",
  "category": "Must be one from Valid Categories",
  "material": "Specific craft material or 'Material needs artisan confirmation'",
  "description": "Rich 2-3 sentence product narrative focusing on utility, heritage technique, and aesthetics",
  "tags": ["Tag1", "Tag2", "Tag3", "Tag4"]
}}
"""

    def _validate_llm_json(self, data: Dict[str, Any]) -> bool:
        required = ["title", "category", "material", "description", "tags"]
        return all(k in data for k in required) and isinstance(data["tags"], list)

    def _generate_structured_fallback(self, box: DetectionBox, context: ArtisanContext) -> Dict[str, Any]:
        """Synthesizes high quality, accurate craft metadata when LLM daemon is offline."""
        detected = box.label.lower()
        hint_cat = (context.category_hint or "").strip()
        hint_mat = (context.material_hint or "").strip()
        loc = (context.location or "India").strip()

        # Determine Category
        category = "Home Decor"
        if hint_cat in VALID_CATEGORIES:
            category = hint_cat
        elif "bamboo" in detected or "basket" in detected or "cane" in detected:
            category = "Bamboo Crafts"
        elif "pot" in detected or "clay" in detected or "vase" in detected or "earthen" in detected:
            category = "Pottery"
        elif "stole" in detected or "saree" in detected or "shawl" in detected or "fabric" in detected:
            category = "Textiles"
        elif "wood" in detected or "carv" in detected:
            category = "Wood Crafts"
        elif "brass" in detected or "metal" in detected or "bell" in detected:
            category = "Metal Crafts"

        # Determine Material
        if hint_mat:
            material = hint_mat
        elif category == "Bamboo Crafts":
            material = "Natural Seasoned Bamboo & Cane"
        elif category == "Pottery":
            material = "Natural Earthen Clay & Mineral Glaze"
        elif category == "Textiles":
            material = "Handloom Organic Cotton / Silk"
        elif category == "Wood Crafts":
            material = "Seasoned Sheesham / Teak Wood"
        elif category == "Metal Crafts":
            material = "Handcast Brass & Bell Metal"
        else:
            material = "Material needs artisan confirmation"

        # Determine Title
        if category == "Bamboo Crafts":
            title = "Handwoven Bamboo Utility & Decor Basket"
            description = (
                f"Carefully handwoven using sustainably sourced natural cane and bamboo from {loc}. "
                "Lightweight, durable, and crafted for storage, organizing, and eco-friendly home decor."
            )
            tags = ["Bamboo", "Handmade", "Eco-friendly", "Home Decor", "Storage"]
        elif category == "Pottery":
            title = "Handcrafted Terracotta Earthen Planter Pot"
            description = (
                f"Traditional wheel-thrown pottery fired with authentic wood-kiln techniques in {loc}. "
                "Features organic mineral tones, ideal for living spaces, gardens, and gifting."
            )
            tags = ["Pottery", "Terracotta", "Clay", "Handcrafted", "Home Decor"]
        elif category == "Textiles":
            title = "Handloom Woven Artisan Stole"
            description = (
                f"Finely woven by master handloom weavers in {loc} using natural fibers. "
                "Breathable, comfortable texture with classic ethnic weave motifs."
            )
            tags = ["Handloom", "Textiles", "Ethnic", "Cotton", "Artisan Weave"]
        elif category == "Metal Crafts":
            title = "Hand-Cast Traditional Brass Craft Artifact"
            description = (
                f"Hand-carved and cast using age-old metalworking traditions in {loc}. "
                "Features intricate detailing and a durable burnished finish."
            )
            tags = ["Metal Craft", "Brass", "Handcast", "Traditional", "Decor"]
        else:
            title = f"Handcrafted {box.label.title()}"
            description = (
                f"Authentic handicraft piece created by local artisans in {loc}. "
                "Showcases regional artisanal heritage and fine manual craftsmanship."
            )
            tags = ["Handicraft", "Handmade", "Artisan Craft", "Indian Heritage"]

        return {
            "title": title,
            "category": category,
            "material": material,
            "description": description,
            "tags": tags
        }

llm_service = LLMService()
