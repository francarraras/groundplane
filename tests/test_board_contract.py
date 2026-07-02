import json
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
BOARD_PATH = ROOT / "state" / "board.json"


class BoardContractTest(unittest.TestCase):
    def setUp(self):
        self.assertTrue(BOARD_PATH.exists(), "state/board.json must exist")
        self.board = json.loads(BOARD_PATH.read_text())

    def test_top_level_sections_exist(self):
        required = [
            "project",
            "decisions",
            "workstreams",
            "tasks",
            "threads",
            "risks",
            "metrics",
            "roadmap",
            "operating_protocol",
        ]
        for section in required:
            self.assertIn(section, self.board)

    def test_tasks_have_operational_fields(self):
        self.assertGreater(len(self.board["tasks"]), 0)
        for task in self.board["tasks"]:
            for field in [
                "id",
                "title",
                "status",
                "priority",
                "workstream",
                "owner",
                "next_action",
            ]:
                self.assertIn(field, task)

    def test_threads_have_ownership_boundaries(self):
        self.assertGreater(len(self.board["threads"]), 0)
        for thread in self.board["threads"]:
            for field in ["name", "status", "purpose", "owns", "prompt_file"]:
                self.assertIn(field, thread)

    def test_decisions_capture_locked_architecture(self):
        decision_text = " ".join(
            decision["decision"].lower() for decision in self.board["decisions"]
        )
        self.assertIn("local browser", decision_text)
        self.assertIn("operator", decision_text)

    def test_roadmap_has_visible_next_steps(self):
        self.assertGreater(len(self.board["roadmap"]), 0)
        for phase in self.board["roadmap"]:
            for field in ["id", "title", "status", "outcome", "next_steps"]:
                self.assertIn(field, phase)
            self.assertGreater(len(phase["next_steps"]), 0)

    def test_operating_protocol_shows_user_input_rules(self):
        protocol = self.board["operating_protocol"]
        for field in [
            "role",
            "command_rules",
            "when_operator_decides",
            "when_user_input_is_required",
            "input_request_format",
        ]:
            self.assertIn(field, protocol)
        self.assertGreater(len(protocol["when_user_input_is_required"]), 0)
        self.assertGreater(len(protocol["input_request_format"]), 0)


if __name__ == "__main__":
    unittest.main()
