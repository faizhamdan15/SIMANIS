const { supabase } = window.simanis;

const $ = (id) => document.getElementById(id);

function formatRole(role) {
  return (role || "-").replaceAll("_", " ");
}

function localDateID() {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  }).format(new Date());
}

function todayCode() {
  const day = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta", weekday: "long"
  }).format(new Date()).toUpperCase();

  const map = {
    SENIN:"SENIN", SELASA:"SELASA", RABU:"RABU", KAMIS:"KAMIS",
    JUMAT:"JUMAT", SABTU:"SABTU", MINGGU:"AHAD"
  };
  return map[day] || day;
}

async function countTable(table, filters = []) {
  let q = supabase.from(table).select("*", { count: "exact", head: true });
  for (const [op, col, val] of filters) q = q[op](col, val);
  const { count, error } = await q;
  if (error) {
    console.warn("Count error", table, error.message);
    return 0;
  }
  return count || 0;
}

async function requireSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    location.href = "index.html";
    return null;
  }
  return session;
}

async function loadProfile(session) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,role,is_active,teacher_id")
    .eq("id", session.user.id)
    .single();

  if (error || !data) throw new Error("Profil pengguna tidak ditemukan.");
  if (!data.is_active) throw new Error("Akun SIMANIS tidak aktif.");
  return data;
}

async function loadMenu() {
  const { data, error } = await supabase.rpc("get_my_modules");
  if (error) throw error;
  const menu = $("sidebarMenu");
  menu.innerHTML = "";

  (data || []).forEach((m, idx) => {
    const a = document.createElement("a");
    a.href = m.code === "DASHBOARD" ? "dashboard.html" : "#";
    a.className = "nav-item" + (m.code === "DASHBOARD" ? " active" : "");
    a.dataset.route = m.route;
    a.innerHTML = `<span class="nav-dot"></span><span>${m.name}</span>`;
    if (m.code !== "DASHBOARD") {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        alert(`Modul "${m.name}" sudah terdaftar dan akan dibuat pada tahap berikutnya.`);
      });
    }
    menu.appendChild(a);
  });
}

async function loadStats(profile) {
  const [students, teachers, classes, subjects, schedules] = await Promise.all([
    countTable("students", [["eq","status","AKTIF"]]),
    countTable("teachers", [["eq","is_active",true]]),
    countTable("classes", [["eq","is_active",true]]),
    countTable("subjects", [["eq","is_active",true]]),
    countTable("schedules")
  ]);

  $("statStudents").textContent = students;
  $("statTeachers").textContent = teachers;
  $("statClasses").textContent = classes;
  $("summarySubjects").textContent = `${subjects} mapel`;
  $("summarySchedules").textContent = `${schedules} slot`;
  $("summaryRole").textContent = formatRole(profile.role);

  const today = new Date().toLocaleDateString("en-CA", { timeZone:"Asia/Jakarta" });
  const { data: attend, error } = await supabase
    .from("v_student_attendance_detail")
    .select("status")
    .eq("attendance_date", today);

  if (!error && attend && attend.length) {
    const present = attend.filter(x => ["HADIR","TERLAMBAT"].includes(x.status)).length;
    const pct = Math.round((present / attend.length) * 100);
    $("statAttendance").textContent = `${pct}%`;
    $("attendanceSub").textContent = `${present} dari ${attend.length} absensi tercatat`;
  }
}

async function loadTodaySchedule() {
  const day = todayCode();
  $("todayName").textContent = day;

  if (day === "JUMAT") {
    $("todaySchedule").innerHTML = `<div class="placeholder">Tidak ada jadwal reguler pada hari Jumat.</div>`;
    return;
  }

  const { data, error } = await supabase
    .from("v_schedule_detail")
    .select("jam,start_time,end_time,kelas,mata_pelajaran,guru")
    .eq("tahun_pelajaran","2026/2027")
    .eq("semester","GANJIL")
    .eq("hari",day)
    .order("urutan_jam")
    .limit(8);

  if (error || !data?.length) {
    $("todaySchedule").innerHTML = `<div class="placeholder">Jadwal hari ini belum dapat dimuat.</div>`;
    return;
  }

  $("todaySchedule").innerHTML = data.map(x => `
    <div class="schedule-item">
      <div class="time">${String(x.start_time).slice(0,5)}<br>${String(x.end_time).slice(0,5)}</div>
      <div><strong>${x.mata_pelajaran} · ${x.kelas}</strong><small>${x.guru}</small></div>
    </div>
  `).join("");
}

async function loadAttendanceChart() {
  const box = $("attendanceChart");
  const days = [];
  const now = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const iso = d.toLocaleDateString("en-CA", { timeZone:"Asia/Jakarta" });
    const label = new Intl.DateTimeFormat("id-ID",{weekday:"short",timeZone:"Asia/Jakarta"}).format(d);
    days.push({ iso, label });
  }

  const first = days[0].iso, last = days[days.length-1].iso;
  const { data, error } = await supabase
    .from("v_student_attendance_detail")
    .select("attendance_date,status")
    .gte("attendance_date", first)
    .lte("attendance_date", last);

  const byDate = {};
  for (const d of days) byDate[d.iso] = { total:0, present:0 };
  if (!error && data) {
    for (const row of data) {
      if (!byDate[row.attendance_date]) continue;
      byDate[row.attendance_date].total++;
      if (["HADIR","TERLAMBAT"].includes(row.status)) byDate[row.attendance_date].present++;
    }
  }

  box.innerHTML = days.map(d => {
    const x = byDate[d.iso];
    const pct = x.total ? Math.round((x.present/x.total)*100) : 0;
    const height = Math.max(8, Math.round(pct*1.75));
    return `<div class="bar-wrap"><div class="bar-value">${pct}%</div><div class="bar" style="height:${height}px"></div><div class="bar-label">${d.label}</div></div>`;
  }).join("");
}

async function boot() {
  try {
    const session = await requireSession();
    if (!session) return;

    const profile = await loadProfile(session);
    $("sideUserName").textContent = profile.full_name || session.user.email;
    $("sideUserRole").textContent = formatRole(profile.role);
    $("headerUser").textContent = profile.full_name || "Pengguna";
    $("welcomeTitle").textContent = `Selamat Datang, ${profile.full_name || "Pengguna"}!`;
    $("currentDate").textContent = localDateID();

    await Promise.all([
      loadMenu(),
      loadStats(profile),
      loadTodaySchedule(),
      loadAttendanceChart()
    ]);
  } catch (err) {
    console.error(err);
    alert(err.message || "Gagal memuat SIMANIS.");
  } finally {
    $("loading").classList.add("hidden");
  }
}

$("logoutBtn").addEventListener("click", async () => {
  await supabase.auth.signOut();
  location.href = "index.html";
});

boot();
