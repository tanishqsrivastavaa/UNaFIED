import random
from pydantic_ai import RunContext


#sample testing tool
def get_weather(location: str) -> str:
    conditions= ["Sunny","Rainy","Cloudy","Stormy"]
    temp= random.randint(15, 30)
    return f"The weather in {location} is {random.choice(conditions)} with temperature of {temp}°C"



# 2. (Future) MCP Connection Snippet
# If you later want to connect to an external MCP server (e.g., a real weather API server):
# from pydantic_ai.mcp import MCPServerHTTP
# weather_mcp_server = MCPServerHTTP(url='http://localhost:8000/sse')