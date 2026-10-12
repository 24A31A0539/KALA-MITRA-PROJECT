# Contributing to KALA-MITRA

Thank you for your interest in contributing to **KALA-MITRA**! We welcome improvements, bug fixes, craft knowledge expansions, and documentation enhancements.

---

## 🛠️ Code of Conduct & Development Principles

1. **Artisan First:** Keep the user interface simple, intuitive, and accessible for traditional artisans across varying literacy levels and regional languages.
2. **Resilience & Fallbacks:** Never let missing AI model checkpoints (YOLO/SAM/Ollama) crash the application. Always implement graceful fallbacks.
3. **Security Awareness:** Never commit credentials, private API keys, SMTP passwords, or live transaction tokens to version control.

---

## 🚀 Setting Up Local Development

### 1. Clone & Navigate
```bash
git clone <repository-url>
cd "KALA-MITRA PROJECT"
```

### 2. Configure Environment
Copy `.env.example` to `.env` in the application directory:
```bash
cp .env.example "sih (2)/sih/sih final (2)/sih final/kala mitra ai/kala mitra ai/.env"
```

### 3. Backend Setup (FastAPI)
```bash
cd "sih (2)/sih/sih final (2)/sih final/kala mitra ai/kala mitra ai"
py -m pip install -r backend/requirements.txt
```

Run test suite:
```bash
$env:PYTHONPATH="."
py -m pytest backend/tests
```

Start backend server:
```bash
py -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

### 4. Frontend Setup (Vite / Vanilla JS)
In a separate terminal:
```bash
cd "sih (2)/sih/sih final (2)/sih final/kala mitra ai/kala mitra ai"
npm install
npm run dev
```

Build production bundle:
```bash
npm run build
```

---

## 🧪 Testing Guidelines

- Always run backend pytest before submitting a pull request:
  ```bash
  $env:PYTHONPATH="."
  py -m pytest backend/tests
  ```
- Ensure the frontend production build succeeds without bundler syntax errors:
  ```bash
  npm run build
  ```

---

## 🔒 Security & Secrets Hygiene

- Ensure `.gitignore` is active and `.env` is ignored before staging any commits.
- Never hardcode personal emails or test phone numbers in committed source code.
- Report any discovered vulnerabilities privately to the repository maintainers.
