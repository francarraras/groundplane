import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import * as world from "../app/src/world.js";
import {
  layoutWorldLabels,
  renderApprovalQueueRail,
  renderCommandDeck,
  renderDistrictFocusSummary,
  renderEvidenceTrail,
  renderInspector,
  renderInstruments,
  renderRegionList,
  renderReviewDraftPreview,
  renderSafeActions,
  renderWorldLabels,
} from "../app/src/instruments.js";

const { buildWorldLinks, buildWorldNodes, terrainHeightAt } = world;

const model = {
  regions: [
    {
      id: "career",
      title: "Career",
      type: "project",
      weight: 0.9,
      color: "#39d9c2",
      orbit: 0.8,
    },
    {
      id: "health",
      title: "Health",
      type: "routine",
      weight: 0.6,
      color: "#d4a45f",
      orbit: 1.2,
    },
    {
      id: "brain",
      title: "Brain",
      type: "project",
      weight: 0.7,
      color: "#a77dff",
      orbit: 1.4,
    },
  ],
};

const nodes = buildWorldNodes(model);

assert.equal(nodes.length, 3);
assert.equal(nodes[0].id, "career");
assert.equal(nodes[0].label, "Career");
assert.ok(Number.isFinite(nodes[0].position.x));
assert.ok(Number.isFinite(nodes[0].position.y));
assert.ok(Number.isFinite(nodes[0].position.z));
assert.ok(nodes[0].radius > nodes[1].radius);
assert.ok(nodes.every((node) => node.color.startsWith("#")));
assert.ok(nodes.every((node) => Number.isFinite(node.altitude)));
assert.ok(nodes.every((node) => node.districtRadius > node.radius));
assert.equal(nodes[1].type, "cadence");
assert.ok(terrainHeightAt(nodes[0].position.x, nodes[0].position.z, nodes) > terrainHeightAt(16, 16, nodes));

const graphModel = {
  nodes: [
    { id: "project:PROJ-001", title: "Career", type: "project", weight: 0.9, color: "#39d9c2", orbit: 0.8 },
    {
      id: "task:TASK-018",
      title: "Review graph spec",
      label: "task:TASK-018",
      type: "task",
      weight: 0.8,
      color: "#68a8ff",
      orbit: 1.05,
    },
    {
      id: "decision:DEC-001",
      title: "Use generated graph",
      type: "decision",
      weight: 0.7,
      color: "#ff9a4a",
      orbit: 1.2,
    },
    {
      id: "memory_claim:CLAIM-001",
      title: "Local files are truth",
      type: "memory_claim",
      weight: 0.65,
      color: "#a77dff",
      orbit: 1.35,
    },
    {
      id: "review:REV-001",
      title: "Approve graph link",
      type: "review",
      weight: 0.55,
      color: "#ff7ea8",
      orbit: 1.5,
    },
  ],
  relationships: [
    {
      id: "edge:task:TASK-018:belongs_to:project:PROJ-001",
      from: "task:TASK-018",
      to: "project:PROJ-001",
      type: "belongs_to",
      strength: 0.8,
    },
  ],
};

const graphNodes = buildWorldNodes(graphModel);
const projectNode = graphNodes.find((node) => node.id === "project:PROJ-001");
const taskNode = graphNodes.find((node) => node.id === "task:TASK-018");
const decisionNode = graphNodes.find((node) => node.id === "decision:DEC-001");
const memoryNode = graphNodes.find((node) => node.id === "memory_claim:CLAIM-001");
const reviewNode = graphNodes.find((node) => node.id === "review:REV-001");
assert.ok(projectNode);
assert.ok(taskNode);
assert.equal(projectNode.type, "terrain");
assert.equal(taskNode.sourceType, "task");
assert.equal(taskNode.type, "signal");
assert.equal(taskNode.label, "Review graph spec");
assert.equal(decisionNode?.type, "constraint");
assert.equal(memoryNode?.type, "memory");
assert.equal(reviewNode?.type, "approval");

const graphLinks = buildWorldLinks(graphModel, graphNodes);
assert.equal(graphLinks.length, 1);
assert.equal(graphLinks[0].id, "edge:task:TASK-018:belongs_to:project:PROJ-001");
assert.equal(graphLinks[0].from.id, "task:TASK-018");
assert.equal(graphLinks[0].to.id, "project:PROJ-001");
assert.equal(graphLinks[0].type, "belongs_to");
assert.equal(graphLinks[0].inferred, false);

const brokenLinks = buildWorldLinks(
  {
    nodes: graphModel.nodes,
    relationships: [
      {
        id: "edge:missing",
        from: "task:TASK-018",
        to: "project:DOES-NOT-EXIST",
        type: "belongs_to",
      },
    ],
  },
  graphNodes,
);
assert.deepEqual(brokenLinks, []);

const malformedLinks = buildWorldLinks(
  {
    nodes: graphModel.nodes,
    relationships: [
      null,
      "edge:primitive",
      {},
      { id: "edge:missing-from", to: "project:PROJ-001" },
      { id: "edge:missing-to", from: "task:TASK-018" },
    ],
  },
  graphNodes,
);
assert.deepEqual(malformedLinks, []);

const labelsRoot = { innerHTML: "" };
renderWorldLabels(labelsRoot, [
  {
    id: "offscreen-left",
    label: "Offscreen Left",
    type: "project",
    color: "#39d9c2",
    screen: { x: -397, y: 120, visible: true },
  },
  {
    id: "offscreen-right",
    label: "Offscreen Right",
    type: "routine",
    color: "#d4a45f",
    screen: { x: 604, y: 240, visible: true },
  },
]);

assert.doesNotMatch(labelsRoot.innerHTML, /--label-x:\s*-397px/);
assert.doesNotMatch(labelsRoot.innerHTML, /--label-y:\s*1036px/);
assert.doesNotMatch(labelsRoot.innerHTML, /left:\s*-397px/);
assert.doesNotMatch(labelsRoot.innerHTML, /left:\s*604px/);

renderWorldLabels(labelsRoot, [{ id: "fallback", label: "Fallback" }]);
assert.match(labelsRoot.innerHTML, /--label-x:\s*250px/);
assert.match(labelsRoot.innerHTML, /--label-y:\s*220px/);

const narrowLabelsRoot = { innerHTML: "", clientWidth: 390, clientHeight: 620 };
renderWorldLabels(narrowLabelsRoot, [
  {
    id: "narrow-a",
    label: "Narrow A",
    type: "project",
    color: "#39d9c2",
    screen: { x: -397, y: 1036, visible: true },
  },
  {
    id: "narrow-b",
    label: "Narrow B",
    type: "project",
    color: "#d4a45f",
    screen: { x: 604, y: 1036, visible: true },
  },
  {
    id: "narrow-c",
    label: "Narrow C",
    type: "routine",
    color: "#a77dff",
    screen: { x: 486, y: 1036, visible: true },
  },
  {
    id: "narrow-d",
    label: "Narrow D",
    type: "routine",
    color: "#ff7ea8",
    screen: { x: -233, y: 1036, visible: true },
  },
  {
    id: "narrow-e",
    label: "Narrow E",
    type: "project",
    color: "#ff9a4a",
    screen: { x: 282, y: 1036, visible: true },
  },
]);

const narrowLabelPositions = Array.from(
  narrowLabelsRoot.innerHTML.matchAll(/--label-x:\s*([^;]+);\s*--label-y:\s*([^;]+);/g),
  (match) => `${match[1]} ${match[2]}`,
);
assert.equal(new Set(narrowLabelPositions).size, narrowLabelPositions.length);
assert.doesNotMatch(narrowLabelsRoot.innerHTML, /--label-x:\s*-397px/);
assert.doesNotMatch(narrowLabelsRoot.innerHTML, /--label-y:\s*1036px/);

const desktopLabelsRoot = {
  innerHTML: "",
  getBoundingClientRect() {
    return { width: 900, height: 620 };
  },
};
renderWorldLabels(desktopLabelsRoot, [
  {
    id: "desktop",
    label: "Desktop",
    type: "project",
    color: "#39d9c2",
    screen: { x: 604, y: 240, visible: true },
  },
]);
assert.match(desktopLabelsRoot.innerHTML, /--label-x:\s*604px/);
assert.match(desktopLabelsRoot.innerHTML, /--label-y:\s*240px/);

const desktopEdgeLabelsRoot = {
  innerHTML: "",
  getBoundingClientRect() {
    return { width: 900, height: 620 };
  },
};
renderWorldLabels(desktopEdgeLabelsRoot, [
  {
    id: "desktop-edge-right",
    label: "Desktop Edge Right",
    type: "project",
    color: "#39d9c2",
    screen: { x: 916, y: 684, visible: true },
  },
  {
    id: "desktop-edge-left",
    label: "Desktop Edge Left",
    type: "routine",
    color: "#d4a45f",
    screen: { x: 254, y: 684, visible: true },
  },
]);

