const $=id=>document.getElementById(id);
let api,profile,summary={},teacherPersonal={teacher_linked:false,stats:{},contexts:[],today_schedule:[],attendance_tasks:[],grade_tasks:[],positions:[]},myModules=[];

const ROUTES={DASHBOARD:"dashboard.html",ADMINISTRASI_KEPALA:"administrasi.html",DATA_SISWA:"siswa.html",DATA_GURU:"guru.html",KELAS:"kelas.html",MATA_PELAJARAN:"mapel.html",JADWAL:"jadwal.html",ABSENSI_GURU:"absensi-guru.html",ABSENSI_SISWA:"absensi-siswa.html",NILAI:"nilai.html",PRESTASI:"prestasi.html",BERITA:"berita.html",PENGUMUMAN:"pengumuman.html",AGENDA:"agenda.html",KEUANGAN:"keuangan.html",PORTAL_WALI:"wali-admin.html",PENGATURAN:"pengaturan.html",PKM_KURIKULUM:"unit-kerja.html?unit=PKM_KURIKULUM",PKM_KESISWAAN:"unit-kerja.html?unit=PKM_KESISWAAN",PKM_BENDAHARA_SARPRAS:"unit-kerja.html?unit=PKM_BENDAHARA_SARPRAS",PKM_HUMASY:"unit-kerja.html?unit=PKM_HUMASY",KEPALA_TU:"unit-kerja.html?unit=KEPALA_TU",KALAB_IPA:"unit-kerja.html?unit=KALAB_IPA",KALAB_BISNIS:"unit-kerja.html?unit=KALAB_BISNIS"};
const ICONS={
  DASHBOARD:"layout-dashboard",
  ADMINISTRASI_KEPALA:"folder-kanban",
  DATA_SISWA:"users",
  DATA_GURU:"teacher",
  KELAS:"school",
  MATA_PELAJARAN:"book-open",
  JADWAL:"calendar-days",
  ABSENSI_GURU:"clipboard-check",
  ABSENSI_SISWA:"badge-check",
  NILAI:"file-pen",
  PRESTASI:"trophy",
  BERITA:"newspaper",
  PENGUMUMAN:"megaphone",
  AGENDA:"calendar-range",
  KEUANGAN:"wallet",
  PORTAL_WALI:"users-round",
  PENGATURAN:"settings",
  PKM_KURIKULUM:"book-open",
  PKM_KESISWAAN:"users-round",
  PKM_BENDAHARA_SARPRAS:"wallet",
  PKM_HUMASY:"megaphone",
  KEPALA_TU:"folder-kanban",
  KALAB_IPA:"flask",
  KALAB_BISNIS:"briefcase"
};

