const $=id=>document.getElementById(id);
let api,profile,rows=[],students=[],teachers=[],academicYears=[],activeYear=null;

function esc(s){return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}
function formatRole(r){return (r||"-").replaceAll("_"," ")}
function localDateID(){return new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date())}
function routeFor(code){return {DASHBOARD:"dashboard.html",ADMINISTRASI_KEPALA:"administrasi.html",DATA_SISWA:"siswa.html",DATA_GURU:"guru.html",KELAS:"kelas.html",MATA_PELAJARAN:"mapel.html",JADWAL:"jadwal.html",ABSENSI_GURU:"absensi-guru.html",ABSENSI_SISWA:"absensi-siswa.html",NILAI:"nilai.html",PRESTASI:"prestasi.html"}[code]||"#"}
function canCreate(){return ["SUPER_ADMIN","TU","WAKA_KESISWAAN","GURU","WALI_KELAS"].includes(profile?.role)}
function canEdit(r){return ["SUPER_ADMIN","TU","WAKA_KESISWAAN"].includes(profile?.role)||r.created_by===profile?.id}
function canDelete(r){return ["SUPER_ADMIN","WAKA_KESISWAAN"].includes(profile?.role)||(["GURU","WALI_KELAS"].includes(profile?.role)&&r.created_by===profile?.id)}

async function loadProfile(user){const r=await api.db.select("profiles",`select=id,full_name,role,is_active&id=eq.${encodeURIComponent(user.id)}&limit=1`);if(!r?.[0])throw new Error("Profil pengguna tidak ditemukan.");if(!r[0].is_active)throw new Error("Akun tidak aktif.");return r[0]}
async function loadMenu(){const m=await api.db.rpc("get_my_modules",{});$("sidebarMenu").innerHTML=(m||[]).map(x=>`<a href="${routeFor(x.code)}" class="nav-item ${x.code==="PRESTASI"?"active":""}"><span class="nav-dot"></span><span>${esc(x.name)}</span></a>`).join("");document.querySelectorAll('.nav-item[href="#"]').forEach(a=>a.onclick=e=>{e.preventDefault();alert(`Modul "${a.textContent.trim()}" akan diaktifkan bertahap.`)})}

function inferSchoolYearName(dateStr){
  if(!dateStr)return "";
  const p=dateStr.slice(0,10).split("-").map(Number);
  if(p.length!==3||!p[0]||!p[1])return "";
  const y=p[0],m=p[1];
  return m>=7?`${y}/${y+1}`:`${y-1}/${y}`;
}
function academicYearForDate(dateStr){
  if(!dateStr)return null;
  const d=dateStr.slice(0,10);
  const byRange=academicYears.find(y=>y.start_date&&y.end_date&&d>=y.start_date&&d<=y.end_date);
  if(byRange)return byRange;
  const label=inferSchoolYearName(d);
  return academicYears.find(y=>y.name===label)||null;
}
function effectiveYearId(r){return academicYearForDate(r.event_date)?.id||r.academic_year_id||""}
function effectiveYearName(r){return academicYearForDate(r.event_date)?.name||r.academic_year||inferSchoolYearName(r.event_date)||"-"}
function selectedYearName(){const v=$("yearFilter").value;if(!v)return "Semua tahun pelajaran";return academicYears.find(y=>y.id===v)?.name||"Tahun pelajaran"}

async function loadMaster(){
  const [yrs,ss,tt]=await Promise.all([
    api.db.select("academic_years","select=id,name,start_date,end_date,is_active&order=start_date.desc.nullslast,name.desc"),
    api.db.select("v_students_current","select=id,full_name,class_id,class_name&order=class_name.asc,full_name.asc"),
    api.db.select("teachers","select=id,full_name,teacher_code&is_active=eq.true&order=teacher_code.asc")
  ]);
  academicYears=yrs||[];
  activeYear=academicYears.find(y=>y.is_active)||academicYears[0]||null;
  students=ss||[];teachers=tt||[];

  $("students").innerHTML=students.map(s=>`<option value="${s.id}" data-class="${s.class_id||""}">${esc(s.class_name||"Tanpa Kelas")} · ${esc(s.full_name)}</option>`).join("");
  $("advisorTeacher").innerHTML='<option value="">Tanpa pembina</option>'+teachers.map(t=>`<option value="${t.id}">${esc(t.full_name)}</option>`).join("");

  const yearOptions=academicYears.map(y=>`<option value="${y.id}">${esc(y.name)}${y.is_active?" · Aktif":""}</option>`).join("");
  $("yearFilter").innerHTML='<option value="">Semua Tahun Pelajaran</option>'+yearOptions;
  $("academicYear").innerHTML=yearOptions;
  if(activeYear){$("yearFilter").value=activeYear.id;$("academicYear").value=activeYear.id}
}

