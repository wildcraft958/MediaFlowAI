from fastapi import APIRouter
from api.config import DIMENSIONS

router = APIRouter()


@router.get("/dimensions")
def dimensions():
    """Return all dimension values from config — no DB query needed."""
    result = {}
    for dim_name, dim_data in DIMENSIONS.items():
        if dim_data.get("cardinality") != "continuous":
            result[dim_name] = dim_data.get("values", [])
    return result
