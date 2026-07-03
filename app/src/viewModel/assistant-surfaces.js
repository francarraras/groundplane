import { asArray, sortedUnique, taskById } from "./helpers.js";

export function normalizeAssistantText(value = "") {
  return String(value || "")
    .replace(/\bsource-backed\b/gi, "sourced")
    .replace(/\bdistricts?\b/gi, "areas")
    .replace(/\bregions?\b/gi, "areas")
    .replace(/\bnodes?\b/gi, "items")
    .replace(/\brelationships?\b/gi, "connections")
    .replace(/\s+/g, " ")
    .trim();
}

function firstAssistantSentence(text = "") {
  const normalized = normalizeAssistantText(text);
  if (!normalized) return "";

  const firstPeriod = normalized.indexOf(". ");
  const firstSentence = firstPeriod >= 0 ? normalized.slice(0, firstPeriod) : normalized;
  return firstSentence.replace(/:\s.*$/, ".").replace(/\.$/, ".").trim();
}

function currentGateRecommendation(text = "") {
  const normalized = normalizeAssistantText(text);
  const gateMatch =
    normalized.match(/Current product gate:\s*([^.]*)/i) ||
    normalized.match(/Next recommended product move:\s*([^.]*)/i) ||
    normalized.match(/Current gate:\s*([^.]*)/i);

  if (gateMatch?.[1]) return normalizeAssistantText(gateMatch[1]).replace(/\.$/, "");
  return "Open Details and review the current next step";
}

function taskToken(text = "") {
  return normalizeAssistantText(text).match(/\bTASK-\d{3}\b/)?.[0] || "";
}

function shortAssistantMove(recommendation = "", situation = "") {
  const task = taskToken(recommendation) || taskToken(situation);
  if (task) return `Review ${task}`;

  const normalized = normalizeAssistantText(recommendation);
  if (normalized.length <= 38) return normalized || "Review next move";
  return "Review next move";
}

export function buildRoadmapCandidates(board = {}) {
  return asArray(board?.operating_protocol?.roadmap_candidates || board?.roadmap_candidates)
    .map((candidate, index) => {
      const id = String(candidate?.id || `roadmap-${index + 1}`).trim();
      const status = candidate?.status || (candidate?.recommended ? "recommended" : "candidate");
      const requiresUserInput =
        candidate?.requires_user_input === true ||
        candidate?.requiresUserInput === true ||
        /needs|blocked|parked|approval|decision/i.test(status);

      return {
        id,
        title: normalizeAssistantText(candidate?.title || id || "Roadmap candidate"),
        status,
        recommended: candidate?.recommended === true || status === "recommended",
        requiresUserInput,
        risk: candidate?.risk || "medium",
        nextAction: normalizeAssistantText(candidate?.next_action || candidate?.nextAction || "Review this slice before implementation."),
        reason: normalizeAssistantText(candidate?.reason || "Candidate from the local roadmap."),
        boundary: normalizeAssistantText(
          candidate?.approval_boundary || candidate?.boundary || "Local read-only review until separately approved.",
        ),
        sourceIds: sortedUnique(asArray(candidate?.source_ids || candidate?.sourceIds)),
      };
    })
    .filter((candidate) => candidate.id && candidate.title)
    .sort((first, second) => Number(second.recommended) - Number(first.recommended));
}

