const $=id=>document.getElementById(id);
let api,profile,rows=[],fileRows=[],classes=[],modulePerm={can_view:false,can_create:false,can_update:false,can_delete:false};
const STORAGE_BUCKET="pengumuman-files";
const MAX_FILE_SIZE=10*1024*1024;
const ALLOWED_MIME=new Set([
  "application/pdf","image/jpeg","image/png","image/webp",
  "application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
]);

function esc(s){return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}
function formatRole(r){return (r||"-").replaceAll("_"," ")}
function localDateID(){return new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date())}
function routeFor(code){return {DASHBOARD:"dashboard.html",ADMINISTRASI_KEPALA:"administrasi.html",DATA_SISWA:"siswa.html",DATA_GURU:"guru.html",KELAS:"kelas.html",MATA_PELAJARAN:"mapel.html",JADWAL:"jadwal.html",ABSENSI_GURU:"absensi-guru.html",ABSENSI_SISWA:"absensi-siswa.html",NILAI:"nilai.html",PRESTASI:"prestasi.html",BERITA:"berita.html",PENGUMUMAN:"pengumuman.html"}[code]||"#"}
function canCreate(){return !!modulePerm.can_create}
function canUpdate(){return !!modulePerm.can_update}
function canDelete(){return !!modulePerm.can_delete}

async function loadProfile(user){
  const r=await api.db.select("profiles",`select=id,full_name,role,is_active&id=eq.${encodeURIComponent(user.id)}&limit=1`);
  if(!r?.[0])throw new Error("Profil pengguna tidak ditemukan.");
  if(!r[0].is_active)throw new Error("Akun tidak aktif.");
  return r[0];
}
async function loadMenu(){
  const m=await api.db.rpc("get_my_modules",{});
  const current=(m||[]).find(x=>x.code==="PENGUMUMAN");
  if(current)modulePerm=current;
  $("sidebarMenu").innerHTML=(m||[]).map(x=>`<a href="${routeFor(x.code)}" class="nav-item ${x.code==="PENGUMUMAN"?"active":""}"><span class="nav-dot"></span><span>${esc(x.name)}</span></a>`).join("");
  document.querySelectorAll('.nav-item[href="#"]').forEach(a=>a.onclick=e=>{e.preventDefault();alert(`Modul "${a.textContent.trim()}" akan diaktifkan bertahap.`)});
}
async function loadMaster(){
  classes=await api.db.select("v_classes_current","select=id,name&is_active=eq.true&order=grade_level.asc,name.asc")||[];
  $("targetClass").innerHTML='<option value="">Pilih kelas</option>'+classes.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");
}
async function loadData(){
  const [a,f]=await Promise.all([
    api.db.select("v_announcements_detail","select=*&order=is_pinned.desc,start_at.desc.nullslast,created_at.desc"),
    api.db.select("announcement_files","select=*&order=created_at.asc")
  ]);
  rows=a||[];fileRows=f||[];
  render();
}
function filesFor(id){return fileRows.filter(f=>f.announcement_id===id)}
function effectiveStatus(r){
  if(r.status==="DRAFT")return "DRAFT";
  if(r.status==="ARCHIVED")return "ARCHIVED";
  const now=Date.now(),start=r.start_at?new Date(r.start_at).getTime():null,end=r.end_at?new Date(r.end_at).getTime():null;
  if(start&&start>now)return "TERJADWAL";
  if(end&&end<now)return "BERAKHIR";
  return "AKTIF";
}
function filtered(){
  const q=$("searchInput").value.trim().toLowerCase(),cat=$("categoryFilter").value,prio=$("priorityFilter").value,st=$("statusFilter").value;
  return rows.filter(r=>{
    const hay=`${r.title||""} ${r.content||""} ${r.created_by_name||""} ${r.target_class_name||""}`.toLowerCase();
    return (!q||hay.includes(q))&&(!cat||r.category===cat)&&(!prio||r.priority===prio)&&(!st||effectiveStatus(r)===st);
  });
}
function audienceLabel(r){
  if(r.audience==="KELAS_TERTENTU")return `Kelas ${r.target_class_name||"-"}`;
  return {SELURUH_MADRASAH:"Seluruh Madrasah",GURU_PEGAWAI:"Guru & Pegawai",SISWA:"Seluruh Siswa"}[r.audience]||r.audience;
}
function dateLabel(v){
  if(!v)return "-";
  return new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(v));
}
function statusClass(st){return {AKTIF:"p-active",TERJADWAL:"p-scheduled",DRAFT:"p-draft",BERAKHIR:"p-expired",ARCHIVED:"p-archived"}[st]||"p-draft"}
function priorityClass(p){return {NORMAL:"p-normal",PENTING:"p-important",MENDESAK:"p-urgent"}[p]||"p-normal"}
function excerpt(s,max=260){const t=String(s||"").replace(/\s+/g," ").trim();return t.length>max?t.slice(0,max).trim()+"…":t}

