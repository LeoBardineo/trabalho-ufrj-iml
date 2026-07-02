# Integração de Modelos e Endpoints de IA (Multi-Modelo)

Este documento descreve as especificações técnicas de integração dos modelos de Machine Learning no back-end e como eles são servidos em lote para comparação na interface web.

---

## 1. Mapeamento de Modelos (`ml_pipeline/`)

Os arquivos de modelos serializados (`.pkl`) são organizados da seguinte forma no repositório:

*   **Supervisionados (Árvore de Decisão)**:
    *   `arvore-de-decisao/dt_base_sl.pkl` -> Modelo de Árvore padrão.
    *   `arvore-de-decisao/dt_results_sl.pkl` -> Modelo de Árvore otimizado via Grid Search.
*   **Supervisionados (XGBoost)**:
    *   `xgboost/xgb_base_sl.pkl` -> Modelo XGBoost padrão.
    *   `xgboost/xgb_results_sl.pkl` -> Modelo XGBoost otimizado via Grid Search.
*   **Não-Supervisionados (Agrupamento e Anomalia)**:
    *   `nao-supervisionados/kmeans_35.pkl` -> Modelo K-Means treinado com 2 clusters.
    *   `nao-supervisionados/isolation_forest_35.pkl` -> Modelo Isolation Forest treinado para anomalias.
    *   `nao-supervisionados/scaler_35.pkl` -> StandardScaler para normalização dos atributos.
    *   `nao-supervisionados/pca_35.pkl` -> Redutor PCA (23 componentes principais).

---

## 2. Lógica de Execução no Servidor (FastAPI)

Para otimizar a performance da predição em tempo real e evitar múltiplas chamadas HTTP, o endpoint principal `/predict` funciona da seguinte forma:

1.  **Extração de Atributos (Única)**: O extrator dinâmico de características analisa a URL inserida pelo usuário e constrói um vetor com mais de 50 propriedades léxicas e estruturais uma única vez.
2.  **Iteração Lote (Batch)**: O servidor percorre todos os 6 modelos ativos cadastrados em memória.
3.  **Sistema de Cache**: Para evitar gargalos de I/O em disco, os estimadores carregados são mantidos em cache na memória RAM do servidor (`_cache`).
4.  **Inferência**:
    *   **Supervisionados**: A classificação é feita filtrando e ordenando as colunas conforme o `feature_names_in_` do modelo carregado, chamando `predict` e obtendo a probabilidade com `predict_proba`.
    *   **Não-Supervisionados**: Os dados são primeiramente normalizados com o `StandardScaler`.
        *   **K-Means**: Os dados escalados são reduzidos via `PCA` (23 componentes principais) e enviados ao modelo, retornando o cluster correspondente. Adicionalmente, as duas primeiras componentes principais do PCA são salvas para o gráfico de dispersão 2D.
        *   **Isolation Forest**: Classifica os dados normalizados de forma direta. Retorna `-1` para Phishing (anomalia) ou `1` para Legítimo.

---

## 3. Schemas de Requisição e Resposta (API JSON)

### Requisição:
`POST /predict`
```json
{
  "url": "https://url-para-ser-analisada.com"
}
```

### Resposta Consolidada:
`PredictResponse`
```json
{
  "url": "https://url-para-ser-analisada.com",
  "features": {
    "URLlength": 34,
    "IsHTTPS": 1,
    "NoOfLetters": 22
  },
  "predictions": {
    "arvore_otimizado": {
      "prediction": 0,
      "label": "phishing",
      "phishing_probability": 0.985,
      "decision_path": [
        { "node_id": 0, "feature": "IsHTTPS", "threshold": 0.5, "value": 1.0, "decision": "right", "is_leaf": false },
        { "node_id": 2, "feature": null, "threshold": null, "value": null, "decision": "leaf", "is_leaf": true }
      ],
      "full_tree": {
        "node_id": 0,
        "is_leaf": false,
        "feature": "IsHTTPS",
        "threshold": 0.5,
        "samples": 188636,
        "value": [80636, 108000],
        "class_name": "Legítimo"
      }
    },
    "kmeans": {
      "prediction": 1,
      "label": "legitimate",
      "pca_coords": {
        "pc1": 1.45,
        "pc2": -0.89
      }
    }
  }
}
```
