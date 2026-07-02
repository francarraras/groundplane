import json
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
GRAPH_PATH = ROOT / "indexes" / "relationship-graph.json"
CATALOG_PATH = ROOT / "sources" / "catalog.json"


NODE_FIELDS = [
    "id",
    "type",
    "source_ref",
    "title",
    "status",
    "confidence",
    "sensitivity",
    "permission_mode",
    "provenance",
    "weights",
    "visual",
]

EDGE_FIELDS = [
    "id",
    "type",
    "from",
    "to",
    "direction",
    "strength",
    "confidence",
    "source_ids",
    "evidence",
    "inferred",
    "approval_status",
    "permission_mode",
    "provenance",
    "visual",
]


class RelationshipGraphContractTest(unittest.TestCase):
    def read_json(self, relative_path):
        path = ROOT / relative_path
        self.assertTrue(path.exists(), f"{relative_path} must exist")
        return json.loads(path.read_text())

    def assert_safe_graph_relative_path(self, relative_path):
        self.assertIsInstance(relative_path, str)
        self.assertTrue(relative_path, "graph file path must not be empty")
        path = Path(relative_path)
        self.assertFalse(path.is_absolute(), f"{relative_path} must be relative")
        self.assertNotIn("..", path.parts, f"{relative_path} must not use parent traversal")
        resolved_path = (ROOT / path).resolve()
        try:
            resolved_path.relative_to(ROOT.resolve())
        except ValueError:
            self.fail(f"{relative_path} must resolve under repo root")
        return resolved_path

    def setUp(self):
        self.graph = self.read_json("indexes/relationship-graph.json")
        self.catalog = self.read_json("sources/catalog.json")
        self.source_ids = {source["id"] for source in self.catalog["sources"]}

    def test_graph_top_level_contract(self):
        for field in [
            "schema_version",
            "generated_at",
            "source_files",
            "stats",
            "nodes",
            "edges",
            "clusters",
            "layout",
            "warnings",
        ]:
            self.assertIn(field, self.graph)
        self.assertEqual(self.graph["schema_version"], "relationship-graph.v1")
        self.assertIsInstance(self.graph["source_files"], list)
        self.assertIsInstance(self.graph["stats"], dict)
        self.assertIsInstance(self.graph["nodes"], list)
        self.assertIsInstance(self.graph["edges"], list)
        self.assertIsInstance(self.graph["clusters"], list)
        self.assertIsInstance(self.graph["layout"], dict)
        self.assertIsInstance(self.graph["warnings"], list)
        self.assertEqual(self.graph["layout"]["strategy"], "cluster-first-deterministic")
        self.assertEqual(self.graph["layout"]["version"], 1)
        for source_file in self.graph["source_files"]:
            self.assert_safe_graph_relative_path(source_file)
        self.assertGreater(len(self.graph["nodes"]), 0)
        self.assertGreater(len(self.graph["edges"]), 0)

    def test_nodes_have_required_fields_and_valid_source_refs(self):
        for node in self.graph["nodes"]:
            for field in NODE_FIELDS:
                self.assertIn(field, node, f"{node.get('id')} missing {field}")
            source_ref = node["source_ref"]
            self.assertIn("file", source_ref)
            self.assertIn("record_id", source_ref)
            self.assertIn("source_ids", source_ref)
            provenance = node["provenance"]
            self.assertEqual(provenance["generator"], "relationship-graph")
            self.assertEqual(provenance["generated_from"], "local-files")
            self.assertEqual(provenance["file"], source_ref["file"])
            self.assertEqual(provenance["record_id"], source_ref["record_id"])
            self.assertEqual(provenance["source_ids"], source_ref["source_ids"])
            source_file = self.assert_safe_graph_relative_path(source_ref["file"])
            self.assertTrue(source_file.exists(), source_ref["file"])
            self.assertIsInstance(source_ref["source_ids"], list)
            self.assertGreater(len(source_ref["source_ids"]), 0)
            for source_id in source_ref["source_ids"]:
                self.assertIn(source_id, self.source_ids)
            if node["sensitivity"] in ["sensitive", "high", "private"]:
                self.assertNotEqual(node["permission_mode"], "automatic-low-risk")

    def test_edges_have_required_fields_and_resolve_nodes(self):
        node_ids = {node["id"] for node in self.graph["nodes"]}
        for edge in self.graph["edges"]:
            for field in EDGE_FIELDS:
                self.assertIn(field, edge, f"{edge.get('id')} missing {field}")
            self.assertIn(edge["from"], node_ids)
            self.assertIn(edge["to"], node_ids)
            self.assertIn(edge["direction"], ["directed", "undirected"])
            self.assertGreaterEqual(edge["strength"], 0)
            self.assertLessEqual(edge["strength"], 1)
            self.assertIsInstance(edge["source_ids"], list)
            self.assertGreater(len(edge["source_ids"]), 0)
            self.assertIsInstance(edge["evidence"], str)
            self.assertTrue(edge["evidence"].strip())
            provenance = edge["provenance"]
            self.assertEqual(provenance["generator"], "relationship-graph")
            self.assertEqual(provenance["generated_from"], "local-files")
            self.assertEqual(provenance["source_ids"], edge["source_ids"])
            self.assertEqual(provenance["inferred"], edge["inferred"])
            for source_id in edge["source_ids"]:
                self.assertIn(source_id, self.source_ids)

    def test_expected_v1_node_types_exist(self):
        node_types = {node["type"] for node in self.graph["nodes"]}
        for expected in ["project", "task", "routine", "decision", "memory_claim", "source"]:
            self.assertIn(expected, node_types)

    def test_direct_task_project_edges_exist(self):
        edge_keys = {(edge["from"], edge["type"], edge["to"]) for edge in self.graph["edges"]}
        self.assertIn(("task:TASK-018", "belongs_to", "project:PROJ-001"), edge_keys)
        self.assertIn(("task:TASK-020", "belongs_to", "project:PROJ-001"), edge_keys)

    def test_sensitive_or_inferred_edges_are_not_auto_approved(self):
        for edge in self.graph["edges"]:
            if edge["inferred"] or edge.get("sensitivity") in ["sensitive", "high"]:
                self.assertNotEqual(edge["permission_mode"], "automatic-low-risk")

    def test_graph_stats_match_payload(self):
        stats = self.graph["stats"]
        self.assertEqual(stats["node_count"], len(self.graph["nodes"]))
        self.assertEqual(stats["edge_count"], len(self.graph["edges"]))
        self.assertEqual(stats["cluster_count"], len(self.graph["clusters"]))
        self.assertEqual(stats["warning_count"], len(self.graph["warnings"]))


if __name__ == "__main__":
    unittest.main()
