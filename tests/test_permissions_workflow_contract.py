import json
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class PermissionsWorkflowContractTest(unittest.TestCase):
    def test_permission_matrix_exists_and_covers_v0_boundaries(self):
        path = ROOT / "state" / "permissions.json"
        self.assertTrue(path.exists(), "state/permissions.json must exist")
        data = json.loads(path.read_text())
        actions = {item["action_type"]: item for item in data["actions"]}

        expected_modes = {
            "dashboard_refresh": "automatic-low-risk",
            "daily_brief": "suggest-only",
            "memory_write": "draft-for-approval",
            "external_write": "draft-for-approval",
            "raw_source_rewrite": "forbidden-in-V0",
            "finance_action": "forbidden-in-V0",
            "contacts_action": "forbidden-in-V0",
        }
        for action_type, mode in expected_modes.items():
            self.assertIn(action_type, actions)
            self.assertEqual(actions[action_type]["mode"], mode)

    def test_review_queue_tracks_permission_metadata(self):
        data = json.loads((ROOT / "reviews" / "queue.json").read_text())
        for item in data["reviews"]:
            for field in [
                "action_type",
                "sensitivity",
                "source_trust",
                "requires_explicit_approval",
            ]:
                self.assertIn(field, item)
            if item["requires_explicit_approval"]:
                self.assertNotEqual(item["approval_mode"], "automatic-low-risk")

    def test_graph_inferred_relationships_do_not_bypass_approval(self):
        graph_path = ROOT / "indexes" / "relationship-graph.json"
        self.assertTrue(graph_path.exists(), "relationship graph must exist")
        graph = json.loads(graph_path.read_text())

        for edge in graph["edges"]:
            if edge["inferred"]:
                self.assertNotEqual(edge["permission_mode"], "automatic-low-risk")
                self.assertIn(edge["approval_status"], ["pending", "approved", "rejected", "superseded"])

    def test_security_and_workflow_docs_exist(self):
        for relative_path, required_terms in {
            "docs/security/v1-permission-matrix.md": [
                "suggest-only",
                "draft-for-approval",
                "automatic-low-risk",
                "forbidden-in-V0",
            ],
            "docs/workflow-run-protocol.md": [
                "run_id",
                "permission_mode",
                "reviews/queue.json",
                "logs/operations.jsonl",
                "no automatic memory promotion",
            ],
        }.items():
            text = (ROOT / relative_path).read_text()
            for term in required_terms:
                self.assertIn(term, text)

    def test_project_skills_include_run_packet_contract(self):
        for relative_path in [
            "skills/daily-brief/SKILL.md",
            "skills/source-ingest/SKILL.md",
            "skills/project-review/SKILL.md",
            "skills/memory-lint/SKILL.md",
        ]:
            text = (ROOT / relative_path).read_text()
            for term in [
                "## Run Packet",
                "run_id",
                "input_files",
                "review_items",
                "logs/operations.jsonl",
                "## Failure Handling",
            ]:
                self.assertIn(term, text, f"{relative_path} missing {term}")


if __name__ == "__main__":
    unittest.main()
