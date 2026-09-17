const $=id=>document.getElementById(id);
let api,profile,rows=[],students=[],teachers=[],academicYears=[],activeYear=null,attachmentRows=[];
const STORAGE_BUCKET="prestasi-bukti";
const MAX_FILE_SIZE=10*1024*1024;
const ALLOWED_MIME=new Set(["application/pdf","image/jpeg","image/png","image/webp","image/heic","image/heif"]);

function esc(s){return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}
function formatRole(r){return (r||"-").replaceAll("_"," ")}
function localDateID(){return new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date())}
function routeFor(code){return {DASHBOARD:"dashboard.html",ADMINISTRASI_KEPALA:"administrasi.html",DATA_SISWA:"siswa.html",DATA_GURU:"guru.html",KELAS:"kelas.html",MATA_PELAJARAN:"mapel.html",JADWAL:"jadwal.html",ABSENSI_GURU:"absensi-guru.html",ABSENSI_SISWA:"absensi-siswa.html",NILAI:"nilai.html",PRESTASI:"prestasi.html"}[code]||"#"}
function canCreate(){return ["SUPER_ADMIN","TU","WAKA_KESISWAAN","GURU","WALI_KELAS"].includes(profile?.role)}
function canEdit(r){return ["SUPER_ADMIN","TU","WAKA_KESISWAAN"].includes(profile?.role)||r.created_by===profile?.id}
function canDelete(r){return ["SUPER_ADMIN","WAKA_KESISWAAN"].includes(profile?.role)||(["GURU","WALI_KELAS"].includes(profile?.role)&&r.created_by===profile?.id)}
function canDeleteAttachment(f){return ["SUPER_ADMIN","TU","WAKA_KESISWAAN"].includes(profile?.role)||f.uploaded_by===profile?.id}
function filesForAchievement(id){return attachmentRows.filter(f=>f.achievement_id===id)}
function formatBytes(n){n=Number(n||0);if(n<1024)return `${n} B`;if(n<1024*1024)return `${(n/1024).toFixed(1)} KB`;return `${(n/1024/1024).toFixed(1)} MB`}

async function loadProfile(user){const r=await api.db.select("profiles",`select=id,full_name,role,is_active&id=eq.${encodeURIComponent(user.id)}&limit=1`);if(!r?.[0])throw new Error("Profil pengguna tidak ditemukan.");if(!r[0].is_active)throw new Error("Akun tidak aktif.");return r[0]}
async function loadMenu(){const m=await api.db.rpc("get_my_modules",{});$("sidebarMenu").innerHTML=(m||[]).map(x=>`<a href="${routeFor(x.code)}" class="nav-item ${x.code==="PRESTASI"?"active":""}"><span class="nav-dot"></span><span>${esc(x.name)}</span></a>`).join("");document.querySelectorAll('.nav-item[href="#"]').forEach(a=>a.onclick=e=>{e.preventDefault();alert(`Modul "${a.textContent.trim()}" akan diaktifkan bertahap.`)})}

function inferSchoolYearName(dateStr){if(!dateStr)return "";const p=dateStr.slice(0,10).split("-").map(Number);if(p.length!==3||!p[0]||!p[1])return "";const y=p[0],m=p[1];return m>=7?`${y}/${y+1}`:`${y-1}/${y}`}
function academicYearForDate(dateStr){if(!dateStr)return null;const d=dateStr.slice(0,10);const byRange=academicYears.find(y=>y.start_date&&y.end_date&&d>=y.start_date&&d<=y.end_date);if(byRange)return byRange;const label=inferSchoolYearName(d);return academicYears.find(y=>y.name===label)||null}
function effectiveYearId(r){return academicYearForDate(r.event_date)?.id||r.academic_year_id||""}
function effectiveYearName(r){return academicYearForDate(r.event_date)?.name||r.academic_year||inferSchoolYearName(r.event_date)||"-"}
function selectedYearName(){const v=$("yearFilter").value;if(!v)return "Semua tahun pelajaran";return academicYears.find(y=>y.id===v)?.name||"Tahun pelajaran"}

