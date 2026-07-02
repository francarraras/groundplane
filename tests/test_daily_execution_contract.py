import json
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
EXECUTION_PATH = ROOT / "runs" / "current-daily-execution.json"
PLAN_PATH = ROOT / "runs" / "current-daily-command-review.json"


class DailyExecutionContractTest(unittest.TestCase):
    def setUp(self):
        self.assertTrue(PLAN_PATH.exists(), "current daily command review must exist")
        self.plan = json.loads(PLAN_PATH.read_text())
        self.assertTrue(EXECUTION_PATH.exists(), "runs/current-daily-execution.json must exist")
        self.execution = json.loads(EXECUTION_PATH.read_text())

    def test_execution_runner_declares_safe_mode(self):
        for field in [
            "run_id",
            "workflow",
            "linked_plan_run_id",
            "status",
            "permission_mode",
            "current_block",
            "block_queue",
            "user_signal",
            "completion_signal",
            "blocked_by",
        ]:
            self.assertIn(field, self.execution)
        self.assertEqual(self.execution["workflow"], "daily-execution-runner")
        self.assertEqual(self.execution["linked_plan_run_id"], self.plan["run_id"])
        self.assertEqual(self.execution["permission_mode"], "suggest-only")
        self.assertEqual(self.execution["status"], "awaiting-user-start")
        self.assertEqual(self.execution["blocked_by"], [])

    def test_current_block_is_first_unstarted_plan_block(self):
        first_block = self.plan["plan_blocks"][0]
        current = self.execution["current_block"]
        self.assertEqual(current["index"], 0)
        self.assertEqual(current["label"], first_block["label"])
        self.assertEqual(current["when"], first_block["when"])
        self.assertEqual(current["duration"], first_block["duration"])
        self.assertEqual(current["action"], first_block["action"])
        self.assertIn("Start block", self.execution["user_signal"]["exact_ask"])

    def test_block_queue_preserves_daily_plan_order(self):
        labels = [block["label"] for block in self.execution["block_queue"]]
        self.assertEqual(labels, [block["label"] for block in self.plan["plan_blocks"]])
        self.assertTrue(all(block["status"] == "queued" for block in self.execution["block_queue"][1:]))


if __name__ == "__main__":
    unittest.main()
