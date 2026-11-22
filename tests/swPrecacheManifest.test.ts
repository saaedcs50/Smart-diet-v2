import { describe, expect, it } from 'vitest';
import { collectPrecacheAssets, injectPrecacheAssets } from '../scripts/generate-sw-precache.mjs';

describe('build-time Service Worker precache manifest', () => {
  it('walks the entry static-import graph and collects JS, CSS, and fonts', () => {
    const assets = collectPrecacheAssets({
      'index.html': { file: 'assets/index.js', isEntry: true, imports: ['vendor.js'], css: ['assets/index.css'] },
      'vendor.js': { file: 'assets/vendor.js', imports: ['shared.js'] },
      'shared.js': { file: 'assets/shared.js', assets: ['assets/font.woff2', 'assets/large-photo.png'] },
    });
    expect(assets).toEqual([
      '/assets/font.woff2',
      '/assets/index.css',
      '/assets/index.js',
      '/assets/shared.js',
      '/assets/vendor.js',
    ]);
  });

  it('does not follow dynamic imports, so rarely used screens are not forced into the install cache', () => {
    const assets = collectPrecacheAssets({
      'index.html': { file: 'assets/index.js', isEntry: true, dynamicImports: ['heavy-report.js'] },
      'heavy-report.js': { file: 'assets/heavy-report.js' },
    });
    expect(assets).toEqual(['/assets/index.js']);
  });

  it('injects generated assets only between the dedicated markers', () => {
    const source = 'const PRECACHE_ASSETS = [\\n  // GENERATED_PRECACHE_START\\n  // GENERATED_PRECACHE_END\\n];';
    const result = injectPrecacheAssets(source, ['/assets/index.js', '/assets/index.css']);
    expect(result).toContain('"/assets/index.js"');
    expect(result).toContain('"/assets/index.css"');
  });

  it('fails closed when Vite manifest has no app entry or JavaScript bundle', () => {
    expect(() => collectPrecacheAssets({})).toThrow(/no index.html entry/);
    expect(() => collectPrecacheAssets({ 'index.html': { file: 'index.html', isEntry: true } }))
      .toThrow(/missing the application JavaScript/);
  });
});
