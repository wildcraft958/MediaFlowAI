"""
Vector store backed by Google BigQuery Vector Search.
- Dataset:  agrowise-192e3.frammer_vectors
- Tables:   kpi_embeddings, dimension_embeddings
- Embeddings: Vertex AI text-embedding-005

Documents are upserted on first call and cached for the process lifetime.
BigQuery handles persistence — no local files, no external DB.
"""
from __future__ import annotations
import pathlib
import yaml
from api.llm import GCP_PROJECT, GCP_REGION

_ROOT = pathlib.Path(__file__).parents[1]

BQ_DATASET  = "frammer_vectors"
BQ_LOCATION = "US"
EMBED_MODEL = "text-embedding-005"

_kpi_store = None
_dim_store = None


def _get_embeddings():
    from langchain_google_vertexai import VertexAIEmbeddings
    return VertexAIEmbeddings(
        model_name=EMBED_MODEL,
        project=GCP_PROJECT,
        location=GCP_REGION,
    )


def _get_kpi_store():
    global _kpi_store
    if _kpi_store is not None:
        return _kpi_store

    from langchain_google_community.bq_storage_vectorstores.bigquery import BigQueryVectorStore

    with open(_ROOT / "config" / "metric_registry.yaml") as f:
        registry = yaml.safe_load(f)["metrics"]

    texts, metadatas = [], []
    for acronym, kpi in registry.items():
        texts.append(f"{kpi['name']} ({acronym}): {kpi['description']}")
        metadatas.append({
            "acronym": acronym,
            "page": kpi.get("dashboard_page", ""),
            "doc_type": "kpi",
        })

    store = BigQueryVectorStore(
        project_id=GCP_PROJECT,
        dataset_name=BQ_DATASET,
        table_name="kpi_embeddings",
        location=BQ_LOCATION,
        embedding=_get_embeddings(),
    )
    store.add_texts(texts=texts, metadatas=metadatas)
    _kpi_store = store
    return _kpi_store


def _get_dim_store():
    global _dim_store
    if _dim_store is not None:
        return _dim_store

    from langchain_google_community.bq_storage_vectorstores.bigquery import BigQueryVectorStore

    with open(_ROOT / "config" / "dimensions.yaml") as f:
        dims = yaml.safe_load(f)["dimensions"]

    texts, metadatas = [], []
    for dim_name, dim_data in dims.items():
        for val in dim_data.get("values", []):
            texts.append(f"{dim_name}: {val} — {dim_data.get('description', '')}")
            metadatas.append({
                "dimension": dim_name,
                "value": str(val),
                "doc_type": "dimension",
            })

    store = BigQueryVectorStore(
        project_id=GCP_PROJECT,
        dataset_name=BQ_DATASET,
        table_name="dimension_embeddings",
        location=BQ_LOCATION,
        embedding=_get_embeddings(),
    )
    store.add_texts(texts=texts, metadatas=metadatas)
    _dim_store = store
    return _dim_store


def query_kpi_similarity(query: str, n_results: int = 3) -> list[dict]:
    """
    Returns top-n KPI matches from BigQuery Vector Search.
    Each result: {acronym, document, score}
    """
    store = _get_kpi_store()
    results = store.similarity_search_with_score(query, k=n_results)
    return [
        {
            "acronym": doc.metadata["acronym"],
            "document": doc.page_content,
            "score": float(score),
        }
        for doc, score in results
    ]
