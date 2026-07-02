import { buildEvidenceModel } from "./evidence.js";

const REGION_PALETTE = [
  { color: "#39d9c2", orbit: 0.8 },
  { color: "#68a8ff", orbit: 1.05 },
  { color: "#d4a45f", orbit: 1.18 },
  { color: "#a77dff", orbit: 1.32 },
  { color: "#ff7ea8", orbit: 1.42 },
  { color: "#ff9a4a", orbit: 1.52 },
  { color: "#8be28b", orbit: 1.62 },
];

const DISTRICT_PALETTE = ["#39d9c2", "#68a8ff", "#d4a45f", "#a77dff", "#ff7ea8", "#ff9a4a", "#8be28b"];
const FIRST_PROJECT_WORKSPACE_ID = "workspace:PROJ-001";
const PERMISSION_PRECEDENCE = ["forbidden-in-V0", "draft-for-approval", "suggest-only", "automatic-low-risk"];
const PERMISSION_RANK = new Map(PERMISSION_PRECEDENCE.map((mode, index) => [mode, index]));
const APPROVAL_PRECEDENCE = ["rejected", "blocked", "pending", "needs-review", "proposed", "approved"];
const APPROVAL_RANK = new Map(APPROVAL_PRECEDENCE.map((status, index) => [status, index]));

function statusWeight(status, health) {
  if (status === "active" && health !== "green") return 1;
  if (status === "active") return 0.82;
  if (status === "planned") return 0.56;
  if (status === "done") return 0.38;
  return 0.48;
}

