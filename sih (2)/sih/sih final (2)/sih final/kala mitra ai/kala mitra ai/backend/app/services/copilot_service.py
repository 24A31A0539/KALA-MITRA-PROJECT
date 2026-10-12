"""
KALA-MITRA AI Copilot Assistant Service
Domain-specific assistant empowering both Artisans and Buyers:
- Crafts & products discovery
- Verified artisans & workshop locations
- Bulk order capacity checks & collective cluster formation
- Order tracking and milestone updates
- Payment methods (Razorpay Test Mode)
- Multilingual support: English, Telugu, Hindi
- Transparent engine attribution (Ollama Local LLM or KALA-MITRA Domain Fallback Engine)
"""

import httpx
from typing import List, Dict, Any, Optional
from ..config import settings

COPILOT_SYSTEM_PROMPT = """You are KALA-MITRA AI Assistant, dedicated to connecting traditional Indian artisans with institutional and direct craft buyers.
Your mission is to help buyers discover authentic handmade crafts, organize bulk collective orders, understand artisan cluster capacity, and track orders from production to delivery.
You also guide artisans on fair pricing, cluster participation, and order fulfillment.

Guidelines:
1. Always be polite, encouraging, and respectful of Indian craft heritage.
2. If a buyer mentions a bulk quantity (e.g. 100, 500+ units), check if multiple artisans are needed and recommend forming an Artisan Cluster.
3. For product questions, highlight regional craft specialties (East Godavari bamboo, Banarasi handloom, Terracotta pottery, Etikoppaka woodcraft).
4. Explain how KALA-MITRA clusters combine workshop capacity and protect orders via Razorpay Test Mode and logistics tracking.
5. Answer concisely, clearly, and in the user's selected language.
"""

COPILOT_TOOLS = [
    {"name": "create_product_catalog", "description": "Extracts visual craft features from camera photo to generate product listing."},
    {"name": "get_artisan_capacity", "description": "Retrieves available ready stock, monthly production capacity, and lead times."},
    {"name": "get_market_opportunities", "description": "Fetches current high-demand buyer requests and price trends for artisan craft category."},
    {"name": "get_order_status", "description": "Tracks active production orders, fulfillment deadlines, and delivery milestones."},
    {"name": "calculate_collective_capacity", "description": "Calculates combined production capacity of nearby cluster artisans for large bulk orders."},
    {"name": "search_products", "description": "Searches verified artisan craft catalog."},
    {"name": "verify_razorpay_payment", "description": "Checks escrow and test mode payment confirmation."}
]

