import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { applyBrandTheme, applyBrandHeadAssets } from './config/brand';
import { migrateLegacyStorageOnce } from './utils/storageKeys';
import {
  setStorageScope,
  setStorageScopeForUser,
} from './utils/storageScope';
import { hasLegacyLocalDataBinding } from './platform/localDataOwnership';
import { isPlatformEnabled } from './platform/platformMode';
import { getSupabase, isSupabaseConfigured } from './platform/supabase';

applyBrandTheme();
applyBrandHeadAssets();

// Old single-clinic data retains its original namespace. The platform scope is
// resolved from the persisted Supabase session before React renders anything.
setStorageScope('local');
migrateLegacyStorageOnce();

async function bootstrapStorageScope(): Promise<void> {
  if (!isPlatformEnabled() || !isSupabaseConfigured()) return;

  const scopeAfterSignOut = () => (
    hasLegacyLocalDataBinding() ? 'guest' : 'local'
  );

  try {
    const supabase = getSupabase();
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;

    if (session?.user?.id) {
      setStorageScopeForUser(session.user.id);
    } else {
      setStorageScope(scopeAfterSignOut());
    }

    // Keep the active bucket aligned with login, logout, refresh and account
    // switch events for the lifetime of the single-page application.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (nextSession?.user?.id) {
          setStorageScopeForUser(nextSession.user.id);
        } else {
          setStorageScope(scopeAfterSignOut());
        }
      },
    );
    // The app intentionally lives for the page lifetime; retain the subscription.
    void subscription;
  } catch {
    // Fail closed for a previously bound device dataset. Do not expose its
    // legacy namespace to a signed-out/unknown identity after auth failure.
    setStorageScope(scopeAfterSignOut());
  }
}

async function startApp(): Promise<void> {
  await bootstrapStorageScope();
  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error('Root element was not found');

  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void startApp();