function render(){
  const data=filtered();
  $("statActive").textContent=rows.filter(r=>effectiveStatus(r)==="AKTIF").length;
  $("statScheduled").textContent=rows.filter(r=>effectiveStatus(r)==="TERJADWAL").length;
  $("statDraft").textContent=rows.filter(r=>effectiveStatus(r)==="DRAFT").length;
  $("statPriority").textContent=rows.filter(r=>["PENTING","MENDESAK"].includes(r.priority)&&["AKTIF","TERJADWAL"].includes(effectiveStatus(r))).length;
  $("addBtn").style.display=canCreate()?"":"none";

  if(!data.length){
    $("announceGrid").innerHTML='<div class="empty-state" style="grid-column:1/-1">Belum ada pengumuman yang cocok dengan filter.</div>';
    return;
  }

  $("announceGrid").innerHTML=data.map(r=>{
    const st=effectiveStatus(r),fs=filesFor(r.id);
    return `<article class="announce-card ${r.is_pinned?"pinned":""}">
      <div class="announce-head">
        <div class="announce-pills">
          <span class="pill p-cat">${esc(r.category)}</span>
          <span class="pill ${priorityClass(r.priority)}">${esc(r.priority)}</span>
          <span class="pill ${statusClass(st)}">${esc(st)}</span>
        </div>
        ${r.is_pinned?'<span class="pin-icon" title="Disematkan">📌</span>':""}
      </div>
      <h3>${esc(r.title)}</h3>
      <div class="announce-content">${esc(excerpt(r.content))}</div>
      <div class="announce-meta">
        <div><b>Sasaran</b>${esc(audienceLabel(r))}</div>
        <div><b>Pembuat</b>${esc(r.created_by_name||"SIMANIS")}</div>
        <div><b>Mulai</b>${esc(dateLabel(r.start_at||r.created_at))}</div>
        <div><b>Berakhir</b>${esc(r.end_at?dateLabel(r.end_at):"Tanpa batas")}</div>
      </div>
      <div class="file-list">
        ${fs.map(f=>`<button class="file-btn" type="button" data-open-file="${f.id}">📎 ${esc(f.original_name)}</button>`).join("")}
      </div>
      <div class="announce-actions">
        ${canUpdate()?`<button class="mini-btn" data-edit="${r.id}">Edit</button>`:""}
        ${fs.length?`<span style="font-size:9px;color:var(--muted)">${fs.length} lampiran</span>`:""}
      </div>
    </article>`;
  }).join("");

  document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>openEdit(b.dataset.edit));
  document.querySelectorAll("[data-open-file]").forEach(b=>b.onclick=()=>openStoredFile(b.dataset.openFile));
}

