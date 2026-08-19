import asyncio
import json
import re
import sys
import zipfile
from pathlib import Path

from app.db.models import Policy, PolicyVersion
from app.db.session import SessionLocal


# ---------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------

VERSION_PREFIX = "source"


# ---------------------------------------------------------
# HELPERS
# ---------------------------------------------------------

def load_manifest(zf: zipfile.ZipFile) -> list[dict]:
    with zf.open("manifest.json") as f:
        return json.load(f)


def read_text(zf: zipfile.ZipFile, filename: str) -> str:
    with zf.open(filename) as f:
        return f.read().decode("utf-8", errors="replace")


def make_version(sha256: str) -> str:
    """
    Technical version derived from the verified source content.

    The source PDFs do not provide a conventional v1/v2 field,
    so we do not invent one.
    """
    return f"{VERSION_PREFIX}-{sha256[:12]}"


def normalize_policy_id(policy_id: str) -> str:
    return policy_id.strip().upper()


def clean_title(title: str) -> str:
    title = re.sub(r"\s+", " ", title or "").strip()
    return title


def build_source_reference(item: dict) -> dict:
    return {
        "source_filename": item.get("source_filename"),
        "extracted_text_file": item.get("extracted_text_file"),
        "sha256": item.get("sha256"),
        "extraction_status": item.get("pdf_extraction_status"),
    }


def build_metadata(item: dict) -> dict:
    return {
        "source_type": "policy_pdf",
        "category": item.get("category"),
        "effective_date": item.get("effective_date"),
        "next_review_date": item.get("next_review_date"),
        "source_filename": item.get("source_filename"),
        "extracted_text_file": item.get("extracted_text_file"),
        "sha256": item.get("sha256"),
        "extracted_characters": item.get("extracted_characters"),
        "pdf_extraction_status": item.get("pdf_extraction_status"),
        "source_version": None,
        "version_note": (
            "No explicit source policy version was found in the "
            "manifest. Technical version is derived from SHA-256."
        ),
    }


# ---------------------------------------------------------
# IMPORT
# ---------------------------------------------------------

