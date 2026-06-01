# Shared clinical datasets

Edit these CSV files as the **single source of truth**:

- `Chronic Conditions.csv`
- `Medicine List.csv`
- `Treatment Basket.csv`

After changes, from the monorepo root:

```bash
npm run sync:data
```

Copies are written to `frontend/public/` and `backend/`.
