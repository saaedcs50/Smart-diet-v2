import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ============================================================================
// اختبار حارس الـ White-Label (v2): يثبت أن هوية أي عميلة بعينها لا تتسلل
// مجددًا إلى المصدر/الإعدادات. الأنماط الممنوعة مبنية بتجميع مقاطع عمدًا
// حتى لا يحتوي هذا الملف نفسه على النصوص الممنوعة حرفيًا.
// ============================================================================

const FORBIDDEN: { label: string; needle: string; ci?: boolean }[] = [
  { label: 'arabic-personal-name', needle: 'شيم' + 'اء' },
  { label: 'latin-personal-name', needle: 'shi' + 'maa', ci: true },
  { label: 'family-name', needle: 'الفي' + 'شي' },
  { label: 'brand-slug', needle: 'dr-' + 'shi' + 'maa', ci: true },
  { label: 'whatsapp-number', needle: '2010' + '13961464' },
  { label: 'phone-number-a', needle: '0111' + '9216365' },
  { label: 'phone-number-b', needle: '2011' + '19216365' },
];

const TEXT_EXTS = new Set([
  '.ts', '.tsx', '.js', '.mjs', '.json', '.html', '.txt', '.md', '.css', '.svg',
]);

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function collectFiles(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
      collectFiles(full, out);
    } else if (TEXT_EXTS.has(path.extname(entry.name).toLowerCase())) {
      out.push(full);
    }
  }
}

function scannedFiles(): string[] {
  const files: string[] = [];
  for (const dir of ['src', 'clients', 'scripts', 'public']) {
    collectFiles(path.join(repoRoot, dir), files);
  }
  for (const file of ['index.html', 'metadata.json']) {
    const full = path.join(repoRoot, file);
    if (statSync(full).isFile()) files.push(full);
  }
  return files;
}

describe('white-label guard — no personal clinic identity in source/config', () => {
  it('scans a meaningful number of files', () => {
    expect(scannedFiles().length).toBeGreaterThan(50);
  });

  it('finds zero forbidden identity patterns', () => {
    const violations: string[] = [];
    for (const file of scannedFiles()) {
      const content = readFileSync(file, 'utf-8');
      const lower = content.toLowerCase();
      for (const { label, needle, ci } of FORBIDDEN) {
        const hit = ci ? lower.includes(needle.toLowerCase()) : content.includes(needle);
        if (hit) violations.push(`${path.relative(repoRoot, file)} :: ${label}`);
      }
    }
    expect(violations).toEqual([]);
  });
});
