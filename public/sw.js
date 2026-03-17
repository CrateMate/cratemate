// CrateMate Service Worker
const CACHE_NAME = "cratemate-v1";
const OFFLINE_DB = "cratemate-offline";
const OFFLINE_STORE = "offline-plays";

const PRECACHE_URLS = ["/", "/manifest.json"];

// Routes that can be served from cache (network-first)
const NETWORK_FIRST_PATTERNS = [/\/api\/records/, /\/api\/plays/, /\/api\/spotify\/features/];

// Routes that must always go to network
const NETWORK_ONLY_PATTERNS = [/\/api\/discogs\/import/, /\/api\/discogs\/wantlist\/import/, /\/api\/claude/];

// ---------- Install ----------
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

// ---------- Activate ----------
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ---------- IDB helpers ----------
function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OFFLINE_DB, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(OFFLINE_STORE)) {
        db.createObjectStore(OFFLINE_STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function queuePlay(userId, recordId) {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE, "readwrite");
    const store = tx.objectStore(OFFLINE_STORE);
    const req = store.add({ user_id: userId, record_id: recordId, played_at: new Date().toISOString() });
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
  });
}

async function getAllPlays() {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE, "readonly");
    const req = tx.objectStore(OFFLINE_STORE).getAll();
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function clearPlays() {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE, "readwrite");
    const req = tx.objectStore(OFFLINE_STORE).clear();
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
  });
}

// ---------- Fetch ----------
self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Network-only routes (import, AI, etc.)
  if (NETWORK_ONLY_PATTERNS.some((p) => p.test(url.pathname))) {
    e.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: "Offline — this feature requires a connection." }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    return;
  }

  // POST /api/plays — queue offline when no network
  if (request.method === "POST" && /\/api\/plays$/.test(url.pathname)) {
    e.respondWith(
      fetch(request.clone()).catch(async () => {
        // Offline: extract body and queue in IDB
        try {
          const body = await request.json();
          await queuePlay(body.user_id || "unknown", body.record_id);
        } catch { /* ignore */ }
        return new Response(
          JSON.stringify({ id: crypto.randomUUID(), played_at: new Date().toISOString(), offline: true }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      })
    );
    return;
  }

  // Network-first with cache fallback for GET data routes
  if (request.method === "GET" && NETWORK_FIRST_PATTERNS.some((p) => p.test(url.pathname))) {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // For navigation requests (HTML pages), try network then cache
  if (request.mode === "navigate") {
    e.respondWith(
      fetch(request).catch(() => caches.match("/"))
    );
    return;
  }
});

// ---------- Background Sync ----------
self.addEventListener("sync", (e) => {
  if (e.tag === "sync-plays") {
    e.waitUntil(syncOfflinePlays());
  }
});

async function syncOfflinePlays() {
  const plays = await getAllPlays();
  if (!plays || plays.length === 0) return;

  const results = await Promise.allSettled(
    plays.map((play) =>
      fetch("/api/plays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ record_id: play.record_id }),
      })
    )
  );

  // Only clear if all succeeded
  const allOk = results.every((r) => r.status === "fulfilled" && r.value.ok);
  if (allOk) await clearPlays();
}
