"""
Unit Tests for KALA-MITRA AI Cataloging Service
"""

import io
from PIL import Image
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def create_test_image_bytes():
    image = Image.new("RGB", (200, 200), color=(180, 100, 50))
    buf = io.BytesIO()
    image.save(buf, format="JPEG")
    return buf.getvalue()

def test_health():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_catalog_analyze_endpoint():
    img_bytes = create_test_image_bytes()
    files = {"file": ("test_basket.jpg", img_bytes, "image/jpeg")}
    data = {
        "category_hint": "Bamboo Crafts",
        "material_hint": "Natural Bamboo",
        "location": "East Godavari, AP"
    }
    
    response = client.post("/api/v1/catalog/analyze", files=files, data=data)
    assert response.status_code == 200
    res = response.json()
    assert "detectedProduct" in res
    assert "title" in res
    assert res["category"] == "Bamboo Crafts"
    assert res["material"] == "Natural Bamboo"
    assert len(res["tags"]) > 0
    assert "pipelineSteps" in res
    assert len(res["pipelineSteps"]) >= 4

def test_catalog_analyze_invalid_file():
    files = {"file": ("document.txt", b"not an image", "text/plain")}
    response = client.post("/api/v1/catalog/analyze", files=files)
    assert response.status_code == 400