async function loadMaster(){
  const [yrs,ss,tt]=await Promise.all([
    api.db.select("academic_years","select=id,name,start_date,end_date,is_active&order=start_date.desc.nullslast,name.desc"),
    api.db.select("v_students_current","select=id,full_name,class_id,class_name&order=class_name.asc,full_name.asc"),
    api.db.select("teachers","select=id,full_name,teacher_code&is_active=eq.true&order=teacher_code.asc")
  ]);
  academicYears=yrs||[];activeYear=academicYears.find(y=>y.is_active)||academicYears[0]||null;students=ss||[];teachers=tt||[];
  $("students").innerHTML=students.map(s=>`<option value="${s.id}" data-class="${s.class_id||""}">${esc(s.class_name||"Tanpa Kelas")} · ${esc(s.full_name)}</option>`).join("");
  $("advisorTeacher").innerHTML='<option value="">Tanpa pembina</option>'+teachers.map(t=>`<option value="${t.id}">${esc(t.full_name)}</option>`).join("");
  const yearOptions=academicYears.map(y=>`<option value="${y.id}">${esc(y.name)}${y.is_active?" · Aktif":""}</option>`).join("");
  $("yearFilter").innerHTML='<option value="">Semua Tahun Pelajaran</option>'+yearOptions;$("academicYear").innerHTML=yearOptions;
  const classNames=[...new Set(students.map(s=>s.class_name).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"id",{numeric:true}));
  $("classFilter").innerHTML='<option value="">Semua Kelas</option>'+classNames.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join("");
  if(activeYear){$("yearFilter").value=activeYear.id;$("academicYear").value=activeYear.id}
}

async function loadData(){
  const [a,f]=await Promise.all([
    api.db.select("v_achievements_detail","select=*&order=event_date.desc.nullslast,created_at.desc"),
    api.db.select("achievement_files","select=id,achievement_id,file_type,storage_path,original_name,mime_type,size_bytes,uploaded_by,created_at&order=created_at.asc")
  ]);
  rows=a||[];attachmentRows=f||[];render();
}
function yearScoped(){const yr=$("yearFilter").value;return rows.filter(r=>!yr||effectiveYearId(r)===yr)}
function filtered(){
  const q=$("searchInput").value.trim().toLowerCase(),cat=$("categoryFilter").value,lvl=$("levelFilter").value,cls=$("classFilter").value;
  return yearScoped().filter(r=>{
    const hay=`${r.title||""} ${r.competition_name||""} ${r.participant_names||""} ${r.advisor_name||""} ${r.achievement||""} ${r.organizer||""}`.toLowerCase();
    const classes=String(r.class_names||"").split(",").map(x=>x.trim()).filter(Boolean);
    return (!q||hay.includes(q))&&(!cat||r.category===cat)&&(!lvl||r.level===lvl)&&(!cls||classes.includes(cls));
  })
}


