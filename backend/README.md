# Predictive AQI & Health Advisory Platform

This is a proof-of-concept (PoC) REST API built with FastAPI. It provides personalized Air Quality Index (AQI) forecasts and health advisories based on a user's health profile (e.g., asthma, elderly, children in household).

## Features
- **Dashboard Data**: Real-time mock AQI, 24-hour forecast, and personalized health advisories.
- **Safe Route Planning**: Provides "fastest" and "cleanest" route options based on AQI exposure.
- **Health Profile Management**: Toggle health conditions (asthma/respiratory, elderly, children).
- **Symptom Logging**: Log daily symptoms (great, cough/wheezing, headache/fatigue) with notes.

## Tech Stack
- **Framework:** FastAPI
- **Data Validation:** Pydantic
- **Server:** Uvicorn
- **Database:** In-memory dictionary/list (designed to be easily swappable with MongoDB)
- **CORS:** Enabled for all origins for frontend/mobile app testing

## Installation & Setup

1. **Install Dependencies**
   ```bash
   pip install fastapi uvicorn pydantic
   ```

2. **Run the Server**
   To run the API locally, execute the following command:
   ```bash
   uvicorn main:app --reload
   ```
   The server will start at `http://127.0.0.1:8000`.

3. **API Documentation**
   FastAPI automatically generates interactive API documentation. Once the server is running, you can access:
   - **Swagger UI:** `http://127.0.0.1:8000/docs`
   - **ReDoc:** `http://127.0.0.1:8000/redoc`

## Data Models
The application uses in-memory Python dictionaries and lists for easy prototyping, structured efficiently so that a NoSQL database cluster (such as MongoDB) can take its place trivially.
