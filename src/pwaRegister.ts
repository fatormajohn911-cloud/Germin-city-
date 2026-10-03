/**
 * GEMINI CITY — PWA & Service Worker Registration Helper
 * Fully compatible with GitHub Pages subpaths and standard domains
 */

let deferredInstallPrompt: any = null;
const installListeners = new Set<(canInstall: boolean) => void>();

export function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

export function isInstallPromptAvailable(): boolean {
  return Boolean(deferredInstallPrompt) && !isStandaloneMode();
}

export function subscribeInstallAvailability(listener: (canInstall: boolean) => void): () => void {
  installListeners.add(listener);
  listener(isInstallPromptAvailable());
  return () => {
    installListeners.delete(listener);
  };
}

export async function promptPWAInstall(): Promise<boolean> {
  if (!deferredInstallPrompt) {
    return false;
  }
  try {
    await deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installListeners.forEach((fn) => fn(false));
    return choice?.outcome === 'accepted';
  } catch (err) {
    console.warn('[PWA] Error displaying install prompt:', err);
    return false;
  }
}

/**
 * Initializes Service Worker registration on page load
 */
export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  // Capture beforeinstallprompt for install capability
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    installListeners.forEach((fn) => fn(true));
    console.log('[PWA] beforeinstallprompt event captured and ready');
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    installListeners.forEach((fn) => fn(false));
    console.log('[PWA] GEMINI CITY was successfully installed');
  });

  window.addEventListener('load', () => {
    try {
      // Resolve sw.js relative to current path for GitHub Pages subpath compatibility
      const swUrl = new URL('sw.js', window.location.href).href;
      navigator.serviceWorker
        .register(swUrl)
        .then((registration) => {
          console.log('[PWA] Service Worker registered successfully at scope:', registration.scope);

          registration.onupdatefound = () => {
            const installing = registration.installing;
            if (installing) {
              installing.onstatechange = () => {
                if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('[PWA] New Gemini City version ready for next launch');
                }
              };
            }
          };
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker registration failed:', err);
        });
    } catch (err) {
      console.warn('[PWA] Service Worker registration initialization error:', err);
    }
  });
}
