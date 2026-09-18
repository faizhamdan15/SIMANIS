const $=id=>document.getElementById(id);
let api,profile,myModules=[],programs=[],logs=[],specific=[],teachers=[],students=[],classes=[],semesters=[],assets=[],assetMutations=[],assetMaintenance=[];
const unitCode=new URLSearchParams(location.search).get("unit")||"";

const ROUTES={DASHBOARD:"dashboard.html",ADMINISTRASI_KEPALA:"administrasi.html",DATA_SISWA:"siswa.html",DATA_GURU:"guru.html",KELAS:"kelas.html",MATA_PELAJARAN:"mapel.html",JADWAL:"jadwal.html",ABSENSI_GURU:"absensi-guru.html",ABSENSI_SISWA:"absensi-siswa.html",NILAI:"nilai.html",PRESTASI:"prestasi.html",BERITA:"berita.html",PENGUMUMAN:"pengumuman.html",AGENDA:"agenda.html",KEUANGAN:"keuangan.html",PORTAL_WALI:"wali-admin.html",PENGATURAN:"pengaturan.html"};

const UNITS={
 PKM_KURIKULUM:{name:"PKM Kurikulum",desc:"Kurikulum, pembelajaran, jadwal, penilaian, dan peningkatan mutu akademik.",icon:"book",specificLabel:"Supervisi",specificTab:"Supervisi Guru",table:"curriculum_supervisions"},
 PKM_KESISWAAN:{name:"PKM Kesiswaan",desc:"Pembinaan siswa, kedisiplinan, prestasi, kegiatan, dan layanan kesiswaan.",icon:"users",specificLabel:"Kasus/Pembinaan",specificTab:"Pembinaan Siswa",table:"student_guidance_cases"},
 PKM_BENDAHARA_SARPRAS:{name:"PKM Bendahara & Sarpras",desc:"Keuangan madrasah, aset, sarana-prasarana, dan pemeliharaan.",icon:"wallet",specificLabel:"Aset",specificTab:"Aset & Sarpras",table:"school_assets"},
 PKM_HUMASY:{name:"PKM Humasy",desc:"Hubungan masyarakat, publikasi, informasi, dan komunikasi kelembagaan.",icon:"megaphone",specificLabel:"Rencana Publikasi",specificTab:"Kalender Publikasi",table:"humas_publication_plans"},
 KEPALA_TU:{name:"Kepala TU",desc:"Administrasi, tata usaha, arsip, surat masuk, dan surat keluar.",icon:"briefcase",specificLabel:"Surat",specificTab:"Surat Masuk/Keluar",table:"office_letters"},
 KALAB_IPA:{name:"Kepala Laboratorium IPA",desc:"Inventaris, jadwal penggunaan, praktikum, dan pengelolaan Laboratorium IPA.",icon:"flask",specificLabel:"Inventaris Lab",specificTab:"Inventaris & Penggunaan",table:"lab_inventory",lab:"IPA"},
 KALAB_BISNIS:{name:"Kepala Laboratorium Bisnis",desc:"Inventaris, jadwal penggunaan, praktik bisnis, dan pengelolaan Laboratorium Bisnis.",icon:"chart",specificLabel:"Inventaris Lab",specificTab:"Inventaris & Penggunaan",table:"lab_inventory",lab:"BISNIS"}
};

const PATHS={
 book:`<path d="M2 4h6a4 4 0 0 1 4 4v12a4 4 0 0 0-4-4H2Z"/><path d="M22 4h-6a4 4 0 0 0-4 4v12a4 4 0 0 1 4-4h6Z"/>`,
 users:`<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
 wallet:`<path d="M20 7V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v12H5a3 3 0 0 1-3-3V6"/><path d="M16 13h4"/>`,
 megaphone:`<path d="m3 11 18-5v12L3 13v-2Z"/><path d="M11.6 15.4 13 21H8l-1.5-7"/>`,
 briefcase:`<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/>`,
 flask:`<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3"/><path d="M8 15h8"/>`,
 chart:`<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>`
};

function icon(name){return`<svg viewBox="0 0 24 24" aria-hidden="true">${PATHS[name]||PATHS.book}</svg>`}
function esc(s){return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}
function money(n){return new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(n||0))}
function roleLabel(r){return String(r||"-").replaceAll("_"," ")}
function dateID(v){return v?new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(v+"T00:00:00")):"-"}
function localDateID(){return new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date())}
function badge(st){const bad=["CANCELLED","RUSAK_BERAT","HILANG","HABIS"],warn=["ONGOING","PROCESS","FOLLOW_UP","RUSAK_RINGAN","DRAFT","READY","MAINTENANCE","OPEN"];return`<span class="badge ${bad.includes(st)?"bad":warn.includes(st)?"warn":""}">${esc(st||"-")}</span>`}
function today(){return new Date().toISOString().slice(0,10)}

function assetDeepLink(assetId){
  return `${location.origin}${location.pathname}?unit=PKM_BENDAHARA_SARPRAS&asset=${encodeURIComponent(assetId)}`;
}
function qrCanvas(target,text,size=180){
  target.innerHTML="";
  if(window.QRCode?.toCanvas){
    const canvas=document.createElement("canvas");target.appendChild(canvas);
    window.QRCode.toCanvas(canvas,text,{width:size,margin:1,errorCorrectionLevel:"M"},err=>{
      if(err){target.innerHTML=`<div class="empty">QR gagal dibuat.<br><small>${esc(text)}</small></div>`}
    });
  }else{
    target.innerHTML=`<div class="empty">Generator QR belum termuat.<br><small>${esc(text)}</small></div>`;
  }
}


