from pydantic import BaseModel, Field


class StudentFeatures(BaseModel):
    student_id: str | None = Field(default=None, examples=["student-101"])
    student_name: str | None = Field(default=None, examples=["Aarav Mehta"])
    attendance_percentage: float = Field(ge=0, le=100)
    average_marks: float = Field(ge=0, le=100)
    last_test_score: float = Field(ge=0, le=100)
    previous_test_score: float = Field(ge=0, le=100)
    assignment_score: float = Field(ge=0, le=100)
    participation_score: float = Field(default=70, ge=0, le=100)
    missing_assignments: int = Field(default=0, ge=0, le=20)
    study_hours_per_week: float = Field(default=6, ge=0, le=80)
    late_submissions: int = Field(default=0, ge=0, le=20)


class PredictionResponse(BaseModel):
    student_id: str | None
    student_name: str | None
    predicted_grade: str
    risk_label: str
    confidence: float
    trend: str
    feature_importance: dict[str, float]


class BatchPredictionRequest(BaseModel):
    students: list[StudentFeatures]


class BatchPredictionResponse(BaseModel):
    predictions: list[PredictionResponse]
