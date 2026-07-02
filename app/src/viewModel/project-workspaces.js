import { buildRoadmapCandidates, normalizeAssistantText } from "./assistant-surfaces.js";
import { FIRST_PROJECT_WORKSPACE_ID } from "./constants.js";
import { asArray, command, localCommand, relationshipTouches, shellQuote, sortedUnique, taskById, verificationText } from "./helpers.js";

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

export function proofArtifactSummary(artifact, tasks) {
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

export function buildProjectWorkspaces(state = {}, proofArtifacts = [], relationships = []) {
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

export function attachProjectWorkspace(region, workspaceByProjectId) {
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
