const $ = id => document.getElementById(id);
let api, profile;
let contexts = [], classStats = [], assessments = [], roster = [];
let selectedContext = null, selectedAssessment = null;

function esc(s){return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}
function formatRole(r){return (r||"-").replaceAll("_"," ")}
function localDateID(){return new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date())}
function localISODate(){const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const o={};p.forEach(x=>o[x.type]=x.value);return `${o.year}-${o.month}-${o.day}`}
function routeFor(code){return {DASHBOARD:"dashboard.html",ADMINISTRASI_KEPALA:"administrasi.html",DATA_SISWA:"siswa.html",DATA_GURU:"guru.html",KELAS:"kelas.html",MATA_PELAJARAN:"mapel.html",JADWAL:"jadwal.html",ABSENSI_GURU:"absensi-guru.html",ABSENSI_SISWA:"absensi-siswa.html",NILAI:"nilai.html"}[code]||"#"}
function fmtNum(n){if(n===null||n===undefined||n==="")return "-";return Number(n).toLocaleString("id-ID",{maximumFractionDigits:2})}

async function loadProfile(user){const r=await api.db.select("profiles",`select=id,full_name,role,is_active&id=eq.${encodeURIComponent(user.id)}&limit=1`);if(!r?.[0])throw new Error("Profil pengguna tidak ditemukan.");if(!r[0].is_active)throw new Error("Akun SIMANIS tidak aktif.");return r[0]}
async function loadMenu(){const m=await api.db.rpc("get_my_modules",{});$("sidebarMenu").innerHTML=(m||[]).map(x=>`<a href="${routeFor(x.code)}" class="nav-item ${x.code==="NILAI"?"active":""}"><span class="nav-dot"></span><span>${esc(x.name)}</span></a>`).join("");document.querySelectorAll('.nav-item[href="#"]').forEach(a=>a.addEventListener("click",e=>{e.preventDefault();alert(`Modul "${a.textContent.trim()}" akan diaktifkan bertahap.`)}))}

async function loadContext(){
  const [ctx,cs]=await Promise.all([
    api.db.rpc("get_my_grade_context",{}),
    api.db.select("v_classes_current","select=id,name,active_students&is_active=eq.true&order=grade_level.asc,name.asc")
  ]);
  contexts=ctx||[];classStats=cs||[];
  const classMap=new Map();
  contexts.forEach(c=>{if(!classMap.has(c.class_id))classMap.set(c.class_id,c.class_name)});
  $("classFilter").innerHTML='<option value="">Pilih Kelas...</option>'+[...classMap.entries()].map(([id,name])=>`<option value="${id}">${esc(name)}</option>`).join("");
  if(classMap.size){const first=[...classMap.keys()][0];$("classFilter").value=first;await onClassChange();}else{renderEmptyContext()}
}

function renderEmptyContext(){
  selectedContext=null;assessments=[];roster=[];selectedAssessment=null;
  $("subjectFilter").innerHTML='<option value="">Tidak ada mata pelajaran</option>';
  $("assessmentGrid").innerHTML='<div class="grade-empty" style="grid-column:1/-1">Tidak ada kelas/mata pelajaran yang dapat diakses akun ini.</div>';
  $("gradeBody").innerHTML='<tr><td colspan="5"><div class="grade-empty">Tidak ada data nilai yang dapat diakses.</div></td></tr>';
  $("statStudents").textContent="0";$("statAssessments").textContent="0";$("statFilled").textContent="0";$("statMode").textContent="-";
  $("addAssessmentBtn").disabled=true;$("saveGradesBtn").disabled=true;
}

async function onClassChange(){
  const cid=$("classFilter").value;
  const subs=contexts.filter(x=>x.class_id===cid);
  $("subjectFilter").innerHTML=subs.map(x=>`<option value="${x.subject_id}">${esc(x.subject_code)} · ${esc(x.subject_name)}</option>`).join("");
  if(subs.length){$("subjectFilter").value=subs[0].subject_id;await onSubjectChange()}else renderEmptyContext();
}

async function onSubjectChange(){
  const cid=$("classFilter").value,sid=$("subjectFilter").value;
  selectedContext=contexts.find(x=>x.class_id===cid&&x.subject_id===sid)||null;
  selectedAssessment=null;roster=[];
  $("addAssessmentBtn").disabled=!selectedContext?.can_manage;
  $("statMode").textContent=selectedContext?.can_manage?"Kelola":"Lihat";
  await loadAssessments();
}

async function loadAssessments(){
  if(!selectedContext)return;
  assessments=await api.db.rpc("get_grade_assessments",{p_class_id:selectedContext.class_id,p_subject_id:selectedContext.subject_id})||[];
  renderAssessmentStats();renderAssessments();clearGradePanel();
}