async def import_batch(zip_path: str) -> None:
    ZIP_PATH = Path(zip_path)

    if not ZIP_PATH.exists():
        raise FileNotFoundError(
            f"ZIP file not found: {ZIP_PATH.resolve()}"
        )

    if not ZIP_PATH.is_file():
        raise FileNotFoundError(
            f"Path is not a file: {ZIP_PATH.resolve()}"
        )

    print("=" * 70)
    print("UC02 POLICY BATCH IMPORT")
    print("=" * 70)
    print(f"ZIP: {ZIP_PATH.resolve()}")
    print()

    with zipfile.ZipFile(ZIP_PATH, "r") as zf:

        # -------------------------------------------------
        # VERIFY ZIP
        # -------------------------------------------------

        names = set(zf.namelist())

        if "manifest.json" not in names:
            raise RuntimeError(
                "manifest.json was not found inside the ZIP."
            )

        manifest = load_manifest(zf)

        if not manifest:
            raise RuntimeError(
                "manifest.json contains no policy entries."
            )

        # -------------------------------------------------
        # DEDUPLICATE POLICY ENTRIES
        # -------------------------------------------------

        unique: dict[str, dict] = {}

        for item in manifest:

            if not item.get("policy_id"):
                raise RuntimeError(
                    "Manifest entry is missing policy_id."
                )

            policy_id = normalize_policy_id(
                item["policy_id"]
            )

            if policy_id not in unique:
                unique[policy_id] = item
                continue

            existing = unique[policy_id]

            if (
                existing.get("sha256")
                == item.get("sha256")
            ):
                print(
                    f"DEDUPLICATE: {policy_id} "
                    f"(same SHA-256)"
                )
            else:
                raise RuntimeError(
                    f"Conflicting source content found for "
                    f"policy {policy_id}: "
                    f"{existing.get('sha256')} != "
                    f"{item.get('sha256')}"
                )

        print(f"Manifest entries : {len(manifest)}")
        print(f"Unique policies  : {len(unique)}")
        print()

        # -------------------------------------------------
        # VERIFY ALL EXTRACTED TEXT FILES BEFORE DATABASE
        # -------------------------------------------------

        print("VERIFYING EXTRACTED POLICY TEXT...")
        print()

        for policy_id, item in unique.items():

            text_file = item.get(
                "extracted_text_file"
            )

            if not text_file:
                raise RuntimeError(
                    f"{policy_id}: missing "
                    f"extracted_text_file."
                )

            if text_file not in names:
                raise RuntimeError(
                    f"{policy_id}: extracted text file "
                    f"not found in ZIP: {text_file}"
                )

            raw_content = read_text(
                zf,
                text_file,
            )

            if not raw_content.strip():
                raise RuntimeError(
                    f"{policy_id}: extracted text is empty."
                )

            extraction_status = item.get(
                "pdf_extraction_status"
            )

            if extraction_status not in (
                None,
                "",
                "OK",
            ):
                raise RuntimeError(
                    f"{policy_id}: PDF extraction status "
                    f"is {extraction_status!r}, not OK."
                )

            print(
                f"OK: {policy_id} | "
                f"{item.get('title')} | "
                f"{len(raw_content):,} characters"
            )

        print()
        print("TEXT VERIFICATION COMPLETE.")
        print()

        # -------------------------------------------------
        # DATABASE IMPORT
        # -------------------------------------------------

        imported = 0
        updated = 0
        versions_created = 0
        versions_updated = 0

        async with SessionLocal() as db:

            for policy_id, item in unique.items():

                title = clean_title(
                    item.get("title")
                )

                category = (
                    item.get("category")
                    or "UNKNOWN"
                )

                effective_from = item.get(
                    "effective_date"
                )

                next_review_date = item.get(
                    "next_review_date"
                )

                sha256 = item.get("sha256")

                if not sha256:
                    raise RuntimeError(
                        f"{policy_id}: missing SHA-256."
                    )

                text_file = item.get(
                    "extracted_text_file"
                )

                raw_content = read_text(
                    zf,
                    text_file,
                )

                if not raw_content.strip():
                    raise RuntimeError(
                        f"{policy_id}: extracted text is empty."
                    )

                version = make_version(
                    sha256
                )

                source_reference = (
                    build_source_reference(item)
                )

                metadata = build_metadata(item)

                # -------------------------------------------------
                # POLICY
                # -------------------------------------------------

                policy = await db.get(
                    Policy,
                    policy_id,
                )

                if policy is None:

                    policy = Policy(
                        id=policy_id,
                        name=title,
                        description=(
                            "Imported from verified "
                            "policy source: "
                            f"{item.get('source_filename')}"
                        ),
                        policy_family=category,
                        active_version=version,
                        active=True,
                    )

                    db.add(policy)

                    imported += 1

                    print(
                        f"IMPORT POLICY: "
                        f"{policy_id} | {title}"
                    )

                else:

                    policy.name = title
                    policy.policy_family = category
                    policy.active = True

                    updated += 1

                    print(
                        f"UPDATE POLICY: "
                        f"{policy_id} | {title}"
                    )

                # -------------------------------------------------
                # POLICY VERSION
                # -------------------------------------------------

                version_id = (
                    f"{policy_id}:{version}"
                )

                existing_version = await db.get(
                    PolicyVersion,
                    version_id,
                )

                if existing_version is None:

                    policy_version = PolicyVersion(
                        id=version_id,
                        policy_id=policy_id,
                        version=version,
                        effective_from=effective_from,
                        effective_to=next_review_date,
                        status="ACTIVE",
                        rules=[],
                        source_references=[
                            source_reference
                        ],
                        raw_content=raw_content,
                        policy_metadata=metadata,
                    )

                    db.add(policy_version)

                    versions_created += 1

                    print(
                        f"  + VERSION: {version}"
                    )

                else:

                    existing_version.effective_from = (
                        effective_from
                    )

                    existing_version.effective_to = (
                        next_review_date
                    )

                    existing_version.status = (
                        "ACTIVE"
                    )

                    existing_version.raw_content = (
                        raw_content
                    )

                    existing_version.source_references = [
                        source_reference
                    ]

                    existing_version.policy_metadata = (
                        metadata
                    )

                    versions_updated += 1

                    print(
                        f"  ~ VERSION UPDATED: "
                        f"{version}"
                    )

                policy.active_version = version

            # -------------------------------------------------
            # COMMIT
            # -------------------------------------------------

            await db.commit()

    # ---------------------------------------------------------
    # SUMMARY
    # ---------------------------------------------------------

    print()
    print("=" * 70)
    print("IMPORT COMPLETE")
    print("=" * 70)
    print(f"Manifest entries  : {len(manifest)}")
    print(f"Unique policies   : {len(unique)}")
    print(f"New policies      : {imported}")
    print(f"Updated policies  : {updated}")
    print(f"Versions created  : {versions_created}")
    print(f"Versions updated  : {versions_updated}")
    print()
    print(
        "Rules were intentionally left empty for Phase 1."
    )
    print(
        "The verified extracted policy text is stored "
        "in raw_content."
    )
    print(
        "Source information is stored in metadata "
        "and source_references."
    )
    print("=" * 70)


# ---------------------------------------------------------
# ENTRY POINT
# ---------------------------------------------------------

if __name__ == "__main__":

    try:

        if len(sys.argv) < 2:
            print()
            print(
                "Usage:"
            )
            print(
                "python -m app.scripts.import_policy_batch "
                "<path-to-zip>"
            )
            print()
            sys.exit(1)

        asyncio.run(
            import_batch(sys.argv[1])
        )

    except KeyboardInterrupt:

        print(
            "\nImport cancelled."
        )

        sys.exit(1)

    except Exception as exc:

        print()
        print("=" * 70)
        print("IMPORT FAILED")
        print("=" * 70)
        print(
            f"{type(exc).__name__}: {exc}"
        )
        print()

        raise