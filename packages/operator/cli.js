#!/usr/bin/env node
// Operator CLI entry point (#18/#19): `atlas ask` and `atlas propose`.
//
//   node packages/operator/cli.js ask "<question>" --region <cluster> [--provider mock|ollama|anthropic]
//
// The browser stays read-only; this CLI is the write-side operator surface.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runAsk } from "./ask.js";

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
      "",
      "Providers: mock (offline, default), ollama (local), anthropic (hosted; needs ANTHROPIC_API_KEY).",
      "Set a default with ATLAS_PROVIDER. See .env.example.",
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
      console.warn(`warning: region "${result.selection.unmatched}" did not match a cluster or node; answered over the whole atlas.`);
    }
    console.log(`\n${result.answer}\n`);
    console.log(
      `— ${result.runPacket.provider}/${result.runPacket.model} · scope: ${result.bundle.scope.kind}` +
        `${result.bundle.scope.id ? ` (${result.bundle.scope.id})` : ""} · sources: ${result.runPacket.source_ids.length}`,
    );
    console.log(`Run packet: ${path.relative(REPO_ROOT, result.runPath)}`);
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
