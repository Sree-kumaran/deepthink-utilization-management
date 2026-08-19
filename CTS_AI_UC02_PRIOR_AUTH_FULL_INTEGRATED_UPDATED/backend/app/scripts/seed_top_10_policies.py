import asyncio
import re
from pathlib import Path

from app.db.models import Policy, PolicyVersion
from app.db.session import SessionLocal


POLICY_FILE = Path(__file__).resolve().parents[2] / "data" / "top_10_payer_policies.txt"


POLICY_IDS = [
    "UHC-MRI-KNEE-001",
    "AETNA-MRI-KNEE-001",
    "CIGNA-PT-001",
    "ELEVANCE-CT-001",
    "HUMANA-SLEEP-001",
    "BCBS-MRI-LUMBAR-001",
    "CENTENE-BARIATRIC-001",
    "KAISER-CATARACT-001",
    "MOLINA-ECHO-001",
    "AETNA-COLON-001",
]


def split_policies(text: str):
    chunks = re.split(r"(?=^## CHUNK \d+)", text, flags=re.MULTILINE)

    result = {}

    for chunk in chunks:
        if not chunk.strip():
            continue

        payer_match = re.search(r"\*\*Payer:\*\*\s*(.+)", chunk)
        service_match = re.search(r"\*\*Service:\*\*\s*(.+)", chunk)
        category_match = re.search(
            r"\*\*Policy Category:\*\*\s*(.+)", chunk
        )

        if not payer_match or not service_match:
            continue

        payer = payer_match.group(1).strip()
        service = service_match.group(1).strip()
        category = (
            category_match.group(1).strip()
            if category_match
            else "UNKNOWN"
        )

        key = (payer.lower(), service.lower())

        result[key] = {
            "payer": payer,
            "service": service,
            "category": category,
            "content": chunk.strip(),
        }

    return result


async def seed_policies():
    if not POLICY_FILE.exists():
        raise FileNotFoundError(
            f"Policy source not found: {POLICY_FILE}"
        )

    text = POLICY_FILE.read_text(
        encoding="utf-8"
    )

    policies = split_policies(text)

    if len(policies) != 10:
        raise RuntimeError(
            f"Expected 10 policies, found {len(policies)}"
        )

    mapping = [
        ("UnitedHealthcare", "Magnetic Resonance Imaging (MRI) of the Knee", "UHC-MRI-KNEE-001"),
        ("Aetna", "Magnetic Resonance Imaging (MRI) of the Knee", "AETNA-MRI-KNEE-001"),
        ("Cigna", "Physical Therapy", "CIGNA-PT-001"),
        ("Elevance Health", "Computed Tomography (CT) Scan", "ELEVANCE-CT-001"),
        ("Humana", "Sleep Study / Polysomnography", "HUMANA-SLEEP-001"),
        ("Blue Cross Blue Shield", "Magnetic Resonance Imaging (MRI) of the Lumbar Spine", "BCBS-MRI-LUMBAR-001"),
        ("Centene", "Bariatric Surgery", "CENTENE-BARIATRIC-001"),
        ("Kaiser Permanente", "Cataract Surgery", "KAISER-CATARACT-001"),
        ("Molina Healthcare", "Echocardiogram", "MOLINA-ECHO-001"),
        ("Aetna", "Colonoscopy", "AETNA-COLON-001"),
    ]

    async with SessionLocal() as db:
        for payer, service, policy_id in mapping:

            key = (payer.lower(), service.lower())

            if key not in policies:
                raise RuntimeError(
                    f"Policy content not found for {policy_id}: "
                    f"{payer} / {service}"
                )

            item = policies[key]

            existing = await db.get(
                Policy,
                policy_id,
            )

            if existing is None:
                policy = Policy(
                    id=policy_id,
                    name=f"{payer} - {service}",
                    description=(
                        "Synthetic policy imported from "
                        "the repository policy knowledge base."
                    ),
                    policy_family=item["category"],
                    active_version="v1.0",
                    active=True,
                )

                db.add(policy)

                print(f"INSERT POLICY: {policy_id}")

            else:
                policy = existing

                policy.name = f"{payer} - {service}"
                policy.description = (
                    "Synthetic policy imported from "
                    "the repository policy knowledge base."
                )
                policy.policy_family = item["category"]
                policy.active_version = "v1.0"
                policy.active = True

                print(f"EXISTING POLICY: {policy_id}")

            version_id = f"{policy_id}:v1.0"

            version = await db.get(
                PolicyVersion,
                version_id,
            )

            if version is None:
                version = PolicyVersion(
                    id=version_id,
                    policy_id=policy_id,
                    version="v1.0",
                    effective_from=None,
                    effective_to=None,
                    status="ACTIVE",
                    rules=[],
                    source_references=[
                        {
                            "source": "top_10_payer_policies.txt",
                            "type": "repository_seed",
                        }
                    ],
                    raw_content=item["content"],
                    policy_metadata={
                        "source_type": "synthetic_policy",
                        "payer": payer,
                        "service": service,
                        "category": item["category"],
                        "seed": True,
                    },
                )

                db.add(version)

                print(f"  INSERT VERSION: {version_id}")

            else:
                version.status = "ACTIVE"
                version.raw_content = item["content"]
                version.source_references = [
                    {
                        "source": "top_10_payer_policies.txt",
                        "type": "repository_seed",
                    }
                ]
                version.policy_metadata = {
                    "source_type": "synthetic_policy",
                    "payer": payer,
                    "service": service,
                    "category": item["category"],
                    "seed": True,
                }

                print(f"  EXISTING VERSION: {version_id}")

        await db.commit()

    print()
    print("=" * 60)
    print("10 POLICY SEED COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(seed_policies())