assert.doesNotMatch(desktopEdgeLabelsRoot.innerHTML, /--label-x:\s*916px/);
assert.doesNotMatch(desktopEdgeLabelsRoot.innerHTML, /--label-y:\s*684px/);

const calmAtlasLabels = layoutWorldLabels(
  Array.from({ length: 8 }, (_, index) => ({
    id: `calm-${index}`,
    label: `Calm ${index}`,
    type: "district",
    color: "#68a8ff",
    screen: {
      x: 120 + index * 132,
      y: index % 2 === 0 ? 170 : 500,
      visible: true,
    },
  })),
  { width: 1280, height: 720, exclusions: [] },
  { selectedId: "calm-0" },
);
assert.equal(calmAtlasLabels.filter((label) => label.visible).length, 5);
assert.ok(
  calmAtlasLabels.find((label) => label.id === "calm-0").size.width >
    calmAtlasLabels.find((label) => label.id === "calm-1").size.width,
);

const crowdedLayout = layoutWorldLabels(
  [
    {
      id: "focus",
      label: "Current Focus",
      type: "terrain",
      color: "#39d9c2",
      weight: 0.9,
      focus: 0.1,
      distance: 8,
      screen: { x: 420, y: 260, visible: true },
    },
    {
      id: "near-a",
      label: "Related Cluster",
      type: "terrain",
      color: "#d4a45f",
      weight: 0.7,
      focus: 0.6,
      distance: 9,
      screen: { x: 426, y: 263, visible: true },
    },
    {
      id: "near-b",
      label: "Daily Cadence",
      type: "cadence",
      color: "#a77dff",
      weight: 0.5,
      focus: 1.2,
      distance: 10,
      screen: { x: 432, y: 266, visible: true },
    },
  ],
  { width: 900, height: 620 },
);

assert.equal(crowdedLayout.filter((label) => label.visible).length, 3);
for (let index = 0; index < crowdedLayout.length; index += 1) {
  for (let nextIndex = index + 1; nextIndex < crowdedLayout.length; nextIndex += 1) {
    const first = crowdedLayout[index].box;
    const second = crowdedLayout[nextIndex].box;
    const overlaps = !(
      first.right <= second.left ||
      second.right <= first.left ||
      first.bottom <= second.top ||
      second.bottom <= first.top
    );
    assert.equal(overlaps, false, `${crowdedLayout[index].id} overlaps ${crowdedLayout[nextIndex].id}`);
  }
}

const tinyLayout = layoutWorldLabels(
  Array.from({ length: 18 }, (_, index) => ({
    id: `tiny-${index}`,
    label: `Crowded ${index}`,
    type: "terrain",
    color: "#39d9c2",
    weight: index === 0 ? 1 : 0.25,
    focus: index === 0 ? 0 : 4 + index,
    distance: 8 + index,
    screen: { x: 195 + index, y: 310 + index, visible: true },
  })),
  { width: 390, height: 620 },
);
assert.ok(tinyLayout.some((label) => label.visible === false));
assert.equal(tinyLayout.find((label) => label.id === "tiny-0")?.visible, true);

const selectedLayout = layoutWorldLabels(
  [
    {
      id: "selected-hidden-projection",
      selected: true,
      label: "Selected Hidden Projection",
      type: "terrain",
      color: "#39d9c2",
      weight: 0.5,
      screen: { x: -400, y: -400, visible: false },
    },
    ...Array.from({ length: 10 }, (_, index) => ({
      id: `background-${index}`,
      label: `Background ${index}`,
      type: "terrain",
      color: "#d4a45f",
      weight: 0.2,
      screen: { x: 260 + index, y: 260 + index, visible: true },
    })),
  ],
  { width: 500, height: 500 },
);
assert.equal(selectedLayout.find((label) => label.id === "selected-hidden-projection")?.visible, true);

const focusAwareLayout = layoutWorldLabels(
  [
    {
      id: "selected-node",
      label: "Selected Node",
      type: "signal",
      color: "#68a8ff",
      weight: 0.4,
      screen: { x: 250, y: 250, visible: true },
    },
    {
      id: "related-node",
      label: "Related Node",
      type: "terrain",
      color: "#d6a968",
      weight: 0.35,
      screen: { x: 254, y: 252, visible: true },
    },
    ...Array.from({ length: 16 }, (_, index) => ({
      id: `background-node-${index}`,
      label: `Background ${index}`,
      type: "terrain",
      color: "#8be28b",
      weight: 0.2,
      screen: { x: 258 + index, y: 254 + index, visible: true },
    })),
  ],
  { width: 390, height: 620 },
  {
    selectedId: "selected-node",
    relatedNodeIds: ["related-node"],
    hoveredId: null,
    labelPriorityById: {
      "selected-node": 1200,
      "related-node": 700,
    },
  },
);
assert.equal(focusAwareLayout.find((label) => label.id === "selected-node")?.visible, true);
assert.equal(focusAwareLayout.find((label) => label.id === "selected-node")?.role, "selected");
assert.equal(focusAwareLayout.find((label) => label.id === "related-node")?.visible, true);
assert.equal(focusAwareLayout.find((label) => label.id === "related-node")?.role, "related");
assert.ok(focusAwareLayout.filter((label) => label.visible).length <= 4);

const denseAtlasLayout = layoutWorldLabels(
  Array.from({ length: 18 }, (_, index) => ({
    id: `district-dense-${index}`,
    label: `Dense District ${index}`,
    type: "district",
    color: "#d4a45f",
    weight: index === 0 ? 1 : 0.48,
    focus: index === 0 ? 0 : 8 + index,
    distance: 9 + index,
    screen: {
      x: 130 + (index % 6) * 116,
      y: 105 + Math.floor(index / 6) * 112,
      visible: true,
    },
  })),
  { width: 980, height: 640 },
  {
    selectedId: "district-dense-0",
    relatedNodeIds: ["district-dense-1", "district-dense-2"],
    labelPriorityById: {
      "district-dense-0": 1300,
      "district-dense-1": 720,
      "district-dense-2": 700,
    },
  },
);
assert.equal(denseAtlasLayout.find((label) => label.id === "district-dense-0")?.visible, true);
assert.equal(denseAtlasLayout.find((label) => label.id === "district-dense-1")?.visible, true);
assert.equal(denseAtlasLayout.find((label) => label.id === "district-dense-2")?.visible, true);
assert.ok(denseAtlasLayout.filter((label) => label.visible).length <= 7);

const districtLabelLayout = layoutWorldLabels(
  [
    {
      id: "district:career",
      label: "Career",
      type: "district",
      color: "#68a8ff",
      weight: 0.9,
      screen: { x: 420, y: 260, visible: true },
    },
    {
      id: "district:routines",
      label: "Routines",
      type: "district",
      color: "#d4a45f",
      weight: 0.7,
      screen: { x: 428, y: 264, visible: true },
    },
    {
      id: "project:CAREER",
      label: "Flagship Project",
      type: "terrain",
      color: "#68a8ff",
      weight: 0.8,
      screen: { x: 436, y: 268, visible: true },
    },
  ],
  { width: 900, height: 620 },
  {
    selectedId: "district:career",
    relatedNodeIds: ["district:routines"],
    labelPriorityById: {
      "district:career": 1300,
      "district:routines": 760,
      "project:CAREER": 420,
    },
  },
);
assert.equal(districtLabelLayout.find((label) => label.id === "district:career")?.visible, true);
assert.equal(districtLabelLayout.find((label) => label.id === "district:career")?.role, "selected");
assert.equal(districtLabelLayout.find((label) => label.id === "district:routines")?.role, "related");

const focusLabelsRoot = { innerHTML: "", clientWidth: 390, clientHeight: 620 };
renderWorldLabels(
  focusLabelsRoot,
  [
    {
      id: "selected-node",
      label: "Selected Node",
      type: "signal",
      color: "#68a8ff",
      screen: { x: -400, y: -400, visible: false },
    },
    {
      id: "related-node",
      label: "Related Node",
      type: "terrain",
      color: "#d6a968",
      screen: { x: 250, y: 250, visible: true },
    },
  ],
  {
    selectedId: "selected-node",
    relatedNodeIds: ["related-node"],
    labelPriorityById: {
      "selected-node": 1200,
      "related-node": 700,
    },
  },
);
assert.match(focusLabelsRoot.innerHTML, /data-label-role="selected"/);
assert.match(focusLabelsRoot.innerHTML, /data-label-role="related"/);

const districtLabelsRoot = { innerHTML: "", clientWidth: 900, clientHeight: 620 };
renderWorldLabels(districtLabelsRoot, [
  {
    id: "district:career",
    label: "Career",
    type: "district",
    color: "#68a8ff",
    screen: { x: 420, y: 260, visible: true },
  },
]);
assert.match(districtLabelsRoot.innerHTML, /data-label-type="district"/);

const districtRegionListRoot = { innerHTML: "" };
renderRegionList(
  districtRegionListRoot,
  {
    regions: [
      {
        id: "district:career",
        title: "Career",
        type: "district",
        color: "#68a8ff",
      },
    ],
  },
  "district:career",
);
assert.match(districtRegionListRoot.innerHTML, /data-region-type="district"/);
assert.match(districtRegionListRoot.innerHTML, /Start here/);