export function buildAssistantBrief({ board = {}, pendingReviews = [], graphWarnings = [], currentFocus = null } = {}) {
  const nextCommand = board?.operating_protocol?.next_command || board?.next_command || "";
  const roadmapCandidates = buildRoadmapCandidates(board);
  const nextSlice = roadmapCandidates.find((candidate) => candidate.recommended) || roadmapCandidates[0] || null;
  const situation =
    firstAssistantSentence(nextCommand) ||
    normalizeAssistantText(currentFocus?.nextAction || currentFocus?.summary || "Local state is loaded.");
  const recommendation = currentGateRecommendation(nextCommand);
  const pendingReviewCount = asArray(pendingReviews).length;
  const warningCount = asArray(graphWarnings).length;
  const reason =
    pendingReviewCount > 0
      ? `${pendingReviewCount} pending review remains visible, so the chief-of-staff path should make the next move explicit before new work.`
      : "The current local state is ready; the next move should stay explicit before another implementation slice starts.";
  const route =
    pendingReviewCount > 0
      ? "Open Details, use Next steps first, then Reviews for the pending packet."
      : "Open Details and use Next steps for the selected area.";

  return {
    id: "assistant:brief",
    title: "Your move",
    source: "state/board.json operating_protocol.next_command",
    situation,
    recommendation,
    shortRecommendation: shortAssistantMove(recommendation, situation),
    reason,
    route,
    boundary:
      "No GitHub, No Linear, No memory, No source/wiki/raw-source, No browser writes, No finance, No contacts, No public export, No license change, and No external action without separate approval.",
    primaryDrawer: "actions",
    secondaryDrawer: pendingReviewCount > 0 ? "approvals" : "more",
    pendingReviewCount,
    warningCount,
    roadmapCandidates,
    nextSlice,
    browserWrites: false,
  };
}

function firstActiveProject(projects = []) {
  return (
    asArray(projects).find((project) => project.status === "active") ||
    asArray(projects).find((project) => project.status === "planned") ||
    asArray(projects)[0] ||
    null
  );
}

function firstRoutine(routines = []) {
  return asArray(routines).find((routine) => routine.status === "active") || asArray(routines)[0] || null;
}

export function buildSystemHomeCockpit({
  board = {},
  projects = [],
  routines = [],
  taskRecords = [],
  pendingReviews = [],
  resolvedReviews = [],
  districts = [],
  relationships = [],
  assistantBrief = null,
  graphWarnings = [],
} = {}) {
  const activeProject = firstActiveProject(projects);
  const activeRoutine = firstRoutine(routines);
  const activeTasks = asArray(taskRecords).filter((task) => task.status === "active");
  const nextTask = assistantBrief?.nextSlice || asArray(taskRecords).find((task) => task.status === "needs-decision") || null;
  const projectCount = asArray(projects).filter((project) => project.status === "active").length;
  const routineCount = asArray(routines).length;
  const pendingCount = asArray(pendingReviews).length;
  const resolvedCount = asArray(resolvedReviews).length;
  const connectionCount = asArray(relationships).length;
  const areaCount = asArray(districts).length;

  return {
    id: "system-home-cockpit",
    title: "System Home Cockpit",
    subtitle: "Read-only operating front door",
    browserWrites: false,
    sourceIds: sortedUnique([
      "SRC-2026-06-13-001",
      ...asArray(board?.operating_protocol?.roadmap_candidates).flatMap((candidate) =>
        asArray(candidate?.source_ids || candidate?.sourceIds),
      ),
      ...asArray(activeProject?.sourceIds || activeProject?.source_ids),
    ]),
    sections: [
      {
        id: "today",
        title: "Today",
        status: activeTasks.length > 0 ? "active" : "ready",
        signal: activeTasks[0]?.title || nextTask?.title || "No active task running",
        detail: nextTask?.nextAction || nextTask?.next_action || "Choose the next local slice before any write.",
      },
      {
        id: "projects",
        title: "Projects",
        status: projectCount > 0 ? "active" : "quiet",
        signal: `${projectCount} active project${projectCount === 1 ? "" : "s"}`,
        detail: activeProject?.title
          ? `${activeProject.title}: ${activeProject.nextAction || activeProject.next_action || "No next action recorded."}`
          : "No project focus recorded.",
      },
      {
        id: "approvals",
        title: "Approvals",
        status: pendingCount > 0 ? "needs-review" : "clear",
        signal: pendingCount > 0 ? `${pendingCount} pending review${pendingCount === 1 ? "" : "s"}` : "No pending reviews",
        detail: `${resolvedCount} resolved outcome${resolvedCount === 1 ? "" : "s"} remain visible for audit.`,
      },
      {
        id: "brain",
        title: "Operator",
        status: graphWarnings.length > 0 ? "check" : "indexed",
        signal: `${areaCount} areas / ${connectionCount} connections`,
        detail: graphWarnings.length > 0 ? `${graphWarnings.length} graph warning${graphWarnings.length === 1 ? "" : "s"}` : "Local graph index is readable.",
      },
      {
        id: "routines",
        title: "Routines",
        status: activeRoutine?.status || (routineCount > 0 ? "parked" : "empty"),
        signal: `${routineCount} routine${routineCount === 1 ? "" : "s"}`,
        detail: activeRoutine?.nextAction || activeRoutine?.subtitle || "Daily operations stays parked until explicitly restarted.",
      },
      {
        id: "assistant",
        title: "Assistant",
        status: "read-only",
        signal: assistantBrief?.shortRecommendation || "Review next move",
        detail: assistantBrief?.recommendation || "The command center keeps one recommended move visible.",
      },
    ],
    nextSafeAction:
      "Use Home to review Today, Projects, Approvals, Operator, Routines, and Assistant, then choose the next local slice from Next steps.",
    approvalBoundary:
      "Read-only Home cockpit. No browser writes, No reviews mutation, No source/wiki/memory/raw-source mutation, No GitHub, No Linear, No external action, No finance, No contacts, and No Flagship Project reads or writes without separate approval.",
  };
}

