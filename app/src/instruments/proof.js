import { asArray, escapeHtml, field, pill } from "./helpers.js";

export function renderProofPackagePanel(proofPackage) {
  if (!proofPackage) return "";

  const sourceIds = asArray(proofPackage.sourceIds || proofPackage.source_ids);
  const sourceText = sourceIds.length > 0 ? sourceIds.join(", ") : "none";
  const capabilities = asArray(proofPackage.capabilities).slice(0, 5);
  const limitations = asArray(proofPackage.limitations).slice(0, 4);
  const boundary = proofPackage.boundary || "No proof-package boundary recorded.";

  return `
    <section class="inspector-section proof-package-panel proof-artifact-dossier" data-proof-package-status="${escapeHtml(
      proofPackage.status || "unknown",
    )}">
      <p class="section-kicker">Evidence package</p>
      <div class="proof-package-head">
        <h3>${escapeHtml(proofPackage.title || "Private proof package")}</h3>
        ${pill(proofPackage.status || "unknown")}
      </div>

      <div class="proof-summary-strip">
        <dl class="artifact-stat-strip">
          ${field("Status", proofPackage.status || "unknown")}
        ${field("Verification", proofPackage.verification || "unknown")}
        ${field("Gate", proofPackage.currentGate || "unknown")}
      </dl>
      </div>

      ${renderProofLauncherPanel(proofPackage)}

      <details class="proof-detail-drawer proof-dossier-detail">
        <summary>
          <span>What is included</span>
          <small>${escapeHtml(proofPackage.privacy || "private local package")}</small>
        </summary>
        <div class="proof-detail-body proof-dossier-body">
          ${
            capabilities.length === 0
              ? ""
              : `
                <details class="proof-detail-drawer proof-capabilities-detail">
                  <summary>
                    <span>What it proves</span>
                    <small>${capabilities.length} proven result${capabilities.length === 1 ? "" : "s"}</small>
                  </summary>
                  <div class="proof-detail-body">
                    <div class="proof-capability-rail">
                      ${capabilities.map((capability) => `<span>${escapeHtml(capability)}</span>`).join("")}
                    </div>
                  </div>
                </details>
              `
          }
          <details class="proof-detail-drawer">
            <summary>
              <span>Local files</span>
              <small>${escapeHtml(proofPackage.privacy || "private local package")}</small>
            </summary>
            <div class="proof-detail-body">
              <dl class="proof-package-grid proof-path-grid">
                ${field("ID", proofPackage.id || "unknown")}
                ${field("Privacy", proofPackage.privacy || "private-local")}
                ${field("Package", proofPackage.artifactPath || "none")}
                ${field("Review doc", proofPackage.reviewDoc || "none")}
                ${field("Smoke", proofPackage.smokeScript || "none")}
                ${field("Demo", proofPackage.browserDemo || "none")}
                ${field("Sources", sourceText)}
              </dl>
            </div>
          </details>
          ${
            limitations.length === 0
              ? ""
              : `
                <details class="proof-detail-drawer">
                  <summary>
                    <span>Limitations</span>
                    <small>${limitations.length} recorded constraint${limitations.length === 1 ? "" : "s"}</small>
                  </summary>
                  <div class="proof-detail-body">
                    <ul class="proof-limitations">${limitations
                      .map((limitation) => `<li>${escapeHtml(limitation)}</li>`)
                      .join("")}</ul>
                  </div>
                </details>
              `
          }
          <details class="proof-detail-drawer">
            <summary>
              <span>Approval limit</span>
              <small>${escapeHtml(proofPackage.privacy || "private local only")}</small>
            </summary>
            <div class="proof-detail-body">
              <div class="proof-boundary-strip">
                <strong>Approval limit</strong>
                <span>${escapeHtml(boundary)}</span>
              </div>
            </div>
          </details>
        </div>
      </details>
      <p class="proof-next-action proof-next-action-compact">
        <strong>Open when needed</strong>
        <span>Open details only when needed.</span>
      </p>
    </section>
  `;
}

function renderProofLauncherPanel(proofPackage) {
  const launcher = proofPackage.launcher || proofPackage;
  const sourceIds = asArray(launcher.sourceIds || proofPackage.sourceIds || proofPackage.source_ids);
  const sourceText = sourceIds.length > 0 ? sourceIds.join(", ") : "none";
  const reviewCommand = launcher.reviewCommand || proofPackage.reviewCommand || "No review command available";
  const demoCommand = launcher.demoCommand || proofPackage.demoCommand || "No demo command available";
  const smokeCommand = launcher.smokeCommand || proofPackage.smokeCommand || "No smoke command available";
  const boundary = launcher.launcherBoundary || proofPackage.launcherBoundary || "Read-only launcher. No writes from browser.";
  const safePath = launcher.safeLaunchPath || proofPackage.safeLaunchPath || "Review package before running any local demo.";

  const launcherAction = (title, detail, commandText) => `
    <article class="proof-launcher-action">
      <span>${escapeHtml(title)}</span>
      <strong>${escapeHtml(detail)}</strong>
      <code>${escapeHtml(commandText)}</code>
    </article>
  `;

  return `
    <section class="proof-launcher-panel" data-proof-launcher-id="${escapeHtml(
      launcher.id || proofPackage.id || "proof",
    )}" aria-label="${escapeHtml(`Read-only launcher for ${proofPackage.title || "proof artifact"}`)}">
      <div class="proof-launcher-head">
        <div>
          <p class="section-kicker">Read-only launcher</p>
          <h4>${escapeHtml(proofPackage.title || "Private proof package")}</h4>
        </div>
        ${pill(proofPackage.privacy || "private-local")}
      </div>
      <p class="proof-launcher-boundary">${escapeHtml(boundary)}</p>
      <div class="proof-launcher-actions" aria-label="Local proof launcher actions">
        ${launcherAction("Review package", proofPackage.reviewDoc || "Review doc", reviewCommand)}
        ${launcherAction("Local demo", proofPackage.browserDemo || "Browser demo", demoCommand)}
        ${launcherAction("Copy command", "Smoke check", smokeCommand)}
      </div>
      <details class="proof-detail-drawer proof-launcher-detail" data-proof-launcher-detail>
        <summary>
          <span>Usage path</span>
          <small>No writes from browser</small>
        </summary>
        <div class="proof-detail-body">
          <dl class="proof-package-grid proof-path-grid">
            ${field("Safe path", safePath)}
            ${field("Sources", sourceText)}
            ${field("Package", proofPackage.artifactPath || "none")}
            ${field("Approval limit", proofPackage.boundary || "Private local only")}
          </dl>
        </div>
      </details>
    </section>
  `;
}
