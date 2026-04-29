# DataVista AI Prediction System

This implementation adds a production-ready Random Forest prediction system that connects the React dashboard to a FastAPI ML backend.

## Architecture

- Frontend: Vite React dashboard
- ML API: FastAPI service in `ml_service`
- Model: `RandomForestClassifier`
- Dataset: `ml_service/data/student_performance_sample.csv`
- Supabase: existing teacher state plus optional `student_predictions` table
- Deployment: frontend on Vercel, ML API on Render or Railway

## Frontend Connection

Set this in Vercel:

```bash
VITE_ML_API_URL=https://your-datavista-ml-api.onrender.com
```

The dashboard and analysis pages render `PredictionInsightsPanel`, which calls:

- `POST /predict/batch`
- Shows predicted grade
- Shows confidence percentage
- Shows trend
- Shows At Risk alerts
- Shows feature importance chart

Relevant files:

- `src/lib/predictionApi.ts`
- `src/components/predictions/PredictionInsightsPanel.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/Analysis.tsx`

## Backend API

Start locally:

```bash
cd ml_service
pip install -r requirements.txt
python scripts/train_model.py
uvicorn app.main:app --reload --port 8000
```

Endpoints:

- `GET /health`
- `POST /predict`
- `POST /predict/batch`

Response shape:

```json
{
  "student_id": "student-101",
  "student_name": "Aarav Mehta",
  "predicted_grade": "B",
  "risk_label": "Safe",
  "confidence": 0.82,
  "trend": "Rising",
  "feature_importance": {
    "average_marks": 0.31,
    "last_test_score": 0.22
  }
}
```

## Supabase Storage

Run `supabase-predictions.sql` in the Supabase SQL editor to store prediction results. Keep prediction writes behind authenticated users, using `owner_id = auth.uid()`.

## Risk Alert Logic

The API marks a student `At Risk` when:

- predicted grade is `C`
- attendance is below 70
- assignment score is below 60
- model confidence is low

The frontend highlights this as an intervention alert.

## Advanced Scope

Next startup-level upgrades:

- Store every prediction in Supabase with model version.
- Add a scheduled retraining job from anonymized class data.
- Add XGBoost model comparison.
- Add SHAP explanations for each student.
- Add parent/teacher notification rules for sustained risk.