export function buildTodayCommandSurface({
  board = {},
  projects = [],
  routines = [],
  taskRecords = [],
  assistantBrief = null,
  systemHomeCockpit = null,
} = {}) {
  const nextSlice = assistantBrief?.nextSlice || asArray(taskRecords).find((task) => task.status === "needs-decision") || null;
  const activeProjects = asArray(projects).filter((project) => project.status === "active");
  const projectSignal =
    activeProjects.length > 0
      ? `${activeProjects.length} active project${activeProjects.length === 1 ? "" : "s"}`
      : "No active project recorded";
  const projectDetail =
    activeProjects
      .slice(0, 2)
      .map((project) => `${project.title}: ${project.nextAction || "No next action recorded."}`)
      .join(" / ") || "Review project state before choosing new work.";
  const dailyOpsTask = taskById(taskRecords, "TASK-056");
  const routineCount = asArray(routines).length;
  const dailyOpsDetail =
    dailyOpsTask?.next_action ||
    dailyOpsTask?.nextAction ||
    "Daily Operations remains parked until the user explicitly restarts it.";
  const currentGate = nextSlice ? `${nextSlice.id} ${nextSlice.title}` : "No current gate recorded";
  const nextMove = nextSlice?.nextAction || assistantBrief?.recommendation || "Review Today, then choose the next local product slice.";

  return {
    id: "today-command-surface",
    title: "Today Command Surface",
    subtitle: "Read-only daily front door",
    status: "read-only",
    browserWrites: false,
    sourceIds: sortedUnique([
      "SRC-2026-06-13-001",
      "SRC-2026-06-13-002",
      ...asArray(board?.operating_protocol?.roadmap_candidates).flatMap((candidate) =>
        asArray(candidate?.source_ids || candidate?.sourceIds),
      ),
      ...asArray(systemHomeCockpit?.sourceIds),
      ...asArray(activeProjects).flatMap((project) => asArray(project.sourceIds || project.source_ids)),
    ]),
    currentGate,
    sections: [
      {
        id: "now",
        title: "Now",
        status: nextSlice?.requiresUserInput ? "review" : "ready",
        signal: currentGate,
        detail: nextMove,
      },
      {
        id: "projects",
        title: "Projects",
        status: activeProjects.length > 0 ? "active" : "quiet",
        signal: projectSignal,
        detail: projectDetail,
      },
      {
        id: "daily-ops",
        title: "Daily Ops Parked",
        status: "parked",
        signal: `${routineCount} routine${routineCount === 1 ? "" : "s"} indexed`,
        detail: dailyOpsDetail,
      },
      {
        id: "boundaries",
        title: "Boundaries",
        status: "read-only",
        signal: "Local review only",
        detail: "No Daily Operations restart, no browser writes, no private import, and no external action.",
      },
    ],
    safeNextMove: "Review Today Command Surface, then choose the next local product slice from Next steps.",
    approvalBoundary:
      "Read-only Today surface. No Daily Operations restart, No browser writes, No reviews mutation, No source/wiki/memory/raw-source mutation, No GitHub, No Linear, No external action, No finance, No contacts, and No Flagship Project reads or writes without separate approval.",
  };
}

