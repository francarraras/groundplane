#!/usr/bin/env node
// Operator CLI entry point (#18/#19): `atlas ask` and `atlas propose`.
//
//   node packages/operator/cli.js ask "<question>" --region <cluster> [--provider mock|ollama|anthropic]
//
// The browser stays read-only; this CLI is the write-side operator surface.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runAsk } from "./ask.js";
import { runPropose } from "./propose.js";
import { runResolve } from "./approve.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function parseArgs(argv) {
  const positionals = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i += 1;
      }
    } else {
      positionals.push(token);
    }
  }
  return { positionals, flags };
}

function usage() {
  console.log(
    [
      "Groundplane operator CLI",
      "",
      "Usage:",
      '  atlas ask "<question>" [--region <cluster|node>] [--provider mock|ollama|anthropic] [--model <name>]',
      '  atlas propose --summary "<change>" --sources SRC-a,SRC-b [--risk low|medium|high] [--diff "<summary>"]',
      "  atlas approve <REV-id> [--decision approve|revise|reject] [--actor <name>] [--reason <text>] [--no-rebuild]",
      "",
      "Providers: mock (offline, default), ollama (local), anthropic (hosted; needs ANTHROPIC_API_KEY).",
      "Set a default with ATLAS_PROVIDER. See .env.example.",
      "",
      "propose emits a review packet through the same validator as the browser and",
      "queues it as pending; approve resolves it and rebuilds the graph.",
    ].join("\n"),
  );
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const { positionals, flags } = parseArgs(rest);

  if (!command || command === "help" || flags.help) {
    usage();
    process.exit(command ? 0 : 1);
  }

  if (command === "ask") {
    const question = positionals.join(" ").trim();
    if (!question) {
      console.error('ask requires a question, e.g. atlas ask "what is blocking the launch?"');
      process.exit(1);
    }
    const result = await runAsk({
      repoRoot: REPO_ROOT,
      question,
      region: typeof flags.region === "string" ? flags.region : null,
      provider: typeof flags.provider === "string" ? flags.provider : undefined,
      model: typeof flags.model === "string" ? flags.model : undefined,
    });
    if (result.selection?.unmatched) {
      console.warn(
        `warning: region "${result.selection.unmatched}" did not match a cluster or node; answered over the whole atlas.`,
      );
    }
    console.log(`\n${result.answer}\n`);
    console.log(
      `— ${result.runPacket.provider}/${result.runPacket.model} · scope: ${result.bundle.scope.kind}` +
        `${result.bundle.scope.id ? ` (${result.bundle.scope.id})` : ""} · sources: ${result.runPacket.source_ids.length}`,
    );
    console.log(`Run packet: ${path.relative(REPO_ROOT, result.runPath)}`);
    return;
  }

  if (command === "propose") {
    const sources =
      typeof flags.sources === "string"
        ? flags.sources
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean)
        : [];
    const result = runPropose({
      repoRoot: REPO_ROOT,
      summary: typeof flags.summary === "string" ? flags.summary : positionals.join(" "),
      risk: typeof flags.risk === "string" ? flags.risk : undefined,
      sourceIds: sources,
      diffSummary: typeof flags.diff === "string" ? flags.diff : undefined,
      reason: typeof flags.reason === "string" ? flags.reason : undefined,
      actor: typeof flags.actor === "string" ? flags.actor : undefined,
    });
    console.log(`Queued pending review ${result.reviewId} in reviews/queue.json (${result.item.risk} risk).`);
    console.log("It now appears in-app with a pending-approval halo. Approve with:");
    console.log(`  atlas approve ${result.reviewId} --actor "<you>" --reason "<why>"`);
    return;
  }

  if (command === "approve") {
    const reviewId = positionals[0];
    if (!reviewId) {
      console.error("approve requires a review id, e.g. atlas approve REV-... --actor you");
      process.exit(1);
    }
    const result = await runResolve({
      repoRoot: REPO_ROOT,
      reviewId,
      decision: typeof flags.decision === "string" ? flags.decision : undefined,
      actor: typeof flags.actor === "string" ? flags.actor : undefined,
      reason: typeof flags.reason === "string" ? flags.reason : undefined,
      rebuildOnApprove: !flags["no-rebuild"],
    });
    console.log(`Review ${result.reviewId} → ${result.decision}. reviews/queue.json updated.`);
    if (result.decision === "approve") {
      console.log(
        result.rebuilt
          ? "Graph rebuilt."
          : `Graph rebuild skipped or failed${result.rebuildError ? `: ${result.rebuildError}` : ""}.`,
      );
    }
    return;
  }

  console.error(`Unknown command: ${command}`);
  usage();
  process.exit(1);
}

main().catch((error) => {
  console.error(`operator error: ${error.message}`);
  process.exit(1);
});