function renderAssessmentStats(){
  const cls=classStats.find(x=>x.id===selectedContext?.class_id);
  $("statStudents").textContent=Number(cls?.active_students||0);
  $("statAssessments").textContent=assessments.length;
  $("statFilled").textContent=assessments.reduce((n,a)=>n+Number(a.filled_count||0),0);
}

function renderAssessments(){
  if(!assessments.length){$("assessmentGrid").innerHTML='<div class="grade-empty" style="grid-column:1/-1">Belum ada asesmen untuk kelas dan mata pelajaran ini.</div>';return}
  $("assessmentGrid").innerHTML=assessments.map(a=>`<article class="assessment-card ${selectedAssessment?.id===a.id?"active":""}" data-open="${a.id}">
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><div><span class="type-pill">${esc(a.assessment_type)}</span><h4 style="margin-top:8px">${esc(a.title)}</h4><p>${a.assessment_date?esc(a.assessment_date):"Tanpa tanggal"}</p></div><span class="pub-pill ${a.is_published?"":"draft-pill"}">${a.is_published?"Publik":"Draft"}</span></div>
    <div class="assessment-meta"><div><b>Terisi</b><br>${Number(a.filled_count||0)}/${Number(a.student_count||0)}</div><div><b>Rata-rata</b><br>${a.average_score===null?"-":fmtNum(a.average_score)} / ${fmtNum(a.max_score)}</div><div><b>Skor Maks.</b><br>${fmtNum(a.max_score)}</div><div><b>Bobot</b><br>${fmtNum(a.weight)}</div></div>
    <div class="assessment-actions">${selectedContext?.can_manage?`<button class="mini-btn" data-edit="${a.id}">Edit</button>`:""}<button class="mini-btn" data-open-btn="${a.id}">Input / Lihat Nilai</button></div>
  </article>`).join("");
  document.querySelectorAll("[data-open]").forEach(el=>el.addEventListener("click",e=>{if(e.target.closest("[data-edit]"))return;openAssessment(el.dataset.open)}));
  document.querySelectorAll("[data-open-btn]").forEach(b=>b.addEventListener("click",e=>{e.stopPropagation();openAssessment(b.dataset.openBtn)}));
  document.querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",e=>{e.stopPropagation();openAssessmentModal(b.dataset.edit)}));
}

function clearGradePanel(){
  $("gradeTitle").textContent="Pilih asesmen";$("gradeSubtitle").textContent="Nilai siswa akan tampil di sini.";
  $("gradeBody").innerHTML='<tr><td colspan="5"><div class="grade-empty">Pilih salah satu asesmen di atas.</div></td></tr>';
  $("saveInfo").textContent="Belum ada asesmen dipilih.";$("saveGradesBtn").disabled=true;
}

async function openAssessment(id){
  selectedAssessment=assessments.find(a=>a.id===id)||null;if(!selectedAssessment)return;
  renderAssessments();
  $("gradeTitle").textContent=selectedAssessment.title;
  $("gradeSubtitle").textContent=`${selectedContext.class_name} · ${selectedContext.subject_name} · ${selectedAssessment.assessment_type} · Maks. ${fmtNum(selectedAssessment.max_score)}`;
  $("gradeBody").innerHTML='<tr><td colspan="5"><div class="grade-empty">Memuat daftar siswa...</div></td></tr>';
  roster=await api.db.rpc("get_assessment_grade_roster",{p_assessment_id:id})||[];
  renderRoster();
}

function renderRoster(){
  if(!roster.length){$("gradeBody").innerHTML='<tr><td colspan="5"><div class="grade-empty">Tidak ada siswa aktif pada kelas ini.</div></td></tr>';return}
  const disabled=selectedContext?.can_manage?"":"disabled";
  $("gradeBody").innerHTML=roster.map((r,i)=>`<tr><td>${r.roll_number??i+1}</td><td><strong>${esc(r.full_name)}</strong><div class="student-sub">NIS ${esc(r.nis||"-")} · NISN ${esc(r.nisn||"-")}</div></td><td>${esc(r.gender||"-")}</td><td><input class="score-input" data-score="${r.enrollment_id}" type="number" min="0" max="${Number(selectedAssessment.max_score)}" step="0.01" value="${r.score??""}" ${disabled}></td><td><input class="note-input" data-note="${r.enrollment_id}" type="text" value="${esc(r.note||"")}" placeholder="Opsional" ${disabled}></td></tr>`).join("");
  document.querySelectorAll("[data-score]").forEach(i=>i.addEventListener("input",()=>{const r=roster.find(x=>x.enrollment_id===i.dataset.score);if(r)r.score=i.value===""?null:Number(i.value);updateSaveInfo()}));
  document.querySelectorAll("[data-note]").forEach(i=>i.addEventListener("input",()=>{const r=roster.find(x=>x.enrollment_id===i.dataset.note);if(r)r.note=i.value||null}));
  updateSaveInfo();
}

