const $ = (id) => document.getElementById(id);

let api;
let profile;
let allStudents = [];
let classes = [];
let activeSemesterId = null;

let page = 1;
const pageSize = 30;

function esc(s) {
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;");
}

function formatRole(role) {
  return (role || "-").replaceAll("_"," ");
}

function localDateID() {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone:"Asia/Jakarta",
    weekday:"long",
    day:"numeric",
    month:"long",
    year:"numeric"
  }).format(new Date());
}

function routeFor(code) {
  if (code === "DASHBOARD") return "dashboard.html";
  if (code === "ADMINISTRASI_KEPALA") return "administrasi.html";
  if (code === "DATA_SISWA") return "siswa.html";
  return "#";
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
       data-code="${esc(m.code)}"
       class="nav-item ${m.code === "DATA_SISWA" ? "active" : ""}">
      <span class="nav-dot"></span><span>${esc(m.name)}</span>
    </a>
  `).join("");

  document.querySelectorAll(".nav-item[href='#']").forEach(a => {
    a.addEventListener("click", e => {
      e.preventDefault();
      const label = a.textContent.trim();
      alert(`Modul "${label}" akan kita aktifkan pada tahap berikutnya.`);
    });
  });
}

async function loadMaster() {
  const [classRows, semesterRows] = await Promise.all([
    api.db.select(
      "classes",
      "select=id,name,grade_level&is_active=eq.true&order=grade_level.asc,name.asc"
    ),
    api.db.select(
      "semesters",
      "select=id,name,is_active,academic_year_id&is_active=eq.true&limit=1"
    )
  ]);

  classes = classRows || [];
  activeSemesterId = semesterRows?.[0]?.id || null;

  const opts = classes.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
  $("classFilter").insertAdjacentHTML("beforeend", opts);
  $("classId").insertAdjacentHTML("beforeend", opts);
}

async function loadStudents() {
  allStudents = await api.db.select(
    "v_students_current",
    "select=*&order=class_name.asc.nullslast,roll_number.asc.nullslast,full_name.asc"
  ) || [];

  renderStats();
  page = 1;
  render();
}

function getFiltered() {
  const q = $("searchInput").value.trim().toLowerCase();
  const classId = $("classFilter").value;
  const gender = $("genderFilter").value;

  return allStudents.filter(s => {
    const hay = `${s.full_name || ""} ${s.nis || ""} ${s.nisn || ""}`.toLowerCase();
    const okQ = !q || hay.includes(q);
    const okClass = !classId || s.class_id === classId;
    const okGender =
      !gender ||
      (gender === "EMPTY" ? !s.gender : s.gender === gender);
    return okQ && okClass && okGender;
  });
}

function renderStats() {
  $("statTotal").textContent = allStudents.length;
  $("statMale").textContent = allStudents.filter(s => s.gender === "L").length;
  $("statFemale").textContent = allStudents.filter(s => s.gender === "P").length;
  $("statUnassigned").textContent = allStudents.filter(s => !s.class_id).length;
}

function render() {
  const rows = getFiltered();
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  if (page > totalPages) page = totalPages;

  const start = (page - 1) * pageSize;
  const slice = rows.slice(start, start + pageSize);

  if (!slice.length) {
    $("studentTableBody").innerHTML =
      `<tr><td colspan="7"><div class="empty-state">Tidak ada siswa yang cocok.</div></td></tr>`;
    $("studentCards").innerHTML =
      `<div class="empty-state">Tidak ada siswa yang cocok.</div>`;
  } else {
    $("studentTableBody").innerHTML = slice.map((s,i) => `
      <tr>
        <td>${start + i + 1}</td>
        <td>
          <div class="student-name">${esc(s.full_name)}</div>
          <div class="muted">${esc(s.id.slice(0,8))}</div>
        </td>
        <td>
          <div>${esc(s.nis || "-")}</div>
          <div class="muted">${esc(s.nisn || "-")}</div>
        </td>
        <td>${esc(s.gender || "-")}</td>
        <td><span class="badge">${esc(s.class_name || "Belum ada kelas")}</span></td>
        <td>${esc(s.roll_number ?? "-")}</td>
        <td>
          <div class="row-actions">
            <button class="mini-btn" data-edit="${esc(s.id)}">Edit</button>
            <button class="mini-btn danger" data-disable="${esc(s.id)}">Nonaktifkan</button>
          </div>
        </td>
      </tr>
    `).join("");

    $("studentCards").innerHTML = slice.map(s => `
      <article class="student-card">
        <div class="top">
          <div>
            <h4>${esc(s.full_name)}</h4>
            <p>${esc(s.nis || "NIS belum diisi")} · ${esc(s.nisn || "NISN belum diisi")}</p>
          </div>
          <span class="badge">${esc(s.class_name || "Belum ada kelas")}</span>
        </div>
        <div class="student-meta">
          <div><b>JK</b><br>${esc(s.gender || "-")}</div>
          <div><b>No. Urut</b><br>${esc(s.roll_number ?? "-")}</div>
        </div>
        <div class="row-actions">
          <button class="mini-btn" data-edit="${esc(s.id)}">Edit</button>
          <button class="mini-btn danger" data-disable="${esc(s.id)}">Nonaktifkan</button>
        </div>
      </article>
    `).join("");
  }

  $("tableInfo").textContent =
    `${rows.length} siswa · Halaman ${page} dari ${totalPages}`;
  $("prevBtn").disabled = page <= 1;
  $("nextBtn").disabled = page >= totalPages;

  document.querySelectorAll("[data-edit]").forEach(b =>
    b.addEventListener("click", () => openEdit(b.dataset.edit))
  );

  document.querySelectorAll("[data-disable]").forEach(b =>
    b.addEventListener("click", () => disableStudent(b.dataset.disable))
  );
}

function resetForm() {
  $("studentForm").reset();
  $("studentId").value = "";
  $("enrollmentId").value = "";
  $("formMessage").textContent = "";
}

function openModal() {
  $("studentModal").classList.remove("hidden");
}

function closeModal() {
  $("studentModal").classList.add("hidden");
}

function openAdd() {
  resetForm();
  $("modalTitle").textContent = "Tambah Siswa";
  openModal();
}

function openEdit(id) {
  const s = allStudents.find(x => x.id === id);
  if (!s) return;

  resetForm();
  $("modalTitle").textContent = "Edit Data Siswa";
  $("studentId").value = s.id;
  $("enrollmentId").value = s.enrollment_id || "";
  $("fullName").value = s.full_name || "";
  $("nis").value = s.nis || "";
  $("nisn").value = s.nisn || "";
  $("gender").value = s.gender || "";
  $("classId").value = s.class_id || "";
  $("rollNumber").value = s.roll_number || "";
  $("admissionYear").value = s.admission_year || "";
  $("birthPlace").value = s.birth_place || "";
  $("birthDate").value = s.birth_date || "";
  $("fatherName").value = s.father_name || "";
  $("motherName").value = s.mother_name || "";
  $("guardianName").value = s.guardian_name || "";
  $("guardianPhone").value = s.guardian_phone || "";
  $("address").value = s.address || "";
  openModal();
}

async function restWrite(path, method, body, prefer = "return=representation") {
  const session = await api.auth.getSession();
  if (!session?.access_token) throw new Error("Sesi login tidak ditemukan.");

  const cfg = window.SIMANIS_CONFIG;
  const res = await fetch(`${cfg.SUPABASE_URL.replace(/\/$/,"")}/rest/v1/${path}`, {
    method,
    headers: {
      "apikey": cfg.SUPABASE_PUBLISHABLE_KEY,
      "Authorization": `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      "Prefer": prefer
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!res.ok) {
    const msg = data?.message || data?.error || text || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

async function saveStudent(e) {
  e.preventDefault();

  const saveBtn = $("saveBtn");
  const studentId = $("studentId").value;
  const enrollmentId = $("enrollmentId").value;
  const classId = $("classId").value || null;
  const roll = $("rollNumber").value ? Number($("rollNumber").value) : null;

  const payload = {
    full_name: $("fullName").value.trim(),
    nis: $("nis").value.trim() || null,
    nisn: $("nisn").value.trim() || null,
    gender: $("gender").value || null,
    admission_year: $("admissionYear").value ? Number($("admissionYear").value) : null,
    birth_place: $("birthPlace").value.trim() || null,
    birth_date: $("birthDate").value || null,
    father_name: $("fatherName").value.trim() || null,
    mother_name: $("motherName").value.trim() || null,
    guardian_name: $("guardianName").value.trim() || null,
    guardian_phone: $("guardianPhone").value.trim() || null,
    address: $("address").value.trim() || null,
    status: "AKTIF"
  };

  if (!payload.full_name) {
    $("formMessage").textContent = "Nama siswa wajib diisi.";
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = "Menyimpan...";
  $("formMessage").textContent = "";

  try {
    let finalStudentId = studentId;

    if (studentId) {
      await restWrite(
        `students?id=eq.${encodeURIComponent(studentId)}`,
        "PATCH",
        payload
      );
    } else {
      const inserted = await restWrite("students", "POST", payload);
      finalStudentId = inserted?.[0]?.id;
      if (!finalStudentId) throw new Error("ID siswa baru tidak diterima.");
    }

    if (activeSemesterId) {
      if (enrollmentId) {
        if (classId) {
          await restWrite(
            `student_enrollments?id=eq.${encodeURIComponent(enrollmentId)}`,
            "PATCH",
            {
              class_id: classId,
              roll_number: roll,
              status: "AKTIF"
            }
          );
        } else {
          await restWrite(
            `student_enrollments?id=eq.${encodeURIComponent(enrollmentId)}`,
            "PATCH",
            { status: "PINDAH" }
          );
        }
      } else if (classId) {
        await restWrite(
          "student_enrollments",
          "POST",
          {
            student_id: finalStudentId,
            class_id: classId,
            semester_id: activeSemesterId,
            roll_number: roll,
            status: "AKTIF"
          }
        );
      }
    }

    closeModal();
    await loadStudents();
  } catch (err) {
    $("formMessage").textContent = "Gagal menyimpan: " + err.message;
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Simpan";
  }
}

async function disableStudent(id) {
  const s = allStudents.find(x => x.id === id);
  if (!s) return;

  if (!confirm(`Nonaktifkan siswa "${s.full_name}"? Data tidak akan dihapus.`)) return;

  try {
    await restWrite(
      `students?id=eq.${encodeURIComponent(id)}`,
      "PATCH",
      { status: "KELUAR" }
    );

    if (s.enrollment_id) {
      await restWrite(
        `student_enrollments?id=eq.${encodeURIComponent(s.enrollment_id)}`,
        "PATCH",
        { status: "PINDAH" }
      );
    }

    await loadStudents();
  } catch (err) {
    alert("Gagal menonaktifkan siswa: " + err.message);
  }
}

async function boot() {
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

    await Promise.all([loadMenu(), loadMaster()]);
    await loadStudents();

    $("logoutBtn").addEventListener("click", async () => {
      await api.auth.signOut();
      location.replace("index.html");
    });

  } catch (err) {
    console.error(err);
    alert("Data Siswa gagal dimuat: " + (err.message || err));
  } finally {
    $("loading").classList.add("hidden");
  }
}

$("searchInput").addEventListener("input", () => { page = 1; render(); });
$("classFilter").addEventListener("change", () => { page = 1; render(); });
$("genderFilter").addEventListener("change", () => { page = 1; render(); });
$("prevBtn").addEventListener("click", () => { page--; render(); window.scrollTo({top:0,behavior:"smooth"}); });
$("nextBtn").addEventListener("click", () => { page++; render(); window.scrollTo({top:0,behavior:"smooth"}); });

$("addStudentBtn").addEventListener("click", openAdd);
$("closeModalBtn").addEventListener("click", closeModal);
$("cancelBtn").addEventListener("click", closeModal);
$("studentForm").addEventListener("submit", saveStudent);

$("studentModal").addEventListener("click", (e) => {
  if (e.target === $("studentModal")) closeModal();
});

boot();
