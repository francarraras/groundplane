import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  REVIEW_QUEUE_PATH,
  appendReviewItemForPreview,
  validateHandoffApproval,
  validateReviewPacketPreview,
  validateReviewQueue,
} from "./lib/review-packet.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const previewPath = requireArg(args, "preview");
  const approvalPath = requireArg(args, "approval");
  const queuePath = args.queue || REVIEW_QUEUE_PATH;
  const allowTestQueue = Boolean(args["allow-test-queue"]);

  assertQueuePathAllowed(queuePath, allowTestQueue);

  const sourceCatalog = await readJson(path.join(root, "sources/catalog.json"), "sources/catalog.json");
  const preview = validateReviewPacketPreview(
    await readJson(resolvePath(previewPath), "preview"),
    sourceCatalog,
  );
  const approval = validateHandoffApproval(
    await readJson(resolvePath(approvalPath), "approval"),
    preview,
  );

  const absoluteQueuePath = resolvePath(queuePath);
  const queue = validateReviewQueue(await readJson(absoluteQueuePath, queuePath));
  const nextQueue = appendReviewItemForPreview(queue, preview, approval, {
    createdAt: args["created-at"],
  });
  const item = nextQueue.reviews[nextQueue.reviews.length - 1];

  await writeFile(absoluteQueuePath, `${JSON.stringify(nextQueue, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({
    review_id: item.id,
    target_file: item.target_file,
    risk: item.risk,
    undo_path: item.undo_path,
  }, null, 2)}\n`);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    const name = token.slice(2);
    if (name === "allow-test-queue") {
      parsed[name] = true;
      continue;
    }

    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${name}`);
    }
    parsed[name] = value;
    index += 1;
  }
  return parsed;
}

function requireArg(args, name) {
  if (!args[name]) throw new Error(`Missing required --${name}`);
  return args[name];
}

function resolvePath(value) {
  return path.isAbsolute(value) ? value : path.join(root, value);
}

function assertQueuePathAllowed(queuePath, allowTestQueue) {
  if (!allowTestQueue && queuePath !== REVIEW_QUEUE_PATH) {
    throw new Error(`Queue path must be ${REVIEW_QUEUE_PATH}. Test queues require --allow-test-queue.`);
  }
}

async function readJson(filePath, label) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Invalid JSON for ${label}: ${error.message}`);
  }
}
