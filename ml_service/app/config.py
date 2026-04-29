from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[1]
MODEL_DIR = BASE_DIR / "models"
MODEL_PATH = MODEL_DIR / "student_random_forest.joblib"

FEATURE_COLUMNS = [
    "attendance_percentage",
    "average_marks",
    "last_test_score",
    "previous_test_score",
    "assignment_score",
    "participation_score",
    "missing_assignments",
    "study_hours_per_week",
    "late_submissions",
    "performance_trend_score",
]

GRADE_LABELS = ["A", "B", "C"]

TREND_LABELS = {
    -1: "Falling",
    0: "Stable",
    1: "Rising",
}