export function buildBrainAssistantBehavior({
  board = {},
  projects = [],
  routines = [],
  taskRecords = [],
  districts = [],
  relationships = [],
  assistantBrief = null,
  graphWarnings = [],
} = {}) {
  const activeProjects = asArray(projects).filter((project) => project.status === "active");
  const activeTasks = asArray(taskRecords).filter((task) => task.status === "active");
  const nextSlice = assistantBrief?.nextSlice || null;
  const sourceIds = sortedUnique([
    "SRC-2026-06-13-001",
    "SRC-2026-06-13-002",
    ...asArray(board?.operating_protocol?.roadmap_candidates).flatMap((candidate) =>
      asArray(candidate?.source_ids || candidate?.sourceIds),
    ),
  ]);

  return {
    id: "brain-assistant-behavior",
    title: "Operator",
    subtitle: "Read-only local reasoning surface",
    mode: "read-only",
    browserWrites: false,
    recommendedMove:
      nextSlice?.nextAction ||
      assistantBrief?.recommendation ||
      "Review whether the assistant behavior surface is clear before the next product slice.",
    whatIKnow: [
      `${districts.length} areas and ${relationships.length} connections are indexed from the local relationship graph.`,
      `${activeProjects.length} active projects, ${routines.length} routines, and ${activeTasks.length} active tasks are loaded from local state.`,
      nextSlice
        ? `The current gate is ${nextSlice.id} ${nextSlice.title}.`
        : "No current review gate is recorded in the board.",
    ],
    evidence: [
      "state/board.json defines the current command, roadmap candidates, and next gate.",
      "indexes/relationship-graph.json provides the relationship graph used by the spatial map.",
      `SRC-2026-06-13-001 anchors the operating context.${sourceIds.length > 1 ? ` Related source IDs: ${sourceIds.join(", ")}.` : ""}`,
    ],
    permissionBoundary:
      "Read-only behavior. No browser writes, No memory writes, No source/wiki/raw-source mutation, No GitHub, No Linear, No external action, No finance, No contacts, and No Flagship Project writes without separate approval.",
    limits: [
      "This is a read-only local reasoning surface, not a live LLM agent running inside the browser.",
      "It does not write files, mutate reviews, promote memory, or execute external actions.",
      "It summarizes indexed local state; stale source-of-truth files must be corrected through approved operator-side edits.",
      graphWarnings.length > 0
        ? `${graphWarnings.length} graph warning${graphWarnings.length === 1 ? "" : "s"} remain visible for follow-up.`
        : "No graph warnings are currently reported.",
    ],
    sourceIds,
  };
}

export function buildSpatialCommandOverlay({ assistantBrief = null, projects = [], routines = [] } = {}) {
  const nextSlice = assistantBrief?.nextSlice || null;
  const activeProjects = asArray(projects).filter((project) => project.status === "active");
  const gate = nextSlice ? `${nextSlice.id} ${nextSlice.title}` : "No review gate recorded";
  const gateValue = nextSlice?.id || "Ready";
  const gateTitle = nextSlice?.title || "Choose next move";
  const routineCount = asArray(routines).length;

  return {
    id: "spatial-command-overlay",
    title: "Today",
    browserWrites: false,
    currentGate: gate,
    route: "Open Details only for evidence, actions, approvals, or source context.",
    cards: [
      {
        label: "Now",
        value: gateValue,
        detail: gateTitle,
      },
      {
        label: "Projects",
        value: `${activeProjects.length} active`,
        detail: activeProjects[0]?.title || "Review project context when needed.",
      },
      {
        label: "Daily",
        value: "Parked",
        detail: `${routineCount} routine${routineCount === 1 ? "" : "s"} indexed; no daily restart.`,
      },
    ],
  };
}