const humanTitleRailRoot = { innerHTML: "" };
renderRegionList(
  humanTitleRailRoot,
  {
    regions: [
      {
        id: "life-ops",
        title: "life-ops",
        type: "district",
        color: "#39d9c2",
      },
    ],
  },
  "life-ops",
);
assert.match(humanTitleRailRoot.innerHTML, />Life Ops<\/strong>/);
assert.match(humanTitleRailRoot.innerHTML, /title="Life Ops"/);

const humanTitleLabelRoot = { innerHTML: "", clientWidth: 900, clientHeight: 620 };
renderWorldLabels(humanTitleLabelRoot, [
  {
    id: "life-ops",
    label: "life-ops",
    type: "district",
    color: "#39d9c2",
    screen: { x: 420, y: 260, visible: true },
  },
]);
assert.match(humanTitleLabelRoot.innerHTML, />Life Ops<\/strong>/);

const groupedRailRoot = { innerHTML: "" };
renderRegionList(
  groupedRailRoot,
  {
    regions: Array.from({ length: 10 }, (_, index) => ({
      id: `area:${index + 1}`,
      title: `Area ${index + 1}`,
      type: index === 8 ? "proof_artifact" : "district",
      color: "#68a8ff",
      subtitle: `${index + 1} items`,
    })),
  },
  "area:9",
);
assert.match(groupedRailRoot.innerHTML, /rail-section/);
assert.match(groupedRailRoot.innerHTML, /rail-more-detail/);
assert.match(groupedRailRoot.innerHTML, /More areas/);
assert.match(groupedRailRoot.innerHTML, /<small>2<\/small>/);
assert.match(groupedRailRoot.innerHTML, /data-region-id="area:9"[\s\S]*data-rail-overflow="false"/);
assert.match(groupedRailRoot.innerHTML, /data-region-id="area:8"[\s\S]*data-rail-overflow="true"/);

const breadcrumbBox = { left: 250, top: 200, right: 390, bottom: 260 };
const breadcrumbExclusionQueries = [];
const breadcrumbExclusionRoot = {
  innerHTML: "",
  getBoundingClientRect() {
    return { left: 0, top: 0, right: 640, bottom: 500, width: 640, height: 500 };
  },
  ownerDocument: {
    querySelectorAll(selector) {
      breadcrumbExclusionQueries.push(selector);
      if (selector !== ".district-breadcrumb:not(:empty)") return [];
      return [
        {
          getBoundingClientRect() {
            return breadcrumbBox;
          },
        },
      ];
    },
  },
};
renderWorldLabels(breadcrumbExclusionRoot, [
  {
    id: "breadcrumb-overlap",
    label: "Breadcrumb Overlap",
    type: "project",
    color: "#39d9c2",
    weight: 1,
    screen: { x: 320, y: 230, visible: true },
  },
]);
assert.ok(breadcrumbExclusionQueries.includes(".district-breadcrumb:not(:empty)"));
const breadcrumbLabelMatch = breadcrumbExclusionRoot.innerHTML.match(/--label-x:\s*(-?\d+)px;\s*--label-y:\s*(-?\d+)px/);
assert.ok(breadcrumbLabelMatch);
const breadcrumbLabelBox = {
  left: Number(breadcrumbLabelMatch[1]) - 94,
  right: Number(breadcrumbLabelMatch[1]) + 94,
  top: Number(breadcrumbLabelMatch[2]) - 27,
  bottom: Number(breadcrumbLabelMatch[2]) + 27,
};
const breadcrumbLabelOverlaps = !(
  breadcrumbLabelBox.right <= breadcrumbBox.left ||
  breadcrumbBox.right <= breadcrumbLabelBox.left ||
  breadcrumbLabelBox.bottom <= breadcrumbBox.top ||
  breadcrumbBox.bottom <= breadcrumbLabelBox.top
);
assert.equal(breadcrumbLabelOverlaps, false);

const staleCacheBreadcrumbBox = { left: 250, top: 200, right: 390, bottom: 260 };
let staleCacheBreadcrumbVisible = false;
const staleCacheExclusionRoot = {
  innerHTML: "",
  getBoundingClientRect() {
    return { left: 0, top: 0, right: 640, bottom: 500, width: 640, height: 500 };
  },
  ownerDocument: {
    querySelectorAll(selector) {
      if (selector !== ".district-breadcrumb:not(:empty)" || !staleCacheBreadcrumbVisible) return [];
      return [
        {
          getBoundingClientRect() {
            return staleCacheBreadcrumbBox;
          },
        },
      ];
    },
  },
};
const staleCacheLabelNodes = [
  {
    id: "stale-cache-overlap",
    label: "Stale Cache Overlap",
    type: "project",
    color: "#39d9c2",
    weight: 1,
    screen: { x: 320, y: 230, visible: true },
  },
];
const originalDateNow = Date.now;
Date.now = () => 123456;
try {
  renderWorldLabels(staleCacheExclusionRoot, staleCacheLabelNodes);
  staleCacheBreadcrumbVisible = true;
  renderWorldLabels(staleCacheExclusionRoot, staleCacheLabelNodes);
} finally {
  Date.now = originalDateNow;
}
const staleCacheLabelMatch = staleCacheExclusionRoot.innerHTML.match(/--label-x:\s*(-?\d+)px;\s*--label-y:\s*(-?\d+)px/);
assert.ok(staleCacheLabelMatch);
const staleCacheLabelBox = {
  left: Number(staleCacheLabelMatch[1]) - 94,
  right: Number(staleCacheLabelMatch[1]) + 94,
  top: Number(staleCacheLabelMatch[2]) - 27,
  bottom: Number(staleCacheLabelMatch[2]) + 27,
};
const staleCacheLabelOverlaps = !(
  staleCacheLabelBox.right <= staleCacheBreadcrumbBox.left ||
  staleCacheBreadcrumbBox.right <= staleCacheLabelBox.left ||
  staleCacheLabelBox.bottom <= staleCacheBreadcrumbBox.top ||
  staleCacheBreadcrumbBox.bottom <= staleCacheLabelBox.top
);
assert.equal(staleCacheLabelOverlaps, false);

const focusCardBox = { left: 210, top: 260, right: 396, bottom: 334 };
const focusCardExclusionQueries = [];
const focusCardExclusionRoot = {
  innerHTML: "",
  getBoundingClientRect() {
    return { left: 0, top: 0, right: 640, bottom: 500, width: 640, height: 500 };
  },
  ownerDocument: {
    querySelectorAll(selector) {
      focusCardExclusionQueries.push(selector);
      if (selector !== ".focus-card.is-visible") return [];
      return [
        {
          getBoundingClientRect() {
            return focusCardBox;
          },
        },
      ];
    },
  },
};
renderWorldLabels(focusCardExclusionRoot, [
  {
    id: "focus-card-overlap",
    label: "Focus Card Overlap",
    type: "project",
    color: "#39d9c2",
    weight: 1,
    screen: { x: 300, y: 296, visible: true },
  },
]);
assert.ok(focusCardExclusionQueries.includes(".focus-card.is-visible"));
const focusCardLabelMatch = focusCardExclusionRoot.innerHTML.match(/--label-x:\s*(-?\d+)px;\s*--label-y:\s*(-?\d+)px/);
assert.ok(focusCardLabelMatch);
const focusCardLabelBox = {
  left: Number(focusCardLabelMatch[1]) - 94,
  right: Number(focusCardLabelMatch[1]) + 94,
  top: Number(focusCardLabelMatch[2]) - 27,
  bottom: Number(focusCardLabelMatch[2]) + 27,
};
const focusCardLabelOverlaps = !(
  focusCardLabelBox.right <= focusCardBox.left ||
  focusCardBox.right <= focusCardLabelBox.left ||
  focusCardLabelBox.bottom <= focusCardBox.top ||
  focusCardBox.bottom <= focusCardLabelBox.top
);
assert.equal(focusCardLabelOverlaps, false);

const districtWorldNodes = buildWorldNodes({
  regions: [
    {
      id: "district:career",
      title: "Career",
      type: "district",
      weight: 0.9,
      color: "#68a8ff",
      orbit: 0.8,
    },
    {
      id: "district:routines",
      title: "Routines",
      type: "district",
      weight: 0.62,
      color: "#d4a45f",
      orbit: 1.1,
    },
  ],
  relationships: [
    {
      id: "district-edge:district:career:district:routines",
      from: "district:career",
      to: "district:routines",
      type: "relates_to",
      strength: 0.52,
    },
  ],
});
assert.equal(districtWorldNodes[0].sourceType, "district");
assert.equal(districtWorldNodes[0].type, "district");
assert.equal(districtWorldNodes[0].label, "Career");