function toLocalInput(iso){
  if(!iso)return "";
  const d=new Date(iso),pad=n=>String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(v){return v?new Date(v).toISOString():null}
function toggleTargetClass(){
  const isClass=$("audience").value==="KELAS_TERTENTU";
  $("targetClassWrap").classList.toggle("hidden",!isClass);
  $("targetClass").required=isClass;
  if(!isClass)$("targetClass").value="";
}
function formatBytes(n){n=Number(n||0);if(n<1024)return `${n} B`;if(n<1048576)return `${(n/1024).toFixed(1)} KB`;return `${(n/1048576).toFixed(1)} MB`}
function renderStoredFiles(id){
  const fs=filesFor(id),holder=$("storedFiles");
  if(!id){holder.innerHTML='<span class="field-hint">Lampiran akan muncul setelah pengumuman pertama kali disimpan.</span>';return}
  if(!fs.length){holder.innerHTML='<span class="field-hint">Belum ada lampiran tersimpan.</span>';return}
  holder.innerHTML=fs.map(f=>`<div class="stored-file">
    <div><div class="stored-file-name">📎 ${esc(f.original_name)}</div><div class="stored-file-meta">${formatBytes(f.size_bytes)}</div></div>
    <div class="file-actions">
      <button class="file-btn" type="button" data-modal-open="${f.id}">Buka</button>
      ${canUpdate()?`<button class="file-btn danger" type="button" data-file-delete="${f.id}">Hapus</button>`:""}
    </div>
  </div>`).join("");
  holder.querySelectorAll("[data-modal-open]").forEach(b=>b.onclick=()=>openStoredFile(b.dataset.modalOpen));
  holder.querySelectorAll("[data-file-delete]").forEach(b=>b.onclick=()=>deleteStoredFile(b.dataset.fileDelete));
}
function openAdd(){
  if(!canCreate())return;
  $("form").reset();$("announcementId").value="";$("modalTitle").textContent="Buat Pengumuman";$("status").value="DRAFT";$("priority").value="NORMAL";$("audience").value="SELURUH_MADRASAH";
  $("deleteBtn").style.display="none";$("formMessage").textContent="";toggleTargetClass();renderStoredFiles("");$("modal").classList.remove("hidden");
}
function openEdit(id){
  const r=rows.find(x=>x.id===id);if(!r||!canUpdate())return;
  $("form").reset();$("announcementId").value=r.id;$("modalTitle").textContent="Edit Pengumuman";
  $("title").value=r.title||"";$("content").value=r.content||"";$("category").value=r.category||"UMUM";$("priority").value=r.priority||"NORMAL";
  $("audience").value=r.audience||"SELURUH_MADRASAH";toggleTargetClass();$("targetClass").value=r.target_class_id||"";
  $("status").value=r.status||"DRAFT";$("startAt").value=toLocalInput(r.start_at);$("endAt").value=toLocalInput(r.end_at);$("pinned").checked=!!r.is_pinned;
  $("deleteBtn").style.display=canDelete()?"":"none";$("formMessage").textContent="";renderStoredFiles(r.id);$("modal").classList.remove("hidden");
}
function closeModal(){$("modal").classList.add("hidden")}

async function restWrite(path,method,body,prefer="return=representation"){
  const session=await api.auth.getSession();if(!session?.access_token)throw new Error("Sesi login tidak ditemukan.");
  const cfg=window.SIMANIS_CONFIG;
  const res=await fetch(`${cfg.SUPABASE_URL.replace(/\/$/,"")}/rest/v1/${path}`,{
    method,
    headers:{apikey:cfg.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json",Prefer:prefer},
    body:body===undefined?undefined:JSON.stringify(body)
  });
  const text=await res.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
  if(!res.ok)throw new Error(data?.message||data?.error||text||`HTTP ${res.status}`);
  return data;
}
function encodedPath(path){return path.split("/").map(encodeURIComponent).join("/")}
function ext(name){const p=String(name||"").split(".");return p.length>1?p.pop().toLowerCase().replace(/[^a-z0-9]/g,""):"bin"}
function mime(file){
  return file.type||({
    pdf:"application/pdf",jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp",
    doc:"application/msword",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls:"application/vnd.ms-excel",xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  }[ext(file.name)]||"");
}
function validateFile(file){
  const m=mime(file);
  if(!ALLOWED_MIME.has(m))throw new Error(`Format ${file.name} tidak didukung.`);
  if(file.size>MAX_FILE_SIZE)throw new Error(`${file.name} lebih dari 10 MB.`);
  return m;
}
async function storageUpload(file,announcementId){
  const m=validateFile(file),session=await api.auth.getSession();if(!session?.access_token)throw new Error("Sesi login tidak ditemukan.");
  const cfg=window.SIMANIS_CONFIG,rand=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const path=`${announcementId}/${rand}.${ext(file.name)}`;
  const res=await fetch(`${cfg.SUPABASE_URL.replace(/\/$/,"")}/storage/v1/object/${STORAGE_BUCKET}/${encodedPath(path)}`,{
    method:"POST",
    headers:{apikey:cfg.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`,"Content-Type":m,"x-upsert":"false"},
    body:file
  });
  const text=await res.text();if(!res.ok){let msg=text;try{const j=JSON.parse(text);msg=j.message||j.error||text}catch{}throw new Error(`Upload ${file.name} gagal: ${msg}`)}
  return {path,mime:m};
}
async function storageDelete(path){
  const session=await api.auth.getSession();if(!session?.access_token)throw new Error("Sesi login tidak ditemukan.");
  const cfg=window.SIMANIS_CONFIG,res=await fetch(`${cfg.SUPABASE_URL.replace(/\/$/,"")}/storage/v1/object/${STORAGE_BUCKET}/${encodedPath(path)}`,{
    method:"DELETE",headers:{apikey:cfg.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`}
  });
  if(!res.ok)throw new Error(await res.text());
}
async function storageBlob(path){
  const session=await api.auth.getSession();if(!session?.access_token)throw new Error("Sesi login tidak ditemukan.");
  const cfg=window.SIMANIS_CONFIG,res=await fetch(`${cfg.SUPABASE_URL.replace(/\/$/,"")}/storage/v1/object/authenticated/${STORAGE_BUCKET}/${encodedPath(path)}`,{
    headers:{apikey:cfg.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`}
  });
  if(!res.ok)throw new Error(await res.text());
  return res.blob();
}
async function openStoredFile(id){
  const f=fileRows.find(x=>x.id===id);if(!f)return;
  const tab=window.open("","_blank");
  try{
    if(tab)tab.document.write('<p style="font-family:sans-serif;padding:24px">Memuat lampiran...</p>');
    const blob=await storageBlob(f.storage_path),url=URL.createObjectURL(blob);
    if(tab)tab.location.href=url;else location.href=url;
    setTimeout(()=>URL.revokeObjectURL(url),120000);
  }catch(err){if(tab)tab.close();alert("Lampiran gagal dibuka: "+err.message)}
}
async function uploadSelectedFiles(id){
  for(const file of [...($("attachments").files||[])]){
    const up=await storageUpload(file,id);
    try{
      await restWrite("announcement_files","POST",{announcement_id:id,storage_path:up.path,original_name:file.name,mime_type:up.mime,size_bytes:file.size});
    }catch(err){try{await storageDelete(up.path)}catch{}throw err}
  }
}
async function deleteStoredFile(id){
  const f=fileRows.find(x=>x.id===id);if(!f||!canUpdate())return;
  if(!confirm(`Hapus lampiran "${f.original_name}"?`))return;
  try{
    await storageDelete(f.storage_path);
    await restWrite(`announcement_files?id=eq.${encodeURIComponent(id)}`,"DELETE",undefined,"return=minimal");
    fileRows=fileRows.filter(x=>x.id!==id);renderStoredFiles($("announcementId").value);render();
  }catch(err){alert("Gagal menghapus lampiran: "+err.message)}
}
async function save(e){
  e.preventDefault();
  const title=$("title").value.trim(),content=$("content").value.trim();
  if(!title||!content){$("formMessage").textContent="Judul dan isi wajib diisi.";return}
  if($("audience").value==="KELAS_TERTENTU"&&!$("targetClass").value){$("formMessage").textContent="Pilih kelas tujuan.";return}

  const start=fromLocalInput($("startAt").value),end=fromLocalInput($("endAt").value);
  if(start&&end&&new Date(end)<=new Date(start)){$("formMessage").textContent="Waktu berakhir harus setelah waktu mulai.";return}

  const btn=$("saveBtn");btn.disabled=true;btn.textContent="Menyimpan...";
  try{
    const id=$("announcementId").value;
    const payload={
      title,content,category:$("category").value,audience:$("audience").value,
      target_class_id:$("audience").value==="KELAS_TERTENTU"?$("targetClass").value:null,
      priority:$("priority").value,status:$("status").value,
      start_at:$("status").value==="PUBLISHED"?(start||new Date().toISOString()):start,
      end_at:end,is_pinned:$("pinned").checked
    };
    let announcementId=id;
    if(id){
      await restWrite(`announcements?id=eq.${encodeURIComponent(id)}`,"PATCH",payload);
    }else{
      const ins=await restWrite("announcements","POST",payload);
      announcementId=ins?.[0]?.id;if(!announcementId)throw new Error("ID pengumuman tidak diterima.");
    }
    await uploadSelectedFiles(announcementId);
    closeModal();await loadData();
  }catch(err){$("formMessage").textContent="Gagal menyimpan: "+err.message}
  finally{btn.disabled=false;btn.textContent="Simpan"}
}
async function remove(){
  const id=$("announcementId").value,r=rows.find(x=>x.id===id);if(!r||!canDelete())return;
  if(!confirm(`Hapus pengumuman "${r.title}" beserta lampirannya?`))return;
  try{
    for(const f of filesFor(id)){try{await storageDelete(f.storage_path)}catch{}}
    await restWrite(`announcements?id=eq.${encodeURIComponent(id)}`,"DELETE",undefined,"return=minimal");
    closeModal();await loadData();
  }catch(err){alert("Gagal menghapus pengumuman: "+err.message)}
}

$("searchInput").addEventListener("input",render);
$("categoryFilter").addEventListener("change",render);
$("priorityFilter").addEventListener("change",render);
$("statusFilter").addEventListener("change",render);
$("addBtn").addEventListener("click",openAdd);
$("closeModal").addEventListener("click",closeModal);
$("cancelBtn").addEventListener("click",closeModal);
$("deleteBtn").addEventListener("click",remove);
$("form").addEventListener("submit",save);
$("audience").addEventListener("change",toggleTargetClass);
$("status").addEventListener("change",()=>{
  if($("status").value==="PUBLISHED"&&!$("startAt").value){
    const d=new Date(),pad=n=>String(n).padStart(2,"0");
    $("startAt").value=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
});
$("modal").addEventListener("click",e=>{if(e.target===$("modal"))closeModal()});

(async()=>{
  try{
    api=await window.simanisReady;
    const user=await api.auth.getUser();if(!user){location.href="index.html";return}
    profile=await loadProfile(user);
    $("sideUserName").textContent=profile.full_name||"Pengguna";$("sideUserRole").textContent=formatRole(profile.role);$("headerUser").textContent=profile.full_name||"Pengguna";$("currentDate").textContent=localDateID();
    await loadMenu();if(!modulePerm.can_view)throw new Error("Akun tidak memiliki akses ke modul Pengumuman.");
    await loadMaster();await loadData();
    $("logoutBtn").onclick=async()=>{await api.auth.signOut();location.href="index.html"};
  }catch(err){
    console.error(err);
    alert("Modul Pengumuman gagal dimuat: "+err.message);
  }finally{$("loading").style.display="none"}
})();
