# SaluLink Authi API (backend)

FastAPI service for clinical note analysis (ClinicalBERT + condition matching).

## Setup

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Run

From monorepo root:

```bash
npm run dev:api
```

Or from this folder:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Health: http://localhost:8000/health — expect `authi_build: epilepsy_syndrome_v1`.
