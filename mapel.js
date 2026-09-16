const $ = (id) => document.getElementById(id);

let api, profile;
let subjects = [];

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatRole(role) {
  return (role || "-").replaceAll("_", " ");
}

function localDateID() {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date());
}

function routeFor(code) {
  if (code === "DASHBOARD") return "dashboard.html";
  if (code === "ADMINISTRASI_KEPALA") return "administrasi.html";
  if (code === "DATA_SISWA") return "siswa.html";
  if (code === "DATA_GURU") return "guru.html";
  if (code === "KELAS") return "kelas.html";
  if (code === "MATA_PELAJARAN") return "mapel.html";
  return "#";
}

function dayOrder(day) {
  return { SENIN: 1, SELASA: 2, RABU: 3, KAMIS: 4, SABTU: 5, AHAD: 6 }[day] || 99;
}

async function loadProfile(user) {
  const rows = await api.db.select(
    "profiles",
    `select=id,full_name,role,is_active&id=eq.${encodeURIComponent(user.id)}&limit=1`
  );
  const p = rows?.[0];
  if (!p) throw new Error("Profil pengguna tidak ditemukan.");
  if (!p.is_active) throw new Error("Akun SIMANIS tidak aktif.");
  return p;
}

async function loadMenu() {
  const modules = await api.db.rpc("get_my_modules", {});
  $("sidebarMenu").innerHTML = (modules || []).map(m => `
    <a href="${routeFor(m.code)}"
       class="nav-item ${m.code === "MATA_PELAJARAN" ? "active" : ""}">
      <span class="nav-dot"></span><span>${esc(m.name)}</span>
    </a>
  `).join("");

  document.querySelectorAll('.nav-item[href="#"]').forEach(a => {
    a.addEventListener("click", e => {
      e.preventDefault();
      alert(`Modul "${a.textContent.trim()}" akan diaktifkan bertahap.`);
    });
  });
}

async function loadSubjects() {
  subjects = await api.db.select(
    "v_subjects_detail",
    "select=*&order=code.asc"
  ) || [];

  renderStats();
  render();
}

function renderStats() {
  const active = subjects.filter(s => s.is_active);
  $("statActive").textContent = active.length;
  $("statSlots").textContent = active.reduce((n, s) => n + Number(s.schedule_slots_per_week || 0), 0);
  $("statAssignments").textContent = active.reduce((n, s) => n + Number(s.teacher_count || 0), 0);
  $("statNoSchedule").textContent = active.filter(s => Number(s.schedule_slots_per_week || 0) === 0).length;
}

function getFiltered() {
  const q = $("searchInput").value.trim().toLowerCase();
  const status = $("statusFilter").value;
  const usage = $("usageFilter").value;

  return subjects.filter(s => {
    const hay = `${s.code || ""} ${s.name || ""} ${s.teacher_names || ""}`.toLowerCase();
    const slots = Number(s.schedule_slots_per_week || 0);
    const teachers = Number(s.teacher_count || 0);

    const okQ = !q || hay.includes(q);
    const okStatus =
      status === "SEMUA" ||
      (status === "AKTIF" && s.is_active) ||
      (status === "NONAKTIF" && !s.is_active);
    const okUsage =
      !usage ||
      (usage === "HAS" && slots > 0) ||
      (usage === "NONE" && slots === 0) ||
      (usage === "MULTI" && teachers > 1);

    return okQ && okStatus && okUsage;
  });
}

function render() {
  const rows = getFiltered();

  if (!rows.length) {
    $("subjectGrid").innerHTML = '<div class="empty-state">Tidak ada mata pelajaran yang cocok.</div>';
    return;
  }

  $("subjectGrid").innerHTML = rows.map(s => `
    <article class="subject-card">
      <div class="subject-head">
        <div>
          <span class="subject-code">${esc(s.code)}</span>
          <h3>${esc(s.name)}</h3>
        </div>
        ${s.is_active
          ? '<span class="badge">Aktif</span>'
          : '<span class="inactive-pill">Nonaktif</span>'}
      </div>

      <p class="teacher-list">${esc(s.teacher_names || "Belum ada guru terjadwal")}</p>

      <div class="subject-meta">
        <div><b>${Number(s.schedule_slots_per_week || 0)}</b>slot/minggu</div>
        <div><b>${Number(s.teacher_count || 0)}</b>guru</div>
        <div><b>${Number(s.class_count || 0)}</b>kelas</div>
      </div>

      <div class="subject-actions">
        <button class="mini-btn" data-detail="${esc(s.id)}">Lihat Jadwal</button>
        <button class="mini-btn" data-edit="${esc(s.id)}">Edit</button>
      </div>
    </article>
  `).join("");

  document.querySelectorAll("[data-edit]").forEach(btn =>
    btn.addEventListener("click", () => openEdit(btn.dataset.edit))
  );

  document.querySelectorAll("[data-detail]").forEach(btn =>
    btn.addEventListener("click", () => openDetail(btn.dataset.detail))
  );
}

function resetForm() {
  $("subjectForm").reset();
  $("subjectId").value = "";
  $("isActive").value = "true";
  $("formMessage").textContent = "";
}

function openAdd() {
  resetForm();
  $("modalTitle").textContent = "Tambah Mata Pelajaran";
  $("subjectModal").classList.remove("hidden");
}

