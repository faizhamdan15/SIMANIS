const $=id=>document.getElementById(id);
let api,profile,myModules=[],programs=[],logs=[],specific=[],teachers=[],students=[],classes=[],semesters=[],assets=[],assetMutations=[],assetMaintenance=[],docTypes=[],teacherDocs=[],calendarEvents=[],teacherRecap=[],rubricItems=[];
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

 if(unitCode==="PKM_KURIKULUM"){
   const activeSemester=semesters.find(s=>s.is_active)||semesters[0];
   const extra=await Promise.all([
     api.db.select("curriculum_document_types","select=*&is_active=eq.true&order=sort_order.asc"),
     activeSemester?api.db.select("curriculum_teacher_documents",`select=*,teachers(full_name,teacher_code),curriculum_document_types(code,name,is_required)&semester_id=eq.${activeSemester.id}&order=created_at.desc`):Promise.resolve([]),
     api.db.select("academic_calendar_events","select=*,academic_years(name),semesters(name)&order=start_date.asc"),
     api.db.select("curriculum_supervision_rubric","select=*&is_active=eq.true&order=sort_order.asc"),
     activeSemester?api.db.rpc("curriculum_get_teacher_recap",{p_semester_id:activeSemester.id}):Promise.resolve([])
   ]);
   docTypes=extra[0]||[];teacherDocs=extra[1]||[];calendarEvents=extra[2]||[];rubricItems=extra[3]||[];teacherRecap=extra[4]||[];
 }
 renderAll();
}
function setTab(name){
 document.querySelectorAll(".tabbtn").forEach(b=>b.classList.toggle("active",b.dataset.tab===name));
 ["Summary","Programs","Logs","Specific","Documents","Calendar","Recap"].forEach(x=>$("panel"+x).classList.toggle("hidden",x.toLowerCase()!==name));
}
function renderTabs(){
 const u=UNITS[unitCode];
 const base=[["summary","Ringkasan"],["programs","Program Kerja"],["logs","Log Aktivitas"],["specific",u.specificTab]];
 if(unitCode==="PKM_KURIKULUM"){
   base.push(["documents","Perangkat Ajar"],["calendar","Kalender Akademik"],["recap","Rekap Guru"]);
 }
 $("tabs").innerHTML=base.map(([k,n],i)=>`<button class="tabbtn ${i===0?"active":""}" data-tab="${k}">${esc(n)}</button>`).join("");
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
function renderStats(){$("statPrograms").textContent=programs.length;$("statDone").textContent=programs.filter(x=>x.status==="DONE").length;$("statLogs").textContent=logs.length;if(unitCode==="PKM_KURIKULUM"){$("statSpecificLabel").textContent="Supervisi";$("statSpecific").textContent=specific.length}else{$("statSpecific").textContent=specific.length}}
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
 if(unitCode==="PKM_KURIKULUM")body=`<article class="cardx">
 <div class="actions"><button class="primary-btn" id="addSpecificBtn">+ Supervisi Digital</button></div>
 <div class="table-wrap"><table class="tablex"><thead><tr><th>Tanggal</th><th>Guru</th><th>Jenis</th><th>Observer</th><th>Nilai</th><th>Status</th><th>Rekomendasi</th><th>Aksi</th></tr></thead><tbody>${specific.length?specific.map(x=>`<tr><td>${dateID(x.supervision_date)}</td><td>${esc(x.teachers?.full_name||"-")}</td><td>${esc(x.supervision_type)}</td><td>${esc(x.observer_name||"-")}</td><td><b>${x.score??"-"}</b></td><td>${badge(x.status)}</td><td>${esc(x.recommendation||x.follow_up||"-")}</td><td><button class="mini-btn" data-edit-specific="${x.id}">Edit</button></td></tr>`).join(""):'<tr><td colspan="8"><div class="empty">Belum ada supervisi.</div></td></tr>'}</tbody></table></div>
 </article>`;
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


function activeSemester(){
  return semesters.find(s=>s.is_active)||semesters[0]||null;
}
function activeAcademicYearId(){
  const s=activeSemester();return s?.academic_year_id||null;
}
function documentStatusClass(st){
  return st==="TERVERIFIKASI"?"":st==="PERLU_REVISI"?"bad":st==="DIUNGGAH"?"warn":"gray";
}
function renderDocuments(){
  const sem=activeSemester();
  const teacherId=$("docTeacherFilter")?.value||"";
  const status=$("docStatusFilter")?.value||"";
  let docs=teacherDocs;
  if(teacherId)docs=docs.filter(d=>d.teacher_id===teacherId);
  if(status)docs=docs.filter(d=>d.status===status);

  $("panelDocuments").innerHTML=`<article class="cardx">
    <div class="doc-toolbar">
      <label><span>Guru</span><select id="docTeacherFilter"><option value="">Semua Guru</option>${teachers.map(t=>`<option value="${t.id}" ${teacherId===t.id?"selected":""}>${esc(t.full_name)}</option>`).join("")}</select></label>
      <label><span>Status</span><select id="docStatusFilter"><option value="">Semua Status</option>${["DIUNGGAH","PERLU_REVISI","TERVERIFIKASI"].map(s=>`<option ${status===s?"selected":""}>${s}</option>`).join("")}</select></label>
      <div><span style="display:block;font-size:9px;font-weight:800;margin-bottom:5px">Semester</span><div style="padding:10px;border:1px solid #d5e1db;border-radius:10px;font-size:9px">${esc(sem?.name||"-")}</div></div>
      <button class="primary-btn" id="addDocBtn" style="width:auto">+ Perangkat Ajar</button>
    </div>
    <div class="table-wrap"><table class="tablex"><thead><tr><th>Guru</th><th>Perangkat</th><th>Status</th><th>File</th><th>Verifikasi</th><th>Aksi</th></tr></thead><tbody>
      ${docs.length?docs.map(d=>`<tr><td><b>${esc(d.teachers?.full_name||"-")}</b><br>${esc(d.teachers?.teacher_code||"")}</td><td>${esc(d.curriculum_document_types?.name||"-")}</td><td><span class="badge ${documentStatusClass(d.status)}">${esc(d.status)}</span></td><td>${esc(d.original_filename||"-")}</td><td>${d.verified_at?dateID(d.verified_at.slice(0,10)):"-"}<br><span style="color:#718078">${esc(d.verification_note||"")}</span></td><td>${d.file_path?`<button class="mini-btn" data-open-doc="${d.id}">Buka</button> `:""}<button class="mini-btn" data-verify-doc="${d.id}">Verifikasi</button> <button class="mini-btn" data-edit-doc="${d.id}">Edit</button></td></tr>`).join(""):'<tr><td colspan="6"><div class="empty">Belum ada perangkat ajar pada filter ini.</div></td></tr>'}
    </tbody></table></div>
  </article>`;

  $("docTeacherFilter").onchange=renderDocuments;
  $("docStatusFilter").onchange=renderDocuments;
  $("addDocBtn").onclick=()=>openDocument();
  document.querySelectorAll("[data-edit-doc]").forEach(b=>b.onclick=()=>openDocument(b.dataset.editDoc));
  document.querySelectorAll("[data-verify-doc]").forEach(b=>b.onclick=()=>openDocumentVerification(b.dataset.verifyDoc));
  document.querySelectorAll("[data-open-doc]").forEach(b=>b.onclick=()=>openCurriculumFile(b.dataset.openDoc));
}
function openDocument(id=""){
  const d=teacherDocs.find(x=>x.id===id)||{},sem=activeSemester();
  openModal(id?"Edit Perangkat Ajar":"Tambah Perangkat Ajar","curr_doc",id);
  setFields(
    sel("fTeacher","Guru *",teachers.map(t=>[t.id,`${t.teacher_code||"-"} · ${t.full_name}`]),d.teacher_id)+
    sel("fDocType","Jenis Perangkat *",docTypes.map(t=>[t.id,t.name]),d.document_type_id)+
    `<label class="full"><span>File ${d.file_path?"(opsional jika tidak diganti)":"*"}</span><input id="fDocFile" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"></label>`+
    `<div class="full" style="font-size:8px;color:#718078">Semester aktif: <b>${esc(sem?.name||"-")}</b>. Maksimum file 15 MB.</div>`+
    ta("fVerifyNote","Catatan",d.verification_note||"")
  );
}
async function uploadCurriculumFile(file,teacherId,docTypeCode){
  const session=await api.auth.getSession(),cfg=window.SIMANIS_CONFIG;
  const ext=(file.name.split(".").pop()||"bin").replace(/[^a-z0-9]/gi,"").toLowerCase();
  const safe=`${teacherId}/${activeSemester()?.id}/${docTypeCode}-${Date.now()}.${ext}`;
  const res=await fetch(`${cfg.SUPABASE_URL.replace(/\/$/,"")}/storage/v1/object/kurikulum-files/${safe}`,{
    method:"POST",
    headers:{apikey:cfg.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`,"Content-Type":file.type||"application/octet-stream","x-upsert":"false"},
    body:file
  });
  const txt=await res.text();if(!res.ok)throw new Error(txt);
  return safe;
}
async function signedCurriculumUrl(path){
  const session=await api.auth.getSession(),cfg=window.SIMANIS_CONFIG;
  const res=await fetch(`${cfg.SUPABASE_URL.replace(/\/$/,"")}/storage/v1/object/sign/kurikulum-files/${path.split("/").map(encodeURIComponent).join("/")}`,{
    method:"POST",
    headers:{apikey:cfg.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},
    body:JSON.stringify({expiresIn:300})
  });
  const data=await res.json();if(!res.ok)throw new Error(data?.message||"Gagal membuat link file");
  return `${cfg.SUPABASE_URL.replace(/\/$/,"")}/storage/v1${data.signedURL}`;
}
async function openCurriculumFile(id){
  try{
    const d=teacherDocs.find(x=>x.id===id);if(!d?.file_path)throw new Error("File tidak ditemukan");
    const url=await signedCurriculumUrl(d.file_path);window.open(url,"_blank","noopener");
  }catch(err){alert("Gagal membuka file: "+err.message)}
}
function openDocumentVerification(id){
  const d=teacherDocs.find(x=>x.id===id);if(!d)return;
  openModal(`Verifikasi · ${d.curriculum_document_types?.name||""}`,"curr_verify",id);
  setFields(
    `<div class="full" style="padding:10px;background:#f7faf8;border-radius:10px;font-size:9px">Guru: <b>${esc(d.teachers?.full_name||"-")}</b><br>File: ${esc(d.original_filename||"-")}</div>`+
    sel("fStatus","Status",[["DIUNGGAH","DIUNGGAH"],["PERLU_REVISI","PERLU REVISI"],["TERVERIFIKASI","TERVERIFIKASI"]],d.status)+
    ta("fVerifyNote","Catatan Verifikasi",d.verification_note||"")
  );
}
function renderAcademicCalendar(){
  const ay=activeAcademicYearId();
  const list=calendarEvents.filter(e=>!ay||e.academic_year_id===ay);
  $("panelCalendar").innerHTML=`<article class="cardx">
    <div class="actions"><button class="primary-btn" id="addCalendarBtn">+ Agenda Akademik</button></div>
    <div class="calendar-list">${list.length?list.map(e=>`<div class="calendar-item"><div><b>${dateID(e.start_date)}${e.end_date&&e.end_date!==e.start_date?` — ${dateID(e.end_date)}`:""}</b></div><div><b>${e.is_important?"★ ":""}${esc(e.title)}</b><p>${esc(e.category)}${e.description?` · ${esc(e.description)}`:""}</p></div><button class="mini-btn" data-edit-calendar="${e.id}">Edit</button></div>`).join(""):'<div class="empty">Belum ada kalender akademik.</div>'}</div>
  </article>`;
  $("addCalendarBtn").onclick=()=>openCalendar();
  document.querySelectorAll("[data-edit-calendar]").forEach(b=>b.onclick=()=>openCalendar(b.dataset.editCalendar));
}
function openCalendar(id=""){
  const x=calendarEvents.find(e=>e.id===id)||{},sem=activeSemester();
  openModal(id?"Edit Kalender Akademik":"Tambah Kalender Akademik","curr_calendar",id);
  setFields(
    inp("fTitle","Kegiatan *","text",x.title,true)+
    sel("fCategory","Kategori",[["AKADEMIK","Akademik"],["ASESMEN","Asesmen"],["LIBUR","Libur"],["RAPAT","Rapat"],["SUPERVISI","Supervisi"],["KEGIATAN_SISWA","Kegiatan Siswa"],["PENERIMAAN_RAPOR","Penerimaan Rapor"],["LAINNYA","Lainnya"]],x.category||"AKADEMIK")+
    sel("fImportant","Prioritas",[["false","Normal"],["true","Penting"]],String(!!x.is_important))+
    inp("fStart","Mulai","date",x.start_date||today())+
    inp("fEnd","Selesai","date",x.end_date||x.start_date||today())+
    ta("fDesc","Deskripsi",x.description||"")
  );
}
function recapClass(pct){
  pct=Number(pct||0);return pct>=80?"recap-good":pct>=50?"recap-mid":"recap-low";
}
function renderTeacherRecap(){
  $("panelRecap").innerHTML=`<article class="cardx">
    <div class="actions"><button class="secondary-btn" id="exportRecapBtn">Export CSV</button></div>
    <div class="table-wrap"><table class="tablex"><thead><tr><th>Guru</th><th>Perangkat Wajib</th><th>Diunggah</th><th>Terverifikasi</th><th>Perlu Revisi</th><th>Kelengkapan</th><th>Supervisi</th><th>Nilai Terakhir</th></tr></thead><tbody>
    ${teacherRecap.length?teacherRecap.map(r=>`<tr><td><b>${esc(r.teacher_name)}</b><br>${esc(r.teacher_code||"")}</td><td>${r.required_documents}</td><td>${r.uploaded_documents}</td><td>${r.verified_documents}</td><td>${r.revision_documents}</td><td><span class="${recapClass(r.completion_percent)}">${r.completion_percent}%</span><div class="completeness"><span style="width:${Math.min(100,Number(r.completion_percent||0))}%"></span></div></td><td>${r.supervision_count}</td><td>${r.latest_supervision_score??"-"}</td></tr>`).join(""):'<tr><td colspan="8"><div class="empty">Belum ada data rekap.</div></td></tr>'}
    </tbody></table></div>
  </article>`;
  $("exportRecapBtn").onclick=exportTeacherRecap;
}
function exportTeacherRecap(){
  const rows=[["Kode Guru","Nama Guru","Perangkat Wajib","Diunggah","Terverifikasi","Perlu Revisi","Kelengkapan (%)","Jumlah Supervisi","Nilai Supervisi Terakhir"]];
  teacherRecap.forEach(r=>rows.push([r.teacher_code||"",r.teacher_name||"",r.required_documents,r.uploaded_documents,r.verified_documents,r.revision_documents,r.completion_percent,r.supervision_count,r.latest_supervision_score??""]));
  const csv=rows.map(row=>row.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\n");
  const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`rekap-kurikulum-${activeSemester()?.name||"semester"}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),500);
}

function renderAll(){renderStats();renderSummary();renderPrograms();renderLogs();renderSpecific();if(unitCode==="PKM_KURIKULUM"){renderDocuments();renderAcademicCalendar();renderTeacherRecap()}}

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
 if(unitCode==="PKM_KURIKULUM"){
   const scores=x.rubric_scores||{};
   setFields(
     sel("fTeacher","Guru *",teachers.map(t=>[t.id,`${t.teacher_code||"-"} · ${t.full_name}`]),x.teacher_id)+
     sel("fSemester","Semester *",semesters.map(s=>[s.id,`${s.name}${s.is_active?" · AKTIF":""}`]),x.semester_id||(semesters.find(s=>s.is_active)?.id||""))+
     inp("fDate","Tanggal","date",x.supervision_date||today())+
     sel("fType","Jenis",[["PERANGKAT_AJAR","Perangkat Ajar"],["PEMBELAJARAN","Pembelajaran"],["PENILAIAN","Penilaian"],["LAINNYA","Lainnya"]],x.supervision_type||"PEMBELAJARAN")+
     inp("fObserver","Observer","text",x.observer_name||profile.full_name||"")+
     sel("fStatus","Status",[["PLANNED","PLANNED"],["DONE","DONE"],["FOLLOW_UP","FOLLOW_UP"]],x.status||"PLANNED")+
     `<div class="full"><span style="display:block;font-size:9px;font-weight:800;margin-bottom:7px">Rubrik Supervisi</span><div class="rubric-grid">${rubricItems.map(r=>`<div><b style="font-size:8.5px">${esc(r.item_name)}</b><div style="font-size:7.5px;color:#718078">${esc(r.section)}</div></div><select class="rubric-score" data-rubric="${r.code}">${[0,1,2,3,4].map(n=>`<option value="${n}" ${Number(scores[r.code]??0)===n?"selected":""}>${n} / ${r.max_score}</option>`).join("")}</select>`).join("")}</div></div>`+
     ta("fStrength","Kekuatan",x.strengths)+
     ta("fNotes","Catatan",x.notes)+
     ta("fRecommendation","Rekomendasi",x.recommendation||"")+
     ta("fFollow","Tindak Lanjut",x.follow_up)
   );
 }
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
  if(mode==="curr_doc"){
    const sem=activeSemester();if(!sem)throw new Error("Semester aktif tidak ditemukan.");
    const teacherId=v("fTeacher"),docTypeId=v("fDocType"),type=docTypes.find(t=>t.id===docTypeId);
    if(!teacherId||!docTypeId)throw new Error("Guru dan jenis perangkat wajib dipilih.");
    const existing=teacherDocs.find(d=>d.id===id)||null;
    const file=$("fDocFile")?.files?.[0];
    if(!existing && !file)throw new Error("File perangkat ajar wajib dipilih.");
    if(file && file.size>15*1024*1024)throw new Error("Ukuran file maksimal 15 MB.");
    let filePath=existing?.file_path||null;
    if(file)filePath=await uploadCurriculumFile(file,teacherId,type?.code||"DOC");
    payload={
      teacher_id:teacherId,semester_id:sem.id,document_type_id:docTypeId,
      status:file?"DIUNGGAH":(existing?.status||"BELUM_UPLOAD"),
      file_path:filePath,
      original_filename:file?.name||existing?.original_filename||null,
      mime_type:file?.type||existing?.mime_type||null,
      file_size:file?.size||existing?.file_size||null,
      submitted_at:file?new Date().toISOString():(existing?.submitted_at||null),
      verification_note:v("fVerifyNote")||existing?.verification_note||null
    };
    table="curriculum_teacher_documents";
  }
  else if(mode==="curr_verify"){
    table="curriculum_teacher_documents";
    payload={
      status:v("fStatus"),
      verification_note:v("fVerifyNote")||null,
      verified_at:v("fStatus")==="TERVERIFIKASI"?new Date().toISOString():null,
      verified_by:v("fStatus")==="TERVERIFIKASI"?profile.id:null
    };
  }
  else if(mode==="curr_calendar"){
    table="academic_calendar_events";
    payload={
      academic_year_id:activeAcademicYearId(),
      semester_id:activeSemester()?.id||null,
      title:v("fTitle"),
      category:v("fCategory"),
      start_date:v("fStart"),
      end_date:v("fEnd"),
      description:v("fDesc")||null,
      is_important:v("fImportant")==="true"
    };
  }
  else if(mode==="asset_mutation"){
    await api.db.rpc("record_asset_mutation",{p_asset_id:id,p_to_location:v("fToLocation"),p_person_in_charge:v("fPIC")||null,p_note:v("fNote")||null,p_mutation_date:v("fDate")||today()});
    closeModal();await loadData();return;
  }
  else if(mode==="asset_maintenance"){
    table="asset_maintenance";payload={asset_id:id,maintenance_date:v("fDate")||today(),description:v("fDesc"),cost:Number(v("fCost")||0),vendor:v("fVendor")||null,status:v("fStatus"),next_maintenance_date:v("fNext")||null,note:v("fNote")||null};
  }
  else if(mode==="program"){table="unit_work_programs";payload={unit_code:unitCode,title:v("fTitle"),category:v("fCategory")||null,start_date:v("fStart")||null,end_date:v("fEnd")||null,person_in_charge:v("fPIC")||null,progress:Number(v("fProgress")||0),budget_plan:Number(v("fBudget")||0),status:v("fStatus"),note:v("fNote")||null}}
  else if(mode==="log"){table="unit_activity_logs";payload={unit_code:unitCode,activity_date:v("fDate")||today(),title:v("fTitle"),description:v("fDesc")||null,result:v("fResult")||null,follow_up:v("fFollow")||null,person_in_charge:v("fPIC")||null}}
  else if(mode==="booking"){table="lab_bookings";payload={lab_code:UNITS[unitCode].lab,usage_date:v("fDate"),start_time:v("fStart"),end_time:v("fEnd"),class_id:v("fClass")||null,teacher_id:v("fTeacher")||null,activity:v("fActivity"),person_in_charge:v("fPIC")||null,status:v("fStatus"),note:v("fNote")||null}}
  else if(unitCode==="PKM_KURIKULUM"){
    table="curriculum_supervisions";
    const scores={};document.querySelectorAll(".rubric-score").forEach(el=>scores[el.dataset.rubric]=Number(el.value||0));
    const max=rubricItems.reduce((a,r)=>a+Number(r.max_score||4),0);
    const got=Object.values(scores).reduce((a,n)=>a+Number(n||0),0);
    const score=max>0?Math.round((got/max)*10000)/100:null;
    payload={teacher_id:v("fTeacher"),semester_id:v("fSemester")||null,supervision_date:v("fDate"),supervision_type:v("fType"),score,status:v("fStatus"),strengths:v("fStrength")||null,notes:v("fNotes")||null,follow_up:v("fFollow")||null,observer_name:v("fObserver")||null,recommendation:v("fRecommendation")||null,rubric_scores:scores};
  }
  else if(unitCode==="PKM_KESISWAAN"){table="student_guidance_cases";payload={student_id:v("fStudent"),case_date:v("fDate"),category:v("fCategory"),title:v("fTitle"),description:v("fDesc")||null,points:Number(v("fPoints")||0),action_taken:v("fAction")||null,follow_up:v("fFollow")||null,status:v("fStatus"),handled_by:v("fHandler")||null}}
  else if(unitCode==="PKM_BENDAHARA_SARPRAS"){table="school_assets";payload={asset_code:v("fCode")||null,asset_name:v("fName"),category:v("fCategory")||null,location:v("fLocation")||null,acquisition_date:v("fDate")||null,acquisition_value:Number(v("fValue")||0),quantity:Number(v("fQty")||0),unit:v("fUnit")||"UNIT",condition:v("fCondition"),status:v("fStatus"),responsible_person:v("fPIC")||null,note:v("fNote")||null}}
  else if(unitCode==="PKM_HUMASY"){table="humas_publication_plans";payload={publish_date:v("fDate"),channel:v("fChannel"),title:v("fTitle"),content_type:v("fType")||null,status:v("fStatus"),person_in_charge:v("fPIC")||null,published_link:v("fLink")||null,note:v("fNote")||null}}
  else if(unitCode==="KEPALA_TU"){table="office_letters";payload={letter_type:v("fLetterType"),letter_number:v("fNumber")||null,letter_date:v("fLetterDate"),administration_date:v("fAdminDate"),sender_recipient:v("fSender"),subject:v("fSubject"),classification:v("fClass")||null,disposition:v("fDisposition")||null,status:v("fStatus"),note:v("fNote")||null}}
  else {table="lab_inventory";payload={lab_code:UNITS[unitCode].lab,item_code:v("fCode")||null,item_name:v("fName"),category:v("fCategory")||null,quantity:Number(v("fQty")||0),unit:v("fUnit")||"UNIT",condition:v("fCondition"),location:v("fLocation")||null,minimum_stock:Number(v("fMin")||0),note:v("fNote")||null}}
  if(mode==="asset_maintenance" && !payload.description)throw new Error("Deskripsi pemeliharaan wajib diisi.");
  if(!["asset_maintenance","curr_doc","curr_verify","curr_calendar"].includes(mode) && !payload.title&&!payload.asset_name&&!payload.item_name&&!payload.activity&&!payload.subject&&!payload.teacher_id&&!payload.student_id)throw new Error("Data utama wajib diisi.");
  if(mode==="curr_calendar" && !payload.title)throw new Error("Nama kegiatan wajib diisi.");
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