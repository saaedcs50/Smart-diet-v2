#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function addEntryAssets(manifest, key, seen, output) {
  if (!key || seen.has(key)) return;
  seen.add(key);
  const entry = manifest[key];
  if (!entry) return;

  const candidates = [entry.file, ...(entry.css ?? []), ...(entry.assets ?? [])];
  for (const file of candidates) {
    if (typeof file !== 'string' || file.startsWith('http') || file.includes('..')) continue;
    // Only critical executable/style/font resources are needed for first offline boot.
    if (!/\.(?:m?js|css|woff2?|ttf|otf)$/i.test(file)) continue;
    output.add('/' + file.replace(/^\/+/, ''));
  }
  for (const imported of entry.imports ?? []) addEntryAssets(manifest, imported, seen, output);
}

export function collectPrecacheAssets(manifest) {
  const entryKey = Object.keys(manifest).find((key) =>
    key === 'index.html' || (manifest[key]?.isEntry && /(^|\/)index\.html$/.test(manifest[key]?.src ?? key))
  );
  if (!entryKey) throw new Error('Vite manifest has no index.html entry; cannot build the offline precache.');
  const output = new Set();
  addEntryAssets(manifest, entryKey, new Set(), output);
  if (![...output].some((asset) => /\.m?js$/i.test(asset))) {
    throw new Error('Offline precache is missing the application JavaScript entry.');
  }
  return [...output].sort();
}

export function injectPrecacheAssets(serviceWorkerSource, assets) {
  const generated = [
    '// GENERATED_PRECACHE_START',
    ...assets.map((asset) => `  ${JSON.stringify(asset)},`),
    '// GENERATED_PRECACHE_END',
  ].join('\n');
  const pattern = /\/\/ GENERATED_PRECACHE_START[\s\S]*?\/\/ GENERATED_PRECACHE_END/;
  if (!pattern.test(serviceWorkerSource)) {
    throw new Error('Service Worker is missing the generated precache markers.');
  }
  return serviceWorkerSource.replace(pattern, generated);
}

async function main() {
  const outputDir = path.resolve(process.argv[2] ?? 'dist');
  const manifestPath = path.join(outputDir, '.vite', 'manifest.json');
  const serviceWorkerPath = path.join(outputDir, 'sw.js');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const source = await readFile(serviceWorkerPath, 'utf8');
  const assets = collectPrecacheAssets(manifest);
  await writeFile(serviceWorkerPath, injectPrecacheAssets(source, assets), 'utf8');
  console.log(`Service Worker precache generated: ${assets.length} critical assets in ${outputDir}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Failed to generate Service Worker precache.');
    process.exitCode = 1;
  });
}
