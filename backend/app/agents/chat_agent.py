from pathlib import Path
from pydantic_ai import Agent
from pydantic_ai.models.groq import GroqModel
from pydantic_ai.providers.groq import GroqProvider
from ..core.tools import get_weather
from dotenv import load_dotenv
import os
load_dotenv()
# from ..config.settings import Settings

# settings = Settings()

GROQ_API_KEY= os.getenv("GROQ_API_KEY")

prompt= Path("app/prompts/prompt.txt").read_text(encoding="utf-8")


chat_agent= Agent(
    GroqModel(
        model_name="llama-3.3-70b-versatile",
        provider=GroqProvider(api_key=GROQ_API_KEY)),
        system_prompt=prompt,
        tools=[get_weather],
        deps_type=str
        )