const districtWorldLinks = buildWorldLinks(
  {
    relationships: [
      {
        id: "district-edge:district:career:district:routines",
        from: "district:career",
        to: "district:routines",
        type: "relates_to",
        strength: 0.52,
      },
    ],
  },
  districtWorldNodes,
);
assert.equal(districtWorldLinks.length, 1);
assert.equal(districtWorldLinks[0].from.id, "district:career");
assert.equal(districtWorldLinks[0].to.id, "district:routines");

assert.equal(typeof world.reconcileDistrictDrilldownState, "function");

const inactiveExitState = world.reconcileDistrictDrilldownState(
  {
    atlasPosture: null,
    districtPulse: { districtId: "district:career", startedAt: 100 },
  },
  { action: "exit", now: 250 },
);
assert.equal(inactiveExitState.postureToRestore, null);
assert.equal(inactiveExitState.atlasPosture, null);
assert.deepEqual(inactiveExitState.districtPulse, { districtId: null, startedAt: 250 });

const staleUpdateState = world.reconcileDistrictDrilldownState(
  {
    atlasPosture: { distance: 6.9, polar: 0.76, azimuth: 0.4 },
    districtPulse: { districtId: "district:career", startedAt: 100 },
  },
  { visibleDistrictIds: ["district:routines"], activeDistrictId: null },
);
assert.equal(staleUpdateState.postureToRestore, null);
assert.equal(staleUpdateState.atlasPosture, null);
assert.deepEqual(staleUpdateState.districtPulse, { districtId: null, startedAt: 100 });

const preservedUpdateState = world.reconcileDistrictDrilldownState(
  {
    atlasPosture: { distance: 6.9, polar: 0.76, azimuth: 0.4 },
    districtPulse: { districtId: "district:career", startedAt: 100 },
  },
  { visibleDistrictIds: ["district:career", "district:routines"], activeDistrictId: null },
);
assert.deepEqual(preservedUpdateState.atlasPosture, { distance: 6.9, polar: 0.76, azimuth: 0.4 });
assert.deepEqual(preservedUpdateState.districtPulse, { districtId: "district:career", startedAt: 100 });

const activeModelDistrictState = world.reconcileDistrictDrilldownState(
  {
    atlasPosture: { distance: 7.1, polar: 0.74, azimuth: -0.3 },
    districtPulse: { districtId: "district:career", startedAt: 125 },
  },
  { visibleDistrictIds: [], activeDistrictId: "district:career" },
);
assert.deepEqual(activeModelDistrictState.atlasPosture, { distance: 7.1, polar: 0.74, azimuth: -0.3 });
assert.deepEqual(activeModelDistrictState.districtPulse, { districtId: "district:career", startedAt: 125 });

const styles = readFileSync(new URL("../app/src/styles.css", import.meta.url), "utf8");
assert.match(styles, /left:\s*clamp\([^;]+var\(--label-x/);
assert.match(styles, /top:\s*clamp\([^;]+var\(--label-y/);
assert.match(styles, /\.world-navigation/);
assert.match(styles, /\.world-nav-button\.is-home/);
assert.match(styles, /\.district-breadcrumb/);
assert.match(styles, /\.district-breadcrumb:empty\s*\{[^}]*display:\s*none;[^}]*pointer-events:\s*none;/s);
assert.match(styles, /data-district-exit/);
assert.match(styles, /100dvh/);
assert.match(styles, /\.world-label\[data-label-role="selected"\]/);
assert.match(styles, /\.world-label\[data-label-role="related"\]/);
assert.match(styles, /\.world-label\[data-label-type="district"\]/);
assert.match(styles, /\.region-button\[data-region-type="district"\]/);
assert.match(styles, /\.district-focus-summary/);
assert.match(styles, /\.district-summary-grid/);
assert.match(styles, /\.district-type-row/);
assert.match(styles, /data-label-state="hidden"/);

const districtLabelStyle = styles.match(/\.world-label\[data-label-type="district"\]\s*\{(?<body>[^}]*)\}/);
assert.ok(districtLabelStyle?.groups?.body, "district label style rule missing");
const hasOversizedDistrictMinWidth = /min-width:\s*168px\s*;/.test(districtLabelStyle.groups.body);
const hasMobileDistrictMinWidthOverride =
  /@media\s*\(max-width:\s*700px\)\s*\{[\s\S]*?\.world-label\[data-label-type="district"\]\s*\{[^}]*min-width:\s*(?:0|min\(132px,\s*100%\)|min\(142px,\s*100%\))\s*;[^}]*\}[\s\S]*?\}/.test(
    styles,
  );
assert.equal(hasOversizedDistrictMinWidth && !hasMobileDistrictMinWidthOverride, false);

const mobileBreakpointMarker = "@media (max-width: 700px)";
const mobileBreakpointIndex = styles.indexOf(mobileBreakpointMarker);
assert.notEqual(mobileBreakpointIndex, -1, "mobile label breakpoint missing");
const mobileBreakpointBlockStart = styles.indexOf("{", mobileBreakpointIndex);
assert.notEqual(mobileBreakpointBlockStart, -1, "mobile label breakpoint block missing");
let mobileBreakpointDepth = 0;
let mobileBreakpointBlockEnd = -1;
for (let index = mobileBreakpointBlockStart; index < styles.length; index += 1) {
  const character = styles[index];
  if (character === "{") mobileBreakpointDepth += 1;
  if (character === "}") mobileBreakpointDepth -= 1;
  if (mobileBreakpointDepth === 0) {
    mobileBreakpointBlockEnd = index;
    break;
  }
}
assert.notEqual(mobileBreakpointBlockEnd, -1, "mobile label breakpoint block is unterminated");
const mobileBreakpointBlock = styles.slice(mobileBreakpointBlockStart + 1, mobileBreakpointBlockEnd);
assert.match(
  mobileBreakpointBlock,
  /\.world-label\[data-label-type="district"\]\s*\{[^}]*min-width:\s*(?:0|min\(132px,\s*100%\)|min\(142px,\s*100%\))\s*;[^}]*\}/,
);
assert.match(
  mobileBreakpointBlock,
  /\.world-label\[data-label-role="selected"\]\s*\{[^}]*transform:\s*translate\(-50%,\s*-50%\)\s*;[^}]*\}/,
);
assert.match(
  mobileBreakpointBlock,
  /\.district-breadcrumb\s*\{[^}]*max-width:\s*calc\(100vw - 20px\)\s*;[^}]*overflow:\s*hidden\s*;[^}]*\}/,
);
assert.match(
  mobileBreakpointBlock,
  /\.district-summary-grid\s+\.readout-field\s*\{[^}]*display:\s*grid\s*;[^}]*\}/,
);
assert.match(
  mobileBreakpointBlock,
  /\.district-summary-grid\s+\.readout-field\s*\{[^}]*grid-template-columns:\s*minmax\(92px,\s*0\.68fr\)\s+minmax\(0,\s*1fr\)\s*;[^}]*\}/,
);

const compactInstrumentElements = {
  systemPulse: { innerHTML: "", textContent: "" },
  currentBlock: { textContent: "" },
  modeStrip: { innerHTML: "" },
};
renderInstruments(
  compactInstrumentElements,
  {
    regions: [{ id: "focus", title: "Focus", type: "project", nextAction: "Inspect focus" }],
    relationships: [],
    currentFocus: { id: "focus", title: "Focus", nextAction: "Inspect focus" },
    activeTasks: [{ id: "one" }, { id: "two" }],
    pendingReviews: [{ id: "REV-1" }],
    resolvedReviews: [{ id: "REV-2" }],
    instruments: {
      statusLine: "2 active signals / 1 pending approvals / 1 resolved outcomes / 1 regions",
      modes: ["Conceptual Proximity", "Time", "Importance", "Unfinished", "People", "Projects"],
    },
  },
  "focus",
);
assert.match(compactInstrumentElements.systemPulse.innerHTML, /system-pulse-chip/);
assert.match(compactInstrumentElements.systemPulse.innerHTML, /aria-label="1 approval"/);
assert.match(compactInstrumentElements.systemPulse.innerHTML, /title="1 approval"/);
assert.match(compactInstrumentElements.systemPulse.innerHTML, /title="2 tasks"/);
assert.doesNotMatch(compactInstrumentElements.systemPulse.innerHTML, />A</);
assert.equal(compactInstrumentElements.systemPulse.textContent, "1 approval 2 tasks");
assert.match(compactInstrumentElements.modeStrip.innerHTML, /mode-overflow-chip/);
assert.match(compactInstrumentElements.modeStrip.innerHTML, /\+3/);
assert.doesNotMatch(compactInstrumentElements.modeStrip.innerHTML, />People</);

