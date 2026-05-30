import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDir, "..");

const localeRoot = path.join(frontendRoot, "src/locales");
const locales = ["en", "ja"];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(frontendRoot, relativePath), "utf8"));
}

function readMapping() {
  const source = fs.readFileSync(path.join(localeRoot, "flatMapping.ts"), "utf8");
  const entries = [...source.matchAll(/^\s+"([^"]+)":\s+(\[[^\n]+\]),$/gm)];
  if (entries.length === 0) {
    throw new Error("No localeFlatMapping entries found.");
  }
  return Object.fromEntries(entries.map(([, flatKey, jsonPath]) => [flatKey, JSON.parse(jsonPath)]));
}

function readPath(messages, jsonPath, flatKey) {
  let current = messages;
  for (const segment of jsonPath) {
    if (!current || typeof current !== "object" || Array.isArray(current) || !(segment in current)) {
      throw new Error(`Missing JSON path for ${flatKey}: ${jsonPath.join(".")}`);
    }
    current = current[segment];
  }
  if (typeof current !== "string") {
    throw new Error(`JSON path for ${flatKey} does not resolve to a string: ${jsonPath.join(".")}`);
  }
  return current;
}

function flatten(messages, mapping) {
  return Object.fromEntries(
    Object.entries(mapping).map(([flatKey, jsonPath]) => [flatKey, readPath(messages, jsonPath, flatKey)]),
  );
}

function collectLeafPaths(value, prefix = []) {
  if (typeof value === "string") return [prefix.join(".")];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Locale JSON leaves must be strings: ${prefix.join(".")}`);
  }
  return Object.entries(value).flatMap(([key, child]) => collectLeafPaths(child, [...prefix, key]));
}

function placeholders(value) {
  return [...value.matchAll(/\{\d+\}/g)].map(([placeholder]) => placeholder).sort();
}

const mapping = readMapping();
const mappedPaths = Object.values(mapping).map((jsonPath) => jsonPath.join("."));
const duplicatePaths = mappedPaths.filter((jsonPath, index) => mappedPaths.indexOf(jsonPath) !== index);
if (duplicatePaths.length > 0) {
  throw new Error(`Duplicate mapped JSON paths: ${[...new Set(duplicatePaths)].join(", ")}`);
}

const flattenedByLocale = {};

for (const locale of locales) {
  const messages = readJson(`src/locales/messages/${locale}.json`);
  const baseline = readJson(`src/locales/__test__/fixtures/${locale}.baseline.json`);
  const flattened = flatten(messages, mapping);
  flattenedByLocale[locale] = flattened;

  const baselineKeys = Object.keys(baseline).sort();
  const flattenedKeys = Object.keys(flattened).sort();
  if (JSON.stringify(flattenedKeys) !== JSON.stringify(baselineKeys)) {
    throw new Error(`${locale} flattened keys do not match baseline keys.`);
  }

  for (const flatKey of baselineKeys) {
    if (flattened[flatKey] !== baseline[flatKey]) {
      throw new Error(`${locale}.${flatKey} changed from baseline.`);
    }
  }

  const leafPaths = collectLeafPaths(messages).sort();
  const sortedMappedPaths = mappedPaths.toSorted();
  if (JSON.stringify(leafPaths) !== JSON.stringify(sortedMappedPaths)) {
    throw new Error(`${locale} JSON leaves are not exactly covered by localeFlatMapping.`);
  }
}

const enKeys = Object.keys(flattenedByLocale.en).sort();
const jaKeys = Object.keys(flattenedByLocale.ja).sort();
if (JSON.stringify(enKeys) !== JSON.stringify(jaKeys)) {
  throw new Error("English and Japanese locale keys are not aligned.");
}

for (const flatKey of enKeys) {
  const enPlaceholders = placeholders(flattenedByLocale.en[flatKey]);
  const jaPlaceholders = placeholders(flattenedByLocale.ja[flatKey]);
  if (JSON.stringify(enPlaceholders) !== JSON.stringify(jaPlaceholders)) {
    throw new Error(`${flatKey} placeholders differ: en=${enPlaceholders.join(",")} ja=${jaPlaceholders.join(",")}`);
  }
}

const postComposerKeys = enKeys.filter((flatKey) => flatKey.startsWith("PostComposer_"));
if (postComposerKeys.length <= 20) {
  throw new Error("PostComposer locale keys were unexpectedly low or missing.");
}

console.log(`Locale verification passed: ${enKeys.length} keys, ${postComposerKeys.length} PostComposer keys.`);
