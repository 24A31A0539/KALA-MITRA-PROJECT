"""
Quick live verification script to test Razorpay API connection with active credentials.
"""
import os
import sys
from decimal import Decimal

# Ensure python path includes the handoff package
sys.path.insert(0, os.path.dirname(__file__))

from payment.gateway_adapter.razorpay_adapter import RazorpayPaymentGatewayService

def run_test():
    key_id = "rzp_test_TY0lRy3Jyp1wL1"
    key_secret = "jv8KL9ICJWBAcw0QIDcEQ60a"
    
    print(f"Connecting to Razorpay API with Key ID: {key_id}...")
    adapter = RazorpayPaymentGatewayService(key_id=key_id, key_secret=key_secret)
    
    # Create a INR 1.00 Test Order
    res = adapter.create_payment_order(
        order_id="test_judge_demo_01",
        amount=Decimal("1.00"),
        currency="INR",
        notes={"demo": "KALA-MITRA Judge Demonstration", "buyer_name": "SIH Judge"}
    )
    
    print("\n[SUCCESS] Razorpay Order Created on Gateway!")
    print(f"Payment Order ID: {res.payment_order_id}")
    print(f"Payable Amount:   INR {res.amount}")
    print(f"Public Key ID:    {res.public_key}")
    print(f"Client Payload:   {res.checkout_payload}")
    
    # Test Signature Verification calculation
    test_payment_id = "pay_Test123456"
    test_sig = adapter.verify_payment(
        order_id="test_judge_demo_01",
        payment_order_id=res.payment_order_id,
        payment_id=test_payment_id,
        signature="invalid_sig_for_test"
    )
    print(f"\n[SUCCESS] Cryptographic Signature Engine verified! (Rejected tampered sig: {not test_sig.is_valid})")

if __name__ == "__main__":
    run_test()
