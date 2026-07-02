import json
import subprocess
import tempfile
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


def write_json(path, payload):
    path.write_text(json.dumps(payload, indent=2) + "\n")


class ReviewPacketWorkflowTest(unittest.TestCase):
    def preview(self, **overrides):
        payload = {
            "id": "PREVIEW-project-proj-001-draft-review-item",
            "type": "review_packet_preview",
            "status": "draft-preview",
            "risk": "medium",
            "proposed_by": "Product App Preview",
            "action_type": "draft_review_item",
            "target_file": "reviews/queue.json",
            "summary": "Preview review packet for Groundplane",
            "source_ids": ["SRC-2026-06-13-001", "SRC-2026-06-14-002"],
            "source_refs": [
                {
                    "source_id": "SRC-2026-06-13-001",
                    "path": "sources/raw/2026-06-13-aios-research-sprint.md",
                }
            ],
            "source_trust": "user-provided",
            "sensitivity": "normal",
            "requires_explicit_approval": True,
            "diff_summary": "Prepare a review packet. Do not write memory or state directly.",
            "approval_mode": "draft-for-approval",
            "created_at": "preview-only",
            "browser_writes": False,
            "preview_notice": "The browser did not write reviews/queue.json.",
        }
        payload.update(overrides)
        return payload

    def approval(self, **overrides):
        payload = {
            "preview_id": "PREVIEW-project-proj-001-draft-review-item",
            "target_file": "reviews/queue.json",
            "risk": "medium",
            "source_ids": ["SRC-2026-06-13-001", "SRC-2026-06-14-002"],
            "undo_path": "Remove the generated review item from reviews/queue.json before promotion.",
            "reason": "Queue this preview for manual review before any durable memory or state change.",
        }
        payload.update(overrides)
        return payload

    def run_writer(self, temp_dir, preview_payload=None, approval_payload=None, queue_payload=None, extra_args=None):
        preview_path = Path(temp_dir) / "preview.json"
        approval_path = Path(temp_dir) / "approval.json"
        queue_path = Path(temp_dir) / "queue.json"
        write_json(preview_path, preview_payload or self.preview())
        write_json(approval_path, approval_payload or self.approval())
        write_json(queue_path, queue_payload or {"reviews": []})

        result = subprocess.run(
            [
                "node",
                "scripts/create-review-queue-entry.mjs",
                "--preview",
                str(preview_path),
                "--approval",
                str(approval_path),
                "--queue",
                str(queue_path),
                "--resolved-at",
                "2026-06-16",
                "--allow-test-queue",
                *(extra_args or []),
            ],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        return result, queue_path

    def queued_review(self, **overrides):
        item = {
            "id": "REV-PREVIEW-PROJECT-PROJ-001-DRAFT-REVIEW-ITEM",
            "type": "review-packet",
            "status": "pending",
            "risk": "medium",
            "proposed_by": "operator",
            "action_type": "draft_review_item",
            "target_file": "reviews/queue.json",
            "summary": "Flagship Project proof-project operating loop review",
            "source_ids": ["SRC-2026-06-13-001", "SRC-2026-06-13-002"],
            "source_trust": "mixed: user-provided + operator-thread-and-local-folder",
            "sensitivity": "mixed-high",
            "requires_explicit_approval": True,
            "diff_summary": "Prepare a review packet for the Flagship Project proof-building loop.",
            "approval_mode": "draft-for-approval",
            "created_at": "2026-06-16",
            "browser_preview_id": "PREVIEW-project-proj-001-draft-review-item",
            "approval_reason": "Existing approval reason.",
            "undo_path": "Remove the generated review item from reviews/queue.json before promotion.",
        }
        item.update(overrides)
        return item

    def resolution(self, **overrides):
        payload = {
            "review_id": "REV-PREVIEW-PROJECT-PROJ-001-DRAFT-REVIEW-ITEM",
            "decision": "revise",
            "target_file": "reviews/queue.json",
            "risk": "medium",
            "source_ids": ["SRC-2026-06-13-001", "SRC-2026-06-13-002"],
            "actor": "operator",
            "reason": "Tighten the review packet before any downstream promotion.",
            "undo_path": "Remove the generated review item from reviews/queue.json before promotion.",
        }
        payload.update(overrides)
        return payload

    def run_resolver(self, temp_dir, resolution_payload=None, queue_payload=None, extra_args=None):
        resolution_path = Path(temp_dir) / "resolution.json"
        queue_path = Path(temp_dir) / "queue.json"
        write_json(resolution_path, resolution_payload or self.resolution())
        write_json(queue_path, queue_payload or {"reviews": [self.queued_review()]})

        result = subprocess.run(
            [
                "node",
                "scripts/resolve-review-queue-entry.mjs",
                "--resolution",
                str(resolution_path),
                "--queue",
                str(queue_path),
                "--resolved-at",
                "2026-06-16",
                "--allow-test-queue",
                *(extra_args or []),
            ],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        return result, queue_path

    def assert_queue_unchanged_after_rejection(self, temp_dir, *, preview_payload=None, approval_payload=None, queue_payload=None):
        result, queue_path = self.run_writer(
            temp_dir,
            preview_payload=preview_payload,
            approval_payload=approval_payload,
            queue_payload=queue_payload,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(json.loads(queue_path.read_text()), queue_payload or {"reviews": []})
        return result

    def test_writer_appends_one_approved_preview_to_queue(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            result, queue_path = self.run_writer(temp_dir)

            self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
            queue = json.loads(queue_path.read_text())
            self.assertEqual(len(queue["reviews"]), 1)
            item = queue["reviews"][0]
            self.assertEqual(item["status"], "pending")
            self.assertEqual(item["type"], "review-packet")
            self.assertEqual(item["risk"], "medium")
            self.assertEqual(item["proposed_by"], "operator")
            self.assertEqual(item["action_type"], "draft_review_item")
            self.assertEqual(item["target_file"], "reviews/queue.json")
            self.assertEqual(item["approval_mode"], "draft-for-approval")
            self.assertEqual(item["browser_preview_id"], "PREVIEW-project-proj-001-draft-review-item")
            self.assertEqual(item["source_ids"], ["SRC-2026-06-13-001", "SRC-2026-06-14-002"])
            self.assertTrue(item["source_refs"])
            self.assertTrue(item["requires_explicit_approval"])
            self.assertIn("undo_path", item)
            self.assertIn("review_id", result.stdout)

    def test_writer_rejects_rev_002_broad_implementation_approval_without_writing(self):
        broad_approval = {
            "id": "REV-002",
            "type": "permission-boundary",
            "status": "pending",
            "target_file": "reviews/queue.json",
            "risk": "medium",
            "source_ids": ["SRC-2026-06-13-001", "SRC-2026-06-14-002"],
            "approval_text": (
                "I approve adding an operator-only, manual review-queue writer that can append one explicitly "
                "approved browser preview as a pending item to reviews/queue.json."
            ),
        }
        with tempfile.TemporaryDirectory() as temp_dir:
            result = self.assert_queue_unchanged_after_rejection(temp_dir, approval_payload=broad_approval)

        self.assertIn("preview_id", result.stderr + result.stdout)

    def test_writer_rejects_missing_approval_fields_without_writing(self):
        approval = self.approval()
        approval.pop("undo_path")
        with tempfile.TemporaryDirectory() as temp_dir:
            result, queue_path = self.run_writer(temp_dir, approval_payload=approval)

            self.assertNotEqual(result.returncode, 0)
            self.assertIn("undo_path", result.stderr + result.stdout)
            self.assertEqual(json.loads(queue_path.read_text()), {"reviews": []})

    def test_writer_rejects_mismatched_approval_without_writing(self):
        approval = self.approval(risk="low")
        with tempfile.TemporaryDirectory() as temp_dir:
            result, queue_path = self.run_writer(temp_dir, approval_payload=approval)

            self.assertNotEqual(result.returncode, 0)
            self.assertIn("risk", result.stderr + result.stdout)
            self.assertEqual(json.loads(queue_path.read_text()), {"reviews": []})

    def test_writer_rejects_mismatched_source_ids_without_writing(self):
        approval = self.approval(source_ids=["SRC-2026-06-13-001"])
        with tempfile.TemporaryDirectory() as temp_dir:
            result = self.assert_queue_unchanged_after_rejection(temp_dir, approval_payload=approval)

        self.assertIn("source_ids", result.stderr + result.stdout)

    def test_writer_rejects_unknown_source_ids_without_writing(self):
        preview = self.preview(source_ids=["SRC-UNKNOWN"])
        approval = self.approval(source_ids=["SRC-UNKNOWN"])
        with tempfile.TemporaryDirectory() as temp_dir:
            result = self.assert_queue_unchanged_after_rejection(temp_dir, preview_payload=preview, approval_payload=approval)

        self.assertIn("SRC-UNKNOWN", result.stderr + result.stdout)

    def test_writer_rejects_invalid_preview_status_without_writing(self):
        preview = self.preview(status="pending", browser_writes=True)
        with tempfile.TemporaryDirectory() as temp_dir:
            result, queue_path = self.run_writer(temp_dir, preview_payload=preview)

            self.assertNotEqual(result.returncode, 0)
            self.assertIn("draft-preview", result.stderr + result.stdout)
            self.assertEqual(json.loads(queue_path.read_text()), {"reviews": []})

    def test_writer_rejects_preview_wrong_type_or_forbidden_action_without_writing(self):
        cases = [
            (self.preview(type="review"), "review_packet_preview"),
            (self.preview(action_type="memory_write"), "draft_review_item"),
            (self.preview(action_type="raw_source_rewrite", target_file="sources/raw/private.md"), "draft_review_item"),
            (self.preview(target_file="wiki/memory-claims.json"), "reviews/queue.json"),
            (self.preview(target_file="../reviews/queue.json"), "reviews/queue.json"),
            (self.preview(target_file="reviews/../state/tasks.json"), "reviews/queue.json"),
        ]
        for preview, expected_message in cases:
            with self.subTest(preview=preview):
                approval = self.approval(
                    target_file=preview.get("target_file", "reviews/queue.json"),
                    risk=preview.get("risk", "medium"),
                    source_ids=preview.get("source_ids", []),
                )
                with tempfile.TemporaryDirectory() as temp_dir:
                    result = self.assert_queue_unchanged_after_rejection(
                        temp_dir,
                        preview_payload=preview,
                        approval_payload=approval,
                    )
                self.assertIn(expected_message, result.stderr + result.stdout)

    def test_writer_rejects_duplicate_preview_without_writing(self):
        existing = {
            "reviews": [
                {
                    "id": "REV-PREVIEW-PROJECT-PROJ-001-DRAFT-REVIEW-ITEM",
                    "type": "review-packet",
                    "status": "pending",
                    "risk": "medium",
                    "proposed_by": "operator",
                    "target_file": "reviews/queue.json",
                    "summary": "Already queued",
                    "source_ids": ["SRC-2026-06-13-001"],
                    "diff_summary": "Existing packet.",
                    "approval_mode": "draft-for-approval",
                    "created_at": "2026-06-16",
                    "browser_preview_id": "PREVIEW-project-proj-001-draft-review-item",
                }
            ]
        }
        with tempfile.TemporaryDirectory() as temp_dir:
            result, queue_path = self.run_writer(temp_dir, queue_payload=existing)

            self.assertNotEqual(result.returncode, 0)
            self.assertIn("already queued", result.stderr + result.stdout)
            self.assertEqual(json.loads(queue_path.read_text()), existing)

    def test_writer_rejects_second_replay_after_first_append(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            first, queue_path = self.run_writer(temp_dir)
            self.assertEqual(first.returncode, 0, first.stderr + first.stdout)
            before_second = queue_path.read_text()

            preview_path = Path(temp_dir) / "preview.json"
            approval_path = Path(temp_dir) / "approval.json"
            second = subprocess.run(
                [
                    "node",
                    "scripts/create-review-queue-entry.mjs",
                    "--preview",
                    str(preview_path),
                    "--approval",
                    str(approval_path),
                    "--queue",
                    str(queue_path),
                    "--allow-test-queue",
                ],
                cwd=ROOT,
                capture_output=True,
                text=True,
                check=False,
            )

            self.assertNotEqual(second.returncode, 0)
            self.assertIn("already queued", second.stderr + second.stdout)
            self.assertEqual(queue_path.read_text(), before_second)

    def test_writer_rejects_malformed_or_wrong_schema_queue_without_overwrite(self):
        cases = ["{not json", json.dumps({"items": []}), json.dumps({"reviews": {}})]
        for raw_queue in cases:
            with self.subTest(raw_queue=raw_queue):
                with tempfile.TemporaryDirectory() as temp_dir:
                    preview_path = Path(temp_dir) / "preview.json"
                    approval_path = Path(temp_dir) / "approval.json"
                    queue_path = Path(temp_dir) / "queue.json"
                    write_json(preview_path, self.preview())
                    write_json(approval_path, self.approval())
                    queue_path.write_text(raw_queue)
                    result = subprocess.run(
                        [
                            "node",
                            "scripts/create-review-queue-entry.mjs",
                            "--preview",
                            str(preview_path),
                            "--approval",
                            str(approval_path),
                            "--queue",
                            str(queue_path),
                            "--allow-test-queue",
                        ],
                        cwd=ROOT,
                        capture_output=True,
                        text=True,
                        check=False,
                    )

                    self.assertNotEqual(result.returncode, 0)
                    self.assertEqual(queue_path.read_text(), raw_queue)

    def test_writer_rejects_non_review_queue_path_without_test_flag(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            preview_path = Path(temp_dir) / "preview.json"
            approval_path = Path(temp_dir) / "approval.json"
            queue_path = Path(temp_dir) / "queue.json"
            write_json(preview_path, self.preview())
            write_json(approval_path, self.approval())
            write_json(queue_path, {"reviews": []})

            result = subprocess.run(
                [
                    "node",
                    "scripts/create-review-queue-entry.mjs",
                    "--preview",
                    str(preview_path),
                    "--approval",
                    str(approval_path),
                    "--queue",
                    str(queue_path),
                ],
                cwd=ROOT,
                capture_output=True,
                text=True,
                check=False,
            )

            self.assertNotEqual(result.returncode, 0)
            self.assertIn("reviews/queue.json", result.stderr + result.stdout)
            self.assertEqual(json.loads(queue_path.read_text()), {"reviews": []})

    def test_resolution_cli_requires_review_id(self):
        resolution = self.resolution()
        resolution.pop("review_id")
        with tempfile.TemporaryDirectory() as temp_dir:
            result, queue_path = self.run_resolver(temp_dir, resolution_payload=resolution)

            self.assertNotEqual(result.returncode, 0)
            self.assertIn("review_id", result.stderr + result.stdout)
            self.assertEqual(json.loads(queue_path.read_text()), {"reviews": [self.queued_review()]})

    def test_resolution_cli_rejects_unknown_review_id_without_writing(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            result, queue_path = self.run_resolver(
                temp_dir,
                resolution_payload=self.resolution(review_id="REV-UNKNOWN"),
            )

            self.assertNotEqual(result.returncode, 0)
            self.assertIn("REV-UNKNOWN", result.stderr + result.stdout)
            self.assertEqual(json.loads(queue_path.read_text()), {"reviews": [self.queued_review()]})

    def test_resolution_cli_rejects_mismatched_source_ids_without_writing(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            result, queue_path = self.run_resolver(
                temp_dir,
                resolution_payload=self.resolution(source_ids=["SRC-2026-06-13-001"]),
            )

            self.assertNotEqual(result.returncode, 0)
            self.assertIn("source_ids", result.stderr + result.stdout)
            self.assertEqual(json.loads(queue_path.read_text()), {"reviews": [self.queued_review()]})

    def test_resolution_cli_rejects_side_effect_fields_without_writing(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            result, queue_path = self.run_resolver(
                temp_dir,
                resolution_payload=self.resolution(memory_writes=["wiki/memory-claims.json"]),
            )

            self.assertNotEqual(result.returncode, 0)
            self.assertIn("memory_writes", result.stderr + result.stdout)
            self.assertEqual(json.loads(queue_path.read_text()), {"reviews": [self.queued_review()]})

    def test_resolution_cli_rejects_queued_item_side_effect_fields_without_writing(self):
        for forbidden_field in [
            "browser_writes",
            "contacts_actions",
            "external_actions",
            "finance_actions",
            "memory_writes",
            "promoted_files",
            "raw_source_rewrites",
            "source_writes",
            "state_writes",
            "wiki_writes",
        ]:
            with self.subTest(forbidden_field=forbidden_field):
                dirty_item = self.queued_review(**{forbidden_field: ["forbidden"]})
                with tempfile.TemporaryDirectory() as temp_dir:
                    result, queue_path = self.run_resolver(
                        temp_dir,
                        queue_payload={"reviews": [dirty_item]},
                    )

                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn(forbidden_field, result.stderr + result.stdout)
                    self.assertEqual(json.loads(queue_path.read_text()), {"reviews": [dirty_item]})

    def test_resolution_cli_applies_revise_as_pending_metadata_only(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            result, queue_path = self.run_resolver(temp_dir)

            self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
            queue = json.loads(queue_path.read_text())
            item = queue["reviews"][0]
            self.assertEqual(item["status"], "pending")
            self.assertEqual(item["resolution_status"], "revision-requested")
            self.assertEqual(item["resolution_decision"], "revise")
            self.assertEqual(item["resolution_reason"], "Tighten the review packet before any downstream promotion.")
            self.assertEqual(item["resolved_by"], "operator")
            self.assertEqual(item["resolved_at"], "2026-06-16")
            self.assertEqual(item["target_file"], "reviews/queue.json")
            self.assertEqual(item["source_ids"], ["SRC-2026-06-13-001", "SRC-2026-06-13-002"])
            self.assertIn("review_id", result.stdout)

    def test_resolution_cli_applies_approve_without_side_effects(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            result, queue_path = self.run_resolver(
                temp_dir,
                resolution_payload=self.resolution(
                    decision="approve",
                    reason="Approve this review item only; no downstream files are promoted.",
                ),
            )

            self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
            queue = json.loads(queue_path.read_text())
            item = queue["reviews"][0]
            self.assertEqual(item["status"], "approved")
            self.assertEqual(item["resolution_status"], "approved")
            self.assertEqual(item["resolution_decision"], "approve")
            self.assertNotIn("promoted_files", item)
            self.assertEqual(len(queue["reviews"]), 1)

    def test_resolution_cli_preserves_existing_queue_metadata(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            result, queue_path = self.run_resolver(
                temp_dir,
                queue_payload={
                    "schema_version": "review-queue.v1",
                    "reviews": [self.queued_review()],
                },
            )

            self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
            queue = json.loads(queue_path.read_text())
            self.assertEqual(queue["schema_version"], "review-queue.v1")
            self.assertEqual(queue["reviews"][0]["resolution_decision"], "revise")

    def test_resolution_cli_applies_reject_without_side_effects(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            result, queue_path = self.run_resolver(
                temp_dir,
                resolution_payload=self.resolution(
                    decision="reject",
                    reason="Reject this packet without changing any downstream files.",
                ),
            )

            self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
            queue = json.loads(queue_path.read_text())
            item = queue["reviews"][0]
            self.assertEqual(item["status"], "rejected")
            self.assertEqual(item["resolution_status"], "rejected")
            self.assertEqual(item["resolution_decision"], "reject")
            self.assertNotIn("promoted_files", item)
            self.assertEqual(len(queue["reviews"]), 1)

    def test_resolution_cli_rejects_non_review_queue_path_without_test_flag(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            resolution_path = Path(temp_dir) / "resolution.json"
            queue_path = Path(temp_dir) / "queue.json"
            write_json(resolution_path, self.resolution())
            write_json(queue_path, {"reviews": [self.queued_review()]})

            result = subprocess.run(
                [
                    "node",
                    "scripts/resolve-review-queue-entry.mjs",
                    "--resolution",
                    str(resolution_path),
                    "--queue",
                    str(queue_path),
                ],
                cwd=ROOT,
                capture_output=True,
                text=True,
                check=False,
            )

            self.assertNotEqual(result.returncode, 0)
            self.assertIn("reviews/queue.json", result.stderr + result.stdout)
            self.assertEqual(json.loads(queue_path.read_text()), {"reviews": [self.queued_review()]})


if __name__ == "__main__":
    unittest.main()