function render(){
  const data=filtered(),scopeName=selectedYearName();
  $("statTotal").textContent=data.length;
  $("statNational").textContent=data.filter(r=>["NASIONAL","INTERNASIONAL"].includes(r.level)).length;
  $("statTeam").textContent=data.filter(r=>r.participant_type==="TIM").length;
  $("statParticipants").textContent=data.reduce((a,r)=>a+Number(r.participant_count||0),0);
  $("statYearLabel").textContent=scopeName;
  $("addBtn").disabled=!canCreate();

  if(!data.length){
    $("achievementGrid").innerHTML=`<div class="empty-state" style="grid-column:1/-1">Belum ada data prestasi untuk ${esc(scopeName.toLowerCase())} yang cocok dengan filter.</div>`;
    return;
  }

  $("achievementGrid").innerHTML=data.map(r=>{
    const fs=filesForAchievement(r.id),
          certs=fs.filter(f=>f.file_type==="CERTIFICATE"),
          evidence=fs.filter(f=>f.file_type==="EVIDENCE");

    return `<article class="ach-card">
      <div class="ach-head">
        <div class="ach-pills">
          <span class="pill p-year">TP ${esc(effectiveYearName(r))}</span>
          <span class="pill p-level">${esc(r.level)}</span>
          <span class="pill p-cat">${esc(r.category)}</span>
        </div>
        <span class="pill p-rank">${esc(r.achievement)}</span>
      </div>

      <h3>${esc(r.title)}</h3>
      <p><b>${esc(r.competition_name)}</b></p>
      <p>${r.event_date?new Date(r.event_date+'T00:00:00').toLocaleDateString('id-ID'):"Tanggal belum diisi"}${r.organizer?` · ${esc(r.organizer)}`:""}</p>

      <div class="ach-meta">
        <div><b>Peserta</b><br>${esc(r.participant_names||"-")}</div>
        <div><b>Kelas</b><br>${esc(r.class_names||"-")}</div>
        <div><b>Pembina</b><br>${esc(r.advisor_name||"-")}</div>
        <div><b>Jenis</b><br>${esc(r.participant_type)} · ${Number(r.participant_count||0)} siswa</div>
      </div>

      <div class="link-row">
        ${certs.map(f=>`<button class="file-btn" type="button" data-open-file="${f.id}">📄 ${esc(f.original_name)}</button>`).join("")}
        ${evidence.map(f=>`<button class="file-btn" type="button" data-open-file="${f.id}">📷 ${esc(f.original_name)}</button>`).join("")}
        ${r.certificate_url?`<a href="${esc(r.certificate_url)}" target="_blank" rel="noopener">Sertifikat eksternal ↗</a>`:""}
        ${r.evidence_url?`<a href="${esc(r.evidence_url)}" target="_blank" rel="noopener">Bukti eksternal ↗</a>`:""}
      </div>

      <div class="ach-actions">
        ${canEdit(r)?`<button class="mini-btn" data-edit="${r.id}">Edit</button>`:""}
        ${fs.length?`<span class="file-count">${fs.length} berkas</span>`:""}
      </div>
    </article>`;
  }).join("");

  document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>openEdit(b.dataset.edit));
  document.querySelectorAll("[data-open-file]").forEach(b=>b.onclick=()=>openStoredFile(b.dataset.openFile));
}

