from google import genai
from google.genai import types

from app.core.config import settings


class GeminiService:

    def __init__(self):
        self.client = None

    def startup(self):
        if not settings.GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY is not configured")

        self.client = genai.Client(
            api_key=settings.GEMINI_API_KEY
        )

    # ---------------------------------------------------------
    # SINGLE DOCUMENT EMBEDDING
    # ---------------------------------------------------------

    async def embed_document(
        self,
        text: str,
    ) -> list[float]:

        if not self.client:
            raise RuntimeError(
                "Gemini client not initialized"
            )

        result = self.client.models.embed_content(
            model=settings.GEMINI_EMBEDDING_MODEL,
            contents=text,
            config=types.EmbedContentConfig(
                task_type="RETRIEVAL_DOCUMENT",
                output_dimensionality=3072,
            ),
        )

        return result.embeddings[0].values

    # ---------------------------------------------------------
    # BATCH DOCUMENT EMBEDDING
    # ---------------------------------------------------------

    async def embed_documents(
        self,
        texts: list[str],
    ) -> list[list[float]]:

        if not self.client:
            raise RuntimeError(
                "Gemini client not initialized"
            )

        if not texts:
            return []

        result = self.client.models.embed_content(
            model=settings.GEMINI_EMBEDDING_MODEL,
            contents=texts,
            config=types.EmbedContentConfig(
                task_type="RETRIEVAL_DOCUMENT",
                output_dimensionality=3072,
            ),
        )

        return [
            embedding.values
            for embedding in result.embeddings
        ]

    # ---------------------------------------------------------
    # QUERY EMBEDDING
    # ---------------------------------------------------------

    async def embed_query(
        self,
        text: str,
    ) -> list[float]:

        if not self.client:
            raise RuntimeError(
                "Gemini client not initialized"
            )

        result = self.client.models.embed_content(
            model=settings.GEMINI_EMBEDDING_MODEL,
            contents=text,
            config=types.EmbedContentConfig(
                task_type="RETRIEVAL_QUERY",
                output_dimensionality=3072,
            ),
        )

        return result.embeddings[0].values

    # ---------------------------------------------------------
    # RAG RESPONSE GENERATION
    # ---------------------------------------------------------

    async def generate_rag_response(
        self,
        system_prompt: str,
        user_prompt: str,
    ):

        if not self.client:
            raise RuntimeError(
                "Gemini client not initialized"
            )

        from app.schemas.rag import RAGResponse

        response = self.client.models.generate_content(
            model=settings.GEMINI_GENERATION_MODEL,
            contents=[
                types.Content(
                    role="user",
                    parts=[
                        types.Part.from_text(
                            text=(
                                system_prompt
                                + "\n\n"
                                + user_prompt
                            )
                        )
                    ],
                )
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=RAGResponse,
            ),
        )

        if response.parsed:
            return response.parsed

        return RAGResponse.model_validate_json(
            response.text
        )


gemini_service = GeminiService()