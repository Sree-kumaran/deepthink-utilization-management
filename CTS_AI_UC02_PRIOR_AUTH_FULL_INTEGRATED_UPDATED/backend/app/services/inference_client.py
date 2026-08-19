"""
UC02 Backend Inference Client
------------------------------
Communicates with the separate XGBoost + PriorAuthLM Inference Pipeline
service over HTTP via Docker networking.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class InferenceClientError(Exception):
    """Base exception for inference client errors."""

    def __init__(self, message: str, status_code: int | None = None, response_data: Any = None):
        super().__init__(message)
        self.status_code = status_code
        self.response_data = response_data


class InferenceClient:
    """HTTP client for the separate Inference Pipeline Docker service."""

    def __init__(
        self,
        base_url: str | None = None,
        timeout: float = 60.0,
    ):
        self._base_url = (base_url or settings.INFERENCE_SERVICE_URL).rstrip("/")
        self._timeout = timeout

    @property
    def base_url(self) -> str:
        url = (self._base_url or settings.INFERENCE_SERVICE_URL or "http://localhost:8001").rstrip("/")
        if "inference-pipeline" in url:
            import socket
            try:
                socket.gethostbyname("inference-pipeline")
            except socket.gaierror:
                url = url.replace("inference-pipeline:8000", "localhost:8001").replace("inference-pipeline", "localhost")
        return url

    async def health(self) -> dict[str, Any]:
        """Check inference pipeline health (GET /health)."""
        url = f"{self.base_url}/health"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url)
                if response.status_code == 200:
                    return response.json()
                logger.warning(
                    "Inference health check returned status %d from %s",
                    response.status_code,
                    url,
                )
                return {"status": "unhealthy", "status_code": response.status_code}
        except httpx.RequestError as exc:
            logger.warning(
                "Failed to connect to inference service at %s: %s",
                url,
                str(exc),
            )
            return {"status": "offline", "error": str(exc)}

    async def validate(self, features: dict[str, float]) -> dict[str, Any]:
        """Validate input features (POST /validate)."""
        url = f"{self.base_url}/validate"
        payload = {"features": features}
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(url, json=payload)
                if response.is_success:
                    return response.json()
                error_detail = self._extract_error(response)
                raise InferenceClientError(
                    f"Feature validation failed: {error_detail}",
                    status_code=response.status_code,
                    response_data=error_detail,
                )
        except httpx.RequestError as exc:
            logger.error("Connection failed to inference service %s: %s", url, str(exc))
            raise InferenceClientError(f"Inference service unavailable at {url}: {exc}") from exc

    async def predict(self, features: dict[str, float]) -> dict[str, Any]:
        """Run XGBoost prediction (POST /predict)."""
        url = f"{self.base_url}/predict"
        payload = {"features": features}
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, json=payload)
                if response.is_success:
                    return response.json()
                error_detail = self._extract_error(response)
                raise InferenceClientError(
                    f"Prediction failed: {error_detail}",
                    status_code=response.status_code,
                    response_data=error_detail,
                )
        except httpx.RequestError as exc:
            logger.error("Connection failed to inference service %s: %s", url, str(exc))
            raise InferenceClientError(f"Inference service unavailable at {url}: {exc}") from exc

    async def explain(
        self,
        features: dict[str, float],
        clinical_summary: str,
    ) -> dict[str, Any]:
        """Generate PriorAuthLM explanation (POST /explain)."""
        url = f"{self.base_url}/explain"
        payload = {
            "features": features,
            "clinical_summary": clinical_summary,
        }
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.post(url, json=payload)
                if response.is_success:
                    return response.json()
                error_detail = self._extract_error(response)
                raise InferenceClientError(
                    f"Explanation generation failed: {error_detail}",
                    status_code=response.status_code,
                    response_data=error_detail,
                )
        except httpx.RequestError as exc:
            logger.error("Connection failed to inference service %s: %s", url, str(exc))
            raise InferenceClientError(f"Inference service unavailable at {url}: {exc}") from exc

    async def assess(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Create final assessment combining rules, XGBoost, and PriorAuthLM (POST /assess)."""
        url = f"{self.base_url}/assess"
        patient_id = payload.get("patient_id", "unknown")
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.post(url, json=payload)
                if response.is_success:
                    data = response.json()
                    return data.get("assessment", data)
                error_detail = self._extract_error(response)
                logger.error(
                    "Inference assess failed for patient %s. URL: %s, Status: %d, Detail: %s",
                    patient_id,
                    url,
                    response.status_code,
                    error_detail,
                )
                raise InferenceClientError(
                    f"Assessment failed: {error_detail}",
                    status_code=response.status_code,
                    response_data=error_detail,
                )
        except httpx.RequestError as exc:
            logger.error(
                "Inference service connection error for patient %s at %s: %s",
                patient_id,
                url,
                str(exc),
            )
            raise InferenceClientError(
                f"Inference service unavailable at {url}: {str(exc)}"
            ) from exc

    @staticmethod
    def _extract_error(response: httpx.Response) -> str:
        try:
            body = response.json()
            if isinstance(body, dict):
                return str(body.get("detail") or body.get("message") or body)
            return str(body)
        except Exception:
            return response.text[:200] or f"HTTP {response.status_code}"


# Global singleton client
inference_client = InferenceClient()
