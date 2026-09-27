const $ = (id) => document.getElementById(id);
let api, profile;
let rows = [];
let categories = [];
let selectedCategory = null;
let uploadTarget = null;
let integrationSources = new Map();
let verifyTarget = null;
let systemSettings = null;

function esc(s){
  return String(s ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
}
function formatRole(role){ return (role || "-").replaceAll("_"," "); }
function localDateID(){
  return new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date());
}
function routeFor(code){
  return {
    DASHBOARD:"dashboard.html",
    ADMINISTRASI_KEPALA:"administrasi.html",
    DATA_SISWA:"siswa.html",
    DATA_GURU:"guru.html",
    KELAS:"kelas.html",
    MATA_PELAJARAN:"mapel.html",
    JADWAL:"jadwal.html",
    ABSENSI_GURU:"absensi-guru.html",
    ABSENSI_SISWA:"absensi-siswa.html",
    NILAI:"nilai.html",
    PRESTASI:"prestasi.html",
    BERITA:"berita.html",
    PENGUMUMAN:"pengumuman.html",
    AGENDA:"agenda.html",
    KEUANGAN:"unit-kerja.html?unit=PKM_BENDAHARA_SARPRAS&tab=finance",
    PORTAL_WALI:"wali-admin.html",
    PENGATURAN:"pengaturan.html",
    PKM_KURIKULUM:"unit-kerja.html?unit=PKM_KURIKULUM",
    PKM_KESISWAAN:"unit-kerja.html?unit=PKM_KESISWAAN",
    PKM_BENDAHARA_SARPRAS:"unit-kerja.html?unit=PKM_BENDAHARA_SARPRAS",
    PKM_HUMASY:"unit-kerja.html?unit=PKM_HUMASY",
    KEPALA_TU:"unit-kerja.html?unit=KEPALA_TU",
    KALAB_IPA:"unit-kerja.html?unit=KALAB_IPA",
    KALAB_BISNIS:"unit-kerja.html?unit=KALAB_BISNIS"
  }[code]||"#";
}
function statusLabel(s){
  return {BELUM_ADA:"Belum Ada",DRAFT:"Draft",PERLU_REVISI:"Perlu Revisi",LENGKAP:"Lengkap"}[s] || s;
}
function integrationRoute(key){
  return {
    teacher_attendance_daily:"absensi-guru.html",
    teacher_attendance_monthly:"absensi-guru.html",
    student_master:"siswa.html",
    student_attendance_by_class:"absensi-siswa-rekap.html",
    student_count_by_class:"kelas.html",
    student_achievements:"prestasi.html",
    student_report_cards:"nilai-semester.html",
    promotion_graduation:"siswa.html",
    inventory_master:"unit-kerja.html?unit=PKM_BENDAHARA_SARPRAS",
    finance_cashbook:"unit-kerja.html?unit=PKM_BENDAHARA_SARPRAS&tab=finance",
    incoming_mail:"unit-kerja.html?unit=KEPALA_TU",
    outgoing_mail:"unit-kerja.html?unit=KEPALA_TU"
  }[key]||null;
}
function integrationBadge(r){
  if(!r.integration_key)return "";
  const count=integrationSources.get(r.integration_key)||0;
  return '<span class="integration-badge">Terhubung SIMANIS'+(count>0?' · '+count+' data':'')+'</span>';
}
function integrationButton(r){
  const route=r.integration_key?integrationRoute(r.integration_key):null;
  return route?'<a href="'+route+'" style="text-decoration:none"><button type="button">Buka Sumber</button></a>':"";
}
function canVerify(){
  return ["SUPER_ADMIN","KEPALA_MADRASAH"].includes(String(profile?.role||"").toUpperCase());
}
function verificationMeta(r){
  if(!r.verified_at)return "";
  const when=new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(r.verified_at));
  return '<span class="doc-file">Diverifikasi '+esc(r.verified_by_name||"-")+' · '+esc(when)+'</span>';
}
async function loadProfile(user){
  const p = await api.db.select("profiles",`select=id,full_name,role,is_active&id=eq.${encodeURIComponent(user.id)}&limit=1`);
  if(!p?.[0]) throw new Error("Profil pengguna tidak ditemukan.");
  if(!p[0].is_active) throw new Error("Akun SIMANIS tidak aktif.");
  const role=String(p[0].role||"").toUpperCase();
  const perm=await api.db.rpc("get_my_module_permission",{p_module_code:"ADMINISTRASI_KEPALA"});
  if(!["SUPER_ADMIN","KEPALA_MADRASAH"].includes(role) && !perm?.can_view){
    throw new Error("Akun tidak memiliki akses Administrasi Kepala Madrasah.");
  }
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
  try{
    const syncRows=await api.db.rpc("sync_admin_document_integrations",{})||[];
    integrationSources=new Map(syncRows.map(x=>[x.integration_key,Number(x.source_count||0)]));
  }catch(err){
    console.warn("Sinkronisasi administrasi:",err);
    integrationSources=new Map();
  }
  rows = await api.db.select("v_admin_document_status","select=*&academic_year=eq.2026/2027&order=category_order.asc,document_order.asc") || [];
  const map = new Map();
  rows.forEach(r=>{ if(!map.has(r.category_id)) map.set(r.category_id,{id:r.category_id,code:r.category_code,name:r.category_name,order:r.category_order,expected:r.expected_documents}); });
  categories=[...map.values()].sort((a,b)=>a.order-b.order);
  if(!selectedCategory && categories.length) selectedCategory=categories[0].id;
  renderStats(); renderCategories(); renderDocs();
}
function renderStats(){
  const total=rows.length, complete=rows.filter(r=>r.status==="LENGKAP").length, draft=rows.filter(r=>r.status==="DRAFT").length, revision=rows.filter(r=>r.status==="PERLU_REVISI").length, missing=rows.filter(r=>r.status==="BELUM_ADA").length;
  const available=Math.max(0,total-missing), pct=total?Math.round(available/total*100):0;
  $("statComplete").textContent=complete; $("statDraft").textContent=draft; $("statRevision").textContent=revision; $("statMissing").textContent=missing;
  $("overallText").textContent=available+" / "+total+" punya progres ("+pct+"%)"; $("overallFill").style.width=pct+"%";
}
function renderCategories(){
  $("categoryGrid").innerHTML=categories.map(c=>{
    const rr=rows.filter(r=>r.category_id===c.id);
    const done=rr.filter(r=>r.status==="LENGKAP").length;
    const draft=rr.filter(r=>r.status==="DRAFT").length;
    const revision=rr.filter(r=>r.status==="PERLU_REVISI").length;
    const available=done+draft+revision, pct=rr.length?Math.round(available/rr.length*100):0;
    return `<article class="admin-cat ${selectedCategory===c.id?"active":""}" data-cat="${c.id}">
      <div class="admin-cat-top"><h4>${String(c.order).padStart(2,"0")}. ${esc(c.name)}</h4><span class="count">${available}/${rr.length}</span></div>
      <small>${available} tersedia · ${done} lengkap · ${draft} draft</small><div class="cat-track"><div class="cat-fill" style="width:${pct}%"></div></div></article>`;
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
      ${integrationBadge(r)}
      ${r.file_name?`<span class="doc-file">${esc(r.file_name)} · v${r.version_no||1}</span>`:""}
      ${verificationMeta(r)}
    </div></div>
    <div class="doc-actions">
      ${canVerify()&&r.status!=="BELUM_ADA"?`<button class="primary-small" data-verify="${r.record_id}">${r.status==="LENGKAP"?"Tinjau Ulang":"Verifikasi"}</button>`:""}
      <button data-history="${r.record_id}">Riwayat</button>
      <button data-note="${r.record_id}">Catatan</button>${integrationButton(r)}${r.storage_path?`<button data-view="${r.record_id}">Lihat File</button>`:""}<button class="primary-small" data-upload="${r.record_id}">Upload</button>
    </div></article>`).join("");
  document.querySelectorAll("[data-verify]").forEach(el=>el.addEventListener("click",()=>openVerify(el.dataset.verify)));
  document.querySelectorAll("[data-history]").forEach(el=>el.addEventListener("click",()=>openHistory(el.dataset.history)));
  document.querySelectorAll("[data-note]").forEach(el=>el.addEventListener("click",()=>editNote(el.dataset.note)));
  document.querySelectorAll("[data-upload]").forEach(el=>el.addEventListener("click",()=>{uploadTarget=rows.find(r=>r.record_id===el.dataset.upload);$("filePicker").value="";$("filePicker").click();}));
  document.querySelectorAll("[data-view]").forEach(el=>el.addEventListener("click",()=>openFile(el.dataset.view)));
}

function closeVerify(){
  $("verifyModal").classList.add("hidden");
  verifyTarget=null;
  $("verifyMessage").textContent="";
}
function openVerify(recordId){
  const r=rows.find(x=>x.record_id===recordId);if(!r)return;
  verifyTarget=r;
  $("verifyTitle").textContent="Verifikasi · "+r.document_code.replace("ADM-","")+" · "+r.title;
  const sourceCount=r.integration_key?(integrationSources.get(r.integration_key)||0):0;
  $("verifyEvidence").innerHTML=
    "<b>Bukti tersedia</b><br>"+
    (r.file_name?"File: "+esc(r.file_name)+" (v"+(r.version_no||1)+")<br>":"")+
    (r.integration_key?"Sumber SIMANIS: "+sourceCount+" data<br>":"")+
    (!r.file_name&&!r.integration_key?"Belum ada bukti file maupun sumber SIMANIS.":"");
  $("verifyStatus").value=r.status==="PERLU_REVISI"?"PERLU_REVISI":"LENGKAP";
  $("verifyNote").value=r.verification_note||"";
  $("verifyMessage").textContent="";
  $("verifyModal").classList.remove("hidden");
}
async function saveVerification(){
  if(!verifyTarget)return;
  const status=$("verifyStatus").value,note=$("verifyNote").value.trim();
  if(status==="PERLU_REVISI"&&!note){$("verifyMessage").textContent="Catatan revisi wajib diisi.";return}
  const btn=$("verifySave");btn.disabled=true;btn.textContent="Menyimpan...";
  try{
    await api.db.rpc("verify_admin_document",{p_record_id:verifyTarget.record_id,p_status:status,p_note:note||null});
    closeVerify();await loadData();
  }catch(err){
    $("verifyMessage").textContent="Gagal: "+(err.message||err);
  }finally{
    btn.disabled=false;btn.textContent="Simpan Verifikasi";
  }
}
async function openHistory(recordId){
  const r=rows.find(x=>x.record_id===recordId);if(!r)return;
  $("historyTitle").textContent="Riwayat · "+r.document_code.replace("ADM-","")+" · "+r.title;
  $("historyBody").innerHTML='<div class="admin-empty">Memuat riwayat...</div>';
  $("historyModal").classList.remove("hidden");
  try{
    const logs=await api.db.rpc("list_admin_document_verification_logs",{p_record_id:recordId})||[];
    $("historyBody").innerHTML=logs.length?logs.map(l=>{
      const dt=new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(l.created_at));
      return '<div style="border:1px solid #e1e9e5;border-radius:11px;padding:10px;margin-bottom:8px">'+
        '<b style="font-size:10px">'+esc(statusLabel(l.old_status||"-"))+' → '+esc(statusLabel(l.new_status))+'</b>'+
        '<div style="font-size:8px;color:#718078;margin-top:3px">'+esc(l.changed_by_name||"-")+' · '+esc(dt)+'</div>'+
        (l.verification_note?'<div style="font-size:9px;margin-top:6px">'+esc(l.verification_note)+'</div>':'')+
      '</div>';
    }).join(""):'<div class="admin-empty">Belum ada riwayat verifikasi.</div>';
  }catch(err){
    $("historyBody").innerHTML='<div class="admin-empty">Riwayat gagal dimuat: '+esc(err.message||err)+'</div>';
  }
}
function closeHistory(){$("historyModal").classList.add("hidden")}
function exportAdminCsv(){
  const header=["Kode","Kategori","Dokumen","Status","Sumber SIMANIS","File","Versi","Penanggung Jawab","Verifier","Waktu Verifikasi","Catatan Verifikasi","Catatan Dokumen"];
  const body=rows.map(r=>[
    r.document_code,r.category_name,r.title,statusLabel(r.status),
    r.integration_key?(integrationSources.get(r.integration_key)||0):"",
    r.file_name||"",r.version_no||"",r.responsible_name||"",
    r.verified_by_name||"",r.verified_at||"",r.verification_note||"",r.note||""
  ]);
  const csv=[header,...body].map(row=>row.map(v=>'"'+String(v??"").replaceAll('"','""')+'"').join(",")).join("\n");
  const url=URL.createObjectURL(new Blob(["\uFEFF",csv],{type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a");a.href=url;a.download="Administrasi_Kepala_Madrasah_2026-2027.csv";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
}
function printAdminReport(){
  const total=rows.length,complete=rows.filter(r=>r.status==="LENGKAP").length,draft=rows.filter(r=>r.status==="DRAFT").length,revision=rows.filter(r=>r.status==="PERLU_REVISI").length,missing=rows.filter(r=>r.status==="BELUM_ADA").length;
  const w=window.open("","_blank");if(!w){alert("Popup diblokir browser.");return}
  const school=(systemSettings?.school_name||"MA Nurul Islam").toUpperCase();
  const addr=[systemSettings?.address,systemSettings?.village,systemSettings?.district,systemSettings?.regency,systemSettings?.province].filter(Boolean).join(", ");
  const logo=new URL("logo.png",location.href).href;
  const catRows=categories.map(c=>{
    const rr=rows.filter(r=>r.category_id===c.id);
    const c1=rr.filter(r=>r.status==="LENGKAP").length,c2=rr.filter(r=>r.status==="DRAFT").length,c3=rr.filter(r=>r.status==="PERLU_REVISI").length,c4=rr.filter(r=>r.status==="BELUM_ADA").length;
    return '<tr><td>'+String(c.order).padStart(2,"0")+'. '+esc(c.name)+'</td><td>'+rr.length+'</td><td>'+c1+'</td><td>'+c2+'</td><td>'+c3+'</td><td>'+c4+'</td></tr>';
  }).join("");
  const docRows=rows.map(r=>'<tr><td>'+esc(r.document_code.replace("ADM-",""))+'</td><td>'+esc(r.category_name)+'</td><td class="left">'+esc(r.title)+'</td><td>'+esc(statusLabel(r.status))+'</td><td>'+esc(r.verified_by_name||"-")+'</td></tr>').join("");
  w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Rekap Administrasi Kepala Madrasah</title><style>@page{size:A4 landscape;margin:9mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#17251e;margin:0}.head{display:grid;grid-template-columns:16mm 1fr 16mm;align-items:center;border-bottom:3px double #173f30;padding-bottom:3mm;margin-bottom:4mm}.head img{width:14mm}.school{text-align:center}.school h2{font-size:14pt;margin:0}.school p{font-size:7pt;margin:1mm 0 0;color:#566}h3{text-align:center;font-size:11pt;margin:0 0 4mm}.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:2mm;margin-bottom:4mm}.box{border:1px solid #ccd8d1;padding:2.5mm;text-align:center}.box b{display:block;font-size:13pt;color:#075b3a}.box span{font-size:7pt}table{width:100%;border-collapse:collapse;font-size:7pt;margin-bottom:5mm}th,td{border:1px solid #cdd8d2;padding:1.6mm;text-align:center}th{background:#f2f7f4}.left{text-align:left}.pagebreak{page-break-before:always}.sign{display:grid;grid-template-columns:1fr 1fr;gap:30mm;margin-top:8mm;text-align:center;font-size:8pt}.space{height:16mm}</style></head><body>'+
    '<div class="head"><img src="'+logo+'"><div class="school"><h2>'+esc(school)+'</h2><p>'+esc(addr||"Karangcempaka, Bluto, Sumenep")+'</p></div><div></div></div>'+
    '<h3>REKAP ADMINISTRASI KEPALA MADRASAH · TA 2026/2027</h3>'+
    '<div class="stats"><div class="box"><b>'+total+'</b><span>Total</span></div><div class="box"><b>'+complete+'</b><span>Lengkap</span></div><div class="box"><b>'+draft+'</b><span>Draft</span></div><div class="box"><b>'+revision+'</b><span>Perlu Revisi</span></div><div class="box"><b>'+missing+'</b><span>Belum Ada</span></div></div>'+
    '<table><thead><tr><th>Kategori</th><th>Total</th><th>Lengkap</th><th>Draft</th><th>Revisi</th><th>Belum Ada</th></tr></thead><tbody>'+catRows+'</tbody></table>'+
    '<div class="pagebreak"></div><h3>DAFTAR STATUS 141 DOKUMEN</h3><table><thead><tr><th>Kode</th><th>Kategori</th><th>Dokumen</th><th>Status</th><th>Verifier</th></tr></thead><tbody>'+docRows+'</tbody></table>'+
    '<div class="sign"><div>Mengetahui,<br>Kepala Madrasah<div class="space"></div><b>'+esc(systemSettings?.headmaster_name||"Kepala Madrasah")+'</b></div><div>Dicetak oleh<div class="space"></div><b>'+esc(profile?.full_name||"-")+'</b></div></div>'+
    '<script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>');
  w.document.close();
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
$("docSearch").addEventListener("input",renderDocs);
$("statusFilter").addEventListener("change",renderDocs);
$("filePicker").addEventListener("change",e=>uploadFile(e.target.files?.[0]));
$("verifyClose").onclick=closeVerify;$("verifyCancel").onclick=closeVerify;$("verifySave").onclick=saveVerification;
$("verifyModal").onclick=e=>{if(e.target===$("verifyModal"))closeVerify()};
$("historyClose").onclick=closeHistory;$("historyDone").onclick=closeHistory;
$("historyModal").onclick=e=>{if(e.target===$("historyModal"))closeHistory()};
$("exportAdminCsvBtn").onclick=exportAdminCsv;
$("printAdminReportBtn").onclick=printAdminReport;
(async function boot(){
  try{api=await window.simanisReady; const session=await api.auth.getSession(); if(!session){location.replace("index.html");return} const user=await api.auth.getUser(); if(!user){location.replace("index.html");return} profile=await loadProfile(user);
    $("sideUserName").textContent=profile.full_name||user.email||"Pengguna"; $("sideUserRole").textContent=formatRole(profile.role); $("headerUser").textContent=profile.full_name||user.email||"Pengguna"; $("currentDate").textContent=localDateID();
    try{const x=await api.db.rpc("get_public_system_settings",{});systemSettings=Array.isArray(x)?x[0]:x}catch(_){systemSettings=null}
    await loadMenu(); await loadData(); $("logoutBtn").addEventListener("click",async()=>{await api.auth.signOut();location.replace("index.html");});
  }catch(err){console.error(err);alert("Administrasi Kepala gagal dimuat: "+(err.message||err));}finally{$("loading").classList.add("hidden");}
})();
