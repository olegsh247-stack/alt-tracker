// Синхронизация настроек между устройствами: localStorage остаётся быстрой копией, сервер — общий источник.
const KEYS = ['cryptoTrackedAssets', 'cryptoTrackedMeta', 'forexCodes', 'forexBase', 'assetBase'];
const timers = {};

function parse(raw, fallback) { try { const v = JSON.parse(raw); return v ?? fallback; } catch { return fallback; } }

function push(key, value) {
  try {
    fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, value }), keepalive: true }).catch(() => {});
  } catch {}
}

// Записать настройку: сразу в localStorage, на сервер — с задержкой (быстрые подряд изменения склеиваются)
export function saveSetting(key, value) {
  try { localStorage.setItem(key, value); } catch {}
  clearTimeout(timers[key]);
  timers[key] = setTimeout(() => push(key, value), 1200);
}

// Подтянуть настройки с сервера. Возвращает true, если локальные данные изменились.
// Первая синхронизация устройства объединяет списки (ничего не теряется), дальше сервер главный.
export async function pullSettings() {
  let server;
  try {
    const r = await fetch('/api/settings');
    if (!r.ok) return false;
    server = (await r.json()).settings || {};
  } catch { return false; }
  let first = false;
  try { first = !localStorage.getItem('settingsSynced'); } catch {}
  let changed = false;
  for (const key of KEYS) {
    let local = null;
    try { local = localStorage.getItem(key); } catch {}
    const srv = server[key] ?? null;
    let next = srv;
    if (srv == null) next = local;
    else if (first && local != null && local !== srv) {
      if (key === 'cryptoTrackedAssets' || key === 'forexCodes') {
        const s = parse(srv, []), l = parse(local, []);
        next = JSON.stringify([...s, ...l.filter(x => !s.includes(x))]);
      } else if (key === 'cryptoTrackedMeta') {
        next = JSON.stringify({ ...parse(local, {}), ...parse(srv, {}) });
      }
    }
    if (next != null && next !== local) { try { localStorage.setItem(key, next); changed = true; } catch {} }
    if (next != null && next !== srv) push(key, next);
  }
  try { localStorage.setItem('settingsSynced', '1'); } catch {}
  return changed;
}
