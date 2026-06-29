from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import pandas as pd
import json
import os

from app.services.feature_extractor import extract_features
from app.services.model_loader import load_model, load_unsupervised_pipeline, MODELS, DEFAULT_MODEL

router = APIRouter(prefix="/predict", tags=["predict"])

STATIC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "static"))

class PcaCoords(BaseModel):
    pc1: float
    pc2: float

class DecisionPathNode(BaseModel):
    node_id: int
    feature: str | None = None
    threshold: float | None = None
    value: float | None = None
    decision: str | None = None  # "left", "right" ou "leaf"
    is_leaf: bool

class PredictRequest(BaseModel):
    url: str
    model_key: str = DEFAULT_MODEL  # padrão é "arvore_otimizado"

class PredictResponse(BaseModel):
    url: str
    features: dict
    prediction: int | None
    label: str | None
    model_used: str
    phishing_probability: float | None = None
    pca_coords: PcaCoords | None = None
    decision_path: list[DecisionPathNode] | None = None
    full_tree: dict | None = None  # Estrutura completa da árvore de decisão

def get_tree_dict(node_id: int, tree_, feature_names: list[str]):
    feature_idx = int(tree_.feature[node_id])
    is_leaf = feature_idx == -2
    
    val_array = tree_.value[node_id][0]
    value_list = [float(v) for v in val_array]
    samples = int(tree_.n_node_samples[node_id])
    
    dominant_class = "Phishing" if value_list[0] > value_list[1] else "Legítimo"
    impurity = float(tree_.impurity[node_id])
    
    if is_leaf:
        return {
            "node_id": node_id,
            "is_leaf": True,
            "samples": samples,
            "value": value_list,
            "class_name": dominant_class,
            "impurity": impurity
        }
    
    feature_name = feature_names[feature_idx]
    threshold = float(tree_.threshold[node_id])
    
    return {
        "node_id": node_id,
        "is_leaf": False,
        "feature": feature_name,
        "threshold": threshold,
        "samples": samples,
        "value": value_list,
        "class_name": dominant_class,
        "impurity": impurity,
        "left": get_tree_dict(int(tree_.children_left[node_id]), tree_, feature_names),
        "right": get_tree_dict(int(tree_.children_right[node_id]), tree_, feature_names)
    }

@router.get("/pca-data")
def get_pca_data():
    """Retorna os pontos de background do PCA para renderização do scatter plot."""
    path = os.path.join(STATIC_DIR, "pca_sample.json")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="PCA sample data not found.")
    try:
        with open(path, "r") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read PCA data: {e}")

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
        df = pd.DataFrame([features])
        
        # 1. Calcular coordenadas PCA (apenas para o modelo kmeans)
        pca_coords = None
        if model_key == "kmeans":
            scaler, pca = load_unsupervised_pipeline()
            X_scaled = scaler.transform(df[scaler.feature_names_in_])
            X_pca = pca.transform(X_scaled)[0]
            pca_coords = PcaCoords(pc1=float(X_pca[0]), pc2=float(X_pca[1]))

        phishing_probability = None
        decision_path_list = None
        full_tree = None

        if model_key in ("kmeans", "isolation_forest"):
            # Pipeline não-supervisionado: normalizar
            scaler, pca = load_unsupervised_pipeline()
            X_scaled = scaler.transform(df[scaler.feature_names_in_])
            
            if model_key == "kmeans":
                # K-Means exige redução de dimensionalidade PCA
                X = pca.transform(X_scaled)
                pred_raw = int(model.predict(X)[0])
                prediction = pred_raw
            else:
                # Isolation Forest foi treinado diretamente nos 34 atributos escalados
                pred_raw = int(model.predict(X_scaled)[0])
                # Isolation Forest mapeou -1 para Phishing (anomalia) e 1 para Legítimo (normal)
                prediction = 0 if pred_raw == -1 else 1
                
            label = "legitimate" if prediction == 1 else "phishing"
        else:
            # Modelos supervisionados
            expected_features = list(model.feature_names_in_)
            df_input = df[expected_features]
            
            prediction = int(model.predict(df_input)[0])
            label = "legitimate" if prediction == 1 else "phishing"

            # Calcular Probabilidade de Phishing (Classe 0)
            if hasattr(model, "predict_proba"):
                proba = model.predict_proba(df_input)[0]
                phishing_probability = float(proba[0])

            # Extrair caminho de decisão para Árvores de Decisão
            if model_key in ("arvore_base", "arvore_otimizado"):
                indicator = model.decision_path(df_input)
                node_indices = indicator.indices.tolist()
                
                tree_ = model.tree_
                feature_names = list(model.feature_names_in_)
                
                # Serializar a árvore inteira para o frontend plotar a árvore estruturada
                full_tree = get_tree_dict(0, tree_, feature_names)
                
                decision_path_list = []
                for node_id in node_indices:
                    feature_idx = tree_.feature[node_id]
                    is_leaf = feature_idx == -2
                    
                    if is_leaf:
                        decision_path_list.append(DecisionPathNode(
                            node_id=node_id,
                            feature=None,
                            threshold=None,
                            value=None,
                            decision="leaf",
                            is_leaf=True
                        ))
                    else:
                        feature_name = feature_names[feature_idx]
                        threshold = float(tree_.threshold[node_id])
                        val = float(df_input.iloc[0][feature_name])
                        decision = "left" if val <= threshold else "right"
                        
                        decision_path_list.append(DecisionPathNode(
                            node_id=node_id,
                            feature=feature_name,
                            threshold=threshold,
                            value=val,
                            decision=decision,
                            is_leaf=False
                        ))

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro na predição: {e}")

    return PredictResponse(
        url=body.url,
        features=features,
        prediction=prediction,
        label=label,
        model_used=model_key,
        phishing_probability=phishing_probability,
        pca_coords=pca_coords,
        decision_path=decision_path_list,
        full_tree=full_tree,
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
