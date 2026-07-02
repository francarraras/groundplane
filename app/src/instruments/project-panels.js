import { asArray, escapeHtml, field, pill, publicText, publicTitle, truncateText } from "./helpers.js";

function renderProjectWorkspaceList(title, items = []) {
  const rows = asArray(items).slice(0, 4);
  if (rows.length === 0) return "";

  return `
    <div class="project-workspace-list">
      <b>${escapeHtml(title)}</b>
      <ul>
        ${rows.map((item) => `<li title="${escapeHtml(publicText(item))}"><span>${escapeHtml(truncateText(publicText(item), 88))}</span></li>`).join("")}
      </ul>
    </div>
  `;
}

function renderProjectContextUsageLoop(loop = null) {
  if (!loop) return "";

  const nextSafeAction = publicText(loop.nextSafeAction || "Use the existing context before choosing another source.");
  const boundary = publicText(loop.approvalBoundary || "Read-only app context until separately approved.");

  return `
    <section
      class="project-context-usage-loop"
      data-context-usage-id="${escapeHtml(loop.id || "context-usage")}"
      data-browser-writes="${loop.browserWrites === true ? "true" : "false"}"
      aria-label="${escapeHtml(`Context usage loop. Next safe action: ${nextSafeAction}`)}"
    >
      <div class="project-context-usage-head">
        <div>
          <p class="section-kicker">Context usage loop</p>
          <h3 title="${escapeHtml(publicText(loop.title || "Flagship Project context usage loop"))}">${escapeHtml(
            truncateText(publicText(loop.title || "Flagship Project context usage loop"), 48),
          )}</h3>
        </div>
        ${pill(loop.browserWrites === true ? "browser writes" : "read-only")}
      </div>
      <p class="project-context-next" title="${escapeHtml(nextSafeAction)}">
        <b>Next safe action</b>
        <span>${escapeHtml(nextSafeAction)}</span>
      </p>
      <div class="project-context-usage-grid">
        ${renderProjectWorkspaceList("Daily loop", loop.dailyLoop)}
        ${renderProjectWorkspaceList("Proof rules", loop.proofRules)}
        ${renderProjectWorkspaceList("Project review prompts", loop.projectReviewPrompts)}
        ${renderProjectWorkspaceList("Limits", loop.limitations)}
      </div>
      <p class="project-command-room-boundary" title="${escapeHtml(boundary)}">
        <b>Approval boundary</b>
        <span>${escapeHtml(truncateText(boundary, 150))}</span>
      </p>
    </section>
  `;
}

function renderProjectCommandRoom(room = null) {
  if (!room) return "";

  const nextActions = asArray(room.nextActions);
  const blockers = asArray(room.blockers);
  const boundary = publicText(room.approvalBoundary || "Read-only until separately approved.");

  return `
    <section
      class="project-command-room"
      data-command-room-id="${escapeHtml(room.id || "command-room")}"
      data-browser-writes="${room.browserWrites === true ? "true" : "false"}"
      aria-label="${escapeHtml(`Project command room. Current milestone: ${publicText(room.currentMilestone)}`)}"
    >
      <div class="project-command-room-head">
        <div>
          <p class="section-kicker">Project command room</p>
          <h3 title="${escapeHtml(publicText(room.currentMilestone))}">${escapeHtml(
            truncateText(publicText(room.currentMilestone || "Current milestone"), 54),
          )}</h3>
        </div>
        ${pill(room.browserWrites === true ? "browser writes" : "read-only")}
      </div>
      <div class="project-command-room-grid">
        <p class="project-command-room-strip is-primary">
          <b>Recommended move</b>
          <span title="${escapeHtml(publicText(room.recommendedMove))}">${escapeHtml(
            truncateText(publicText(room.recommendedMove || "Review the next move."), 142),
          )}</span>
        </p>
        <p class="project-command-room-strip">
          <b>Proof status</b>
          <span title="${escapeHtml(publicText(room.proofStatus))}">${escapeHtml(
            truncateText(publicText(room.proofStatus || "No proof status recorded."), 96),
          )}</span>
        </p>
      </div>
      <div class="project-command-room-grid">
        ${renderProjectWorkspaceList("Next actions", nextActions)}
        ${renderProjectWorkspaceList("Blockers", blockers)}
      </div>
      <p class="project-command-room-boundary" title="${escapeHtml(boundary)}">
        <b>Approval boundary</b>
        <span>${escapeHtml(truncateText(boundary, 150))}</span>
      </p>
    </section>
  `;
}

