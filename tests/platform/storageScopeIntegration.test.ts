import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const mainSource = readFileSync(path.join(repoRoot, 'src', 'main.tsx'), 'utf8');
const appSource = readFileSync(path.join(repoRoot, 'src', 'App.tsx'), 'utf8');
const storageKeysSource = readFileSync(path.join(repoRoot, 'src', 'utils', 'storageKeys.ts'), 'utf8');
const indexedDbSource = readFileSync(path.join(repoRoot, 'src', 'utils', 'indexedDB.ts'), 'utf8');

describe('account-scoped local data integration', () => {
  it('resolves the authenticated user namespace before mounting React', () => {
    expect(mainSource.indexOf('await bootstrapStorageScope()')).toBeLessThan(
      mainSource.indexOf('createRoot(rootElement).render'),
    );
    expect(mainSource).toContain('supabase.auth.getSession()');
    expect(mainSource).toContain('supabase.auth.onAuthStateChange(');
    expect(mainSource).toContain('setStorageScopeForUser(session.user.id)');
    expect(mainSource).toContain("hasLegacyLocalDataBinding() ? 'guest' : 'local'");
  });

  it('clears health-related in-memory state when the storage scope changes', () => {
    expect(appSource).toContain('onStorageScopeChanged(() =>');
    for (const stateSetter of [
      'setPlan(loadPlanFromStorage())',
      'setDay(loadDayLog(today))',
      'setNotificationSettings(loadNotificationSettings())',
      'setComparePhotos([])',
      'setShowCompareModal(false)',
      'setShowReportModal(false)',
    ]) {
      expect(appSource).toContain(stateSetter);
    }
  });

  it('keeps local-mode keys compatible and namespaces account keys dynamically', () => {
    expect(storageKeysSource).toContain('legacyNs(key: string)');
    expect(storageKeysSource).toContain('storageScopePrefix()');
    expect(storageKeysSource).toContain("migratedFlag: () => legacyNs('migrated_v1')");
  });

  it('does not automatically migrate legacy photos into an authenticated account bucket', () => {
    expect(indexedDbSource).toContain("getStorageScope() === 'local'");
    expect(indexedDbSource).toContain('migrateLegacyPhotosToCurrentUser');
    expect(indexedDbSource).toContain("if (!activeScope.startsWith('user:'))");
    expect(indexedDbSource).toContain("getLocalDataBindingStatus(patientUid) !== 'matched'");
  });
});