async function loadData(){rows=await api.db.select("v_achievements_detail","select=*&order=event_date.desc.nullslast,created_at.desc")||[];render()}
function yearScoped(){const yr=$("yearFilter").value;return rows.filter(r=>!yr||effectiveYearId(r)===yr)}
function filtered(){const q=$("searchInput").value.trim().toLowerCase(),cat=$("categoryFilter").value,lvl=$("levelFilter").value;return yearScoped().filter(r=>{const hay=`${r.title||""} ${r.competition_name||""} ${r.participant_names||""} ${r.advisor_name||""} ${r.achievement||""}`.toLowerCase();return (!q||hay.includes(q))&&(!cat||r.category===cat)&&(!lvl||r.level===lvl)})}
function render(){
  const scope=yearScoped(),data=filtered(),scopeName=selectedYearName();
  $("statTotal").textContent=scope.length;
  $("statNational").textContent=scope.filter(r=>["NASIONAL","INTERNASIONAL"].includes(r.level)).length;
  $("statTeam").textContent=scope.filter(r=>r.participant_type==="TIM").length;
  $("statParticipants").textContent=scope.reduce((a,r)=>a+Number(r.participant_count||0),0);
  $("statYearLabel").textContent=scopeName;
  $("addBtn").disabled=!canCreate();
  if(!data.length){$("achievementGrid").innerHTML=`<div class="empty-state" style="grid-column:1/-1">Belum ada data prestasi untuk ${esc(scopeName.toLowerCase())} yang cocok dengan filter.</div>`;return}
  $("achievementGrid").innerHTML=data.map(r=>`<article class="ach-card"><div class="ach-head"><div class="ach-pills"><span class="pill p-year">TP ${esc(effectiveYearName(r))}</span><span class="pill p-level">${esc(r.level)}</span><span class="pill p-cat">${esc(r.category)}</span></div><span class="pill p-rank">${esc(r.achievement)}</span></div><h3>${esc(r.title)}</h3><p><b>${esc(r.competition_name)}</b></p><p>${r.event_date?new Date(r.event_date+'T00:00:00').toLocaleDateString('id-ID'):"Tanggal belum diisi"}${r.organizer?` · ${esc(r.organizer)}`:""}</p><div class="ach-meta"><div><b>Peserta</b><br>${esc(r.participant_names||"-")}</div><div><b>Kelas</b><br>${esc(r.class_names||"-")}</div><div><b>Pembina</b><br>${esc(r.advisor_name||"-")}</div><div><b>Jenis</b><br>${esc(r.participant_type)} · ${Number(r.participant_count||0)} siswa</div></div><div class="link-row">${r.certificate_url?`<a href="${esc(r.certificate_url)}" target="_blank" rel="noopener">Sertifikat ↗</a>`:""}${r.evidence_url?`<a href="${esc(r.evidence_url)}" target="_blank" rel="noopener">Bukti/Foto ↗</a>`:""}</div><div class="ach-actions">${canEdit(r)?`<button class="mini-btn" data-edit="${r.id}">Edit</button>`:""}</div></article>`).join("");
  document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>openEdit(b.dataset.edit));
}

function syncYearFromDate(){
  const d=$("eventDate").value;
  const y=academicYearForDate(d);
  if(y){$("academicYear").value=y.id;$("academicYearHint").textContent=`Otomatis dari tanggal: TP ${y.name}.`;return}
  const inferred=inferSchoolYearName(d);
  $("academicYearHint").textContent=inferred?`Tanggal ini termasuk TP ${inferred}, tetapi tahun tersebut belum ada di master.`:"Pilih tanggal untuk menyesuaikan tahun pelajaran otomatis.";
}
function openAdd(){if(!canCreate())return;$("form").reset();$("achievementId").value="";$("modalTitle").textContent="Tambah Prestasi";$("deleteBtn").style.display="none";$("students").selectedIndex=-1;if(activeYear)$("academicYear").value=activeYear.id;$("academicYearHint").textContent=activeYear?`Default TP aktif: ${activeYear.name}. Pilih tanggal agar menyesuaikan otomatis.`:"Pilih tahun pelajaran.";$("formMessage").textContent="";$("modal").classList.remove("hidden")}
async function openEdit(id){
  const r=rows.find(x=>x.id===id);if(!r||!canEdit(r))return;
  $("form").reset();$("achievementId").value=r.id;$("modalTitle").textContent="Edit Prestasi";$("title").value=r.title||"";$("competitionName").value=r.competition_name||"";$("category").value=r.category;$("level").value=r.level;$("achievement").value=r.achievement||"";$("eventDate").value=r.event_date||"";$("participantType").value=r.participant_type||"INDIVIDU";$("advisorTeacher").value=r.advisor_teacher_id||"";$("organizer").value=r.organizer||"";$("location").value=r.location||"";$("certificateUrl").value=r.certificate_url||"";$("evidenceUrl").value=r.evidence_url||"";$("note").value=r.note||"";
  const effYear=academicYearForDate(r.event_date)||academicYears.find(y=>y.id===r.academic_year_id);if(effYear)$("academicYear").value=effYear.id;syncYearFromDate();
  const ps=await api.db.select("achievement_students",`select=student_id,class_id&achievement_id=eq.${encodeURIComponent(id)}`)||[];const ids=new Set(ps.map(x=>x.student_id));[...$("students").options].forEach(o=>o.selected=ids.has(o.value));$("deleteBtn").style.display=canDelete(r)?"":"none";$("formMessage").textContent="";$("modal").classList.remove("hidden");
}
function closeModal(){$("modal").classList.add("hidden")}

