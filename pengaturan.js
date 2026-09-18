const $=id=>document.getElementById(id);
let api,profile,overview={school:{},academic_years:[],semesters:[],users:[],teachers:[],modules:[],permissions:[]},positionData=[],teacherAccounts=[],lastCredentials=[];
const TEACHER_LOGIN_DOMAIN="akun.manuriska.sch.id";
const ROLES=["SUPER_ADMIN","KEPALA_MADRASAH","TU","WAKA_KURIKULUM","WAKA_KESISWAAN","BENDAHARA","GURU","WALI_KELAS"];
const BRAND_BUCKET="system-branding";

function esc(s){return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}
function roleLabel(r){return String(r||"-").replaceAll("_"," ")}
function fmtDate(v){return v?new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(v+"T00:00:00")):"-"}
function fmtDateTime(v){return v?new Intl.DateTimeFormat("id-ID",{dateStyle:"medium",timeStyle:"short"}).format(new Date(v)):"-"}
function localDateID(){return new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date())}
function routeFor(code){return{DASHBOARD:"dashboard.html",ADMINISTRASI_KEPALA:"administrasi.html",DATA_SISWA:"siswa.html",DATA_GURU:"guru.html",KELAS:"kelas.html",MATA_PELAJARAN:"mapel.html",JADWAL:"jadwal.html",ABSENSI_GURU:"absensi-guru.html",ABSENSI_SISWA:"absensi-siswa.html",NILAI:"nilai.html",PRESTASI:"prestasi.html",BERITA:"berita.html",PENGUMUMAN:"pengumuman.html",AGENDA:"agenda.html",KEUANGAN:"keuangan.html",PORTAL_WALI:"wali-admin.html",PENGATURAN:"pengaturan.html",PKM_KURIKULUM:"unit-kerja.html?unit=PKM_KURIKULUM",PKM_KESISWAAN:"unit-kerja.html?unit=PKM_KESISWAAN",PKM_BENDAHARA_SARPRAS:"unit-kerja.html?unit=PKM_BENDAHARA_SARPRAS",PKM_HUMASY:"unit-kerja.html?unit=PKM_HUMASY",KEPALA_TU:"unit-kerja.html?unit=KEPALA_TU",KALAB_IPA:"unit-kerja.html?unit=KALAB_IPA",KALAB_BISNIS:"unit-kerja.html?unit=KALAB_BISNIS"}[code]||"#"}