const lowRiskCommandDeckHtml = renderCommandDeck({
  model: {
    regions: [],
    relationships: [],
    pendingReviews: [
      {
        id: "REV-low",
        summary: "Review whether this feels like a personal assistant cockpit",
        risk: "low",
        target_file: "app/",
        source_ids: ["SRC-1"],
      },
    ],
    resolvedReviews: [],
    reviewQueue: {
      pending: [
        {
          id: "REV-low",
          summary: "Review whether this feels like a personal assistant cockpit",
          risk: "low",
          target_file: "app/",
          source_ids: ["SRC-1"],
        },
      ],
      resolved: [],
    },
    graph: { warnings: [] },
  },
  region: { id: "browser-app", title: "Browser App V1", type: "district", status: "planned", health: "green" },
  focus: { nextAction: "Inspect the atlas surface." },
});
assert.match(lowRiskCommandDeckHtml, /<h2 title="Browser App V1" aria-label="Browser App V1">Browser App V1<\/h2>/);
assert.doesNotMatch(lowRiskCommandDeckHtml, /<h2>Review cockpit feel<\/h2>/);
assert.doesNotMatch(lowRiskCommandDeckHtml, /decision-card/);
assert.doesNotMatch(lowRiskCommandDeckHtml, /Decision context/);
assert.doesNotMatch(lowRiskCommandDeckHtml, /Continue with local polish/);
assert.match(lowRiskCommandDeckHtml, /<span>Status<\/span>\s*<small>1 approval<\/small>/);
assert.doesNotMatch(lowRiskCommandDeckHtml, /0S \/ 1A \/ 0R \/ 0Src/);
assert.match(lowRiskCommandDeckHtml, /Reviews: 1 pending/);
assert.doesNotMatch(lowRiskCommandDeckHtml, /Approvals: 1A \/ 0R/);
assert.match(lowRiskCommandDeckHtml, /Approvals/);
assert.doesNotMatch(lowRiskCommandDeckHtml, /drawer-sigil/);
assert.doesNotMatch(lowRiskCommandDeckHtml, />\s*(S|A|!|\.{3})\s*<\/span>/);
assert.match(lowRiskCommandDeckHtml, /REV-low/);

const compactSummaryCommandDeckHtml = renderCommandDeck({
  model: {
    regions: [],
    relationships: [],
    pendingReviews: [],
    resolvedReviews: [],
    reviewQueue: { pending: [], resolved: [] },
    graph: { warnings: [] },
  },
  region: {
    id: "browser-app",
    title: "Browser App V1",
    type: "district",
    status: "planned",
    health: "green",
    nextAction: "Browser App V1 has 2 items. No sourced connections yet. Implement first real browser app is the main item.",
    safeActions: [
      {
        id: "action:test:source-inspect",
        label: "Inspect evidence sources",
        actionType: "source_inspect",
        mode: "automatic-low-risk",
        risk: "low",
        allowed: true,
      },
    ],
  },
  focus: {},
});
assert.match(compactSummaryCommandDeckHtml, /<strong>Inspect evidence sources<\/strong>/);
assert.match(
  compactSummaryCommandDeckHtml,
  /title="Viewing: area\. Next: Inspect evidence sources\. Context: Browser App V1 has 2 items\./,
);

const mediumRiskCommandDeckHtml = renderCommandDeck({
  model: {
    regions: [],
    relationships: [],
    pendingReviews: [
      {
        id: "REV-medium",
        summary: "Review whether this feels like a personal assistant cockpit",
        risk: "medium",
        target_file: "app/",
        source_ids: ["SRC-1"],
      },
    ],
    resolvedReviews: [],
    reviewQueue: {
      pending: [
        {
          id: "REV-medium",
          summary: "Review whether this feels like a personal assistant cockpit",
          risk: "medium",
          target_file: "app/",
          source_ids: ["SRC-1"],
        },
      ],
      resolved: [],
    },
    graph: { warnings: [] },
  },
  region: { id: "browser-app", title: "Browser App V1", type: "district", status: "planned", health: "green" },
  focus: { nextAction: "Inspect the atlas surface." },
});
assert.match(
  mediumRiskCommandDeckHtml,
  /<h2 title="Review cockpit feel" aria-label="Review cockpit feel">Review cockpit feel<\/h2>/,
);
assert.match(mediumRiskCommandDeckHtml, /Approve \/ revise \/ reject\./);

const indexSource = readFileSync(new URL("../app/index.html", import.meta.url), "utf8");
assert.match(indexSource, /id="district-breadcrumb"/);
assert.match(indexSource, /id="home-world"/);
assert.match(indexSource, /aria-label="Home"/);
assert.match(indexSource, /id="product-app" data-inspector-state="collapsed"/);
assert.match(indexSource, /class="icon-button deck-toggle-button"[^>]+id="toggle-inspector"[^>]+aria-label="Show Details"/);
assert.match(indexSource, /id="toggle-inspector"[^>]+aria-pressed="false"/);
assert.match(indexSource, /id="toggle-inspector"[^>]+data-toggle-state="idle"/);
assert.match(indexSource, /class="deck-toggle-label">Details<\/span>/);