function humanDate(dateStr){return dateStr?new Date(dateStr+"T00:00:00").toLocaleDateString("id-ID",{day:"2-digit",month:"long",year:"numeric"}):"-"}
function reportFilterLabel(){
  const parts=[];
  parts.push(`TP: ${selectedYearName()}`);
  if($("classFilter").value)parts.push(`Kelas: ${$("classFilter").value}`);
  if($("categoryFilter").value)parts.push(`Kategori: ${$("categoryFilter").value}`);
  if($("levelFilter").value)parts.push(`Tingkat: ${$("levelFilter").value}`);
  if($("searchInput").value.trim())parts.push(`Pencarian: ${$("searchInput").value.trim()}`);
  return parts.join(" · ");
}
function reportFilename(ext){
  const year=selectedYearName().replaceAll("/","-").replace(/\s+/g,"-").toLowerCase();
  const cls=($("classFilter").value||"semua-kelas").replace(/\s+/g,"-").toLowerCase();
  return `rekap-prestasi-${year}-${cls}.${ext}`;
}
function csvCell(v){return `"${String(v??"").replaceAll('"','""')}"`}
function exportCsv(){
  const data=filtered();
  if(!data.length){alert("Tidak ada data prestasi pada filter saat ini.");return}
  const header=["No","Tahun Pelajaran","Tanggal","Judul Prestasi","Lomba/Kegiatan","Kategori","Tingkat","Capaian","Jenis Peserta","Jumlah Peserta","Peserta","Kelas","Pembina","Penyelenggara","Lokasi"];
  const lines=[header.map(csvCell).join(";")];
  data.forEach((r,i)=>lines.push([
    i+1,effectiveYearName(r),r.event_date||"",r.title||"",r.competition_name||"",r.category||"",r.level||"",r.achievement||"",
    r.participant_type||"",Number(r.participant_count||0),r.participant_names||"",r.class_names||"",r.advisor_name||"",r.organizer||"",r.location||""
  ].map(csvCell).join(";")));
  const blob=new Blob(["\ufeffsep=;\r\n"+lines.join("\r\n")],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=reportFilename("csv");document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function printReport(){
  const data=filtered();
  if(!data.length){alert("Tidak ada data prestasi pada filter saat ini.");return}
  const totalParticipants=data.reduce((a,r)=>a+Number(r.participant_count||0),0);
  const national=data.filter(r=>["NASIONAL","INTERNASIONAL"].includes(r.level)).length;
  const team=data.filter(r=>r.participant_type==="TIM").length;
  const rowsHtml=data.map((r,i)=>`<tr>
    <td>${i+1}</td>
    <td>${esc(humanDate(r.event_date))}</td>
    <td>${esc(r.title||"-")}<br><small>${esc(r.competition_name||"-")}</small></td>
    <td>${esc(r.category||"-")}</td>
    <td>${esc(r.level||"-")}</td>
    <td><b>${esc(r.achievement||"-")}</b></td>
    <td>${esc(r.participant_names||"-")}<br><small>${esc(r.class_names||"-")}</small></td>
    <td>${esc(r.advisor_name||"-")}</td>
    <td>${esc(r.organizer||"-")}</td>
  </tr>`).join("");
  const w=window.open("","_blank");
  if(!w){alert("Popup diblokir browser. Izinkan popup untuk mencetak rekap.");return}
  const today=new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",day:"2-digit",month:"long",year:"numeric"}).format(new Date());
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Rekap Prestasi</title><style>
    @page{size:A4 landscape;margin:12mm}
    *{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;margin:0;font-size:10px}
    .kop{text-align:center;border-bottom:3px double #111;padding-bottom:8px;margin-bottom:12px}.kop h1{font-size:18px;margin:0}.kop h2{font-size:14px;margin:3px 0}.kop p{margin:2px 0}
    .title{text-align:center;margin:12px 0}.title h3{font-size:14px;margin:0 0 4px}.filters{font-size:9px;color:#444}
    .summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0}.sum{border:1px solid #bbb;padding:7px;border-radius:6px}.sum b{display:block;font-size:16px}
    table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #999;padding:5px;vertical-align:top}th{background:#eee;text-align:left;font-size:9px}td{font-size:8.5px}small{font-size:7.5px;color:#444}
    .foot{margin-top:16px;display:flex;justify-content:space-between;gap:40px}.sign{width:260px;text-align:center;line-height:1.5}.space{height:55px}
    .meta{display:flex;justify-content:space-between;margin-top:5px;color:#555;font-size:8px}
  </style></head><body>
    <div class="kop"><h1>MA NURUL ISLAM KARANGCEMPAKA</h1><h2>SIMANIS — SISTEM INFORMASI MA NURUL ISLAM</h2><p>Rekapitulasi Prestasi Siswa</p></div>
    <div class="title"><h3>REKAP PRESTASI SISWA</h3><div class="filters">${esc(reportFilterLabel())}</div></div>
    <div class="summary">
      <div class="sum"><span>Total Prestasi</span><b>${data.length}</b></div>
      <div class="sum"><span>Nasional + Internasional</span><b>${national}</b></div>
      <div class="sum"><span>Prestasi Tim</span><b>${team}</b></div>
      <div class="sum"><span>Akumulasi Peserta</span><b>${totalParticipants}</b></div>
    </div>
    <table><thead><tr><th>No</th><th>Tanggal</th><th>Prestasi / Kegiatan</th><th>Kategori</th><th>Tingkat</th><th>Capaian</th><th>Peserta / Kelas</th><th>Pembina</th><th>Penyelenggara</th></tr></thead><tbody>${rowsHtml}</tbody></table>
    <div class="meta"><span>Dicetak dari SIMANIS</span><span>${today}</span></div>
    <div class="foot">
      <div class="sign">Mengetahui,<br>Kepala Madrasah<div class="space"></div><b>__________________________</b></div>
      <div class="sign">Karangcempaka, ${today}<br>Waka Kesiswaan<div class="space"></div><b>__________________________</b></div>
    </div>
  </body></html>`);
  w.document.close();
  w.focus();
  setTimeout(()=>w.print(),400);
}

function syncYearFromDate(){const d=$("eventDate").value;const y=academicYearForDate(d);if(y){$("academicYear").value=y.id;$("academicYearHint").textContent=`Otomatis dari tanggal: TP ${y.name}.`;return}const inferred=inferSchoolYearName(d);$("academicYearHint").textContent=inferred?`Tanggal ini termasuk TP ${inferred}, tetapi tahun tersebut belum ada di master.`:"Pilih tanggal untuk menyesuaikan tahun pelajaran otomatis."}
function clearUploadInputs(){$("certificateFile").value="";$("evidenceFiles").value=""}
function renderStoredFiles(achievementId){const holder=$("storedFiles");if(!achievementId){holder.innerHTML='<span class="field-hint">Berkas akan muncul setelah prestasi pertama kali disimpan.</span>';return}const fs=filesForAchievement(achievementId);if(!fs.length){holder.innerHTML='<span class="field-hint">Belum ada berkas tersimpan.</span>';return}holder.innerHTML=fs.map(f=>`<div class="stored-file"><div class="stored-file-info"><div class="stored-file-name">${f.file_type==="CERTIFICATE"?"📄":"📷"} ${esc(f.original_name)}</div><div class="stored-file-meta">${esc(f.file_type==="CERTIFICATE"?"Sertifikat":"Bukti/Foto")} · ${formatBytes(f.size_bytes)}</div></div><div class="file-actions"><button class="file-btn" type="button" data-modal-open-file="${f.id}">Buka</button>${canDeleteAttachment(f)?`<button class="file-btn danger" type="button" data-delete-file="${f.id}">Hapus</button>`:""}</div></div>`).join("");holder.querySelectorAll("[data-modal-open-file]").forEach(b=>b.onclick=()=>openStoredFile(b.dataset.modalOpenFile));holder.querySelectorAll("[data-delete-file]").forEach(b=>b.onclick=()=>deleteStoredFile(b.dataset.deleteFile))}
function openAdd(){if(!canCreate())return;$("form").reset();$("achievementId").value="";$("modalTitle").textContent="Tambah Prestasi";$("deleteBtn").style.display="none";$("students").selectedIndex=-1;if(activeYear)$("academicYear").value=activeYear.id;$("academicYearHint").textContent=activeYear?`Default TP aktif: ${activeYear.name}. Pilih tanggal agar menyesuaikan otomatis.`:"Pilih tahun pelajaran.";$("formMessage").textContent="";clearUploadInputs();renderStoredFiles("");$("modal").classList.remove("hidden")}
async function openEdit(id){const r=rows.find(x=>x.id===id);if(!r||!canEdit(r))return;$("form").reset();$("achievementId").value=r.id;$("modalTitle").textContent="Edit Prestasi";$("title").value=r.title||"";$("competitionName").value=r.competition_name||"";$("category").value=r.category;$("level").value=r.level;$("achievement").value=r.achievement||"";$("eventDate").value=r.event_date||"";$("participantType").value=r.participant_type||"INDIVIDU";$("advisorTeacher").value=r.advisor_teacher_id||"";$("organizer").value=r.organizer||"";$("location").value=r.location||"";$("certificateUrl").value=r.certificate_url||"";$("evidenceUrl").value=r.evidence_url||"";$("note").value=r.note||"";const effYear=academicYearForDate(r.event_date)||academicYears.find(y=>y.id===r.academic_year_id);if(effYear)$("academicYear").value=effYear.id;syncYearFromDate();const ps=await api.db.select("achievement_students",`select=student_id,class_id&achievement_id=eq.${encodeURIComponent(id)}`)||[];const ids=new Set(ps.map(x=>x.student_id));[...$("students").options].forEach(o=>o.selected=ids.has(o.value));$("deleteBtn").style.display=canDelete(r)?"":"none";$("formMessage").textContent="";clearUploadInputs();renderStoredFiles(id);$("modal").classList.remove("hidden")}
function closeModal(){$("modal").classList.add("hidden")}

async function restWrite(path,method,body,prefer="return=representation"){const session=await api.auth.getSession();if(!session?.access_token)throw new Error("Sesi login tidak ditemukan.");const cfg=window.SIMANIS_CONFIG;const res=await fetch(`${cfg.SUPABASE_URL.replace(/\/$/,"")}/rest/v1/${path}`,{method,headers:{apikey:cfg.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json",Prefer:prefer},body:body===undefined?undefined:JSON.stringify(body)});const text=await res.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text}if(!res.ok)throw new Error(data?.message||data?.error||text||`HTTP ${res.status}`);return data}
function encodedStoragePath(path){return path.split("/").map(encodeURIComponent).join("/")}
function fileExtension(name){const p=(name||"").split(".");return p.length>1?p.pop().toLowerCase().replace(/[^a-z0-9]/g,""):"bin"}
function safeMime(file){return file.type||({pdf:"application/pdf",jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp",heic:"image/heic",heif:"image/heif"}[fileExtension(file.name)]||"")}
function validateFile(file){const mime=safeMime(file);if(!ALLOWED_MIME.has(mime))throw new Error(`Format file ${file.name} tidak didukung.`);if(file.size>MAX_FILE_SIZE)throw new Error(`${file.name} lebih dari 10 MB.`);return mime}
async function storageUpload(file,achievementId,fileType){const mime=validateFile(file);const session=await api.auth.getSession();if(!session?.access_token)throw new Error("Sesi login tidak ditemukan.");const cfg=window.SIMANIS_CONFIG,ext=fileExtension(file.name),rand=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;const path=`${achievementId}/${fileType.toLowerCase()}/${rand}.${ext}`;const res=await fetch(`${cfg.SUPABASE_URL.replace(/\/$/,"")}/storage/v1/object/${STORAGE_BUCKET}/${encodedStoragePath(path)}`,{method:"POST",headers:{apikey:cfg.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`,"Content-Type":mime,"x-upsert":"false"},body:file});const text=await res.text();if(!res.ok){let msg=text;try{const j=JSON.parse(text);msg=j.message||j.error||text}catch{}throw new Error(`Upload ${file.name} gagal: ${msg}`)}return {path,mime}}
async function storageDelete(path){const session=await api.auth.getSession();if(!session?.access_token)throw new Error("Sesi login tidak ditemukan.");const cfg=window.SIMANIS_CONFIG;const res=await fetch(`${cfg.SUPABASE_URL.replace(/\/$/,"")}/storage/v1/object/${STORAGE_BUCKET}/${encodedStoragePath(path)}`,{method:"DELETE",headers:{apikey:cfg.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`}});if(!res.ok){const text=await res.text();throw new Error(text||`HTTP ${res.status}`)}}
async function storageBlob(path){const session=await api.auth.getSession();if(!session?.access_token)throw new Error("Sesi login tidak ditemukan.");const cfg=window.SIMANIS_CONFIG;const res=await fetch(`${cfg.SUPABASE_URL.replace(/\/$/,"")}/storage/v1/object/authenticated/${STORAGE_BUCKET}/${encodedStoragePath(path)}`,{headers:{apikey:cfg.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`}});if(!res.ok){const text=await res.text();throw new Error(text||`HTTP ${res.status}`)}return res.blob()}
async function openStoredFile(id){const f=attachmentRows.find(x=>x.id===id);if(!f)return;const tab=window.open("","_blank");try{if(tab){tab.document.write('<p style="font-family:sans-serif;padding:24px">Memuat berkas...</p>')}const blob=await storageBlob(f.storage_path),url=URL.createObjectURL(blob);if(tab)tab.location.href=url;else window.location.href=url;setTimeout(()=>URL.revokeObjectURL(url),120000)}catch(err){if(tab)tab.close();alert("Berkas gagal dibuka: "+err.message)}}
async function uploadSelectedFiles(achievementId){const jobs=[];const cert=$("certificateFile").files?.[0];if(cert)jobs.push({file:cert,type:"CERTIFICATE"});for(const file of [...($("evidenceFiles").files||[])])jobs.push({file,type:"EVIDENCE"});for(const job of jobs){const up=await storageUpload(job.file,achievementId,job.type);try{await restWrite("achievement_files","POST",{achievement_id:achievementId,file_type:job.type,storage_path:up.path,original_name:job.file.name,mime_type:up.mime,size_bytes:job.file.size})}catch(err){try{await storageDelete(up.path)}catch{}throw err}}}
async function deleteStoredFile(id){const f=attachmentRows.find(x=>x.id===id);if(!f||!canDeleteAttachment(f))return;if(!confirm(`Hapus berkas "${f.original_name}"?`))return;try{await storageDelete(f.storage_path);await restWrite(`achievement_files?id=eq.${encodeURIComponent(f.id)}`,"DELETE",undefined,"return=minimal");attachmentRows=attachmentRows.filter(x=>x.id!==f.id);renderStoredFiles($("achievementId").value);render()}catch(err){alert("Gagal menghapus berkas: "+err.message)}}

async function save(e){e.preventDefault();const selected=[...$("students").selectedOptions];if(!selected.length){$("formMessage").textContent="Pilih minimal satu siswa.";return}if($("participantType").value==="INDIVIDU"&&selected.length!==1){$("formMessage").textContent="Prestasi individu harus memiliki tepat satu siswa.";return}const eventDate=$("eventDate").value||null,mappedYear=academicYearForDate(eventDate),academicYearId=mappedYear?.id||$("academicYear").value||activeYear?.id;if(!academicYearId){$("formMessage").textContent="Tahun pelajaran belum tersedia.";return}const btn=$("saveBtn");btn.disabled=true;btn.textContent="Menyimpan...";try{const id=$("achievementId").value;const payload={academic_year_id:academicYearId,title:$("title").value.trim(),competition_name:$("competitionName").value.trim(),category:$("category").value,level:$("level").value,achievement:$("achievement").value.trim(),event_date:eventDate,organizer:$("organizer").value.trim()||null,location:$("location").value.trim()||null,participant_type:$("participantType").value,advisor_teacher_id:$("advisorTeacher").value||null,certificate_url:$("certificateUrl").value.trim()||null,evidence_url:$("evidenceUrl").value.trim()||null,note:$("note").value.trim()||null};let achId=id;if(id)await restWrite(`achievements?id=eq.${encodeURIComponent(id)}`,"PATCH",payload);else{const ins=await restWrite("achievements","POST",payload);achId=ins?.[0]?.id;if(!achId)throw new Error("ID prestasi tidak diterima.")}await restWrite(`achievement_students?achievement_id=eq.${encodeURIComponent(achId)}`,"DELETE",undefined,"return=minimal");const parts=selected.map((o,i)=>({achievement_id:achId,student_id:o.value,class_id:o.dataset.class||null,is_team_leader:i===0&&$("participantType").value==="TIM"}));await restWrite("achievement_students","POST",parts);await uploadSelectedFiles(achId);closeModal();await loadData()}catch(err){$("formMessage").textContent="Gagal menyimpan: "+err.message}finally{btn.disabled=false;btn.textContent="Simpan"}}

async function remove(){const id=$("achievementId").value;if(!id)return;const r=rows.find(x=>x.id===id);if(!r||!canDelete(r))return;if(!confirm(`Hapus prestasi "${r.title}" beserta semua berkas buktinya?`))return;try{const fs=filesForAchievement(id);for(const f of fs)await storageDelete(f.storage_path);await restWrite(`achievements?id=eq.${encodeURIComponent(id)}`,"DELETE",undefined,"return=minimal");closeModal();await loadData()}catch(err){alert("Gagal menghapus: "+err.message)}}

$("searchInput").addEventListener("input",render);$("yearFilter").addEventListener("change",render);$("classFilter").addEventListener("change",render);$("categoryFilter").addEventListener("change",render);$("levelFilter").addEventListener("change",render);$("printBtn").addEventListener("click",printReport);$("csvBtn").addEventListener("click",exportCsv);$("eventDate").addEventListener("change",syncYearFromDate);$("addBtn").addEventListener("click",openAdd);$("closeModal").addEventListener("click",closeModal);$("cancelBtn").addEventListener("click",closeModal);$("deleteBtn").addEventListener("click",remove);$("form").addEventListener("submit",save);$("modal").addEventListener("click",e=>{if(e.target===$("modal"))closeModal()});

(async function boot(){try{api=await window.simanisReady;const session=await api.auth.getSession();if(!session){location.replace("index.html");return}const user=await api.auth.getUser();if(!user){location.replace("index.html");return}profile=await loadProfile(user);$("sideUserName").textContent=profile.full_name||user.email||"Pengguna";$("sideUserRole").textContent=formatRole(profile.role);$("headerUser").textContent=profile.full_name||user.email||"Pengguna";$("currentDate").textContent=localDateID();await Promise.all([loadMenu(),loadMaster()]);await loadData();$("logoutBtn").onclick=async()=>{await api.auth.signOut();location.replace("index.html")}}catch(err){console.error(err);alert("Modul Prestasi gagal dimuat: "+(err.message||err))}finally{$("loading").classList.add("hidden")}})();