function openEdit(id) {
  const s = subjects.find(x => x.id === id);
  if (!s) return;

  resetForm();
  $("modalTitle").textContent = "Edit Mata Pelajaran";
  $("subjectId").value = s.id;
  $("subjectCode").value = s.code || "";
  $("subjectName").value = s.name || "";
  $("isActive").value = String(!!s.is_active);
  $("subjectModal").classList.remove("hidden");
}

function closeSubjectModal() {
  $("subjectModal").classList.add("hidden");
}

async function restWrite(path, method, body, prefer = "return=representation") {
  const session = await api.auth.getSession();
  if (!session?.access_token) throw new Error("Sesi login tidak ditemukan.");

  const cfg = window.SIMANIS_CONFIG;
  const res = await fetch(`${cfg.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: cfg.SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      Prefer: prefer
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!res.ok) {
    throw new Error(data?.message || data?.error || text || `HTTP ${res.status}`);
  }
  return data;
}

async function saveSubject(e) {
  e.preventDefault();

  const btn = $("saveSubjectBtn");
  const id = $("subjectId").value;
  const payload = {
    code: $("subjectCode").value.trim().toUpperCase(),
    name: $("subjectName").value.trim(),
    is_active: $("isActive").value === "true"
  };

  if (!payload.code || !payload.name) {
    $("formMessage").textContent = "Kode dan nama mata pelajaran wajib diisi.";
    return;
  }

  if (id && !payload.is_active) {
    const current = subjects.find(x => x.id === id);
    if (current && Number(current.schedule_slots_per_week || 0) > 0) {
      const ok = confirm(`Mapel "${current.name}" masih digunakan pada ${current.schedule_slots_per_week} slot jadwal. Tetap nonaktifkan?`);
      if (!ok) return;
    }
  }

  btn.disabled = true;
  btn.textContent = "Menyimpan...";
  $("formMessage").textContent = "";

  try {
    if (id) {
      await restWrite(`subjects?id=eq.${encodeURIComponent(id)}`, "PATCH", payload);
    } else {
      await restWrite("subjects", "POST", payload);
    }

    closeSubjectModal();
    await loadSubjects();
  } catch (err) {
    $("formMessage").textContent = "Gagal menyimpan: " + err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "Simpan";
  }
}

async function openDetail(id) {
  const s = subjects.find(x => x.id === id);
  if (!s) return;

  $("detailTitle").textContent = `${s.code} — ${s.name}`;
  $("detailList").innerHTML = '<div class="placeholder">Memuat jadwal...</div>';
  $("detailModal").classList.remove("hidden");

  try {
    const data = await api.db.select(
      "v_schedule_detail",
      `select=hari,jam,start_time,end_time,kelas,guru,urutan_jam&kode_mapel=eq.${encodeURIComponent(s.code)}&tahun_pelajaran=eq.2026/2027&semester=eq.GANJIL`
    ) || [];

    data.sort((a, b) =>
      dayOrder(a.hari) - dayOrder(b.hari) ||
      Number(a.urutan_jam) - Number(b.urutan_jam) ||
      String(a.kelas).localeCompare(String(b.kelas), "id")
    );

    if (!data.length) {
      $("detailList").innerHTML = '<div class="placeholder">Mata pelajaran ini belum memiliki jadwal.</div>';
      return;
    }

    $("detailList").innerHTML = data.map(x => `
      <div class="subject-detail-row">
        <div class="day">${esc(x.hari)}</div>
        <div class="slot">Jam ${esc(x.jam)}<br>${String(x.start_time).slice(0,5)}–${String(x.end_time).slice(0,5)}</div>
        <div><strong>${esc(x.kelas)}</strong><small>${esc(x.guru)}</small></div>
      </div>
    `).join("");
  } catch (err) {
    $("detailList").innerHTML = `<div class="placeholder">Jadwal gagal dimuat: ${esc(err.message)}</div>`;
  }
}

$("searchInput").addEventListener("input", render);
$("statusFilter").addEventListener("change", render);
$("usageFilter").addEventListener("change", render);
$("addSubjectBtn").addEventListener("click", openAdd);
$("closeSubjectModal").addEventListener("click", closeSubjectModal);
$("cancelSubjectBtn").addEventListener("click", closeSubjectModal);
$("subjectForm").addEventListener("submit", saveSubject);
$("closeDetailModal").addEventListener("click", () => $("detailModal").classList.add("hidden"));
$("subjectModal").addEventListener("click", e => { if (e.target === $("subjectModal")) closeSubjectModal(); });
$("detailModal").addEventListener("click", e => { if (e.target === $("detailModal")) $("detailModal").classList.add("hidden"); });

(async function boot() {
  try {
    api = await window.simanisReady;

    const session = await api.auth.getSession();
    if (!session) {
      location.replace("index.html");
      return;
    }

    const user = await api.auth.getUser();
    if (!user) {
      location.replace("index.html");
      return;
    }

    profile = await loadProfile(user);

    $("sideUserName").textContent = profile.full_name || user.email || "Pengguna";
    $("sideUserRole").textContent = formatRole(profile.role);
    $("headerUser").textContent = profile.full_name || user.email || "Pengguna";
    $("currentDate").textContent = localDateID();

    await loadMenu();
    await loadSubjects();

    $("logoutBtn").addEventListener("click", async () => {
      await api.auth.signOut();
      location.replace("index.html");
    });
  } catch (err) {
    console.error(err);
    alert("Mata Pelajaran gagal dimuat: " + (err.message || err));
  } finally {
    $("loading").classList.add("hidden");
  }
})();
