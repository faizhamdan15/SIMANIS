const $ = id => document.getElementById(id);
let api, profile, schedules=[], classes=[], teachers=[], subjects=[], slots=[], semesterId=null, isTeacherPersonal=false;
const DAYS=["SENIN","SELASA","RABU","KAMIS","SABTU","AHAD"];
function esc(s){return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}
function formatRole(r){return (r||"-").replaceAll("_"," ")}
function localDateID(){return new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date())}
function todayName(){return new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",weekday:"long"}).format(new Date()).toUpperCase()}
function nowMinutes(){const p=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Jakarta",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(new Date());return Number(p.find(x=>x.type==="hour")?.value||0)*60+Number(p.find(x=>x.type==="minute")?.value||0)}
function toMinutes(t){if(!t)return -1;const [h,m]=String(t).slice(0,5).split(":").map(Number);return h*60+m}
function routeFor(code){return {DASHBOARD:"dashboard.html",ADMINISTRASI_KEPALA:"administrasi.html",DATA_SISWA:"siswa.html",DATA_GURU:"guru.html",KELAS:"kelas.html",MATA_PELAJARAN:"mapel.html",JADWAL:"jadwal.html",ABSENSI_GURU:"absensi-guru.html",ABSENSI_SISWA:"absensi-siswa.html",NILAI:"nilai.html",PRESTASI:"prestasi.html",BERITA:"berita.html",PENGUMUMAN:"pengumuman.html",AGENDA:"agenda.html",KEUANGAN:"keuangan.html",PORTAL_WALI:"wali-admin.html",PENGATURAN:"pengaturan.html",PKM_KURIKULUM:"unit-kerja.html?unit=PKM_KURIKULUM",PKM_KESISWAAN:"unit-kerja.html?unit=PKM_KESISWAAN",PKM_BENDAHARA_SARPRAS:"unit-kerja.html?unit=PKM_BENDAHARA_SARPRAS",PKM_HUMASY:"unit-kerja.html?unit=PKM_HUMASY",KEPALA_TU:"unit-kerja.html?unit=KEPALA_TU",KALAB_IPA:"unit-kerja.html?unit=KALAB_IPA",KALAB_BISNIS:"unit-kerja.html?unit=KALAB_BISNIS"}[code]||"#"}
async function loadProfile(user){const r=await api.db.select("profiles",`select=id,full_name,role,is_active,teacher_id&id=eq.${encodeURIComponent(user.id)}&limit=1`);if(!r?.[0])throw new Error("Profil pengguna tidak ditemukan.");return r[0]}
async function loadMenu(){const m=await api.db.rpc("get_my_modules",{});$("sidebarMenu").innerHTML=(m||[]).map(x=>`<a href="${routeFor(x.code)}" class="nav-item ${x.code==="JADWAL"?"active":""}"><span class="nav-dot"></span><span>${esc(x.name)}</span></a>`).join("");document.querySelectorAll('.nav-item[href="#"]').forEach(a=>a.onclick=e=>{e.preventDefault();alert(`Modul "${a.textContent.trim()}" akan diaktifkan bertahap.`)})}
function applyPersonalUI(){
  isTeacherPersonal=["GURU","WALI_KELAS"].includes(String(profile.role||"").toUpperCase());
  if(!isTeacherPersonal)return;
  $("pageTitle").textContent="Jadwal Mengajar Saya";
  $("pageSubtitle").textContent="Jadwal personal berdasarkan kelas dan mata pelajaran yang Anda ampu pada semester aktif.";
  $("topbarSubtitle").textContent="Sistem Informasi MA Nurul Islam · Jadwal Mengajar Saya";
  $("personalHeaderBadge").style.display="inline-flex";
  $("addBtn").style.display="none";
  $("teacherFilterWrap").style.display="none";
  $("adminNote").classList.add("hidden");
  $("personalNote").classList.remove("hidden");
  $("labelSchedules").textContent="Slot Saya";
  $("subSchedules").textContent="Total slot per minggu";
  $("labelClasses").textContent="Rombel Saya";
  $("subClasses").textContent="Kelas yang diampu";
  $("labelTeachers").textContent="Hari Mengajar";
  $("subTeachers").textContent="Hari aktif mengajar";
  $("labelSubjects").textContent="Mapel Saya";
  $("subSubjects").textContent="Mata pelajaran diampu";
  $("searchInput").placeholder="Cari mapel atau kelas...";
}
async function loadMaster(){
  const [c,t,s,ts,sm]=await Promise.all([
    api.db.select("classes","select=id,name&is_active=eq.true&order=grade_level.asc,name.asc"),
    api.db.select("teachers","select=id,teacher_code,full_name&is_active=eq.true&order=teacher_code.asc"),
    api.db.select("subjects","select=id,code,name&is_active=eq.true&order=name.asc"),
    api.db.select("time_slots","select=id,code,sequence_no,start_time,end_time&order=sequence_no.asc"),
    api.db.select("semesters","select=id,name,is_active&is_active=eq.true&limit=1")
  ]);
  classes=c||[];teachers=t||[];subjects=s||[];slots=ts||[];semesterId=sm?.[0]?.id||null;

  const classOpts=classes.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join("");
  $("classFilter").innerHTML='<option value="">Semua Kelas Saya</option>'+classOpts;
  $("classId").innerHTML=classOpts;

  const teacherOpts=teachers.map(x=>`<option value="${x.id}">${esc(x.teacher_code||"")} · ${esc(x.full_name)}</option>`).join("");
  $("teacherFilter").innerHTML='<option value="">Semua Guru</option>'+teacherOpts;
  $("teacherId").innerHTML=teacherOpts;

  $("subjectId").innerHTML=subjects.map(x=>`<option value="${x.id}">${esc(x.code)} · ${esc(x.name)}</option>`).join("");
  $("timeSlot").innerHTML=slots.map(x=>`<option value="${x.id}">Jam ${esc(x.code)} · ${String(x.start_time).slice(0,5)}-${String(x.end_time).slice(0,5)}</option>`).join("");

  if(!isTeacherPersonal && classes.length)$("classFilter").value=classes[0].id;
}
async function loadSchedules(){
  schedules=await api.db.select("v_schedule_manage","select=*&academic_year=eq.2026/2027&semester=eq.GANJIL&order=day_of_week.asc,sequence_no.asc,class_name.asc")||[];
  renderStats();render();
}
function filtered(){
  const cid=$("classFilter").value;
  const tid=isTeacherPersonal?"":$("teacherFilter").value;
  const q=$("searchInput").value.trim().toLowerCase();
  return schedules.filter(x=>(!cid||x.class_id===cid)&&(!tid||x.teacher_id===tid)&&(!q||`${x.subject_name} ${x.teacher_name} ${x.class_name}`.toLowerCase().includes(q)))
}
function renderStats(){
  $("statSchedules").textContent=schedules.length;
  $("statClasses").textContent=new Set(schedules.map(x=>x.class_id)).size;
  $("statSubjects").textContent=new Set(schedules.map(x=>x.subject_id)).size;
  $("statTeachers").textContent=isTeacherPersonal?new Set(schedules.map(x=>x.day_of_week)).size:new Set(schedules.map(x=>x.teacher_id)).size;
}
function scheduleState(day,slot){
  if(day!==todayName())return"";
  const now=nowMinutes(),start=toMinutes(slot.start_time),end=toMinutes(slot.end_time);
  if(now>=start&&now<=end)return"current";
  const future=slots.filter(s=>toMinutes(s.start_time)>now).sort((a,b)=>a.sequence_no-b.sequence_no)[0];
  if(future?.id===slot.id)return"next";
  return"";
}
function render(){
  const rows=filtered(),cid=$("classFilter").value,cls=classes.find(x=>x.id===cid);
  $("gridTitle").textContent=isTeacherPersonal?(cls?`Jadwal Mengajar · ${cls.name}`:"Jadwal Mengajar Saya"):(cls?`Jadwal ${cls.name}`:"Jadwal Mingguan");
  $("gridInfo").textContent=`${rows.length} slot`;

  let html='<div class="week-head">Jam</div>'+DAYS.map(d=>`<div class="week-head ${d===todayName()?"today":""}">${d}</div>`).join("");
  slots.forEach(sl=>{
    html+=`<div class="time-head">${esc(sl.code)}<small>${String(sl.start_time).slice(0,5)}-${String(sl.end_time).slice(0,5)}</small></div>`;
    DAYS.forEach(d=>{
      const x=rows.find(r=>r.day_of_week===d&&r.time_slot_id===sl.id);
      const state=scheduleState(d,sl);
      if(x){
        html+=`<div class="schedule-cell ${isTeacherPersonal?"personal":""} ${state}" ${isTeacherPersonal?"":`data-edit="${x.id}"`}><strong>${esc(x.subject_name)}</strong><span class="class-name">${esc(x.class_name)}</span>${x.room?`<span>Ruang ${esc(x.room)}</span>`:""}${state==="current"?'<span class="status-chip">SEDANG BERLANGSUNG</span>':state==="next"?'<span class="status-chip">BERIKUTNYA</span>':""}${!isTeacherPersonal?`<span>${esc(x.teacher_name)}</span>`:""}</div>`
      }else{
        html+=isTeacherPersonal?`<div class="schedule-cell empty">—</div>`:`<div class="schedule-cell empty" data-new-day="${d}" data-new-slot="${sl.id}">+ Tambah</div>`
      }
    })
  });
  $("weekGrid").innerHTML=html;

  $("scheduleMobile").innerHTML=DAYS.map(d=>{
    const dr=rows.filter(r=>r.day_of_week===d).sort((a,b)=>a.sequence_no-b.sequence_no);
    return `<div class="day-card ${d===todayName()?"today":""}"><h3>${d}${d===todayName()?" · Hari Ini":""}</h3>${slots.map(sl=>{
      const x=dr.find(r=>r.time_slot_id===sl.id);
      const state=scheduleState(d,sl);
      if(x)return `<div class="mobile-slot ${state}" ${isTeacherPersonal?"":`data-edit="${x.id}"`}><div class="slot-label">${esc(sl.code)}<br>${String(sl.start_time).slice(0,5)}–${String(sl.end_time).slice(0,5)}</div><div><strong>${esc(x.subject_name)}</strong><small>${esc(x.class_name)}${x.room?` · Ruang ${esc(x.room)}`:""}</small></div></div>`;
      return isTeacherPersonal?`<div class="mobile-slot"><div class="slot-label">${esc(sl.code)}</div><div><small>—</small></div></div>`:`<div class="mobile-slot" data-new-day="${d}" data-new-slot="${sl.id}"><div class="slot-label">${esc(sl.code)}</div><div><small>Belum ada jadwal</small></div></div>`
    }).join("")}</div>`
  }).join("");

  if(!isTeacherPersonal){
    document.querySelectorAll("[data-edit]").forEach(el=>el.onclick=()=>openEdit(el.dataset.edit));
    document.querySelectorAll("[data-new-day]").forEach(el=>el.onclick=()=>openAdd(el.dataset.newDay,el.dataset.newSlot));
  }
}
function openAdd(day=null,slot=null){
  if(isTeacherPersonal)return;
  $("scheduleForm").reset();$("scheduleId").value="";$("modalTitle").textContent="Tambah Jadwal";$("deleteBtn").style.display="none";$("formMessage").textContent="";
  if(day)$("day").value=day;if(slot)$("timeSlot").value=slot;if($("classFilter").value)$("classId").value=$("classFilter").value;$("scheduleModal").classList.remove("hidden")
}
function openEdit(id){
  if(isTeacherPersonal)return;
  const x=schedules.find(r=>r.id===id);if(!x)return;
  $("scheduleId").value=x.id;$("modalTitle").textContent="Edit Jadwal";$("day").value=x.day_of_week;$("timeSlot").value=x.time_slot_id;$("classId").value=x.class_id;$("subjectId").value=x.subject_id;$("teacherId").value=x.teacher_id;$("room").value=x.room||"";$("note").value=x.note||"";$("deleteBtn").style.display="inline-block";$("formMessage").textContent="";$("scheduleModal").classList.remove("hidden")
}
function closeModal(){$("scheduleModal").classList.add("hidden")}
async function write(path,method,body){
  const sess=await api.auth.getSession();const cfg=window.SIMANIS_CONFIG;
  const r=await fetch(`${cfg.SUPABASE_URL.replace(/\/$/,"")}/rest/v1/${path}`,{method,headers:{apikey:cfg.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${sess.access_token}`,"Content-Type":"application/json",Prefer:"return=representation"},body:body===undefined?undefined:JSON.stringify(body)});
  const txt=await r.text();let data;try{data=txt?JSON.parse(txt):null}catch{data=txt}
  if(!r.ok)throw new Error(data?.message||data?.details||txt||`HTTP ${r.status}`);return data
}
async function saveSchedule(e){
  e.preventDefault();if(isTeacherPersonal)return;
  const id=$("scheduleId").value,p={semester_id:semesterId,class_id:$("classId").value,subject_id:$("subjectId").value,teacher_id:$("teacherId").value,time_slot_id:$("timeSlot").value,day_of_week:$("day").value,room:$("room").value.trim()||null,note:$("note").value.trim()||null};
  $("saveBtn").disabled=true;$("formMessage").textContent="";
  try{if(id)await write(`schedules?id=eq.${encodeURIComponent(id)}`,"PATCH",p);else await write("schedules","POST",p);closeModal();await loadSchedules()}
  catch(err){const m=String(err.message);$("formMessage").textContent=m.includes("uq_schedule_class_time")?"Bentrok: kelas sudah memiliki jadwal pada hari dan jam tersebut.":m.includes("uq_schedule_teacher_time")?"Bentrok: guru sudah mengajar pada hari dan jam tersebut.":"Gagal menyimpan: "+m}
  finally{$("saveBtn").disabled=false}
}
async function deleteSchedule(){
  if(isTeacherPersonal)return;
  const id=$("scheduleId").value;if(!id||!confirm("Hapus jadwal ini?"))return;
  try{await write(`schedules?id=eq.${encodeURIComponent(id)}`,"DELETE");closeModal();await loadSchedules()}catch(err){alert("Gagal menghapus jadwal: "+err.message)}
}
$("classFilter").onchange=render;
$("teacherFilter").onchange=render;
$("searchInput").oninput=render;
$("addBtn").onclick=()=>openAdd();
$("closeModalBtn").onclick=closeModal;
$("cancelBtn").onclick=closeModal;
$("deleteBtn").onclick=deleteSchedule;
$("scheduleForm").onsubmit=saveSchedule;
$("scheduleModal").onclick=e=>{if(e.target===$("scheduleModal"))closeModal()};

(async()=>{
  try{
    api=await window.simanisReady;
    const sess=await api.auth.getSession();if(!sess){location.replace("index.html");return}
    const user=await api.auth.getUser();if(!user){location.replace("index.html");return}
    profile=await loadProfile(user);
    applyPersonalUI();
    $("sideUserName").textContent=profile.full_name||user.email;
    $("sideUserRole").textContent=formatRole(profile.role);
    $("headerUser").textContent=profile.full_name||user.email;
    $("currentDate").textContent=localDateID();
    await Promise.all([loadMenu(),loadMaster()]);
    await loadSchedules();
    $("logoutBtn").onclick=async()=>{await api.auth.signOut();location.replace("index.html")}
  }catch(err){
    console.error(err);
    alert("Jadwal gagal dimuat: "+(err.message||err))
  }finally{
    $("loading").classList.add("hidden")
  }
})();