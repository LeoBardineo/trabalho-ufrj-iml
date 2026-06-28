import os
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

import nbformat
from nbconvert import HTMLExporter

router = APIRouter(prefix="/notebooks", tags=["notebooks"])

NOTEBOOKS_DIR = Path(os.environ.get("NOTEBOOKS_DIR", "notebooks"))


@router.get("")
def list_notebooks():
    """Lista todos os arquivos .ipynb na pasta de notebooks."""
    if not NOTEBOOKS_DIR.exists():
        return JSONResponse(content={"notebooks": []})

    notebooks = sorted(
        f.name for f in NOTEBOOKS_DIR.iterdir() if f.suffix == ".ipynb"
    )
    return {"notebooks": notebooks}


@router.get("/{filename}")
def render_notebook(filename: str):
    """Converte um notebook .ipynb para HTML e retorna."""
    if not filename.endswith(".ipynb"):
        raise HTTPException(status_code=400, detail="Arquivo deve ser .ipynb")

    filepath = NOTEBOOKS_DIR / filename

    if not filepath.exists():
        raise HTTPException(status_code=404, detail=f"Notebook '{filename}' não encontrado")

    try:
        with open(filepath, "r", encoding="utf-8") as f:
            nb = nbformat.read(f, as_version=4)

        exporter = HTMLExporter()
        exporter.template_name = "basic"
        body, _ = exporter.from_notebook_node(nb)

        return {"filename": filename, "html": body}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao renderizar notebook: {e}")
