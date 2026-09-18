const $ = id => document.getElementById(id);
let api, profile;
let classes = [];
let rows = [];
let selectedClass = null;
let personalSchedule = [];
let todayProgress = new Map();
let isTeacherMode = false;

function esc(s){return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}
function formatRole(r){return (r||"-").replaceAll("_"," ")}
function localDateID(){return new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date())}
function localISODate(){const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const o={};p.forEach(x=>o[x.type]=x.value);return `${o.year}-${o.month}-${o.day}`}
function dayNameFromISO(iso){if(!iso)return"";const d=new Date(`${iso}T12:00:00+07:00`);return new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",weekday:"long"}).format(d).toUpperCase()}
function nowMinutes(){const p=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Jakarta",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(new Date());return Number(p.find(x=>x.type==="hour")?.value||0)*60+Number(p.find(x=>x.type==="minute")?.value||0)}
function timeMinutes(v){if(!v)return-1;const [h,m]=String(v).slice(0,5).split(":").map(Number);return h*60+m}
function routeFor(code){return {DASHBOARD:"dashboard.html",ADMINISTRASI_KEPALA:"administrasi.html",DATA_SISWA:"siswa.html",DATA_GURU:"guru.html",KELAS:"kelas.html",MATA_PELAJARAN:"mapel.html",JADWAL:"jadwal.html",ABSENSI_GURU:"absensi-guru.html",ABSENSI_SISWA:"absensi-siswa.html",NILAI:"nilai.html",PRESTASI:"prestasi.html",BERITA:"berita.html",PENGUMUMAN:"pengumuman.html",AGENDA:"agenda.html",KEUANGAN:"keuangan.html",PORTAL_WALI:"wali-admin.html",PENGATURAN:"pengaturan.html",PKM_KURIKULUM:"unit-kerja.html?unit=PKM_KURIKULUM",PKM_KESISWAAN:"unit-kerja.html?unit=PKM_KESISWAAN",PKM_BENDAHARA_SARPRAS:"unit-kerja.html?unit=PKM_BENDAHARA_SARPRAS",PKM_HUMASY:"unit-kerja.html?unit=PKM_HUMASY",KEPALA_TU:"unit-kerja.html?unit=KEPALA_TU",KALAB_IPA:"unit-kerja.html?unit=KALAB_IPA",KALAB_BISNIS:"unit-kerja.html?unit=KALAB_BISNIS"}[code]||"#"}
function statusLabel(s){return {BELUM_DIABSEN:"Belum Diabsen",HADIR:"Hadir",TERLAMBAT:"Terlambat",IZIN:"Izin",SAKIT:"Sakit",ALFA:"Alfa"}[s]||s}
function statusOptions(current){return ["BELUM_DIABSEN","HADIR","TERLAMBAT","IZIN","SAKIT","ALFA"].map(s=>`<option value="${s}" ${s===current?"selected":""}>${statusLabel(s)}</option>`).join("")}

async function loadProfile(user){const r=await api.db.select("profiles",`select=id,full_name,role,is_active,teacher_id&id=eq.${encodeURIComponent(user.id)}&limit=1`);if(!r?.[0])throw new Error("Profil pengguna tidak ditemukan.");if(!r[0].is_active)throw new Error("Akun SIMANIS tidak aktif.");return r[0]}
async function loadMenu(){const m=await api.db.rpc("get_my_modules",{});$("sidebarMenu").innerHTML=(m||[]).map(x=>`<a href="${routeFor(x.code)}" class="nav-item ${x.code==="ABSENSI_SISWA"?"active":""}"><span class="nav-dot"></span><span>${esc(x.name)}</span></a>`).join("");document.querySelectorAll('.nav-item[href="#"]').forEach(a=>a.addEventListener("click",e=>{e.preventDefault();alert(`Modul "${a.textContent.trim()}" akan diaktifkan bertahap.`)}))}

function applyTeacherUI(){
  isTeacherMode=["GURU","WALI_KELAS"].includes(String(profile.role||"").toUpperCase());
  if(!isTeacherMode)return;
  $("pageTitle").textContent="Absensi Kelas Saya";
  $("pageSubtitle").textContent="Isi kehadiran siswa dari kelas yang Anda ajar atau walikan.";
  $("topbarSubtitle").textContent="Sistem Informasi MA Nurul Islam · Absensi Kelas Saya";
  $("todayTeacherPanel").classList.add("show");
  $("teacherHint").classList.add("show");
}

async function loadPersonalSchedule(){
  if(!isTeacherMode){personalSchedule=[];return}
  try{personalSchedule=await api.db.rpc("get_my_scoped_schedule",{})||[]}
  catch(err){console.warn("Jadwal personal tidak tersedia:",err);personalSchedule=[]}
}

function scheduleForDate(){
  const day=dayNameFromISO($("attendanceDate").value);
  return personalSchedule.filter(x=>x.day_of_week===day);
}
function scheduleGroups(){
  const map=new Map();
  scheduleForDate().forEach(x=>{
    if(!map.has(x.class_id))map.set(x.class_id,{class_id:x.class_id,class_name:x.class_name,items:[]});
    map.get(x.class_id).items.push(x);
  });
  return [...map.values()].map(g=>({...g,items:g.items.sort((a,b)=>Number(a.sequence_no||0)-Number(b.sequence_no||0))}));
}
function classMomentState(group){
  if($("attendanceDate").value!==localISODate())return"";
  const now=nowMinutes();
  const current=group.items.find(x=>now>=timeMinutes(x.start_time)&&now<=timeMinutes(x.end_time));
  if(current)return"current-class";
  const upcoming=scheduleForDate().filter(x=>timeMinutes(x.start_time)>now).sort((a,b)=>timeMinutes(a.start_time)-timeMinutes(b.start_time));
  if(upcoming[0]&&upcoming[0].class_id===group.class_id)return"next-class";
  return"";
}
async function refreshTodayProgress(){
  todayProgress=new Map();
  if(!isTeacherMode)return;
  const groups=scheduleGroups();
  await Promise.all(groups.map(async g=>{
    const cls=classes.find(c=>c.class_id===g.class_id);
    if(!cls)return;
    try{
      const data=await api.db.rpc("get_class_attendance_by_date",{p_class_id:g.class_id,p_date:$("attendanceDate").value})||[];
      const marked=data.filter(r=>r.attendance_status&&r.attendance_status!=="BELUM_DIABSEN").length;
      todayProgress.set(g.class_id,{total:data.length,marked,complete:data.length>0&&marked>=data.length});
    }catch(err){
      console.warn("Progress absensi gagal dimuat:",g.class_name,err);
      todayProgress.set(g.class_id,{total:Number(cls.student_count||0),marked:0,complete:false});
    }
  }));
}
function renderTodayClasses(){
  if(!isTeacherMode)return;
  const groups=scheduleGroups();
  const day=dayNameFromISO($("attendanceDate").value);
  $("todayTeacherBadge").textContent=$("attendanceDate").value===localISODate()?"HARI INI":day||"JADWAL";
  if(!groups.length){
    $("todayTeacherText").textContent=`Tidak ada jadwal mengajar pada ${day||"tanggal ini"}. Anda tetap dapat memilih kelas lain yang menjadi hak akses Anda.`;
    $("todayClassList").innerHTML='<div style="font-size:9px;opacity:.85">Tidak ada kelas terjadwal.</div>';
    return;
  }
  const unfinished=groups.filter(g=>!todayProgress.get(g.class_id)?.complete).length;
  $("todayTeacherText").textContent=`${groups.length} kelas terjadwal · ${unfinished} kelas masih perlu diperiksa.`;
  $("todayClassList").innerHTML=groups.map(g=>{
    const p=todayProgress.get(g.class_id)||{total:0,marked:0,complete:false};
    const pct=p.total?Math.round(p.marked/p.total*100):0;
    const times=g.items.map(x=>`${x.slot_code||x.sequence_no||""} ${String(x.start_time||"").slice(0,5)}–${String(x.end_time||"").slice(0,5)}`).join(" · ");
    const mapel=[...new Set(g.items.map(x=>x.subject_name).filter(Boolean))].join(", ");
    const active=selectedClass?.class_id===g.class_id?"active":"";
    const moment=classMomentState(g);
    return `<button type="button" class="today-class ${active} ${p.complete?"done":""} ${moment}" data-today-class="${g.class_id}">
      <b>${esc(g.class_name)}</b>
      <small>${esc(mapel||"Mata pelajaran")} · ${esc(times)}</small>
      <div class="progress"><i style="width:${pct}%"></i></div>
      <div class="foot"><span>${p.marked}/${p.total} tercatat</span><span>${p.complete?"SELESAI":moment==="current-class"?"SEDANG MENGAJAR":moment==="next-class"?"BERIKUTNYA":"PERLU DIISI"}</span></div>
    </button>`
  }).join("");
  document.querySelectorAll("[data-today-class]").forEach(b=>b.onclick=()=>{
    $("classFilter").value=b.dataset.todayClass;
    chooseClass(b.dataset.todayClass);
  });
}

async function loadClasses(){
  classes=await api.db.rpc("get_my_attendance_classes",{})||[];
  $("classFilter").innerHTML='<option value="">Pilih Kelas...</option>'+classes.map(c=>`<option value="${c.class_id}">${esc(c.class_name)} · ${c.student_count} siswa${c.can_manage?"":" · lihat saja"}</option>`).join("");
  await refreshTodayProgress();

  let initialId="";
  if(isTeacherMode){
    const groups=scheduleGroups();
    const unfinished=groups.find(g=>!todayProgress.get(g.class_id)?.complete&&classes.some(c=>c.class_id===g.class_id&&c.can_manage));
    const firstToday=groups.find(g=>classes.some(c=>c.class_id===g.class_id));
    initialId=unfinished?.class_id||firstToday?.class_id||classes[0]?.class_id||"";
  }else{
    initialId=classes[0]?.class_id||"";
  }

  if(initialId){
    $("classFilter").value=initialId;
    await chooseClass(initialId);
  }else{
    selectedClass=null;rows=[];renderAll();
    $("classInfo").innerHTML='<div><strong>Tidak ada kelas yang dapat diakses.</strong><br><span>Hubungi administrator jika akun seharusnya memiliki akses.</span></div>';
  }
  renderTodayClasses();
}

async function chooseClass(id){
  selectedClass=classes.find(c=>c.class_id===id)||null;
  if(!selectedClass){rows=[];renderAll();renderTodayClasses();return}
  await loadAttendance();
  renderTodayClasses();
}
async function loadAttendance(){
  if(!selectedClass)return;
  const d=$("attendanceDate").value;
  setSaveMessage("Memuat data absensi...","warn");
  rows=await api.db.rpc("get_class_attendance_by_date",{p_class_id:selectedClass.class_id,p_date:d})||[];
  renderAll()
}

function filteredRows(){const q=$("searchInput").value.trim().toLowerCase();const st=$("statusFilter").value;return rows.filter(r=>{const hay=`${r.full_name||""} ${r.nis||""} ${r.nisn||""}`.toLowerCase();return (!q||hay.includes(q))&&(!st||r.attendance_status===st)})}
function renderStats(){const total=rows.length;const present=rows.filter(r=>["HADIR","TERLAMBAT"].includes(r.attendance_status)).length;const excused=rows.filter(r=>["IZIN","SAKIT"].includes(r.attendance_status)).length;const missing=rows.filter(r=>["ALFA","BELUM_DIABSEN"].includes(r.attendance_status)).length;$("statTotal").textContent=total;$("statPresent").textContent=present;$("statExcused").textContent=excused;$("statMissing").textContent=missing}
function classScheduleText(classId){
  const day=dayNameFromISO($("attendanceDate").value);
  const items=personalSchedule.filter(x=>x.class_id===classId&&x.day_of_week===day).sort((a,b)=>Number(a.sequence_no||0)-Number(b.sequence_no||0));
  if(!items.length)return"";
  return items.map(x=>`${x.subject_name||"Mapel"} · ${x.slot_code||""} ${String(x.start_time||"").slice(0,5)}–${String(x.end_time||"").slice(0,5)}`).join(" | ");
}
function renderClassInfo(){
  if(!selectedClass){$("classInfo").innerHTML='<div><strong>Pilih kelas untuk mulai absensi</strong><br><span>Daftar kelas menyesuaikan hak akses akun.</span></div>';return}
  const sched=isTeacherMode?classScheduleText(selectedClass.class_id):"";
  $("classInfo").innerHTML=`<div><strong>${esc(selectedClass.class_name)}</strong><br><span>${sched?esc(sched)+" · ":""}Wali kelas: ${esc(selectedClass.homeroom_teacher||"Belum ditentukan")} · ${selectedClass.student_count} siswa · ${selectedClass.can_manage?"Dapat mengelola":"Mode lihat saja"}</span></div><span>${esc($("attendanceDate").value)}</span>`
}
function rowControls(r){const disabled=selectedClass?.can_manage?"":"disabled";const status=r.attendance_status||"BELUM_DIABSEN";return `<select data-field="status" data-id="${r.enrollment_id}" ${disabled}>${statusOptions(status)}</select>`}
function renderTable(){
  const data=filteredRows();
  if(!data.length){$("attendanceBody").innerHTML='<tr><td colspan="7"><div class="empty-state">Tidak ada siswa yang cocok.</div></td></tr>';$("attendanceCards").innerHTML='<div class="empty-state">Tidak ada siswa yang cocok.</div>';return}
  const disabled=selectedClass?.can_manage?"":"disabled";
  $("attendanceBody").innerHTML=data.map((r,i)=>`<tr><td>${r.roll_number??i+1}</td><td><div class="student-name">${esc(r.full_name)}</div><div class="student-sub">NIS ${esc(r.nis||"-")} · NISN ${esc(r.nisn||"-")}</div></td><td>${esc(r.gender||"-")}</td><td>${rowControls(r)}<div style="margin-top:4px"><span class="st-badge st-${r.attendance_status}">${statusLabel(r.attendance_status)}</span></div></td><td><input data-field="arrival" data-id="${r.enrollment_id}" type="time" value="${esc(r.arrival_time||"")}" ${disabled}></td><td><input data-field="late" data-id="${r.enrollment_id}" type="number" min="0" value="${Number(r.late_minutes||0)}" style="width:70px" ${disabled}></td><td><input data-field="note" data-id="${r.enrollment_id}" type="text" value="${esc(r.note||"")}" placeholder="Catatan" ${disabled}></td></tr>`).join("");
  $("attendanceCards").innerHTML=data.map((r,i)=>`<article class="student-att-card"><div class="top"><div><h4>${esc(r.full_name)}</h4><p>No. ${r.roll_number??i+1} · NIS ${esc(r.nis||"-")}</p></div><span class="st-badge st-${r.attendance_status}">${statusLabel(r.attendance_status)}</span></div><div class="fields"><label><span>Status</span>${rowControls(r)}</label><label><span>Jam Datang</span><input data-field="arrival" data-id="${r.enrollment_id}" type="time" value="${esc(r.arrival_time||"")}" ${disabled}></label><label><span>Terlambat (menit)</span><input data-field="late" data-id="${r.enrollment_id}" type="number" min="0" value="${Number(r.late_minutes||0)}" ${disabled}></label><label class="full"><span>Catatan</span><input data-field="note" data-id="${r.enrollment_id}" type="text" value="${esc(r.note||"")}" ${disabled}></label></div></article>`).join("");
  bindRowInputs()
}
function bindRowInputs(){
  document.querySelectorAll("[data-field]").forEach(el=>{
    const evt=el.tagName==="SELECT"?"change":"input";
    el.addEventListener(evt,()=>{
      const r=rows.find(x=>x.enrollment_id===el.dataset.id);if(!r)return;
      const f=el.dataset.field;
      if(f==="status"){
        r.attendance_status=el.value;
        if(!["HADIR","TERLAMBAT"].includes(el.value))r.arrival_time=null;
        if(el.value!=="TERLAMBAT")r.late_minutes=0;
        renderStats();renderTable()
      }else if(f==="arrival")r.arrival_time=el.value||null;
      else if(f==="late")r.late_minutes=Math.max(0,Number(el.value||0));
      else if(f==="note")r.note=el.value||null;
      updateSaveInfo()
    })
  })
}
function setSaveMessage(text,state=""){const outer=$("saveInfo"),dot=$("saveDot");const span=outer.querySelector("span");if(span)span.textContent=text;dot.className="save-dot"+(state?" "+state:"")}
function updateSaveInfo(){
  if(!selectedClass){setSaveMessage("Belum ada kelas dipilih.");return}
  const marked=rows.filter(r=>r.attendance_status!=="BELUM_DIABSEN").length;
  const complete=rows.length>0&&marked===rows.length;
  setSaveMessage(`${selectedClass.class_name} · ${marked}/${rows.length} siswa memiliki status · ${selectedClass.can_manage?(complete?"lengkap & siap disimpan":"masih ada yang belum diabsen"):"mode lihat saja"}`,complete?"good":"warn");
  const disabled=!selectedClass.can_manage;
  $("saveBtn").disabled=disabled;$("markAllPresent").disabled=disabled;$("markEmptyPresent").disabled=disabled;$("markEmptyAbsent").disabled=disabled
}
function renderAll(){renderStats();renderClassInfo();renderTable();updateSaveInfo()}

function markRows(mode){
  if(!selectedClass?.can_manage)return;
  rows.forEach(r=>{
    if(mode==="ALL_PRESENT"||r.attendance_status==="BELUM_DIABSEN"){
      r.attendance_status=mode==="EMPTY_ABSENT"?"ALFA":"HADIR";
      r.late_minutes=0;
      if(r.attendance_status!=="HADIR")r.arrival_time=null
    }
  });
  renderAll()
}

async function saveAttendance(){
  if(!selectedClass?.can_manage)return;
  const items=rows.filter(r=>r.attendance_status!=="BELUM_DIABSEN").map(r=>({enrollment_id:r.enrollment_id,status:r.attendance_status,arrival_time:r.arrival_time||null,late_minutes:Number(r.late_minutes||0),note:r.note||null}));
  if(!items.length){alert("Belum ada status absensi yang dipilih.");return}
  const btn=$("saveBtn");btn.disabled=true;btn.textContent="Menyimpan...";
  try{
    const count=await api.db.rpc("save_class_student_attendance",{p_class_id:selectedClass.class_id,p_date:$("attendanceDate").value,p_items:items});
    await loadAttendance();
    await refreshTodayProgress();
    renderTodayClasses();
    alert(`${count} data absensi berhasil disimpan.`);
  }catch(err){alert("Gagal menyimpan absensi: "+(err.message||err))}
  finally{btn.textContent="Simpan Absensi";updateSaveInfo()}
}

$("attendanceDate").value=localISODate();
$("classFilter").addEventListener("change",()=>chooseClass($("classFilter").value));
$("attendanceDate").addEventListener("change",async()=>{
  await refreshTodayProgress();
  renderTodayClasses();
  if(isTeacherMode){
    const groups=scheduleGroups();
    const currentValid=groups.some(g=>g.class_id===selectedClass?.class_id);
    if(!currentValid&&groups.length){
      const unfinished=groups.find(g=>!todayProgress.get(g.class_id)?.complete&&classes.some(c=>c.class_id===g.class_id&&c.can_manage));
      const id=unfinished?.class_id||groups[0].class_id;
      if(classes.some(c=>c.class_id===id)){$("classFilter").value=id;await chooseClass(id);return}
    }
  }
  await loadAttendance();
});
$("searchInput").addEventListener("input",renderTable);
$("statusFilter").addEventListener("change",renderTable);
$("markAllPresent").addEventListener("click",()=>markRows("ALL_PRESENT"));
$("markEmptyPresent").addEventListener("click",()=>markRows("EMPTY_PRESENT"));
$("markEmptyAbsent").addEventListener("click",()=>markRows("EMPTY_ABSENT"));
$("reloadBtn").addEventListener("click",async()=>{await loadAttendance();await refreshTodayProgress();renderTodayClasses()});
$("saveBtn").addEventListener("click",saveAttendance);

(async function boot(){
  try{
    api=await window.simanisReady;
    const session=await api.auth.getSession();if(!session){location.replace("index.html");return}
    const user=await api.auth.getUser();if(!user){location.replace("index.html");return}
    profile=await loadProfile(user);
    applyTeacherUI();
    $("sideUserName").textContent=profile.full_name||user.email||"Pengguna";
    $("sideUserRole").textContent=formatRole(profile.role);
    $("headerUser").textContent=profile.full_name||user.email||"Pengguna";
    $("currentDate").textContent=localDateID();
    await loadMenu();
    await loadPersonalSchedule();
    await loadClasses();
    $("logoutBtn").addEventListener("click",async()=>{await api.auth.signOut();location.replace("index.html")})
  }catch(err){
    console.error(err);
    alert("Absensi Siswa gagal dimuat: "+(err.message||err))
  }finally{
    $("loading")?.classList.add("hidden")
  }
})();