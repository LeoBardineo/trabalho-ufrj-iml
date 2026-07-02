import joblib
import pandas as pd
import json
import os

print("Carregando scaler e PCA...")
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "ml_pipeline"))
scaler_path = os.path.join(BASE_DIR, "nao-supervisionados/scaler_35.pkl")
pca_path = os.path.join(BASE_DIR, "nao-supervisionados/pca_35.pkl")

scaler = joblib.load(scaler_path)
pca = joblib.load(pca_path)

print("Baixando amostra do dataset...")
# Usar a URL pública do dataset do projeto
csv_url = 'https://drive.google.com/uc?export=download&id=1gbfFzWO0A13gcKCULvnwdPaoY-cUeqoN'
df = pd.read_csv(csv_url, nrows=10000)

print("Processando dados...")
# Filtrar as colunas que o scaler espera
X_raw = df[scaler.feature_names_in_]
y = df['label'].values

# Transformações
X_scaled = scaler.transform(X_raw)
X_pca = pca.transform(X_scaled)

# Formatar pontos
pontos = []
for i in range(len(df)):
    pontos.append({
        "pc1": float(X_pca[i, 0]),
        "pc2": float(X_pca[i, 1]),
        "label": int(y[i])
    })

# Amostrar 500 legítimos (label=1) e 500 phishing (label=0) para deixar o plot limpo e rápido
legitimos = [p for p in pontos if p["label"] == 1][:500]
phishing = [p for p in pontos if p["label"] == 0][:500]
amostra = legitimos + phishing

out_path = os.path.join(os.path.dirname(__file__), "pca_sample.json")
with open(out_path, "w") as f:
    json.dump(amostra, f)

print(f"Salvo {len(amostra)} pontos em {out_path}")
