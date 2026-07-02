// Provider adapter for the operator CLI (#18).
//
// One interface — complete(messages, options) → { text, provider, model } —
// with three implementations selected by name:
//   - mock:      deterministic, offline, no server. Used for tests and demos.
//   - ollama:    local models via http://localhost:11434 (the no-API-key path).
//   - anthropic: hosted models via the Messages API (needs ANTHROPIC_API_KEY).
//
// Raw fetch, no SDK dependency. Every call is wrapped with a timeout and a
// single retry, and fails closed: on error it throws and the caller writes
// nothing.

const DEFAULT_TIMEOUT_MS = 60000;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function systemText(messages) {
  return asArray(messages)
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n");
}

function conversation(messages) {
  return asArray(messages).filter((message) => message.role !== "system");
}

async function withTimeout(run, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

// --- mock ------------------------------------------------------------------
// Deterministic: echoes the question and cites every source id present in the
// bundle text, so tests can assert grounded, source-cited output offline.
function mockComplete(messages, options = {}) {
  const user = conversation(messages).map((message) => message.content).join("\n");
  const questionLine = (user.match(/Question:\s*(.+)/) || [])[1] || "the question";
  const citedIds = [...new Set(user.match(/SRC-[0-9A-Za-z-]+/g) || [])];
  const citations = citedIds.length > 0 ? ` ${citedIds.map((id) => `[${id}]`).join(" ")}` : "";
  const text =
    `Based on the provided context bundle, here is a grounded answer to "${questionLine}".` +
    ` This offline mock response summarizes the cited evidence without calling a hosted model.${citations}`;
  return { text, provider: "mock", model: options.model || "mock-deterministic" };
}

// --- ollama ----------------------------------------------------------------
async function ollamaComplete(messages, options = {}) {
  const host = options.host || process.env.OLLAMA_HOST || "http://localhost:11434";
  const model = options.model || process.env.OLLAMA_MODEL || "llama3.1";
  const body = {
    model,
    messages: asArray(messages).map((message) => ({ role: message.role, content: message.content })),
    stream: false,
  };
  const response = await withTimeout(
    (signal) =>
      fetch(`${host.replace(/\/$/, "")}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal,
      }),
    options.timeoutMs || DEFAULT_TIMEOUT_MS,
  );
  if (!response.ok) throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
  const data = await response.json();
  const text = data?.message?.content;
  if (!text) throw new Error("Ollama returned an empty completion");
  return { text, provider: "ollama", model };
}

// --- anthropic -------------------------------------------------------------
async function anthropicComplete(messages, options = {}) {
  const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  const model = options.model || process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
  const body = {
    model,
    max_tokens: options.maxTokens || 1024,
    system: systemText(messages),
    messages: conversation(messages).map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.content,
    })),
  };
  const response = await withTimeout(
    (signal) =>
      fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
        signal,
      }),
    options.timeoutMs || DEFAULT_TIMEOUT_MS,
  );
  if (!response.ok) throw new Error(`Anthropic request failed: ${response.status} ${response.statusText}`);
  const data = await response.json();
  const text = asArray(data?.content)
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
  if (!text) throw new Error("Anthropic returned an empty completion");
  return { text, provider: "anthropic", model };
}

const IMPLS = {
  mock: mockComplete,
  ollama: ollamaComplete,
  anthropic: anthropicComplete,
};

export function providerName(explicit) {
  return String(explicit || process.env.ATLAS_PROVIDER || "mock").toLowerCase();
}

// complete() with timeout + one retry + fail-closed. Throws on final failure;
// the caller must not write any answer artifact when it throws.
export async function complete(messages, options = {}) {
  const name = providerName(options.provider);
  const impl = IMPLS[name];
  if (!impl) throw new Error(`Unknown provider: ${name}. Use one of: ${Object.keys(IMPLS).join(", ")}`);

  const attempts = Number.isInteger(options.retries) ? options.retries + 1 : 2;
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await impl(messages, options);
      if (!result || !result.text) throw new Error(`${name} returned no text`);
      return { ...result, attempts: attempt };
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Provider ${name} failed after ${attempts} attempt(s): ${lastError?.message || lastError}`);
}

export const PROVIDERS = Object.keys(IMPLS);