function renderProjectNextStepApproval(approval = null) {
  if (!approval) return "";

  const sourceText = asArray(approval.sourceIds).join(", ") || "none";
  const boundary = publicText(approval.approvalBoundary || "Preview only until separately approved.");
  const undoPath = publicText(approval.undoPath || "Revert this preview before promotion.");
  const notApproved = asArray(approval.notApproved);

  return `
    <section
      class="project-next-step-approval"
      data-next-step-approval-id="${escapeHtml(approval.id || "approval-preview")}"
      data-browser-writes="${approval.browserWrites === true ? "true" : "false"}"
      aria-label="${escapeHtml(`Approval preview. Target: ${approval.target}. Risk: ${approval.risk}. ${boundary}`)}"
    >
      <div class="project-next-step-head">
        <div>
          <p class="section-kicker">Approval preview</p>
          <h3 title="${escapeHtml(approval.title || "Next-step approval")}">${escapeHtml(
            truncateText(approval.title || "Next-step approval", 46),
          )}</h3>
        </div>
        <div class="project-next-step-pills">
          ${pill(publicTitle(approval.mode || "draft-for-approval", "Draft-for-approval"))}
          ${pill(publicTitle(approval.risk || "medium", "Medium"))}
        </div>
      </div>
      <p class="project-next-step-purpose" title="${escapeHtml(publicText(approval.packetPurpose))}">
        <b>Packet purpose</b>
        <span>${escapeHtml(truncateText(publicText(approval.packetPurpose || "Preview the next approval packet."), 140))}</span>
      </p>
      <dl class="project-next-step-grid">
        ${field("Risk", publicTitle(approval.risk || "medium", "Medium"))}
        ${field("Target", approval.target || "none")}
        ${field("Source IDs", sourceText)}
        ${field("Browser", approval.browserWrites === true ? "writes" : "read-only")}
      </dl>
      <details class="project-next-step-detail">
        <summary>
          <span>Decision details</span>
          <small>Risk, undo, limits</small>
        </summary>
        <div class="project-next-step-detail-body">
          <p><b>Recommended move</b><span>${escapeHtml(publicText(approval.recommendedMove || "Review the next move."))}</span></p>
          <p><b>Approval boundary</b><span>${escapeHtml(boundary)}</span></p>
          <p><b>Undo path</b><span>${escapeHtml(undoPath)}</span></p>
          <div class="project-next-step-not-approved">
            <b>Not approved</b>
            <ul>
              ${notApproved.map((item) => `<li>${escapeHtml(publicText(item))}</li>`).join("")}
            </ul>
          </div>
        </div>
      </details>
    </section>
  `;
}

export function renderProjectWorkspacePanel(workspace = null) {
  if (!workspace) return "";

  const proof = workspace.linkedProofArtifact || null;
  const objective = publicText(workspace.objective || "No objective recorded.");
  const sourceText = asArray(workspace.sourceIds).join(", ") || "none";

  return `
    <section
      class="project-workspace-panel"
      data-project-workspace-id="${escapeHtml(workspace.id)}"
      data-browser-writes="${workspace.browserWrites === true ? "true" : "false"}"
      aria-label="${escapeHtml(`Project workspace. ${workspace.title}. Objective: ${objective}`)}"
    >
      <div class="project-workspace-head">
        <div>
          <p class="section-kicker">Project workspace</p>
          <h3 title="${escapeHtml(workspace.title)}">${escapeHtml(truncateText(workspace.title, 44))}</h3>
        </div>
        <div class="project-workspace-pills">
          ${pill(workspace.status || "unknown")}
          ${pill(workspace.health || "unknown")}
          ${pill(workspace.browserWrites === true ? "browser writes" : "read-only")}
        </div>
      </div>
      ${renderProjectCommandRoom(workspace.commandRoom)}
      ${renderProjectContextUsageLoop(workspace.contextUsageLoop)}
      ${renderProjectNextStepApproval(workspace.nextStepApproval)}
      <p class="project-workspace-objective">
        <b>Objective</b>
        <span title="${escapeHtml(objective)}">${escapeHtml(truncateText(objective, 150))}</span>
      </p>
      <div class="project-workspace-grid">
        ${renderProjectWorkspaceList("Next actions", workspace.nextActions)}
        ${renderProjectWorkspaceList("Risks", workspace.risks)}
        ${renderProjectWorkspaceList("Approvals", workspace.approvals)}
        ${renderProjectWorkspaceList("Related context", workspace.relatedContext)}
      </div>
      ${
        proof
          ? `<div class="project-workspace-proof">
              <div>
                <b>Linked proof</b>
                <strong title="${escapeHtml(proof.title)}">${escapeHtml(truncateText(proof.title, 42))}</strong>
              </div>
              <span>${escapeHtml(proof.status || "unknown")}</span>
              <span title="${escapeHtml(proof.verification || "verification unknown")}">${escapeHtml(
                truncateText(proof.verification || "verification unknown", 34),
              )}</span>
              <small title="${escapeHtml(proof.boundary || "No boundary recorded.")}">${escapeHtml(
                truncateText(proof.boundary || "No boundary recorded.", 86),
              )}</small>
            </div>`
          : ""
      }
      <p class="project-workspace-sources" title="${escapeHtml(sourceText)}">
        <b>Sources</b>
        <span>${escapeHtml(truncateText(sourceText, 74))}</span>
      </p>
    </section>
  `;
}
