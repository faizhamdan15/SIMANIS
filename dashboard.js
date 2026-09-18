const $=id=>document.getElementById(id);
let api,profile,summary={},myModules=[];

const ROUTES={DASHBOARD:"dashboard.html",ADMINISTRASI_KEPALA:"administrasi.html",DATA_SISWA:"siswa.html",DATA_GURU:"guru.html",KELAS:"kelas.html",MATA_PELAJARAN:"mapel.html",JADWAL:"jadwal.html",ABSENSI_GURU:"absensi-guru.html",ABSENSI_SISWA:"absensi-siswa.html",NILAI:"nilai.html",PRESTASI:"prestasi.html",BERITA:"berita.html",PENGUMUMAN:"pengumuman.html",AGENDA:"agenda.html",KEUANGAN:"keuangan.html",PORTAL_WALI:"wali-admin.html",PENGATURAN:"pengaturan.html"};
const ICONS={ADMINISTRASI_KEPALA:"📁",DATA_SISWA:"👥",DATA_GURU:"👨‍🏫",KELAS:"🏫",MATA_PELAJARAN:"📘",JADWAL:"🗓️",ABSENSI_GURU:"✅",ABSENSI_SISWA:"🧑‍🎓",NILAI:"📝",PRESTASI:"🏆",BERITA:"📰",PENGUMUMAN:"📢",AGENDA:"📅",KEUANGAN:"💰",PORTAL_WALI:"👪",PENGATURAN:"⚙️"};

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
 $("quickGrid").innerHTML=list.length?list.map(m=>`<a class="quick" href="${ROUTES[m.code]||"#"}"><span>${ICONS[m.code]||"•"}</span><b>${esc(m.name)}</b></a>`).join(""):'<div class="empty-v2">Tidak ada akses cepat.</div>';
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
 $("todaySchedule").innerHTML=data.length?data.map(x=>`<div class="item"><div class="item-time">${esc(x.jam||"")}<br>${timeShort(x.start_time)}–${timeShort(x.end_time)}</div><div class="item-body"><b>${esc(x.mata_pelajaran)}</b><p>${esc(x.kelas)}${summary.teacher_linked?"":` · ${esc(x.guru)}`}</p></div></div>`).join(""):'<div class="empty-v2">Tidak ada jadwal hari ini.</div>';
}
function renderAgenda(){
 const data=summary.agenda||[];
 $("agendaList").innerHTML=data.length?data.map(x=>`<div class="item"><div class="item-time">${x.all_day?"Seharian":fmtDateTime(x.start_at,false)}</div><div class="item-body"><b>${x.is_important?"⭐ ":""}${esc(x.title)}</b><p>${esc(x.category)}${x.location?` · ${esc(x.location)}`:""}</p></div></div>`).join(""):'<div class="empty-v2">Tidak ada agenda terdekat.</div>';
}
function priorityClass(p){return p==="MENDESAK"?"urgent":p==="TINGGI"?"high":""}
function renderAnnouncements(){
 const data=summary.announcements||[];
 $("announcementList").innerHTML=data.length?data.map(x=>`<div class="item notice ${priorityClass(x.priority)}"><div class="pinned">${x.is_pinned?"📌":"📢"}</div><div class="item-body"><b>${esc(x.title)}</b><p><span class="badge">${esc(x.category)}</span> · ${esc(x.priority)}</p></div></div>`).join(""):'<div class="empty-v2">Tidak ada pengumuman aktif.</div>';
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
function render(){
 $("welcomeTitle").textContent=`${greeting()}, ${profile.full_name?.split(" ")[0]||"Pengguna"}!`;
 $("roleChip").textContent=roleLabel(profile.role);
 const ay=summary.academic_year?.name||"-",sm=summary.semester?.name||"-";$("periodPill").textContent=`Tahun Pelajaran ${ay} · ${sm}`;
 renderStats();renderQuick();renderChart();renderSchedule();renderAgenda();renderAnnouncements();renderFinance();renderAchievements();renderNews();
}

(async()=>{
 try{
  api=await window.simanisReady;
  const user=await api.auth.getUser();if(!user){location.href="index.html";return}
  profile=await loadProfile(user);
  $("sideUserName").textContent=profile.full_name||"Pengguna";$("sideUserRole").textContent=roleLabel(profile.role);$("headerUser").textContent=profile.full_name||"Pengguna";$("currentDate").textContent=localDateID();
  await loadMenu();
  summary=await api.db.rpc("dashboard_get_summary",{})||{};
  render();
  $("logoutBtn").onclick=async()=>{await api.auth.signOut();location.href="index.html"};
 }catch(err){console.error(err);alert("Dashboard gagal dimuat: "+err.message)}
 finally{$("loading").style.display="none"}
})();