function updateSaveInfo(){
  if(!selectedAssessment){$("saveInfo").textContent="Belum ada asesmen dipilih.";return}
  const filled=roster.filter(r=>r.score!==null&&r.score!==undefined&&r.score!=="").length;
  $("saveInfo").textContent=`${filled}/${roster.length} nilai terisi · Skor maksimum ${fmtNum(selectedAssessment.max_score)}${selectedContext?.can_manage?"":" · mode lihat saja"}`;
  $("saveGradesBtn").disabled=!selectedContext?.can_manage;
}

function openAssessmentModal(id=null){
  if(!selectedContext?.can_manage)return;
  const a=id?assessments.find(x=>x.id===id):null;
  $("assessmentForm").reset();$("assessmentId").value=a?.id||"";$("modalTitle").textContent=a?"Edit Asesmen":"Tambah Asesmen";
  $("assessmentTitle").value=a?.title||"";$("assessmentType").value=a?.assessment_type||"TUGAS";$("assessmentDate").value=a?.assessment_date||localISODate();$("maxScore").value=a?.max_score??100;$("weight").value=a?.weight??1;$("published").value=String(!!a?.is_published);$("formMessage").textContent="";$("assessmentModal").classList.remove("hidden");
}
function closeAssessmentModal(){$("assessmentModal").classList.add("hidden")}

async function saveAssessment(e){
  e.preventDefault();const btn=$("saveAssessmentBtn");btn.disabled=true;btn.textContent="Menyimpan...";$("formMessage").textContent="";
  try{
    await api.db.rpc("save_grade_assessment",{p_id:$("assessmentId").value||null,p_class_id:selectedContext.class_id,p_subject_id:selectedContext.subject_id,p_title:$("assessmentTitle").value.trim(),p_type:$("assessmentType").value,p_date:$("assessmentDate").value||null,p_max_score:Number($("maxScore").value||100),p_weight:Number($("weight").value||1),p_published:$("published").value==="true"});
    closeAssessmentModal();await loadAssessments();
  }catch(err){$("formMessage").textContent="Gagal menyimpan: "+err.message}
  finally{btn.disabled=false;btn.textContent="Simpan"}
}

async function saveGrades(){
  if(!selectedAssessment||!selectedContext?.can_manage)return;
  const invalid=roster.find(r=>r.score!==null&&(Number(r.score)<0||Number(r.score)>Number(selectedAssessment.max_score)));
  if(invalid){alert(`Nilai ${invalid.full_name} harus antara 0 dan ${selectedAssessment.max_score}.`);return}
  const btn=$("saveGradesBtn");btn.disabled=true;btn.textContent="Menyimpan...";
  try{
    const items=roster.map(r=>({enrollment_id:r.enrollment_id,score:r.score===null||r.score===""?null:Number(r.score),note:r.note||null}));
    const count=await api.db.rpc("save_assessment_grades",{p_assessment_id:selectedAssessment.id,p_items:items});
    $("saveInfo").textContent=`${count} data nilai tersimpan.`;await loadAssessments();await openAssessment(selectedAssessment?.id||assessments[0]?.id);
  }catch(err){alert("Gagal menyimpan nilai: "+err.message);updateSaveInfo()}
  finally{btn.disabled=!selectedContext?.can_manage;btn.textContent="Simpan Nilai"}
}

$("classFilter").addEventListener("change",onClassChange);$("subjectFilter").addEventListener("change",onSubjectChange);$("addAssessmentBtn").addEventListener("click",()=>openAssessmentModal());$("closeModalBtn").addEventListener("click",closeAssessmentModal);$("cancelBtn").addEventListener("click",closeAssessmentModal);$("assessmentForm").addEventListener("submit",saveAssessment);$("saveGradesBtn").addEventListener("click",saveGrades);$("assessmentModal").addEventListener("click",e=>{if(e.target===$("assessmentModal"))closeAssessmentModal()});

(async function boot(){try{api=await window.simanisReady;const session=await api.auth.getSession();if(!session){location.replace("index.html");return}const user=await api.auth.getUser();if(!user){location.replace("index.html");return}profile=await loadProfile(user);$("sideUserName").textContent=profile.full_name||user.email||"Pengguna";$("sideUserRole").textContent=formatRole(profile.role);$("headerUser").textContent=profile.full_name||user.email||"Pengguna";$("currentDate").textContent=localDateID();await loadMenu();await loadContext();$("logoutBtn").addEventListener("click",async()=>{await api.auth.signOut();location.replace("index.html")})}catch(err){console.error(err);alert("Modul Nilai gagal dimuat: "+(err.message||err))}finally{$("loading").classList.add("hidden")}})();
