"""
Central LLM client — Google Vertex AI via langchain-google-genai.

All agent and API code imports complete() / chat() from here.
One place to swap model or region.

Env vars (set in .env):
  GOOGLE_APPLICATION_CREDENTIALS  path to GCP service account JSON
  GCP_PROJECT_ID                   agrowise-192e3
  GCP_REGION                       us-central1  (default)
  VERTEX_MODEL                     gemini-2.0-flash  (default)
"""
from __future__ import annotations
import os
import warnings
from functools import lru_cache

from dotenv import load_dotenv
load_dotenv()

# ChatVertexAI emits a DeprecationWarning recommending ChatGoogleGenerativeAI;
# suppress it so pytest -W error runs clean.
warnings.filterwarnings("ignore", message="Use.*ChatGoogleGenerativeAI", category=DeprecationWarning)

GCP_PROJECT  = os.environ.get("GCP_PROJECT_ID", "agrowise-192e3")
GCP_REGION   = os.environ.get("GCP_REGION", "us-central1")
VERTEX_MODEL = os.environ.get("VERTEX_MODEL", "gemini-2.0-flash")


@lru_cache(maxsize=4)
def get_llm(temperature: float = 0.0, max_tokens: int = 1024):
    """Return a cached ChatVertexAI instance backed by Vertex AI service account."""
    from langchain_google_vertexai import ChatVertexAI
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", DeprecationWarning)
        return ChatVertexAI(
            model_name=VERTEX_MODEL,
            project=GCP_PROJECT,
            location=GCP_REGION,
            temperature=temperature,
            max_output_tokens=max_tokens,
        )


def complete(
    prompt: str,
    system: str = "",
    temperature: float = 0.0,
    max_tokens: int = 1024,
) -> str:
    """Single-turn completion. Returns response text."""
    from langchain_core.messages import HumanMessage, SystemMessage
    llm = get_llm(temperature=temperature, max_tokens=max_tokens)
    messages = []
    if system:
        messages.append(SystemMessage(content=system))
    messages.append(HumanMessage(content=prompt))
    return llm.invoke(messages).content


def chat(
    history: list[dict],
    system: str = "",
    temperature: float = 0.0,
    max_tokens: int = 1024,
) -> str:
    """
    Multi-turn chat.
    history = [{"role": "user"|"assistant", "content": str}, ...]
    Returns assistant response text.
    """
    from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
    llm = get_llm(temperature=temperature, max_tokens=max_tokens)
    messages = []
    if system:
        messages.append(SystemMessage(content=system))
    for msg in history:
        content = msg.get("content", "")
        if msg.get("role") == "user":
            messages.append(HumanMessage(content=content))
        else:
            messages.append(AIMessage(content=content))
    return llm.invoke(messages).content
