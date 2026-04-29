from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split

from app.config import FEATURE_COLUMNS, MODEL_PATH


ROOT = Path(__file__).resolve().parents[1]
DATASET_PATH = ROOT / "data" / "student_performance_sample.csv"


def main() -> None:
    if not DATASET_PATH.exists():
        raise FileNotFoundError(
            f"Dataset not found at {DATASET_PATH}. Run `python scripts/generate_sample_dataset.py` first."
        )

    data = pd.read_csv(DATASET_PATH)
    x = data[FEATURE_COLUMNS]
    y = data["grade"]

    x_train, x_test, y_train, y_test = train_test_split(
        x,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y,
    )

    model = RandomForestClassifier(
        n_estimators=300,
        max_depth=8,
        min_samples_split=4,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )
    model.fit(x_train, y_train)

    predictions = model.predict(x_test)
    accuracy = accuracy_score(y_test, predictions)
    matrix = confusion_matrix(y_test, predictions, labels=sorted(y.unique()))
    report = classification_report(y_test, predictions)
    importance = {
        feature: round(float(score), 4)
        for feature, score in sorted(
            zip(FEATURE_COLUMNS, model.feature_importances_),
            key=lambda item: item[1],
            reverse=True,
        )
    }

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(
        {
            "model": model,
            "feature_columns": FEATURE_COLUMNS,
            "accuracy": round(float(accuracy), 4),
            "confusion_matrix": matrix.tolist(),
            "classification_report": report,
            "feature_importance": importance,
        },
        MODEL_PATH,
    )

    print(f"Accuracy: {accuracy:.3f}")
    print("Confusion matrix:")
    print(matrix)
    print(report)
    print(f"Saved model to {MODEL_PATH}")


if __name__ == "__main__":
    main()