const ICON_PATHS={
  "users":`<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
  "teacher":`<path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/><path d="M22 10v6"/>`,
  "school":`<path d="M3 21h18"/><path d="M6 21V10l6-5 6 5v11"/><path d="M9 21v-6h6v6"/><path d="M9 11h.01M15 11h.01"/>`,
  "check-square":`<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>`,
  "calendar":`<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>`,
  "books":`<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/><path d="M8 7h8M8 11h8"/>`,
  "layout-dashboard":`<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>`,
  "folder-kanban":`<path d="M3 5h6l2 2h10v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Z"/><path d="M8 11v6M12 13v4M16 10v7"/>`,
  "book-open":`<path d="M2 4h6a4 4 0 0 1 4 4v12a4 4 0 0 0-4-4H2Z"/><path d="M22 4h-6a4 4 0 0 0-4 4v12a4 4 0 0 1 4-4h6Z"/>`,
  "calendar-days":`<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/><path d="M8 15h.01M12 15h.01M16 15h.01M8 18h.01M12 18h.01"/>`,
  "clipboard-check":`<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2"/><path d="m9 13 2 2 4-4"/>`,
  "badge-check":`<path d="M12 3 14.2 5l3-.3.7 2.9 2.6 1.5-1.2 2.8 1.2 2.8-2.6 1.5-.7 2.9-3-.3L12 21l-2.2-2.2-3 .3-.7-2.9-2.6-1.5 1.2-2.8-1.2-2.8 2.6-1.5.7-2.9 3 .3L12 3Z"/><path d="m9 12 2 2 4-4"/>`,
  "file-pen":`<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="m9 15 5-5 2 2-5 5-3 1 1-3Z"/>`,
  "trophy":`<path d="M8 21h8M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M7 6H4a2 2 0 0 0 2 4h1M17 6h3a2 2 0 0 1-2 4h-1"/>`,
  "newspaper":`<path d="M4 22h16a2 2 0 0 0 2-2V4H8v16a2 2 0 0 1-4 0V6H2v14a2 2 0 0 0 2 2Z"/><path d="M12 8h6M12 12h6M12 16h6"/>`,
  "megaphone":`<path d="m3 11 18-5v12L3 13v-2Z"/><path d="M11.6 15.4 13 21H8l-1.5-7"/>`,
  "calendar-range":`<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18M7 15h4M13 18h4"/>`,
  "wallet":`<path d="M20 7V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v12H5a3 3 0 0 1-3-3V6"/><path d="M16 13h4"/>`,
  "users-round":`<path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="4"/><path d="M22 21a8 8 0 0 0-6-7.75"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
  "settings":`<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06-2.83 2.83-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21h-4v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06-2.83-2.83.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3v-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06 2.83-2.83.06.06A1.65 1.65 0 0 0 8.92 4a1.65 1.65 0 0 0 1-1.51V2h4v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06 2.83 2.83-.06.06A1.65 1.65 0 0 0 19.4 9c.12.38.18.78.18 1.18v1.64c0 .4-.06.8-.18 1.18Z"/>`,
  "clock":`<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>`,
  "map-pin":`<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2"/>`,
  "pin":`<path d="m12 17 1 4"/><path d="M5 3h14l-3 7 3 3H5l3-3-3-7Z"/>`,
  "bell":`<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>`,
  "star":`<path d="m12 2 3 6 6.5.9-4.7 4.6 1.1 6.5-5.9-3.1L6.1 20l1.1-6.5L2.5 8.9 9 8l3-6Z"/>`,
  "flask":`<path d="M9 3h6"/><path d="M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3"/><path d="M8 15h8"/>`,
  "briefcase":`<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"/>`,
  "check-circle":`<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>`
};
function icon(name,cls="sim-icon"){
  const p=ICON_PATHS[name]||ICON_PATHS["layout-dashboard"];
  return `<span class="${cls}"><svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg></span>`;
}
function renderStaticIcons(){
  document.querySelectorAll("[data-icon]").forEach(el=>{el.innerHTML=icon(el.dataset.icon,"sim-icon")});
}

