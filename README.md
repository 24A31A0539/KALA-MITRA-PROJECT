# KALA-MITRA 🎨🤝

> **Empowering Indian Artisans through AI-Powered Vision Cataloging, Demand-Driven Artisan Clustering, and Transparent Market Access.**

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Vite](https://img.shields.io/badge/Frontend-Vite%20%2B%20Vanilla%20JS-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Python](https://img.shields.io/badge/Python-3.11%20%7C%203.14-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![Razorpay](https://img.shields.io/badge/Payments-Razorpay%20Sandbox-0C2340?logo=razorpay&logoColor=white)](https://razorpay.com/)
[![License](https://img.shields.io/badge/License-Proprietary%20%2F%20Unlicensed-lightgrey)](#license)

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Technology Stack](#-technology-stack)
- [Repository Structure](#-repository-structure)
- [How It Works](#-how-it-works)
- [Prerequisites](#-prerequisites)
- [Installation and Setup](#-installation-and-setup)
- [Environment Variables](#-environment-variables)
- [Running the Application](#-running-the-application)
- [AI Components and Graceful Fallbacks](#-ai-components-and-graceful-fallbacks)
- [Storage and Payments](#-storage-and-payments)
- [Known Limitations](#-known-limitations)
- [Future Improvements](#-future-improvements)
- [Security Notice](#-security-notice)
- [License](#-license)

---

## 🌟 Overview

Traditional Indian handicraft artisans face steep barriers when entering modern digital marketplaces: complex product cataloging processes, opaque middleman commissions, and an inability for individual small workshops to accept institutional bulk orders.

**KALA-MITRA** is an end-to-end craft enablement platform designed to bridge this divide. It provides artisans with an intuitive mobile-first experience featuring **one-click AI visual cataloging**, an **AI Copilot assistant**, **multilingual voice assistance**, and **collective artisan clustering** that allows independent artisans to pool production capacity for large buyer demands.

---

## 🚀 Key Features

*Verified directly from the repository implementation:*

- **One-Click Vision Cataloging:** Upload craft photos to automatically detect products, crop/segment clutter, and synthesize catalog titles, handicraft categories, craft heritage descriptions, materials, and price suggestions.
- **AI Copilot & Artisan Assistant:** Conversational assistant for craft discovery, regional artisan matching, workshop locations, order status tracking, and capacity calculations with multilingual support (English, Telugu, Hindi).
- **Collective Capacity Clustering:** Calculates combined production capacity of neighboring artisans, enabling small workshops to collectively fulfill large institutional purchase orders.
- **Interactive Geospatial Clustering & Maps:** Interactive map powered by Leaflet to locate nearby artisans, craft clusters, and regional workshops with OpenStreetMap geocoding.
- **Multilingual Voice Search & TTS:** Speech recognition and speech synthesis support for accessible navigation across English, Telugu, and Hindi.
- **Visual Image Search:** Multi-feature image search allowing buyers to discover artisan products using visual similarity matching.
- **Payment Sandbox Integration:** Integrated Razorpay Test Mode checkout with cryptographic HMAC-SHA256 signature verification, webhook processing, and simulated sandbox fallbacks.
- **Flexible OTP Authentication:** Multi-channel OTP verification supporting real SMTP email dispatch, SMS providers (Twilio, Fast2SMS, MSG91), and console logging for offline development.

---

## 🏗️ System Architecture

```
                  ┌───────────────────────────────────────────────┐
                  │          Frontend Client (Vite 6)             │
                  │   - Mobile Phone Shell & Navigation UI        │
                  │   - Leaflet Maps & Camera Vision Interfaces   │
                  │   - Speech Recognition & Audio Synthesis       │
                  │   - Razorpay Checkout Modal (Sandbox)         │
                  └───────────────────────┬───────────────────────┘
                                          │ REST API / JSON
                                          ▼
                  ┌───────────────────────────────────────────────┐
                  │             FastAPI Backend Server            │
                  │              (Port 8000 /api/v1)              │
                  ├───────────────────────────────────────────────┤
                  │ Routers:                                      │
                  │   /catalog       - Vision Cataloging & AI     │
                  │   /copilot       - Assistant & Craft RAG      │
                  │   /clusters      - Collective Capacity Engine │
                  │   /artisans      - Geospatial Discovery       │
                  │   /products      - Image Similarity & Search  │
                  │   /orders        - Order Tracking & Lifecycle │
                  │   /payments      - Razorpay Adapter & Webhook │
                  │   /auth          - Multi-provider OTP Auth    │
                  └──────┬────────────────────┬─────────────────┬─┘
                         │                    │                 │
                         ▼                    ▼                 ▼
          ┌──────────────────────┐  ┌──────────────────┐  ┌──────────────────┐
          │     AI / ML Services │  │ Data Persistence │  │ Payment & Alerts │
          │  - YOLOv8 (Detect)   │  │  - JSON File     │  │  - Razorpay Test │
          │  - SAM (Segment)     │  │    Datastore     │  │  - SMTP Email    │
          │  - Ollama / Heuristic│  │    (store.json)  │  │  - SMS Gateways  │
          │    Domain LLM Engine │  │                  │  │                  │
          └──────────────────────┘  └──────────────────┘  └──────────────────┘
```

---

## 💻 Technology Stack

### Frontend
- **Framework & Build:** Vite 6, Modern Vanilla JavaScript (ES Modules)
- **Styling:** Modular CSS3, responsive mobile viewport simulation shell
- **Maps & Geolocation:** Leaflet 1.9, Leaflet MarkerCluster, OpenStreetMap Nominatim
- **Payments:** Razorpay JavaScript Checkout (`checkout.razorpay.com/v1/checkout.js`)
- **Utilities:** QR Code generation (`qrcode`), Firebase Web SDK (optional client auth)

### Backend
- **Framework:** FastAPI (Python 3.11 / 3.14 compatible), Uvicorn ASGI server
- **Validation & Serialization:** Pydantic 2.6+
- **Image Processing:** Pillow (PIL)
- **HTTP Client:** HTTPX (async client for Ollama and external APIs)
- **Testing:** Pytest (11 unit/integration test suites verified passing)

### AI / ML (Pluggable with Zero-Crash Fallbacks)
- **Object Detection:** YOLOv8 (`ultralytics`) with heuristic craft region fallback
- **Instance Segmentation:** Meta Segment Anything Model (`segment-anything`) with smart bounding crop fallback
- **Language Models:** Ollama local daemon (`llama3.2-vision`, `mistral`) with rich KALA-MITRA domain knowledge base fallback
- **Visual Image Search:** Multi-aspect color and feature histogram similarity engine

### Storage & External Integrations
- **Persistence:** Local JSON flat-file datastore (`backend/app/data/store.json`)
- **Payments:** Razorpay API adapter & HMAC signature validator (Test Sandbox)
- **Messaging & Notifications:** Python standard `smtplib` for SMTP, Twilio API, Fast2SMS, MSG91

---

## 📂 Repository Structure

```
KALA-MITRA PROJECT/
│
├── .gitignore                          # Repository-level ignore rules
├── .env.example                        # Sanitized configuration template
├── README.md                           # Master project documentation
├── CONTRIBUTING.md                     # Contribution & local testing guide
│
└── sih (2)/                            # Application Root Directory
    │
    ├── payment_handoff_extracted/      # Modular Payment Subsystem Package
    │   ├── payment/                    # Isolated payment interfaces & adapters
    │   ├── integration/                # API contracts and order payment flows
    │   ├── tests/                      # Dedicated payment test scripts
    │   └── PAYMENT_INTEGRATION.md      # Standalone payment architecture guide
    │
    └── sih/sih final (2)/sih final/kala mitra ai/kala mitra ai/  # Main App Workspace
        │
        ├── index.html                  # Frontend entry point & mobile app shell
        ├── main.js                     # Core application logic & UI controllers
        ├── style.css                   # Global styles & layout rules
        ├── marketplace.css             # Marketplace & artisan view styles
        ├── package.json                # Frontend dependencies & npm scripts
        │
        ├── src/                        # Modular frontend client services
        │   ├── config/                 # Client configuration (e.g., Firebase)
        │   ├── models/                 # Data entity models (artisan, product, order)
        │   ├── repositories/           # Frontend state repositories
        │   └── services/               # Auth, camera, catalog, market demand services
        │
        ├── public/ & sample_crafts/    # Sample artisan craft assets & imagery
        │
        └── backend/                    # FastAPI Backend Engine
            ├── requirements.txt        # Python backend dependencies
            ├── app/
            │   ├── main.py             # FastAPI entry point & API route registration
            │   ├── config.py           # Pydantic settings & environment loader
            │   ├── api/routes/         # Endpoint route controllers
            │   │   ├── catalog.py      # AI craft analysis endpoints
            │   │   ├── copilot.py      # Multilingual Copilot assistant
            │   │   ├── clusters.py     # Collective artisan cluster routes
            │   │   ├── products.py     # Product listing & visual search
            │   │   ├── payments.py     # Razorpay order creation & signature verification
            │   │   ├── orders.py       # Order management & status updates
            │   │   ├── artisans.py     # Geolocation & nearby artisan discovery
            │   │   ├── auth.py         # OTP login & verification routes
            │   │   └── ...             # Notifications, capacity, users
            │   ├── services/           # Business logic & AI model abstractions
            │   │   ├── catalog_service.py      # Vision pipeline orchestrator
            │   │   ├── copilot_service.py      # Assistant logic & domain RAG
            │   │   ├── yolo_service.py         # YOLOv8 object detection wrapper
            │   │   ├── sam_service.py          # Segment Anything Model wrapper
            │   │   ├── llm_service.py          # Ollama LLM / domain synthesizer
            │   │   ├── otp_service.py          # Multi-provider OTP delivery
            │   │   └── store.py                # JSON datastore persistence manager
            │   └── data/
            │       └── store.json      # Primary JSON datastore
            ├── payment/                # Integrated payment adapters & schemas
            └── tests/                  # Backend unit & integration test suite
```

---

## 🔄 How It Works

### 1. AI Vision Cataloging Flow
```
Artisan takes photo ──► POST /api/v1/catalog/analyze ──► YOLOv8 detects craft
                                                                │
                                                                ▼
Auto-published to ◄── Structured JSON Catalog ◄── SAM segments background
marketplace store     (Title, Category, Price)    & LLM synthesizes story
```

### 2. Collective Capacity Clustering Flow
1. A buyer requests a bulk order of 200 bamboo baskets.
2. The artisan checks their individual capacity (e.g., 40 units ready).
3. The cluster engine queries `/api/v1/clusters/provisional` and `/api/v1/artisans/nearby` to calculate collective capacity across neighboring workshops.
4. Invitations are dispatched to cluster peers to pool production and fulfill the order together.

### 3. Payment Flow (Razorpay Test Sandbox)
1. Buyer initiates checkout for products or bulk cluster orders.
2. Backend generates a Razorpay Order ID (`POST /api/v1/payments/create-order`).
3. Frontend launches the Razorpay Checkout modal in Test Mode.
4. On completion, the frontend submits payment credentials to `POST /api/v1/payments/verify`.
5. Backend verifies the HMAC-SHA256 signature using the configured secret and transitions the order status to `confirmed`.

---

## ⚙️ Prerequisites

- **Node.js:** v18.0.0 or later (verified with Node v24.12.0)
- **Python:** v3.11+ (verified with Python 3.14.0)
- **Package Managers:** `npm` and `pip`
- *(Optional)* **Ollama:** Installed and running locally with `llama3.2-vision` or `mistral` for live local LLM inference.
- *(Optional)* **Model Weights:** YOLOv8 (`yolov8n.pt`) and SAM (`sam_vit_b_01ec64.pth`) if running heavy local computer vision inference.

---

## 📥 Installation and Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd "KALA-MITRA PROJECT"
```

### 2. Environment Configuration
Copy the provided `.env.example` into the application directory:
```bash
# On Windows PowerShell:
Copy-Item .env.example "sih (2)\sih\sih final (2)\sih final\kala mitra ai\kala mitra ai\.env"
```

### 3. Backend Setup
Navigate to the application root and install backend dependencies:
```bash
cd "sih (2)/sih/sih final (2)/sih final/kala mitra ai/kala mitra ai"
py -m pip install -r backend/requirements.txt
```

### 4. Frontend Setup
Install frontend dependencies:
```bash
npm install
```

---

## 🔐 Environment Variables

Key environment variables configured in `.env`:

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `HOST` | Backend server bind address | `127.0.0.1` |
| `PORT` | Backend server port | `8000` |
| `RAZORPAY_KEY_ID` | Razorpay Sandbox Key ID | `rzp_test_placeholder` |
| `RAZORPAY_KEY_SECRET` | Razorpay Sandbox Key Secret | `placeholder_secret` |
| `RAZORPAY_MODE` | Payment mode indicator | `TEST` |
| `OLLAMA_BASE_URL` | Local Ollama endpoint | `http://localhost:11434` |
| `OLLAMA_MODEL` | Vision/LLM model name | `llama3.2-vision` |
| `DATA_STORE_PATH` | Path to JSON datastore | `backend/app/data/store.json` |
| `SMS_PROVIDER` | OTP SMS provider (`console`, `twilio`, etc.) | `console` |
| `SMTP_HOST` | SMTP server host for email OTP | `smtp.gmail.com` |

*Refer to `.env.example` for the complete list of options.*

---

## ▶️ Running the Application

### 1. Start the FastAPI Backend
From the application directory (`sih (2)/sih/sih final (2)/sih final/kala mitra ai/kala mitra ai`):
```bash
# Windows PowerShell
$env:PYTHONPATH="."
py -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```
The backend API will be available at:
- **API Root:** `http://127.0.0.1:8000`
- **Interactive Swagger Docs:** `http://127.0.0.1:8000/docs`
- **Health Check:** `http://127.0.0.1:8000/api/v1/health`

### 2. Start the Frontend Dev Server
In a new terminal:
```bash
cd "sih (2)/sih/sih final (2)/sih final/kala mitra ai/kala mitra ai"
npm run dev
```
Open your browser at `http://localhost:5173`.

### 3. Running Backend Tests
Execute the comprehensive Pytest suite:
```bash
$env:PYTHONPATH="."
py -m pytest backend/tests
```
*(All 11 tests covering catalog, clusters, copilot, notifications, orders, and payments pass successfully).*

---

## 🧠 AI Components and Graceful Fallbacks

KALA-MITRA is engineered to ensure **zero crashes** when hardware-accelerated models or external daemons are absent:

1. **YOLOv8 Object Detection (`yolo_service.py`):**
   - *With weights:* Performs real-time inference on craft imagery.
   - *Without weights:* Uses a centered craft bounding box heuristic with explicit notice so developers can test workflows without multi-gigabyte downloads.
2. **Segment Anything Model (`sam_service.py`):**
   - *With weights:* Generates transparent alpha-masked PNG cutouts.
   - *Without weights:* Automatically crops the focused product bounding box.
3. **LLM & Copilot (`llm_service.py` & `copilot_service.py`):**
   - *With Ollama:* Connects via HTTPX to local LLMs (`llama3.2-vision` / `mistral`).
   - *Without Ollama:* Switches instantly to the built-in KALA-MITRA Craft Knowledge Base, generating rich regional craft descriptions, tags, and artisan recommendations across English, Telugu, and Hindi.

---

## 💳 Storage and Payments

- **Storage:** Uses a structured, local JSON flat-file database (`backend/app/data/store.json`) managing products, orders, artisans, clusters, notifications, and transactions without requiring complex database server installation.
- **Payments:** Integrates the official Razorpay test sandbox. Payment orders are created via API, authenticated using HMAC-SHA256 digests, and supported by a mock gateway adapter for offline local testing.

---

## ⚠️ Known Limitations

- **JSON Storage Concurrency:** The flat-file JSON datastore is optimal for development, demonstrations, and hackathons, but is not designed for high-concurrency production transaction volume.
- **Single-Host Deployment:** The frontend hardcodes default API requests to `http://127.0.0.1:8000`, intended for local development and unified workstation evaluation.
- **Client Bundle Size:** The primary JavaScript bundle (`main.js`) contains comprehensive UI state and controllers in a single file (~676 KB), which Vite flags for future code-splitting.

---

## 🔮 Future Improvements

*(Proposed roadmap items; not claimed as present features)*

- [ ] Transition storage layer to PostgreSQL with SQLAlchemy / Alembic migrations.
- [ ] Implement Docker Compose orchestration for frontend, backend, and Ollama services.
- [ ] Modularize `main.js` into ES module subcomponents (order tracking, clustering, cataloging).
- [ ] Introduce real-time WebSocket push notifications for live cluster invitation acceptance.
- [ ] Add an escrow disbursement engine for automated split-payouts among cluster members.

---

## 🔒 Security Notice

- Ensure all sensitive variables (API tokens, SMTP passwords, Twilio credentials) are kept strictly inside `.env`.
- Do not commit `.env` to public repositories. Use `.env.example` as a template.
- If testing email or SMS OTP delivery, use dedicated development credentials and app passwords.
REPO OWNER:yarramsettijalaganika@gmail.com
LINKEDIN:https://www.linkedin.com/in/jalaganika-yarramsetti-ba506632b
