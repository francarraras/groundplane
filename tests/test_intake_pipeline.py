import json
import subprocess
import tempfile
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class IntakePipelineTest(unittest.TestCase):
    def test_intake_template_exists(self):
        template = ROOT / "inbox" / "intake.md"
        self.assertTrue(template.exists(), "inbox/intake.md must exist")
        text = template.read_text()
        self.assertIn("Active Projects", text)
        self.assertIn("Paste messy bullets below", text)
        self.assertIn("BEGIN USER CONTEXT", text)

    def test_prepare_intake_review_outputs_review_packet(self):
        with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False) as handle:
            handle.write(
                "# Intake\n\n"
                "## BEGIN USER CONTEXT\n"
                "- Groundplane cockpit - make it useful daily - active - next: add real projects - urgent this week - blocker: needs personal context\n"
                "- Fitness routine - rebuild consistency - messy - next: define weekly plan\n"
                "## END USER CONTEXT\n"
            )
            input_path = handle.name

        try:
            result = subprocess.run(
                ["node", "scripts/prepare-intake-review.mjs", "--input", input_path],
                cwd=ROOT,
                capture_output=True,
                text=True,
                check=False,
            )
        finally:
            Path(input_path).unlink(missing_ok=True)

        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        packet = json.loads(result.stdout)
        self.assertEqual(packet["workflow"], "operating-context-intake")
        self.assertEqual(packet["permission_mode"], "draft-for-approval")
        self.assertEqual(packet["status"], "proposal-only")
        self.assertEqual(packet["scope"], "active-projects")
        self.assertTrue(packet["source_ids"])
        self.assertEqual(len(packet["review_items"]), 2)

        first = packet["review_items"][0]
        self.assertTrue(first["id"].startswith(packet["run_id"]))
        self.assertEqual(first["scope"], "active-projects")
        self.assertEqual(first["action_type"], "project_state_update")
        self.assertEqual(first["approval_mode"], "draft-for-approval")
        self.assertEqual(first["target_file"], "state/projects.json")
        self.assertEqual(first["sensitivity"], "personal")
        self.assertEqual(first["source_ids"], packet["source_ids"])
        self.assertTrue(first["source_refs"])
        self.assertTrue(first["raw_text_is_untrusted"])
        self.assertEqual(first["instruction_boundary"], "data-not-command")
        self.assertTrue(first["requires_explicit_approval"])
        self.assertIn("Groundplane cockpit", first["summary"])

    def test_prepare_intake_review_routes_daily_routine_scope(self):
        with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False) as handle:
            handle.write(
                "# Intake\n\n"
                "## BEGIN USER CONTEXT\n"
                "- Morning routine - rebuild focus - next: define wake and deep work blocks\n"
                "## END USER CONTEXT\n"
            )
            input_path = handle.name

        try:
            result = subprocess.run(
                [
                    "node",
                    "scripts/prepare-intake-review.mjs",
                    "--input",
                    input_path,
                    "--scope",
                    "daily-routine",
                ],
                cwd=ROOT,
                capture_output=True,
                text=True,
                check=False,
            )
        finally:
            Path(input_path).unlink(missing_ok=True)

        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        packet = json.loads(result.stdout)
        item = packet["review_items"][0]
        self.assertEqual(packet["scope"], "daily-routine")
        self.assertEqual(item["type"], "routine-intake")
        self.assertEqual(item["target_file"], "state/routines.json")

    def test_prepare_intake_review_routes_life_areas_to_memory_review(self):
        with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False) as handle:
            handle.write(
                "# Intake\n\n"
                "## BEGIN USER CONTEXT\n"
                "- Family - protect weekends - needs better planning boundaries\n"
                "## END USER CONTEXT\n"
            )
            input_path = handle.name

        try:
            result = subprocess.run(
                [
                    "node",
                    "scripts/prepare-intake-review.mjs",
                    "--input",
                    input_path,
                    "--scope",
                    "life-areas",
                ],
                cwd=ROOT,
                capture_output=True,
                text=True,
                check=False,
            )
        finally:
            Path(input_path).unlink(missing_ok=True)

        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        packet = json.loads(result.stdout)
        item = packet["review_items"][0]
        self.assertEqual(packet["scope"], "life-areas")
        self.assertEqual(item["type"], "life-area-intake")
        self.assertEqual(item["action_type"], "memory_write")
        self.assertEqual(item["risk"], "high")
        self.assertEqual(item["target_file"], "wiki/memory-claims.json")

    def test_prepare_intake_review_blocks_empty_context(self):
        result = subprocess.run(
            ["node", "scripts/prepare-intake-review.mjs", "--input", "inbox/intake.md"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        packet = json.loads(result.stdout)
        self.assertEqual(packet["status"], "needs-input")
        self.assertEqual(packet["review_items"], [])
        self.assertIn("no user context", packet["blocked_by"][0])


if __name__ == "__main__":
    unittest.main()
