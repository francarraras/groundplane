import json
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


SCHEMA_FILES = {
    "sources/catalog.json": (
        "sources",
        [
            "id",
            "type",
            "title",
            "path",
            "created_at",
            "captured_by",
            "trust_level",
            "sensitivity",
            "status",
            "summary",
        ],
    ),
    "state/projects.json": (
        "projects",
        [
            "id",
            "title",
            "domain",
            "status",
            "health",
            "outcome",
            "next_action",
            "owner",
            "target_date",
            "last_reviewed",
            "source_ids",
            "approval_mode",
        ],
    ),
    "state/tasks.json": (
        "tasks",
        [
            "id",
            "project_id",
            "title",
            "status",
            "priority",
            "owner",
            "workstream",
            "next_action",
            "due_date",
            "source_ids",
            "blocked_by",
        ],
    ),
    "state/routines.json": (
        "routines",
        [
            "id",
            "name",
            "cadence",
            "status",
            "steps",
            "last_run",
            "next_run",
            "owner",
            "approval_mode",
        ],
    ),
    "state/decisions.json": (
        "decisions",
        [
            "id",
            "decision",
            "status",
            "options",
            "recommendation",
            "reason",
            "decided_at",
            "review_date",
            "source_ids",
        ],
    ),
    "reviews/queue.json": (
        "reviews",
        [
            "id",
            "type",
            "status",
            "risk",
            "proposed_by",
            "target_file",
            "summary",
            "source_ids",
            "diff_summary",
            "approval_mode",
            "created_at",
        ],
    ),
    "wiki/memory-claims.json": (
        "memory_claims",
        [
            "id",
            "claim",
            "type",
            "domain",
            "status",
            "confidence",
            "source_ids",
            "created_at",
            "last_verified_at",
            "supersedes",
            "contradicts",
            "sensitivity",
            "approval_status",
        ],
    ),
}


class StateSchemaContractTest(unittest.TestCase):
    def read_json(self, relative_path):
        path = ROOT / relative_path
        self.assertTrue(path.exists(), f"{relative_path} must exist")
        return json.loads(path.read_text())

    def test_v0_schema_files_exist_with_named_arrays(self):
        for relative_path, (collection_name, _fields) in SCHEMA_FILES.items():
            data = self.read_json(relative_path)
            self.assertIn(collection_name, data)
            self.assertIsInstance(data[collection_name], list)
            self.assertGreater(len(data[collection_name]), 0)

    def test_schema_records_have_required_fields(self):
        for relative_path, (collection_name, fields) in SCHEMA_FILES.items():
            data = self.read_json(relative_path)
            for record in data[collection_name]:
                for field in fields:
                    self.assertIn(field, record, f"{relative_path} missing {field}")

    def test_source_ids_resolve_to_catalog_entries(self):
        catalog = self.read_json("sources/catalog.json")
        source_ids = {source["id"] for source in catalog["sources"]}
        self.assertGreater(len(source_ids), 0)

        for relative_path, (collection_name, _fields) in SCHEMA_FILES.items():
            if relative_path == "sources/catalog.json":
                continue
            data = self.read_json(relative_path)
            for record in data[collection_name]:
                for source_id in record.get("source_ids", []):
                    self.assertIn(source_id, source_ids)

    def test_memory_claims_are_sourced_and_approved(self):
        data = self.read_json("wiki/memory-claims.json")
        for claim in data["memory_claims"]:
            self.assertGreater(len(claim["source_ids"]), 0)
            self.assertIn(claim["approval_status"], ["approved", "pending", "rejected"])
            self.assertIn(claim["confidence"], ["low", "medium", "high"])

    def test_review_queue_items_are_reviewable(self):
        data = self.read_json("reviews/queue.json")
        for item in data["reviews"]:
            self.assertIn(item["status"], ["pending", "approved", "rejected", "superseded"])
            self.assertIn(item["risk"], ["low", "medium", "high"])
            self.assertNotEqual(item["target_file"].strip(), "")

    def test_catalog_paths_exist(self):
        catalog = self.read_json("sources/catalog.json")
        for source in catalog["sources"]:
            self.assertTrue((ROOT / source["path"]).exists(), source["path"])

    def test_logs_are_jsonl_when_populated(self):
        for relative_path in ["logs/operations.jsonl", "logs/memory-events.jsonl"]:
            path = ROOT / relative_path
            self.assertTrue(path.exists(), f"{relative_path} must exist")
            for line in path.read_text().splitlines():
                if line.strip():
                    self.assertIsInstance(json.loads(line), dict)


if __name__ == "__main__":
    unittest.main()
