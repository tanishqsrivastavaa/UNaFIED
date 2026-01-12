from pathlib import Path
from pydantic_ai import Agent
from pydantic_ai.models.groq import GroqModel
from pydantic_ai.providers.groq import GroqProvider
from ..config.settings import Settings

settings = Settings()

prompt= Path("app/prompts/prompt.txt").read_text(encoding="utf-8")


chat_agent= Agent(
    GroqModel(
        model_name="llama-3.3-70b-versatile",
        provider=GroqProvider(api_key=settings.GROQ_API_KEY)),
        system_prompt=prompt
        )


if __name__ == "__main__":
    print("Agent: Hello! I'm ready to chat. Type 'exit' to quit.\n")
    
    while True:
        user_input = input("You: ")
        
        if user_input.lower() in ['exit', 'quit', 'bye']:
            print("Agent: Goodbye!")
            break
        
        result = chat_agent.run_sync(user_input)
        print(f"Agent: {result.output}\n")
