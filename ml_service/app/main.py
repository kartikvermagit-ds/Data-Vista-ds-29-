from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.schemas.prediction import BatchPredictionRequest, BatchPredictionResponse, PredictionResponse, StudentFeatures
from app.services.model_service import ModelNotTrainedError, predict_one

app = FastAPI(
    title="DataVista Prediction API",
    version="1.0.0",
    description="Random Forest service for student grade, risk, confidence, and trend prediction.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/predict", response_model=PredictionResponse)
def predict(payload: StudentFeatures) -> PredictionResponse:
    try:
        return predict_one(payload)
    except ModelNotTrainedError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/predict/batch", response_model=BatchPredictionResponse)
def predict_batch(payload: BatchPredictionRequest) -> BatchPredictionResponse:
    try:
        return BatchPredictionResponse(predictions=[predict_one(student) for student in payload.students])
    except ModelNotTrainedError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