async function restWrite(path,method,body,prefer="return=representation"){const session=await api.auth.getSession();if(!session?.access_token)throw new Error("Sesi login tidak ditemukan.");const cfg=window.SIMANIS_CONFIG;const res=await fetch(`${cfg.SUPABASE_URL.replace(/\/$/,"")}/rest/v1/${path}`,{method,headers:{apikey:cfg.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json",Prefer:prefer},body:body===undefined?undefined:JSON.stringify(body)});const text=await res.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text}if(!res.ok)throw new Error(data?.message||data?.error||text||`HTTP ${res.status}`);return data}

async function save(e){
  e.preventDefault();
  const selected=[...$("students").selectedOptions];
  if(!selected.length){$("formMessage").textContent="Pilih minimal satu siswa.";return}
  if($("participantType").value==="INDIVIDU"&&selected.length!==1){$("formMessage").textContent="Prestasi individu harus memiliki tepat satu siswa.";return}
  const eventDate=$("eventDate").value||null;
  const mappedYear=academicYearForDate(eventDate);
  const academicYearId=mappedYear?.id||$("academicYear").value||activeYear?.id;
  if(!academicYearId){$("formMessage").textContent="Tahun pelajaran belum tersedia.";return}

  const btn=$("saveBtn");btn.disabled=true;btn.textContent="Menyimpan...";
  try{
    const id=$("achievementId").value;
    const payload={academic_year_id:academicYearId,title:$("title").value.trim(),competition_name:$("competitionName").value.trim(),category:$("category").value,level:$("level").value,achievement:$("achievement").value.trim(),event_date:eventDate,organizer:$("organizer").value.trim()||null,location:$("location").value.trim()||null,participant_type:$("participantType").value,advisor_teacher_id:$("advisorTeacher").value||null,certificate_url:$("certificateUrl").value.trim()||null,evidence_url:$("evidenceUrl").value.trim()||null,note:$("note").value.trim()||null};
    let achId=id;
    if(id)await restWrite(`achievements?id=eq.${encodeURIComponent(id)}`,"PATCH",payload);
    else{const ins=await restWrite("achievements","POST",payload);achId=ins?.[0]?.id;if(!achId)throw new Error("ID prestasi tidak diterima.")}
    await restWrite(`achievement_students?achievement_id=eq.${encodeURIComponent(achId)}`,"DELETE",undefined,"return=minimal");
    const parts=selected.map((o,i)=>({achievement_id:achId,student_id:o.value,class_id:o.dataset.class||null,is_team_leader:i===0&&$("participantType").value==="TIM"}));
    await restWrite("achievement_students","POST",parts);
    closeModal();await loadData();
  }catch(err){$("formMessage").textContent="Gagal menyimpan: "+err.message}
  finally{btn.disabled=false;btn.textContent="Simpan"}
}

async function remove(){const id=$("achievementId").value;if(!id)return;const r=rows.find(x=>x.id===id);if(!r||!canDelete(r))return;if(!confirm(`Hapus prestasi "${r.title}"?`))return;try{await restWrite(`achievements?id=eq.${encodeURIComponent(id)}`,"DELETE",undefined,"return=minimal");closeModal();await loadData()}catch(err){alert("Gagal menghapus: "+err.message)}}

$("searchInput").addEventListener("input",render);$("yearFilter").addEventListener("change",render);$("categoryFilter").addEventListener("change",render);$("levelFilter").addEventListener("change",render);$("eventDate").addEventListener("change",syncYearFromDate);$("addBtn").addEventListener("click",openAdd);$("closeModal").addEventListener("click",closeModal);$("cancelBtn").addEventListener("click",closeModal);$("deleteBtn").addEventListener("click",remove);$("form").addEventListener("submit",save);$("modal").addEventListener("click",e=>{if(e.target===$("modal"))closeModal()});

(async function boot(){try{api=await window.simanisReady;const session=await api.auth.getSession();if(!session){location.replace("index.html");return}const user=await api.auth.getUser();if(!user){location.replace("index.html");return}profile=await loadProfile(user);$("sideUserName").textContent=profile.full_name||user.email||"Pengguna";$("sideUserRole").textContent=formatRole(profile.role);$("headerUser").textContent=profile.full_name||user.email||"Pengguna";$("currentDate").textContent=localDateID();await Promise.all([loadMenu(),loadMaster()]);await loadData();$("logoutBtn").onclick=async()=>{await api.auth.signOut();location.replace("index.html")}}catch(err){console.error(err);alert("Modul Prestasi gagal dimuat: "+(err.message||err))}finally{$("loading").classList.add("hidden")}})();
