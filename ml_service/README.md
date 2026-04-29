# DataVista ML Service

FastAPI Random Forest service for student performance prediction.

## Problem

The model predicts:

- `predicted_grade`: `A`, `B`, or `C`
- `risk_label`: `Safe` or `At Risk`
- `confidence`: highest class probability from `RandomForestClassifier.predict_proba`
- `trend`: `Rising`, `Falling`, or `Stable`, calculated from recent test score movement

## Features

Training columns:

- `attendance_percentage`
- `average_marks`
- `last_test_score`
- `previous_test_score`
- `assignment_score`
- `participation_score`
- `missing_assignments`
- `study_hours_per_week`
- `late_submissions`
- `performance_trend_score`

The sample dataset is at `data/student_performance_sample.csv` and contains 100 realistic rows.

## Local Setup

```bash
cd ml_service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python scripts/train_model.py
uvicorn app.main:app --reload --port 8000
```

Health check:

```bash
curl http://localhost:8000/health
```

Single prediction:

```bash
curl -X POST http://localhost:8000/predict ^
  -H "Content-Type: application/json" ^
  -d "{\"student_id\":\"student-1\",\"student_name\":\"Aarav\",\"attendance_percentage\":88,\"average_marks\":76,\"last_test_score\":80,\"previous_test_score\":72,\"assignment_score\":84,\"participation_score\":78,\"missing_assignments\":1,\"study_hours_per_week\":8,\"late_submissions\":0}"
```

Batch prediction:

```bash
curl -X POST http://localhost:8000/predict/batch ^
  -H "Content-Type: application/json" ^
  -d "{\"students\":[{\"student_id\":\"student-1\",\"student_name\":\"Aarav\",\"attendance_percentage\":88,\"average_marks\":76,\"last_test_score\":80,\"previous_test_score\":72,\"assignment_score\":84,\"participation_score\":78,\"missing_assignments\":1,\"study_hours_per_week\":8,\"late_submissions\":0}]}"
```

## Model Training

`scripts/train_model.py` uses:

- `RandomForestClassifier`
- `n_estimators=300`
- `max_depth=8`
- `min_samples_split=4`
- `min_samples_leaf=2`
- `class_weight="balanced"`
- `test_size=0.2`
- `stratify=y`

The script prints accuracy, confusion matrix, and classification report, then saves `models/student_random_forest.joblib`.

## Deployment

Render can use `ml_service/render.yaml`.

Build command:

```bash
pip install -r requirements.txt && python scripts/train_model.py
```

Start command:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

After deployment, set the React app variable:

```bash
VITE_ML_API_URL=https://your-datavista-ml-api.onrender.com
```

## Future Upgrades

- Replace Random Forest with XGBoost for stronger tabular performance.
- Add model versioning and prediction audit logs.
- Retrain from Supabase exports on a scheduled job.
- Add SHAP explanations for per-student intervention reasons.