function esc(s){return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}
function roleLabel(r){return String(r||"-").replaceAll("_"," ")}
function money(n){return new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(n||0))}
function fmtDateTime(v,allDay=false){
 if(!v)return"-";const d=new Date(v);
 return new Intl.DateTimeFormat("id-ID",allDay?{day:"2-digit",month:"short"}:{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(d);
}
function timeShort(v){return v?String(v).slice(0,5):"-"}
function localDateID(){return new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date())}
function coverUrl(path){
 if(!path)return null;
 const cfg=window.SIMANIS_CONFIG;
 return `${cfg.SUPABASE_URL.replace(/\/$/,"")}/storage/v1/object/public/berita-cover/${path.split("/").map(encodeURIComponent).join("/")}`;
}
async function loadProfile(user){
 const r=await api.db.select("profiles",`select=id,full_name,role,is_active&id=eq.${encodeURIComponent(user.id)}&limit=1`);
 if(!r?.[0])throw new Error("Profil pengguna tidak ditemukan.");
 if(!r[0].is_active)throw new Error("Akun tidak aktif.");
 return r[0];
}
async function loadMenu(){
 myModules=await api.db.rpc("get_my_modules",{})||[];
 $("sidebarMenu").innerHTML=myModules.map(x=>`<a href="${ROUTES[x.code]||"#"}" class="nav-item ${x.code==="DASHBOARD"?"active":""}"><span class="nav-dot"></span><span>${esc(x.name)}</span></a>`).join("");
}
function greeting(){
 const h=Number(new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Jakarta",hour:"2-digit",hour12:false}).format(new Date()));
 return h<11?"Selamat Pagi":h<15?"Selamat Siang":h<18?"Selamat Sore":"Selamat Malam";
}
function renderQuick(){
 const preferred=["DATA_SISWA","JADWAL","ABSENSI_GURU","ABSENSI_SISWA","NILAI","AGENDA","KEUANGAN","PRESTASI","PENGUMUMAN","PORTAL_WALI","PENGATURAN"];
 const list=preferred.map(code=>myModules.find(m=>m.code===code)).filter(Boolean).slice(0,8);
 $("quickGrid").innerHTML=list.length?list.map(m=>`<a class="quick" href="${ROUTES[m.code]||"#"}"><div class="quick-icon">${icon(ICONS[m.code]||"layout-dashboard")}</div><b>${esc(m.name)}</b></a>`).join(""):'<div class="empty-v2">Tidak ada akses cepat.</div>';
}
function renderStats(){
 const s=summary.stats||{},a=summary.student_attendance||{};
 $("statStudents").textContent=Number(s.students||0).toLocaleString("id-ID");
 $("statTeachers").textContent=Number(s.teachers||0).toLocaleString("id-ID");
 $("statClasses").textContent=Number(s.classes||0).toLocaleString("id-ID");
 $("statSchedules").textContent=Number(s.schedule_slots||0).toLocaleString("id-ID");
 $("statAttendance").textContent=Number(a.recorded||0)>0?`${Number(a.percent||0).toLocaleString("id-ID")}%`:"—";
 $("attendanceSub").textContent=Number(a.recorded||0)>0?`${a.present} dari ${a.recorded} data absensi hadir/terlambat`:"Belum ada absensi siswa hari ini";
 $("statAgenda").textContent=(summary.agenda||[]).length;
}
function renderChart(){
 const data=summary.attendance_chart||[];
 $("attendanceChart").innerHTML=data.length?data.map(x=>`<div class="bar-col"><div class="bar-track"><div class="bar-fill" style="height:${Math.max(2,Number(x.percent||0))}%"></div></div><b>${esc((x.day_name||"").slice(0,3))}</b><small>${Number(x.recorded||0)>0?`${x.percent}%`:"-"}</small></div>`).join(""):'<div class="empty-v2">Belum ada data kehadiran.</div>';
}
function renderSchedule(){
 const data=summary.today_schedule||[];
 $("scheduleTitle").textContent=summary.teacher_linked?"Jadwal Mengajar Saya":"Jadwal Hari Ini";
 if(summary.today_name==="JUMAT"){$("todaySchedule").innerHTML='<div class="empty-v2">Jumat tidak memiliki jadwal pembelajaran reguler.</div>';return}
 $("todaySchedule").innerHTML=data.length?data.map(x=>`<div class="item"><div class="item-icon">${icon("clock")}</div><div class="item-time">${esc(x.jam||"")}<br>${timeShort(x.start_time)}–${timeShort(x.end_time)}</div><div class="item-body"><b>${esc(x.mata_pelajaran)}</b><p>${esc(x.kelas)}${summary.teacher_linked?"":` · ${esc(x.guru)}`}</p></div></div>`).join(""):'<div class="empty-v2">Tidak ada jadwal hari ini.</div>';
}
function renderAgenda(){
 const data=summary.agenda||[];
 $("agendaList").innerHTML=data.length?data.map(x=>`<div class="item"><div class="item-icon">${icon(x.is_important?"star":"calendar-range")}</div><div class="item-time">${x.all_day?"Seharian":fmtDateTime(x.start_at,false)}</div><div class="item-body"><b>${esc(x.title)}</b><p>${esc(x.category)}${x.location?` · ${esc(x.location)}`:""}</p></div></div>`).join(""):'<div class="empty-v2">Tidak ada agenda terdekat.</div>';
}
function priorityClass(p){return p==="MENDESAK"?"urgent":p==="TINGGI"?"high":""}
function renderAnnouncements(){
 const data=summary.announcements||[];
 $("announcementList").innerHTML=data.length?data.map(x=>`<div class="item notice ${priorityClass(x.priority)}"><div class="pinned">${icon(x.is_pinned?"pin":"bell")}</div><div class="item-body"><b>${esc(x.title)}</b><p><span class="badge">${esc(x.category)}</span> · ${esc(x.priority)}</p></div></div>`).join(""):'<div class="empty-v2">Tidak ada pengumuman aktif.</div>';
}
function renderFinance(){
 const f=summary.finance;if(!f){$("financeSection").style.display="none";return}
 $("financeSection").style.display="";
 const bill=Number(f.total_bill||0),paid=Number(f.total_paid||0),rem=Number(f.remaining||0),pct=bill>0?Math.min(100,Math.round(paid/bill*100)):0;
 $("financeBill").textContent=money(bill);$("financePaid").textContent=money(paid);$("financeRemaining").textContent=money(rem);$("financeProgress").style.width=`${pct}%`;
 $("financeText").textContent=`Progress ${pct}% · ${Number(f.paid_off||0)} dari ${Number(f.student_count||0)} siswa lunas`;
}
function renderAchievements(){
 const data=summary.achievements||[];
 $("achievementList").innerHTML=data.length?data.map(x=>`<article class="achievement-item"><b>${esc(x.title)}</b><p>${esc(x.competition_name)} · ${esc(x.level)}</p><p class="achievement-medal">${esc(x.achievement)}</p>${x.participant_names?`<p>${esc(x.participant_names)}</p>`:""}</article>`).join(""):'<div class="empty-v2">Belum ada prestasi terbaru untuk ditampilkan.</div>';
}
function renderNews(){
 const data=summary.news||[];
 $("newsGrid").innerHTML=data.length?data.map(x=>{const url=coverUrl(x.cover_path);return`<article class="news-v2"><div class="news-thumb" ${url?`style="background-image:url('${url.replaceAll("'","%27")}')"`:""}>${url?"":esc(x.category||"BERITA")}</div><div class="news-info"><span>${esc(x.category||"BERITA")}</span><b>${esc(x.title)}</b><p>${esc(x.excerpt||"")}</p></div></article>`}).join(""):'<div class="empty-v2">Belum ada berita terbit.</div>';
}

function shortNumber(n){return Number(n||0).toLocaleString("id-ID")}
function nowJakartaMinutes(){
 const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Jakarta",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(new Date());
 const h=Number(parts.find(x=>x.type==="hour")?.value||0),m=Number(parts.find(x=>x.type==="minute")?.value||0);
 return h*60+m;
}
function timeMinutes(v){
 if(!v)return null;const [h,m]=String(v).slice(0,5).split(":").map(Number);return h*60+m;
}
function scheduleMomentClass(x,index,data){
 const now=nowJakartaMinutes(),start=timeMinutes(x.start_time),end=timeMinutes(x.end_time);
 if(start!==null&&end!==null&&now>=start&&now<=end)return"now-class";
 const upcoming=data.filter(y=>timeMinutes(y.start_time)!==null&&timeMinutes(y.start_time)>now).sort((a,b)=>timeMinutes(a.start_time)-timeMinutes(b.start_time));
 if(upcoming[0]?.schedule_id===x.schedule_id)return"next-class";
 return"";
}
function renderTeacherPersonal(){
 const box=$("teacherWorkspace");
 if(!teacherPersonal?.teacher_linked){box.classList.remove("show");return}
 box.classList.add("show");
 $("welcomeText").textContent="Jadwal mengajar, tugas kelas, nilai, agenda, dan jobdesk Anda hari ini.";
 const s=teacherPersonal.stats||{};
 $("teacherTodaySlots").textContent=shortNumber(s.today_slots);
 $("teacherWeeklySlots").textContent=shortNumber(s.weekly_slots);
 $("teacherContexts").textContent=shortNumber(s.teaching_contexts);
 $("teacherStudents").textContent=shortNumber(s.student_reach);
 $("teacherAttendancePending").textContent=shortNumber(s.attendance_pending);
 $("teacherGradePending").textContent=teacherPersonal.grading_available?shortNumber(s.grade_pending):"—";

 const attendance=teacherPersonal.attendance_tasks||[];
 $("teacherAttendanceTasks").innerHTML=attendance.length?attendance.map(t=>{
   const complete=!!t.is_complete;
   return `<div class="task-row"><div class="task-icon">${icon(complete?"check-circle":"clipboard-check")}</div><div><h4>${esc(t.class_name)}</h4><p>${Number(t.recorded_students||0)} / ${Number(t.expected_students||0)} siswa sudah tercatat${complete?"":" · "+Number(t.missing_students||0)+" belum tercatat"}</p></div><span class="task-state ${complete?"done":"pending"}">${complete?"SELESAI":"PERLU DIISI"}</span></div>`
 }).join(""):'<div class="empty-v2">Tidak ada kelas yang perlu diabsen hari ini.</div>';

 const grades=teacherPersonal.grade_tasks||[];
 if(!teacherPersonal.grading_available){
   $("teacherGradeTasks").innerHTML='<div class="empty-v2">Modul Nilai belum menyediakan data kelengkapan untuk dashboard.</div>';
 }else{
   $("teacherGradeTasks").innerHTML=grades.length?grades.slice(0,6).map(g=>`<div class="task-row"><div class="task-icon">${icon("file-pen")}</div><div><h4>${esc(g.title)} · ${esc(g.class_name)}</h4><p>${esc(g.subject_name)} · ${Number(g.entered_scores||0)} / ${Number(g.expected_students||0)} nilai terisi</p></div><span class="task-state danger">${Number(g.missing_scores||0)} KOSONG</span></div>`).join(""):'<div class="empty-v2">Semua nilai asesmen yang terdeteksi sudah lengkap.</div>';
 }

 const contexts=teacherPersonal.contexts||[];
 $("teacherContextGrid").innerHTML=contexts.length?contexts.map(c=>`<article class="teacher-context"><div class="teacher-context-head"><div><h4>${esc(c.class_name)}</h4><p>${esc(c.subject_name)}</p></div><span class="badge">${esc(c.subject_code||"MAPEL")}</span></div><div class="meta"><span>${Number(c.student_count||0)} siswa</span><span>${Number(c.weekly_slots||0)} slot/minggu</span></div></article>`).join(""):'<div class="empty-v2">Belum ada jadwal mengajar pada semester aktif.</div>';

 const positions=teacherPersonal.positions||[];
 $("teacherJobdeskSection").style.display=positions.length?"":"none";
 $("teacherJobdeskGrid").innerHTML=positions.map(p=>`<a class="jobdesk-card-dashboard" href="${ROUTES[p.module_code]||`unit-kerja.html?unit=${encodeURIComponent(p.module_code||"")}`}"><span class="job-icon">${icon(ICONS[p.module_code]||"briefcase")}</span><div><b>${esc(p.position_name)}</b><p>Buka workspace dan tugas unit kerja.</p></div></a>`).join("");
}
function renderPersonalSchedule(){
 if(!teacherPersonal?.teacher_linked)return;
 const data=teacherPersonal.today_schedule||[];
 $("scheduleTitle").textContent="Jadwal Mengajar Saya";
 if(teacherPersonal.today_name==="JUMAT"){$("todaySchedule").innerHTML='<div class="empty-v2">Jumat tidak memiliki jadwal pembelajaran reguler.</div>';return}
 $("todaySchedule").innerHTML=data.length?data.map((x,i)=>`<div class="item ${scheduleMomentClass(x,i,data)}"><div class="item-icon">${icon("clock")}</div><div class="item-time">${esc(x.slot_code||"")}<br>${timeShort(x.start_time)}–${timeShort(x.end_time)}</div><div class="item-body"><b>${esc(x.subject_name)}</b><p>${esc(x.class_name)} · Absensi ${Number(x.attendance_recorded||0)}/${Number(x.expected_students||0)}</p></div><span class="task-state ${x.attendance_complete?"done":"pending"}">${x.attendance_complete?"ABSEN OK":"CEK ABSEN"}</span></div>`).join(""):'<div class="empty-v2">Tidak ada jadwal mengajar hari ini.</div>';
}

function render(){
 $("welcomeTitle").textContent=`${greeting()}, ${profile.full_name?.split(" ")[0]||"Pengguna"}!`;
 $("roleChip").textContent=roleLabel(profile.role);
 const ay=summary.academic_year?.name||"-",sm=summary.semester?.name||"-";$("periodPill").textContent=`Tahun Pelajaran ${ay} · ${sm}`;
 renderStaticIcons();renderStats();renderQuick();renderChart();renderSchedule();renderAgenda();renderAnnouncements();renderFinance();renderAchievements();renderNews();renderTeacherPersonal();renderPersonalSchedule();renderStaticIcons();
}

(async()=>{
 try{
  api=await window.simanisReady;
  const user=await api.auth.getUser();if(!user){location.href="index.html";return}
  profile=await loadProfile(user);
  $("sideUserName").textContent=profile.full_name||"Pengguna";$("sideUserRole").textContent=roleLabel(profile.role);$("headerUser").textContent=profile.full_name||"Pengguna";$("currentDate").textContent=localDateID();
  await loadMenu();
  const [general,personal]=await Promise.all([
    api.db.rpc("dashboard_get_summary",{}),
    api.db.rpc("dashboard_get_teacher_personal",{}).catch(err=>{
      console.warn("Dashboard personal guru belum tersedia:",err);
      return {teacher_linked:false,stats:{},contexts:[],today_schedule:[],attendance_tasks:[],grade_tasks:[],positions:[]};
    })
  ]);
  summary=general||{};
  teacherPersonal=personal||{teacher_linked:false,stats:{},contexts:[],today_schedule:[],attendance_tasks:[],grade_tasks:[],positions:[]};
  render();
  $("logoutBtn").onclick=async()=>{await api.auth.signOut();location.href="index.html"};
 }catch(err){console.error(err);alert("Dashboard gagal dimuat: "+err.message)}
 finally{$("loading").style.display="none"}
})();
