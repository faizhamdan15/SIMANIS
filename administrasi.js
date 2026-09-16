const $ = (id) => document.getElementById(id);
let api, profile;
let rows = [];
let categories = [];
let selectedCategory = null;
let uploadTarget = null;

function esc(s){
  return String(s ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
}
function formatRole(role){ return (role || "-").replaceAll("_"," "); }
function localDateID(){
  return new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date());
}
function routeFor(code){
  if(code==="DASHBOARD") return "dashboard.html";
  if(code==="ADMINISTRASI_KEPALA") return "administrasi.html";
  if(code==="DATA_SISWA") return "siswa.html";
  return "#";
}
function statusLabel(s){
  return {BELUM_ADA:"Belum Ada",DRAFT:"Draft",PERLU_REVISI:"Perlu Revisi",LENGKAP:"Lengkap"}[s] || s;
}
async function loadProfile(user){
  const p = await api.db.select("profiles",`select=id,full_name,role,is_active&id=eq.${encodeURIComponent(user.id)}&limit=1`);
  if(!p?.[0]) throw new Error("Profil pengguna tidak ditemukan.");
  return p[0];
}
async function loadMenu(){
  const modules = await api.db.rpc("get_my_modules",{});
  $("sidebarMenu").innerHTML=(modules||[]).map(m=>`
    <a href="${routeFor(m.code)}" class="nav-item ${m.code==="ADMINISTRASI_KEPALA"?"active":""}">
      <span class="nav-dot"></span><span>${esc(m.name)}</span>
    </a>`).join("");
  document.querySelectorAll('.nav-item[href="#"]').forEach(a=>a.addEventListener("click",e=>{e.preventDefault();alert(`Modul "${a.textContent.trim()}" akan diaktifkan bertahap.`);}));
}
async function loadData(){
  rows = await api.db.select("v_admin_document_status","select=*&academic_year=eq.2026/2027&order=category_order.asc,document_order.asc") || [];
  const map = new Map();
  rows.forEach(r=>{ if(!map.has(r.category_id)) map.set(r.category_id,{id:r.category_id,code:r.category_code,name:r.category_name,order:r.category_order,expected:r.expected_documents}); });
  categories=[...map.values()].sort((a,b)=>a.order-b.order);
  if(!selectedCategory && categories.length) selectedCategory=categories[0].id;
  renderStats(); renderCategories(); renderDocs();
}
function renderStats(){
  const total=rows.length, complete=rows.filter(r=>r.status==="LENGKAP").length, draft=rows.filter(r=>r.status==="DRAFT").length, revision=rows.filter(r=>r.status==="PERLU_REVISI").length, missing=rows.filter(r=>r.status==="BELUM_ADA").length;
  const pct=total?Math.round(complete/total*100):0;
  $("statComplete").textContent=complete; $("statDraft").textContent=draft; $("statRevision").textContent=revision; $("statMissing").textContent=missing;
  $("overallText").textContent=`${complete} / ${total} (${pct}%)`; $("overallFill").style.width=`${pct}%`;
}
function renderCategories(){
  $("categoryGrid").innerHTML=categories.map(c=>{
    const rr=rows.filter(r=>r.category_id===c.id), done=rr.filter(r=>r.status==="LENGKAP").length, pct=rr.length?Math.round(done/rr.length*100):0;
    return `<article class="admin-cat ${selectedCategory===c.id?"active":""}" data-cat="${c.id}">
      <div class="admin-cat-top"><h4>${String(c.order).padStart(2,"0")}. ${esc(c.name)}</h4><span class="count">${done}/${rr.length}</span></div>
      <small>${pct}% lengkap</small><div class="cat-track"><div class="cat-fill" style="width:${pct}%"></div></div></article>`;
  }).join("");
  document.querySelectorAll("[data-cat]").forEach(el=>el.addEventListener("click",()=>{selectedCategory=el.dataset.cat;renderCategories();renderDocs();}));
}
function filteredRows(){
  const q=$("docSearch").value.trim().toLowerCase(), st=$("statusFilter").value;
  return rows.filter(r=>(!selectedCategory||r.category_id===selectedCategory)&&(!st||r.status===st)&&(!q||`${r.document_code} ${r.title}`.toLowerCase().includes(q)));
}
function renderDocs(){
  const list=filteredRows(), cat=categories.find(c=>c.id===selectedCategory);
  $("listTitle").textContent=cat?`${String(cat.order).padStart(2,"0")}. ${cat.name}`:"Daftar Dokumen"; $("listCount").textContent=`${list.length} dokumen`;
  if(!list.length){$("docList").innerHTML='<div class="admin-empty">Tidak ada dokumen yang cocok.</div>';return;}
  $("docList").innerHTML=list.map(r=>`<article class="doc-item">
    <div class="doc-code">${esc(r.document_code.replace("ADM-",""))}</div>
    <div><div class="doc-title">${esc(r.title)}</div><div class="doc-meta">
      <span class="status-badge status-${r.status}">${statusLabel(r.status)}</span>
      ${r.integration_key?'<span class="integration-badge">Terhubung SIMANIS</span>':''}
      ${r.file_name?`<span class="doc-file">${esc(r.file_name)} · v${r.version_no||1}</span>`:""}
    </div></div>
    <div class="doc-actions">
      <select data-status="${r.record_id}">${["BELUM_ADA","DRAFT","PERLU_REVISI","LENGKAP"].map(s=>`<option value="${s}" ${r.status===s?"selected":""}>${statusLabel(s)}</option>`).join("")}</select>
      <button data-note="${r.record_id}">Catatan</button>${r.storage_path?`<button data-view="${r.record_id}">Lihat File</button>`:""}<button class="primary-small" data-upload="${r.record_id}">Upload</button>
    </div></article>`).join("");
  document.querySelectorAll("[data-status]").forEach(el=>el.addEventListener("change",()=>updateStatus(el.dataset.status,el.value)));
  document.querySelectorAll("[data-note]").forEach(el=>el.addEventListener("click",()=>editNote(el.dataset.note)));
  document.querySelectorAll("[data-upload]").forEach(el=>el.addEventListener("click",()=>{uploadTarget=rows.find(r=>r.record_id===el.dataset.upload);$("filePicker").value="";$("filePicker").click();}));
  document.querySelectorAll("[data-view]").forEach(el=>el.addEventListener("click",()=>openFile(el.dataset.view)));
}
async function restWrite(path,method,body,prefer="return=representation"){
  const session=await api.auth.getSession(); if(!session?.access_token) throw new Error("Sesi login tidak ditemukan.");
  const cfg=window.SIMANIS_CONFIG;
  const res=await fetch(`${cfg.SUPABASE_URL.replace(/\/$/,"")}/rest/v1/${path}`,{method,headers:{apikey:cfg.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json",Prefer:prefer},body:body===undefined?undefined:JSON.stringify(body)});
  const text=await res.text(); let data=null; try{data=text?JSON.parse(text):null}catch{data=text}
  if(!res.ok) throw new Error(data?.message||data?.error||text||`HTTP ${res.status}`); return data;
}
async function updateStatus(recordId,status){
  try{await restWrite(`admin_document_records?id=eq.${encodeURIComponent(recordId)}`,"PATCH",{status,completed_at:status==="LENGKAP"?new Date().toISOString():null});await loadData();}
  catch(err){alert("Gagal mengubah status: "+err.message);await loadData();}
}
async function editNote(recordId){
  const row=rows.find(r=>r.record_id===recordId), note=prompt("Catatan dokumen:",row?.note||""); if(note===null)return;
  try{await restWrite(`admin_document_records?id=eq.${encodeURIComponent(recordId)}`,"PATCH",{note:note.trim()||null});await loadData();}catch(err){alert("Gagal menyimpan catatan: "+err.message)}
}
function encodePath(path){return path.split("/").map(encodeURIComponent).join("/");}
async function uploadFile(file){
  if(!uploadTarget||!file)return; if(file.size>20*1024*1024){alert("Ukuran file maksimal 20 MB.");return;}
  const session=await api.auth.getSession(), cfg=window.SIMANIS_CONFIG, safe=file.name.replace(/[^a-zA-Z0-9._-]+/g,"_"), path=`2026-2027/${uploadTarget.document_code}/${Date.now()}_${safe}`;
  try{
    const resp=await fetch(`${cfg.SUPABASE_URL.replace(/\/$/,"")}/storage/v1/object/administrasi-kepala/${encodePath(path)}`,{method:"POST",headers:{apikey:cfg.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`,"Content-Type":file.type||"application/octet-stream","x-upsert":"false"},body:file});
    const txt=await resp.text(); if(!resp.ok) throw new Error(txt||`HTTP ${resp.status}`);
    const versions=await api.db.select("admin_document_files",`select=version_no&record_id=eq.${encodeURIComponent(uploadTarget.record_id)}&order=version_no.desc&limit=1`); const nextVersion=(versions?.[0]?.version_no||0)+1;
    await restWrite(`admin_document_files?record_id=eq.${encodeURIComponent(uploadTarget.record_id)}&is_current=eq.true`,"PATCH",{is_current:false});
    await restWrite("admin_document_files","POST",{record_id:uploadTarget.record_id,version_no:nextVersion,storage_path:path,file_name:file.name,mime_type:file.type||null,file_size:file.size,is_current:true});
    await restWrite(`admin_document_records?id=eq.${encodeURIComponent(uploadTarget.record_id)}`,"PATCH",{status:uploadTarget.status==="BELUM_ADA"?"DRAFT":uploadTarget.status});
    await loadData(); alert("File berhasil diupload.");
  }catch(err){alert("Upload gagal: "+err.message)}finally{uploadTarget=null;}
}
async function openFile(recordId){
  const row=rows.find(r=>r.record_id===recordId); if(!row?.storage_path)return;
  const session=await api.auth.getSession(), cfg=window.SIMANIS_CONFIG;
  try{
    const res=await fetch(`${cfg.SUPABASE_URL.replace(/\/$/,"")}/storage/v1/object/sign/administrasi-kepala/${encodePath(row.storage_path)}`,{method:"POST",headers:{apikey:cfg.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({expiresIn:3600})});
    const data=await res.json(); if(!res.ok) throw new Error(data?.message||"Gagal membuat link file."); const signed=data.signedURL||data.signedUrl; if(!signed) throw new Error("Signed URL tidak diterima.");
    window.open(signed.startsWith("http")?signed:`${cfg.SUPABASE_URL.replace(/\/$/,"")}/storage/v1${signed}`,"_blank");
  }catch(err){alert("File gagal dibuka: "+err.message)}
}
$("docSearch").addEventListener("input",renderDocs); $("statusFilter").addEventListener("change",renderDocs); $("filePicker").addEventListener("change",e=>uploadFile(e.target.files?.[0]));
(async function boot(){
  try{api=await window.simanisReady; const session=await api.auth.getSession(); if(!session){location.replace("index.html");return} const user=await api.auth.getUser(); if(!user){location.replace("index.html");return} profile=await loadProfile(user);
    $("sideUserName").textContent=profile.full_name||user.email||"Pengguna"; $("sideUserRole").textContent=formatRole(profile.role); $("headerUser").textContent=profile.full_name||user.email||"Pengguna"; $("currentDate").textContent=localDateID();
    await loadMenu(); await loadData(); $("logoutBtn").addEventListener("click",async()=>{await api.auth.signOut();location.replace("index.html");});
  }catch(err){console.error(err);alert("Administrasi Kepala gagal dimuat: "+(err.message||err));}finally{$("loading").classList.add("hidden");}
})();
