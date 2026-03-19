"""
ChromaDB vector store with Vertex AI embeddings.
Replaces sentence-transformers — all embeddings run on Vertex AI (text-embedding-004).
"""
from __future__ import annotations
import pathlib
import yaml
from api.llm import GCP_PROJECT, GCP_REGION

_ROOT = pathlib.Path(__file__).parents[1]

_chroma_client = None
_kpi_collection = None
_dim_collection = None

EMBEDDING_MODEL = "text-embedding-004"  # Vertex AI text embedding model


def _get_client():
    global _chroma_client
    if _chroma_client is None:
        import chromadb
        _chroma_client = chromadb.PersistentClient(path=str(_ROOT / ".chromadb"))
    return _chroma_client


def _get_embedding_fn():
    """Vertex AI embedding function for ChromaDB."""
    from chromadb import EmbeddingFunction, Embeddings
    from langchain_google_vertexai import VertexAIEmbeddings

    class VertexEmbeddingFn(EmbeddingFunction):
        def __init__(self):
            self._model = VertexAIEmbeddings(
                model_name=EMBEDDING_MODEL,
                project=GCP_PROJECT,
                location=GCP_REGION,
            )

        def __call__(self, input: list[str]) -> Embeddings:
            return self._model.embed_documents(input)

    return VertexEmbeddingFn()


def get_kpi_collection():
    global _kpi_collection
    if _kpi_collection is not None:
        return _kpi_collection
    client = _get_client()
    ef = _get_embedding_fn()
    _kpi_collection = client.get_or_create_collection(
        name="kpi_definitions_vertex", embedding_function=ef
    )
    if _kpi_collection.count() == 0:
        _seed_kpis(_kpi_collection)
    return _kpi_collection


def get_dim_collection():
    global _dim_collection
    if _dim_collection is not None:
        return _dim_collection
    client = _get_client()
    ef = _get_embedding_fn()
    _dim_collection = client.get_or_create_collection(
        name="dimension_values_vertex", embedding_function=ef
    )
    if _dim_collection.count() == 0:
        _seed_dimensions(_dim_collection)
    return _dim_collection


def _seed_kpis(collection):
    with open(_ROOT / "config" / "metric_registry.yaml") as f:
        registry = yaml.safe_load(f)["metrics"]
    docs, ids, metas = [], [], []
    for acronym, kpi in registry.items():
        text = f"{kpi['name']} ({acronym}): {kpi['description']}"
        docs.append(text)
        ids.append(f"kpi_{acronym}")
        metas.append({"acronym": acronym, "page": kpi.get("dashboard_page", "")})
    collection.add(documents=docs, ids=ids, metadatas=metas)


def _seed_dimensions(collection):
    with open(_ROOT / "config" / "dimensions.yaml") as f:
        dims = yaml.safe_load(f)["dimensions"]
    docs, ids, metas = [], [], []
    for dim_name, dim_data in dims.items():
        values = dim_data.get("values", [])
        if not values:
            continue
        for val in values:
            text = f"{dim_name}: {val} — {dim_data.get('description', '')}"
            safe_val = str(val).replace(" ", "_").replace("-", "_")
            docs.append(text)
            ids.append(f"dim_{dim_name}_{safe_val}")
            metas.append({"dimension": dim_name, "value": str(val)})
    collection.add(documents=docs, ids=ids, metadatas=metas)


def query_kpi_similarity(query: str, n_results: int = 3) -> list[dict]:
    """Returns top-n KPI matches with distances."""
    coll = get_kpi_collection()
    results = coll.query(query_texts=[query], n_results=min(n_results, coll.count()))
    out = []
    for doc, meta, dist in zip(
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0],
    ):
        out.append({"document": doc, "acronym": meta["acronym"], "distance": dist})
    return out