async function loadProfile(user){const r=await api.db.select("profiles",`select=id,full_name,role,is_active&id=eq.${encodeURIComponent(user.id)}&limit=1`);if(!r?.[0])throw new Error("Profil pengguna tidak ditemukan.");if(!r[0].is_active)throw new Error("Akun tidak aktif.");return r[0]}
async function loadMenu(){myModules=await api.db.rpc("get_my_modules",{})||[];$("sidebarMenu").innerHTML=myModules.map(x=>`<a href="${x.route||ROUTES[x.code]||"#"}" class="nav-item ${x.code===unitCode?"active":""}"><span class="nav-dot"></span><span>${esc(x.name)}</span></a>`).join("")}
async function restWrite(path,method,body){
 const s=await api.auth.getSession(),cfg=window.SIMANIS_CONFIG,res=await fetch(`${cfg.SUPABASE_URL.replace(/\/$/,"")}/rest/v1/${path}`,{method,headers:{apikey:cfg.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${s.access_token}`,"Content-Type":"application/json",Prefer:"return=representation"},body:body===undefined?undefined:JSON.stringify(body)});
 const txt=await res.text();let data=null;try{data=txt?JSON.parse(txt):null}catch{data=txt}if(!res.ok)throw new Error(data?.message||data?.error||txt||`HTTP ${res.status}`);return data
}
async function checkAccess(){return !!(await api.db.rpc("has_module_permission",{p_module_code:unitCode,p_action:"view"}))}
async function loadMasters(){
 const jobs=[
  api.db.select("teachers","select=id,teacher_code,full_name&is_active=eq.true&order=full_name.asc"),
  api.db.select("students","select=id,full_name,nis,nisn&status=eq.AKTIF&order=full_name.asc"),
  api.db.select("classes","select=id,name&is_active=eq.true&order=name.asc"),
  api.db.select("semesters","select=id,name,academic_year_id,is_active&order=start_date.desc")
 ];
 [teachers,students,classes,semesters]=await Promise.all(jobs);
}
async function loadData(){
 const u=UNITS[unitCode];
 const baseJobs=[
  api.db.select("unit_work_programs",`select=*&unit_code=eq.${encodeURIComponent(unitCode)}&order=start_date.desc,created_at.desc`),
  api.db.select("unit_activity_logs",`select=*&unit_code=eq.${encodeURIComponent(unitCode)}&order=activity_date.desc,created_at.desc`)
 ];
 if(unitCode==="PKM_KURIKULUM")baseJobs.push(api.db.select("curriculum_supervisions","select=*,teachers(full_name),semesters(name)&order=supervision_date.desc,created_at.desc"));
 else if(unitCode==="PKM_KESISWAAN")baseJobs.push(api.db.select("student_guidance_cases","select=*,students(full_name,nisn)&order=case_date.desc,created_at.desc"));
 else if(unitCode==="PKM_BENDAHARA_SARPRAS")baseJobs.push(api.db.select("school_assets","select=*&order=asset_name.asc"));
 else if(unitCode==="PKM_HUMASY")baseJobs.push(api.db.select("humas_publication_plans","select=*&order=publish_date.desc,created_at.desc"));
 else if(unitCode==="KEPALA_TU")baseJobs.push(api.db.select("office_letters","select=*&order=letter_date.desc,created_at.desc"));
 else if(unitCode==="KALAB_IPA"||unitCode==="KALAB_BISNIS")baseJobs.push(api.db.select("lab_inventory",`select=*&lab_code=eq.${u.lab}&order=item_name.asc`));
 const r=await Promise.all(baseJobs);programs=r[0]||[];logs=r[1]||[];specific=r[2]||[];
 if(unitCode==="PKM_BENDAHARA_SARPRAS")assets=specific;
 renderAll();
}
function setTab(name){
 document.querySelectorAll(".tabbtn").forEach(b=>b.classList.toggle("active",b.dataset.tab===name));
 ["Summary","Programs","Logs","Specific"].forEach(x=>$("panel"+x).classList.toggle("hidden",x.toLowerCase()!==name));
}
function renderTabs(){
 const u=UNITS[unitCode];
 $("tabs").innerHTML=[
  ["summary","Ringkasan"],["programs","Program Kerja"],["logs","Log Aktivitas"],["specific",u.specificTab]
 ].map(([k,n],i)=>`<button class="tabbtn ${i===0?"active":""}" data-tab="${k}">${esc(n)}</button>`).join("");
 document.querySelectorAll(".tabbtn").forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
}
function renderHeader(){
 const u=UNITS[unitCode];document.title=`${u.name} — SIMANIS`;$("topSubtitle").textContent=u.name;$("unitTitle").textContent=u.name;$("unitDesc").textContent=u.desc;$("unitIcon").innerHTML=icon(u.icon);$("statSpecificLabel").textContent=u.specificLabel
}
function renderSummary(){
 const u=UNITS[unitCode],ongoing=programs.filter(x=>x.status==="ONGOING").slice(0,5),recent=logs.slice(0,5);
 const focus={
  PKM_KURIKULUM:["Kurikulum & perangkat ajar","Jadwal dan beban mengajar","Supervisi pembelajaran","Evaluasi akademik"],
  PKM_KESISWAAN:["Pembinaan dan disiplin","Kehadiran siswa","Prestasi & organisasi","Pendampingan siswa"],
  PKM_BENDAHARA_SARPRAS:["Pengelolaan aset","Pemeliharaan sarpras","Koordinasi kebutuhan fasilitas","Sinkronisasi dengan keuangan"],
  PKM_HUMASY:["Publikasi madrasah","Kalender konten","Hubungan masyarakat","Dokumentasi informasi"],
  KEPALA_TU:["Surat masuk & keluar","Arsip tata usaha","Layanan administrasi","Data kelembagaan"],
  KALAB_IPA:["Inventaris alat & bahan","Jadwal praktikum","Keselamatan laboratorium","Pemeliharaan"],
  KALAB_BISNIS:["Inventaris fasilitas","Jadwal praktik bisnis","Aktivitas kewirausahaan","Pemeliharaan"]
 }[unitCode]||[];
 $("panelSummary").innerHTML=`<div class="grid2"><article class="cardx"><h3>Fokus Kerja</h3><div class="focus">${focus.map(x=>`<div class="focus-item">${esc(x)}</div>`).join("")}</div></article><article class="cardx"><h3>Program Berjalan</h3>${ongoing.length?ongoing.map(x=>`<div style="padding:8px 0;border-bottom:1px solid #edf1ef"><b style="font-size:9px">${esc(x.title)}</b><div class="progress"><span style="width:${Number(x.progress||0)}%"></span></div><div style="font-size:8px;color:#73817a;margin-top:4px">${x.progress}% · ${esc(x.person_in_charge||"-")}</div></div>`).join(""):'<div class="empty">Belum ada program berjalan.</div>'}</article></div><article class="cardx"><h3>Aktivitas Terbaru</h3>${recent.length?recent.map(x=>`<div style="padding:8px 0;border-bottom:1px solid #edf1ef"><b style="font-size:9px">${esc(x.title)}</b><div style="font-size:8px;color:#73817a">${dateID(x.activity_date)} · ${esc(x.result||"Belum ada hasil")}</div></div>`).join(""):'<div class="empty">Belum ada aktivitas tercatat.</div>'}</article>`;
}
function renderStats(){$("statPrograms").textContent=programs.length;$("statDone").textContent=programs.filter(x=>x.status==="DONE").length;$("statLogs").textContent=logs.length;$("statSpecific").textContent=specific.length}
function renderPrograms(){
 $("programBody").innerHTML=programs.length?programs.map(x=>`<tr><td><b>${esc(x.title)}</b><br><span style="color:#73817a">${esc(x.category||"-")}</span></td><td>${dateID(x.start_date)}<br>${dateID(x.end_date)}</td><td>${esc(x.person_in_charge||"-")}</td><td>${x.progress}%<div class="progress"><span style="width:${x.progress}%"></span></div></td><td>${badge(x.status)}</td><td><button class="mini-btn" data-edit-program="${x.id}">Edit</button> <button class="mini-btn" data-del-program="${x.id}">Hapus</button></td></tr>`).join(""):'<tr><td colspan="6"><div class="empty">Belum ada program kerja.</div></td></tr>';
 document.querySelectorAll("[data-edit-program]").forEach(b=>b.onclick=()=>openProgram(b.dataset.editProgram));document.querySelectorAll("[data-del-program]").forEach(b=>b.onclick=()=>del("unit_work_programs",b.dataset.delProgram))
}
function renderLogs(){
 $("logBody").innerHTML=logs.length?logs.map(x=>`<tr><td>${dateID(x.activity_date)}</td><td><b>${esc(x.title)}</b><br>${esc(x.description||"")}</td><td>${esc(x.result||"-")}</td><td>${esc(x.follow_up||"-")}</td><td>${esc(x.person_in_charge||"-")}</td><td><button class="mini-btn" data-edit-log="${x.id}">Edit</button> <button class="mini-btn" data-del-log="${x.id}">Hapus</button></td></tr>`).join(""):'<tr><td colspan="6"><div class="empty">Belum ada log aktivitas.</div></td></tr>';
 document.querySelectorAll("[data-edit-log]").forEach(b=>b.onclick=()=>openLog(b.dataset.editLog));document.querySelectorAll("[data-del-log]").forEach(b=>b.onclick=()=>del("unit_activity_logs",b.dataset.delLog))
}
function renderSpecific(){
 const u=UNITS[unitCode];let body="";
 if(unitCode==="PKM_KURIKULUM")body=`<article class="cardx"><div class="actions"><button class="primary-btn" id="addSpecificBtn">+ Supervisi</button></div><div class="table-wrap"><table class="tablex"><thead><tr><th>Tanggal</th><th>Guru</th><th>Jenis</th><th>Nilai</th><th>Status</th><th>Tindak Lanjut</th><th>Aksi</th></tr></thead><tbody>${specific.length?specific.map(x=>`<tr><td>${dateID(x.supervision_date)}</td><td>${esc(x.teachers?.full_name||"-")}</td><td>${esc(x.supervision_type)}</td><td>${x.score??"-"}</td><td>${badge(x.status)}</td><td>${esc(x.follow_up||"-")}</td><td><button class="mini-btn" data-edit-specific="${x.id}">Edit</button></td></tr>`).join(""):'<tr><td colspan="7"><div class="empty">Belum ada supervisi.</div></td></tr>'}</tbody></table></div></article>`;
 else if(unitCode==="PKM_KESISWAAN")body=`<article class="cardx"><div class="actions"><button class="primary-btn" id="addSpecificBtn">+ Catatan Siswa</button></div><div class="table-wrap"><table class="tablex"><thead><tr><th>Tanggal</th><th>Siswa</th><th>Kategori</th><th>Catatan</th><th>Poin</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${specific.length?specific.map(x=>`<tr><td>${dateID(x.case_date)}</td><td>${esc(x.students?.full_name||"-")}<br>${esc(x.students?.nisn||"")}</td><td>${esc(x.category)}</td><td><b>${esc(x.title)}</b><br>${esc(x.description||"")}</td><td>${x.points}</td><td>${badge(x.status)}</td><td><button class="mini-btn" data-edit-specific="${x.id}">Edit</button></td></tr>`).join(""):'<tr><td colspan="7"><div class="empty">Belum ada catatan pembinaan.</div></td></tr>'}</tbody></table></div></article>`;
 else if(unitCode==="PKM_BENDAHARA_SARPRAS")body=`<article class="cardx">
 <div class="asset-toolbar">
   <label><span>Cari Aset</span><input id="assetSearch" type="search" placeholder="Kode / nama / lokasi..."></label>
   <label><span>Kondisi</span><select id="assetConditionFilter"><option value="">Semua Kondisi</option><option>BAIK</option><option>RUSAK_RINGAN</option><option>RUSAK_BERAT</option><option>HILANG</option></select></label>
   <label><span>Lokasi</span><select id="assetLocationFilter"><option value="">Semua Lokasi</option>${[...new Set(specific.map(a=>a.location).filter(Boolean))].sort().map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("")}</select></label>
   <div class="actions" style="margin:0"><button class="secondary-btn" id="printAllQrBtn">Cetak QR</button><button class="primary-btn" id="addSpecificBtn">+ Aset</button></div>
 </div>
 <div id="assetTableWrap"></div>
 </article>`;
 else if(unitCode==="PKM_HUMASY")body=`<article class="cardx"><div class="actions"><button class="primary-btn" id="addSpecificBtn">+ Rencana Publikasi</button></div><div class="table-wrap"><table class="tablex"><thead><tr><th>Tanggal</th><th>Channel</th><th>Konten</th><th>PIC</th><th>Status</th><th>Link</th><th>Aksi</th></tr></thead><tbody>${specific.length?specific.map(x=>`<tr><td>${dateID(x.publish_date)}</td><td>${esc(x.channel)}</td><td><b>${esc(x.title)}</b><br>${esc(x.content_type||"")}</td><td>${esc(x.person_in_charge||"-")}</td><td>${badge(x.status)}</td><td>${x.published_link?`<a href="${esc(x.published_link)}" target="_blank">Buka</a>`:"-"}</td><td><button class="mini-btn" data-edit-specific="${x.id}">Edit</button></td></tr>`).join(""):'<tr><td colspan="7"><div class="empty">Belum ada rencana publikasi.</div></td></tr>'}</tbody></table></div></article>`;
 else if(unitCode==="KEPALA_TU")body=`<article class="cardx"><div class="actions"><button class="primary-btn" id="addSpecificBtn">+ Surat</button></div><div class="table-wrap"><table class="tablex"><thead><tr><th>Jenis</th><th>No. Surat</th><th>Tanggal</th><th>Asal/Tujuan</th><th>Perihal</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${specific.length?specific.map(x=>`<tr><td>${esc(x.letter_type==="INCOMING"?"MASUK":"KELUAR")}</td><td>${esc(x.letter_number||"-")}</td><td>${dateID(x.letter_date)}</td><td>${esc(x.sender_recipient)}</td><td>${esc(x.subject)}</td><td>${badge(x.status)}</td><td><button class="mini-btn" data-edit-specific="${x.id}">Edit</button></td></tr>`).join(""):'<tr><td colspan="7"><div class="empty">Belum ada surat tercatat.</div></td></tr>'}</tbody></table></div></article>`;
 else body=`<article class="cardx"><div class="actions"><button class="primary-btn" id="addSpecificBtn">+ Inventaris</button><button class="secondary-btn" id="bookingBtn">Jadwal Penggunaan</button></div><div class="table-wrap"><table class="tablex"><thead><tr><th>Kode</th><th>Item</th><th>Kategori</th><th>Jumlah</th><th>Kondisi</th><th>Lokasi</th><th>Aksi</th></tr></thead><tbody>${specific.length?specific.map(x=>`<tr><td>${esc(x.item_code||"-")}</td><td>${esc(x.item_name)}</td><td>${esc(x.category||"-")}</td><td>${x.quantity} ${esc(x.unit||"")}</td><td>${badge(x.condition)}</td><td>${esc(x.location||"-")}</td><td><button class="mini-btn" data-edit-specific="${x.id}">Edit</button></td></tr>`).join(""):'<tr><td colspan="7"><div class="empty">Belum ada inventaris laboratorium.</div></td></tr>'}</tbody></table></div></article>`;
 $("panelSpecific").innerHTML=body;
 if($("addSpecificBtn"))$("addSpecificBtn").onclick=()=>openSpecific();
 document.querySelectorAll("[data-edit-specific]").forEach(b=>b.onclick=()=>openSpecific(b.dataset.editSpecific));
 if($("bookingBtn"))$("bookingBtn").onclick=openBooking;
 if(unitCode==="PKM_BENDAHARA_SARPRAS"){
   renderAssetTable();
   $("assetSearch").oninput=renderAssetTable;
   $("assetConditionFilter").onchange=renderAssetTable;
   $("assetLocationFilter").onchange=renderAssetTable;
   $("printAllQrBtn").onclick=printFilteredQrLabels;
 }
}

function filteredAssets(){
  if(unitCode!=="PKM_BENDAHARA_SARPRAS")return specific;
  const q=$("assetSearch")?.value?.trim().toLowerCase()||"";
  const cond=$("assetConditionFilter")?.value||"";
  const loc=$("assetLocationFilter")?.value||"";
  return specific.filter(a=>{
    const hay=`${a.asset_code||""} ${a.asset_name||""} ${a.category||""} ${a.location||""}`.toLowerCase();
    return(!q||hay.includes(q))&&(!cond||a.condition===cond)&&(!loc||a.location===loc);
  });
}
function renderAssetTable(){
  const holder=$("assetTableWrap");if(!holder)return;
  const data=filteredAssets();
  holder.innerHTML=`<div class="table-wrap"><table class="tablex"><thead><tr><th>Kode</th><th>Aset</th><th>Lokasi</th><th>Jumlah</th><th>Kondisi</th><th>Nilai</th><th>Aksi</th></tr></thead><tbody>${data.length?data.map(x=>`<tr><td><b>${esc(x.asset_code||"-")}</b></td><td><b>${esc(x.asset_name)}</b><br><span style="color:#73817a">${esc(x.category||"-")}</span></td><td>${esc(x.location||"-")}</td><td>${x.quantity} ${esc(x.unit||"")}</td><td>${badge(x.condition)}</td><td>${money(x.acquisition_value)}</td><td><button class="mini-btn" data-asset-detail="${x.id}">Detail</button> <button class="mini-btn" data-asset-qr="${x.id}">QR</button> <button class="mini-btn" data-edit-specific="${x.id}">Edit</button></td></tr>`).join(""):'<tr><td colspan="7"><div class="empty">Aset tidak ditemukan.</div></td></tr>'}</tbody></table></div>`;
  holder.querySelectorAll("[data-asset-detail]").forEach(b=>b.onclick=()=>openAssetDetail(b.dataset.assetDetail));
  holder.querySelectorAll("[data-asset-qr]").forEach(b=>b.onclick=()=>openAssetQr(b.dataset.assetQr));
  holder.querySelectorAll("[data-edit-specific]").forEach(b=>b.onclick=()=>openSpecific(b.dataset.editSpecific));
}
async function openAssetDetail(id){
  try{
    const h=await api.db.rpc("get_asset_history",{p_asset_id:id});
    const a=h?.asset||specific.find(x=>x.id===id);if(!a)throw new Error("Aset tidak ditemukan");
    assetMaintenance=h?.maintenance||[];assetMutations=h?.mutations||[];
    openModal(`Detail Aset · ${a.asset_code||""}`,"asset_detail",id);
    setFields(`<div class="full asset-detail-grid">
      <div>
        <div class="asset-info">
          <div><span>Nama Aset</span><b>${esc(a.asset_name)}</b></div>
          <div><span>Kode Aset</span><b>${esc(a.asset_code||"-")}</b></div>
          <div><span>Kategori</span><b>${esc(a.category||"-")}</b></div>
          <div><span>Lokasi</span><b>${esc(a.location||"-")}</b></div>
          <div><span>Jumlah</span><b>${a.quantity} ${esc(a.unit||"")}</b></div>
          <div><span>Kondisi</span><b>${esc(a.condition)}</b></div>
          <div><span>Nilai Perolehan</span><b>${money(a.acquisition_value)}</b></div>
          <div><span>Penanggung Jawab</span><b>${esc(a.responsible_person||"-")}</b></div>
        </div>
        <div class="actions" style="justify-content:flex-start">
          <button type="button" class="secondary-btn" id="detailQrBtn">QR Label</button>
          <button type="button" class="secondary-btn" id="detailMutationBtn">Mutasi Lokasi</button>
          <button type="button" class="secondary-btn" id="detailMaintenanceBtn">Pemeliharaan</button>
          <button type="button" class="secondary-btn" id="detailEditBtn">Edit Aset</button>
        </div>
      </div>
      <div>
        <div class="asset-history"><h4 style="margin:0;font-size:10px">Riwayat Pemeliharaan</h4>
          ${assetMaintenance.length?assetMaintenance.map(m=>`<div class="history-row"><b>${dateID(m.maintenance_date)} · ${esc(m.status)}</b><p>${esc(m.description)}</p><p>Biaya: ${money(m.cost)}${m.vendor?` · ${esc(m.vendor)}`:""}</p></div>`).join(""):'<div class="empty">Belum ada riwayat pemeliharaan.</div>'}
          <h4 style="margin:6px 0 0;font-size:10px">Riwayat Mutasi</h4>
          ${assetMutations.length?assetMutations.map(m=>`<div class="history-row"><b>${dateID(m.mutation_date)}</b><p>${esc(m.from_location||"-")} → <b>${esc(m.to_location)}</b></p><p>${esc(m.person_in_charge||"-")}${m.note?` · ${esc(m.note)}`:""}</p></div>`).join(""):'<div class="empty">Belum ada riwayat mutasi.</div>'}
        </div>
      </div>
    </div>`);
    const saveBtn=$("entryForm").querySelector('button[type="submit"]');if(saveBtn)saveBtn.style.display="none";
    $("detailQrBtn").onclick=()=>openAssetQr(id);
    $("detailMutationBtn").onclick=()=>openAssetMutation(id);
    $("detailMaintenanceBtn").onclick=()=>openAssetMaintenance(id);
    $("detailEditBtn").onclick=()=>openSpecific(id);
  }catch(err){alert("Gagal membuka detail aset: "+err.message)}
}
function openAssetQr(id){
  const a=specific.find(x=>x.id===id);if(!a)return;
  openModal(`QR Aset · ${a.asset_code||""}`,"asset_qr",id);
  setFields(`<div class="full qr-box"><div id="singleQr"></div><div class="qr-code-text">${esc(a.asset_code||"-")}</div><div style="font-size:9px;margin-top:4px">${esc(a.asset_name)}</div><div style="font-size:8px;color:#718078;margin-top:3px">${esc(a.location||"-")}</div></div><div class="full actions"><button type="button" id="printSingleQrBtn" class="primary-btn">Cetak Label QR</button></div>`);
  const saveBtn=$("entryForm").querySelector('button[type="submit"]');if(saveBtn)saveBtn.style.display="none";
  qrCanvas($("singleQr"),assetDeepLink(id),180);
  $("printSingleQrBtn").onclick=()=>printQrLabels([a]);
}
function openAssetMutation(id){
  const a=specific.find(x=>x.id===id);if(!a)return;
  openModal(`Mutasi Lokasi · ${a.asset_code||""}`,"asset_mutation",id);
  setFields(`<div class="full" style="font-size:9px;background:#f7faf8;padding:10px;border-radius:10px">Lokasi saat ini: <b>${esc(a.location||"-")}</b></div>`+inp("fDate","Tanggal Mutasi","date",today())+inp("fToLocation","Lokasi Tujuan *","text","")+inp("fPIC","Penanggung Jawab","text",a.responsible_person||"")+ta("fNote","Catatan",""));
}
function openAssetMaintenance(id){
  const a=specific.find(x=>x.id===id);if(!a)return;
  openModal(`Pemeliharaan · ${a.asset_code||""}`,"asset_maintenance",id);
  setFields(inp("fDate","Tanggal","date",today())+inp("fCost","Biaya","number",0)+inp("fVendor","Vendor/Teknisi","text","")+sel("fStatus","Status",[["PLANNED","PLANNED"],["PROCESS","PROCESS"],["DONE","DONE"],["CANCELLED","CANCELLED"]],"PLANNED")+inp("fNext","Pemeliharaan Berikutnya","date","")+ta("fDesc","Deskripsi *","")+ta("fNote","Catatan",""));
}
async function printQrLabels(data){
  if(!data.length){alert("Tidak ada aset untuk dicetak.");return}
  const sheet=$("labelSheet");sheet.innerHTML=data.map(a=>`<article class="asset-label"><div id="labelqr-${a.id}"></div><div><h3>MA NURUL ISLAM</h3><p>${esc(a.asset_name)}</p><p class="code">${esc(a.asset_code||"-")}</p><p>${esc(a.location||"-")}</p></div></article>`).join("");
  await new Promise(resolve=>{
    let left=data.length;if(!window.QRCode?.toCanvas){resolve();return}
    data.forEach(a=>{
      const box=$(`labelqr-${a.id}`),canvas=document.createElement("canvas");box.appendChild(canvas);
      window.QRCode.toCanvas(canvas,assetDeepLink(a.id),{width:140,margin:1,errorCorrectionLevel:"M"},()=>{left--;if(left<=0)resolve()});
    });
    setTimeout(resolve,1200);
  });
  document.body.classList.add("print-labels");
  setTimeout(()=>{window.print();setTimeout(()=>document.body.classList.remove("print-labels"),300)},150);
}
function printFilteredQrLabels(){printQrLabels(filteredAssets())}

function renderAll(){renderStats();renderSummary();renderPrograms();renderLogs();renderSpecific()}

function setFields(html){$("entryFields").innerHTML=html}
function openModal(title,mode,id=""){$("entryTitle").textContent=title;$("entryMode").value=mode;$("entryId").value=id;$("entryMessage").textContent="";const saveBtn=$("entryForm").querySelector('button[type="submit"]');if(saveBtn)saveBtn.style.display="";$("entryModal").classList.remove("hidden")}
function closeModal(){$("entryModal").classList.add("hidden")}
function inp(id,label,type="text",val="",full=false){return`<label class="${full?"full":""}"><span>${label}</span><input id="${id}" type="${type}" value="${esc(val??"")}"></label>`}
function sel(id,label,opts,val="",full=false){return`<label class="${full?"full":""}"><span>${label}</span><select id="${id}">${opts.map(([v,n])=>`<option value="${esc(v)}" ${String(v)===String(val)?"selected":""}>${esc(n)}</option>`).join("")}</select></label>`}
function ta(id,label,val="",full=true){return`<label class="${full?"full":""}"><span>${label}</span><textarea id="${id}" rows="3">${esc(val??"")}</textarea></label>`}

function openProgram(id=""){
 const x=programs.find(v=>v.id===id)||{};openModal(id?"Edit Program Kerja":"Tambah Program Kerja","program",id);
 setFields(inp("fTitle","Judul *","text",x.title,"true")+inp("fCategory","Kategori","text",x.category)+inp("fPIC","PIC","text",x.person_in_charge)+inp("fStart","Mulai","date",x.start_date)+inp("fEnd","Selesai","date",x.end_date)+inp("fProgress","Progress (%)","number",x.progress??0)+inp("fBudget","Rencana Anggaran","number",x.budget_plan??0)+sel("fStatus","Status",[["PLANNED","PLANNED"],["ONGOING","ONGOING"],["DONE","DONE"],["CANCELLED","CANCELLED"]],x.status||"PLANNED")+ta("fNote","Catatan",x.note))
}
function openLog(id=""){
 const x=logs.find(v=>v.id===id)||{};openModal(id?"Edit Log Aktivitas":"Catat Aktivitas","log",id);
 setFields(inp("fDate","Tanggal","date",x.activity_date||today())+inp("fTitle","Judul *","text",x.title)+inp("fPIC","PIC","text",x.person_in_charge)+ta("fDesc","Deskripsi",x.description)+ta("fResult","Hasil",x.result)+ta("fFollow","Tindak Lanjut",x.follow_up))
}
function openSpecific(id=""){
 const x=specific.find(v=>v.id===id)||{};openModal(id?`Edit ${UNITS[unitCode].specificTab}`:`Tambah ${UNITS[unitCode].specificTab}`,"specific",id);
 if(unitCode==="PKM_KURIKULUM")setFields(sel("fTeacher","Guru *",teachers.map(t=>[t.id,`${t.teacher_code||"-"} · ${t.full_name}`]),x.teacher_id)+sel("fSemester","Semester",[[ "", "Tidak dipilih"],...semesters.map(s=>[s.id,s.name])],x.semester_id)+inp("fDate","Tanggal","date",x.supervision_date||today())+sel("fType","Jenis",[["PERANGKAT_AJAR","Perangkat Ajar"],["PEMBELAJARAN","Pembelajaran"],["PENILAIAN","Penilaian"],["LAINNYA","Lainnya"]],x.supervision_type||"PEMBELAJARAN")+inp("fScore","Nilai","number",x.score??"")+sel("fStatus","Status",[["PLANNED","PLANNED"],["DONE","DONE"],["FOLLOW_UP","FOLLOW_UP"]],x.status||"PLANNED")+ta("fStrength","Kekuatan",x.strengths)+ta("fNotes","Catatan",x.notes)+ta("fFollow","Tindak Lanjut",x.follow_up));
 else if(unitCode==="PKM_KESISWAAN")setFields(sel("fStudent","Siswa *",students.map(s=>[s.id,`${s.full_name} · ${s.nisn||"-"}`]),x.student_id)+inp("fDate","Tanggal","date",x.case_date||today())+sel("fCategory","Kategori",[["PELANGGARAN","Pelanggaran"],["PEMBINAAN","Pembinaan"],["KONSELING","Konseling"],["PENGHARGAAN","Penghargaan"],["LAINNYA","Lainnya"]],x.category||"PEMBINAAN")+inp("fTitle","Judul *","text",x.title,true)+inp("fPoints","Poin","number",x.points??0)+inp("fHandler","Penangan","text",x.handled_by)+sel("fStatus","Status",[["OPEN","OPEN"],["PROCESS","PROCESS"],["CLOSED","CLOSED"]],x.status||"OPEN")+ta("fDesc","Deskripsi",x.description)+ta("fAction","Tindakan",x.action_taken)+ta("fFollow","Tindak Lanjut",x.follow_up));
 else if(unitCode==="PKM_BENDAHARA_SARPRAS")setFields(inp("fCode","Kode Aset","text",x.asset_code)+inp("fName","Nama Aset *","text",x.asset_name)+inp("fCategory","Kategori","text",x.category)+inp("fLocation","Lokasi","text",x.location)+inp("fDate","Tanggal Perolehan","date",x.acquisition_date)+inp("fValue","Nilai Perolehan","number",x.acquisition_value??0)+inp("fQty","Jumlah","number",x.quantity??1)+inp("fUnit","Satuan","text",x.unit||"UNIT")+sel("fCondition","Kondisi",[["BAIK","Baik"],["RUSAK_RINGAN","Rusak Ringan"],["RUSAK_BERAT","Rusak Berat"],["HILANG","Hilang"]],x.condition||"BAIK")+sel("fStatus","Status",[["ACTIVE","ACTIVE"],["MAINTENANCE","MAINTENANCE"],["DISPOSED","DISPOSED"]],x.status||"ACTIVE")+inp("fPIC","Penanggung Jawab","text",x.responsible_person)+ta("fNote","Catatan",x.note));
 else if(unitCode==="PKM_HUMASY")setFields(inp("fDate","Tanggal Publikasi","date",x.publish_date||today())+sel("fChannel","Channel",[["WEBSITE","Website"],["INSTAGRAM","Instagram"],["FACEBOOK","Facebook"],["YOUTUBE","YouTube"],["WHATSAPP","WhatsApp"],["LAINNYA","Lainnya"]],x.channel||"INSTAGRAM")+inp("fTitle","Judul Konten *","text",x.title,true)+inp("fType","Jenis Konten","text",x.content_type)+inp("fPIC","PIC","text",x.person_in_charge)+sel("fStatus","Status",[["IDEA","IDEA"],["DRAFT","DRAFT"],["READY","READY"],["PUBLISHED","PUBLISHED"],["CANCELLED","CANCELLED"]],x.status||"IDEA")+inp("fLink","Link Publikasi","text",x.published_link,true)+ta("fNote","Catatan",x.note));
 else if(unitCode==="KEPALA_TU")setFields(sel("fLetterType","Jenis Surat",[["INCOMING","Surat Masuk"],["OUTGOING","Surat Keluar"]],x.letter_type||"INCOMING")+inp("fNumber","Nomor Surat","text",x.letter_number)+inp("fLetterDate","Tanggal Surat","date",x.letter_date||today())+inp("fAdminDate","Tanggal Administrasi","date",x.administration_date||today())+inp("fSender","Asal/Tujuan *","text",x.sender_recipient,true)+inp("fSubject","Perihal *","text",x.subject,true)+inp("fClass","Klasifikasi","text",x.classification)+sel("fStatus","Status",[["RECORDED","RECORDED"],["PROCESS","PROCESS"],["DONE","DONE"],["ARCHIVED","ARCHIVED"]],x.status||"RECORDED")+ta("fDisposition","Disposisi",x.disposition)+ta("fNote","Catatan",x.note));
 else setFields(inp("fCode","Kode Item","text",x.item_code)+inp("fName","Nama Item *","text",x.item_name)+inp("fCategory","Kategori","text",x.category)+inp("fQty","Jumlah","number",x.quantity??0)+inp("fUnit","Satuan","text",x.unit||"UNIT")+sel("fCondition","Kondisi",[["BAIK","Baik"],["RUSAK_RINGAN","Rusak Ringan"],["RUSAK_BERAT","Rusak Berat"],["HABIS","Habis"]],x.condition||"BAIK")+inp("fLocation","Lokasi","text",x.location)+inp("fMin","Stok Minimum","number",x.minimum_stock??0)+ta("fNote","Catatan",x.note))
}
function openBooking(){
 openModal("Tambah Jadwal Penggunaan Laboratorium","booking","");
 setFields(inp("fDate","Tanggal","date",today())+inp("fStart","Mulai","time","08:00")+inp("fEnd","Selesai","time","09:40")+sel("fClass","Kelas",[[ "", "Tidak dipilih"],...classes.map(c=>[c.id,c.name])],"")+sel("fTeacher","Guru",[[ "", "Tidak dipilih"],...teachers.map(t=>[t.id,t.full_name])],"")+inp("fActivity","Kegiatan *","text","",true)+inp("fPIC","PIC","text","")+sel("fStatus","Status",[["BOOKED","BOOKED"],["ONGOING","ONGOING"],["DONE","DONE"],["CANCELLED","CANCELLED"]],"BOOKED")+ta("fNote","Catatan",""))
}
function v(id){return $(id)?.value?.trim()??""}
async function saveEntry(e){
 e.preventDefault();const mode=v("entryMode"),id=v("entryId");$("entryMessage").textContent="Menyimpan...";
 try{
  let table,payload;
  if(mode==="asset_mutation"){
    await api.db.rpc("record_asset_mutation",{p_asset_id:id,p_to_location:v("fToLocation"),p_person_in_charge:v("fPIC")||null,p_note:v("fNote")||null,p_mutation_date:v("fDate")||today()});
    closeModal();await loadData();return;
  }
  else if(mode==="asset_maintenance"){
    table="asset_maintenance";payload={asset_id:id,maintenance_date:v("fDate")||today(),description:v("fDesc"),cost:Number(v("fCost")||0),vendor:v("fVendor")||null,status:v("fStatus"),next_maintenance_date:v("fNext")||null,note:v("fNote")||null};
  }
  else if(mode==="program"){table="unit_work_programs";payload={unit_code:unitCode,title:v("fTitle"),category:v("fCategory")||null,start_date:v("fStart")||null,end_date:v("fEnd")||null,person_in_charge:v("fPIC")||null,progress:Number(v("fProgress")||0),budget_plan:Number(v("fBudget")||0),status:v("fStatus"),note:v("fNote")||null}}
  else if(mode==="log"){table="unit_activity_logs";payload={unit_code:unitCode,activity_date:v("fDate")||today(),title:v("fTitle"),description:v("fDesc")||null,result:v("fResult")||null,follow_up:v("fFollow")||null,person_in_charge:v("fPIC")||null}}
  else if(mode==="booking"){table="lab_bookings";payload={lab_code:UNITS[unitCode].lab,usage_date:v("fDate"),start_time:v("fStart"),end_time:v("fEnd"),class_id:v("fClass")||null,teacher_id:v("fTeacher")||null,activity:v("fActivity"),person_in_charge:v("fPIC")||null,status:v("fStatus"),note:v("fNote")||null}}
  else if(unitCode==="PKM_KURIKULUM"){table="curriculum_supervisions";payload={teacher_id:v("fTeacher"),semester_id:v("fSemester")||null,supervision_date:v("fDate"),supervision_type:v("fType"),score:v("fScore")===""?null:Number(v("fScore")),status:v("fStatus"),strengths:v("fStrength")||null,notes:v("fNotes")||null,follow_up:v("fFollow")||null}}
  else if(unitCode==="PKM_KESISWAAN"){table="student_guidance_cases";payload={student_id:v("fStudent"),case_date:v("fDate"),category:v("fCategory"),title:v("fTitle"),description:v("fDesc")||null,points:Number(v("fPoints")||0),action_taken:v("fAction")||null,follow_up:v("fFollow")||null,status:v("fStatus"),handled_by:v("fHandler")||null}}
  else if(unitCode==="PKM_BENDAHARA_SARPRAS"){table="school_assets";payload={asset_code:v("fCode")||null,asset_name:v("fName"),category:v("fCategory")||null,location:v("fLocation")||null,acquisition_date:v("fDate")||null,acquisition_value:Number(v("fValue")||0),quantity:Number(v("fQty")||0),unit:v("fUnit")||"UNIT",condition:v("fCondition"),status:v("fStatus"),responsible_person:v("fPIC")||null,note:v("fNote")||null}}
  else if(unitCode==="PKM_HUMASY"){table="humas_publication_plans";payload={publish_date:v("fDate"),channel:v("fChannel"),title:v("fTitle"),content_type:v("fType")||null,status:v("fStatus"),person_in_charge:v("fPIC")||null,published_link:v("fLink")||null,note:v("fNote")||null}}
  else if(unitCode==="KEPALA_TU"){table="office_letters";payload={letter_type:v("fLetterType"),letter_number:v("fNumber")||null,letter_date:v("fLetterDate"),administration_date:v("fAdminDate"),sender_recipient:v("fSender"),subject:v("fSubject"),classification:v("fClass")||null,disposition:v("fDisposition")||null,status:v("fStatus"),note:v("fNote")||null}}
  else {table="lab_inventory";payload={lab_code:UNITS[unitCode].lab,item_code:v("fCode")||null,item_name:v("fName"),category:v("fCategory")||null,quantity:Number(v("fQty")||0),unit:v("fUnit")||"UNIT",condition:v("fCondition"),location:v("fLocation")||null,minimum_stock:Number(v("fMin")||0),note:v("fNote")||null}}
  if(mode==="asset_maintenance" && !payload.description)throw new Error("Deskripsi pemeliharaan wajib diisi.");
  if(mode!=="asset_maintenance" && !payload.title&&!payload.asset_name&&!payload.item_name&&!payload.activity&&!payload.subject&&!payload.teacher_id&&!payload.student_id)throw new Error("Data utama wajib diisi.");
  if(id)await restWrite(`${table}?id=eq.${encodeURIComponent(id)}`,"PATCH",payload);else await restWrite(table,"POST",payload);
  closeModal();await loadData()
 }catch(err){$("entryMessage").textContent="Gagal: "+err.message}
}
async function del(table,id){if(!confirm("Hapus data ini?"))return;try{await restWrite(`${table}?id=eq.${encodeURIComponent(id)}`,"DELETE");await loadData()}catch(err){alert("Gagal menghapus: "+err.message)}}

$("entryForm").onsubmit=saveEntry;$("entryClose").onclick=closeModal;$("entryCancel").onclick=closeModal;$("entryModal").onclick=e=>{if(e.target===$("entryModal"))closeModal()};$("addProgramBtn").onclick=()=>openProgram();$("addLogBtn").onclick=()=>openLog();

(async()=>{try{
 api=await window.simanisReady;const user=await api.auth.getUser();if(!user){location.href="index.html";return}
 profile=await loadProfile(user);$("sideUserName").textContent=profile.full_name;$("sideUserRole").textContent=roleLabel(profile.role);$("headerUser").textContent=profile.full_name;$("currentDate").textContent=localDateID();
 if(!UNITS[unitCode])throw new Error("Parameter unit kerja tidak valid.");if(!await checkAccess())throw new Error("Akun ini tidak ditugaskan pada unit kerja tersebut.");
 await loadMenu();await loadMasters();renderHeader();renderTabs();await loadData();
 const assetParam=new URLSearchParams(location.search).get("asset");
 if(unitCode==="PKM_BENDAHARA_SARPRAS"&&assetParam&&specific.some(a=>a.id===assetParam)){setTab("specific");setTimeout(()=>openAssetDetail(assetParam),100)}
 $("logoutBtn").onclick=async()=>{await api.auth.signOut();location.href="index.html"}
}catch(err){console.error(err);alert("Unit Kerja gagal dimuat: "+err.message);if(String(err.message).includes("tidak ditugaskan"))location.href="dashboard.html"}finally{$("loading").style.display="none"}})();