class CopilotService:
    def __init__(self):
        self.base_url = settings.OLLAMA_BASE_URL
        self.model = settings.OLLAMA_MODEL

    async def generate_response(
        self,
        query: str,
        history: Optional[List[Dict[str, str]]] = None,
        artisan_context: Optional[Dict[str, Any]] = None,
        language: str = "en"
    ) -> Dict[str, Any]:
        """
        Generates assistant response using local Ollama LLM if reachable,
        or the comprehensive KALA-MITRA Domain Fallback Engine.
        """
        query_text = (query or "").strip()
        query_lower = query_text.lower()

        # 1. Attempt Local Ollama LLM
        try:
            language_name = {"en": "English", "te": "Telugu", "hi": "Hindi"}.get(language, "English")
            async with httpx.AsyncClient(timeout=2.5) as client:
                full_prompt = (
                    f"{COPILOT_SYSTEM_PROMPT}\n"
                    f"Respond in {language_name}.\n"
                    f"User: {query_text}\n"
                    f"Assistant:"
                )
                response = await client.post(
                    f"{self.base_url}/api/generate",
                    json={
                        "model": self.model,
                        "prompt": full_prompt,
                        "stream": False
                    }
                )
                if response.status_code == 200:
                    reply_text = response.json().get("response", "").strip()
                    if reply_text:
                        return {
                            "response": reply_text,
                            "source": "ollama_llm (Local Vision/Text Model)",
                            "tools_available": [t["name"] for t in COPILOT_TOOLS],
                            "language": language
                        }
        except Exception:
            # Fallback when Ollama daemon is offline or not installed
            pass

        # 2. Comprehensive Domain Expert Engine
        return self._generate_domain_fallback(query_lower, query_text, artisan_context, language)

    def _generate_domain_fallback(
        self,
        query_lower: str,
        original_query: str,
        context: Optional[Dict[str, Any]] = None,
        language: str = "en"
    ) -> Dict[str, Any]:
        """
        Intelligent, domain-specific responses for both Buyers and Artisans.
        Understands products, artisans, bulk orders, capacity, clusters, orders, and payments.
        """
        # --- TELUGU RESPONSES ---
        if language == "te":
            if any(k in query_lower for k in ["100", "200", "300", "500", "1000", "bulk", "cluster", "క్లస్టర్", "బల్క్", "సమిష్టి"]):
                reply = (
                    "🤝 **భారీ ఆర్డర్ మరియు సమిష్టి సామర్థ్య విశ్లేషణ:**\n\n"
                    "మీ ఆర్డర్ అవసరానికి (ఉదా: 500+ యూనిట్లు) అనేక వర్క్‌షాప్‌ల సహాయం అవసరం కావచ్చు. సాధారణంగా ఒక కళాకారుడి నెలవారీ సామర్థ్యం 60–150 యూనిట్లు ఉంటుంది.\n\n"
                    "KALA-MITRA మీ ఆర్డర్‌ను తూర్పు గోదావరి ప్రాంతంలోని **కళాకారుల క్లస్టర్ (Artisan Cluster)** ద్వారా విభజించి అందిస్తుంది:\n"
                    "• **100% ఉత్పత్తి సామర్థ్యం పూర్తి** - ఏ ఒక్క వర్క్‌షాప్‌పై భారం పడదు.\n"
                    "• **మాస్టర్ క్రాఫ్ట్స్‌మన్ పర్యవేక్షణలో నాణ్యత పరిశీలన**.\n"
                    "• **ఎస్క్రో రక్షణ** - ప్రతి దశ పూర్తయిన తర్వాతే చెల్లింపులు లభిస్తాయి."
                )
            elif any(k in query_lower for k in ["basket", "bamboo", "బాంబూ", "బాస్కెట్", "బుట్ట", "వెదురు"]):
                reply = (
                    "🧺 **చేతితో నేసిన వెదురు ఉత్పత్తులు (Bamboo Crafts):**\n\n"
                    "కాకినాడ మరియు రాజమండ్రి మాస్టర్ కళాకారులు తయారు చేసిన ప్రామాణికమైన వెదురు బుట్టలు అందుబాటులో ఉన్నాయి:\n\n"
                    "• **చేతితో నేసిన వెదురు నిల్వ బుట్ట** (₹640 / యూనిట్ • 120 యూనిట్లు సిద్ధం • 4.8★)\n"
                    "• **మూతతో వెదురు పిక్రిక్ బాస్కెట్** (₹850 / యూనిట్ • 55 యూనిట్లు సిద్ధం • 4.7★)\n"
                    "• **వెదురు టీ టేబుల్ సెట్** (₹1,200 / యూనిట్ • 40 యూనిట్లు సిద్ధం • 4.9★)\n\n"
                    "నమూనాలు లేదా 500+ యూనిట్ల భారీ ఆర్డర్‌ల కోసం వెంటనే ఆర్డర్ చేయవచ్చు."
                )
            elif any(k in query_lower for k in ["pot", "clay", "pottery", "terracotta", "కుండలు", "మట్టి", "టెర్రకోటా"]):
                reply = (
                    "🏺 **ప్రామాణిక మట్టి మరియు టెర్రకోటా ఉత్పత్తులు:**\n\n"
                    "కాకినాడ మధుర క్లే స్టూడియో కళాకారులు సహజమైన మట్టితో తయారు చేసిన ఉత్పత్తులు:\n\n"
                    "• **టెర్రకోటా అలంకరణ ప్లాంటర్ & ప్రమిదల సెట్** (₹320 / యూనిట్ • 90 యూనిట్లు సిద్ధం)\n"
                    "• కలప భట్టీలో కాల్చి తయారు చేయడం వల్ల ఎక్కువ మన్నిక ఉంటుంది."
                )
            elif any(k in query_lower for k in ["saree", "silk", "handloom", "textile", "చేనేత", "చీర", "మగ్గం"]):
                reply = (
                    "🧵 **చేనేత మరియు సాంప్రదాయ వస్త్రాలు:**\n\n"
                    "శ్రీ హ్యాండ్లూమ్ కలెక్టివ్ ద్వారా అందిస్తున్న ధృవీకరించిన చేనేత ఉత్పత్తులు:\n\n"
                    "• **చేతితో నేసిన బనారసి పట్టు చీర** (₹2,450 / యూనిట్ • GI ధృవీకృత శుద్ధ పట్టు)\n"
                    "• **హ్యాండ్లూమ్ కాటన్ టేబుల్ రన్నర్** (₹510 / యూనిట్ • 100% సేంద్రీయ కాటన్)"
                )
            elif any(k in query_lower for k in ["wood", "carving", "toy", "చెక్క", "బొమ్మలు", "ఏటికొప్పాక"]):
                reply = (
                    "🪵 **ఏటికొప్పాక మరియు చెక్క హస్తకళలు:**\n\n"
                    "గోదావరి వుడ్‌వర్క్స్ కళాకారులు తయారు చేసిన సహజమైన రంగుల చెక్క బొమ్మలు మరియు గృహ అలంకరణ వస్తువులు:\n\n"
                    "• **చేతితో చెక్కిన చెక్క బౌల్ సెట్** (₹750 / సెట్ • ఆహార రక్షణ ముగింపు)\n"
                    "• **చెక్క జాలీ వాల్ ఆర్ట్ ప్యానెల్** (₹1,400 / యూనిట్)"
                )
            elif any(k in query_lower for k in ["order", "track", "tracking", "status", "ఆర్డర్", "ట్రాక్", "ఎక్కడ", "షిప్‌మెంట్"]):
                reply = (
                    "📦 **ఆర్డర్ ట్రాకింగ్ & స్థితి వివరాలు:**\n\n"
                    "మీ ఆర్డర్‌ను ప్రత్యక్షంగా వీక్షించడానికి:\n"
                    "1. మీ పై మెనూలో **Order Tracking** స్క్రీన్‌ను తెరవండి.\n"
                    "2. ఆర్డర్ దశలు: *ఆర్డర్ నమోదు → ఉత్పత్తి ప్రారంభం → నాణ్యత తనిఖీ → రవాణా → డెలివరీ*."
                )
            elif any(k in query_lower for k in ["pay", "payment", "razorpay", "upi", "price", "cost", "పేమెంట్", "చెల్లింపు", "ధర", "రేటు", "ధర నిర్ణయం"]):
                reply = (
                    "💳 **ధర నిర్ణయ మార్గదర్శకత్వం & చెల్లింపు రక్షణ:**\n\n"
                    "• **ధర సూత్రం:** ముడి సరుకుల ఖర్చు + రోజువారీ కూలి + రవాణా (₹20) + 25% న్యాయమైన లాభం. సాధారణ బల్క్ ధర: ₹400–₹550/యూనిట్.\n"
                    "• **సురక్షిత చెల్లింపు:** Razorpay Test Mode మరియు UPI ద్వారా ఎస్క్రో రక్షణతో చెల్లింపులు చేయవచ్చు."
                )
            elif any(k in query_lower for k in ["opportunity", "demand", "అవకాశం", "డిమాండ్", "ప్రాంతం"]):
                reply = (
                    "📈 **ప్రాంతీయ మార్కెట్ అవకాశాలు:**\n\n"
                    "ప్రస్తుతం మీ ప్రాంతంలో పర్యావరణ అనుకూల హస్తకళలు మరియు వెదురు ఉత్పత్తులకు హోస్పిటాలిటీ రంగం నుండి అధిక కొనుగోలుదారుల డిమాండ్ ఉంది."
                )
            else:
                reply = (
                    "🙏 **నమస్కారం! నేను మీ KALA-MITRA AI సహాయకుడిని.**\n\n"
                    "నేను మీకు సహాయం చేయగలను:\n"
                    "• **ఉత్పత్తులను వెతకడం**: 'వెదురు బుట్టలు చూపించు' లేదా 'చేనేత చీరలు' అని అడగండి.\n"
                    "• **భారీ ఆర్డర్లు & క్లస్టర్లు**: '500 వెదురు బుట్టలు కావాలి' అని అడగండి.\n"
                    "• **ఆర్డర్ ట్రాకింగ్**: 'నా ఆర్డర్ ఎక్కడ ఉంది?' అని అడగండి.\n"
                    "• **ధర నిర్ణయం & చెల్లింపులు**: బల్క్ ధరల విశ్లేషణ మరియు Razorpay చెల్లింపు వివరాలు పొందండి."
                )

        # --- HINDI RESPONSES ---
        elif language == "hi":
            if any(k in query_lower for k in ["100", "200", "300", "500", "1000", "bulk", "cluster", "क्लस्टर", "थोक", "सामूहिक"]):
                reply = (
                    "🤝 **थोक ऑर्डर और सामूहिक क्षमता विश्लेषण:**\n\n"
                    "आपकी थोक आवश्यकता (जैसे 500+ यूनिट) के लिए KALA-MITRA कई कारीगरों को एक **कारीगर क्लस्टर (Artisan Cluster)** में जोड़ता है।\n\n"
                    "• **100% समय पर उत्पादन आपूर्ति**\n"
                    "• **मास्टर शिल्पकार द्वारा गुणवत्ता नियंत्रण**\n"
                    "• **एस्क्रो सुरक्षा के साथ सुरक्षित भुगतान**"
                )
            elif any(k in query_lower for k in ["basket", "bamboo", "बांस", "टोकरी", "बास्केट"]):
                reply = (
                    "🧺 **हस्तनिर्मित बांस उत्पाद (Bamboo Crafts):**\n\n"
                    "हमारे पास पूर्वी गोदावरी के कारीगरों द्वारा हस्तनिर्मित बांस की टोकरियां उपलब्ध हैं:\n\n"
                    "• **बांस स्टोरेज बास्केट** (₹640 / यूनिट • 120 यूनिट तैयार • 4.8★)\n"
                    "• **ढक्कन वाली पिकनिक बास्केट** (₹850 / यूनिट • 55 यूनिट तैयार)\n"
                    "• **बांस टी टेबल सेट** (₹1,200 / यूनिट)"
                )
            elif any(k in query_lower for k in ["pot", "clay", "pottery", "terracotta", "मिट्टी", "बर्तन", "टेराकोटा"]):
                reply = (
                    "🏺 **प्रामाणिक टेराकोटा एवं मिट्टी के बर्तन:**\n\n"
                    "प्राकृतिक मिट्टी से हस्तनिर्मित बर्तन और सजावटी दीये:\n\n"
                    "• **टेराकोटा प्लान्टर और दीया सेट** (₹320 / यूनिट • 90 यूनिट तैयार)"
                )
            elif any(k in query_lower for k in ["saree", "silk", "handloom", "textile", "हथकरघा", "साड़ी", "कपड़ा"]):
                reply = (
                    "🧵 **हथकरघा और पारंपरिक वस्त्र:**\n\n"
                    "प्रमाणित बुनकरों द्वारा तैयार:\n\n"
                    "• **बनारसी सिल्क साड़ी** (₹2,450 / यूनिट • GI प्रमाणित शुद्ध सिल्क)\n"
                    "• **कॉटन टेबल रनर** (₹510 / यूनिट)"
                )
            elif any(k in query_lower for k in ["wood", "carving", "toy", "लकड़ी", "खिलौने", "एटीकोप्पका"]):
                reply = (
                    "🪵 **लकड़ी के शिल्प और एटीकोप्पका खिलौने:**\n\n"
                    "प्राकृतिक रंगों से निर्मित लकड़ी के खिलौने और नक्काशीदार बर्तन उपलब्ध हैं।"
                )
            elif any(k in query_lower for k in ["order", "track", "tracking", "status", "ऑर्डर", "ट्रैक", "स्थिति"]):
                reply = (
                    "📦 **ऑर्डर ट्रैकिंग विवरण:**\n\n"
                    "अपने ऑर्डर की वास्तविक स्थिति देखने के लिए **Order Tracking** टैब खोलें।\n"
                    "चरण: *ऑर्डर → उत्पादन प्रारंभ → गुणवत्ता जांच → शिपिंग → डिलीवरी*"
                )
            elif any(k in query_lower for k in ["pay", "payment", "razorpay", "upi", "price", "cost", "भुगतान", "दाम", "मूल्य"]):
                reply = (
                    "💳 **मूल्य निर्धारण सूत्र एवं भुगतान:**\n\n"
                    "• **मूल्य सूत्र:** कच्चा माल + दैनिक मजदूरी + परिवहन (₹20) + 25% उचित लाभ। सामान्य दर: ₹400–₹550/यूनिट।\n"
                    "• **सुरक्षित भुगतान:** Razorpay Test Mode और UPI द्वारा एस्क्रो सुरक्षा।"
                )
            elif any(k in query_lower for k in ["opportunity", "demand", "अवसर", "मांग", "क्षेत्र"]):
                reply = (
                    "📈 **क्षेत्रीय बाजार अवसर:**\n\n"
                    "आपके क्षेत्र में पर्यावरण-अनुकूल हस्तशिल्प और बांस के उत्पादों की उच्च मांग देखी गई है।"
                )
            else:
                reply = (
                    "🙏 **नमस्ते! मैं आपका KALA-MITRA AI सहायक हूँ।**\n\n"
                    "मैं आपकी मदद कर सकता हूँ:\n"
                    "• **उत्पाद खोजने में**: 'बांस की टोकरी दिखाएं' या 'हथकरघा साड़ी' पूछें।\n"
                    "• **थोक ऑर्डर व क्लस्टर**: '500 बांस टोकरी चाहिए' पूछें।\n"
                    "• **ऑर्डर ट्रैकिंग**: 'मेरा ऑर्डर कहां है?' पूछें।\n"
                    "• **मूल्य निर्धारण व भुगतान**: थोक दरें और Razorpay भुगतान विवरण जानें।"
                )

        # --- ENGLISH RESPONSES ---
        # 1. Bulk orders & cluster feasibility
        elif any(k in query_lower for k in ["100", "200", "300", "500", "1000", "bulk", "large order", "wholesale", "many"]):
            reply = (
                "🤝 **Bulk Order & Collective Capacity Analysis:**\n\n"
                "Your requirement may need multiple artisans. Traditional craft workshops typically have individual monthly capacities of 60–150 units.\n\n"
                "KALA-MITRA can pair your order across an **Artisan Cluster** in the same craft cluster (e.g. East Godavari for Bamboo, Samalkota for Handloom). "
                "This guarantees:\n"
                "• **100% capacity fulfillment** without overloading a single workshop.\n"
                "• **Standardized quality control** with regional master craft oversight.\n"
                "• **Escrow protection** with payment released upon milestone delivery.\n\n"
                "Would you like me to generate a cluster recommendation for this requirement?"
            )

        # 2. Bamboo baskets & specific craft searches
        elif any(k in query_lower for k in ["basket", "bamboo", "cane", "show me", "craft", "find basket"]):
            reply = (
                "🧺 **Handwoven Bamboo & Cane Crafts:**\n\n"
                "We feature authentic handwoven utility and decor baskets crafted by master artisans in Kakinada and Rajahmundry.\n\n"
                "• **Handwoven Bamboo Storage Basket** (₹640 / unit • 120 ready units • 4.8★)\n"
                "• **Bamboo Picnic Hamper with Lids** (₹850 / unit • 55 ready units • 4.7★)\n"
                "• **Bamboo Tea Table Set** (₹1,200 / unit • 40 ready units • 4.9★)\n\n"
                "All items are available for immediate sample orders or bulk cluster production. Tap on any product card in the marketplace to view details or request a wholesale quote."
            )

        # 3. Pottery / Clay
        elif any(k in query_lower for k in ["pot", "clay", "pottery", "terracotta", "diya", "planter"]):
            reply = (
                "🏺 **Authentic Pottery & Terracotta:**\n\n"
                "Our terracotta collections are wheel-thrown from natural riverbed clay by artisans like **Madhura Clay Studio** in Kakinada.\n\n"
                "• **Terracotta Decorative Planter & Diya Set** (₹320 / unit • Kiln-fired • 90 ready units)\n"
                "• Handcrafted with wood-kiln firing for rich, earth-tone durability.\n\n"
                "You can order directly or post a bulk customization request for festive or corporate gifting."
            )

        # 4. Handloom & Textiles
        elif any(k in query_lower for k in ["saree", "silk", "handloom", "textile", "stole", "cotton", "cloth"]):
            reply = (
                "🧵 **Handloom & Traditional Textiles:**\n\n"
                "Sourced directly from certified weaving collectives including **Sri Handloom Collective** in Kakinada.\n\n"
                "• **Handwoven Banarasi Silk Saree** (₹2,450 / unit • GI certified pure silk)\n"
                "• **Handloom Cotton Table Runner** (₹510 / unit • 100% organic cotton)\n\n"
                "Every handloom textile is verified for authentic yarn count and natural dyes."
            )

        # 5. Wood Crafts & Etikoppaka
        elif any(k in query_lower for k in ["wood", "carving", "toy", "bowl", "wooden"]):
            reply = (
                "🪵 **Artisan Wood Crafts & Etikoppaka:**\n\n"
                "Crafted by **Godavari Woodworks** using seasoned teak wood and traditional non-toxic vegetable lacquers.\n\n"
                "• **Hand-Carved Wooden Bowl Set** (₹750 / set • Food-safe beeswax finish)\n"
                "• **Wooden Wall Art Panel with Jali Carving** (₹1,400 / unit • 4.8★)\n\n"
                "Handcrafted without industrial veneer, preserving natural wood grain."
            )

        # 6. Orders & Tracking
        elif any(k in query_lower for k in ["order", "track", "tracking", "status", "shipment", "where is"]):
            reply = (
                "📦 **Order Tracking & Milestone Visibility:**\n\n"
                "To track your orders in real time:\n"
                "1. Navigate to the **Order Tracking** tab on your top menu.\n"
                "2. View active production progress across all cluster artisans.\n"
                "3. Track logistical checkpoints: *Order Placed → Production Started → Quality Check → Shipped → Delivered*.\n\n"
                "Live shipment updates are integrated with KALA-MITRA regional distribution hubs in Samalkota and Rajahmundry."
            )

        # 7. Payments & Razorpay
        elif any(k in query_lower for k in ["pay", "payment", "razorpay", "upi", "card", "cost", "price", "checkout"]):
            reply = (
                "💳 **Payment Processing (Razorpay TEST MODE):**\n\n"
                "KALA-MITRA processes payments through **Razorpay Test Mode**:\n"
                "• **Test Mode Simulation**: Safe, simulated payments for evaluation without real monetary charges.\n"
                "• **Cryptographic Verification**: Backend verifies Razorpay HMAC-SHA256 signatures before confirming orders.\n"
                "• **Escrow Protection**: Payment is held securely until artisans pass quality inspection and release shipments.\n\n"
                "To make a test payment, select any item or cluster and click *Checkout with Razorpay*."
            )

        # 8. How cluster formation works
        elif any(k in query_lower for k in ["cluster", "formation", "collective", "how does it work", "combine"]):
            reply = (
                "🌐 **How KALA-MITRA Cluster Formation Works:**\n\n"
                "1. **Buyer Posts Requirement**: Specify craft category, required quantity (e.g. 500 units), target budget, and delivery date.\n"
                "2. **AI Matching Engine**: KALA-MITRA scores nearby verified artisans based on distance, rating, and available capacity.\n"
                "3. **Artisan Invitations**: Invitations are dispatched to artisans who can **[Accept]** or **[Decline]** in their dashboard.\n"
                "4. **Cluster Formed**: When collective accepted capacity reaches 100%, the cluster moves to `CLUSTER_FORMED`.\n"
                "5. **Production & Delivery**: Buyer places the consolidated order with a single payment, while artisans work in parallel."
            )

        # 9. Default greeting
        else:
            reply = (
                "🙏 **Namaste! I am your KALA-MITRA AI Assistant.**\n\n"
                "I can assist you with:\n"
                "• **Finding Crafts**: Ask *'Show me handmade baskets'* or *'Show handloom sarees'*.\n"
                "• **Bulk Orders & Clusters**: Ask *'I need 100 bamboo baskets'* to calculate cluster capacity.\n"
                "• **Artisan Directory**: Inquire about verified workshops in Kakinada and East Godavari.\n"
                "• **Order Tracking**: Ask *'Where is my order?'* to view production and shipping milestones.\n"
                "• **Payments**: Inquire about Razorpay Test Mode checkout."
            )

        return {
            "response": reply,
            "source": "kala_mitra_domain_engine (Domain Expert Fallback)",
            "tools_available": [t["name"] for t in COPILOT_TOOLS],
            "language": language,
            "action": "ARTISAN_CLUSTER" if any(k in query_lower for k in ["cluster", "500", "100", "bulk"]) else None
        }

copilot_service = CopilotService()
