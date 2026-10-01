from pathlib import Path
from pydantic_ai import Agent
from pydantic_ai.models.groq import GroqModel
from pydantic_ai.providers.groq import GroqProvider
from ..config.settings import settings


GROQ_API_KEY = settings.GROQ_API_KEY

prompt = Path("app/prompts/prompt.txt").read_text(encoding="utf-8")


chat_agent = Agent(
    GroqModel(
        model_name="openai/gpt-oss-120b",
        provider=GroqProvider(api_key=GROQ_API_KEY),
    ),
    system_prompt=prompt,
    output_type=str,
    deps_type=str,
)

