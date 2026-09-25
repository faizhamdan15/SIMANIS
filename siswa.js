// SIMANIS Data Siswa — Permission Hardening V2
const $ = (id) => document.getElementById(id);

let api, profile;
let allStudents = [];
let classes = [];
let teachingClasses = [];
let activeSemesterId = null;
let isTeacherMode = false;
let activeScope = "ALL";
let modulePerm = {can_view:false,can_create:false,can_update:false,can_delete:false};
let page = 1;
const pageSize = 30;

function esc(s){return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}
function formatRole(role){return (role||"-").replaceAll("_"," ")}
function localDateID(){return new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date())}
function routeFor(code){return {DASHBOARD:"dashboard.html",ADMINISTRASI_KEPALA:"administrasi.html",DATA_SISWA:"siswa.html",DATA_GURU:"guru.html",KELAS:"kelas.html",MATA_PELAJARAN:"mapel.html",JADWAL:"jadwal.html",ABSENSI_GURU:"absensi-guru.html",ABSENSI_SISWA:"absensi-siswa.html",NILAI:"nilai.html",PRESTASI:"prestasi.html",BERITA:"berita.html",PENGUMUMAN:"pengumuman.html",AGENDA:"agenda.html",KEUANGAN:"keuangan.html",PORTAL_WALI:"wali-admin.html",PENGATURAN:"pengaturan.html",PKM_KURIKULUM:"unit-kerja.html?unit=PKM_KURIKULUM",PKM_KESISWAAN:"unit-kerja.html?unit=PKM_KESISWAAN",PKM_BENDAHARA_SARPRAS:"unit-kerja.html?unit=PKM_BENDAHARA_SARPRAS",PKM_HUMASY:"unit-kerja.html?unit=PKM_HUMASY",KEPALA_TU:"unit-kerja.html?unit=KEPALA_TU",KALAB_IPA:"unit-kerja.html?unit=KALAB_IPA",KALAB_BISNIS:"unit-kerja.html?unit=KALAB_BISNIS"}[code]||"#"}
function initials(name){return String(name||"S").trim().split(/\s+/).slice(0,2).map(x=>x[0]||"").join("").toUpperCase()||"S"}
function fmtDate(v){if(!v)return"-";try{return new Intl.DateTimeFormat("id-ID",{day:"numeric",month:"long",year:"numeric"}).format(new Date(v+"T00:00:00"))}catch{return v}}
function classById(id){return classes.find(c=>c.id===id)}
function homeroomClassIds(){return new Set(classes.filter(c=>c.homeroom_teacher_id===profile?.teacher_id).map(c=>c.id))}
function teachingClassIds(){return new Set(teachingClasses.map(c=>c.id))}
function can(action){
  if(action==="view")return modulePerm.can_view===true;
  if(action==="create")return modulePerm.can_create===true;
  if(action==="update")return modulePerm.can_update===true;
  if(action==="delete")return modulePerm.can_delete===true;
  return false
}

async function loadModulePermission(){
  const p=await api.db.rpc("get_my_module_permission",{p_module_code:"DATA_SISWA"});
  modulePerm={
    can_view:p?.can_view===true,
    can_create:p?.can_create===true,
    can_update:p?.can_update===true,
    can_delete:p?.can_delete===true
  };
  if(!modulePerm.can_view){
    location.replace("dashboard.html?access_denied=DATA_SISWA");
    throw new Error("Tidak memiliki akses Data Siswa.");
  }
}

