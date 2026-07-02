import json
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
INTAKE_PATH = ROOT / "state" / "intake.json"


class IntakeContractTest(unittest.TestCase):
    def setUp(self):
        self.assertTrue(INTAKE_PATH.exists(), "state/intake.json must exist")
        self.intake = json.loads(INTAKE_PATH.read_text())

    def test_intake_has_recommended_scope_and_options(self):
        for field in [
            "status",
            "recommended_scope",
            "situation",
            "recommended_path",
            "exact_ask",
            "capture_file",
            "proposal_command",
            "review_policy",
            "options",
        ]:
            self.assertIn(field, self.intake)
        self.assertIn(self.intake["status"], ["needs-input", "review-required"])
        option_ids = {option["id"] for option in self.intake["options"]}
        self.assertIn(self.intake["recommended_scope"], option_ids)

    def test_intake_options_are_actionable(self):
        self.assertGreaterEqual(len(self.intake["options"]), 3)
        for option in self.intake["options"]:
            for field in [
                "id",
                "label",
                "why",
                "send_format",
                "example_prompt",
                "proposal_type",
                "action_type",
                "target_file",
            ]:
                self.assertIn(field, option)
            self.assertGreater(len(option["send_format"]), 0)

    def test_intake_options_declare_safe_routing(self):
        routes = {option["id"]: option for option in self.intake["options"]}
        self.assertEqual(routes["active-projects"]["target_file"], "state/projects.json")
        self.assertEqual(routes["daily-routine"]["target_file"], "state/routines.json")
        self.assertEqual(routes["life-areas"]["action_type"], "memory_write")
        self.assertEqual(routes["life-areas"]["target_file"], "wiki/memory-claims.json")

    def test_recommended_intake_scope_matches_current_gate(self):
        self.assertIn(f"--scope {self.intake['recommended_scope']}", self.intake["proposal_command"])

    def test_review_required_intake_points_to_review_queue(self):
        if self.intake["status"] != "review-required":
            self.skipTest("No intake review is currently staged")
        self.assertIn("REV-", self.intake["exact_ask"])
        self.assertIn("proposal", self.intake["situation"])

    def test_intake_declares_reviewable_pipeline(self):
        self.assertTrue(
            self.intake["capture_file"] == "inbox/intake.md"
            or self.intake["capture_file"].startswith("sources/raw/")
        )
        self.assertIn("prepare-intake-review.mjs", self.intake["proposal_command"])
        self.assertIn("does not write", self.intake["review_policy"])


if __name__ == "__main__":
    unittest.main()
