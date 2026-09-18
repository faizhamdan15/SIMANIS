(function () {
  const cfg = window.SIMANIS_CONFIG;
  const STORAGE_KEY = "simanis-session";

  if (!cfg?.SUPABASE_URL || !cfg?.SUPABASE_PUBLISHABLE_KEY) {
    window.simanisReady = Promise.reject(new Error("Konfigurasi SIMANIS tidak lengkap."));
    return;
  }

  const base = cfg.SUPABASE_URL.replace(/\/$/, "");
  const apikey = cfg.SUPABASE_PUBLISHABLE_KEY;

  // Router pusat untuk semua sidebar SIMANIS. Halaman lama tetap dapat
  // membuka modul baru walaupun routeFor() lokal belum diperbarui.
  const ROUTES_BY_LABEL = {
    "Dashboard": "dashboard.html",
    "Administrasi Kepala Madrasah": "administrasi.html",
    "Data Siswa": "siswa.html",
    "Data Guru": "guru.html",
    "Kelas / Rombel": "kelas.html",
    "Mata Pelajaran": "mapel.html",
    "Jadwal Pelajaran": "jadwal.html",
    "Absensi Guru": "absensi-guru.html",
    "Absensi Siswa": "absensi-siswa.html",
    "Nilai": "nilai.html",
    "Prestasi": "prestasi.html",
    "Berita Madrasah": "berita.html",
    "Pengumuman": "pengumuman.html",
    "Agenda Madrasah": "agenda.html",
    "Keuangan": "keuangan.html",
    "Portal Wali Siswa": "wali-admin.html",
    "Pengaturan": "pengaturan.html",
    "PKM Kurikulum": "unit-kerja.html?unit=PKM_KURIKULUM",
    "PKM Kesiswaan": "unit-kerja.html?unit=PKM_KESISWAAN",
    "PKM Bendahara & Sarpras": "unit-kerja.html?unit=PKM_BENDAHARA_SARPRAS",
    "PKM Humasy": "unit-kerja.html?unit=PKM_HUMASY",
    "Kepala TU": "unit-kerja.html?unit=KEPALA_TU",
    "Kepala Laboratorium IPA": "unit-kerja.html?unit=KALAB_IPA",
    "Kepala Laboratorium Bisnis": "unit-kerja.html?unit=KALAB_BISNIS"
  };

  document.addEventListener("click", function (event) {
    const item = event.target.closest?.(".nav-item");
    if (!item) return;

    const label = (item.textContent || "").replace(/\s+/g, " ").trim();
    const route = ROUTES_BY_LABEL[label];
    if (!route) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const current = location.pathname.split("/").pop() || "index.html";
    const targetFile = route.split("?")[0];
    const targetQuery = route.includes("?") ? "?" + route.split("?").slice(1).join("?") : "";
    if (current !== targetFile || location.search !== targetQuery) location.href = route;
  }, true);

  function readSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveSession(session) {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  }

  function authHeaders(accessToken, extra = {}) {
    const h = { "apikey": apikey, ...extra };
    if (accessToken) h["Authorization"] = `Bearer ${accessToken}`;
    return h;
  }

  async function parseResponse(res) {
    const text = await res.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    if (!res.ok) {
      const msg = body?.msg || body?.message || body?.error_description || body?.error ||
        (typeof body === "string" ? body : null) || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return { body, res };
  }

  async function signIn(email, password) {
    const res = await fetch(`${base}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: authHeaders(null, { "Content-Type": "application/json" }),
      body: JSON.stringify({ email, password })
    });
    const { body } = await parseResponse(res);
    const session = {
      access_token: body.access_token,
      refresh_token: body.refresh_token,
      expires_in: body.expires_in,
      expires_at: Math.floor(Date.now() / 1000) + (body.expires_in || 3600),
      token_type: body.token_type || "bearer",
      user: body.user
    };
    saveSession(session);
    return session;
  }

  async function refreshSession(session) {
    if (!session?.refresh_token) return null;
    const res = await fetch(`${base}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: authHeaders(null, { "Content-Type": "application/json" }),
      body: JSON.stringify({ refresh_token: session.refresh_token })
    });
    const { body } = await parseResponse(res);
    const next = {
      access_token: body.access_token,
      refresh_token: body.refresh_token || session.refresh_token,
      expires_in: body.expires_in,
      expires_at: Math.floor(Date.now() / 1000) + (body.expires_in || 3600),
      token_type: body.token_type || "bearer",
      user: body.user || session.user
    };
    saveSession(next);
    return next;
  }

  async function getSession() {
    let session = readSession();
    if (!session) return null;
    const now = Math.floor(Date.now() / 1000);
    if (!session.expires_at || session.expires_at <= now + 60) {
      try { session = await refreshSession(session); }
      catch { saveSession(null); return null; }
    }
    return session;
  }

  async function getUser() {
    const session = await getSession();
    if (!session?.access_token) return null;
    const res = await fetch(`${base}/auth/v1/user`, { headers: authHeaders(session.access_token) });
    const { body } = await parseResponse(res);
    session.user = body;
    saveSession(session);
    return body;
  }

  async function signOut() {
    const session = readSession();
    try {
      if (session?.access_token) {
        await fetch(`${base}/auth/v1/logout`, { method: "POST", headers: authHeaders(session.access_token) });
      }
    } catch (_) {}
    saveSession(null);
  }

  async function rest(path, options = {}) {
    const session = await getSession();
    if (!session?.access_token) throw new Error("Sesi login tidak ditemukan.");
    const res = await fetch(`${base}/rest/v1/${path}`, {
      ...options,
      headers: {
        ...authHeaders(session.access_token),
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });
    return parseResponse(res);
  }

  async function rpc(fn, payload = {}) {
    const { body } = await rest(`rpc/${encodeURIComponent(fn)}`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    return body;
  }

  async function select(table, query = "") {
    const suffix = query ? `?${query}` : "";
    const { body } = await rest(`${table}${suffix}`, { method: "GET" });
    return body;
  }

  async function count(table, query = "") {
    const suffix = query ? `?${query}&select=id` : `?select=id`;
    const session = await getSession();
    if (!session?.access_token) throw new Error("Sesi login tidak ditemukan.");
    const res = await fetch(`${base}/rest/v1/${table}${suffix}`, {
      method: "GET",
      headers: { ...authHeaders(session.access_token), "Prefer": "count=exact", "Range": "0-0" }
    });
    if (!res.ok) {
      const txt = await res.text();
      let msg = txt;
      try { const j = JSON.parse(txt); msg = j.message || j.error || txt; } catch (_) {}
      throw new Error(msg || `HTTP ${res.status}`);
    }
    const cr = res.headers.get("content-range") || "";
    const total = cr.includes("/") ? cr.split("/").pop() : "0";
    return total === "*" ? 0 : Number(total || 0);
  }



  // Wajib ganti password untuk akun hasil provisioning.
  // Jika migrasi kolom belum dipasang, error diabaikan agar halaman lama tetap berjalan.
  async function enforcePasswordChangeGate() {
    try {
      const current = location.pathname.split("/").pop() || "index.html";
      if (["index.html", "", "account-security.html"].includes(current)) return;

      const session = await getSession();
      if (!session?.access_token || !session?.user?.id) return;

      const res = await fetch(
        `${base}/rest/v1/profiles?select=must_change_password&id=eq.${encodeURIComponent(session.user.id)}&limit=1`,
        { headers: authHeaders(session.access_token) }
      );
      if (!res.ok) return;
      const rows = await res.json();
      if (rows?.[0]?.must_change_password === true) {
        location.replace("account-security.html");
      }
    } catch (_) {}
  }

  // Branding publik: dapat dibaca sebelum login tanpa membuka data sensitif.
  async function applyPublicBranding() {
    try {
      const res = await fetch(`${base}/rest/v1/rpc/get_public_system_settings`, {
        method: "POST",
        headers: { "apikey": apikey, "Content-Type": "application/json" },
        body: "{}"
      });
      if (!res.ok) return;
      const brand = await res.json();
      if (!brand || typeof brand !== "object") return;

      if (brand.logo_url) {
        document.querySelectorAll('img[src="logo.png"], img[src$="/logo.png"]').forEach(img => {
          img.src = brand.logo_url;
        });
      }

      if (brand.school_name) {
        document.querySelectorAll(".side-brand span").forEach(el => {
          if ((el.textContent || "").includes("Sistem Informasi")) {
            el.textContent = `Sistem Informasi ${brand.school_name}`;
          }
        });
      }
    } catch (_) {}
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyPublicBranding, { once: true });
  } else {
    applyPublicBranding();
  }

  window.simanisReady = (async()=>{
    await enforcePasswordChangeGate();
    return {
      auth: { signIn, getSession, getUser, signOut, refreshSession },
      db: { rest, rpc, select, count }
    };
  })();
})();
