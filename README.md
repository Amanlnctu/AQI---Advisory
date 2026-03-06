# 🌬️ AeroGuard — Predictive AQI & Health Advisory Platform

> A full-stack hackathon-grade web application that **predicts air quality 24 hours ahead** and delivers **personalised health advisories** based on your vulnerability profile.

---

## 🚀 Live Demo

Deployed on Vercel → [aqi-advisory.vercel.app](https://aqi-advisory.vercel.app) *(replace with your URL)*

---

## ✨ Features

| Feature | Description |
|---|---|
| 📍 **Smart Location Picker** | Search Indian landmarks, use GPS, or click on an interactive map |
| 📊 **Predictive AQI Dashboard** | Diurnal cosine model with per-hour noise — realistic 24 h trend |
| 🧑‍⚕️ **Personalised Health Advisory** | Adapts in real-time to Asthma / Elderly / Children toggles |
| 🗺️ **Safe Route Mapper** | OSRM road routing — "Fastest" vs "Cleanest Air" route comparison |
| 📝 **Symptom Telemetry** | Log how pollution is affecting you today |
| 🌙 **Dark Glassmorphism UI** | Premium dark theme with smooth animations |

---

## 🖥️ Tech Stack

### Frontend
- **React 18** + **Vite**
- **Tailwind CSS** — dark glassmorphism design
- **Recharts** — AreaChart for 24 h AQI trajectory
- **React-Leaflet + Leaflet** — interactive maps
- **OSRM** (free, no key) — real road routing
- **Nominatim / OpenStreetMap** — landmark search & reverse geocoding

### Backend (Local)
- **FastAPI** + **Uvicorn** (with `--reload`)
- **MongoDB** + **Motor** (async driver)
- **Pydantic v2** — data validation

### Backend (Vercel Serverless)
- **FastAPI** + **Mangum** — ASGI → Lambda bridge
- Fully self-contained, **no MongoDB required** — stateless computation

---

## 📁 Project Structure

```
AQI - Advisor/
├── api/                        # Vercel serverless function
│   ├── index.py                # Self-contained FastAPI app (no DB)
│   └── requirements.txt        # fastapi, pydantic, mangum
├── backend/                    # Local FastAPI server (with MongoDB)
│   ├── app/
│   │   ├── api/endpoints.py    # Dashboard, routes, profile, symptoms
│   │   ├── core/               # Config, DB connection
│   │   ├── models/             # Pydantic schemas
│   │   └── services/
│   │       ├── predictor.py    # Diurnal AQI forecast engine
│   │       └── data_fetcher.py # Location-aware AQI + Nominatim geocoding
│   └── requirements.txt
├── frontend website/           # React + Vite
│   ├── src/
│   │   ├── App.jsx             # All UI components, location picker, routing
│   │   └── index.css           # Dark theme + Leaflet overrides
│   ├── .env.development        # Points to localhost:8000
│   ├── .env.production         # Points to /api/v1 (Vercel)
│   └── package.json
└── vercel.json                 # Vercel build + rewrite config
```

---

## ⚡ Local Development

### 1. Start the backend

```bash
cd "backend"
pip install -r requirements.txt
uvicorn app.main:app --reload
# API runs at http://127.0.0.1:8000
```

> Requires a `.env` file in `backend/`. Copy `.env.template` and set `MONGODB_URL`.

### 2. Start the frontend

```bash
cd "frontend website"
npm install
npm run dev
# App runs at http://localhost:5173
```

---

## ☁️ Vercel Deployment

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import this repo
3. Vercel auto-reads `vercel.json` — no extra config needed
4. Click **Deploy** ✅

The `api/index.py` serverless function handles all backend logic on Vercel without any database dependency.

---

## 🔬 How the AQI Prediction Works

```
Location (lat, lon)
        │
        ▼
  Urban Pollution Factor
  (peaks ~30°N, Indian subcontinent)
        │
        ▼
  Base AQI = 40 + urban_factor × lon_factor × 320
        │
        ▼
  24 h Diurnal Forecast
  val[h] = base_aqi + amplitude × cos((hour - 6) × π/12) + noise
        │
        ▼
  Personalised Advisory
  (thresholds adjust for Asthma / Elderly / Children)
```

---

## 📜 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/dashboard` | 24 h forecast + advisory for a lat/lon |
| `POST` | `/api/v1/routes/safe-route` | Compare fastest vs cleanest route |
| `GET` | `/api/v1/users/{id}/profile` | Fetch health profile |
| `PUT` | `/api/v1/users/{id}/profile` | Update vulnerability flags |
| `POST` | `/api/v1/users/{id}/symptoms` | Log symptom level |
| `GET` | `/api/v1/health` | Serverless health check |

---

## 👥 Team

Built for a hackathon. Open source — MIT License.