async function loadProfile(user){
  const rows=await api.db.select("profiles",`select=id,full_name,role,is_active,teacher_id&id=eq.${encodeURIComponent(user.id)}&limit=1`);
  const p=rows?.[0];if(!p)throw new Error("Profil pengguna tidak ditemukan.");if(!p.is_active)throw new Error("Akun SIMANIS tidak aktif.");return p
}
async function loadMenu(){
  const modules=await api.db.rpc("get_my_modules",{});
  $("sidebarMenu").innerHTML=(modules||[]).map(m=>`<a href="${routeFor(m.code)}" data-code="${esc(m.code)}" class="nav-item ${m.code==="DATA_SISWA"?"active":""}"><span class="nav-dot"></span><span>${esc(m.name)}</span></a>`).join("");
  document.querySelectorAll(".nav-item[href='#']").forEach(a=>a.addEventListener("click",e=>{e.preventDefault();alert(`Modul "${a.textContent.trim()}" akan diaktifkan pada tahap berikutnya.`)}))
}
function applyTeacherUI(){
  isTeacherMode=["GURU","WALI_KELAS"].includes(String(profile.role||"").toUpperCase());
  if(!isTeacherMode)return;
  $("pageTitle").textContent="Siswa Kelas Saya";
  $("pageSubtitle").textContent="Lihat siswa pada kelas yang Anda ajar atau walikan.";
  $("topbarSubtitle").textContent="Sistem Informasi MA Nurul Islam · Siswa Kelas Saya";
  $("teacherStudentNote").classList.add("show");
  $("scopeTabs").classList.add("show");
  $("classSummary").classList.add("show");
  $("addStudentBtn").style.display="none";
  $("statLabelTotal").textContent="Siswa Saya";
  $("statSubTotal").textContent="Dalam scope kelas Anda";
  $("statLabelMale").textContent="Laki-laki";
  $("statSubMale").textContent="Dalam scope Anda";
  $("statLabelFemale").textContent="Perempuan";
  $("statSubFemale").textContent="Dalam scope Anda";
  $("statLabelFourth").textContent="Rombel Saya";
  $("statSubFourth").textContent="Diajar / diwalikan";
}
async function loadMaster(){
  const [classRows,semesterRows,teachRows]=await Promise.all([
    api.db.select("classes","select=id,name,grade_level,homeroom_teacher_id,homeroom_teacher,active_students&is_active=eq.true&order=grade_level.asc,name.asc"),
    api.db.select("semesters","select=id,name,is_active,academic_year_id&is_active=eq.true&limit=1"),
    isTeacherMode?api.db.rpc("get_my_scoped_classes",{p_scope:"TEACH_ONLY"}).catch(()=>[]):Promise.resolve([])
  ]);
  classes=classRows||[];teachingClasses=teachRows||[];activeSemesterId=semesterRows?.[0]?.id||null;
  const opts=classes.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
  $("classFilter").innerHTML='<option value="">Semua Kelas</option>'+opts;
  $("classId").innerHTML='<option value="">Belum ditempatkan</option>'+opts;
}
async function loadStudents(){
  allStudents=await api.db.select("v_students_current","select=*&order=class_name.asc.nullslast,roll_number.asc.nullslast,full_name.asc")||[];
  renderStats();renderClassSummary();
  page=1;

  const deepClass=new URLSearchParams(location.search).get("class_id");
  if(deepClass&&classes.some(c=>c.id===deepClass))$("classFilter").value=deepClass;

  render()
}
function scopeAllowsStudent(s){
  if(!isTeacherMode||activeScope==="ALL")return true;
  if(activeScope==="HOMEROOM")return homeroomClassIds().has(s.class_id);
  if(activeScope==="TEACH")return teachingClassIds().has(s.class_id);
  return true
}
function getFiltered(){
  const q=$("searchInput").value.trim().toLowerCase(),classId=$("classFilter").value,gender=$("genderFilter").value;
  return allStudents.filter(s=>{
    const hay=`${s.full_name||""} ${s.nis||""} ${s.nisn||""} ${s.nik||""} ${s.phone||""}`.toLowerCase();
    return scopeAllowsStudent(s)&&(!q||hay.includes(q))&&(!classId||s.class_id===classId)&&(!gender||(gender==="EMPTY"?!s.gender:s.gender===gender))
  })
}
function renderStats(){
  const scoped=allStudents.filter(scopeAllowsStudent);
  $("statTotal").textContent=scoped.length;
  $("statMale").textContent=scoped.filter(s=>s.gender==="L").length;
  $("statFemale").textContent=scoped.filter(s=>s.gender==="P").length;
  $("statUnassigned").textContent=isTeacherMode?new Set(scoped.map(s=>s.class_id).filter(Boolean)).size:scoped.filter(s=>!s.class_id).length
}
function classType(c){
  const home=c.homeroom_teacher_id===profile?.teacher_id,teach=teachingClassIds().has(c.id);
  if(home&&teach)return{label:"WALI + MENGAJAR",cls:"homeroom"};
  if(home)return{label:"WALI KELAS",cls:"homeroom"};
  return{label:"MENGAJAR",cls:""}
}
function renderClassSummary(){
  if(!isTeacherMode)return;
  const visibleClasses=classes.filter(c=>allStudents.some(s=>s.class_id===c.id));
  $("classSummary").innerHTML=visibleClasses.map(c=>{
    const count=allStudents.filter(s=>s.class_id===c.id).length,t=classType(c),active=$("classFilter").value===c.id?"active":"";
    return `<button type="button" class="class-summary-card ${active}" data-class-card="${c.id}"><div class="top"><div><b>${esc(c.name)}</b><p>${esc(c.homeroom_teacher||"Wali kelas belum ditentukan")}</p></div><span class="class-type ${t.cls}">${t.label}</span></div><div class="count">${count} <small>siswa</small></div></button>`
  }).join("")||'<div class="empty-state" style="grid-column:1/-1">Belum ada rombel dalam scope akun ini.</div>';
  document.querySelectorAll("[data-class-card]").forEach(b=>b.onclick=()=>{$("classFilter").value=b.dataset.classCard;page=1;renderClassSummary();render()})
}
function actionButtons(s){
  const view=`<button class="profile-btn" data-view="${esc(s.id)}">Lihat Profil</button>`;
  if(isTeacherMode)return view;
  return `<div class="row-actions">${view}${can("update")?`<button class="mini-btn" data-edit="${esc(s.id)}">Edit</button>`:""}${can("delete")?`<button class="mini-btn danger" data-disable="${esc(s.id)}">Nonaktifkan</button>`:""}</div>`
}
function render(){
  const rows=getFiltered(),totalPages=Math.max(1,Math.ceil(rows.length/pageSize));if(page>totalPages)page=totalPages;
  const start=(page-1)*pageSize,slice=rows.slice(start,start+pageSize);

  if(!slice.length){
    $("studentTableBody").innerHTML='<tr><td colspan="7"><div class="empty-state">Tidak ada siswa yang cocok.</div></td></tr>';
    $("studentCards").innerHTML='<div class="empty-state">Tidak ada siswa yang cocok.</div>'
  }else{
    $("studentTableBody").innerHTML=slice.map((s,i)=>`<tr><td>${start+i+1}</td><td><div class="student-name">${esc(s.full_name)}</div><div class="muted">${isTeacherMode?esc(s.class_name||"-"):esc(s.id.slice(0,8))}</div></td><td><div>${esc(s.nis||"-")}</div><div class="muted">${esc(s.nisn||"-")}</div><div class="muted">NIK: ${esc(s.nik||"-")}</div></td><td>${esc(s.gender||"-")}</td><td><span class="badge">${esc(s.class_name||"Belum ada kelas")}</span></td><td>${esc(s.roll_number??"-")}</td><td>${actionButtons(s)}</td></tr>`).join("");
    $("studentCards").innerHTML=slice.map(s=>`<article class="student-card"><div class="top"><div><h4>${esc(s.full_name)}</h4><p>${esc(s.nis||"NIS belum diisi")} · ${esc(s.nisn||"NISN belum diisi")}<br>NIK: ${esc(s.nik||"-")}</p></div><span class="badge">${esc(s.class_name||"Belum ada kelas")}</span></div><div class="student-meta"><div><b>JK</b><br>${esc(s.gender||"-")}</div><div><b>No. Urut</b><br>${esc(s.roll_number??"-")}</div></div><div class="row-actions">${actionButtons(s)}</div></article>`).join("")
  }

  $("tableInfo").textContent=`${rows.length} siswa · Halaman ${page} dari ${totalPages}`;
  $("prevBtn").disabled=page<=1;$("nextBtn").disabled=page>=totalPages;

  document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>openProfile(b.dataset.view));
  document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>openEdit(b.dataset.edit));
  document.querySelectorAll("[data-disable]").forEach(b=>b.onclick=()=>disableStudent(b.dataset.disable))
}
function profileField(label,value,full=False){
  return `<div class="profile-block ${full?"full":""}"><span>${esc(label)}</span><b>${esc(value||"-")}</b></div>`
}
function openProfile(id){
  const s=allStudents.find(x=>x.id===id);if(!s)return;
  $("profileAvatar").textContent=initials(s.full_name);
  $("profileName").textContent=s.full_name||"Profil Siswa";
  $("profileSubtitle").textContent=`${s.class_name||"Belum ada kelas"} · No. ${s.roll_number??"-"}`;
  const born=[s.birth_place,fmtDate(s.birth_date)].filter(x=>x&&x!=="-").join(", ");
  $("profileGrid").innerHTML=[
    profileField("NIS",s.nis),profileField("NISN",s.nisn),
    profileField("NIK",s.nik),profileField("Jenis Kelamin",s.gender==="L"?"Laki-laki":s.gender==="P"?"Perempuan":"-"),
    profileField("Tempat / Tanggal Lahir",born||"-"),profileField("Tahun Masuk",s.admission_year),
    profileField("Telepon Siswa",s.phone),profileField("No. HP Wali",s.guardian_phone),
    profileField("Nama Ayah",s.father_name),profileField("Nama Ibu",s.mother_name),
    profileField("Nama Wali",s.guardian_name),profileField("KIP / PIP",s.kip_pip_number),
    profileField("Kebutuhan Khusus",s.special_needs||"Tidak Ada"),profileField("Disabilitas",s.disability||"Tidak Ada"),
    profileField("Alamat",s.address||"-",true)
  ].join("");
  $("profileModal").classList.remove("hidden")
}
function closeProfile(){$("profileModal").classList.add("hidden")}

