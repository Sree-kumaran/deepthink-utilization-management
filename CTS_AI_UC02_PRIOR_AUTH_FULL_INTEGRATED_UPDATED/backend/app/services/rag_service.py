from __future__ import annotations

from datetime import date, datetime
from typing import Any

from app.services.qdrant_service import qdrant_service
from app.services.gemini_service import gemini_service


class RAGService:
    """
    UC02 production-oriented Prior Authorization RAG engine.

    Pipeline:

        Authorization request
              ↓
        Query normalization
              ↓
        Gemini retrieval embedding
              ↓
        Broad Qdrant retrieval
              ↓
        Relevance filtering
              ↓
        Policy lifecycle awareness
              ↓
        Effective-date awareness
              ↓
        Duplicate removal
              ↓
        Policy/version diversity
              ↓
        Evidence ranking
              ↓
        Evidence budget
              ↓
        Grounded Gemini evaluation
              ↓
        Citation verification
              ↓
        Deterministic guardrails
              ↓
        Structured RAGResponse
    """

    # =========================================================
    # RETRIEVAL CONFIGURATION
    # =========================================================

    # Retrieve broadly so we do not lose useful evidence.
    RETRIEVAL_CANDIDATES = 32

    # Maximum number of evidence chunks finally exposed to Gemini.
    MAX_EVIDENCE = 8

    # Maximum user requested top_k.
    MAX_REQUEST_TOP_K = 10

    # Minimum semantic similarity accepted from Qdrant.
    MIN_RELEVANCE_SCORE = 0.45

    # Prevent one policy/version from dominating the context.
    MAX_CHUNKS_PER_POLICY_VERSION = 3

    # Maximum policy context sent to Gemini.
    MAX_EVIDENCE_CHARS = 18000

    # Metadata preferences.
    ACTIVE_VERSION_BONUS = 0.08
    SCORE_WEIGHT = 0.85
    METADATA_WEIGHT = 0.15

    def __init__(self):
        self.started = False

    # =========================================================
    # STARTUP
    # =========================================================

    async def startup(self):
        """
        Start Gemini and Qdrant dependencies.
        """

        if self.started:
            return

        gemini_service.startup()

        await qdrant_service.startup()

        self.started = True

    # =========================================================
    # SHUTDOWN
    # =========================================================

    async def shutdown(self):
        """
        Shutdown Qdrant dependency.
        """

        await qdrant_service.shutdown()

        self.started = False

    # =========================================================
    # BASIC NORMALIZATION
    # =========================================================

    @staticmethod
    def _clean(value: Any) -> str:
        """
        Convert a value into clean text.
        """

        if value is None:
            return ""

        return str(value).strip()

    # ---------------------------------------------------------
    # Text normalization for duplicate detection.
    # ---------------------------------------------------------

    @staticmethod
    def _normalize_text(value: Any) -> str:

        text = str(value or "").lower()

        return " ".join(
            text.split()
        )

    # =========================================================
    # PATIENT CONTEXT FLATTENING
    # =========================================================

    def _flatten_patient_context(
        self,
        data: dict[str, Any],
        prefix: str = "",
    ) -> str:
        """
        Flatten nested patient/request information.

        Example:

            {
                "patient": {
                    "age": 45,
                    "diagnosis": "knee pain"
                }
            }

        becomes:

            patient.age: 45
            patient.diagnosis: knee pain
        """

        lines: list[str] = []

        for key, value in data.items():

            label = (
                f"{prefix}.{key}"
                if prefix
                else str(key)
            )

            if value is None:
                continue

            # -------------------------------------------------
            # Nested dictionary
            # -------------------------------------------------

            if isinstance(value, dict):

                nested = (
                    self._flatten_patient_context(
                        value,
                        prefix=label,
                    )
                )

                if nested:
                    lines.append(nested)

            # -------------------------------------------------
            # Lists
            # -------------------------------------------------

            elif isinstance(value, list):

                if not value:
                    continue

                for index, item in enumerate(value):

                    if isinstance(item, dict):

                        nested = (
                            self._flatten_patient_context(
                                item,
                                prefix=f"{label}[{index}]",
                            )
                        )

                        if nested:
                            lines.append(nested)

                    else:

                        item_text = self._clean(item)

                        if item_text:

                            lines.append(
                                f"{label}[{index}]: "
                                f"{item_text}"
                            )

            # -------------------------------------------------
            # Normal value
            # -------------------------------------------------

            else:

                text = self._clean(value)

                if text:

                    lines.append(
                        f"{label}: {text}"
                    )

        return "\n".join(lines)

    # =========================================================
    # RETRIEVAL QUERY
    # =========================================================

    def build_retrieval_query(
        self,
        question: str,
        patient_data: dict[str, Any] | None = None,
        requested_service: str | None = None,
    ) -> str:
        """
        Build a retrieval-oriented query.

        Patient information helps identify relevant policy evidence.
        Patient information itself is NOT stored as policy evidence.
        """

        parts: list[str] = []

        question = self._clean(
            question
        )

        if question:

            parts.append(
                "Authorization question:\n"
                + question
            )

        service = self._clean(
            requested_service
        )

        if service:

            parts.append(
                "Requested service:\n"
                + service
            )

        if patient_data:

            patient_summary = (
                self._flatten_patient_context(
                    patient_data
                )
            )

            if patient_summary:

                parts.append(
                    "Authorization request information:\n"
                    + patient_summary
                )

        parts.append(
            """
Retrieve authoritative policy evidence relevant to this
prior-authorization request.

Prioritize actual policy language concerning:

- covered services
- eligibility
- medical necessity
- clinical criteria
- prerequisites
- required documentation
- authorization requirements
- limitations
- exclusions
- contraindications
- frequency limits
- age requirements
- diagnosis requirements
- prior treatment requirements
- site-of-service requirements
- plan or benefit restrictions

Retrieve policy evidence rather than general medical knowledge.
""".strip()
        )

        return "\n\n".join(parts)

    # =========================================================
    # NUMERIC HELPERS
    # =========================================================

    @staticmethod
    def _safe_float(
        value: Any,
        default: float = 0.0,
    ) -> float:

        try:

            return float(value)

        except (
            TypeError,
            ValueError,
        ):

            return default

    # =========================================================
    # DATE HELPERS
    # =========================================================

    @staticmethod
    def _parse_date(
        value: Any,
    ) -> date | None:
        """
        Safely parse common policy date formats.
        """

        if value is None:
            return None

        if isinstance(value, datetime):
            return value.date()

        if isinstance(value, date):
            return value

        text = str(value).strip()

        if not text:
            return None

        # ISO datetime
        try:

            return datetime.fromisoformat(
                text.replace(
                    "Z",
                    "+00:00",
                )
            ).date()

        except ValueError:
            pass

        # ISO date
        try:

            return date.fromisoformat(
                text[:10]
            )

        except ValueError:

            return None

    # =========================================================
    # POLICY METADATA SCORE
    # =========================================================

    def _metadata_score(
        self,
        item: dict[str, Any],
    ) -> float:
        """
        Small metadata preference.

        Semantic relevance remains dominant.
        """

        score = 0.0

        # -----------------------------------------------------
        # Active policy version
        # -----------------------------------------------------

        if item.get(
            "is_active_version"
        ) is True:

            score += self.ACTIVE_VERSION_BONUS

        # -----------------------------------------------------
        # Policy status
        # -----------------------------------------------------

        status = self._clean(
            item.get(
                "policy_status"
            )
        ).upper()

        if status == "ACTIVE":

            score += 0.04

        elif status == "RETIRED":

            score -= 0.04

        elif status == "DRAFT":

            score -= 0.08

        # -----------------------------------------------------
        # Effective dates
        # -----------------------------------------------------

        today = date.today()

        effective_from = self._parse_date(
            item.get(
                "effective_from"
            )
        )

        effective_to = self._parse_date(
            item.get(
                "effective_to"
            )
        )

        if (
            effective_from is not None
            and effective_from <= today
        ):

            if (
                effective_to is None
                or effective_to >= today
            ):

                score += 0.04

        return max(
            -0.15,
            min(
                score,
                0.15,
            ),
        )

    # =========================================================
    # COMBINED RANKING SCORE
    # =========================================================

    def _ranking_score(
        self,
        semantic_score: float,
        item: dict[str, Any],
    ) -> float:

        semantic = max(
            0.0,
            min(
                semantic_score,
                1.0,
            ),
        )

        metadata = self._metadata_score(
            item
        )

        return (
            semantic * self.SCORE_WEIGHT
            + metadata * self.METADATA_WEIGHT
        )

    # =========================================================
    # RETRIEVE POLICY EVIDENCE
    # =========================================================

    async def retrieve_policy_evidence(
        self,
        question: str,
        limit: int = 5,
        patient_data: dict[str, Any] | None = None,
        requested_service: str | None = None,
    ) -> list[dict]:
        """
        Retrieve, filter, rank and diversify policy evidence.
        """

        question = self._clean(
            question
        )

        if not question:
            return []

        # -----------------------------------------------------
        # Safe requested limit
        # -----------------------------------------------------

        try:

            requested_limit = int(
                limit
            )

        except (
            TypeError,
            ValueError,
        ):

            requested_limit = 5

        final_limit = max(
            1,
            min(
                requested_limit,
                self.MAX_REQUEST_TOP_K,
                self.MAX_EVIDENCE,
            ),
        )

        # -----------------------------------------------------
        # Build retrieval query
        # -----------------------------------------------------

        retrieval_query = (
            self.build_retrieval_query(
                question=question,
                patient_data=patient_data,
                requested_service=requested_service,
            )
        )

        # -----------------------------------------------------
        # Gemini query embedding
        # -----------------------------------------------------

        query_vector = (
            await gemini_service.embed_query(
                retrieval_query
            )
        )

        if not query_vector:
            return []

        # -----------------------------------------------------
        # Broad Qdrant retrieval
        # -----------------------------------------------------

        candidates = (
            await qdrant_service.search(
                vector=query_vector,
                limit=max(
                    self.RETRIEVAL_CANDIDATES,
                    final_limit,
                ),
            )
        )

        if not candidates:
            return []

        # -----------------------------------------------------
        # Normalize candidates
        # -----------------------------------------------------

        normalized: list[dict] = []

        for point in candidates:

            payload = (
                point.payload
                or {}
            )

            text = (
                payload.get("text")
                or payload.get("content")
                or payload.get("evidence")
                or ""
            )

            text = self._clean(
                text
            )

            if not text:
                continue

            semantic_score = (
                self._safe_float(
                    getattr(
                        point,
                        "score",
                        0.0,
                    )
                )
            )

            # -------------------------------------------------
            # Relevance filter
            # -------------------------------------------------

            if (
                semantic_score
                < self.MIN_RELEVANCE_SCORE
            ):
                continue

            policy_id = self._clean(
                payload.get(
                    "policy_id"
                )
            )

            version = self._clean(
                payload.get(
                    "version"
                )
            )

            # Every policy evidence item must have identity.
            if (
                not policy_id
                or not version
            ):
                continue

            item = {

                "policy_id": policy_id,

                "version": version,

                "policy_status": payload.get(
                    "policy_status"
                ),

                "is_active_version": payload.get(
                    "is_active_version"
                ),

                "effective_from": payload.get(
                    "effective_from"
                ),

                "effective_to": payload.get(
                    "effective_to"
                ),

                "source": payload.get(
                    "source"
                ),

                "page": payload.get(
                    "page"
                ),

                "section": payload.get(
                    "section"
                ),

                "text": text,

                "chunk_index": payload.get(
                    "chunk_index"
                ),

                "chunk_count": payload.get(
                    "chunk_count"
                ),

                "content_type": payload.get(
                    "content_type",
                    "policy_evidence",
                ),

                "score": semantic_score,
            }

            item["metadata_score"] = (
                self._metadata_score(
                    item
                )
            )

            item["ranking_score"] = (
                self._ranking_score(
                    semantic_score,
                    item,
                )
            )

            normalized.append(
                item
            )

        if not normalized:
            return []

        # -----------------------------------------------------
        # Rank candidates
        # -----------------------------------------------------

        normalized.sort(
            key=lambda item: (
                item["ranking_score"],
                item["score"],
            ),
            reverse=True,
        )

        # -----------------------------------------------------
        # Exact chunk de-duplication
        # -----------------------------------------------------

        unique: list[dict] = []

        seen_chunks: set[
            tuple[str, str, Any]
        ] = set()

        for item in normalized:

            chunk_key = (
                item["policy_id"],
                item["version"],
                item.get(
                    "chunk_index"
                ),
            )

            if chunk_key in seen_chunks:
                continue

            seen_chunks.add(
                chunk_key
            )

            unique.append(
                item
            )

        # -----------------------------------------------------
        # Text de-duplication
        # -----------------------------------------------------

        text_seen: set[str] = set()

        deduplicated: list[dict] = []

        for item in unique:

            normalized_text = (
                self._normalize_text(
                    item["text"]
                )
            )

            if not normalized_text:
                continue

            if normalized_text in text_seen:
                continue

            text_seen.add(
                normalized_text
            )

            deduplicated.append(
                item
            )

        # -----------------------------------------------------
        # Policy/version diversity
        # -----------------------------------------------------

        selected: list[dict] = []

        policy_counts: dict[
            tuple[str, str],
            int,
        ] = {}

        for item in deduplicated:

            policy_key = (
                item["policy_id"],
                item["version"],
            )

            current_count = (
                policy_counts.get(
                    policy_key,
                    0,
                )
            )

            if (
                current_count
                >= self.MAX_CHUNKS_PER_POLICY_VERSION
            ):
                continue

            selected.append(
                item
            )

            policy_counts[
                policy_key
            ] = current_count + 1

            if (
                len(selected)
                >= final_limit
            ):
                break

        return selected

    # =========================================================
    # BUILD EVIDENCE CONTEXT
    # =========================================================

    def build_evidence_context(
        self,
        evidence: list[dict],
    ) -> str:
        """
        Build explicit policy evidence blocks for Gemini.

        Each block receives an E-number so Gemini can identify
        the evidence without inventing its own source.
        """

        if not evidence:

            return (
                "NO APPLICABLE POLICY EVIDENCE "
                "WAS RETRIEVED."
            )

        blocks: list[str] = []

        total_chars = 0

        for index, item in enumerate(
            evidence,
            start=1,
        ):

            semantic_score = (
                self._safe_float(
                    item.get(
                        "score"
                    )
                )
            )

            ranking_score = (
                self._safe_float(
                    item.get(
                        "ranking_score"
                    )
                )
            )

            block = (
                f"[E{index}]\n"
                f"Policy ID: "
                f"{item.get('policy_id')}\n"
                f"Policy Version: "
                f"{item.get('version')}\n"
                f"Policy Status: "
                f"{item.get('policy_status')}\n"
                f"Active Version: "
                f"{item.get('is_active_version')}\n"
                f"Effective From: "
                f"{item.get('effective_from')}\n"
                f"Effective To: "
                f"{item.get('effective_to')}\n"
                f"Source: "
                f"{item.get('source')}\n"
                f"Page: "
                f"{item.get('page')}\n"
                f"Section: "
                f"{item.get('section')}\n"
                f"Chunk Index: "
                f"{item.get('chunk_index')}\n"
                f"Chunk Count: "
                f"{item.get('chunk_count')}\n"
                f"Semantic Relevance: "
                f"{semantic_score:.4f}\n"
                f"Ranking Score: "
                f"{ranking_score:.4f}\n"
                f"Policy Evidence:\n"
                f"{item.get('text', '')}"
            )

            if (
                total_chars
                + len(block)
                > self.MAX_EVIDENCE_CHARS
            ):
                break

            blocks.append(
                block
            )

            total_chars += len(
                block
            )

        if not blocks:

            return (
                "NO APPLICABLE POLICY EVIDENCE "
                "WAS RETRIEVED."
            )

        return "\n\n".join(
            blocks
        )

    # =========================================================
    # SYSTEM PROMPT
    # =========================================================

    def build_system_prompt(self) -> str:
        """
        Instructions controlling Gemini's structured JSON response.
        """

        return """
You are the UC02 Prior Authorization Policy Decision Engine.

Your job is to evaluate an authorization request using ONLY:

1. The patient/request information supplied by the application.
2. The retrieved policy evidence supplied in the prompt.
3. The authorization question.

============================================================
STRICT GROUNDING RULES
============================================================

1. Never invent policy requirements.

2. Never invent patient facts.

3. Never assume missing patient information is satisfied.

4. Never use general medical knowledge as a substitute for policy
   evidence.

5. Never approve a request simply because the service is medically
   plausible.

6. Never deny a request simply because the retrieved evidence is
   incomplete.

7. Every policy-based conclusion must be supported by retrieved
   evidence.

8. Never fabricate policy IDs.

9. Never fabricate policy versions.

10. Never fabricate source names.

11. Never fabricate pages.

12. Never fabricate sections.

13. Never fabricate evidence text.

14. Never fabricate relevance scores.

15. Use only the supplied E1, E2, E3... evidence blocks.

============================================================
POLICY VERSION RULES
============================================================

When multiple policy versions are retrieved:

- Prefer evidence marked as active.
- Treat retired versions cautiously.
- Treat draft versions cautiously.
- Do not silently combine contradictory requirements from different
  policy versions.
- If the applicable policy version cannot be established and this
  affects the decision, return:

  additional_information_required

============================================================
DECISION STATUS
============================================================

Use exactly one of these:

supported

Use when:

- the retrieved policy evidence supports the requested service,
- relevant requirements can be evaluated,
- the supplied patient/request information satisfies the applicable
  requirements,
- and no applicable exclusion or unmet requirement prevents support.

not_supported

Use when:

- the retrieved policy evidence clearly establishes an applicable
  requirement or exclusion,
- and the supplied request/patient information does not satisfy it.

additional_information_required

Use when:

- required patient/request information is missing,
- OR policy evidence is insufficient,
- OR policy applicability is ambiguous,
- OR policy versions conflict in a way that affects the decision.

============================================================
ANSWER
============================================================

The "answer" field must contain a clear human-readable explanation.

The answer should:

- explain the decision,
- explain the important policy requirements,
- explain how the supplied request/patient information compares,
- mention missing information when relevant,
- remain grounded in retrieved evidence.

Do not give medical diagnosis.

Do not give treatment recommendations.

============================================================
LANGUAGE
============================================================

The response MUST contain:

"sentence_language"

Use the language of the user's authorization question.

For English questions:

"sentence_language": "English"

For Tamil questions:

"sentence_language": "Tamil"

For other languages, use the appropriate language name.

The "answer" should be written in that language.

The JSON field names MUST remain in English.

============================================================
CONFIDENCE
============================================================

Return:

"confidence"

as a number between 0 and 1.

Confidence represents how strongly:

- the policy evidence supports the conclusion,
- the retrieved evidence is relevant,
- the patient/request information is complete,
- the policy-to-request comparison is clear.

Do not artificially increase confidence.

============================================================
POLICY EVIDENCE
============================================================

The "policy_evidence" array must contain ONLY evidence that was
actually retrieved and supplied.

Do not create new evidence.

Each citation should correspond to one of:

E1
E2
E3
...

Preserve the actual:

- policy_id
- version
- source
- page
- section
- relevance_score
- evidence

============================================================
MISSING INFORMATION
============================================================

The "missing_information" field must be an array.

If important information is missing, list the specific information.

Example:

[
  "Prior conservative treatment history",
  "Duration of symptoms"
]

If nothing is missing:

[]

============================================================
OUTPUT FORMAT
============================================================

Return ONLY valid JSON.

The JSON MUST contain exactly these top-level fields:

{
  "sentence_language": "...",
  "answer": "...",
  "status": "...",
  "confidence": 0.0,
  "policy_evidence": [],
  "missing_information": []
}

Do not return Markdown.

Do not return ```json.

Do not return explanations outside the JSON.
""".strip()

    # =========================================================
    # USER PROMPT
    # =========================================================

    def build_user_prompt(
        self,
        question: str,
        patient_data: dict[str, Any],
        evidence_context: str,
    ) -> str:
        """
        Build the actual authorization evaluation prompt.
        """

        patient_context = (
            self._flatten_patient_context(
                patient_data
            )
            if patient_data
            else ""
        )

        if not patient_context:

            patient_context = (
                "NO PATIENT / AUTHORIZATION "
                "INFORMATION PROVIDED."
            )

        return f"""
PATIENT / AUTHORIZATION REQUEST
===============================

{patient_context}


AUTHORIZATION QUESTION
======================

{question}


RETRIEVED POLICY EVIDENCE
=========================

{evidence_context}


EVALUATION TASK
===============

Evaluate this authorization request using ONLY the retrieved policy
evidence.

Perform the following:

1. Identify the applicable policy requirements contained in the
   retrieved evidence.

2. Identify the patient/request facts explicitly supplied.

3. Compare those facts against the applicable policy requirements.

4. Identify satisfied requirements.

5. Identify unsatisfied requirements.

6. Identify requirements that cannot be evaluated because information
   is missing.

7. Determine the correct authorization status.

8. Explain the reasoning clearly in the "answer" field.

9. Cite only retrieved policy evidence.

============================================================
STATUS
============================================================

The status MUST be exactly one of:

supported

not_supported

additional_information_required

============================================================
CITATIONS
============================================================

The retrieved evidence is labelled E1, E2, E3, etc.

Use those evidence blocks as the source of policy conclusions.

Do not invent citations.

Preserve the actual policy_id and version.

Do not invent page, section, source, relevance score, or evidence text.

============================================================
LANGUAGE
============================================================

Set sentence_language to the language of the authorization question.

The answer must be written in that same language.

============================================================
MISSING INFORMATION
============================================================

If a necessary patient/request fact is missing, put the specific
missing fact in missing_information.

If no information is missing:

[]

============================================================
FINAL REQUIREMENT
============================================================

Return ONLY the required JSON object.
""".strip()

    # =========================================================
    # CITATION VERIFICATION
    # =========================================================

    def verify_citations(
        self,
        response,
        evidence: list[dict],
    ):
        """
        Replace Gemini-generated citation metadata with metadata
        originating from the actual Qdrant evidence.

        This prevents fabricated citations.
        """

        from app.schemas.rag import RAGCitation

        # -----------------------------------------------------
        # No evidence
        # -----------------------------------------------------

        if not evidence:

            response.policy_evidence = []

            return response

        # -----------------------------------------------------
        # Group evidence by policy/version.
        # -----------------------------------------------------

        policy_version_map: dict[
            tuple[str, str],
            list[dict],
        ] = {}

        for item in evidence:

            key = (
                self._clean(
                    item.get(
                        "policy_id"
                    )
                ),
                self._clean(
                    item.get(
                        "version"
                    )
                ),
            )

            policy_version_map.setdefault(
                key,
                [],
            ).append(
                item
            )

        verified: list[RAGCitation] = []

        seen: set[
            tuple[str, str, Any]
        ] = set()

        # -----------------------------------------------------
        # Validate Gemini citations.
        # -----------------------------------------------------

        for citation in (
            response.policy_evidence
            or []
        ):

            policy_id = self._clean(
                citation.policy_id
            )

            version = self._clean(
                citation.version
            )

            key = (
                policy_id,
                version,
            )

            source_items = (
                policy_version_map.get(
                    key,
                    [],
                )
            )

            # Gemini cited policy not retrieved.
            if not source_items:
                continue

            cited_text = (
                self._normalize_text(
                    citation.evidence
                )
            )

            selected_item: dict | None = None

            # -------------------------------------------------
            # Match evidence text.
            # -------------------------------------------------

            if cited_text:

                for item in source_items:

                    item_text = (
                        self._normalize_text(
                            item.get(
                                "text"
                            )
                        )
                    )

                    if not item_text:
                        continue

                    if (
                        cited_text
                        in item_text
                        or item_text
                        in cited_text
                    ):

                        selected_item = item

                        break

            # -------------------------------------------------
            # Match page/section.
            # -------------------------------------------------

            if selected_item is None:

                citation_page = (
                    citation.page
                )

                citation_section = (
                    self._clean(
                        citation.section
                    )
                )

                candidates = source_items

                if citation_page is not None:

                    page_matches = [
                        item
                        for item in candidates
                        if item.get(
                            "page"
                        )
                        == citation_page
                    ]

                    if page_matches:

                        candidates = (
                            page_matches
                        )

                if citation_section:

                    section_matches = [
                        item
                        for item in candidates
                        if self._clean(
                            item.get(
                                "section"
                            )
                        )
                        == citation_section
                    ]

                    if section_matches:

                        candidates = (
                            section_matches
                        )

                if candidates:

                    selected_item = max(
                        candidates,
                        key=lambda item:
                        self._safe_float(
                            item.get(
                                "score"
                            )
                        ),
                    )

            # -------------------------------------------------
            # Safe fallback.
            # -------------------------------------------------

            if selected_item is None:

                selected_item = max(
                    source_items,
                    key=lambda item:
                    self._safe_float(
                        item.get(
                            "score"
                        )
                    ),
                )

            # -------------------------------------------------
            # Prevent duplicate citations.
            # -------------------------------------------------

            verified_key = (
                selected_item[
                    "policy_id"
                ],
                selected_item[
                    "version"
                ],
                selected_item.get(
                    "chunk_index"
                ),
            )

            if verified_key in seen:
                continue

            seen.add(
                verified_key
            )

            # -------------------------------------------------
            # Normalize source.
            # -------------------------------------------------

            source_value = (
                selected_item.get(
                    "source"
                )
            )

            if isinstance(
                source_value,
                str,
            ):

                verified_source = (
                    source_value
                )

            elif isinstance(
                source_value,
                dict,
            ):

                verified_source = (
                    source_value.get(
                        "source_filename"
                    )
                    or source_value.get(
                        "filename"
                    )
                    or source_value.get(
                        "source"
                    )
                )

            else:

                verified_source = None

            # -------------------------------------------------
            # Build verified citation.
            # -------------------------------------------------

            verified.append(
                RAGCitation(
                    policy_id=selected_item[
                        "policy_id"
                    ],

                    version=selected_item[
                        "version"
                    ],

                    source=verified_source,

                    page=selected_item.get(
                        "page"
                    ),

                    section=selected_item.get(
                        "section"
                    ),

                    relevance_score=(
                        self._safe_float(
                            selected_item.get(
                                "score"
                            )
                        )
                    ),

                    evidence=selected_item[
                        "text"
                    ],
                )
            )

        response.policy_evidence = (
            verified
        )

        return response

    # =========================================================
    # RESPONSE GUARDRAILS
    # =========================================================

    def apply_response_guardrails(
        self,
        response,
        evidence: list[dict],
    ):
        """
        Deterministic safety layer after Gemini.

        Gemini cannot bypass these controls.
        """

        # =====================================================
        # NO EVIDENCE
        # =====================================================

        if not evidence:

            response.status = (
                "additional_information_required"
            )

            response.confidence = 0.0

            response.policy_evidence = []

            missing = list(
                response.missing_information
                or []
            )

            if (
                "Applicable policy evidence"
                not in missing
            ):

                missing.append(
                    "Applicable policy evidence"
                )

            response.missing_information = (
                missing
            )

            return response

        # =====================================================
        # NO VERIFIED CITATIONS
        # =====================================================

        if not response.policy_evidence:

            response.status = (
                "additional_information_required"
            )

            response.confidence = min(
                self._safe_float(
                    response.confidence
                ),
                0.30,
            )

            missing = list(
                response.missing_information
                or []
            )

            if (
                "Verified policy citation"
                not in missing
            ):

                missing.append(
                    "Verified policy citation"
                )

            response.missing_information = (
                missing
            )

        # =====================================================
        # NORMALIZE STATUS
        # =====================================================

        valid_statuses = {
            "supported",
            "not_supported",
            "additional_information_required",
        }

        status = self._clean(
            response.status
        ).lower()

        if status not in valid_statuses:

            response.status = (
                "additional_information_required"
            )

            missing = list(
                response.missing_information
                or []
            )

            if (
                "Valid authorization decision status"
                not in missing
            ):

                missing.append(
                    "Valid authorization decision status"
                )

            response.missing_information = (
                missing
            )

        # =====================================================
        # NORMALIZE LANGUAGE
        # =====================================================

        language = self._clean(
            response.sentence_language
        )

        if not language:

            response.sentence_language = (
                "English"
            )

        # =====================================================
        # NORMALIZE ANSWER
        # =====================================================

        answer = self._clean(
            response.answer
        )

        if not answer:

            response.answer = (
                "A policy-grounded determination "
                "could not be generated from the "
                "available evidence."
            )

        # =====================================================
        # NORMALIZE CONFIDENCE
        # =====================================================

        confidence = self._safe_float(
            response.confidence
        )

        response.confidence = max(
            0.0,
            min(
                confidence,
                1.0,
            ),
        )

        # =====================================================
        # EVIDENCE QUALITY CEILING
        # =====================================================

        strongest_score = max(
            (
                self._safe_float(
                    item.get(
                        "score"
                    )
                )
                for item in evidence
            ),
            default=0.0,
        )

        if strongest_score < 0.55:

            response.confidence = min(
                response.confidence,
                0.65,
            )

        elif strongest_score < 0.65:

            response.confidence = min(
                response.confidence,
                0.80,
            )

        # =====================================================
        # SUPPORTED REQUIRES STRONGER EVIDENCE
        # =====================================================

        if (
            response.status
            == "supported"
            and strongest_score
            < 0.60
        ):

            response.status = (
                "additional_information_required"
            )

            response.confidence = min(
                response.confidence,
                0.60,
            )

            missing = list(
                response.missing_information
                or []
            )

            if (
                "Stronger applicable policy evidence"
                not in missing
            ):

                missing.append(
                    "Stronger applicable policy evidence"
                )

            response.missing_information = (
                missing
            )

        return response

    # =========================================================
    # FULL RAG EVALUATION
    # =========================================================

    async def generate_response(
        self,
        question: str,
        patient_data: dict[str, Any],
        limit: int = 5,
        requested_service: str | None = None,
    ):
        """
        Complete:

        Retrieval
            →
        Grounded Gemini reasoning
            →
        Citation verification
            →
        Guardrails
            →
        Structured RAGResponse
        """

        # -----------------------------------------------------
        # 1. Retrieve policy evidence
        # -----------------------------------------------------

        evidence = (
            await self.retrieve_policy_evidence(
                question=question,
                limit=limit,
                patient_data=patient_data,
                requested_service=requested_service,
            )
        )

        # -----------------------------------------------------
        # 2. Build evidence context
        # -----------------------------------------------------

        evidence_context = (
            self.build_evidence_context(
                evidence
            )
        )

        # -----------------------------------------------------
        # 3. Build Gemini prompts
        # -----------------------------------------------------

        system_prompt = (
            self.build_system_prompt()
        )

        user_prompt = (
            self.build_user_prompt(
                question=question,
                patient_data=(
                    patient_data or {}
                ),
                evidence_context=(
                    evidence_context
                ),
            )
        )

        # -----------------------------------------------------
        # 4. Generate structured Gemini response
        # -----------------------------------------------------

        response = (
            await gemini_service
            .generate_rag_response(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
            )
        )

        # -----------------------------------------------------
        # 5. Verify citations against Qdrant
        # -----------------------------------------------------

        response = (
            self.verify_citations(
                response=response,
                evidence=evidence,
            )
        )

        # -----------------------------------------------------
        # 6. Apply deterministic guardrails
        # -----------------------------------------------------

        response = (
            self.apply_response_guardrails(
                response=response,
                evidence=evidence,
            )
        )

        return response


# =============================================================
# GLOBAL SERVICE INSTANCE
# =============================================================

rag_service = RAGService()