const shellMainSource = readFileSync(new URL("../app/src/main.js", import.meta.url), "utf8");
assert.match(shellMainSource, /let inspectorCollapsed = true/);
assert.match(shellMainSource, /const label = inspectorCollapsed \? "Show Details" : "Hide Details"/);
assert.match(shellMainSource, /aria-pressed", inspectorCollapsed \? "false" : "true"/);
assert.match(shellMainSource, /toggleState = inspectorCollapsed \? "idle" : "pressed"/);

const instrumentsSource = readFileSync(new URL("../app/src/instruments.js", import.meta.url), "utf8");
assert.match(instrumentsSource, /\.district-breadcrumb:not\(:empty\)/);
assert.doesNotMatch(instrumentsSource, /LABEL_EXCLUSION_CACHE_MS|measureLabelExclusionsCached|__worldLabelExclusionCache/);
assert.match(instrumentsSource, /function\s+renderEvidenceTrail/);
assert.match(instrumentsSource, /function\s+renderSafeActions/);
assert.match(instrumentsSource, /function\s+renderReviewDraftPreview/);
assert.match(instrumentsSource, /data-action-route-id/);
assert.match(instrumentsSource, /review-draft-preview/);
assert.match(instrumentsSource, /evidence-trail-head/);
assert.match(instrumentsSource, /evidence-note-detail/);
assert.match(instrumentsSource, /Evidence/);
assert.match(instrumentsSource, /Next steps/);

const unsafeEvidenceHtml = renderEvidenceTrail({
  evidenceTrail: {
    health: 'resolved"><script>',
    permissionMode: "draft-for-approval",
    approvalStatus: "approved",
    summary: "<img src=x onerror=alert(1)>",
    records: [
      {
        resolved: true,
        title: "<Source>",
        sourceId: "SRC-UNSAFE",
        path: "sources/raw/<unsafe>.md",
        sensitivity: "normal",
        trustLevel: "user-provided",
      },
    ],
    warnings: ["<warning>"],
  },
});
assert.match(unsafeEvidenceHtml, /&lt;img src=x onerror=alert\(1\)&gt;/);
assert.match(unsafeEvidenceHtml, /&lt;Source&gt;/);
assert.match(unsafeEvidenceHtml, /&lt;warning&gt;/);
assert.doesNotMatch(unsafeEvidenceHtml, /<img src=x|<warning>|<Source>/);

const lockedActionsHtml = renderSafeActions({
  safeActions: [
    {
      id: 'action:unsafe"><script>',
      actionType: 'raw_source_rewrite"><script>',
      label: "<Rewrite>",
      routeSummary: "<Do not run>",
      mode: "forbidden-in-V0",
      risk: "high",
      requiresExplicitApproval: true,
      targetFile: "sources/raw/source.md",
      sourceIds: ["SRC-UNSAFE"],
      allowed: false,
    },
  ],
});
assert.match(lockedActionsHtml, /data-action-route-id="action:unsafe&quot;&gt;&lt;script&gt;"/);
assert.match(lockedActionsHtml, /class="action-route-button is-locked"/);
assert.match(lockedActionsHtml, /disabled/);
assert.match(lockedActionsHtml, /&lt;Rewrite&gt;/);
assert.match(lockedActionsHtml, /Approval required/);
assert.match(lockedActionsHtml, /Needs approval/);
assert.match(lockedActionsHtml, /Not available · High risk/);
assert.match(lockedActionsHtml, /sources\/raw\/source\.md/);
assert.match(lockedActionsHtml, /SRC-UNSAFE/);
assert.doesNotMatch(lockedActionsHtml, /<Rewrite>|<Do not run>|Gate|Free|Target: none|Evidence: none/);

const unsafeReviewDraftHtml = renderReviewDraftPreview({
  id: 'PREVIEW-unsafe"><script>',
  status: "draft-preview",
  risk: "medium",
  target_file: "reviews/queue.json",
  summary: "<Draft review>",
  diff_summary: "<No writes>",
  action_type: "draft_review_item",
  approval_mode: "draft-for-approval",
  source_ids: ["SRC-UNSAFE"],
  source_trust: "<untrusted>",
  undo_path: "<remove queue item>",
  preview_notice: '<script>alert("write")</script>',
});
assert.match(unsafeReviewDraftHtml, /review-draft-preview/);
assert.match(unsafeReviewDraftHtml, /Preview only/);
assert.match(unsafeReviewDraftHtml, /Resolution guide/);
assert.match(unsafeReviewDraftHtml, /reviews\/queue\.json/);
assert.match(unsafeReviewDraftHtml, /SRC-UNSAFE/);
assert.match(unsafeReviewDraftHtml, /&lt;Draft review&gt;/);
assert.match(unsafeReviewDraftHtml, /&lt;untrusted&gt;/);
assert.match(unsafeReviewDraftHtml, /&lt;remove queue item&gt;/);
assert.match(unsafeReviewDraftHtml, /&lt;script&gt;alert\(&quot;write&quot;\)&lt;\/script&gt;/);
assert.doesNotMatch(unsafeReviewDraftHtml, /<Draft review>|<script>|<untrusted>|<remove queue item>|alert\("write"\)/);

const unsafeApprovalRailHtml = renderApprovalQueueRail([
  {
    id: 'REV-unsafe"><script>',
    status: "pending",
    risk: "medium",
    summary: "<Approve this>",
    target_file: "reviews/queue.json",
    approval_mode: "draft-for-approval",
    source_ids: ["SRC-UNSAFE"],
    source_trust: "<mixed>",
    browser_preview_id: 'PREVIEW-unsafe"><script>',
    undo_path: "<remove queue item>",
    revision_reason: "<tighten packet>",
    diff_summary: "<No durable browser writes>",
  },
  {
    id: 'REV-resolved"><script>',
    status: "approved",
    resolution_status: "approved",
    resolution_decision: "approve",
    resolved_by: '<User "approved">',
    resolved_at: "2026-06-17",
    risk: "medium",
    summary: "<Resolved review>",
    target_file: "reviews/queue.json",
    approval_mode: "draft-for-approval",
    source_ids: ["SRC-RESOLVED"],
    source_trust: "<resolved-source>",
    browser_preview_id: 'PREVIEW-resolved"><script>',
    undo_path: "<remove resolved queue item>",
    revision_reason: "<prior revision>",
    resolution_reason: "<approved because specific>",
    diff_summary: "<No downstream writes>",
  },
]);
assert.match(unsafeApprovalRailHtml, /approval-queue-rail/);
assert.match(unsafeApprovalRailHtml, /data-review-id="REV-unsafe&quot;&gt;&lt;script&gt;"/);
assert.match(unsafeApprovalRailHtml, /data-review-id="REV-resolved&quot;&gt;&lt;script&gt;"/);
assert.match(unsafeApprovalRailHtml, /Resolution guide/);
assert.match(unsafeApprovalRailHtml, /Resolution outcome/);
assert.match(unsafeApprovalRailHtml, /&lt;Approve this&gt;/);
assert.match(unsafeApprovalRailHtml, /&lt;Resolved review&gt;/);
assert.match(unsafeApprovalRailHtml, /reviews\/queue\.json/);
assert.match(unsafeApprovalRailHtml, /draft-for-approval/);
assert.match(unsafeApprovalRailHtml, /SRC-UNSAFE/);
assert.match(unsafeApprovalRailHtml, /SRC-RESOLVED/);
assert.match(unsafeApprovalRailHtml, /&lt;mixed&gt;/);
assert.match(unsafeApprovalRailHtml, /&lt;resolved-source&gt;/);
assert.match(unsafeApprovalRailHtml, /PREVIEW-unsafe&quot;&gt;&lt;script&gt;/);
assert.match(unsafeApprovalRailHtml, /PREVIEW-resolved&quot;&gt;&lt;script&gt;/);
assert.match(unsafeApprovalRailHtml, /&lt;remove queue item&gt;/);
assert.match(unsafeApprovalRailHtml, /&lt;remove resolved queue item&gt;/);
assert.match(unsafeApprovalRailHtml, /&lt;tighten packet&gt;/);
assert.match(unsafeApprovalRailHtml, /&lt;prior revision&gt;/);
assert.match(unsafeApprovalRailHtml, /&lt;approved because specific&gt;/);
assert.match(unsafeApprovalRailHtml, /&lt;User &quot;approved&quot;&gt;/);
assert.doesNotMatch(
  unsafeApprovalRailHtml,
  /<Approve this>|<Resolved review>|<script>|<mixed>|<resolved-source>|<remove queue item>|<remove resolved queue item>|<tighten packet>|<prior revision>|<approved because specific>|<No durable browser writes>|<No downstream writes>/,
);

const inspectorPreviewRoot = { innerHTML: "" };
renderInspector(
  inspectorPreviewRoot,
  {
    phase: "test",
    updatedAt: "now",
    activeTasks: [],
    pendingReviews: [],
    regions: [
      {
        id: "project:preview",
        title: "Preview Project",
        type: "project",
        status: "active",
        health: "green",
        nextAction: "Inspect preview",
        safeActions: [],
        evidenceTrail: { health: "resolved", records: [], sourceIds: [], summary: "Preview evidence." },
      },
    ],
    relationships: [],
    currentFocus: { id: "project:preview", title: "Preview Project" },
    inspector: { related: [] },
    instruments: {},
  },
  "project:preview",
  null,
  { ...JSON.parse(JSON.stringify({ id: "PREVIEW-project-preview", target_file: "reviews/queue.json", source_ids: ["SRC-UNSAFE"] })), status: "draft-preview" },
);
assert.match(inspectorPreviewRoot.innerHTML, /review-draft-preview/);
assert.match(inspectorPreviewRoot.innerHTML, /reviews\/queue\.json/);
assert.match(inspectorPreviewRoot.innerHTML, /command-deck/);
assert.match(inspectorPreviewRoot.innerHTML, /command-deck-primary/);
assert.match(inspectorPreviewRoot.innerHTML, /data-cockpit-scope="region"/);
assert.match(inspectorPreviewRoot.innerHTML, /data-drawer-kind="sources"/);
assert.match(inspectorPreviewRoot.innerHTML, /data-drawer-kind="actions"/);
assert.match(inspectorPreviewRoot.innerHTML, /data-drawer-kind="approvals"/);
assert.match(inspectorPreviewRoot.innerHTML, /<details/);
assert.ok(
  inspectorPreviewRoot.innerHTML.indexOf("command-deck-primary") <
    inspectorPreviewRoot.innerHTML.indexOf("data-drawer-kind=\"sources\""),
);

const districtSummarySubject = {
  activeDistrictSummary: {
    scope: "district",
    title: "<Career>",
    summary: '<img src=x onerror="district()">',
    nodeCount: 2,
    relationshipCount: 3,
    sourceBackedRelationshipCount: 1,
    visualRelationshipCount: 2,
    permissionMode: "draft-for-approval",
    approvalStatus: "needs-review",
    anchorTitle: "Flagship Project",
    dominantTypes: ["project", "task"],
  },
};
const districtFocusSummaryHtml = renderDistrictFocusSummary(districtSummarySubject);
assert.match(districtFocusSummaryHtml, /district-focus-summary/);
assert.match(districtFocusSummaryHtml, /data-inspector-scope="district"/);
assert.match(districtFocusSummaryHtml, /Area focus/);
assert.match(districtFocusSummaryHtml, /Sourced links/);
assert.match(districtFocusSummaryHtml, /Visible links/);
assert.match(districtFocusSummaryHtml, /draft-for-approval/);
assert.match(districtFocusSummaryHtml, /needs-review/);
assert.match(districtFocusSummaryHtml, /&lt;Career&gt;/);
assert.match(districtFocusSummaryHtml, /&lt;img/);
assert.doesNotMatch(districtFocusSummaryHtml, /<Career>|<img|onerror="/);

const districtInspectorRoot = { innerHTML: "" };
renderInspector(
  districtInspectorRoot,
  {
    phase: "test",
    updatedAt: "now",
    activeDistrict: { id: "district:career", title: "Career" },
    activeDistrictSummary: {
      scope: "district",
      title: "Career",
      summary: "Career has 2 items and 1 local connection.",
      nodeCount: 2,
      relationshipCount: 1,
      sourceBackedRelationshipCount: 1,
      visualRelationshipCount: 0,
      permissionMode: "draft-for-approval",
      approvalStatus: "approved",
      anchorTitle: "Flagship Project",
      dominantTypes: ["project", "task"],
    },
    activeTasks: [],
    pendingReviews: [],
    regions: [
      {
        id: "project:career",
        title: "Flagship Project",
        type: "project",
        status: "active",
        health: "green",
        nextAction: "Ship proof",
        safeActions: [],
        evidenceTrail: { health: "resolved", records: [], sourceIds: [], summary: "Career evidence." },
      },
    ],
    relationships: [],
    currentFocus: { id: "project:career", title: "Flagship Project" },
    inspector: { related: [] },
    instruments: {},
  },
  "project:career",
);
assert.match(districtInspectorRoot.innerHTML, /district-focus-summary/);
assert.ok(
  districtInspectorRoot.innerHTML.indexOf("district-focus-summary") <
    districtInspectorRoot.innerHTML.indexOf("inspector-lede"),
);

const strictSafeActionsHtml = renderSafeActions({
  safeActions: [
    {
      id: "action:boolean-true",
      actionType: "open_route",
      label: "Boolean allowed",
      allowed: true,
    },
    {
      id: "action:string-truthy",
      actionType: "open_route",
      label: "String truthy locked",
      allowed: "yes",
    },
    {
      id: "action:number-truthy",
      actionType: "open_route",
      label: "Number truthy locked",
      allowed: 1,
    },
  ],
});

function actionButtonHtml(html, routeId) {
  const escapedRouteId = routeId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.match(
    new RegExp(`<button(?:(?!<\\/button>)[\\s\\S])*data-action-route-id="${escapedRouteId}"(?:(?!<\\/button>)[\\s\\S])*<\\/button>`),
  )?.[0];
}

const booleanAllowedButton = actionButtonHtml(strictSafeActionsHtml, "action:boolean-true");
const stringTruthyButton = actionButtonHtml(strictSafeActionsHtml, "action:string-truthy");
const numberTruthyButton = actionButtonHtml(strictSafeActionsHtml, "action:number-truthy");
assert.ok(booleanAllowedButton, "boolean allowed action button missing");
assert.ok(stringTruthyButton, "string truthy action button missing");
assert.ok(numberTruthyButton, "number truthy action button missing");
assert.doesNotMatch(booleanAllowedButton, /\bis-locked\b|disabled/);
assert.match(stringTruthyButton, /\bis-locked\b/);
assert.match(stringTruthyButton, /disabled/);
assert.match(numberTruthyButton, /\bis-locked\b/);
assert.match(numberTruthyButton, /disabled/);

const commandsSource = readFileSync(new URL("../app/src/commands.js", import.meta.url), "utf8");
assert.match(commandsSource, /import\s*\{\s*buildQueryRecords,\s*searchQueryRecords\s*\}\s*from\s*"\.\/query\.js";/);
assert.match(commandsSource, /function\s+setModel\s*\(\s*nextModel\s*\)/);
assert.match(commandsSource, /searchQueryRecords\(queryRecords,\s*normalizedQuery\)/);
assert.match(commandsSource, /data-route-id/);
assert.match(commandsSource, /Enter/);

const worldSource = readFileSync(new URL("../app/src/world.js", import.meta.url), "utf8");
assert.match(worldSource, /pointerdown/);
assert.match(worldSource, /wheel/);
assert.match(worldSource, /focus\(regionId\)/);
assert.match(worldSource, /LABEL_EMIT_INTERVAL_MS/);
assert.match(worldSource, /emitLabels\(true\)/);
assert.match(worldSource, /enterDistrict\(districtId\)/);
assert.match(worldSource, /exitDistrict\(\)/);
assert.match(worldSource, /atlasPosture/);
assert.match(worldSource, /districtPulse/);
const lineMatchesFocusSource = sourceBlock(worldSource, /function\s+lineMatchesFocus\s*\(\s*line,\s*state\s*\)/, "lineMatchesFocus");
assert.match(
  lineMatchesFocusSource,
  /if\s*\(\s*state\.selectedRelationshipId\s*\)\s*return\s+Boolean\(state\.relationshipIds\?\.includes\(line\.userData\.linkId\)\);/,
);

const mainSource = readFileSync(new URL("../app/src/main.js", import.meta.url), "utf8");
assert.match(mainSource, /commandPalette\.setModel\(model\);/);
assert.match(mainSource, /import\s*\{\s*buildReviewDraftPreview\s*\}\s*from\s*"\.\/reviewDraft\.js";/);
assert.match(mainSource, /let activeReviewDraftPreview = null/);
assert.match(mainSource, /action\.actionType\s*===\s*"draft_review_item"/);
assert.match(mainSource, /renderInstruments\(elements,\s*model,\s*selectedId,\s*selectedRelationshipId,\s*activeReviewDraftPreview\);/);
assert.doesNotMatch(mainSource, /localStorage|sessionStorage|indexedDB|\.setItem\(|fetch\([^)]*\{\s*method\s*:\s*["'](?:POST|PUT|PATCH|DELETE)/i);

function sourceBlock(source, marker, label) {
  const match = source.match(marker);
  assert.ok(match?.index !== undefined, `${label} marker missing`);

  const blockStart = source.indexOf("{", match.index + match[0].length);
  assert.notEqual(blockStart, -1, `${label} block missing`);

  let depth = 0;
  for (let index = blockStart; index < source.length; index += 1) {
    const character = source[index];
    if (character === "{") depth += 1;
    if (character === "}") depth -= 1;
    if (depth === 0) return source.slice(match.index, index + 1);
  }

  throw new Error(`${label} block is unterminated`);
}

assert.match(worldSource, /pendingDistrictEntries\s*=\s*new\s+Map\(\)/);
const preservePendingDistrictEntrySource = sourceBlock(
  worldSource,
  /function\s+preservePendingDistrictEntry\s*\(\s*activeDistrictId\s*\)/,
  "preservePendingDistrictEntry",
);
assert.match(preservePendingDistrictEntrySource, /pendingDistrictEntries\.clear\(\);/);
assert.match(
  preservePendingDistrictEntrySource,
  /nodeEntries\.find\(\(candidate\)\s*=>\s*candidate\.node\.id\s*===\s*activeDistrictId\)/,
);
assert.match(preservePendingDistrictEntrySource, /pendingDistrictEntries\.set\(activeDistrictId,\s*snapshotNodeEntry\(entry\)\);/);

const worldRebuildSource = sourceBlock(worldSource, /function\s+rebuild\s*\(\s*nextModel\s*\)/, "world rebuild");
assert.match(worldRebuildSource, /const\s+activeDistrictId\s*=\s*nextModel\?\.activeDistrictId\s*\|\|\s*null;/);
const preserveDistrictEntryIndex = worldRebuildSource.indexOf("preservePendingDistrictEntry(activeDistrictId);");
const replaceNodeEntriesIndex = worldRebuildSource.indexOf("nodeEntries = nodes.map(createNodeMesh);");
assert.ok(preserveDistrictEntryIndex >= 0);
assert.ok(replaceNodeEntriesIndex >= 0);
assert.ok(preserveDistrictEntryIndex < replaceNodeEntriesIndex);

const worldEnterDistrictSource = sourceBlock(worldSource, /enterDistrict\s*\(\s*districtId\s*\)/, "world enterDistrict");
assert.match(
  worldEnterDistrictSource,
  /nodeEntries\.find\(\(candidate\)\s*=>\s*candidate\.node\.id\s*===\s*districtId\)\s*\|\|\s*pendingDistrictEntries\.get\(districtId\)/,
);
assert.match(worldEnterDistrictSource, /pendingDistrictEntries\.delete\(districtId\);/);

assert.match(mainSource, /let baseModel = null/);
assert.match(mainSource, /let activeDistrictId = null/);
assert.match(mainSource, /function rebuildRenderModel/);
assert.match(mainSource, /function enterDistrict/);
assert.match(mainSource, /function exitDistrict/);
assert.match(mainSource, /districtBreadcrumb/);
assert.match(mainSource, /world\?\.enterDistrict/);
assert.match(mainSource, /world\?\.exitDistrict/);
assert.match(mainSource, /renderDistrictBreadcrumb/);
assert.match(mainSource, /home:\s*document\.querySelector\("#home-world"\)/);

assert.match(mainSource, /import\s*\{[^}]*\bbuildDistrictWorldModel\b[^}]*\}\s*from\s*"\.\/viewModel\.js";/);
assert.match(mainSource, /import\s*\{[^}]*\brenderDistrictBreadcrumb\b[^}]*\}\s*from\s*"\.\/instruments\.js";/);
assert.match(mainSource, /districtBreadcrumb:\s*document\.querySelector\("#district-breadcrumb"\)/);

const findDistrictSource = sourceBlock(mainSource, /function\s+findDistrict\s*\(\s*districtId\s*\)/, "findDistrict");
assert.match(
  findDistrictSource,
  /return\s+asArray\(baseModel\?\.districts\)\.find\(\(district\)\s*=>\s*district\.id\s*===\s*districtId\)\s*\|\|\s*null;/,
);

const rebuildRenderModelSource = sourceBlock(mainSource, /function\s+rebuildRenderModel\s*\(\s*\)/, "rebuildRenderModel");
assert.match(rebuildRenderModelSource, /model\s*=\s*buildDistrictWorldModel\(baseModel,\s*activeDistrictId\);/);
assert.match(
  rebuildRenderModelSource,
  /selectedId\s*=\s*model\.currentFocus\?\.id\s*\|\|\s*model\.regions\?\.\[0\]\?\.id\s*\|\|\s*null;/,
);
assert.match(rebuildRenderModelSource, /hoveredId\s*=\s*null;/);
assert.match(rebuildRenderModelSource, /activeReviewDraftPreview\s*=\s*null;/);
assert.match(rebuildRenderModelSource, /commandPalette\.setCommands\(model\.commands\);/);
assert.match(
  rebuildRenderModelSource,
  /renderInstruments\(elements,\s*model,\s*selectedId,\s*selectedRelationshipId,\s*activeReviewDraftPreview\);/,
);
assert.match(rebuildRenderModelSource, /renderDistrictBreadcrumb\(elements\.districtBreadcrumb,\s*model\);/);
assert.match(rebuildRenderModelSource, /renderLabels\(buildWorldNodes\(model\)\);/);
assert.match(
  rebuildRenderModelSource,
  /setFocusCard\(model\.activeDistrict\s*\|\|\s*model\.currentFocus\s*\|\|\s*findRegion\(selectedId\)\);/,
);
assert.match(rebuildRenderModelSource, /world\?\.update\(model\);/);
assert.match(rebuildRenderModelSource, /world\?\.setFocusState\(currentFocusContext\(\)\);/);

const enterDistrictSource = sourceBlock(mainSource, /function\s+enterDistrict\s*\(\s*districtId\s*\)/, "enterDistrict");
assert.match(enterDistrictSource, /if\s*\(\s*!district\s*\)\s*return\s+false;/);
assert.match(enterDistrictSource, /activeDistrictId\s*=\s*district\.id;/);
assert.match(enterDistrictSource, /return\s+true;/);
const enterActiveDistrictIndex = enterDistrictSource.indexOf("activeDistrictId = district.id;");
const enterRebuildIndex = enterDistrictSource.indexOf("rebuildRenderModel();");
const enterWorldIndex = enterDistrictSource.indexOf("world?.enterDistrict(previousDistrictId);");
const enterSuccessIndex = enterDistrictSource.indexOf("return true;");
assert.ok(enterActiveDistrictIndex >= 0);
assert.ok(enterRebuildIndex >= 0);
assert.ok(enterWorldIndex >= 0);
assert.ok(enterSuccessIndex >= 0);
assert.ok(enterActiveDistrictIndex < enterRebuildIndex);
assert.ok(enterRebuildIndex < enterWorldIndex);
assert.ok(enterWorldIndex < enterSuccessIndex);

const exitDistrictSource = sourceBlock(mainSource, /function\s+exitDistrict\s*\(\s*\)/, "exitDistrict");
assert.match(exitDistrictSource, /if\s*\(\s*!activeDistrictId\s*\)\s*return;/);
assert.match(exitDistrictSource, /activeDistrictId\s*=\s*null;/);
assert.match(exitDistrictSource, /rebuildRenderModel\(\);/);
assert.match(exitDistrictSource, /world\?\.exitDistrict\(\);/);

const selectRegionSource = sourceBlock(mainSource, /function\s+selectRegion\s*\(\s*regionId,\s*options\s*=\s*\{\}\s*\)/, "selectRegion");
assert.match(selectRegionSource, /if\s*\(\s*regionId\s*===\s*"district:exit"\s*\)\s*\{[\s\S]*exitDistrict\(\);[\s\S]*return;[\s\S]*\}/);
assert.match(selectRegionSource, /if\s*\(\s*findDistrict\(regionId\)\s*&&\s*options\.allowDistrictEnter\s*!==\s*false\s*\)\s*\{[\s\S]*enterDistrict\(regionId\);[\s\S]*return;[\s\S]*\}/);

const breadcrumbClickSource = sourceBlock(
  mainSource,
  /elements\.districtBreadcrumb\?\.addEventListener\("click"/,
  "district breadcrumb click listener",
);
assert.match(breadcrumbClickSource, /closest\("\[data-district-exit\]"\)/);
assert.match(breadcrumbClickSource, /exitDistrict\(\);/);

const goAtlasHomeSource = sourceBlock(mainSource, /function\s+goAtlasHome\s*\(\s*\)/, "goAtlasHome");
assert.match(goAtlasHomeSource, /exitDistrict\(\);/);
assert.match(goAtlasHomeSource, /world\?\.recenter\(\);/);
assert.match(
  goAtlasHomeSource,
  /selectRegion\(model\?\.currentFocus\?\.id\s*\|\|\s*selectedId,\s*\{\s*focus:\s*false,\s*allowDistrictEnter:\s*false\s*\}\);/,
);
assert.match(mainSource, /elements\.atlasHome\?\.addEventListener\("click",\s*goAtlasHome\);/);
assert.match(mainSource, /elements\.home\?\.addEventListener\("click",\s*goAtlasHome\);/);
assert.match(indexSource, /id="relation-prev-world"/);
assert.match(indexSource, /id="relation-next-world"/);
assert.match(indexSource, /aria-label="Previous connection"/);
assert.match(indexSource, /aria-label="Next connection"/);
assert.match(mainSource, /relationPrev:\s*document\.querySelector\("#relation-prev-world"\)/);
assert.match(mainSource, /relationNext:\s*document\.querySelector\("#relation-next-world"\)/);
assert.match(mainSource, /function\s+relationNavigationTargets\s*\(/);
assert.match(mainSource, /function\s+syncRelationNavigation\s*\(/);
assert.match(mainSource, /function\s+selectAdjacentRelationship\s*\(\s*direction\s*\)/);
assert.match(mainSource, /relationships\.filter\(\s*\(relationship\)\s*=>\s*relationship\?\.from\s*===\s*selectedId\s*\|\|\s*relationship\?\.to\s*===\s*selectedId\s*\)/);
assert.match(mainSource, /selectedRelationshipId\s*\?\s*relationships\.findIndex/);
assert.match(mainSource, /selectRelationship\(nextRelationship\.id\);/);
assert.match(mainSource, /elements\.relationPrev\?\.addEventListener\("click",\s*\(\)\s*=>\s*selectAdjacentRelationship\(-1\)\);/);
assert.match(mainSource, /elements\.relationNext\?\.addEventListener\("click",\s*\(\)\s*=>\s*selectAdjacentRelationship\(1\)\);/);

const escapeKeySource = sourceBlock(mainSource, /window\.addEventListener\("keydown"/, "Escape key listener");
assert.match(escapeKeySource, /event\.key\s*===\s*"Escape"\s*&&\s*activeDistrictId/);
assert.match(escapeKeySource, /exitDistrict\(\);/);

const bootSource = sourceBlock(mainSource, /async\s+function\s+boot\s*\(\s*\)/, "boot");
assert.match(bootSource, /baseModel\s*=\s*buildSurfaceModel\(state\);/);
assert.match(bootSource, /activeDistrictId\s*=\s*null;/);
assert.match(bootSource, /model\s*=\s*buildDistrictWorldModel\(baseModel,\s*activeDistrictId\);/);
assert.match(bootSource, /renderDistrictBreadcrumb\(elements\.districtBreadcrumb,\s*model\);/);

assert.doesNotMatch(indexSource, /id="recenter-world"/);
assert.doesNotMatch(mainSource, /recenter:\s*document\.querySelector\("#recenter-world"\)/);
assert.doesNotMatch(mainSource, /elements\.recenter\?\.addEventListener\("click"/);
assert.match(mainSource, /latestWorldLabels/);
assert.match(mainSource, /function renderLabels/);
assert.match(mainSource, /buildFocusContext/);
assert.match(mainSource, /let hoveredId = null/);
assert.match(mainSource, /let selectedRelationshipId = null/);
assert.match(mainSource, /function currentFocusContext/);
assert.match(mainSource, /function selectRelationship/);
assert.match(mainSource, /function\s+findActionRoute/);
assert.match(mainSource, /function\s+setActionRouteStatus/);
assert.match(mainSource, /closest\("\[data-relationship-id\]"\)/);
assert.match(mainSource, /closest\("\[data-action-route-id\]"\)/);

const setActionRouteStatusSource = sourceBlock(
  mainSource,
  /function\s+setActionRouteStatus\s*\(\s*action\s*\)/,
  "setActionRouteStatus",
);
assert.match(setActionRouteStatusSource, /action\.allowed\s*===\s*true/);

const inspectorClickSource = sourceBlock(
  mainSource,
  /elements\.inspector\?\.addEventListener\("click"/,
  "inspector click listener",
);
assert.match(inspectorClickSource, /action\.browserWrites/);
assert.match(inspectorClickSource, /action\.allowed\s*!==\s*true/);
assert.match(inspectorClickSource, /action\.browserWrites\s*!==\s*false/);
assert.match(setActionRouteStatusSource, /action\.browserWrites\s*!==\s*false/);

const durableWriteRuntimeSources = [mainSource, instrumentsSource].join("\n");
assert.doesNotMatch(
  durableWriteRuntimeSources,
  /localStorage(?:\.setItem|\s*\[|\s*\.)|sessionStorage|indexedDB|navigator\.sendBeacon|writeFile|appendFile|fetch\(\s*["'][^"']*\/(?:reviews|state|sources|wiki|logs)\//,
);
assert.match(mainSource, /world\?\.setFocusState/);
assert.match(mainSource, /renderWorldLabels\(elements\.worldLabels, latestWorldLabels, currentFocusContext\(\)\)/);
assert.match(mainSource, /buildFocusContext\(model,\s*selectedId,\s*hoveredId,\s*selectedRelationshipId\)/);

console.log("product world model ok");
