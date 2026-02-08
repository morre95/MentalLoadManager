# MentalLoadManager

## Beskrivning
Detta fullstack-projekt skapades automatiskt med setup_projekt.bat

## Projektstruktur

```
MentalLoadManager/
├── backend/          # Python Flask/FastAPI backend
│   ├── venv/         # Virtual environment
│   ├── requirements.txt
│   └── main.py
├── frontend/         # Vite + React/Vue frontend
│   ├── src/
│   ├── public/
│   └── package.json
└── README.md
```

## Installation

### Backend

1. Gaa till backend-mappen: `cd backend`
2. Aktivera virtual environment:
   - Windows: `venv\Scripts\activate`
   - Linux/Mac: `source venv/bin/activate`
3. Installera beroenden: `pip install -r requirements.txt`
4. Starta servern: `python main.py`

### Frontend

1. Gaa till frontend-mappen: `cd frontend`
2. Installera beroenden: `npm install`
3. Starta dev-servern: `npm run dev`

## Anvaandning

- Backend kors paa: `http://localhost:5000` (eller din konfigurerade port)
- Frontend kors paa: `http://localhost:5173` (Vite default)

## Licens

MIT License
