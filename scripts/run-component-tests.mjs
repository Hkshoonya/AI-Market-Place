#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const passedArgs = process.argv.slice(2);
const vitestBin = join(process.cwd(), "node_modules", "vitest", "vitest.mjs");
const baseArgs = [vitestBin, "run", "--project", "component", "--testTimeout", "15000"];
const vitestOptionsWithValues = new Set([
  "-c",
  "--config",
  "-r",
  "--reporter",
  "--environment",
  "--pool",
  "--root",
  "--dir",
  "--coverage",
  "--outputFile",
]);

function collectComponentTests(dir) {
  if (!existsSync(dir)) return [];

  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectComponentTests(path));
    } else if (entry.isFile() && entry.name.endsWith(".test.tsx")) {
      files.push(path);
    }
  }

  return files;
}

function runVitest(args) {
  const result = spawnSync(process.execPath, [...baseArgs, ...args], {
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    console.error(result.error);
    return 1;
  }

  return result.status ?? 1;
}

function splitVitestArgs(args) {
  const optionArgs = [];
  const filterArgs = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    optionArgs.push(arg);

    if (vitestOptionsWithValues.has(arg) && index + 1 < args.length) {
      index += 1;
      optionArgs.push(args[index]);
    } else if (!arg.startsWith("-")) {
      filterArgs.push(arg);
    }
  }

  return { optionArgs, filterArgs };
}

const { optionArgs, filterArgs } = splitVitestArgs(passedArgs);

if (filterArgs.length > 0) {
  process.exit(runVitest(passedArgs));
}

const files = collectComponentTests(join(process.cwd(), "src")).sort();
const chunkSize = 8;

for (let index = 0; index < files.length; index += chunkSize) {
  const chunk = files.slice(index, index + chunkSize);
  console.log(
    `[component-tests] Running ${index + 1}-${index + chunk.length} of ${files.length}`
  );
  const status = runVitest([...optionArgs, ...chunk]);
  if (status !== 0) {
    process.exit(status);
  }
}
