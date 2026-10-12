"""
KALA-MITRA Authentication & OTP API Router
Handles dispatching and verifying real 6-digit OTPs via Email and Mobile SMS.
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from ...services.otp_service import otp_service

router = APIRouter(prefix="/auth", tags=["Authentication & OTP"])

class SendOTPRequest(BaseModel):
    identifier: str = Field(..., description="Phone number (+91...) or Email address")
    type: str = Field("phone", description="Type of verification: 'phone' or 'email'")
    role: str = Field("Artisan", description="User role: 'Artisan' or 'Buyer'")

class SendOTPResponse(BaseModel):
    success: bool
    identifier: str
    type: str
    message: str
    delivery_status: str

class VerifyOTPRequest(BaseModel):
    identifier: str = Field(..., description="Phone number or Email address")
    otp: str = Field(..., description="6-digit verification code")

class VerifyOTPResponse(BaseModel):
    success: bool
    message: str

@router.post("/send-otp", response_model=SendOTPResponse, status_code=status.HTTP_200_OK)
async def send_otp(req: SendOTPRequest):
    """
    Request a real 6-digit verification OTP sent to an Email address or Mobile Phone.
    """
    if not req.identifier or not req.identifier.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide a valid phone number or email address."
        )

    res = await otp_service.send_otp(
        identifier=req.identifier,
        otp_type=req.type,
        role=req.role
    )
    return res

@router.post("/verify-otp", response_model=VerifyOTPResponse, status_code=status.HTTP_200_OK)
async def verify_otp(req: VerifyOTPRequest):
    """
    Verify the 6-digit OTP code entered by the user.
    """
    if not req.identifier or not req.otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Identifier and 6-digit OTP code are required."
        )

    is_valid, msg = await otp_service.verify_otp(
        identifier=req.identifier,
        code=req.otp
    )

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=msg
        )

    return {"success": True, "message": msg}
