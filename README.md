# SaluLink Operations — Monorepo

Single repository: **frontend** (Next.js) + **backend** (Authi FastAPI).

## Structure

```
SaluLink-Merge/
├── frontend/              # Next.js UI only
│   ├── app/
│   ├── components/
│   ├── public/            # CSVs synced from shared/data
│   └── .env.local         # PYTHON_BACKEND_URL=http://localhost:8000
├── backend/               # Python Authi API only
│   ├── main.py
│   ├── requirements.txt
│   └── *.csv              # synced from shared/data (for deploy)
├── shared/data/           # Canonical CSV datasets
├── scripts/sync-data.mjs
└── package.json
```

## Prerequisites

- Node.js 18+
- Python 3.10+

## Quick start

From **`SaluLink-Merge/`**:

```bash
npm install

# Python (first time)
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cd ..

# Run API + web
npm run dev
```

- Web: [http://localhost:3000](http://localhost:3000)
- API: [http://localhost:8000](http://localhost:8000)
- Health check: [http://localhost:8000/health](http://localhost:8000/health) — expect `"authi_build": "epilepsy_syndrome_v1"`

## Environment

```bash
cp frontend/.env.example frontend/.env.local
```

```env
PYTHON_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Data files

Edit CSVs in **`shared/data/`**, then:

```bash
npm run sync:data
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Sync data + API + frontend |
| `npm run dev:web` | Frontend only (port 3000) |
| `npm run dev:api` | Backend only (port 8000, uses `backend/venv`) |
| `npm run sync:data` | Copy CSVs to frontend/public and backend |
| `npm run build:web` | Production Next.js build |

If port **8000** is in use: `kill $(lsof -ti :8000)` then run `npm run dev:api` again.

## Deploy

| App | Directory | Host |
|-----|-----------|------|
| Web | `frontend` | Vercel (root = `frontend`) |
| API | `backend` | Railway / Render (port 8000) |

Set `PYTHON_BACKEND_URL` on the web app to your deployed API URL.
