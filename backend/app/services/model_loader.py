import joblib
import os

BASE_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "ml_pipeline"))

MODELS = {
    # Supervisionados - Árvore de Decisão
    "arvore_base":      ("arvore-de-decisao/dt_base_final.pkl",    "df_35", "estimator"),
    "arvore_otimizado": ("arvore-de-decisao/dt_results_final.pkl", "df_35", "best_estimator"),

    # Supervisionados - XGBoost  
    "xgboost_base":      ("xgboost/xgb_base_final.pkl",    "df_35", "estimator"),
    "xgboost_otimizado": ("xgboost/xgb_results_final.pkl", "df_35", "best_estimator"),

    # Nao-supervisionados (pipeline: scaler -> pca -> modelo)
    "kmeans":            ("nao-supervisionados/kmeans_35.pkl", None, None),
    "isolation_forest":  ("nao-supervisionados/isolation_forest_35.pkl", None, None),
}

DEFAULT_MODEL = "arvore_otimizado"

_cache = {}

def load_model(model_key: str):
    if model_key not in _cache:
        if model_key not in MODELS:
            raise ValueError(f"Modelo '{model_key}' desconhecido.")
        
        path, dataset_key, estimator_key = MODELS[model_key]
        full_path = os.path.abspath(os.path.join(BASE_PATH, path))
        
        if not os.path.exists(full_path):
            raise FileNotFoundError(f"Arquivo do modelo não encontrado: {full_path}")
            
        data = joblib.load(full_path)

        if dataset_key and estimator_key:
            _cache[model_key] = data[dataset_key][estimator_key]
        else:
            _cache[model_key] = data  # para modelos não-supervisionados

    return _cache[model_key]

def load_unsupervised_pipeline():
    """Carrega scaler + pca necessários para os modelos não-supervisionados."""
    scaler_path = os.path.abspath(os.path.join(BASE_PATH, "nao-supervisionados/scaler_35.pkl"))
    pca_path = os.path.abspath(os.path.join(BASE_PATH, "nao-supervisionados/pca_35.pkl"))
    
    if not os.path.exists(scaler_path) or not os.path.exists(pca_path):
        raise FileNotFoundError("Scaler ou PCA não encontrados para o pipeline não-supervisionado.")
        
    scaler = joblib.load(scaler_path)
    pca = joblib.load(pca_path)
    return scaler, pca
