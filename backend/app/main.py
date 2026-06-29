from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import predict, notebooks

app = FastAPI(title="Deep Phishing API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://frontend:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(predict.router)
app.include_router(notebooks.router)


@app.get("/health")
def health():
    return {"status": "ok"}

