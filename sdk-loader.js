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
    "Wali Kelas": "wali-kelas.html",
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

  // ------------------------------------------------------------
  // ROLE & PERMISSION GURU V2
  // ------------------------------------------------------------
  const PAGE_MODULE_BY_FILE = {
    "dashboard.html":"DASHBOARD",
    "administrasi.html":"ADMINISTRASI_KEPALA",
    "siswa.html":"DATA_SISWA",
    "guru.html":"DATA_GURU",
    "kelas.html":"KELAS",
    "mapel.html":"MATA_PELAJARAN",
    "jadwal.html":"JADWAL",
    "absensi-guru.html":"ABSENSI_GURU",
    "absensi-siswa.html":"ABSENSI_SISWA",
    "wali-kelas.html":"DATA_SISWA",
    "nilai.html":"NILAI",
    "prestasi.html":"PRESTASI",
    "berita.html":"BERITA",
    "pengumuman.html":"PENGUMUMAN",
    "agenda.html":"AGENDA",
    "keuangan.html":"KEUANGAN",
    "wali-admin.html":"PORTAL_WALI",
    "pengaturan.html":"PENGATURAN"
  };

  const ACTION_SELECTORS = {
    DATA_SISWA:{
      create:["#addStudentBtn"],
      update:["[data-edit]","[data-disable]"],
      delete:["[data-delete]"]
    },
    DATA_GURU:{
      create:["#addTeacherBtn"],
      update:["[data-edit]"],
      delete:["[data-delete]"]
    },
    KELAS:{
      create:["#addClassBtn"],
      update:["[data-edit]"],
      delete:["[data-delete]"]
    },
    MATA_PELAJARAN:{
      create:["#addSubjectBtn"],
      update:["[data-edit]"],
      delete:["[data-delete]"]
    },
    JADWAL:{
      create:["#addBtn","[data-new-day]","[data-new-slot]"],
      update:["[data-edit]"],
      delete:["#deleteBtn"]
    },
    PRESTASI:{
      create:["#addBtn"],
      update:["[data-edit]"],
      delete:["#deleteBtn","[data-delete]"]
    },
    BERITA:{
      create:["#addBtn"],
      update:["[data-edit]"],
      delete:["#deleteBtn"]
    },
    PENGUMUMAN:{
      create:["#addBtn"],
      update:["[data-edit]","[data-file-delete]"],
      delete:["#deleteBtn"]
    },
    AGENDA:{
      create:["#addBtn"],
      update:["[data-edit]"],
      delete:["#deleteBtn"]
    }
  };

  let accessContext = null;
  let currentModulePermission = null;
  let currentModuleCode = null;
  let permissionObserver = null;
  let homeroomContext = null;
  let homeroomMenuObserver = null;

  function currentFile() {
    return location.pathname.split("/").pop() || "index.html";
  }

  function detectCurrentModule() {
    const file = currentFile();
    if (file === "unit-kerja.html") {
      return (new URLSearchParams(location.search).get("unit") || "").toUpperCase() || null;
    }
    return PAGE_MODULE_BY_FILE[file] || null;
  }

  function pageActionForTarget(target) {
    if (!currentModuleCode || !currentModulePermission) return null;
    const sets = ACTION_SELECTORS[currentModuleCode];
    if (!sets) return null;
    for (const [action, selectors] of Object.entries(sets)) {
      for (const selector of selectors) {
        try {
          if (target.closest?.(selector)) return action;
        } catch (_) {}
      }
    }
    return null;
  }

  function permissionAllows(action) {
    if (!currentModulePermission) return true;
    if (action === "create") return !!currentModulePermission.can_create;
    if (action === "update") return !!currentModulePermission.can_update;
    if (action === "delete") return !!currentModulePermission.can_delete;
    return !!currentModulePermission.can_view;
  }

  function applyPermissionUi() {
    if (!currentModuleCode || !currentModulePermission) return;

    const sets = ACTION_SELECTORS[currentModuleCode] || {};
    const map = {
      create:currentModulePermission.can_create,
      update:currentModulePermission.can_update,
      delete:currentModulePermission.can_delete
    };

    for (const [action, selectors] of Object.entries(sets)) {
      if (map[action]) continue;
      selectors.forEach(selector => {
        try {
          document.querySelectorAll(selector).forEach(el => {
            el.style.setProperty("display","none","important");
            el.setAttribute("aria-hidden","true");
            el.dataset.simanisPermissionHidden="true";
          });
        } catch (_) {}
      });
    }

    // Read-only / scoped information chip.
    if (
      accessContext?.is_teacher_role &&
      ["DATA_SISWA","KELAS","JADWAL"].includes(currentModuleCode)
    ) {
      const head = document.querySelector(".page-head");
      if (head && !document.getElementById("simanisTeacherScopeChip")) {
        const chip = document.createElement("div");
        chip.id = "simanisTeacherScopeChip";
        chip.textContent = "Mode Guru · Data sesuai kelas/jadwal Anda";
        chip.style.cssText = [
          "display:inline-flex","align-items:center","padding:7px 10px",
          "border-radius:999px","background:#e8f5ee","color:#0b7347",
          "font-size:10px","font-weight:800","margin-top:8px"
        ].join(";");
        const left = head.firstElementChild || head;
        left.appendChild(chip);
      }
    } else if (
      accessContext?.is_teacher_role &&
      currentModulePermission.can_view &&
      !currentModulePermission.can_create &&
      !currentModulePermission.can_update &&
      !currentModulePermission.can_delete
    ) {
      const head = document.querySelector(".page-head");
      if (head && !document.getElementById("simanisReadOnlyChip")) {
        const chip = document.createElement("div");
        chip.id = "simanisReadOnlyChip";
        chip.textContent = "Mode Lihat Saja";
        chip.style.cssText = [
          "display:inline-flex","padding:7px 10px","border-radius:999px",
          "background:#f1f4f2","color:#52655c","font-size:10px",
          "font-weight:800","margin-top:8px"
        ].join(";");
        (head.firstElementChild || head).appendChild(chip);
      }
    }
  }

  // Capture lebih dulu daripada listener halaman lama.
  document.addEventListener("click", function(event){
    const action = pageActionForTarget(event.target);
    if (!action || permissionAllows(action)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  function startPermissionObserver() {
    if (!currentModulePermission) return;
    const run = () => applyPermissionUi();
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", run, { once:true });
    } else {
      run();
    }
    if (!permissionObserver && document.documentElement) {
      permissionObserver = new MutationObserver(() => applyPermissionUi());
      permissionObserver.observe(document.documentElement, {
        childList:true,
        subtree:true
      });
    }
  }


  function ensureHomeroomMenu() {
    if (!homeroomContext?.has_homeroom) return;
    const nav = document.getElementById("sidebarMenu");
    if (!nav) return;

    let item = nav.querySelector('[data-simanis-homeroom="true"]');
    if (!item) {
      item = document.createElement("a");
      item.href = "wali-kelas.html";
      item.dataset.simanisHomeroom = "true";
      item.className = "nav-item";
      item.innerHTML = '<span class="nav-dot"></span><span>Wali Kelas</span>';

      const anchors = [...nav.querySelectorAll(".nav-item")];
      const dataSiswa = anchors.find(a =>
        (a.textContent || "").replace(/\s+/g," ").trim() === "Data Siswa"
      );
      if (dataSiswa) dataSiswa.insertAdjacentElement("afterend",item);
      else nav.appendChild(item);
    }

    item.classList.toggle("active",currentFile()==="wali-kelas.html");
  }

  function startHomeroomMenuObserver() {
    if (!homeroomContext?.has_homeroom) return;

    const run = () => ensureHomeroomMenu();

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded",run,{once:true});
    } else {
      run();
    }

    if (!homeroomMenuObserver && document.documentElement) {
      homeroomMenuObserver = new MutationObserver(() => ensureHomeroomMenu());
      homeroomMenuObserver.observe(document.documentElement,{
        childList:true,
        subtree:true
      });
    }
  }

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


  async function rawRpc(fn, payload = {}) {
    const session = await getSession();
    if (!session?.access_token) throw new Error("Sesi login tidak ditemukan.");
    const res = await fetch(`${base}/rest/v1/rpc/${encodeURIComponent(fn)}`, {
      method:"POST",
      headers:{
        ...authHeaders(session.access_token),
        "Content-Type":"application/json"
      },
      body:JSON.stringify(payload)
    });
    const { body } = await parseResponse(res);
    return body;
  }

  async function initializeAccessControl() {
    const file = currentFile();
    if (["index.html","","account-security.html"].includes(file)) return true;

    const session = await getSession();
    if (!session?.access_token) return true;

    currentModuleCode = detectCurrentModule();

    try {
      accessContext = await rawRpc("get_my_access_context",{});
      window.SIMANIS_ACCESS_CONTEXT = accessContext;
    } catch (err) {
      console.warn("Access context V2 belum tersedia:",err);
      return true;
    }

    try {
      homeroomContext = await rawRpc("get_my_homeroom_context",{});
      window.SIMANIS_HOMEROOM_CONTEXT = homeroomContext;
      if (homeroomContext?.has_homeroom) startHomeroomMenuObserver();
    } catch (err) {
      // Paket Wali Kelas bersifat additive. Sebelum SQL dipasang,
      // menu tidak ditampilkan dan modul lain tetap berjalan normal.
      console.warn("Konteks Wali Kelas belum tersedia:",err);
    }

    if (!currentModuleCode) return true;

    try {
      currentModulePermission = await rawRpc(
        "get_my_module_permission",
        { p_module_code:currentModuleCode }
      );
      window.SIMANIS_MODULE_PERMISSION = currentModulePermission;
    } catch (err) {
      console.warn("Module permission V2 belum tersedia:",err);
      return true;
    }

    if (currentModulePermission?.can_view === false) {
      location.replace(`dashboard.html?access_denied=${encodeURIComponent(currentModuleCode)}`);
      return false;
    }

    startPermissionObserver();
    return true;
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
    // Guru mendapat scope personal di halaman operasional reguler.
    // Workspace jabatan struktural (unit-kerja.html) tetap menggunakan
    // query normal dan hak strukturalnya sendiri.
    if (accessContext?.scope_mode === "TEACHER_SCOPED") {
      const file = currentFile();

      if (file === "kelas.html" && table === "v_classes_current") {
        return await rawRpc("get_my_scoped_classes", {
          p_scope:"TEACH_OR_HOMEROOM"
        });
      }

      if (file === "siswa.html") {
        if (table === "v_students_current") {
          return await rawRpc("get_my_scoped_students",{});
        }
        if (table === "classes") {
          return await rawRpc("get_my_scoped_classes", {
            p_scope:"TEACH_OR_HOMEROOM"
          });
        }
      }

      if (file === "jadwal.html") {
        if (table === "v_schedule_manage") {
          return await rawRpc("get_my_scoped_schedule",{});
        }
        if (table === "classes") {
          return await rawRpc("get_my_scoped_classes", {
            p_scope:"TEACH_ONLY"
          });
        }
        if (table === "teachers") {
          return await rawRpc("get_my_teacher_self",{});
        }
      }
    }

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

    const allowed = await initializeAccessControl();
    if (allowed === false) {
      return await new Promise(() => {});
    }

    return {
      auth: { signIn, getSession, getUser, signOut, refreshSession },
      db: { rest, rpc, select, count },
      access: {
        context: () => accessContext,
        permission: () => currentModulePermission,
        moduleCode: () => currentModuleCode,
        can: permissionAllows
      }
    };
  })();
})();
