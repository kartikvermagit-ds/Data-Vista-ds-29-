from functools import lru_cache

import joblib
import pandas as pd

from app.config import FEATURE_COLUMNS, MODEL_PATH, TREND_LABELS
from app.schemas.prediction import PredictionResponse, StudentFeatures


class ModelNotTrainedError(RuntimeError):
    pass


def calculate_trend_score(features: StudentFeatures) -> int:
    delta = features.last_test_score - features.previous_test_score
    if delta >= 5:
        return 1
    if delta <= -5:
        return -1
    return 0


def calculate_risk_label(grade: str, confidence: float, features: StudentFeatures) -> str:
    if grade == "C" or features.attendance_percentage < 70 or features.assignment_score < 60:
        return "At Risk"
    if confidence < 0.55:
        return "At Risk"
    return "Safe"


@lru_cache(maxsize=1)
def load_model_bundle() -> dict:
    if not MODEL_PATH.exists():
        raise ModelNotTrainedError(
            f"Model artifact not found at {MODEL_PATH}. Run `python scripts/train_model.py` first."
        )
    return joblib.load(MODEL_PATH)


def to_feature_frame(features: StudentFeatures) -> pd.DataFrame:
    row = features.model_dump()
    row["performance_trend_score"] = calculate_trend_score(features)
    return pd.DataFrame([{column: row[column] for column in FEATURE_COLUMNS}])


def predict_one(features: StudentFeatures) -> PredictionResponse:
    bundle = load_model_bundle()
    model = bundle["model"]
    feature_importance = bundle["feature_importance"]

    frame = to_feature_frame(features)
    predicted_grade = str(model.predict(frame)[0])
    probabilities = model.predict_proba(frame)[0]
    confidence = round(float(probabilities.max()), 4)
    trend_score = calculate_trend_score(features)

    return PredictionResponse(
        student_id=features.student_id,
        student_name=features.student_name,
        predicted_grade=predicted_grade,
        risk_label=calculate_risk_label(predicted_grade, confidence, features),
        confidence=confidence,
        trend=TREND_LABELS[trend_score],
        feature_importance=feature_importance,
    )
