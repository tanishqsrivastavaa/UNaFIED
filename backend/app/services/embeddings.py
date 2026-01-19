import os
from openai import AsyncOpenAI

api_key = os.environ.get("OPENAI_API_KEY")
print(f"DEBUG: API Key found? {'Yes' if api_key else 'No'}")
client= AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

async def generate_embedding(text: str)-> list[float]:
    if not text:
        return []
    
    try:
        response= await client.embeddings.create(
            input=text,
            model='text-embedding-3-small'
        )
        print(f"DEBUG: Successfully generated embedding for: {text[:20]}...")
        return response.data[0].embedding
    
    except Exception as e:
        print(f"CRITICAL ERROR in generate_embedding: {e}")
        return []
    


    