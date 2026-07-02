import { buildQueryRecords, searchQueryRecords } from "./query.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function asCommandList(value) {
  return Array.isArray(value) ? value : [];
}

function publicText(value = "") {
  return String(value ?? "")
    .replace(/\bDistricts\b/g, "Areas")
    .replace(/\bdistricts\b/g, "areas")
    .replace(/\bDistrict\b/g, "Area")
    .replace(/\bdistrict\b/g, "area")
    .replace(/\bRegions\b/g, "Areas")
    .replace(/\bregions\b/g, "areas")
    .replace(/\bRegion\b/g, "Area")
    .replace(/\bregion\b/g, "area")
    .replace(/\bNodes\b/g, "Items")
    .replace(/\bnodes\b/g, "items")
    .replace(/\bNode\b/g, "Item")
    .replace(/\bnode\b/g, "item")
    .replace(/\bRelationships\b/g, "Connections")
    .replace(/\brelationships\b/g, "connections")
    .replace(/\bRelationship\b/g, "Connection")
    .replace(/\brelationship\b/g, "connection")
    .replace(/\bRelations\b/g, "Connections")
    .replace(/\brelations\b/g, "connections")
    .replace(/\bRelation\b/g, "Connection")
    .replace(/\brelation\b/g, "connection");
}

function publicKindLabel(value = "action") {
  const kind = String(value || "action")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  const labels = {
    atlas: "Home",
    command: "Action",
    decision: "Decision",
    district: "Area",
    "graph node": "Item",
    project: "Project",
    relationship: "Connection",
    "proof-launcher": "Launcher",
    "proof artifact": "Proof",
    "proof-artifact": "Proof",
    review: "Review",
    routine: "Routine",
    source: "Evidence",
    task: "Task",
  };
  return labels[kind] || publicText(kind || "action");
}

function displayEndpoint(value = "") {
  const text = publicText(value)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const isSlugLike = /^[a-z0-9\s]+$/.test(text) && text === text.toLowerCase();
  return isSlugLike ? text.replace(/\b[a-z]/g, (letter) => letter.toUpperCase()) : text;
}

function publicSearchLabel(record = {}) {
  const kind = String(record.kind || "").toLowerCase();
  const label = publicText(record.label || record.id || "Untitled result");
  if (kind !== "relationship") return displayEndpoint(label);

  const path = label.replace(/^relates to:\s*/i, "").split(/\s*->\s*/);
  if (path.length === 2) {
    return `${displayEndpoint(path[0])} to ${displayEndpoint(path[1])}`;
  }

  return displayEndpoint(label.replace(/^relates to:\s*/i, ""));
}

function publicSearchDetail(record = {}) {
  const kind = String(record.kind || "").toLowerCase();
  const detail = publicText(record.detail || "Open result");

  if (kind === "relationship") return "Open connection";

  const countMatch = detail.match(/\bhas\s+(\d+)\s+items?(?:\s+and\s+(\d+)\s+local\s+connections?)?/i);
  if (countMatch) {
    const itemCount = Number(countMatch[1]);
    const connectionCount = countMatch[2] === undefined ? null : Number(countMatch[2]);
    const itemText = `${itemCount} ${itemCount === 1 ? "item" : "items"}`;
    if (Number.isFinite(connectionCount)) {
      return `${itemText} / ${connectionCount} ${connectionCount === 1 ? "connection" : "connections"}`;
    }
    return itemText;
  }

  return detail.length > 72 ? `${detail.slice(0, 69).trim()}...` : detail;
}

function commandFallbackRecords(commands) {
  return asCommandList(commands).map((command) => ({
    id: command.id,
    kind: command.kind || "command",
    label: command.label || command.id,
    detail: command.detail || "Run command",
    routeId: command.id,
    weight: command.kind === "district" ? 10 : 6,
    text: [command.id, command.kind, command.label, command.detail]
      .map((part) => String(part || "").toLowerCase())
      .join(" "),
  }));
}