async function loadProfile(user){
 const r=await api.db.select("profiles",`select=id,full_name,role,is_active&id=eq.${encodeURIComponent(user.id)}&limit=1`);
 if(!r?.[0])throw new Error("Profil pengguna tidak ditemukan.");
 if(!r[0].is_active)throw new Error("Akun tidak aktif.");
 if(r[0].role!=="SUPER_ADMIN")throw new Error("Pengaturan Sistem hanya dapat diakses SUPER ADMIN.");
 return r[0];
}
async function loadMenu(){
 const m=await api.db.rpc("get_my_modules",{});
 $("sidebarMenu").innerHTML=(m||[]).map(x=>`<a href="${routeFor(x.code)}" class="nav-item ${x.code==="PENGATURAN"?"active":""}"><span class="nav-dot"></span><span>${esc(x.name)}</span></a>`).join("");
}
async function loadOverview(){
 overview=await api.db.rpc("settings_get_overview",{})||{};
 overview.school=overview.school||{};overview.academic_years=overview.academic_years||[];overview.semesters=overview.semesters||[];overview.users=overview.users||[];overview.teachers=overview.teachers||[];overview.modules=overview.modules||[];overview.permissions=overview.permissions||[];
 positionData=await api.db.rpc("settings_get_positions",{})||[];
 try{teacherAccounts=await api.db.rpc("settings_get_teacher_accounts",{})||[]}catch(err){console.warn("Manajemen akun guru belum tersedia:",err);teacherAccounts=[]}
 renderAll();
}
function setTab(name){
 document.querySelectorAll(".settings-tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===name));
 ["Identity","Academic","Users","Teacheraccounts","Permissions","Positions","System"].forEach(x=>$("panel"+x).classList.toggle("hidden",x.toLowerCase()!==name));
}
document.querySelectorAll(".settings-tab").forEach(b=>b.onclick=()=>setTab(b.dataset.tab));

function renderAll(){renderSchool();renderAcademic();renderUsers();renderTeacherAccounts();renderPermissions();renderPositions();renderModules()}

/* IDENTITY */
function field(id,key){$(id).value=overview.school?.[key]||""}
function renderSchool(){
 field("schoolName","school_name");field("schoolShortName","school_short_name");field("foundationName","foundation_name");field("tagline","tagline");field("nsm","nsm");field("npsn","npsn");field("address","address");field("village","village");field("district","district");field("regency","regency");field("province","province");field("postalCode","postal_code");field("schoolPhone","phone");field("schoolEmail","email");field("website","website");field("headmasterName","headmaster_name");
 $("logoPreview").src=overview.school?.logo_url||"logo.png";$("brandSchoolName").textContent=overview.school?.school_name||"MA Nurul Islam";$("brandFoundation").textContent=overview.school?.foundation_name||"-";$("brandTagline").textContent=overview.school?.tagline||"-";
}
function val(id){return $(id).value.trim()||null}
async function saveSchool(e){
 e.preventDefault();const msg=$("schoolMessage");msg.className="message";msg.textContent="Menyimpan...";
 try{
  await api.db.rpc("settings_save_school",{
   p_school_name:val("schoolName"),p_school_short_name:val("schoolShortName"),p_foundation_name:val("foundationName"),p_tagline:val("tagline"),p_nsm:val("nsm"),p_npsn:val("npsn"),p_address:val("address"),p_village:val("village"),p_district:val("district"),p_regency:val("regency"),p_province:val("province"),p_postal_code:val("postalCode"),p_phone:val("schoolPhone"),p_email:val("schoolEmail"),p_website:val("website"),p_headmaster_name:val("headmasterName"),p_logo_path:overview.school?.logo_path||null,p_logo_url:overview.school?.logo_url||null
  });
  await loadOverview();msg.className="message ok";msg.textContent="Identitas madrasah berhasil disimpan.";
 }catch(err){msg.textContent="Gagal: "+err.message}
}
function ext(name){const p=String(name||"").split(".");return p.length>1?p.pop().toLowerCase().replace(/[^a-z0-9]/g,""):"png"}
async function uploadLogo(){
 const file=$("logoFile").files?.[0];if(!file){alert("Pilih file logo terlebih dahulu.");return}
 if(file.size>2*1024*1024){alert("Ukuran logo maksimal 2 MB.");return}
 if(!["image/png","image/jpeg","image/webp"].includes(file.type)){alert("Logo harus PNG, JPG, atau WEBP.");return}
 const btn=$("uploadLogoBtn");btn.disabled=true;btn.textContent="Upload...";
 try{
  const session=await api.auth.getSession();const cfg=window.SIMANIS_CONFIG,stamp=Date.now(),path=`logo-${stamp}.${ext(file.name)}`;
  const res=await fetch(`${cfg.SUPABASE_URL.replace(/\/$/,"")}/storage/v1/object/${BRAND_BUCKET}/${path}`,{method:"POST",headers:{apikey:cfg.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`,"Content-Type":file.type,"x-upsert":"false"},body:file});
  const txt=await res.text();if(!res.ok)throw new Error(txt);
  const url=`${cfg.SUPABASE_URL.replace(/\/$/,"")}/storage/v1/object/public/${BRAND_BUCKET}/${path}`;
  overview.school.logo_path=path;overview.school.logo_url=url;$("logoPreview").src=url;
  await api.db.rpc("settings_save_school",{p_school_name:val("schoolName"),p_school_short_name:val("schoolShortName"),p_foundation_name:val("foundationName"),p_tagline:val("tagline"),p_nsm:val("nsm"),p_npsn:val("npsn"),p_address:val("address"),p_village:val("village"),p_district:val("district"),p_regency:val("regency"),p_province:val("province"),p_postal_code:val("postalCode"),p_phone:val("schoolPhone"),p_email:val("schoolEmail"),p_website:val("website"),p_headmaster_name:val("headmasterName"),p_logo_path:path,p_logo_url:url});
  alert("Logo berhasil diupload dan disimpan.");
 }catch(err){alert("Upload logo gagal: "+err.message)}
 finally{btn.disabled=false;btn.textContent="Upload Logo"}
}

/* ACADEMIC */
function renderAcademic(){
 const years=overview.academic_years||[],sems=overview.semesters||[];
 $("yearList").innerHTML=years.length?years.map(y=>`<div class="period-item"><div><h4>${esc(y.name)} ${y.is_active?'<span class="status-dot active-period">AKTIF</span>':""}</h4><p>${fmtDate(y.start_date)} — ${fmtDate(y.end_date)}</p></div><button class="mini-btn" data-edit-year="${y.id}">Edit</button></div>`).join(""):'<div class="empty-state">Belum ada tahun pelajaran.</div>';
 $("semesterList").innerHTML=sems.length?sems.map(s=>`<div class="period-item"><div><h4>${esc(s.name)} · ${esc(s.academic_year_name)} ${s.is_active?'<span class="status-dot active-period">AKTIF</span>':""}</h4><p>${fmtDate(s.start_date)} — ${fmtDate(s.end_date)}</p></div><button class="mini-btn" data-edit-semester="${s.id}">Edit</button></div>`).join(""):'<div class="empty-state">Belum ada semester.</div>';
 document.querySelectorAll("[data-edit-year]").forEach(b=>b.onclick=()=>openYearModal(b.dataset.editYear));
 document.querySelectorAll("[data-edit-semester]").forEach(b=>b.onclick=()=>openSemesterModal(b.dataset.editSemester));

 $("activeYearSelect").innerHTML=years.map(y=>`<option value="${y.id}">${esc(y.name)}</option>`).join("");
 const activeYear=years.find(y=>y.is_active)||years[0];if(activeYear)$("activeYearSelect").value=activeYear.id;
 renderActiveSemesterOptions();
 $("semesterYear").innerHTML=years.map(y=>`<option value="${y.id}">${esc(y.name)}</option>`).join("");
}
function renderActiveSemesterOptions(){
 const y=$("activeYearSelect").value||overview.academic_years.find(x=>x.is_active)?.id;
 const list=overview.semesters.filter(s=>s.academic_year_id===y);
 $("activeSemesterSelect").innerHTML=list.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join("");
 const active=list.find(s=>s.is_active);if(active)$("activeSemesterSelect").value=active.id;
}
function openPeriodModal(type){$("periodForm").reset();$("periodId").value="";$("periodType").value=type;$("periodFormMessage").textContent="";$("yearFields").classList.toggle("hidden",type!=="year");$("semesterFields").classList.toggle("hidden",type!=="semester");$("periodModalTitle").textContent=type==="year"?"Tambah Tahun Pelajaran":"Tambah Semester";if(type==="semester"){const active=overview.academic_years.find(y=>y.is_active)||overview.academic_years[0];if(active)$("semesterYear").value=active.id}$("periodModal").classList.remove("hidden")}
function openYearModal(id){const y=overview.academic_years.find(x=>x.id===id);if(!y)return;openPeriodModal("year");$("periodId").value=id;$("periodModalTitle").textContent="Edit Tahun Pelajaran";$("yearName").value=y.name||"";$("yearStart").value=y.start_date||"";$("yearEnd").value=y.end_date||""}
function openSemesterModal(id){const s=overview.semesters.find(x=>x.id===id);if(!s)return;openPeriodModal("semester");$("periodId").value=id;$("periodModalTitle").textContent="Edit Semester";$("semesterYear").value=s.academic_year_id;$("semesterName").value=s.name;$("semesterStart").value=s.start_date||"";$("semesterEnd").value=s.end_date||""}
function closePeriodModal(){$("periodModal").classList.add("hidden")}
async function savePeriod(e){
 e.preventDefault();const type=$("periodType").value,msg=$("periodFormMessage");msg.textContent="Menyimpan...";
 try{
  if(type==="year")await api.db.rpc("settings_upsert_academic_year",{p_id:$("periodId").value||null,p_name:$("yearName").value.trim(),p_start_date:$("yearStart").value||null,p_end_date:$("yearEnd").value||null});
  else await api.db.rpc("settings_upsert_semester",{p_id:$("periodId").value||null,p_academic_year_id:$("semesterYear").value,p_name:$("semesterName").value,p_start_date:$("semesterStart").value||null,p_end_date:$("semesterEnd").value||null});
  closePeriodModal();await loadOverview();
 }catch(err){msg.textContent="Gagal: "+err.message}
}
async function activatePeriod(){
 const year=$("activeYearSelect").value,sem=$("activeSemesterSelect").value;if(!year||!sem){alert("Pilih tahun pelajaran dan semester.");return}
 const y=overview.academic_years.find(x=>x.id===year),s=overview.semesters.find(x=>x.id===sem);
 if(!confirm(`Aktifkan ${y?.name||""} - ${s?.name||""} sebagai periode berjalan?\n\nPerubahan ini memengaruhi banyak modul SIMANIS.`))return;
 const msg=$("periodMessage");msg.textContent="Mengaktifkan...";
 try{await api.db.rpc("settings_set_active_period",{p_academic_year_id:year,p_semester_id:sem});await loadOverview();msg.className="message ok";msg.textContent="Periode aktif berhasil diperbarui."}catch(err){msg.className="message";msg.textContent="Gagal: "+err.message}
}

/* USERS */
function renderRoleOptions(){
 const opts=ROLES.map(r=>`<option value="${r}">${roleLabel(r)}</option>`).join("");
 $("userRoleFilter").innerHTML='<option value="">Semua Role</option>'+opts;$("userRole").innerHTML=opts;$("permissionRole").innerHTML=ROLES.filter(r=>r!=="SUPER_ADMIN").map(r=>`<option value="${r}">${roleLabel(r)}</option>`).join("");
}
function filteredUsers(){
 const q=$("userSearch").value.trim().toLowerCase(),role=$("userRoleFilter").value;
 return overview.users.filter(u=>(!role||u.role===role)&&(!q||`${u.full_name||""} ${u.email||""}`.toLowerCase().includes(q)));
}
function renderUsers(){
 renderRoleOptions();const list=filteredUsers();
 $("userBody").innerHTML=list.length?list.map(u=>`<tr><td><b>${esc(u.full_name||"-")}</b><br><span style="color:#73827b">${esc(u.email||"-")}</span></td><td>${esc(roleLabel(u.role))}</td><td>${esc(u.teacher_name||"-")}</td><td><span class="status-dot ${u.is_active?"on":"off"}">${u.is_active?"AKTIF":"NONAKTIF"}</span></td><td>${fmtDateTime(u.last_login_at)}</td><td><button class="mini-btn" data-edit-user="${u.id}">Edit</button></td></tr>`).join(""):'<tr><td colspan="6"><div class="empty-state">Pengguna tidak ditemukan.</div></td></tr>';
 document.querySelectorAll("[data-edit-user]").forEach(b=>b.onclick=()=>openUser(b.dataset.editUser));
}
function openUser(id){
 const u=overview.users.find(x=>x.id===id);if(!u)return;$("userForm").reset();$("userId").value=id;$("userFullName").value=u.full_name||"";$("userPhone").value=u.phone||"";$("userRole").value=u.role;$("userActive").value=String(!!u.is_active);$("userTeacher").innerHTML='<option value="">Tidak terhubung</option>'+overview.teachers.map(t=>`<option value="${t.id}">${esc(t.teacher_code||"-")} · ${esc(t.full_name)}</option>`).join("");$("userTeacher").value=u.teacher_id||"";$("userMessage").textContent="";$("userModal").classList.remove("hidden")
}
function closeUser(){$("userModal").classList.add("hidden")}
async function saveUser(e){
 e.preventDefault();const msg=$("userMessage");msg.textContent="Menyimpan...";
 try{await api.db.rpc("settings_update_user",{p_user_id:$("userId").value,p_full_name:$("userFullName").value.trim(),p_phone:$("userPhone").value.trim()||null,p_role:$("userRole").value,p_is_active:$("userActive").value==="true",p_teacher_id:$("userTeacher").value||null});closeUser();await loadOverview()}catch(err){msg.textContent="Gagal: "+err.message}
}


/* TEACHER ACCOUNTS & JOBDESK */
function accountStatusBadge(a){
 const status=a.account_status||"NO_ACCOUNT";
 const map={
   NO_ACCOUNT:["no","BELUM PUNYA AKUN"],
   MUST_CHANGE:["force","WAJIB GANTI PASSWORD"],
   NEVER_LOGIN:["wait","BELUM PERNAH LOGIN"],
   ACTIVE:["good","AKTIF"],
   INACTIVE:["bad","NONAKTIF"]
 };
 const v=map[status]||["no",status];
 return `<span class="account-badge ${v[0]}">${v[1]}</span>`;
}
function accountJobdeskText(a){
 const p=Array.isArray(a.positions)?a.positions:[];
 return p.length?p.map(x=>x.position_name||x.position_code).join(", "):"Guru";
}
function filteredTeacherAccounts(){
 const q=$("teacherAccountSearch")?.value?.trim().toLowerCase()||"";
 const st=$("teacherAccountStatusFilter")?.value||"";
 const job=$("teacherAccountJobdeskFilter")?.value||"";
 return teacherAccounts.filter(a=>{
   const hay=`${a.teacher_code||""} ${a.full_name||""} ${a.username||""} ${a.email||""}`.toLowerCase();
   const positions=Array.isArray(a.positions)?a.positions:[];
   return(!q||hay.includes(q))&&(!st||a.account_status===st)&&(!job||positions.some(p=>p.position_code===job));
 });
}
function renderTeacherAccounts(){
 const total=teacherAccounts.length;
 const has=teacherAccounts.filter(a=>a.user_id).length;
 $("accTotalTeachers").textContent=total;
 $("accHasAccount").textContent=has;
 $("accMissingAccount").textContent=total-has;
 $("accNeverLogin").textContent=teacherAccounts.filter(a=>a.account_status==="NEVER_LOGIN").length;
 $("accMustChange").textContent=teacherAccounts.filter(a=>a.must_change_password).length;

 $("teacherAccountJobdeskFilter").innerHTML='<option value="">Semua Jobdesk</option>'+positionData.map(p=>`<option value="${p.position_code}">${esc(p.position_name)}</option>`).join("");

 const data=filteredTeacherAccounts();
 $("teacherAccountBody").innerHTML=data.length?data.map(a=>`<tr>
   <td><b>${esc(a.full_name)}</b><br><span style="color:#718078">Kode ${esc(a.teacher_code||"-")}</span></td>
   <td>${a.user_id?`<b>${esc(a.username||"-")}</b><br><span style="color:#718078">${esc(a.email||"-")}</span>`:"-"}</td>
   <td>${a.user_id?esc(roleLabel(a.role||"GURU")):"-"}</td>
   <td>${esc(accountJobdeskText(a))}</td>
   <td>${accountStatusBadge(a)}</td>
   <td>${fmtDateTime(a.last_login_at)}</td>
   <td><div class="account-actions">
      ${a.user_id
        ? `<button class="mini-btn" data-account-reset="${a.user_id}">Reset Password</button><button class="mini-btn" data-account-jobdesk="${a.user_id}">Jobdesk</button><button class="mini-btn" data-edit-user="${a.user_id}">Edit Akun</button>`
        : `<button class="mini-btn" data-account-create="${a.teacher_id}">Buat Akun</button>`
      }
   </div></td>
 </tr>`).join(""):'<tr><td colspan="7"><div class="empty-state">Guru tidak ditemukan.</div></td></tr>';

 document.querySelectorAll("[data-account-create]").forEach(b=>b.onclick=()=>createTeacherAccount(b.dataset.accountCreate));
 document.querySelectorAll("[data-account-reset]").forEach(b=>b.onclick=()=>resetTeacherPassword(b.dataset.accountReset));
 document.querySelectorAll("[data-account-jobdesk]").forEach(b=>b.onclick=()=>openJobdesk(b.dataset.accountJobdesk));
 document.querySelectorAll("#teacherAccountBody [data-edit-user]").forEach(b=>b.onclick=()=>openUser(b.dataset.editUser));

 $("downloadCredentialsBtn").disabled=!lastCredentials.length;
}
async function callTeacherAccountAdmin(action,payload={}){
 const session=await api.auth.getSession();
 if(!session?.access_token)throw new Error("Sesi login tidak ditemukan.");
 const cfg=window.SIMANIS_CONFIG;
 const res=await fetch(`${cfg.SUPABASE_URL.replace(/\/$/,"")}/functions/v1/teacher-account-admin`,{
   method:"POST",
   headers:{
     apikey:cfg.SUPABASE_PUBLISHABLE_KEY,
     Authorization:`Bearer ${session.access_token}`,
     "Content-Type":"application/json"
   },
   body:JSON.stringify({action,login_domain:TEACHER_LOGIN_DOMAIN,...payload})
 });
 const text=await res.text();let body=null;try{body=text?JSON.parse(text):null}catch{body={error:text}}
 if(!res.ok)throw new Error(body?.error||body?.message||text||`HTTP ${res.status}`);
 return body||{};
}
async function createTeacherAccount(teacherId){
 const a=teacherAccounts.find(x=>x.teacher_id===teacherId);
 if(!a)return;
 if(!confirm(`Buat akun SIMANIS untuk ${a.full_name}?`))return;
 const msg=$("teacherAccountMessage");msg.className="message";msg.textContent="Membuat akun...";
 try{
   const result=await callTeacherAccountAdmin("create_teacher",{teacher_id:teacherId});
   const creds=result.credentials?[result.credentials]:[];
   if(creds.length)showCredentials(creds,result.errors||[]);
   await loadOverview();
   msg.className="message ok";msg.textContent="Akun guru berhasil dibuat.";
 }catch(err){msg.textContent="Gagal: "+err.message}
}
async function bulkCreateTeacherAccounts(){
 const missing=teacherAccounts.filter(a=>!a.user_id);
 if(!missing.length){alert("Semua guru aktif sudah memiliki akun.");return}
 if(!confirm(`Buat akun untuk ${missing.length} guru yang belum memiliki akun?\n\nPassword sementara akan dibuat berbeda untuk setiap guru.`))return;
 const btn=$("bulkCreateTeacherAccountsBtn"),msg=$("teacherAccountMessage");
 btn.disabled=true;btn.textContent="Membuat Akun...";msg.className="message";msg.textContent="Memproses akun guru. Jangan tutup halaman...";
 try{
   const result=await callTeacherAccountAdmin("bulk_create",{});
   const creds=result.credentials||[];
   if(creds.length)showCredentials(creds,result.errors||[]);
   await loadOverview();
   msg.className=(result.errors?.length?"message":"message ok");
   msg.textContent=`Selesai. ${creds.length} akun baru dibuat${result.errors?.length?`, ${result.errors.length} gagal diproses.`:"."}`;
 }catch(err){msg.textContent="Gagal: "+err.message}
 finally{btn.disabled=false;btn.textContent="Buat Akun Semua Guru"}
}
async function resetTeacherPassword(userId){
 const a=teacherAccounts.find(x=>x.user_id===userId);
 if(!a)return;
 if(!confirm(`Reset password ${a.full_name}?\n\nPassword lama tidak akan berlaku lagi.`))return;
 const msg=$("teacherAccountMessage");msg.className="message";msg.textContent="Mereset password...";
 try{
   const result=await callTeacherAccountAdmin("reset_password",{user_id:userId});
   if(result.credentials)showCredentials([result.credentials],[]);
   await loadOverview();
   msg.className="message ok";msg.textContent="Password berhasil direset. Guru wajib mengganti password saat login.";
 }catch(err){msg.textContent="Gagal: "+err.message}
}
function showCredentials(creds,errors=[]){
 lastCredentials=(creds||[]).map(x=>({...x}));
 $("credentialBody").innerHTML=lastCredentials.map(c=>`<tr><td><b>${esc(c.full_name||"-")}</b></td><td>${esc(c.teacher_code||"-")}</td><td><b>${esc(c.username||"-")}</b></td><td class="credential-password">${esc(c.temporary_password||"-")}</td></tr>`).join("");
 $("credentialErrors").textContent=errors.length?`${errors.length} guru gagal diproses: `+errors.map(e=>`${e.full_name||e.teacher_code||"?"}: ${e.error}`).join(" | "):"";
 $("credentialModal").classList.remove("hidden");
 $("downloadCredentialsBtn").disabled=!lastCredentials.length;
}
function closeCredentialModal(){$("credentialModal").classList.add("hidden")}
function downloadCredentials(){
 if(!lastCredentials.length){alert("Belum ada daftar akun dari proses terakhir.");return}
 const rows=[["Nama Guru","Kode Guru","Username","Password Sementara"]];
 lastCredentials.forEach(c=>rows.push([c.full_name||"",c.teacher_code||"",c.username||"",c.temporary_password||""]));
 const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");
 const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download=`akun-guru-simanis-${new Date().toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),600);
}
function printCredentials(){
 if(!lastCredentials.length)return;
 const w=window.open("","_blank","width=900,height=700");
 w.document.write(`<html><head><title>Akun Guru SIMANIS</title><style>body{font-family:Arial;padding:24px}h2{color:#075b3a}table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;padding:8px;text-align:left;font-size:12px}th{background:#f1f6f3}.note{font-size:11px;margin:10px 0 18px}</style></head><body><h2>Akun Guru SIMANIS</h2><div class="note">Password bersifat sementara. Guru wajib menggantinya setelah login pertama.</div><table><thead><tr><th>Guru</th><th>Kode</th><th>Username</th><th>Password Sementara</th></tr></thead><tbody>${lastCredentials.map(c=>`<tr><td>${esc(c.full_name)}</td><td>${esc(c.teacher_code)}</td><td>${esc(c.username)}</td><td>${esc(c.temporary_password)}</td></tr>`).join("")}</tbody></table></body></html>`);
 w.document.close();w.focus();setTimeout(()=>w.print(),250);
}
function openJobdesk(userId){
 const a=teacherAccounts.find(x=>x.user_id===userId);if(!a)return;
 $("jobdeskUserId").value=userId;$("jobdeskModalTitle").textContent=`Atur Jobdesk · ${a.full_name}`;$("jobdeskMessage").textContent="";
 $("jobdeskGrid").innerHTML=positionData.map(p=>{
   const mine=p.holder_user_id===userId;
   const holder=p.holder_user_id&&!mine?`Saat ini: ${p.holder_name||p.holder_email||"-"}`:(mine?"Saat ini dipegang guru ini":"Belum ada pemegang");
   return `<div class="jobdesk-item"><label><input type="checkbox" data-jobdesk-position="${p.position_code}" ${mine?"checked":""}><div><b>${esc(p.position_name)}</b><p>${esc(holder)}</p></div></label></div>`
 }).join("");
 $("jobdeskModal").classList.remove("hidden");
}
function closeJobdesk(){$("jobdeskModal").classList.add("hidden")}
async function saveJobdesk(e){
 e.preventDefault();
 const userId=$("jobdeskUserId").value,msg=$("jobdeskMessage");msg.className="message";msg.textContent="Menyimpan jobdesk...";
 try{
   for(const p of positionData){
     const checked=document.querySelector(`[data-jobdesk-position="${p.position_code}"]`)?.checked||false;
     const mine=p.holder_user_id===userId;
     if(checked&&!mine)await api.db.rpc("settings_set_position_holder",{p_position_code:p.position_code,p_user_id:userId});
     else if(!checked&&mine)await api.db.rpc("settings_set_position_holder",{p_position_code:p.position_code,p_user_id:null});
   }
   positionData=await api.db.rpc("settings_get_positions",{})||[];
   teacherAccounts=await api.db.rpc("settings_get_teacher_accounts",{})||[];
   renderPositions();renderTeacherAccounts();closeJobdesk();
   $("teacherAccountMessage").className="message ok";$("teacherAccountMessage").textContent="Jobdesk guru berhasil diperbarui.";
 }catch(err){msg.textContent="Gagal: "+err.message}
}

/* PERMISSIONS */
function renderPermissions(){
 const role=$("permissionRole").value||ROLES.find(r=>r!=="SUPER_ADMIN");if(!$("permissionRole").value)$("permissionRole").value=role;
 const list=overview.permissions.filter(p=>p.role===role).sort((a,b)=>a.module_sort_order-b.module_sort_order);
 $("permissionBody").innerHTML=list.map(p=>`<tr><td><b>${esc(p.module_name)}</b><br><span style="color:#7c8983">${esc(p.module_code)}</span></td><td><input class="perm-check" type="checkbox" data-perm="view" data-module="${p.module_code}" ${p.can_view?"checked":""} ${p.module_code==="PENGATURAN"?"disabled":""}></td><td><input class="perm-check" type="checkbox" data-perm="create" data-module="${p.module_code}" ${p.can_create?"checked":""} ${p.module_code==="PENGATURAN"?"disabled":""}></td><td><input class="perm-check" type="checkbox" data-perm="update" data-module="${p.module_code}" ${p.can_update?"checked":""} ${p.module_code==="PENGATURAN"?"disabled":""}></td><td><input class="perm-check" type="checkbox" data-perm="delete" data-module="${p.module_code}" ${p.can_delete?"checked":""} ${p.module_code==="PENGATURAN"?"disabled":""}></td><td>${p.module_code==="PENGATURAN"?'<span style="font-size:8px;color:#777">Terkunci</span>':`<button class="mini-btn" data-save-perm="${p.module_code}">Simpan</button>`}</td></tr>`).join("");
 document.querySelectorAll("[data-save-perm]").forEach(b=>b.onclick=()=>savePermission(b.dataset.savePerm));
}
async function savePermission(moduleCode){
 const role=$("permissionRole").value,row=[...$("permissionBody").querySelectorAll(`input[data-module="${moduleCode}"]`)],get=t=>row.find(x=>x.dataset.perm===t)?.checked||false;
 try{await api.db.rpc("settings_set_permission",{p_role:role,p_module_code:moduleCode,p_can_view:get("view"),p_can_create:get("create"),p_can_update:get("update"),p_can_delete:get("delete")});await loadOverview();$("permissionRole").value=role;renderPermissions()}catch(err){alert("Gagal menyimpan hak akses: "+err.message)}
}


/* STRUCTURAL POSITIONS */
function renderPositions(){
 const holderOptions=overview.users
   .filter(u=>u.is_active)
   .sort((a,b)=>String(a.full_name||"").localeCompare(String(b.full_name||""),"id"));
 $("positionGrid").innerHTML=positionData.map(p=>`<article class="module-card">
   <h4>${esc(p.position_name)}</h4>
   <p>Akses menu khusus: ${esc(p.module_code)}</p>
   <label style="margin-top:9px"><span>Pemegang Jabatan</span>
     <select data-position-user="${p.position_code}">
       <option value="">— Belum ditetapkan —</option>
       ${holderOptions.map(u=>`<option value="${u.id}" ${u.id===p.holder_user_id?"selected":""}>${esc(u.full_name||u.email||"-")} · ${esc(roleLabel(u.role))}</option>`).join("")}
     </select>
   </label>
   <div style="margin-top:8px;font-size:8px;color:#6c7b74">${p.holder_user_id?`Saat ini: <b>${esc(p.holder_name||"-")}</b>${p.holder_email?` · ${esc(p.holder_email)}`:""}`:"Belum ada pemegang jabatan."}</div>
   <div class="module-controls"><button class="mini-btn" data-save-position="${p.position_code}">Simpan Penugasan</button></div>
 </article>`).join("");
 document.querySelectorAll("[data-save-position]").forEach(b=>b.onclick=()=>savePositionHolder(b.dataset.savePosition));
}
async function savePositionHolder(code){
 const select=document.querySelector(`[data-position-user="${code}"]`),userId=select?.value||null;
 const pos=positionData.find(p=>p.position_code===code);
 const name=select?.selectedOptions?.[0]?.textContent||"belum ditetapkan";
 if(!confirm(`Simpan pemegang ${pos?.position_name||code} menjadi ${name}?`))return;
 const msg=$("positionMessage");msg.className="message";msg.textContent="Menyimpan penugasan...";
 try{
   await api.db.rpc("settings_set_position_holder",{p_position_code:code,p_user_id:userId});
   positionData=await api.db.rpc("settings_get_positions",{})||[];
   renderPositions();
   msg.className="message ok";msg.textContent="Penugasan jabatan berhasil diperbarui.";
 }catch(err){msg.textContent="Gagal: "+err.message}
}

/* MODULES / SYSTEM */
function renderModules(){
 $("moduleGrid").innerHTML=overview.modules.map(m=>`<article class="module-card"><h4>${esc(m.name)}</h4><p>${esc(m.code)} · ${esc(m.route||"-")}</p><div class="module-controls"><label style="display:flex;gap:5px;align-items:center;font-size:8px"><input type="checkbox" data-module-active="${m.code}" ${m.is_active?"checked":""} ${["DASHBOARD","PENGATURAN"].includes(m.code)?"disabled":""}> Aktif</label><input type="number" min="0" data-module-order="${m.code}" value="${Number(m.sort_order||0)}"><button class="mini-btn" data-save-module="${m.code}">Simpan</button></div></article>`).join("");
 document.querySelectorAll("[data-save-module]").forEach(b=>b.onclick=()=>saveModule(b.dataset.saveModule));
}
async function saveModule(code){
 const active=document.querySelector(`[data-module-active="${code}"]`)?.checked??true,order=Number(document.querySelector(`[data-module-order="${code}"]`)?.value||0);
 try{await api.db.rpc("settings_set_module",{p_module_code:code,p_is_active:active,p_sort_order:order});await loadOverview()}catch(err){alert("Gagal menyimpan modul: "+err.message)}
}
function exportConfig(){
 const safe={exported_at:new Date().toISOString(),school:overview.school,academic_years:overview.academic_years,semesters:overview.semesters,users:overview.users.map(({id,email,full_name,username,phone,role,is_active,teacher_id,teacher_name})=>({id,email,full_name,username,phone,role,is_active,teacher_id,teacher_name})),modules:overview.modules,permissions:overview.permissions};
 const blob=new Blob([JSON.stringify(safe,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`simanis-konfigurasi-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)
}

/* EVENTS */
$("schoolForm").onsubmit=saveSchool;$("uploadLogoBtn").onclick=uploadLogo;
$("addYearBtn").onclick=()=>openPeriodModal("year");$("addSemesterBtn").onclick=()=>openPeriodModal("semester");$("periodModalClose").onclick=closePeriodModal;$("periodCancelBtn").onclick=closePeriodModal;$("periodForm").onsubmit=savePeriod;$("activeYearSelect").onchange=renderActiveSemesterOptions;$("activatePeriodBtn").onclick=activatePeriod;
$("userSearch").oninput=renderUsers;$("userRoleFilter").onchange=renderUsers;$("userModalClose").onclick=closeUser;$("userCancelBtn").onclick=closeUser;$("userForm").onsubmit=saveUser;
$("teacherAccountSearch").oninput=renderTeacherAccounts;$("teacherAccountStatusFilter").onchange=renderTeacherAccounts;$("teacherAccountJobdeskFilter").onchange=renderTeacherAccounts;
$("bulkCreateTeacherAccountsBtn").onclick=bulkCreateTeacherAccounts;$("downloadCredentialsBtn").onclick=downloadCredentials;
$("credentialModalClose").onclick=closeCredentialModal;$("credentialDownloadBtn").onclick=downloadCredentials;$("credentialPrintBtn").onclick=printCredentials;
$("jobdeskModalClose").onclick=closeJobdesk;$("jobdeskCancelBtn").onclick=closeJobdesk;$("jobdeskForm").onsubmit=saveJobdesk;

$("permissionRole").onchange=renderPermissions;$("exportConfigBtn").onclick=exportConfig;$("refreshBtn").onclick=loadOverview;
$("periodModal").onclick=e=>{if(e.target===$("periodModal"))closePeriodModal()};$("userModal").onclick=e=>{if(e.target===$("userModal"))closeUser()};$("credentialModal").onclick=e=>{if(e.target===$("credentialModal"))closeCredentialModal()};$("jobdeskModal").onclick=e=>{if(e.target===$("jobdeskModal"))closeJobdesk()};

(async()=>{
 try{
  api=await window.simanisReady;const user=await api.auth.getUser();if(!user){location.href="index.html";return}
  profile=await loadProfile(user);$("sideUserName").textContent=profile.full_name||"Pengguna";$("sideUserRole").textContent=roleLabel(profile.role);$("headerUser").textContent=profile.full_name||"Pengguna";$("currentDate").textContent=localDateID();
  await loadMenu();await loadOverview();$("logoutBtn").onclick=async()=>{await api.auth.signOut();location.href="index.html"}
 }catch(err){console.error(err);alert("Pengaturan Sistem gagal dimuat: "+err.message)}
 finally{$("loading").style.display="none"}
})();
