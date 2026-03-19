"""MCP server: web search (Vertex AI Google Search grounding) + chart analysis tools."""
from mcp.server.fastmcp import FastMCP
import json
import os

mcp = FastMCP("MediaFlow Context Server")


@mcp.tool()
def web_search(query: str) -> str:
    """Search the web for external context (industry benchmarks, definitions, best practices).

    Uses Vertex AI Gemini with Google Search grounding — no extra API key needed.
    """
    try:
        import vertexai
        from vertexai.generative_models import GenerativeModel, Tool, grounding

        project = os.environ.get("GCP_PROJECT_ID", "agrowise-192e3")
        location = os.environ.get("GCP_REGION", "us-central1")
        vertexai.init(project=project, location=location)

        model = GenerativeModel(os.environ.get("VERTEX_MODEL", "gemini-2.0-flash"))
        search_tool = Tool.from_google_search_retrieval(
            grounding.GoogleSearchRetrieval()
        )
        response = model.generate_content(
            f"Search the web and summarize the top 3 results for: {query}",
            tools=[search_tool],
        )
        return response.text[:1500]
    except Exception as e:
        return f"Web search unavailable ({e}). Answer from available dashboard data."


@mcp.tool()
def analyze_chart_data(chart_json: str) -> str:
    """Analyze structured chart data (JSON with axes, series, values). Returns summary insights."""
    try:
        data = json.loads(chart_json)
        return json.dumps(
            {
                "type": data.get("type", "unknown"),
                "title": data.get("title", ""),
                "data_points": len(data.get("data", [])),
                "columns": list(data.get("data", [{}])[0].keys())
                if data.get("data")
                else [],
                "sample": data.get("data", [])[:5],
            }
        )
    except Exception as e:
        return f"Could not parse chart data: {e}"


if __name__ == "__main__":
    mcp.run(transport="stdio")
