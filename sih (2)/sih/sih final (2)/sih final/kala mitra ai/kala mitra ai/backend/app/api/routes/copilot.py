"""
KALA-MITRA Copilot Router
Endpoint: POST /api/v1/copilot/chat
"""

from fastapi import APIRouter, Body
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from ...services.copilot_service import copilot_service

router = APIRouter(prefix="/copilot", tags=["Copilot"])

class ChatRequest(BaseModel):
    query: str
    history: Optional[List[Dict[str, str]]] = None
    artisan_context: Optional[Dict[str, Any]] = None
    language: str = "en"
    mode: str = "text"

class ChatResponse(BaseModel):
    response: str
    source: str
    tools_available: List[str]
    language: str
    action: Optional[str] = None

@router.post("/chat", response_model=ChatResponse)
async def chat_with_copilot(payload: ChatRequest):
    """
    Processes query for the artisan assistant.
    Returns domain-specific guidance on pricing, bulk orders, cluster capacity, and cataloging.
    """
    result = await copilot_service.generate_response(
        query=payload.query,
        history=payload.history,
        artisan_context=payload.artisan_context
        ,language=payload.language
    )
    return ChatResponse(
        response=result["response"],
        source=result["source"],
        tools_available=result["tools_available"]
        ,language=payload.language
        ,action=result.get("action")
    )