function command(id, label, kind, detail) {
  return { id, label, kind, detail };
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function attachEvidence(subject, state = {}) {
  const evidenceModel = buildEvidenceModel(subject, state);
  return {
    evidenceTrail: evidenceModel.trail,
    safeActions: evidenceModel.actions,
  };
}

function evidenceContext(state = {}) {
  return {
    sources: state.sources || {},
    permissions: state.permissions || {},
  };
}

function projectRegion(project, index) {
  const palette = REGION_PALETTE[index % REGION_PALETTE.length];
  return {
    id: project.id,
    type: "project",
    title: project.title,
    subtitle: project.domain,
    status: project.status,
    health: project.health,
    weight: statusWeight(project.status, project.health),
    color: palette.color,
    orbit: palette.orbit,
    nextAction: project.next_action,
    sourceIds: project.source_ids,
  };
}

function routineRegion(routine, index) {
  const palette = REGION_PALETTE[(index + 3) % REGION_PALETTE.length];
  const steps = asArray(routine.steps);
  return {
    id: routine.id,
    type: "routine",
    title: routine.name,
    subtitle: routine.cadence,
    status: routine.status,
    health: routine.status === "active" ? "green" : "yellow",
    weight: routine.status === "active" ? 0.64 : 0.42,
    color: palette.color,
    orbit: palette.orbit + 0.18,
    nextAction: steps.join(" / ") || "No routine steps available",
    sourceIds: [],
  };
}

function taskById(tasks, taskId) {
  return asArray(tasks).find((task) => task.id === taskId) || null;
}

function verificationText(verification = {}) {
  const tests = verification.test_count ? `${verification.test_count} tests ${verification.test_status || "unknown"}` : "tests unknown";
  const smoke = verification.smoke_status ? `private smoke ${verification.smoke_status}` : "private smoke unknown";
  return `${tests} / ${smoke}`;
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function localCommand(root, commandText, fallback = "No local command available") {
  if (!root || !commandText) return fallback;
  return `cd ${shellQuote(root)} && ${commandText}`;
}

function proofLauncherModel(proofPackage) {
  if (!proofPackage) return null;

  const root = proofPackage.artifactPath || "";
  const reviewDoc = proofPackage.reviewDoc || "";
  const smokeScript = proofPackage.smokeScript || "";

  return {
    id: proofPackage.id,
    title: proofPackage.title,
    status: proofPackage.status,
    privacy: proofPackage.privacy,
    launcherRouteId: `proof-launcher:${proofPackage.id}`,
    artifactPath: root || "none",
    reviewDoc: reviewDoc || "none",
    browserDemo: proofPackage.browserDemo || "none",
    verification: proofPackage.verification,
    sourceIds: proofPackage.sourceIds,
    reviewCommand: localCommand(root, reviewDoc ? `open ${shellQuote(reviewDoc)}` : ""),
    demoCommand: localCommand(root, "python3 server.py"),
    smokeCommand: localCommand(root, smokeScript ? `PYTHONDONTWRITEBYTECODE=1 python3 -B ${shellQuote(smokeScript)}` : ""),
    launcherBoundary: "Read-only launcher. No writes from browser.",
    safeLaunchPath: "Review package first, run the smoke check, then start the local demo only when needed.",
  };
}

function proofArtifactSummary(artifact, tasks) {
  const proofDecisionTask = taskById(tasks, "TASK-040");
  const returnTask = taskById(tasks, "TASK-041");
  const nextMainTask =
    taskById(tasks, "TASK-050") || taskById(tasks, "TASK-044") || taskById(tasks, "TASK-043") || taskById(tasks, "TASK-042") || returnTask;
  const paths = artifact?.paths || {};
  const summary = {
    id: artifact.id,
    projectId: artifact.project_id || null,
    title: artifact.title || artifact.id || "Proof artifact",
    status: artifact.status || "unknown",
    privacy: artifact.privacy || "private-local",
    currentGate: nextMainTask?.id || proofDecisionTask?.id || "unknown",
    artifactPath: paths.root || "none",
    reviewDoc: paths.review_doc || "none",
    smokeScript: paths.smoke_script || "none",
    browserDemo: paths.browser_demo || "none",
    verification: verificationText(artifact.verification),
    capabilities: asArray(artifact.capabilities),
    limitations: asArray(artifact.limitations),
    boundary: artifact.approval_boundary || "No proof-artifact approval boundary recorded.",
    nextAction: artifact.next_action || nextMainTask?.next_action || proofDecisionTask?.next_action || "No proof-artifact next action recorded.",
    sourceIds: sortedUnique([
      ...asArray(artifact.source_ids),
      ...asArray(proofDecisionTask?.source_ids),
      ...asArray(returnTask?.source_ids),
      ...asArray(nextMainTask?.source_ids),
    ]),
  };
  const launcher = proofLauncherModel(summary);
  return {
    ...summary,
    launcher,
    launcherRouteId: launcher?.launcherRouteId || null,
    reviewCommand: launcher?.reviewCommand || "No local command available",
    demoCommand: launcher?.demoCommand || "No local command available",
    smokeCommand: launcher?.smokeCommand || "No local command available",
    launcherBoundary: launcher?.launcherBoundary || "Read-only launcher.",
    safeLaunchPath: launcher?.safeLaunchPath || "Review package first.",
  };
}

function projectRecordIdFromRegion(region = {}) {
  if (region?.sourceRef?.record_id) return region.sourceRef.record_id;
  if (region?.source_ref?.record_id) return region.source_ref.record_id;
  if (region?.graphNode?.source_ref?.record_id) return region.graphNode.source_ref.record_id;
  if (String(region?.id || "").startsWith("project:")) return String(region.id).replace(/^project:/, "");
  return region?.id || "";
}

function projectWorkspaceAction(project = {}, proofArtifact = null, candidate = null) {
  if (project.id === "PROJ-001") {
    const context = normalizeProjectContext(project);
    const operatingGuide = context.operatingGuide;
    return [
      operatingGuide.sourceId
        ? `Use imported user-guide context (${operatingGuide.sourceId}) to run the Flagship Project daily loop without browser writes.`
        : null,
      context.sourceId
        ? `Use source-backed README context (${context.sourceId}) to review Flagship Project as the first real project workspace.`
        : "Open Flagship Project as a read-only project workspace inside this app.",
      context.strategyPath ? `Confirm strategy path: ${context.strategyPath}` : "Review objective, linked proof, risks, and approval boundary before any action.",
      proofArtifact
        ? `Use ${proofArtifact.title} as the linked proof artifact for the next local career-system step.`
        : "Link a local proof artifact before implementation work moves deeper.",
    ].filter(Boolean);
  }

  const nextAction = normalizeAssistantText(candidate?.nextAction || project.next_action || "");
  return [
    nextAction || "Review this project workspace before choosing a next action.",
    "Keep this workspace read-only until the approval boundary is explicit.",
  ];
}

function projectWorkspaceRisks(project = {}, proofArtifact = null) {
  const risks = [];
  if (/TASK-045/i.test(project.next_action || "")) {
    risks.push("Project next_action still contains stale implementation notes; this workspace uses the current board gate instead.");
  }
  if (project.health && project.health !== "green") {
    risks.push(`Project health is ${project.health}; keep the next step narrow and reviewable.`);
  }
  if (proofArtifact?.limitations?.some((limitation) => /deterministic|synthetic/i.test(limitation))) {
    risks.push("Linked proof is deterministic and synthetic, not live LLM reasoning or real client data.");
  }
  risks.push("Flagship Project repo writes are not approved in this slice.");
  return sortedUnique(risks);
}

function projectWorkspaceApprovals(project = {}) {
  const projectTitle = project.title || "Project";
  if (project.id === "PROJ-001") {
    return [
      "No Flagship Project writes.",
      "No additional Flagship Project file reads or imports.",
      "No browser writes.",
      "No reviews/queue.json mutation.",
      "No source, wiki, memory, or raw-source mutation.",
      "No GitHub push, PR, Linear mutation, public export, finance, contacts, or external action.",
    ];
  }

  return [
    `No ${projectTitle} writes.`,
    "No browser writes.",
    "No reviews/queue.json mutation.",
    "No source, wiki, memory, or raw-source mutation.",
    "No GitHub push, PR, Linear mutation, public export, finance, contacts, or external action.",
  ];
}

function normalizeOperatingGuide(guide = {}) {
  return {
    sourceId: normalizeAssistantText(guide.source_id || guide.sourceId || ""),
    dailyLoop: asArray(guide.daily_loop || guide.dailyLoop).map(normalizeAssistantText).filter(Boolean),
    tabs: asArray(guide.tabs || guide.tab_meanings || guide.tabMeanings).map(normalizeAssistantText).filter(Boolean),
    proofRules: asArray(guide.proof_rules || guide.proofRules).map(normalizeAssistantText).filter(Boolean),
    operatorPrompts: asArray(guide.operator_prompts || guide.operatorPrompts).map(normalizeAssistantText).filter(Boolean),
    v2Limits: asArray(guide.v2_limits || guide.v2Limits).map(normalizeAssistantText).filter(Boolean),
    likelyNextUpgrade: normalizeAssistantText(guide.likely_next_upgrade || guide.likelyNextUpgrade || ""),
  };
}

function normalizeProjectContext(project = {}) {
  const context = project.project_context || {};
  return {
    sourceId: normalizeAssistantText(context.source_id || context.sourceId || ""),
    purpose: normalizeAssistantText(context.purpose || ""),
    strategyPath: normalizeAssistantText(context.strategy_path || context.strategyPath || ""),
    proofLoop: asArray(context.proof_loop || context.proofLoop).map(normalizeAssistantText).filter(Boolean),
    usagePaths: asArray(context.usage_paths || context.usagePaths).map(normalizeAssistantText).filter(Boolean),
    repoMap: asArray(context.repo_map || context.repoMap).map(normalizeAssistantText).filter(Boolean),
    privacyBoundary: normalizeAssistantText(context.privacy_boundary || context.privacyBoundary || ""),
    operatingGuide: normalizeOperatingGuide(context.operating_guide || context.operatingGuide || {}),
  };
}

function projectContextUsageLoop(project = {}) {
  if (project.id !== "PROJ-001") return null;

  const context = normalizeProjectContext(project);
  const guide = context.operatingGuide;
  const sourceIds = sortedUnique([context.sourceId, guide.sourceId, ...asArray(project.source_ids)]);

  return {
    id: "context-usage:PROJ-001",
    title: "Flagship Project context usage loop",
    browserWrites: false,
    sourceIds,
    dailyLoop: guide.dailyLoop.slice(0, 3),
    proofRules: guide.proofRules.slice(0, 3),
    projectReviewPrompts: [
      "Use the README strategy path to keep the next action tied to Applied AI Engineer proof.",
      "Use the user-guide Review tab rules to judge only repo-backed visible proof.",
      "Use the Skills tab rules to keep APIs, Docker, backend fundamentals, debugging, tests/evals, and reliability visible.",
    ],
    nextSafeAction:
      "Use the existing README and user-guide context inside this app: daily loop -> proof rules -> review prompts -> next safe action. No additional source reads.",
    approvalBoundary:
      "Read-only app context. No Flagship Project reads, No Flagship Project writes, No browser writes, No source/wiki/memory/raw-source mutation, No reviews queue mutation, No GitHub/Linear/external action.",
    limitations: guide.v2Limits.slice(0, 4),
  };
}

function projectCommandRoom(project = {}, proofArtifact = null, tasks = []) {
  if (project.id !== "PROJ-001") return null;

  const context = normalizeProjectContext(project);
  const operatingGuide = context.operatingGuide;
  const task068 = taskById(tasks, "TASK-068");
  const milestone = task068 ? `${task068.id} ${task068.title}` : "TASK-068 Flagship Project Context Usage Loop";
  const proofText = proofArtifact
    ? `${proofArtifact.title}: ${proofArtifact.verification}`
    : "No linked proof artifact yet.";

  return {
    id: "command-room:PROJ-001",
    browserWrites: false,
    currentMilestone: milestone,
    recommendedMove:
      operatingGuide.sourceId
        ? "Use the context usage loop from the existing README and user-guide sources before any more Flagship Project imports."
        : context.sourceId
          ? "Use the sourced README context to choose the next source gate with explicit approval, or pause real imports."
          : "Review the command room, confirm the next Flagship Project proof step, then use TASK-058 before any project write.",
    nextActions: [
      operatingGuide.dailyLoop.length ? `Review daily loop: ${operatingGuide.dailyLoop.join(" / ")}` : "",
      context.purpose ? `Review purpose: ${context.purpose}` : "Review the current objective, milestone, and proof status.",
      context.proofLoop.length ? `Review proof loop: ${context.proofLoop.join(" / ")}` : "Choose the smallest next Flagship Project proof step.",
      context.usagePaths.length ? `Review local app/CLI usage: ${context.usagePaths.join(" / ")}` : "Prepare a separate approval before any Flagship Project repo write.",
      operatingGuide.operatorPrompts.length ? `Review operator prompts: ${operatingGuide.operatorPrompts.join(" / ")}` : "",
      operatingGuide.proofRules.length ? `Use proof rules before review: ${operatingGuide.proofRules.join(" / ")}` : "",
    ].filter(Boolean),
    blockers: [
      "Flagship Project writes are not approved.",
      "Additional Flagship Project file reads or imports are not approved.",
      "The linked proof is deterministic and synthetic, not live LLM reasoning.",
      "Finance, contacts, source/wiki/memory, browser writes, and external actions remain gated.",
    ],
    proofStatus: proofText,
    approvalBoundary:
      "Read-only command room. No Flagship Project writes, browser writes, source/wiki/memory/raw-source mutation, reviews queue mutation, GitHub push, Linear mutation, finance, contacts, or external action.",
  };
}

function projectNextStepApproval(project = {}, proofArtifact = null, tasks = [], roadmapCandidates = []) {
  if (project.id !== "PROJ-001") return null;

  const task058 = taskById(tasks, "TASK-058");
  const candidate058 = asArray(roadmapCandidates).find((candidate) => candidate.id === "TASK-058") || null;
  const commandRoom = projectCommandRoom(project, proofArtifact, tasks);
  const sourceIds = sortedUnique([
    ...asArray(project.source_ids),
    ...asArray(proofArtifact?.sourceIds),
    ...asArray(task058?.source_ids),
    ...asArray(candidate058?.sourceIds),
  ]);

  return {
    id: "approval-preview:PROJ-001:TASK-058",
    title: "Flagship Project next-step approval",
    mode: "draft-for-approval",
    status: task058?.status || candidate058?.status || "needs-decision",
    browserWrites: false,
    target: "reviews/queue.json",
    risk: task058?.risk || candidate058?.risk || "medium",
    sourceIds,
    recommendedMove:
      candidate058?.nextAction ||
      task058?.next_action ||
      commandRoom?.recommendedMove ||
      "Review the next Flagship Project move before any project write.",
    packetPurpose:
      "Preview one explicit draft-for-approval packet for the next Flagship Project proof step before any private project files are touched.",
    approvalBoundary:
      "Preview only. No Flagship Project writes, No reviews/queue.json mutation, No browser writes, No source/wiki/memory/raw-source mutation, No GitHub push, No Linear mutation, No finance, No contacts, and No external action.",
    undoPath:
      "Remove the preview or revert the TASK-058 app slice before any later promotion; if a future review item is appended, remove that generated item before promotion.",
    notApproved: [
      "No Flagship Project repo writes.",
      "No reviews/queue.json mutation.",
      "No source, wiki, memory, or raw-source mutation.",
      "No browser writes.",
      "No GitHub push, PR, Linear mutation, public export, license change, finance, contacts, or external action.",
    ],
  };
}

function buildProjectWorkspaces(state = {}, proofArtifacts = [], relationships = []) {
  const candidates = buildRoadmapCandidates(state?.board || {});
  const task054 = candidates.find((candidate) => candidate.id === "TASK-054") || null;
  const tasks = asArray(state?.tasks?.tasks);
  const proofByProjectId = new Map(asArray(proofArtifacts).filter((artifact) => artifact.projectId).map((artifact) => [artifact.projectId, artifact]));

  return asArray(state?.projects?.projects)
    .filter((project) => project?.id === "PROJ-001" || proofByProjectId.has(project?.id))
    .map((project) => {
      const graphId = `project:${project.id}`;
      const proofArtifact = proofByProjectId.get(project.id) || null;
      const projectContext = normalizeProjectContext(project);
      const relationshipCount = relationships.filter((relationship) => relationshipTouches(relationship, graphId)).length;
      const sourceIds = sortedUnique([
        ...asArray(project.source_ids),
        ...asArray(proofArtifact?.sourceIds),
        ...asArray(task054?.sourceIds),
      ]);

      return {
        id: project.id === "PROJ-001" ? FIRST_PROJECT_WORKSPACE_ID : `workspace:${project.id}`,
        projectId: project.id,
        graphId,
        title: project.title || project.id,
        domain: project.domain || "project",
        status: project.status || "unknown",
        health: project.health || "unknown",
        owner: project.owner || "unknown",
        objective: normalizeAssistantText(project.outcome || "No objective recorded."),
        browserWrites: false,
        approvalMode: project.approval_mode || "draft-for-approval",
        projectContext,
        sourceIds,
        nextActions: projectWorkspaceAction(project, proofArtifact, task054),
        risks: projectWorkspaceRisks(project, proofArtifact),
        approvals: projectWorkspaceApprovals(project),
        relatedContext: [
          projectContext.sourceId ? `README source: ${projectContext.sourceId}` : `${sourceIds.length} sources attached`,
          projectContext.operatingGuide.sourceId ? `User guide source: ${projectContext.operatingGuide.sourceId}` : "",
          projectContext.strategyPath ? `Strategy path: ${projectContext.strategyPath}` : "",
          projectContext.usagePaths[0] ? `Usage: ${projectContext.usagePaths[0]}` : "",
          projectContext.operatingGuide.likelyNextUpgrade
            ? `Likely next upgrade: ${projectContext.operatingGuide.likelyNextUpgrade}`
            : "",
          `${relationshipCount} visible connections`,
          proofArtifact ? `${proofArtifact.title} proof is ${proofArtifact.status}` : "No linked proof artifact yet",
          `Approval mode: ${project.approval_mode || "draft-for-approval"}`,
        ].filter(Boolean),
        linkedProofArtifact: proofArtifact,
        commandRoom: projectCommandRoom(project, proofArtifact, tasks),
        contextUsageLoop: projectContextUsageLoop(project),
        nextStepApproval: projectNextStepApproval(project, proofArtifact, tasks, candidates),
      };
    });
}

function attachProjectWorkspace(region, workspaceByProjectId) {
  const projectId = projectRecordIdFromRegion(region);
  const projectWorkspace = workspaceByProjectId.get(projectId);
  if (!projectWorkspace) return region;

  return {
    ...region,
    projectWorkspace,
    nextAction: projectWorkspace.nextActions[0] || region.nextAction,
    sourceIds: sortedUnique([...asArray(region.sourceIds), ...asArray(projectWorkspace.sourceIds)]),
  };
}

function normalizeAssistantText(value = "") {
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

function buildRoadmapCandidates(board = {}) {
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

function buildAssistantBrief({ board = {}, pendingReviews = [], graphWarnings = [], currentFocus = null } = {}) {
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

function buildSystemHomeCockpit({
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
        title: "Brain",
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
      "Use Home to review Today, Projects, Approvals, Brain, Routines, and Assistant, then choose the next local slice from Next steps.",
    approvalBoundary:
      "Read-only Home cockpit. No browser writes, No reviews mutation, No source/wiki/memory/raw-source mutation, No GitHub, No Linear, No external action, No finance, No contacts, and No Flagship Project reads or writes without separate approval.",
  };
}

function buildTodayCommandSurface({
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

function buildBrainAssistantBehavior({
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
    title: "Brain / Assistant Behavior",
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

function buildSpatialCommandOverlay({ assistantBrief = null, projects = [], routines = [] } = {}) {
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

function buildProofArtifacts(state, tasks) {
  return asArray(state?.proofArtifacts?.proof_artifacts).map((artifact) => proofArtifactSummary(artifact, tasks));
}

function graphNodes(state) {
  return asArray(state?.relationshipGraph?.nodes);
}

function graphEdges(state) {
  return asArray(state?.relationshipGraph?.edges);
}

function sourceIdsFromGraphSubject(subject = {}) {
  return sortedUnique([
    ...asArray(subject.sourceIds),
    ...asArray(subject.source_ids),
    ...asArray(subject.source_ref?.source_ids),
    ...asArray(subject.source_ref?.sourceIds),
    ...asArray(subject.sourceRef?.sourceIds),
    ...asArray(subject.sourceRef?.source_ids),
  ]);
}

function graphRegion(node, index, state = {}) {
  const palette = REGION_PALETTE[index % REGION_PALETTE.length];
  const visual = node.visual || {};
  const weights = node.weights || {};
  return {
    id: node.id,
    type: node.type,
    title: node.title,
    subtitle: node.domain || node.type,
    status: node.status,
    health: node.weights?.friction > 0.6 ? "yellow" : "green",
    weight: Math.max(0.25, Math.min(1, weights.importance || 0.48)),
    color: visual.color || palette.color,
    orbit: palette.orbit,
    nextAction: node.summary,
    sourceRef: node.source_ref || {},
    sourceIds: sourceIdsFromGraphSubject(node),
    approvalStatus: node.approval_status || (node.inferred ? "needs-review" : "approved"),
    permissionMode: node.permission_mode,
    graphNode: node,
    ...attachEvidence(node, state),
  };
}

function endpointTitle(nodeTitles, id) {
  return nodeTitles.get(id) || id || "unknown";
}

function graphRelationships(edges, selectedId = null, nodeTitles = new Map(), state = {}) {
  return edges
    .filter((edge) => selectedId === null || edge.from === selectedId || edge.to === selectedId)
    .map((edge) => {
      const relationshipType = String(edge.type || "relationship").replaceAll("_", " ");
      const fromTitle = endpointTitle(nodeTitles, edge.from);
      const toTitle = endpointTitle(nodeTitles, edge.to);

      return {
        id: edge.id,
        type: edge.type,
        from: edge.from,
        to: edge.to,
        fromTitle,
        toTitle,
        title: `${relationshipType}: ${fromTitle} -> ${toTitle}`,
        evidence: edge.evidence,
        sourceIds: asArray(edge.source_ids),
        approvalStatus: edge.approval_status || (edge.inferred ? "needs-review" : "approved"),
        sourceRef: edge.source_ref || {},
        permissionMode: edge.permission_mode,
        inferred: edge.inferred,
        strength: edge.strength,
        ...attachEvidence(edge, state),
      };
    });
}

function slug(value, fallback = "general") {
  const normalized = String(value || "")
    .toLowerCase()
    .replace(/^[a-z]+:/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function namespacedSlug(value, fallback = "general") {
  const normalized = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function districtIdFromCluster(clusterId, fallback = "general", preserveNamespace = false) {
  return `district:${preserveNamespace ? namespacedSlug(clusterId, fallback) : slug(clusterId, fallback)}`;
}

function clusterNodeIds(cluster) {
  return asArray(cluster?.node_ids || cluster?.nodeIds)
    .filter(Boolean)
    .sort((first, second) => first.localeCompare(second));
}

function clusterTitle(cluster, fallback) {
  return cluster?.title || cluster?.label || cluster?.name || fallback;
}

function nodeClusterId(node) {
  return node?.visual?.cluster_id || node?.visual?.clusterId || null;
}

function permissionModeRank(mode) {
  return PERMISSION_RANK.has(mode) ? PERMISSION_RANK.get(mode) : PERMISSION_PRECEDENCE.length;
}

function permissionModes(values) {
  return Array.from(new Set(values.filter(Boolean))).sort(
    (first, second) => permissionModeRank(first) - permissionModeRank(second) || first.localeCompare(second),
  );
}

function mostRestrictivePermissionMode(values, fallback = "suggest-only") {
  return permissionModes(values)[0] || fallback;
}

function approvalStatusRank(status) {
  return APPROVAL_RANK.has(status) ? APPROVAL_RANK.get(status) : APPROVAL_PRECEDENCE.length;
}

function approvalStatuses(values) {
  return Array.from(new Set(values.filter(Boolean))).sort(
    (first, second) => approvalStatusRank(first) - approvalStatusRank(second) || first.localeCompare(second),
  );
}

function approvalStatusForRelationship(relationship) {
  return relationship?.approval_status || relationship?.approvalStatus || (relationship?.inferred ? "needs-review" : "approved");
}

function mostRestrictiveApprovalStatus(values, fallback = "approved") {
  return approvalStatuses(values)[0] || fallback;
}

function averageWeight(nodes, key, fallback = 0.4) {
  const values = nodes.map((node) => node?.weights?.[key]).filter((value) => Number.isFinite(value));
  if (values.length === 0) return fallback;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}

function dominantTypes(nodes) {
  const counts = new Map();
  nodes.forEach((node) => {
    const type = node.type || "unknown";
    counts.set(type, (counts.get(type) || 0) + 1);
  });
  return Array.from(counts.entries())
    .sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))
    .map(([type]) => type);
}

function districtSummary(title, nodes, localEdges) {
  const activeProject = nodes.find((node) => node.type === "project" && node.status === "active");
  const activeTask = nodes.find((node) => node.type === "task" && node.status === "active");
  const activeNode = nodes.find((node) => node.status === "active");
  const anchor = activeProject || activeTask || activeNode || nodes[0];
  const relationshipCount = localEdges.length;
  const anchorTitle = anchor?.title || "the first item";

  if (relationshipCount === 0 && nodes.length > 1) {
    return `${title} has ${nodes.length} items. No sourced connections yet. ${anchorTitle} is the main item.`;
  }

  return `${title} has ${nodes.length} item${nodes.length === 1 ? "" : "s"} and ${relationshipCount} local connection${relationshipCount === 1 ? "" : "s"}. ${anchorTitle} is the main item.`;
}

function districtAnchorRegion(localRegions) {
  return (
    localRegions.find((region) => region.type === "project" && region.status === "active") ||
    localRegions.find((region) => region.type === "task" && region.status === "active") ||
    localRegions.find((region) => region.status === "active") ||
    localRegions[0] ||
    null
  );
}

function districtShellSummary(district, localRegions, relationships) {
  const anchor = districtAnchorRegion(localRegions);
  const visualRelationships = relationships.filter((relationship) => relationship?.visualOnly === true);
  const sourceBackedRelationships = relationships.filter((relationship) => relationship?.visualOnly !== true);
  const relationshipPermissionModes = relationships.map(
    (relationship) => relationship?.permissionMode || relationship?.permission_mode,
  );
  const relationshipApprovalStatuses = relationships.map(approvalStatusForRelationship);

  return {
    scope: "district",
    id: district.id,
    title: district.title,
    summary: district.summary,
    nodeCount: localRegions.length,
    relationshipCount: relationships.length,
    sourceBackedRelationshipCount: sourceBackedRelationships.length,
    visualRelationshipCount: visualRelationships.length,
    permissionMode: mostRestrictivePermissionMode([...asArray(district.permissionModes), ...relationshipPermissionModes]),
    approvalStatus: mostRestrictiveApprovalStatus([district.approvalStatus, ...relationshipApprovalStatuses]),
    anchorId: anchor?.id || null,
    anchorTitle: anchor?.title || anchor?.id || "No active anchor",
    anchorType: anchor?.type || "region",
    dominantTypes: asArray(district.dominantTypes).length > 0 ? district.dominantTypes : dominantTypes(localRegions),
    health: district.weights?.friction >= 0.55 ? "yellow" : "green",
  };
}

function relationshipConnects(relationship, firstId, secondId) {
  return (
    (relationship?.from === firstId && relationship?.to === secondId) ||
    (relationship?.from === secondId && relationship?.to === firstId)
  );
}

function districtGravityRelationships(district, localRegions, localRelationships, state = {}) {
  if (!district || localRegions.length < 2) return [];

  const anchor = districtAnchorRegion(localRegions);
  if (!anchor) return [];

  return localRegions
    .filter((region) => region.id !== anchor.id)
    .filter((region) => !localRelationships.some((relationship) => relationshipConnects(relationship, anchor.id, region.id)))
    .map((region, index) => {
      const relationship = {
        id: `district-gravity:${district.id}:${anchor.id}:${region.id}`,
        type: "district_gravity",
        from: anchor.id,
        to: region.id,
        fromTitle: anchor.title || anchor.id,
        toTitle: region.title || region.id,
        title: `district gravity: ${anchor.title || anchor.id} -> ${region.title || region.id}`,
        evidence: `Shared ${district.title || district.id} area context. Map-only connection; not a sourced claim.`,
        permissionMode: mostRestrictivePermissionMode(district.permissionModes, "suggest-only"),
        inferred: true,
        visualOnly: true,
        strength: Math.max(0.28, Math.min(0.56, 0.32 + (district.weights?.activity || 0.4) * 0.18 - index * 0.02)),
      };
      return {
        ...relationship,
        ...attachEvidence(relationship, state),
      };
    });
}

function districtColor(nodes, index) {
  return nodes.find((node) => node?.visual?.color)?.visual.color || DISTRICT_PALETTE[index % DISTRICT_PALETTE.length];
}

function districtRegion(district, index, state = {}) {
  const sourceIds = asArray(district.sourceIds);
  const permissionMode = mostRestrictivePermissionMode(district.permissionModes);
  const approvalStatus = district.approvalStatus || (district.inferred ? "needs-review" : "approved");
  const evidenceSubject = {
    id: district.id,
    type: "district",
    title: district.title,
    summary: district.summary,
    evidence: district.summary,
    permissionMode,
    approvalStatus,
    inferred: Boolean(district.inferred),
    visualOnly: sourceIds.length === 0,
    sourceIds,
    sourceRef: {
      file: "indexes/relationship-graph.json",
      recordId: district.id,
      sourceIds,
    },
  };

  return {
    id: district.id,
    type: "district",
    title: district.title,
    subtitle: `${district.nodeIds.length} ${district.nodeIds.length === 1 ? "item" : "items"}`,
    status: district.weights.activity >= 0.65 ? "active" : "planned",
    health: district.weights.friction >= 0.55 ? "yellow" : "green",
    weight: Math.max(0.32, Math.min(1, district.weights.importance || 0.45)),
    color: district.visual.color,
    orbit: REGION_PALETTE[index % REGION_PALETTE.length].orbit,
    nextAction: district.summary,
    permissionMode,
    approvalStatus,
    sourceIds,
    sourceRef: evidenceSubject.sourceRef,
    district,
    ...attachEvidence(evidenceSubject, state),
  };
}

function instrumentSignal(region, fallback = "No current block available") {
  if (!region) return fallback;

  if (region.type === "district") {
    return `${region.title || "Atlas"} / ${region.subtitle || "district"}`;
  }

  return region.nextAction || region.subtitle || region.title || fallback;
}

function deriveDistricts(nodes, edges, clusters) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const clusterById = new Map(asArray(clusters).map((cluster) => [cluster.id, cluster]));
  const grouped = new Map();
  const groupFor = (clusterId) => {
    if (!grouped.has(clusterId)) grouped.set(clusterId, new Set());
    return grouped.get(clusterId);
  };

  nodes.forEach((node) => {
    const clusterId = nodeClusterId(node);
    if (!clusterId) return;
    groupFor(clusterId).add(node.id);
  });

  asArray(clusters).forEach((cluster) => {
    const ids = clusterNodeIds(cluster);
    if (ids.length === 0) return;
    const group = groupFor(cluster.id);
    ids.forEach((id) => {
      if (nodeById.has(id)) group.add(id);
    });
  });

  const entries = Array.from(grouped.entries())
    .map(([clusterId, nodeIds]) => [
      clusterId,
      Array.from(nodeIds)
        .map((id) => nodeById.get(id))
        .filter(Boolean),
    ])
    .filter(([, districtNodes]) => districtNodes.length > 0)
    .sort(([firstId], [secondId]) => firstId.localeCompare(secondId));
  const baseIdCounts = new Map();
  entries.forEach(([clusterId]) => {
    const baseId = districtIdFromCluster(clusterId);
    baseIdCounts.set(baseId, (baseIdCounts.get(baseId) || 0) + 1);
  });
  const usedDistrictIds = new Set();

  return entries
    .map(([clusterId, districtNodes], index) => {
      const sortedNodes = [...districtNodes].sort((first, second) => first.id.localeCompare(second.id));
      const nodeIds = sortedNodes.map((node) => node.id);
      const nodeIdSet = new Set(nodeIds);
      const localEdges = edges
        .filter((edge) => nodeIdSet.has(edge.from) && nodeIdSet.has(edge.to))
        .sort((first, second) => first.id.localeCompare(second.id));
      const sourceIds = sortedUnique(sortedNodes.flatMap(sourceIdsFromGraphSubject));
      const approvalStatus = mostRestrictiveApprovalStatus(sortedNodes.map(approvalStatusForRelationship));
      const cluster = clusterById.get(clusterId);
      const title = clusterTitle(cluster, sortedNodes[0]?.domain || sortedNodes[0]?.type || "General");
      const baseId = districtIdFromCluster(clusterId, title);
      const hasBaseIdCollision = (baseIdCounts.get(baseId) || 0) > 1;
      const uniqueIdBase = districtIdFromCluster(clusterId, title, hasBaseIdCollision);
      let id = uniqueIdBase;
      let suffix = 2;
      while (usedDistrictIds.has(id)) {
        id = `${uniqueIdBase}-${suffix}`;
        suffix += 1;
      }
      usedDistrictIds.add(id);

      return {
        id,
        title,
        sourceClusterIds: [clusterId],
        nodeIds,
        edgeIds: localEdges.map((edge) => edge.id),
        summary: districtSummary(title, sortedNodes, localEdges),
        dominantTypes: dominantTypes(sortedNodes),
        permissionModes: permissionModes(sortedNodes.map((node) => node.permission_mode || node.permissionMode)),
        approvalStatus,
        sourceIds,
        inferred: sortedNodes.some((node) => node.inferred) || approvalStatus !== "approved",
        weights: {
          importance: averageWeight(sortedNodes, "importance"),
          recency: averageWeight(sortedNodes, "recency"),
          activity: averageWeight(sortedNodes, "activity"),
          friction: averageWeight(sortedNodes, "friction", 0.1),
          confidence: averageWeight(sortedNodes, "confidence"),
          sensitivity: averageWeight(sortedNodes, "sensitivity", 0.2),
        },
        visual: {
          color: districtColor(sortedNodes, index),
          radius: 1.4 + Math.min(1.4, Math.max(0, sortedNodes.length - 1) * 0.22),
          labelPriority: 0.55 + Math.min(0.4, averageWeight(sortedNodes, "importance") * 0.4),
          position: null,
        },
      };
    });
}

function districtRelationships(districts, edges, state = {}) {
  const districtByNodeId = new Map();
  const districtById = new Map();
  districts.forEach((district) => {
    districtById.set(district.id, district);
    district.nodeIds.forEach((nodeId) => districtByNodeId.set(nodeId, district));
  });

  const grouped = new Map();
  edges.forEach((edge) => {
    const fromDistrict = districtByNodeId.get(edge.from);
    const toDistrict = districtByNodeId.get(edge.to);
    if (!fromDistrict || !toDistrict || fromDistrict.id === toDistrict.id) return;
    const ordered = [fromDistrict.id, toDistrict.id].sort();
    const key = `${ordered[0]}:${ordered[1]}`;
    const existing = grouped.get(key) || {
      id: `district-edge:${ordered[0]}:${ordered[1]}`,
      type: "relates_to",
      from: ordered[0],
      to: ordered[1],
      fromTitle: districtById.get(ordered[0])?.title || ordered[0],
      toTitle: districtById.get(ordered[1])?.title || ordered[1],
      title: `relates to: ${districtById.get(ordered[0])?.title || ordered[0]} -> ${districtById.get(ordered[1])?.title || ordered[1]}`,
      evidence: "Cross-district relationship derived from local graph edges.",
      permissionMode: "suggest-only",
      permissionModes: [],
      approvalStatuses: [],
      inferred: false,
      strength: 0,
      edgeIds: [],
      sourceIds: [],
    };
    existing.edgeIds.push(edge.id);
    existing.sourceIds = sortedUnique([
      ...existing.sourceIds,
      ...asArray(edge.source_ids),
      ...asArray(edge.sourceIds),
    ]);
    existing.permissionModes = permissionModes([
      ...existing.permissionModes,
      edge.permission_mode || edge.permissionMode || "suggest-only",
    ]);
    existing.approvalStatuses = approvalStatuses([
      ...existing.approvalStatuses,
      approvalStatusForRelationship(edge),
    ]);
    existing.permissionMode = mostRestrictivePermissionMode(existing.permissionModes);
    existing.strength = Math.max(existing.strength, Number.isFinite(edge.strength) ? edge.strength : 0.42);
    existing.inferred = existing.inferred || Boolean(edge.inferred);
    existing.approvalStatus = mostRestrictiveApprovalStatus(existing.approvalStatuses);
    existing.sourceRef = {
      file: "indexes/relationship-graph.json",
      recordId: existing.id,
      sourceIds: existing.sourceIds,
    };
    grouped.set(key, existing);
  });

  return Array.from(grouped.values())
    .map((relationship) => ({
      ...relationship,
      ...attachEvidence(relationship, state),
    }))
    .sort((first, second) => first.id.localeCompare(second.id));
}

function regionIds(model) {
  return new Set(asArray(model?.regions).map((region) => region.id).filter(Boolean));
}

function resolveRegionId(model, requestedId) {
  const ids = regionIds(model);
  if (requestedId && ids.has(requestedId)) return requestedId;
  if (model?.currentFocus?.id && ids.has(model.currentFocus.id)) return model.currentFocus.id;
  return asArray(model?.regions)[0]?.id || null;
}

function relationshipTouches(relationship, id) {
  return Boolean(id && (relationship?.from === id || relationship?.to === id));
}

function otherEndpoint(relationship, id) {
  if (relationship?.from === id) return relationship.to;
  if (relationship?.to === id) return relationship.from;
  return null;
}

function sortedUnique(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((first, second) => first.localeCompare(second));
}

function relationshipIdsFor(relationships, id) {
  return relationships.filter((relationship) => relationshipTouches(relationship, id)).map((relationship) => relationship.id);
}

function relatedIdsFor(relationships, id) {
  return relationships.map((relationship) => otherEndpoint(relationship, id)).filter(Boolean);
}

function relationshipById(relationships, relationshipId) {
  return asArray(relationships).find((relationship) => relationship?.id === relationshipId) || null;
}

function relationshipEndpointIds(relationship) {
  return sortedUnique([relationship?.from, relationship?.to]);
}

function districtHasRenderableNode(district, renderableNodeIds) {
  return asArray(district?.nodeIds).some((nodeId) => renderableNodeIds.has(nodeId));
}

function baseLabelPriority(region) {
  const statusBoost = region?.status === "active" ? 40 : region?.status === "planned" ? 28 : 12;
  const healthBoost = region?.health === "yellow" ? 8 : 0;
  const weightBoost = Math.round((Number.isFinite(region?.weight) ? region.weight : 0.35) * 30);
  return statusBoost + healthBoost + weightBoost;
}

export function buildFocusContext(model, selectedId = null, hoveredId = null, selectedRelationshipId = null) {
  const relationships = asArray(model?.relationships);
  const ids = regionIds(model);
  const selectedRelationship =
    relationshipById(relationships, selectedRelationshipId) || relationshipById(relationships, selectedId);
  const selectedEndpointId =
    selectedRelationship && ids.has(selectedRelationship.from)
      ? selectedRelationship.from
      : selectedRelationship && ids.has(selectedRelationship.to)
        ? selectedRelationship.to
        : selectedId;
  const selected = resolveRegionId(model, selectedEndpointId);
  const hovered = hoveredId && ids.has(hoveredId) ? hoveredId : null;
  const active = hovered || selected;
  const selectedRelationshipEndpointIds = relationshipEndpointIds(selectedRelationship);
  const selectedRelationshipIds = selectedRelationship
    ? [selectedRelationship.id]
    : relationshipIdsFor(relationships, selected);
  const hoverRelationshipIds = hovered ? relationshipIdsFor(relationships, hovered) : [];
  const keepSelectedEndpointVisible = Boolean(selectedRelationship);
  const selectedRelatedNodeIds = selectedRelationship
    ? selectedRelationshipEndpointIds
    : relatedIdsFor(relationships, selected);
  const relatedNodeIds = sortedUnique([
    ...selectedRelatedNodeIds,
    ...relatedIdsFor(relationships, hovered),
    ...selectedRelationshipEndpointIds,
    selected,
    hovered,
  ].filter((id) => id && (keepSelectedEndpointVisible || hovered || id !== active)));
  const relationshipIds = sortedUnique([...selectedRelationshipIds, ...hoverRelationshipIds, selectedRelationship?.id]);
  const labelPriorityById = Object.fromEntries(
    asArray(model?.regions).map((region) => {
      let priority = baseLabelPriority(region);
      if (region.id === selected) priority += 1000;
      if (region.id === hovered) priority += 850;
      if (relatedNodeIds.includes(region.id)) priority += 420;
      return [region.id, priority];
    }),
  );

  return {
    selectedId: selected,
    hoveredId: hovered,
    activeId: active,
    selectedRelationshipId: selectedRelationship?.id || null,
    selectedRelationshipIds: sortedUnique(selectedRelationshipIds),
    hoverRelationshipIds: sortedUnique(hoverRelationshipIds),
    relationshipIds,
    relatedNodeIds,
    labelPriorityById,
  };
}

export function buildDistrictWorldModel(model, activeDistrictId = null) {
  const districts = asArray(model?.districts);
  const requestedDistrict = districts.find((district) => district.id === activeDistrictId) || null;
  const evidenceState = model?.evidenceContext || {};

  if (!requestedDistrict) {
    return {
      ...model,
      activeDistrictId: null,
      activeDistrict: null,
      activeDistrictSummary: null,
      regions:
        districts.length > 0
          ? districts.map((district, index) => districtRegion(district, index, evidenceState))
          : asArray(model?.allRegions || model?.regions),
      relationships: districts.length > 0 ? asArray(model?.districtRelationships) : asArray(model?.allRelationships || model?.relationships),
      commands: asArray(model?.commands),
    };
  }

  const nodeIdSet = new Set(requestedDistrict.nodeIds);
  const edgeIdSet = new Set(requestedDistrict.edgeIds);
  const localRegions = asArray(model?.allRegions).filter((region) => nodeIdSet.has(region.id));
  const localRelationships = asArray(model?.allRelationships).filter((relationship) => edgeIdSet.has(relationship.id));
  const gravityRelationships = districtGravityRelationships(requestedDistrict, localRegions, localRelationships, evidenceState);
  const relationships = [...localRelationships, ...gravityRelationships];
  const localFocus = districtAnchorRegion(localRegions) || model?.currentFocus || null;
  const activeDistrictSummary = districtShellSummary(requestedDistrict, localRegions, relationships);

  return {
    ...model,
    activeDistrictId: requestedDistrict.id,
    activeDistrict: requestedDistrict,
    activeDistrictSummary,
    regions: localRegions,
    relationships,
    currentFocus: localFocus,
    inspector: {
      ...(model?.inspector || {}),
      title: requestedDistrict.title,
      subtitle: "District drilldown",
      status: localFocus?.status || "active",
      health: requestedDistrict.weights?.friction >= 0.55 ? "yellow" : "green",
      nextAction: requestedDistrict.summary,
      related: relationships.slice(0, 8),
    },
    commands: [
      { id: "district:exit", label: "Atlas", kind: "atlas", detail: "Return to the global atlas" },
      ...localRegions.map((region) => command(region.id, region.title, "graph-node", region.nextAction)),
      ...asArray(model?.commands).filter((item) => item.kind !== "graph-node" && item.kind !== "district"),
    ],
  };
}

export function buildSurfaceModel(state) {
  const boardProject = state?.board?.project || {};
  const projects = asArray(state?.projects?.projects).map(projectRegion);
  const routines = asArray(state?.routines?.routines).map(routineRegion);
  const taskRecords = asArray(state?.tasks?.tasks);
  const proofArtifacts = buildProofArtifacts(state, taskRecords);
  const proofPackage = proofArtifacts[0] || null;
  const proofLauncher = proofPackage?.launcher || null;
  const nodes = graphNodes(state);
  const edges = graphEdges(state);
  const clusters = asArray(state?.relationshipGraph?.clusters);
  const nodeTitles = new Map(nodes.map((node) => [node.id, node.title || node.id]));
  const rawGraphRegions = nodes
    .filter((node) =>
      ["project", "routine", "task", "decision", "memory_claim", "review", "proof_artifact"].includes(node.type),
    )
    .map((node, index) => graphRegion(node, index, state));
  const graphRelationshipList = graphRelationships(edges, null, nodeTitles, state);
  const projectWorkspaces = buildProjectWorkspaces(state, proofArtifacts, graphRelationshipList);
  const projectWorkspaceByProjectId = new Map(projectWorkspaces.map((workspace) => [workspace.projectId, workspace]));
  const graphRegions = rawGraphRegions.map((region) => attachProjectWorkspace(region, projectWorkspaceByProjectId));
  const renderableNodeIds = new Set(graphRegions.map((region) => region.id));
  const districts = deriveDistricts(nodes, edges, clusters).filter((district) =>
    districtHasRenderableNode(district, renderableNodeIds),
  );
  const modelEvidenceContext = evidenceContext(state);
  const districtRegionList = districts.map((district, index) => districtRegion(district, index, modelEvidenceContext));
  const districtRelationshipList = districtRelationships(districts, edges, modelEvidenceContext);
  const fallbackRegions = [...projects.map((region) => attachProjectWorkspace(region, projectWorkspaceByProjectId)), ...routines];
  const allRegions = graphRegions.length > 0 ? graphRegions : fallbackRegions;
  const regions = districtRegionList.length > 0 ? districtRegionList : allRegions;
  const relationships = districts.length > 0 ? districtRelationshipList : graphRelationshipList;
  const activeProject =
    regions.find((region) => region.type === "project" && region.status === "active") ||
    regions.find((region) => region.type === "project") ||
    regions[0];
  const activeTasks = taskRecords.filter((task) => task.status === "active");
  const reviews = asArray(state?.reviews?.reviews);
  const pendingReviews = reviews.filter((review) => review.status === "pending");
  const resolvedReviews = reviews.filter(
    (review) =>
      review.status !== "pending" &&
      (review.resolution_status || review.resolution_decision || review.resolved_at),
  );
  const lockedDecisions = asArray(state?.decisions?.decisions).filter((decision) => decision.status === "locked");

  // User-owned layout overlay (state/layout.json): pinned node positions.
  const layoutPins =
    state?.layout && typeof state.layout === "object" && !Array.isArray(state.layout) && state.layout.pins
      ? { ...state.layout.pins }
      : {};

  // Nodes touched by pending review packets: the review node itself, every
  // node it shares an edge with, and any district containing one of those.
  const pendingReviewNodeIds = (() => {
    const affected = new Set();
    pendingReviews.forEach((review) => {
      const reviewNodeId = `review:${review.id}`;
      affected.add(reviewNodeId);
      graphRelationshipList.forEach((relationship) => {
        if (relationshipTouches(relationship, reviewNodeId)) {
          if (relationship.from) affected.add(relationship.from);
          if (relationship.to) affected.add(relationship.to);
        }
      });
    });
    districts.forEach((district) => {
      if (asArray(district.nodeIds).some((nodeId) => affected.has(nodeId))) {
        affected.add(district.id);
      }
    });
    return [...affected].sort();
  })();

  const currentFocus = activeProject || regions[0] || {
    id: "empty",
    title: "No active region",
    subtitle: "State is empty",
    nextAction: "Add project or routine state",
  };
  const hasGraphData = nodes.length > 0 || edges.length > 0;
  const graphWarnings = asArray(state?.relationshipGraph?.warnings);
  const assistantBrief = buildAssistantBrief({
    board: state?.board || {},
    pendingReviews,
    graphWarnings,
    currentFocus,
  });
  const systemHomeCockpit = buildSystemHomeCockpit({
    board: state?.board || {},
    projects,
    routines,
    taskRecords,
    pendingReviews,
    resolvedReviews,
    districts,
    relationships,
    assistantBrief,
    graphWarnings,
  });
  const todayCommandSurface = buildTodayCommandSurface({
    board: state?.board || {},
    projects,
    routines,
    taskRecords,
    assistantBrief,
    systemHomeCockpit,
  });
  const brainAssistantBehavior = buildBrainAssistantBehavior({
    board: state?.board || {},
    projects,
    routines,
    taskRecords,
    districts,
    relationships,
    assistantBrief,
    graphWarnings,
  });
  const spatialCommandOverlay = buildSpatialCommandOverlay({
    assistantBrief,
    projects,
    routines,
  });
  const relatedRelationships = relationships
    .filter((relationship) => relationshipTouches(relationship, currentFocus.id))
    .slice(0, 8)
    .map((relationship) => ({
      id: relationship.id,
      title: relationship.title,
      evidence: relationship.evidence,
      permissionMode: relationship.permissionMode,
    }));

  const surfaceModel = {
    appName: boardProject.name || "Groundplane",
    phase: boardProject.current_phase || "unknown",
    northStar: boardProject.north_star || "",
    updatedAt: boardProject.updated_at || null,
    regions,
    allRegions,
    allRelationships: graphRelationshipList,
    districts,
    districtRelationships: districtRelationshipList,
    activeDistrictId: null,
    activeDistrict: null,
    evidenceContext: modelEvidenceContext,
    currentFocus,
    graph: {
      nodes,
      edges,
      clusters,
      warnings: graphWarnings,
    },
    relationships,
    activeTasks,
    proofArtifacts,
    proofPackage,
    proofLauncher,
    projectWorkspaces,
    pendingReviews,
    layoutPins,
    pendingReviewNodeIds,
    assistantBrief,
    systemHomeCockpit,
    todayCommandSurface,
    brainAssistantBehavior,
    spatialCommandOverlay,
    resolvedReviews,
    reviewQueue: {
      pending: pendingReviews,
      resolved: resolvedReviews,
    },
    lockedDecisions,
    inspector: {
      title: currentFocus.title,
      subtitle: currentFocus.subtitle,
      status: currentFocus.status || "unknown",
      health: currentFocus.health || "unknown",
      nextAction: currentFocus.nextAction || "No next action available",
      related:
        hasGraphData
          ? relatedRelationships
          : lockedDecisions.slice(0, 4).map((decision) => ({
              id: decision.id,
              title: decision.recommendation || decision.decision,
            })),
    },
    commands: [
      ...projects.map((region) => command(region.id, region.title, "project", region.nextAction)),
      ...routines.map((region) => command(region.id, region.title, "routine", region.nextAction)),
      ...districtRegionList.map((region) => command(region.id, region.title, "district", region.nextAction)),
      ...graphRegions.map((region) => command(region.id, region.title, "graph-node", region.nextAction)),
      ...proofArtifacts.map((artifact) => command(artifact.id, artifact.title, "proof-artifact", artifact.nextAction)),
      ...proofArtifacts.map((artifact) =>
        command(artifact.launcherRouteId, `Open ${artifact.title}`, "proof-launcher", artifact.safeLaunchPath),
      ),
      ...projectWorkspaces.map((workspace) =>
        command(workspace.id, `${workspace.title} Workspace`, "project-workspace", workspace.nextActions[0]),
      ),
      command(assistantBrief.id, assistantBrief.title, "assistant", assistantBrief.recommendation),
      command(systemHomeCockpit.id, systemHomeCockpit.title, "system-home", systemHomeCockpit.nextSafeAction),
      command(todayCommandSurface.id, todayCommandSurface.title, "today-command", todayCommandSurface.safeNextMove),
      command(
        brainAssistantBehavior.id,
        brainAssistantBehavior.title,
        "assistant-behavior",
        brainAssistantBehavior.recommendedMove,
      ),
      command(spatialCommandOverlay.id, spatialCommandOverlay.title, "spatial-command", spatialCommandOverlay.route),
      ...asArray(assistantBrief.roadmapCandidates).map((candidate) =>
        command(`roadmap:${candidate.id}`, `${candidate.id} ${candidate.title}`, "roadmap", candidate.nextAction),
      ),
      ...activeTasks.map((task) => command(task.id, task.title, "task", task.next_action)),
      ...pendingReviews.map((review) => command(review.id, review.summary, "approval", review.target_file)),
    ],
    instruments: {
      currentBlock: instrumentSignal(currentFocus),
      statusLine: `${activeTasks.length} active signals / ${pendingReviews.length} pending approvals / ${resolvedReviews.length} resolved outcomes / ${regions.length} regions`,
      modes: ["Conceptual Proximity", "Time", "Importance", "Unfinished", "People", "Projects", "Sources"],
    },
  };
  return surfaceModel;
}
