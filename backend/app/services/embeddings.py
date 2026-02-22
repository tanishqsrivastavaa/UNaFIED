import os
from openai import AsyncOpenAI
from ..core.logger import logger


client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))


async def generate_embedding(text: str) -> list[float]:
    if not text:
        return []

    try:
        response = await client.embeddings.create(
            input=text,
            model='text-embedding-3-small'
        )

        return response.data[0].embedding

    except Exception as e:
        logger.error(f"Failed to generate embedding: {e}")
        return []