from pathlib import Path
from typing import Optional
from pydantic import BaseModel,Field
from pydantic_ai import Agent
from pydantic_ai.models.groq import GroqModel
from pydantic_ai.providers.groq import GroqProvider
from ..core.tools import get_weather
from ..core.tools import get_weather
from dotenv import load_dotenv
import os
load_dotenv()
# from ..config.settings import Settings

# settings = Settings()

GROQ_API_KEY= os.getenv("GROQ_API_KEY")

prompt= Path("app/prompts/prompt.txt").read_text(encoding="utf-8")


class SuggestedAction(BaseModel):
    label: str= Field(description="Short text for the button, e.g., 'Check Weather'")
    tool_name: str= Field(description="The name to call the cool")
    parameters: dict= Field(description="The parameters passed to the tool")



class AgentResponse(BaseModel):
    chat_message: str = Field(description="The natural language reply to the user's input.")
    suggestion: Optional[SuggestedAction]= Field(
        default=None, 
        description="Optional. Only provide this if you are proposing a concrete action for the user to approve."
    )



chat_agent= Agent(
    GroqModel(
        model_name="llama-3.3-70b-versatile",
        provider=GroqProvider(api_key=GROQ_API_KEY)),
        system_prompt=prompt,
        tools=[get_weather],
        output_type=AgentResponse,
        deps_type=str
        )

