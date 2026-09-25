import os
from google import genai
from google.genai import types
from ..core.logger import logger
from ..config.settings import settings

client = genai.Client(api_key=settings.GEMINI_API_KEY)


async def generate_embedding(text: str) -> list[float]:
    if not text:
        return []

    try:
        response = await client.aio.models.embed_content(
            model="gemini-embedding-001",
            contents=text,
            config=types.EmbedContentConfig(output_dimensionality=1536),
        )

        return response.embeddings[0].values

    except Exception as e:
        logger.error(f"Failed to generate embedding: {e}")
        return []