export function createCommandPalette({ shell, input, results, onChoose, trigger, background }) {
  let commands = [];
  let queryRecords = [];
  let openState = false;
  let firstRouteId = null;
  let previousFocus = null;

  function ownerDocument() {
    return shell?.ownerDocument || document;
  }

  function focusablePaletteElements() {
    if (!shell) return [];

    return Array.from(
      shell.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
    ).filter((element) => {
      const isDisabled = element.disabled === true || element.getAttribute("aria-disabled") === "true";
      const isHidden = element.hidden || element.closest("[hidden]");
      return !isDisabled && !isHidden && typeof element.focus === "function";
    });
  }

  function setModalIsolation(isOpen) {
    if (!background) return;

    if (isOpen) {
      background.inert = true;
      background.setAttribute("aria-hidden", "true");
      return;
    }

    background.inert = false;
    background.removeAttribute("aria-hidden");
  }

  function render(query = "") {
    if (!results) return;

    const normalizedQuery = query.trim().toLowerCase();
    const visibleRecords = searchQueryRecords(queryRecords, normalizedQuery);
    firstRouteId = visibleRecords[0]?.routeId || null;

    if (visibleRecords.length === 0) {
      results.innerHTML = '<p class="empty-note">No matching areas, connections, or actions.</p>';
      return;
    }

    results.innerHTML = visibleRecords
      .map(
        (record) => `
          <button class="command-result" type="button" data-command-id="${escapeHtml(record.id)}" data-route-id="${escapeHtml(record.routeId || record.id)}">
            <span>${escapeHtml(publicKindLabel(record.kind || "action"))}</span>
            <strong>${escapeHtml(publicSearchLabel(record))}</strong>
            <small>${escapeHtml(publicSearchDetail(record))}</small>
          </button>
        `,
      )
      .join("");
  }

  function open() {
    if (!shell || !input) return;
    const activeElement = ownerDocument().activeElement;
    if (!openState && activeElement && activeElement !== input) {
      previousFocus = activeElement;
    }

    openState = true;
    shell.hidden = false;
    input.value = "";
    render();
    setModalIsolation(true);
    input.focus();
  }

  function close() {
    if (!shell) return;
    openState = false;
    shell.hidden = true;
    firstRouteId = null;
    setModalIsolation(false);

    if (previousFocus && previousFocus !== trigger && typeof previousFocus.focus === "function") {
      previousFocus.focus({ preventScroll: true });
    } else if (trigger && typeof trigger.blur === "function") {
      trigger.blur();
    }
    previousFocus = null;
  }

  function setCommands(nextCommands) {
    commands = asCommandList(nextCommands);
    if (queryRecords.length === 0) {
      queryRecords = commandFallbackRecords(commands);
    }
    render(input?.value || "");
  }

  function setModel(nextModel) {
    queryRecords = buildQueryRecords(nextModel);
    render(input?.value || "");
  }

  input?.addEventListener("input", () => render(input.value));

  results?.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest(".command-result");
    if (!button) return;

    const routeId = button.dataset.routeId || button.dataset.commandId;
    if (routeId) {
      onChoose?.(routeId);
    }
    close();
  });

  shell?.addEventListener("mousedown", (event) => {
    if (event.target === shell) {
      event.preventDefault();
      close();
    }
  });

  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      open();
      return;
    }

    if (event.key === "Enter" && openState && firstRouteId) {
      event.preventDefault();
      onChoose?.(firstRouteId);
      close();
      return;
    }

    if (event.key === "Escape" && openState) {
      event.preventDefault();
      close();
      return;
    }

    if (event.key === "Tab" && openState) {
      const focusableElements = focusablePaletteElements();
      if (focusableElements.length === 0) {
        event.preventDefault();
        input?.focus();
        return;
      }

      const activeElement = ownerDocument().activeElement;
      const currentIndex = focusableElements.indexOf(activeElement);
      const fallbackIndex = event.shiftKey ? focusableElements.length - 1 : 0;
      const nextIndex =
        currentIndex === -1
          ? fallbackIndex
          : (currentIndex + (event.shiftKey ? -1 : 1) + focusableElements.length) % focusableElements.length;

      if (
        currentIndex === -1 ||
        (!event.shiftKey && currentIndex === focusableElements.length - 1) ||
        (event.shiftKey && currentIndex === 0)
      ) {
        event.preventDefault();
        focusableElements[nextIndex]?.focus();
      }
    }
  });

  close();

  return { open, close, setCommands, setModel };
}
