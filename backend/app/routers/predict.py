from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl

from app.services.feature_extractor import extract_features

router = APIRouter(prefix="/predict", tags=["predict"])


class PredictRequest(BaseModel):
    url: str


class PredictResponse(BaseModel):
    url: str
    features: dict
    prediction: int | None
    label: str | None


@router.post("", response_model=PredictResponse)
def predict(body: PredictRequest):
    try:
        features = extract_features(body.url)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to extract features: {e}")

    # Modelo será plugado aqui uma vez que esteja disponível.
    prediction = None
    label = None

    return PredictResponse(
        url=body.url,
        features=features,
        prediction=prediction,
        label=label,
    )
