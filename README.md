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

```bash
# 1. Gå till backend-mappen:
cd backend
# 2. Aktivera virtual environment:
# Windows:
venv\Scripts\activate

# Linux/Mac: 
# source venv/bin/activate 
# 3. Installera beroenden:
pip install -r requirements.txt
# 4. Starta servern:
fastapi dev main.py
```

### Frontend

```bash
# 1. Gå till frontend-mappen:
cd frontend
# 2. Installera beroenden:
npm install
# 3. Starta dev-servern:
npm run dev
```

## Anvaandning

- Backend swagger körs på: [http://localhost:8000/docs](http://localhost:8000/docs)
- Frontend körs på: [http://localhost:5173](http://localhost:5173)

## Licens

MIT License
