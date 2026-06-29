from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import pandas as pd

from app.services.feature_extractor import extract_features
from app.services.model_loader import load_model, load_unsupervised_pipeline, MODELS, DEFAULT_MODEL

router = APIRouter(prefix="/predict", tags=["predict"])

class PredictRequest(BaseModel):
    url: str
    model_key: str = DEFAULT_MODEL  # padrão é "arvore_otimizado"

class PredictResponse(BaseModel):
    url: str
    features: dict
    prediction: int | None
    label: str | None
    model_used: str

@router.post("", response_model=PredictResponse)
def predict(body: PredictRequest):
    try:
        features = extract_features(body.url)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to extract features: {e}")

    model_key = body.model_key
    if model_key not in MODELS:
        raise HTTPException(status_code=400, detail=f"Modelo '{model_key}' não encontrado.")

    try:
        model = load_model(model_key)
        
        # Criar DataFrame com as colunas que o modelo espera, na ordem correta
        df = pd.DataFrame([features])
        
        if model_key in ("kmeans", "isolation_forest"):
            # Pipeline não-supervisionado: normalizar
            scaler, pca = load_unsupervised_pipeline()
            X = scaler.transform(df[scaler.feature_names_in_])
            
            if model_key == "kmeans":
                # K-Means exige redução de dimensionalidade PCA
                X = pca.transform(X)
                pred_raw = int(model.predict(X)[0])
                prediction = pred_raw
            else:
                # Isolation Forest foi treinado diretamente nos 34 atributos escalados
                pred_raw = int(model.predict(X)[0])
                # Isolation Forest mapeou -1 para Phishing (anomalia) e 1 para Legítimo (normal)
                prediction = 0 if pred_raw == -1 else 1
                
            label = "legitimate" if prediction == 1 else "phishing"
        else:
            # Modelos supervisionados
            # Selecionar apenas as colunas que o classificador espera (dt_results_sl ou xgb_results_sl)
            expected_features = list(model.feature_names_in_)
            df_input = df[expected_features]
            
            prediction = int(model.predict(df_input)[0])
            # 1 é Legítimo, 0 é Phishing no dataset original
            label = "legitimate" if prediction == 1 else "phishing"

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro na predição: {e}")

    return PredictResponse(
        url=body.url,
        features=features,
        prediction=prediction,
        label=label,
        model_used=model_key,
    )

@router.get("/models")
def list_models():
    """Lista todos os modelos disponíveis para seleção no front-end."""
    return {
        "default": DEFAULT_MODEL,
        "models": [
            {"key": "arvore_otimizado",  "label": "Automático (Árvore de Decisão Otimizada)"},
            {"key": "arvore_base",       "label": "Árvore de Decisão Base"},
            {"key": "xgboost_otimizado", "label": "XGBoost Otimizado"},
            {"key": "xgboost_base",      "label": "XGBoost Base"},
            {"key": "kmeans",            "label": "K-Means (Não-Supervisionado)"},
            {"key": "isolation_forest",  "label": "Isolation Forest (Detecção de Anomalias)"},
        ]
    }
