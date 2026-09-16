const $ = (id) => document.getElementById(id);

function formatRole(role) {
  return (role || "-").replaceAll("_", " ");
}

function routeFor(code) {
  if (code === "DASHBOARD") return "dashboard.html";
  if (code === "ADMINISTRASI_KEPALA") return "administrasi.html";
  if (code === "DATA_SISWA") return "siswa.html";
  if (code === "DATA_GURU") return "guru.html";
  return "#";
}

function todayCode() {
  const d = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "long"
  }).format(new Date()).toUpperCase();

  return ({
    SENIN: "SENIN",
    SELASA: "SELASA",
    RABU: "RABU",
    KAMIS: "KAMIS",
    JUMAT: "JUMAT",
    SABTU: "SABTU",
    MINGGU: "AHAD"
  })[d] || d;
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

async function loadProfile(api, user) {
  const rows = await api.db.select(
    "profiles",
    `select=id,full_name,role,is_active,teacher_id&id=eq.${encodeURIComponent(user.id)}&limit=1`
  );
  const p = rows?.[0];
  if (!p) throw new Error("Profil pengguna tidak ditemukan.");
  if (!p.is_active) throw new Error("Akun SIMANIS tidak aktif.");
  return p;
}

async function loadMenu(api) {
  const data = await api.db.rpc("get_my_modules", {});
  const menu = $("sidebarMenu");

  if (!Array.isArray(data) || !data.length) {
    menu.innerHTML = '<div class="placeholder">Menu belum tersedia.</div>';
    return;
  }

  menu.innerHTML = data.map(m => `
    <a href="${routeFor(m.code)}"
       class="nav-item ${m.code === "DASHBOARD" ? "active" : ""}">
      <span class="nav-dot"></span><span>${m.name}</span>
    </a>
  `).join("");

  menu.querySelectorAll('a[href="#"]').forEach(a => {
    a.addEventListener("click", e => {
      e.preventDefault();
      alert(`Modul "${a.textContent.trim()}" akan kita aktifkan pada tahap berikutnya.`);
    });
  });
}

async function loadStats(api, profile) {
  const [students, teachers, classes, subjects, schedules] = await Promise.all([
    api.db.count("students", "status=eq.AKTIF"),
    api.db.count("teachers", "is_active=eq.true"),
    api.db.count("classes", "is_active=eq.true"),
    api.db.count("subjects", "is_active=eq.true"),
    api.db.count("schedules", "")
  ]);

  $("statStudents").textContent = students;
  $("statTeachers").textContent = teachers;
  $("statClasses").textContent = classes;
  $("summarySubjects").textContent = `${subjects} mapel`;
  $("summarySchedules").textContent = `${schedules} slot`;
  $("summaryRole").textContent = formatRole(profile.role);
}

async function loadTodaySchedule(api) {
  const day = todayCode();
  $("todayName").textContent = day;

  if (day === "JUMAT") {
    $("todaySchedule").innerHTML =
      '<div class="placeholder">Tidak ada jadwal reguler pada hari Jumat.</div>';
    return;
  }

  const query = [
    "select=jam,start_time,end_time,kelas,mata_pelajaran,guru,urutan_jam",
    "tahun_pelajaran=eq.2026/2027",
    "semester=eq.GANJIL",
    `hari=eq.${day}`,
    "order=urutan_jam.asc",
    "limit=8"
  ].join("&");

  try {
    const data = await api.db.select("v_schedule_detail", query);

    if (!data?.length) {
      $("todaySchedule").innerHTML =
        '<div class="placeholder">Belum ada jadwal untuk hari ini.</div>';
      return;
    }

    $("todaySchedule").innerHTML = data.map(x => `
      <div class="schedule-item">
        <div class="time">${String(x.start_time).slice(0,5)}<br>${String(x.end_time).slice(0,5)}</div>
        <div>
          <strong>${x.mata_pelajaran} · ${x.kelas}</strong>
          <small>${x.guru}</small>
        </div>
      </div>
    `).join("");

  } catch (err) {
    $("todaySchedule").innerHTML =
      `<div class="placeholder">Jadwal gagal dimuat: ${err.message}</div>`;
  }
}

function loadAttendanceChart() {
  const box = $("attendanceChart");
  box.innerHTML = ["Sen","Sel","Rab","Kam","Jum","Sab","Ahd"].map(d => `
    <div class="bar-wrap">
      <div class="bar-value">0%</div>
      <div class="bar" style="height:8px"></div>
      <div class="bar-label">${d}</div>
    </div>
  `).join("");
}

(async function boot() {
  try {
    const api = await window.simanisReady;
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

    const profile = await loadProfile(api, user);

    $("sideUserName").textContent = profile.full_name || user.email || "Pengguna";
    $("sideUserRole").textContent = formatRole(profile.role);
    $("headerUser").textContent = profile.full_name || user.email || "Pengguna";
    $("welcomeTitle").textContent = `Selamat Datang, ${profile.full_name || "Pengguna"}!`;
    $("currentDate").textContent = localDateID();

    await Promise.all([
      loadMenu(api),
      loadStats(api, profile),
      loadTodaySchedule(api)
    ]);

    loadAttendanceChart();

    $("logoutBtn").addEventListener("click", async () => {
      await api.auth.signOut();
      location.replace("index.html");
    });

  } catch (err) {
    console.error(err);
    alert("SIMANIS gagal dimuat: " + (err.message || err));
  } finally {
    $("loading")?.classList.add("hidden");
  }
})();
