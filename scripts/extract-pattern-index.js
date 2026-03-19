#!/usr/bin/env node

/**
 * extract-pattern-index.js — Scan patterns/ directory for HTML files with
 * data-pattern-* attributes and generate patterns/index.json.
 *
 * Each pattern HTML file must contain a <template> with these attributes:
 *   id                        — Pattern identifier (required)
 *   data-pattern-category     — Category: layouts, feedback, flows (required)
 *   data-pattern-status       — Status: stable, draft, deprecated (optional)
 *   data-pattern-components   — Comma-separated component tag names (optional)
 *
 * The pattern name and description are extracted from the HTML comment header.
 *
 * Usage: node scripts/extract-pattern-index.js
 * Output: patterns/index.json
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const PATTERNS_DIR = path.join(ROOT, "patterns");
const OUTPUT = path.join(PATTERNS_DIR, "index.json");

function findHTMLFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findHTMLFiles(full));
    } else if (entry.name.endsWith(".html")) {
      results.push(full);
    }
  }
  return results;
}

function extractPatternMeta(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const relativePath = path.relative(ROOT, filePath);

  // Extract template element with data-pattern-* attributes
  let id, category;
  const templateMatch = raw.match(
    /<template\s+id=["']([^"']+)["'][^>]*data-pattern-category=["']([^"']+)["'][^>]*>/
  );
  if (templateMatch) {
    id = templateMatch[1];
    category = templateMatch[2];
  } else {
    // Try reversed order (category before id)
    const altMatch = raw.match(
      /<template[^>]*data-pattern-category=["']([^"']+)["'][^>]*id=["']([^"']+)["'][^>]*>/
    );
    if (!altMatch) return null;
    category = altMatch[1];
    id = altMatch[2];
  }

  // Extract optional attributes from the full template opening tag
  const tagRegex = new RegExp(`<template[^>]*id=["']${id}["'][^>]*>`);
  const templateTag = raw.match(tagRegex)?.[0] || "";

  const statusMatch = templateTag.match(/data-pattern-status=["']([^"']+)["']/);
  const componentsMatch = templateTag.match(/data-pattern-components=["']([^"']+)["']/);

  // Extract name and description from HTML comment header
  // First line after <!-- is the name (format: "id — description")
  const commentMatch = raw.match(/<!--\s*\n\s*(\S[^\n]*)/);
  let name = id;
  let description = "";

  if (commentMatch) {
    const firstLine = commentMatch[1].trim();
    const dashMatch = firstLine.match(/^[\w-]+\s*[—–-]\s*(.+)$/);
    if (dashMatch) {
      name = dashMatch[1].trim().replace(/\.$/, "");
    } else {
      name = firstLine.replace(/\.$/, "");
    }
  }

  // Look for a description paragraph in the comment (lines after the first that start with text)
  const descMatch = raw.match(/<!--\s*\n\s*\S[^\n]*\n\s*\n\s*([A-Z][^\n]+)/);
  if (descMatch) {
    description = descMatch[1].trim().replace(/[.:]\s*$/, "");
  }

  const entry = {
    id,
    name,
    category,
    file: relativePath,
  };

  if (description) entry.description = description;
  if (statusMatch) entry.status = statusMatch[1];
  if (componentsMatch) {
    entry.components = componentsMatch[1].split(",").map((s) => s.trim()).filter(Boolean);
  }

  return entry;
}

// Main
const files = findHTMLFiles(PATTERNS_DIR);
const index = [];

for (const file of files) {
  const meta = extractPatternMeta(file);
  if (meta) {
    index.push(meta);
  } else {
    console.warn(`  Skipped (no data-pattern-category): ${path.relative(ROOT, file)}`);
  }
}

// Sort by category then id
index.sort((a, b) => a.category.localeCompare(b.category) || a.id.localeCompare(b.id));

fs.writeFileSync(OUTPUT, JSON.stringify(index, null, 2) + "\n");
console.log(`Generated ${OUTPUT} with ${index.length} patterns.`);
