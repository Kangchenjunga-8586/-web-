import { useRegisterSW } from 'virtual:pwa-register/react';

const UPDATE_CHECK_MS = 60 * 60 * 1000;

/**
 * Registers the service worker (offline shell). New versions are offered, never forced:
 * reloading while the user is typing would lose their input. IndexedDB data is not
 * touched by updates.
 */
export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => {
        if (document.visibilityState === 'visible' && navigator.onLine) void registration.update();
      };
      window.setInterval(check, UPDATE_CHECK_MS);
      document.addEventListener('visibilitychange', check);
    },
  });

  if (!needRefresh) return null;
  return (
    <div
      className="fixed inset-x-0 z-[80] flex justify-center px-4"
      style={{ top: 'calc(max(env(safe-area-inset-top), 8px) + 4px)' }}
      role="status"
    >
      <div className="anim-pop flex w-full max-w-[420px] items-center gap-3 rounded-2xl bg-[#1d1d1f] py-1.5 pr-1.5 pl-4 text-white shadow-xl dark:bg-[#3a3a3c]">
        <p className="min-w-0 flex-1 text-[14px]">新しいバージョンがあります</p>
        <button
          type="button"
          className="min-h-[44px] rounded-xl px-3 text-[14px] font-medium text-white/70"
          onClick={() => setNeedRefresh(false)}
        >
          あとで
        </button>
        <button
          type="button"
          className="min-h-[44px] rounded-xl bg-white px-4 text-[14px] font-semibold text-black"
          onClick={() => void updateServiceWorker(true)}
        >
          更新
        </button>
      </div>
    </div>
  );
}