function resetForm(){$("studentForm").reset();$("studentId").value="";$("enrollmentId").value="";$("formMessage").textContent=""}
function openModal(){$("studentModal").classList.remove("hidden")}
function closeModal(){$("studentModal").classList.add("hidden")}
function openAdd(){if(!can("create"))return;resetForm();$("modalTitle").textContent="Tambah Siswa";openModal()}
function openEdit(id){
  if(!can("update"))return;
  const s=allStudents.find(x=>x.id===id);if(!s)return;
  resetForm();$("modalTitle").textContent="Edit Data Siswa";$("studentId").value=s.id;$("enrollmentId").value=s.enrollment_id||"";$("fullName").value=s.full_name||"";$("nis").value=s.nis||"";$("nisn").value=s.nisn||"";$("nik").value=s.nik||"";$("phone").value=s.phone||"";$("gender").value=s.gender||"";$("classId").value=s.class_id||"";$("rollNumber").value=s.roll_number||"";$("admissionYear").value=s.admission_year||"";$("birthPlace").value=s.birth_place||"";$("birthDate").value=s.birth_date||"";$("fatherName").value=s.father_name||"";$("motherName").value=s.mother_name||"";$("guardianName").value=s.guardian_name||"";$("guardianPhone").value=s.guardian_phone||"";$("kipPipNumber").value=s.kip_pip_number||"";$("specialNeeds").value=s.special_needs||"";$("disability").value=s.disability||"";$("address").value=s.address||"";openModal()
}
async function restWrite(path,method,body,prefer="return=representation"){
  const m=String(method||"GET").toUpperCase();
  if(m==="POST" && !can("create"))throw new Error("Izin tambah Data Siswa ditolak.");
  if((m==="PATCH"||m==="PUT") && !can("update") && !can("delete"))throw new Error("Izin perubahan Data Siswa ditolak.");
  if(m==="DELETE" && !can("delete"))throw new Error("Izin hapus Data Siswa ditolak.");

  const session=await api.auth.getSession();if(!session?.access_token)throw new Error("Sesi login tidak ditemukan.");
  const cfg=window.SIMANIS_CONFIG,res=await fetch(`${cfg.SUPABASE_URL.replace(/\/$/,"")}/rest/v1/${path}`,{method,headers:{apikey:cfg.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json",Prefer:prefer},body:body===undefined?undefined:JSON.stringify(body)});
  const text=await res.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text}if(!res.ok)throw new Error(data?.message||data?.error||text||`HTTP ${res.status}`);return data
}
async function saveStudent(e){
  e.preventDefault();
  const saveBtn=$("saveBtn"),studentId=$("studentId").value,enrollmentId=$("enrollmentId").value,classId=$("classId").value||null,roll=$("rollNumber").value?Number($("rollNumber").value):null;

  if(studentId && !can("update")){
    $("formMessage").textContent="Akun tidak memiliki izin mengubah data siswa.";
    return;
  }
  if(!studentId && !can("create")){
    $("formMessage").textContent="Akun tidak memiliki izin menambah data siswa.";
    return;
  }
  const payload={full_name:$("fullName").value.trim(),nis:$("nis").value.trim()||null,nisn:$("nisn").value.trim()||null,nik:$("nik").value.trim()||null,phone:$("phone").value.trim()||null,gender:$("gender").value||null,admission_year:$("admissionYear").value?Number($("admissionYear").value):null,birth_place:$("birthPlace").value.trim()||null,birth_date:$("birthDate").value||null,father_name:$("fatherName").value.trim()||null,mother_name:$("motherName").value.trim()||null,guardian_name:$("guardianName").value.trim()||null,guardian_phone:$("guardianPhone").value.trim()||null,kip_pip_number:$("kipPipNumber").value.trim()||null,special_needs:$("specialNeeds").value.trim()||null,disability:$("disability").value.trim()||null,address:$("address").value.trim()||null,status:"AKTIF"};
  if(!payload.full_name){$("formMessage").textContent="Nama siswa wajib diisi.";return}
  saveBtn.disabled=true;saveBtn.textContent="Menyimpan...";$("formMessage").textContent="";
  try{
    let finalStudentId=studentId;
    if(studentId)await restWrite(`students?id=eq.${encodeURIComponent(studentId)}`,"PATCH",payload);
    else{const inserted=await restWrite("students","POST",payload);finalStudentId=inserted?.[0]?.id;if(!finalStudentId)throw new Error("ID siswa baru tidak diterima.")}
    if(activeSemesterId){
      if(enrollmentId){
        if(classId)await restWrite(`student_enrollments?id=eq.${encodeURIComponent(enrollmentId)}`,"PATCH",{class_id:classId,roll_number:roll,status:"AKTIF"});
        else await restWrite(`student_enrollments?id=eq.${encodeURIComponent(enrollmentId)}`,"PATCH",{status:"PINDAH"})
      }else if(classId)await restWrite("student_enrollments","POST",{student_id:finalStudentId,class_id:classId,semester_id:activeSemesterId,roll_number:roll,status:"AKTIF"})
    }
    closeModal();await loadStudents()
  }catch(err){$("formMessage").textContent="Gagal menyimpan: "+err.message}
  finally{saveBtn.disabled=false;saveBtn.textContent="Simpan"}
}
async function disableStudent(id){
  if(!can("delete"))return;
  const s=allStudents.find(x=>x.id===id);if(!s||!confirm(`Nonaktifkan siswa "${s.full_name}"? Data tidak akan dihapus.`))return;
  try{
    await restWrite(`students?id=eq.${encodeURIComponent(id)}`,"PATCH",{status:"KELUAR"});
    if(s.enrollment_id)await restWrite(`student_enrollments?id=eq.${encodeURIComponent(s.enrollment_id)}`,"PATCH",{status:"PINDAH"});
    await loadStudents()
  }catch(err){alert("Gagal menonaktifkan siswa: "+err.message)}
}

async function boot(){
  try{
    api=await window.simanisReady;
    const session=await api.auth.getSession();if(!session){location.replace("index.html");return}
    const user=await api.auth.getUser();if(!user){location.replace("index.html");return}
    await loadModulePermission();
    profile=await loadProfile(user);applyTeacherUI();
    $("sideUserName").textContent=profile.full_name||user.email||"Pengguna";$("sideUserRole").textContent=formatRole(profile.role);$("headerUser").textContent=profile.full_name||user.email||"Pengguna";$("currentDate").textContent=localDateID();
    await Promise.all([loadMenu(),loadMaster()]);await loadStudents();
    $("addStudentBtn").style.display=can("create")&&!isTeacherMode?"":"none";
    $("logoutBtn").addEventListener("click",async()=>{await api.auth.signOut();location.replace("index.html")})
  }catch(err){console.error(err);alert("Data Siswa gagal dimuat: "+(err.message||err))}
  finally{$("loading").classList.add("hidden")}
}

$("searchInput").addEventListener("input",()=>{page=1;render()});
$("classFilter").addEventListener("change",()=>{page=1;renderClassSummary();render()});
$("genderFilter").addEventListener("change",()=>{page=1;render()});
$("prevBtn").addEventListener("click",()=>{page--;render();window.scrollTo({top:0,behavior:"smooth"})});
$("nextBtn").addEventListener("click",()=>{page++;render();window.scrollTo({top:0,behavior:"smooth"})});
document.querySelectorAll("[data-scope]").forEach(b=>b.addEventListener("click",()=>{
  activeScope=b.dataset.scope;document.querySelectorAll("[data-scope]").forEach(x=>x.classList.toggle("active",x===b));$("classFilter").value="";page=1;renderStats();renderClassSummary();render()
}));
$("addStudentBtn").addEventListener("click",openAdd);
$("closeModalBtn").addEventListener("click",closeModal);$("cancelBtn").addEventListener("click",closeModal);$("studentForm").addEventListener("submit",saveStudent);
$("studentModal").addEventListener("click",e=>{if(e.target===$("studentModal"))closeModal()});
$("closeProfileBtn").addEventListener("click",closeProfile);$("profileModal").addEventListener("click",e=>{if(e.target===$("profileModal"))closeProfile()});

boot();