const $=id=>document.getElementById(id);
let api,profile,myModules=[],programs=[],logs=[],specific=[],teachers=[],students=[],classes=[],semesters=[],assets=[],assetMutations=[],assetMaintenance=[],docTypes=[],teacherDocs=[],calendarEvents=[],teacherRecap=[],rubricItems=[],summons=[],activityGroups=[],activityMembers=[],studentAffairsRecap={summary:{},class_recap:[],student_recap:[]},humasDocs=[],humasSocial=[],humasNews=[],humasRecap={summary:{},months:[],channels:[]},letterClasses=[],tuDispositions=[],tuFiles=[],tuRecap={summary:{},months:[],classifications:[]};
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
function xDateSafe(v){return /^\d{4}-\d{2}-\d{2}$/.test(String(v||""))}

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
 if(unitCode==="PKM_KESISWAAN"){
   const activeSemester=semesters.find(s=>s.is_active)||semesters[0];
   const extra=await Promise.all([
     api.db.select("student_summons","select=*,students(full_name,nisn),student_guidance_cases(case_code,title)&order=summon_date.desc,created_at.desc"),
     api.db.select("student_activity_groups","select=*,teachers(full_name)&is_active=eq.true&order=group_type.asc,name.asc"),
     api.db.select("student_activity_members","select=*,students(full_name,nisn),student_activity_groups(name,group_type)&is_active=eq.true&order=created_at.desc"),
     activeSemester?api.db.rpc("student_affairs_get_recap",{p_semester_id:activeSemester.id}):Promise.resolve({summary:{},class_recap:[],student_recap:[]})
   ]);
   summons=extra[0]||[];activityGroups=extra[1]||[];activityMembers=extra[2]||[];studentAffairsRecap=extra[3]||{summary:{},class_recap:[],student_recap:[]};
 }
 if(unitCode==="PKM_HUMASY"){
   const year=new Date().getFullYear();
   const extra=await Promise.all([
     api.db.select("humas_documentations","select=*&order=activity_date.desc,created_at.desc"),
     api.db.select("humas_social_accounts","select=*&is_active=eq.true&order=platform.asc,account_name.asc"),
     api.db.select("news_articles","select=id,title,slug,excerpt,category,status,published_at,created_at&order=published_at.desc.nullslast,created_at.desc&limit=20"),
     api.db.rpc("humas_get_monthly_recap",{p_year:year})
   ]);
   humasDocs=extra[0]||[];humasSocial=extra[1]||[];humasNews=extra[2]||[];humasRecap=extra[3]||{summary:{},months:[],channels:[]};
 }
 if(unitCode==="KEPALA_TU"){
   const year=new Date().getFullYear();
   const extra=await Promise.all([
     api.db.select("office_letter_classifications","select=*&is_active=eq.true&order=sort_order.asc").catch(err=>{
       console.warn("Klasifikasi surat belum tersedia:",err); return [];
     }),
     api.db.select("office_letter_dispositions","select=*,office_letters(agenda_code,letter_number,subject,letter_type,sender_recipient)&order=disposition_date.desc,created_at.desc").catch(err=>{
       console.warn("Disposisi surat belum tersedia:",err); return [];
     }),
     api.db.select("office_letter_files","select=*,office_letters(agenda_code,letter_number,subject,letter_type)&order=created_at.desc").catch(err=>{
       console.warn("Arsip surat belum tersedia:",err); return [];
     }),
     api.db.rpc("office_get_monthly_recap",{p_year:year}).catch(err=>{
       console.warn("Rekap TU belum tersedia:",err);
       return {summary:{incoming:0,outgoing:0,active:0,done:0,disposition_open:0},months:[],classifications:[]};
     })
   ]);
   letterClasses=extra[0]||[];tuDispositions=extra[1]||[];tuFiles=extra[2]||[];tuRecap=extra[3]||{summary:{},months:[],classifications:[]};
 }
 renderAll();
}
function setTab(name){
 document.querySelectorAll(".tabbtn").forEach(b=>b.classList.toggle("active",b.dataset.tab===name));
 ["Summary","Programs","Logs","Specific","Documents","Calendar","Recap","Summons","Activities","Studentrecap","Contentcalendar","Documentation","Socialmedia","Humasnews","Humasrecap","Letteragenda","Dispositions","Letterarchive","Turecap"].forEach(x=>$("panel"+x).classList.toggle("hidden",x.toLowerCase()!==name));
}
function renderTabs(){
 const u=UNITS[unitCode];
 const base=[["summary","Ringkasan"],["programs","Program Kerja"],["logs","Log Aktivitas"],["specific",u.specificTab]];
 if(unitCode==="PKM_KURIKULUM"){
   base.push(["documents","Perangkat Ajar"],["calendar","Kalender Akademik"],["recap","Rekap Guru"]);
 }
 if(unitCode==="PKM_KESISWAAN"){
   base.push(["summons","Surat Panggilan"],["activities","Organisasi & Ekskul"],["studentrecap","Rekap Siswa"]);
 }
 if(unitCode==="PKM_HUMASY"){
   base.push(["contentcalendar","Kalender Konten"],["documentation","Dokumentasi"],["socialmedia","Media Sosial"],["humasnews","Berita"],["humasrecap","Rekap Bulanan"]);
 }
 if(unitCode==="KEPALA_TU"){
   base.push(["letteragenda","Agenda Surat"],["dispositions","Disposisi"],["letterarchive","Arsip Digital"],["turecap","Rekap Surat"]);
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
 else if(unitCode==="PKM_KESISWAAN")body=`<article class="cardx">
 <div class="kesiswaan-toolbar">
   <label><span>Cari</span><input id="caseSearch" type="search" placeholder="Nama siswa / kode / catatan..."></label>
   <label><span>Kategori</span><select id="caseCategoryFilter"><option value="">Semua</option><option>PELANGGARAN</option><option>PEMBINAAN</option><option>KONSELING</option><option>PENGHARGAAN</option><option>LAINNYA</option></select></label>
   <label><span>Status</span><select id="caseStatusFilter"><option value="">Semua</option><option>OPEN</option><option>PROCESS</option><option>CLOSED</option></select></label>
   <button class="primary-btn" id="addSpecificBtn" style="width:auto">+ Catatan Siswa</button>
 </div>
 <div id="caseTableWrap"></div>
 </article>`;
 else if(unitCode==="PKM_BENDAHARA_SARPRAS")body=`<article class="cardx">
 <div class="asset-toolbar">
   <label><span>Cari Aset</span><input id="assetSearch" type="search" placeholder="Kode / nama / lokasi..."></label>
   <label><span>Kondisi</span><select id="assetConditionFilter"><option value="">Semua Kondisi</option><option>BAIK</option><option>RUSAK_RINGAN</option><option>RUSAK_BERAT</option><option>HILANG</option></select></label>
   <label><span>Lokasi</span><select id="assetLocationFilter"><option value="">Semua Lokasi</option>${[...new Set(specific.map(a=>a.location).filter(Boolean))].sort().map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("")}</select></label>
   <div class="actions" style="margin:0"><button class="secondary-btn" id="printAllQrBtn">Cetak QR</button><button class="primary-btn" id="addSpecificBtn">+ Aset</button></div>
 </div>
 <div id="assetTableWrap"></div>
 </article>`;
 else if(unitCode==="PKM_HUMASY")body=`<article class="cardx">
 <div class="humas-toolbar">
  <label><span>Cari</span><input id="humasSearch" type="search" placeholder="Judul / campaign / PIC..."></label>
  <label><span>Channel</span><select id="humasChannelFilter"><option value="">Semua Channel</option><option>WEBSITE</option><option>INSTAGRAM</option><option>FACEBOOK</option><option>YOUTUBE</option><option>WHATSAPP</option><option>LAINNYA</option></select></label>
  <label><span>Status</span><select id="humasStatusFilter"><option value="">Semua Status</option><option>IDEA</option><option>DRAFT</option><option>READY</option><option>PUBLISHED</option><option>CANCELLED</option></select></label>
  <button class="primary-btn" id="addSpecificBtn" style="width:auto">+ Rencana Publikasi</button>
 </div>
 <div id="humasPlanTable"></div>
 </article>`;
 else if(unitCode==="KEPALA_TU")body=`<article class="cardx">
 <div class="tu-toolbar">
  <label><span>Cari</span><input id="tuSearch" type="search" placeholder="Agenda / nomor / perihal / asal tujuan..."></label>
  <label><span>Jenis</span><select id="tuTypeFilter"><option value="">Semua Jenis</option><option value="INCOMING">Surat Masuk</option><option value="OUTGOING">Surat Keluar</option></select></label>
  <label><span>Status</span><select id="tuStatusFilter"><option value="">Semua Status</option><option>RECORDED</option><option>PROCESS</option><option>DONE</option><option>ARCHIVED</option></select></label>
  <label><span>Klasifikasi</span><select id="tuClassFilter"><option value="">Semua</option>${letterClasses.map(c=>`<option value="${esc(c.code)}">${esc(c.name)}</option>`).join("")}</select></label>
  <button class="primary-btn" id="addSpecificBtn" style="width:auto">+ Surat</button>
 </div>
 <div id="tuLetterTable"></div>
 </article>`;
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
 if(unitCode==="PKM_KESISWAAN"){
   renderCaseTable();
   $("caseSearch").oninput=renderCaseTable;
   $("caseCategoryFilter").onchange=renderCaseTable;
   $("caseStatusFilter").onchange=renderCaseTable;
 }
 if(unitCode==="PKM_HUMASY"){
   renderHumasPlanTable();
   $("humasSearch").oninput=renderHumasPlanTable;
   $("humasChannelFilter").onchange=renderHumasPlanTable;
   $("humasStatusFilter").onchange=renderHumasPlanTable;
 }
 if(unitCode==="KEPALA_TU"){
   renderTuLetterTable();
   $("tuSearch").oninput=renderTuLetterTable;
   $("tuTypeFilter").onchange=renderTuLetterTable;
   $("tuStatusFilter").onchange=renderTuLetterTable;
   $("tuClassFilter").onchange=renderTuLetterTable;
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





function filteredTuLetters(){
  const q=$("tuSearch")?.value?.trim().toLowerCase()||"";
  const type=$("tuTypeFilter")?.value||"";
  const st=$("tuStatusFilter")?.value||"";
  const cls=$("tuClassFilter")?.value||"";
  return specific.filter(x=>{
    const hay=`${x.agenda_code||""} ${x.letter_number||""} ${x.subject||""} ${x.sender_recipient||""} ${x.classification||""}`.toLowerCase();
    return(!q||hay.includes(q))&&(!type||x.letter_type===type)&&(!st||x.status===st)&&(!cls||x.classification===cls);
  });
}
function renderTuLetterTable(){
  const holder=$("tuLetterTable");if(!holder)return;
  const data=filteredTuLetters();
  holder.innerHTML=`<div class="table-wrap"><table class="tablex"><thead><tr><th>Agenda</th><th>Jenis</th><th>No. Surat</th><th>Tanggal</th><th>Asal/Tujuan</th><th>Perihal</th><th>Klasifikasi</th><th>Prioritas</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${data.length?data.map(x=>`<tr>
   <td><b>${esc(x.agenda_code||"-")}</b></td>
   <td>${esc(x.letter_type==="INCOMING"?"MASUK":"KELUAR")}</td>
   <td>${esc(x.letter_number||"-")}</td>
   <td>${dateID(x.letter_date)}</td>
   <td>${esc(x.sender_recipient)}</td>
   <td><b>${esc(x.subject)}</b></td>
   <td>${esc(x.classification||"-")}</td>
   <td>${badge(x.priority||"BIASA")}</td>
   <td>${badge(x.status)}</td>
   <td><button class="mini-btn" data-tu-detail="${x.id}">Detail</button> <button class="mini-btn" data-edit-specific="${x.id}">Edit</button></td>
  </tr>`).join(""):'<tr><td colspan="10"><div class="empty">Surat tidak ditemukan.</div></td></tr>'}</tbody></table></div>`;
  holder.querySelectorAll("[data-tu-detail]").forEach(b=>b.onclick=()=>openTuLetterDetail(b.dataset.tuDetail));
  holder.querySelectorAll("[data-edit-specific]").forEach(b=>b.onclick=()=>openSpecific(b.dataset.editSpecific));
}
async function uploadTuLetterFile(file,letterId){
  const session=await api.auth.getSession(),cfg=window.SIMANIS_CONFIG;
  if(file.size>15*1024*1024)throw new Error("Ukuran file maksimal 15 MB.");
  const ext=(file.name.split(".").pop()||"bin").replace(/[^a-z0-9]/gi,"").toLowerCase();
  const path=`${letterId}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
  const res=await fetch(`${cfg.SUPABASE_URL.replace(/\/$/,"")}/storage/v1/object/tu-surat/${path}`,{
    method:"POST",
    headers:{apikey:cfg.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`,"Content-Type":file.type||"application/octet-stream","x-upsert":"false"},
    body:file
  });
  const txt=await res.text();if(!res.ok)throw new Error(txt);return path;
}
async function signedTuFileUrl(path){
  const session=await api.auth.getSession(),cfg=window.SIMANIS_CONFIG;
  const res=await fetch(`${cfg.SUPABASE_URL.replace(/\/$/,"")}/storage/v1/object/sign/tu-surat/${path.split("/").map(encodeURIComponent).join("/")}`,{
    method:"POST",
    headers:{apikey:cfg.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},
    body:JSON.stringify({expiresIn:300})
  });
  const data=await res.json();if(!res.ok)throw new Error(data?.message||"Gagal membuat link file");
  return `${cfg.SUPABASE_URL.replace(/\/$/,"")}/storage/v1${data.signedURL}`;
}
async function openTuLetterDetail(id){
  try{
    let h=null;
    try{h=await api.db.rpc("office_get_letter_detail",{p_letter_id:id})}
    catch(err){console.warn("Detail RPC TU belum tersedia:",err)}
    const l=h?.letter||specific.find(x=>x.id===id);if(!l)throw new Error("Surat tidak ditemukan");
    let dispositions=h?.dispositions||[],files=h?.files||[];
    if(!h){
      try{dispositions=await api.db.select("office_letter_dispositions",`select=*&letter_id=eq.${encodeURIComponent(id)}&order=disposition_date.desc,created_at.desc`)}catch(_){}
      try{files=await api.db.select("office_letter_files",`select=*&letter_id=eq.${encodeURIComponent(id)}&order=is_primary.desc,created_at.desc`)}catch(_){}
    }
    openModal(`Detail Surat · ${l.agenda_code||""}`,"tu_detail",id);
    setFields(`<div class="full tu-detail-grid">
      <div>
        <div class="tu-info">
          <div><span>Agenda</span><b>${esc(l.agenda_code||"-")}</b></div>
          <div><span>Jenis</span><b>${l.letter_type==="INCOMING"?"Surat Masuk":"Surat Keluar"}</b></div>
          <div><span>Nomor</span><b>${esc(l.letter_number||"-")}</b></div>
          <div><span>Tanggal</span><b>${dateID(l.letter_date)}</b></div>
          <div><span>Asal/Tujuan</span><b>${esc(l.sender_recipient||"-")}</b></div>
          <div><span>Klasifikasi</span><b>${esc(l.classification||"-")}</b></div>
          <div><span>Prioritas</span><b>${esc(l.priority||"BIASA")}</b></div>
          <div><span>Status</span><b>${esc(l.status)}</b></div>
        </div>
        <div style="margin-top:10px;font-size:9px;line-height:1.6"><b>${esc(l.subject)}</b><br>${esc(l.note||"")}</div>
        <div class="actions" style="justify-content:flex-start">
          <button type="button" class="secondary-btn" id="tuAddDispoBtn">+ Disposisi</button>
          <button type="button" class="secondary-btn" id="tuUploadBtn">+ Arsip File</button>
          <button type="button" class="secondary-btn" id="tuPrintDispoBtn">Cetak Lembar Disposisi</button>
          <button type="button" class="secondary-btn" id="tuEditBtn">Edit Surat</button>
        </div>
      </div>
      <div>
        <h4 style="font-size:10px;margin:0 0 7px">Riwayat Disposisi</h4>
        <div class="dispo-list">${dispositions.length?dispositions.map(d=>`<div class="dispo-row"><b>${dateID(d.disposition_date)} · ${esc(d.to_name)}</b><p>${esc(d.instruction)}</p><p>Status: ${esc(d.status)}${d.due_date?` · Batas ${dateID(d.due_date)}`:""}</p>${d.result?`<p>Hasil: ${esc(d.result)}</p>`:""}</div>`).join(""):'<div class="empty">Belum ada disposisi.</div>'}</div>
        <h4 style="font-size:10px;margin:10px 0 7px">Arsip Digital</h4>
        <div class="file-list-tu">${files.length?files.map(f=>`<div class="file-row-tu"><div><b>${esc(f.document_label||f.original_filename||"Dokumen")}</b><p>${esc(f.original_filename||"-")}</p></div><button type="button" class="mini-btn" data-tu-open-file="${f.id}">Buka</button></div>`).join(""):'<div class="empty">Belum ada file.</div>'}</div>
      </div>
    </div>`);
    const saveBtn=$("entryForm").querySelector('button[type="submit"]');if(saveBtn)saveBtn.style.display="none";
    $("tuAddDispoBtn").onclick=()=>openTuDisposition("",id);
    $("tuUploadBtn").onclick=()=>openTuFileUpload(id);
    $("tuPrintDispoBtn").onclick=()=>printDispositionSheet(l,dispositions);
    $("tuEditBtn").onclick=()=>openSpecific(id);
    document.querySelectorAll("[data-tu-open-file]").forEach(b=>b.onclick=async()=>{const f=files.find(x=>x.id===b.dataset.tuOpenFile);if(!f)return;const url=await signedTuFileUrl(f.file_path);window.open(url,"_blank","noopener")});
  }catch(err){alert("Gagal membuka detail surat: "+err.message)}
}
function openTuDisposition(id="",letterId=""){
  const d=tuDispositions.find(x=>x.id===id)||{};
  openModal(id?"Edit Disposisi":"Tambah Disposisi","tu_disposition",id);
  setFields(
    `<input id="fLetterId" type="hidden" value="${esc(letterId||d.letter_id||"")}">`+
    inp("fDate","Tanggal Disposisi","date",d.disposition_date||today())+
    inp("fFrom","Dari","text",d.from_name||"Kepala Madrasah")+
    inp("fTo","Tujuan Disposisi *","text",d.to_name||"")+
    inp("fDue","Batas Waktu","date",d.due_date||"")+
    sel("fStatus","Status",[["OPEN","OPEN"],["PROCESS","PROCESS"],["DONE","DONE"],["CANCELLED","CANCELLED"]],d.status||"OPEN")+
    ta("fInstruction","Instruksi *",d.instruction||"")+
    ta("fResult","Hasil",d.result||"")
  );
}
function openTuFileUpload(letterId){
  openModal("Tambah Arsip Digital","tu_file","");
  setFields(
    `<input id="fLetterId" type="hidden" value="${esc(letterId)}">`+
    inp("fLabel","Label Dokumen","text","Surat / Lampiran")+
    sel("fPrimary","Dokumen Utama?",[["false","Tidak"],["true","Ya"]],"false")+
    `<label class="full"><span>File *</span><input id="fTuFile" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"></label>`+
    `<div class="full" style="font-size:8px;color:#718078">PDF/JPG/PNG/WEBP/DOC/DOCX maksimal 15 MB.</div>`
  );
}
function renderLetterAgenda(){
  const data=[...specific].sort((a,b)=>String(b.administration_date||"").localeCompare(String(a.administration_date||"")));
  $("panelLetteragenda").innerHTML=`<article class="cardx"><div class="actions"><button class="secondary-btn" id="exportAgendaBtn">Export CSV</button></div><div class="table-wrap"><table class="tablex"><thead><tr><th>Agenda</th><th>Jenis</th><th>Tgl Agenda</th><th>Tgl Surat</th><th>Nomor</th><th>Asal/Tujuan</th><th>Perihal</th><th>Klasifikasi</th><th>Status</th></tr></thead><tbody>${data.length?data.map(l=>`<tr><td><b>${esc(l.agenda_code||"-")}</b></td><td>${l.letter_type==="INCOMING"?"MASUK":"KELUAR"}</td><td>${dateID(l.administration_date)}</td><td>${dateID(l.letter_date)}</td><td>${esc(l.letter_number||"-")}</td><td>${esc(l.sender_recipient)}</td><td>${esc(l.subject)}</td><td>${esc(l.classification||"-")}</td><td>${badge(l.status)}</td></tr>`).join(""):'<tr><td colspan="9"><div class="empty">Belum ada agenda surat.</div></td></tr>'}</tbody></table></div></article>`;
  $("exportAgendaBtn").onclick=exportTuAgenda;
}
function exportTuAgenda(){
  const rows=[["Agenda","Jenis","Tanggal Agenda","Tanggal Surat","Nomor Surat","Asal/Tujuan","Perihal","Klasifikasi","Prioritas","Status"]];
  specific.forEach(l=>rows.push([l.agenda_code||"",l.letter_type==="INCOMING"?"MASUK":"KELUAR",l.administration_date||"",l.letter_date||"",l.letter_number||"",l.sender_recipient||"",l.subject||"",l.classification||"",l.priority||"",l.status||""]));
  const csv=rows.map(r=>r.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\n");
  const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`agenda-surat-${new Date().getFullYear()}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),500);
}
function renderTuDispositions(){
  $("panelDispositions").innerHTML=`<article class="cardx"><div class="actions"><button class="primary-btn" id="addStandaloneDispoBtn">+ Disposisi</button></div><div class="table-wrap"><table class="tablex"><thead><tr><th>Tanggal</th><th>Surat</th><th>Dari</th><th>Tujuan</th><th>Instruksi</th><th>Batas</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${tuDispositions.length?tuDispositions.map(d=>`<tr><td>${dateID(d.disposition_date)}</td><td><b>${esc(d.office_letters?.agenda_code||"-")}</b><br>${esc(d.office_letters?.subject||"-")}</td><td>${esc(d.from_name||"-")}</td><td>${esc(d.to_name)}</td><td>${esc(d.instruction)}</td><td>${dateID(d.due_date)}</td><td>${badge(d.status)}</td><td><button class="mini-btn" data-edit-dispo="${d.id}">Edit</button></td></tr>`).join(""):'<tr><td colspan="8"><div class="empty">Belum ada disposisi.</div></td></tr>'}</tbody></table></div></article>`;
  $("addStandaloneDispoBtn").onclick=()=>{
    if(!specific.length){alert("Belum ada surat.");return}
    openModal("Pilih Surat untuk Disposisi","tu_pick_disposition","");
    setFields(sel("fPickLetter","Surat",specific.filter(l=>l.letter_type==="INCOMING").map(l=>[l.id,`${l.agenda_code||"-"} · ${l.subject}`]),"",true));
  };
  document.querySelectorAll("[data-edit-dispo]").forEach(b=>b.onclick=()=>openTuDisposition(b.dataset.editDispo));
}
function renderTuArchive(){
  $("panelLetterarchive").innerHTML=`<article class="cardx"><div class="file-list-tu">${tuFiles.length?tuFiles.map(f=>`<div class="file-row-tu"><div><b>${esc(f.office_letters?.agenda_code||"-")} · ${esc(f.document_label||f.original_filename||"Dokumen")}</b><p>${esc(f.office_letters?.subject||"-")} · ${esc(f.original_filename||"-")}</p></div><button class="mini-btn" data-archive-open="${f.id}">Buka</button></div>`).join(""):'<div class="empty">Belum ada arsip digital.</div>'}</div></article>`;
  document.querySelectorAll("[data-archive-open]").forEach(b=>b.onclick=async()=>{try{const f=tuFiles.find(x=>x.id===b.dataset.archiveOpen);const url=await signedTuFileUrl(f.file_path);window.open(url,"_blank","noopener")}catch(err){alert("Gagal membuka arsip: "+err.message)}});
}
function renderTuRecap(){
  const s=tuRecap.summary||{},months=tuRecap.months||[],names=["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"],max=Math.max(1,...months.flatMap(m=>[Number(m.incoming||0),Number(m.outgoing||0)]));
  $("panelTurecap").innerHTML=`<article class="cardx">
   <div class="tu-recap-cards">
    <div class="tu-recap-card"><span>Surat Masuk</span><b>${Number(s.incoming||0)}</b></div>
    <div class="tu-recap-card"><span>Surat Keluar</span><b>${Number(s.outgoing||0)}</b></div>
    <div class="tu-recap-card"><span>Aktif/Proses</span><b>${Number(s.active||0)}</b></div>
    <div class="tu-recap-card"><span>Selesai</span><b>${Number(s.done||0)}</b></div>
    <div class="tu-recap-card"><span>Disposisi Terbuka</span><b>${Number(s.disposition_open||0)}</b></div>
   </div>
   <div class="grid2">
    <div><h3>Surat per Bulan</h3><div class="tu-month-bars">${months.map(m=>`<div class="tu-month-col"><div class="tu-month-pair"><div class="tu-bar" style="height:${Math.max(2,Math.round(Number(m.incoming||0)/max*100))}%"></div><div class="tu-bar out" style="height:${Math.max(2,Math.round(Number(m.outgoing||0)/max*100))}%"></div></div><b>${names[m.month_no-1]}</b><small>${m.incoming}/${m.outgoing}</small></div>`).join("")}</div></div>
    <div><h3>Klasifikasi</h3><div class="table-wrap"><table class="tablex" style="min-width:0"><thead><tr><th>Klasifikasi</th><th>Jumlah</th></tr></thead><tbody>${(tuRecap.classifications||[]).map(c=>`<tr><td>${esc(c.classification)}</td><td>${c.count}</td></tr>`).join("")||'<tr><td colspan="2">Belum ada data.</td></tr>'}</tbody></table></div></div>
   </div>
  </article>`;
}
async function printDispositionSheet(letter,dispositions){
  const brand=await api.db.rpc("get_public_system_settings",{})||{};
  $("dispositionPrint").innerHTML=`<div class="kop"><h1>${esc(brand.school_name||"MA Nurul Islam")}</h1><p>${esc([brand.address,brand.district,brand.regency].filter(Boolean).join(", "))}</p></div><h2>LEMBAR DISPOSISI</h2><table><tr><th>Agenda</th><td>${esc(letter.agenda_code||"-")}</td><th>Tanggal Diterima</th><td>${dateID(letter.received_date||letter.administration_date)}</td></tr><tr><th>Nomor Surat</th><td>${esc(letter.letter_number||"-")}</td><th>Tanggal Surat</th><td>${dateID(letter.letter_date)}</td></tr><tr><th>Asal Surat</th><td colspan="3">${esc(letter.sender_recipient||"-")}</td></tr><tr><th>Perihal</th><td colspan="3">${esc(letter.subject||"-")}</td></tr><tr><th>Sifat</th><td>${esc(letter.confidentiality||"BIASA")}</td><th>Prioritas</th><td>${esc(letter.priority||"BIASA")}</td></tr></table><h2 style="text-align:left">Riwayat Disposisi</h2><table><thead><tr><th>Tanggal</th><th>Tujuan</th><th>Instruksi</th><th>Status</th></tr></thead><tbody>${dispositions.length?dispositions.map(d=>`<tr><td>${dateID(d.disposition_date)}</td><td>${esc(d.to_name)}</td><td>${esc(d.instruction)}</td><td>${esc(d.status)}</td></tr>`).join(""):'<tr><td colspan="4">Belum ada disposisi.</td></tr>'}</tbody></table><div class="sign"><p>${esc(brand.regency||"")}, ${dateID(today())}<br>Kepala Madrasah</p><div class="space"></div><b>${esc(brand.headmaster_name||"________________")}</b></div>`;
  document.body.classList.add("print-disposition");setTimeout(()=>{window.print();setTimeout(()=>document.body.classList.remove("print-disposition"),300)},100);
}

function filteredHumasPlans(){
  const q=$("humasSearch")?.value?.trim().toLowerCase()||"";
  const channel=$("humasChannelFilter")?.value||"";
  const st=$("humasStatusFilter")?.value||"";
  return specific.filter(x=>{
    const hay=`${x.title||""} ${x.campaign_name||""} ${x.person_in_charge||""} ${x.content_type||""}`.toLowerCase();
    return(!q||hay.includes(q))&&(!channel||x.channel===channel)&&(!st||x.status===st);
  });
}
function renderHumasPlanTable(){
  const holder=$("humasPlanTable");if(!holder)return;
  const data=filteredHumasPlans();
  holder.innerHTML=`<div class="table-wrap"><table class="tablex"><thead><tr><th>Tanggal</th><th>Channel</th><th>Konten</th><th>Campaign</th><th>PIC</th><th>Status</th><th>Reach</th><th>Engagement</th><th>Aksi</th></tr></thead><tbody>${data.length?data.map(x=>`<tr>
   <td>${dateID(x.publish_date)}${x.planned_time?`<br>${String(x.planned_time).slice(0,5)}`:""}</td>
   <td>${esc(x.channel)}</td>
   <td><b>${esc(x.title)}</b><br><span style="color:#73817a">${esc(x.content_type||"-")}</span></td>
   <td>${esc(x.campaign_name||"-")}</td>
   <td>${esc(x.person_in_charge||"-")}</td>
   <td>${badge(x.status)}</td>
   <td>${Number(x.reach_count||0).toLocaleString("id-ID")}</td>
   <td>${Number(x.engagement_count||0).toLocaleString("id-ID")}</td>
   <td><button class="mini-btn" data-edit-specific="${x.id}">Edit</button>${x.published_link?` <button class="mini-btn" data-open-pub="${x.id}">Buka</button>`:""}</td>
  </tr>`).join(""):'<tr><td colspan="9"><div class="empty">Rencana publikasi tidak ditemukan.</div></td></tr>'}</tbody></table></div>`;
  holder.querySelectorAll("[data-edit-specific]").forEach(b=>b.onclick=()=>openSpecific(b.dataset.editSpecific));
  holder.querySelectorAll("[data-open-pub]").forEach(b=>b.onclick=()=>{const x=specific.find(v=>v.id===b.dataset.openPub);if(x?.published_link)window.open(x.published_link,"_blank","noopener")});
}
function monthStartDate(year,month){return new Date(year,month-1,1)}
function renderContentCalendar(){
  const now=new Date(),year=now.getFullYear(),month=now.getMonth()+1;
  const first=new Date(year,month-1,1),last=new Date(year,month,0),days=[];
  for(let d=1;d<=last.getDate();d++)days.push(new Date(year,month-1,d));
  const monthPlans=specific.filter(x=>{const dt=new Date(x.publish_date+"T00:00:00");return dt.getFullYear()===year&&dt.getMonth()+1===month});
  $("panelContentcalendar").innerHTML=`<article class="cardx"><div class="dash-title"><h3>Kalender Konten · ${new Intl.DateTimeFormat("id-ID",{month:"long",year:"numeric"}).format(first)}</h3><span>${monthPlans.length} rencana</span></div><div class="humas-calendar">${days.map(d=>{
    const ds=d.toISOString().slice(0,10),ev=monthPlans.filter(x=>x.publish_date===ds);
    return`<div class="humas-day ${ds===today()?"today":""}"><div class="humas-day-head">${d.getDate()}</div>${ev.map(x=>`<span class="humas-event ${String(x.status||"").toLowerCase()}" data-calendar-plan="${x.id}"><b>${esc(x.channel)}</b><br>${esc(x.title)}</span>`).join("")}</div>`
  }).join("")}</div></article>`;
  document.querySelectorAll("[data-calendar-plan]").forEach(el=>el.onclick=()=>openSpecific(el.dataset.calendarPlan));
}
async function uploadHumasMedia(file){
  const session=await api.auth.getSession(),cfg=window.SIMANIS_CONFIG;
  if(file.size>25*1024*1024)throw new Error("Ukuran file maksimal 25 MB.");
  const ext=(file.name.split(".").pop()||"bin").replace(/[^a-z0-9]/gi,"").toLowerCase();
  const path=`${new Date().getFullYear()}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
  const res=await fetch(`${cfg.SUPABASE_URL.replace(/\/$/,"")}/storage/v1/object/humas-media/${path}`,{
    method:"POST",
    headers:{apikey:cfg.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`,"Content-Type":file.type||"application/octet-stream","x-upsert":"false"},
    body:file
  });
  const txt=await res.text();if(!res.ok)throw new Error(txt);return path;
}
async function signedHumasMediaUrl(path){
  const session=await api.auth.getSession(),cfg=window.SIMANIS_CONFIG;
  const res=await fetch(`${cfg.SUPABASE_URL.replace(/\/$/,"")}/storage/v1/object/sign/humas-media/${path.split("/").map(encodeURIComponent).join("/")}`,{
    method:"POST",
    headers:{apikey:cfg.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},
    body:JSON.stringify({expiresIn:300})
  });
  const data=await res.json();if(!res.ok)throw new Error(data?.message||"Gagal membuat link media");
  return `${cfg.SUPABASE_URL.replace(/\/$/,"")}/storage/v1${data.signedURL}`;
}
function renderDocumentation(){
  $("panelDocumentation").innerHTML=`<article class="cardx"><div class="actions"><button class="primary-btn" id="addDocHumasBtn">+ Dokumentasi</button></div><div class="media-grid">${humasDocs.length?humasDocs.map(d=>`<article class="media-card"><div class="media-preview" id="media-${d.id}">${d.file_path?"MEDIA":"TANPA FILE"}</div><div class="media-info"><h4>${esc(d.title)}</h4><p>${dateID(d.activity_date)} · ${esc(d.activity_name||"-")}</p><p>${esc(d.location||"-")} · ${esc(d.photographer||"-")}</p><div class="actions" style="justify-content:flex-start;margin-bottom:0">${d.file_path?`<button class="mini-btn" data-view-media="${d.id}">Lihat</button>`:""}<button class="mini-btn" data-edit-media="${d.id}">Edit</button></div></div></article>`).join(""):'<div class="empty">Belum ada dokumentasi.</div>'}</div></article>`;
  $("addDocHumasBtn").onclick=()=>openHumasDocumentation();
  document.querySelectorAll("[data-edit-media]").forEach(b=>b.onclick=()=>openHumasDocumentation(b.dataset.editMedia));
  document.querySelectorAll("[data-view-media]").forEach(b=>b.onclick=()=>openHumasMedia(b.dataset.viewMedia));
}
function openHumasDocumentation(id=""){
  const d=humasDocs.find(x=>x.id===id)||{};
  openModal(id?"Edit Dokumentasi":"Tambah Dokumentasi","humas_doc",id);
  setFields(
    inp("fDate","Tanggal Kegiatan","date",d.activity_date||today())+
    inp("fTitle","Judul Dokumentasi *","text",d.title,true)+
    inp("fActivity","Nama Kegiatan","text",d.activity_name||"")+
    inp("fLocation","Lokasi","text",d.location||"")+
    inp("fPhotographer","Dokumentator","text",d.photographer||profile.full_name||"")+
    sel("fFeatured","Tandai Unggulan?",[["false","Tidak"],["true","Ya"]],String(!!d.is_featured))+
    `<label class="full"><span>File Foto/Video ${d.file_path?"(opsional jika tidak diganti)":"*"}</span><input id="fMediaFile" type="file" accept=".jpg,.jpeg,.png,.webp,.mp4,.webm"></label>`+
    ta("fDesc","Deskripsi",d.description||"")
  );
}
async function openHumasMedia(id){
  try{
    const d=humasDocs.find(x=>x.id===id);if(!d?.file_path)throw new Error("File tidak ditemukan");
    const url=await signedHumasMediaUrl(d.file_path);window.open(url,"_blank","noopener");
  }catch(err){alert("Gagal membuka media: "+err.message)}
}
function renderSocialMedia(){
  $("panelSocialmedia").innerHTML=`<article class="cardx"><div class="actions"><button class="primary-btn" id="addSocialBtn">+ Akun Media</button></div><div class="social-grid">${humasSocial.length?humasSocial.map(s=>`<article class="social-card"><span class="badge">${esc(s.platform)}</span><h4>${esc(s.account_name)}</h4><p>${esc(s.username_handle||"-")}</p><div class="big">${Number(s.follower_count||0).toLocaleString("id-ID")}</div><p>Followers/Subscribers · Update ${dateID(s.last_updated)}</p><div class="actions" style="justify-content:flex-start;margin-bottom:0">${s.profile_url?`<button class="mini-btn" data-open-social="${s.id}">Buka</button>`:""}<button class="mini-btn" data-edit-social="${s.id}">Edit</button></div></article>`).join(""):'<div class="empty">Belum ada akun media sosial.</div>'}</div></article>`;
  $("addSocialBtn").onclick=()=>openSocial();
  document.querySelectorAll("[data-edit-social]").forEach(b=>b.onclick=()=>openSocial(b.dataset.editSocial));
  document.querySelectorAll("[data-open-social]").forEach(b=>b.onclick=()=>{const s=humasSocial.find(x=>x.id===b.dataset.openSocial);if(s?.profile_url)window.open(s.profile_url,"_blank","noopener")});
}
function openSocial(id=""){
  const s=humasSocial.find(x=>x.id===id)||{};
  openModal(id?"Edit Akun Media":"Tambah Akun Media","humas_social",id);
  setFields(
    sel("fPlatform","Platform",[["INSTAGRAM","Instagram"],["FACEBOOK","Facebook"],["YOUTUBE","YouTube"],["TIKTOK","TikTok"],["WHATSAPP","WhatsApp"],["WEBSITE","Website"],["LAINNYA","Lainnya"]],s.platform||"INSTAGRAM")+
    inp("fAccount","Nama Akun *","text",s.account_name||"")+
    inp("fUsername","Username/Handle","text",s.username_handle||"")+
    inp("fUrl","URL Profil","text",s.profile_url||"",true)+
    inp("fFollowers","Followers/Subscribers","number",s.follower_count??0)+
    inp("fUpdated","Tanggal Update","date",s.last_updated||today())+
    ta("fNote","Catatan",s.note||"")
  );
}
function renderHumasNews(){
  $("panelHumasnews").innerHTML=`<article class="cardx"><div class="actions"><a href="berita.html" class="primary-btn" style="width:auto;text-decoration:none">Buka Modul Berita</a></div><div class="news-list-humas">${humasNews.length?humasNews.map(n=>`<div class="news-row-humas"><div><b>${esc(n.title)}</b><p>${esc(n.category||"BERITA")} · ${n.published_at?dateID(n.published_at.slice(0,10)):"Belum terbit"} · ${esc(n.status)}</p><p>${esc(n.excerpt||"")}</p></div><span class="badge">${esc(n.status)}</span></div>`).join(""):'<div class="empty">Belum ada berita.</div>'}</div></article>`;
}
function renderHumasRecap(){
  const s=humasRecap.summary||{},months=humasRecap.months||[],monthNames=["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"],max=Math.max(1,...months.map(m=>Number(m.published||0)));
  $("panelHumasrecap").innerHTML=`<article class="cardx">
   <div class="humas-recap-cards">
    <div class="humas-recap-card"><span>Rencana</span><b>${Number(s.planned||0)}</b></div>
    <div class="humas-recap-card"><span>Terbit</span><b>${Number(s.published||0)}</b></div>
    <div class="humas-recap-card"><span>Dokumentasi</span><b>${Number(s.documentation_count||0)}</b></div>
    <div class="humas-recap-card"><span>Berita</span><b>${Number(s.news_count||0)}</b></div>
    <div class="humas-recap-card"><span>Reach</span><b>${Number(s.reach||0).toLocaleString("id-ID")}</b></div>
    <div class="humas-recap-card"><span>Engagement</span><b>${Number(s.engagement||0).toLocaleString("id-ID")}</b></div>
   </div>
   <div class="grid2">
    <div><h3>Publikasi per Bulan</h3><div class="month-bars">${months.map(m=>`<div class="month-col"><div class="month-track"><div class="month-fill" style="height:${Math.max(2,Math.round(Number(m.published||0)/max*100))}%"></div></div><b>${monthNames[m.month_no-1]}</b><small>${m.published}</small></div>`).join("")}</div></div>
    <div><h3>Channel</h3><div class="table-wrap"><table class="tablex" style="min-width:0"><thead><tr><th>Channel</th><th>Rencana</th><th>Terbit</th></tr></thead><tbody>${(humasRecap.channels||[]).map(c=>`<tr><td>${esc(c.channel)}</td><td>${c.planned}</td><td>${c.published}</td></tr>`).join("")||'<tr><td colspan="3">Belum ada data.</td></tr>'}</tbody></table></div></div>
   </div>
  </article>`;
}

function filteredCases(){
  const q=$("caseSearch")?.value?.trim().toLowerCase()||"";
  const cat=$("caseCategoryFilter")?.value||"";
  const st=$("caseStatusFilter")?.value||"";
  return specific.filter(x=>{
    const hay=`${x.case_code||""} ${x.students?.full_name||""} ${x.students?.nisn||""} ${x.title||""} ${x.description||""}`.toLowerCase();
    return(!q||hay.includes(q))&&(!cat||x.category===cat)&&(!st||x.status===st);
  });
}
function renderCaseTable(){
  const holder=$("caseTableWrap");if(!holder)return;
  const data=filteredCases();
  holder.innerHTML=`<div class="table-wrap"><table class="tablex"><thead><tr><th>Kode</th><th>Tanggal</th><th>Siswa</th><th>Kategori</th><th>Tingkat</th><th>Catatan</th><th>Poin</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${data.length?data.map(x=>`<tr>
    <td><b>${esc(x.case_code||"-")}</b></td>
    <td>${dateID(x.case_date)}</td>
    <td><b>${esc(x.students?.full_name||"-")}</b><br>${esc(x.students?.nisn||"")}</td>
    <td>${esc(x.category)}</td>
    <td>${x.severity?badge(x.severity):"-"}</td>
    <td><b>${esc(x.title)}</b><br><span style="color:#73817a">${esc(x.description||"")}</span></td>
    <td><b>${Number(x.points||0)}</b></td>
    <td>${badge(x.status)}</td>
    <td><button class="mini-btn" data-case-detail="${x.id}">Detail</button> <button class="mini-btn" data-edit-specific="${x.id}">Edit</button></td>
  </tr>`).join(""):'<tr><td colspan="9"><div class="empty">Catatan siswa tidak ditemukan.</div></td></tr>'}</tbody></table></div>`;
  holder.querySelectorAll("[data-case-detail]").forEach(b=>b.onclick=()=>openCaseDetail(b.dataset.caseDetail));
  holder.querySelectorAll("[data-edit-specific]").forEach(b=>b.onclick=()=>openSpecific(b.dataset.editSpecific));
}
async function openCaseDetail(id){
  try{
    const x=specific.find(v=>v.id===id);if(!x)throw new Error("Catatan tidak ditemukan");
    const followups=await api.db.select("student_guidance_followups",`select=*&case_id=eq.${encodeURIComponent(id)}&order=followup_date.desc,created_at.desc`);
    openModal(`Detail Pembinaan · ${x.case_code||""}`,"case_detail",id);
    setFields(`<div class="full case-detail-grid">
      <div>
        <div class="case-info">
          <div><span>Siswa</span><b>${esc(x.students?.full_name||"-")}</b></div>
          <div><span>Kode</span><b>${esc(x.case_code||"-")}</b></div>
          <div><span>Kategori</span><b>${esc(x.category)}</b></div>
          <div><span>Tingkat</span><b>${esc(x.severity||"-")}</b></div>
          <div><span>Poin</span><b>${Number(x.points||0)}</b></div>
          <div><span>Status</span><b>${esc(x.status)}</b></div>
          <div><span>Penangan</span><b>${esc(x.handled_by||"-")}</b></div>
          <div><span>Orang Tua</span><b>${x.parent_contacted?"Sudah dihubungi":"Belum dihubungi"}</b></div>
        </div>
        <div style="margin-top:10px;font-size:9px;line-height:1.6"><b>${esc(x.title)}</b><br>${esc(x.description||"-")}</div>
        <div class="actions" style="justify-content:flex-start">
          <button type="button" class="secondary-btn" id="caseFollowBtn">+ Tindak Lanjut</button>
          <button type="button" class="secondary-btn" id="caseSummonBtn">Surat Panggilan</button>
          <button type="button" class="secondary-btn" id="caseEditBtn">Edit Catatan</button>
        </div>
      </div>
      <div>
        <h4 style="margin:0 0 7px;font-size:10px">Riwayat Tindak Lanjut</h4>
        <div class="timeline">${followups.length?followups.map(f=>`<div class="timeline-item"><b>${dateID(f.followup_date)} · ${esc(f.action_type)}</b><p>${esc(f.description)}</p><p><b>Hasil:</b> ${esc(f.result||"-")}</p>${f.next_action?`<p><b>Selanjutnya:</b> ${esc(f.next_action)}</p>`:""}</div>`).join(""):'<div class="empty">Belum ada tindak lanjut.</div>'}</div>
      </div>
    </div>`);
    const saveBtn=$("entryForm").querySelector('button[type="submit"]');if(saveBtn)saveBtn.style.display="none";
    $("caseFollowBtn").onclick=()=>openCaseFollowup(id);
    $("caseSummonBtn").onclick=()=>openSummon("",id,x.student_id);
    $("caseEditBtn").onclick=()=>openSpecific(id);
  }catch(err){alert("Gagal membuka detail: "+err.message)}
}
function openCaseFollowup(caseId){
  const x=specific.find(v=>v.id===caseId);
  openModal(`Tindak Lanjut · ${x?.case_code||""}`,"case_followup",caseId);
  setFields(
    inp("fDate","Tanggal","date",today())+
    sel("fActionType","Jenis",[["PEMBINAAN","Pembinaan"],["KONSELING","Konseling"],["PANGGILAN_ORANG_TUA","Panggilan Orang Tua"],["KOORDINASI_WALI_KELAS","Koordinasi Wali Kelas"],["PENGHARGAAN","Penghargaan"],["LAINNYA","Lainnya"]],"PEMBINAAN")+
    inp("fHandler","Penangan","text",profile.full_name||"")+
    ta("fDesc","Uraian Tindak Lanjut *","")+
    ta("fResult","Hasil","")+
    ta("fNext","Tindak Lanjut Berikutnya","")
  );
}
function renderSummons(){
  $("panelSummons").innerHTML=`<article class="cardx">
    <div class="actions"><button class="primary-btn" id="addSummonBtn">+ Surat Panggilan</button></div>
    <div class="table-wrap"><table class="tablex"><thead><tr><th>Nomor</th><th>Siswa</th><th>Tanggal Surat</th><th>Jadwal Pertemuan</th><th>Alasan</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
      ${summons.length?summons.map(s=>`<tr><td><b>${esc(s.summon_number||"-")}</b></td><td>${esc(s.students?.full_name||"-")}<br>${esc(s.students?.nisn||"")}</td><td>${dateID(s.summon_date)}</td><td>${dateID(s.meeting_date)}${s.meeting_time?` · ${String(s.meeting_time).slice(0,5)}`:""}</td><td>${esc(s.reason)}</td><td>${badge(s.status)}</td><td><button class="mini-btn" data-print-summon="${s.id}">Cetak</button> <button class="mini-btn" data-edit-summon="${s.id}">Edit</button></td></tr>`).join(""):'<tr><td colspan="7"><div class="empty">Belum ada surat panggilan.</div></td></tr>'}
    </tbody></table></div>
  </article>`;
  $("addSummonBtn").onclick=()=>openSummon();
  document.querySelectorAll("[data-edit-summon]").forEach(b=>b.onclick=()=>openSummon(b.dataset.editSummon));
  document.querySelectorAll("[data-print-summon]").forEach(b=>b.onclick=()=>printSummon(b.dataset.printSummon));
}
function openSummon(id="",caseId="",studentId=""){
  const s=summons.find(x=>x.id===id)||{};
  const student=studentId||s.student_id||"";
  openModal(id?"Edit Surat Panggilan":"Tambah Surat Panggilan","summon",id);
  setFields(
    sel("fStudent","Siswa *",students.map(st=>[st.id,`${st.full_name} · ${st.nisn||"-"}`]),student)+
    inp("fSummonDate","Tanggal Surat","date",s.summon_date||today())+
    inp("fMeetingDate","Tanggal Pertemuan","date",s.meeting_date||today())+
    inp("fMeetingTime","Jam Pertemuan","time",s.meeting_time?String(s.meeting_time).slice(0,5):"08:00")+
    inp("fParent","Nama Orang Tua/Wali","text",s.parent_name||"")+
    inp("fPlace","Tempat","text",s.place||"MA Nurul Islam")+
    sel("fStatus","Status",[["DRAFT","DRAFT"],["ISSUED","ISSUED"],["ATTENDED","ATTENDED"],["COMPLETED","COMPLETED"],["CANCELLED","CANCELLED"]],s.status||"DRAFT")+
    ta("fReason","Alasan Panggilan *",s.reason||"")+
    ta("fResult","Hasil Pertemuan",s.result||"")+
    ta("fNote","Catatan",s.note||"")+
    `<input id="fCaseId" type="hidden" value="${esc(caseId||s.case_id||"")}">`
  );
}
async function printSummon(id){
  try{
    const s=summons.find(x=>x.id===id);if(!s)return;
    const brand=await api.db.rpc("get_public_system_settings",{})||{};
    const signatory=profile.full_name||"PKM Kesiswaan";
    $("summonPrint").innerHTML=`<div class="kop"><h1>${esc(brand.school_name||"MA Nurul Islam")}</h1><h2>SURAT PANGGILAN ORANG TUA / WALI</h2><p>${esc([brand.address,brand.district,brand.regency].filter(Boolean).join(", "))}</p></div>
      <div class="meta"><p>Nomor: <b>${esc(s.summon_number||"-")}</b></p><p>Tanggal: ${dateID(s.summon_date)}</p></div>
      <p class="bodyp">Yth. Bapak/Ibu Orang Tua/Wali dari <b>${esc(s.students?.full_name||"-")}</b>,</p>
      <p class="bodyp">Dengan hormat, sehubungan dengan keperluan pembinaan dan pendampingan peserta didik, kami mengharap kehadiran Bapak/Ibu pada:</p>
      <table style="margin:5mm 0 5mm 10mm;border-collapse:collapse"><tr><td style="padding:1.5mm 8mm 1.5mm 0">Hari/Tanggal</td><td>: ${dateID(s.meeting_date)}</td></tr><tr><td style="padding:1.5mm 8mm 1.5mm 0">Pukul</td><td>: ${esc(s.meeting_time?String(s.meeting_time).slice(0,5):"-")}</td></tr><tr><td style="padding:1.5mm 8mm 1.5mm 0">Tempat</td><td>: ${esc(s.place||"MA Nurul Islam")}</td></tr><tr><td style="padding:1.5mm 8mm 1.5mm 0">Keperluan</td><td>: ${esc(s.reason)}</td></tr></table>
      <p class="bodyp">Demikian surat panggilan ini disampaikan. Atas perhatian dan kehadiran Bapak/Ibu, kami sampaikan terima kasih.</p>
      <div class="sign"><div><p>Mengetahui,<br>Kepala Madrasah</p><div class="space"></div><b>${esc(brand.headmaster_name||"________________")}</b></div><div><p>PKM Kesiswaan</p><div class="space"></div><b>${esc(signatory)}</b></div></div>`;
    document.body.classList.add("print-summon");setTimeout(()=>{window.print();setTimeout(()=>document.body.classList.remove("print-summon"),300)},100);
  }catch(err){alert("Gagal mencetak surat: "+err.message)}
}
function renderActivities(){
  const ay=activeAcademicYearId();
  $("panelActivities").innerHTML=`<article class="cardx">
    <div class="actions"><button class="primary-btn" id="addGroupBtn">+ Organisasi/Ekskul</button></div>
    <div class="group-grid">${activityGroups.length?activityGroups.map(g=>{
      const members=activityMembers.filter(m=>m.group_id===g.id&&(!ay||m.academic_year_id===ay));
      return`<article class="group-card"><div style="display:flex;justify-content:space-between;gap:8px"><div><span class="badge">${esc(g.group_type)}</span><h4>${esc(g.name)}</h4></div><b style="font-size:18px;color:#0b7347">${members.length}</b></div><p>Pembina: ${esc(g.teachers?.full_name||"-")}</p><p>${esc(g.schedule_text||"-")}${g.location?` · ${esc(g.location)}`:""}</p><div class="actions" style="justify-content:flex-start;margin-bottom:0"><button class="mini-btn" data-group-members="${g.id}">Anggota</button><button class="mini-btn" data-edit-group="${g.id}">Edit</button></div></article>`
    }).join(""):'<div class="empty">Belum ada organisasi/ekstrakurikuler.</div>'}</div>
  </article>`;
  $("addGroupBtn").onclick=()=>openGroup();
  document.querySelectorAll("[data-edit-group]").forEach(b=>b.onclick=()=>openGroup(b.dataset.editGroup));
  document.querySelectorAll("[data-group-members]").forEach(b=>b.onclick=()=>openGroupMembers(b.dataset.groupMembers));
}
function openGroup(id=""){
  const g=activityGroups.find(x=>x.id===id)||{};
  openModal(id?"Edit Organisasi/Ekskul":"Tambah Organisasi/Ekskul","activity_group",id);
  setFields(
    sel("fGroupType","Jenis",[["ORGANISASI","Organisasi"],["EKSTRAKURIKULER","Ekstrakurikuler"]],g.group_type||"EKSTRAKURIKULER")+
    inp("fName","Nama *","text",g.name,true)+
    sel("fAdvisor","Pembina",[[ "", "Tidak dipilih"],...teachers.map(t=>[t.id,t.full_name])],g.advisor_teacher_id||"")+
    inp("fSchedule","Jadwal","text",g.schedule_text||"")+
    inp("fLocation","Lokasi","text",g.location||"")+
    ta("fDesc","Deskripsi",g.description||"")
  );
}
function openGroupMembers(groupId){
  const g=activityGroups.find(x=>x.id===groupId);if(!g)return;
  const ay=activeAcademicYearId();
  const members=activityMembers.filter(m=>m.group_id===groupId&&(!ay||m.academic_year_id===ay));
  openModal(`Anggota · ${g.name}`,"group_members",groupId);
  setFields(`<div class="full"><div class="actions" style="justify-content:flex-start"><button type="button" class="primary-btn" id="addMemberBtn">+ Anggota</button></div><div class="table-wrap"><table class="tablex"><thead><tr><th>Siswa</th><th>Jabatan/Peran</th><th>Tanggal Bergabung</th><th>Aksi</th></tr></thead><tbody>${members.length?members.map(m=>`<tr><td>${esc(m.students?.full_name||"-")}<br>${esc(m.students?.nisn||"")}</td><td>${esc(m.position_name||"-")}</td><td>${dateID(m.joined_date)}</td><td><button type="button" class="mini-btn" data-del-member="${m.id}">Hapus</button></td></tr>`).join(""):'<tr><td colspan="4"><div class="empty">Belum ada anggota.</div></td></tr>'}</tbody></table></div></div>`);
  const saveBtn=$("entryForm").querySelector('button[type="submit"]');if(saveBtn)saveBtn.style.display="none";
  $("addMemberBtn").onclick=()=>openAddMember(groupId);
  document.querySelectorAll("[data-del-member]").forEach(b=>b.onclick=async()=>{if(!confirm("Hapus anggota ini?"))return;await del("student_activity_members",b.dataset.delMember);closeModal()});
}
function openAddMember(groupId){
  const g=activityGroups.find(x=>x.id===groupId);
  openModal(`Tambah Anggota · ${g?.name||""}`,"activity_member",groupId);
  setFields(
    sel("fStudent","Siswa *",students.map(s=>[s.id,`${s.full_name} · ${s.nisn||"-"}`]),"")+
    inp("fPosition","Jabatan/Peran","text","")+
    inp("fJoined","Tanggal Bergabung","date",today())+
    ta("fNote","Catatan","")
  );
}
function renderStudentRecap(){
  const cls=$("recapClassFilter")?.value||"";
  const sum=studentAffairsRecap.summary||{},classesRecap=studentAffairsRecap.class_recap||[],allStudents=studentAffairsRecap.student_recap||[];
  const rows=cls?allStudents.filter(x=>x.class_id===cls):allStudents;
  $("panelStudentrecap").innerHTML=`<article class="cardx">
    <div class="recap-cards">
      <div class="recap-card"><span>Total Catatan</span><b>${Number(sum.total_cases||0)}</b></div>
      <div class="recap-card"><span>Kasus Terbuka</span><b>${Number(sum.open_cases||0)}</b></div>
      <div class="recap-card"><span>Pelanggaran</span><b>${Number(sum.violation_cases||0)}</b></div>
      <div class="recap-card"><span>Penghargaan</span><b>${Number(sum.reward_cases||0)}</b></div>
    </div>
    <div class="kesiswaan-toolbar" style="grid-template-columns:1fr auto">
      <label><span>Filter Kelas</span><select id="recapClassFilter"><option value="">Semua Kelas</option>${classesRecap.map(c=>`<option value="${c.class_id}" ${cls===c.class_id?"selected":""}>${esc(c.class_name)}</option>`).join("")}</select></label>
      <button class="secondary-btn" id="exportStudentRecapBtn" style="width:auto">Export CSV</button>
    </div>
    <div class="table-wrap"><table class="tablex"><thead><tr><th>Kelas</th><th>Siswa</th><th>Kasus Terbuka</th><th>Pelanggaran</th><th>Pembinaan/Konseling</th><th>Penghargaan</th><th>Total Poin</th><th>Terakhir</th></tr></thead><tbody>
      ${rows.length?rows.map(r=>`<tr><td>${esc(r.class_name)}</td><td><b>${esc(r.student_name)}</b><br>${esc(r.nisn||"")}</td><td>${r.open_cases}</td><td>${r.violation_count}</td><td>${r.guidance_count}</td><td>${r.reward_count}</td><td><b>${r.total_points}</b></td><td>${r.last_case_date?dateID(r.last_case_date):"-"}</td></tr>`).join(""):'<tr><td colspan="8"><div class="empty">Tidak ada data siswa.</div></td></tr>'}
    </tbody></table></div>
  </article>`;
  $("recapClassFilter").onchange=renderStudentRecap;
  $("exportStudentRecapBtn").onclick=()=>exportStudentAffairsRecap(rows);
}
function exportStudentAffairsRecap(rows){
  const data=[["Kelas","Nama Siswa","NISN","Kasus Terbuka","Pelanggaran","Pembinaan/Konseling","Penghargaan","Total Poin","Catatan Terakhir"]];
  rows.forEach(r=>data.push([r.class_name,r.student_name,r.nisn||"",r.open_cases,r.violation_count,r.guidance_count,r.reward_count,r.total_points,r.last_case_date||""]));
  const csv=data.map(row=>row.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\n");
  const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`rekap-kesiswaan-${activeSemester()?.name||"semester"}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),500);
}

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

function renderAll(){renderStats();renderSummary();renderPrograms();renderLogs();renderSpecific();if(unitCode==="PKM_KURIKULUM"){renderDocuments();renderAcademicCalendar();renderTeacherRecap()}if(unitCode==="PKM_KESISWAAN"){renderSummons();renderActivities();renderStudentRecap()}if(unitCode==="PKM_HUMASY"){renderContentCalendar();renderDocumentation();renderSocialMedia();renderHumasNews();renderHumasRecap()}if(unitCode==="KEPALA_TU"){renderLetterAgenda();renderTuDispositions();renderTuArchive();renderTuRecap()}}

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
 else if(unitCode==="PKM_KESISWAAN")setFields(
   sel("fStudent","Siswa *",students.map(s=>[s.id,`${s.full_name} · ${s.nisn||"-"}`]),x.student_id)+
   inp("fDate","Tanggal","date",x.case_date||today())+
   sel("fCategory","Kategori",[["PELANGGARAN","Pelanggaran"],["PEMBINAAN","Pembinaan"],["KONSELING","Konseling"],["PENGHARGAAN","Penghargaan"],["LAINNYA","Lainnya"]],x.category||"PEMBINAAN")+
   sel("fSeverity","Tingkat",[["","-"],["RINGAN","Ringan"],["SEDANG","Sedang"],["BERAT","Berat"]],x.severity||"")+
   inp("fTitle","Judul *","text",x.title,true)+
   inp("fPoints","Poin","number",x.points??0)+
   inp("fHandler","Penangan","text",x.handled_by)+
   sel("fStatus","Status",[["OPEN","OPEN"],["PROCESS","PROCESS"],["CLOSED","CLOSED"]],x.status||"OPEN")+
   sel("fParentContacted","Orang Tua Dihubungi?",[["false","Belum"],["true","Sudah"]],String(!!x.parent_contacted))+
   inp("fParentDate","Tanggal Kontak","date",x.parent_contact_date||"")+
   ta("fDesc","Deskripsi",x.description)+
   ta("fAction","Tindakan",x.action_taken)+
   ta("fFollow","Tindak Lanjut",x.follow_up)+
   ta("fHomeroom","Catatan Wali Kelas",x.homeroom_note||"")
 );
 else if(unitCode==="PKM_BENDAHARA_SARPRAS")setFields(inp("fCode","Kode Aset","text",x.asset_code)+inp("fName","Nama Aset *","text",x.asset_name)+inp("fCategory","Kategori","text",x.category)+inp("fLocation","Lokasi","text",x.location)+inp("fDate","Tanggal Perolehan","date",x.acquisition_date)+inp("fValue","Nilai Perolehan","number",x.acquisition_value??0)+inp("fQty","Jumlah","number",x.quantity??1)+inp("fUnit","Satuan","text",x.unit||"UNIT")+sel("fCondition","Kondisi",[["BAIK","Baik"],["RUSAK_RINGAN","Rusak Ringan"],["RUSAK_BERAT","Rusak Berat"],["HILANG","Hilang"]],x.condition||"BAIK")+sel("fStatus","Status",[["ACTIVE","ACTIVE"],["MAINTENANCE","MAINTENANCE"],["DISPOSED","DISPOSED"]],x.status||"ACTIVE")+inp("fPIC","Penanggung Jawab","text",x.responsible_person)+ta("fNote","Catatan",x.note));
 else if(unitCode==="PKM_HUMASY")setFields(
   inp("fDate","Tanggal Publikasi","date",x.publish_date||today())+
   inp("fTime","Jam Rencana","time",x.planned_time?String(x.planned_time).slice(0,5):"")+
   sel("fChannel","Channel",[["WEBSITE","Website"],["INSTAGRAM","Instagram"],["FACEBOOK","Facebook"],["YOUTUBE","YouTube"],["WHATSAPP","WhatsApp"],["LAINNYA","Lainnya"]],x.channel||"INSTAGRAM")+
   inp("fTitle","Judul Konten *","text",x.title,true)+
   inp("fCampaign","Campaign/Program","text",x.campaign_name||"")+
   inp("fTarget","Target Audiens","text",x.target_audience||"")+
   inp("fType","Jenis Konten","text",x.content_type)+
   inp("fPIC","PIC","text",x.person_in_charge)+
   sel("fStatus","Status",[["IDEA","IDEA"],["DRAFT","DRAFT"],["READY","READY"],["PUBLISHED","PUBLISHED"],["CANCELLED","CANCELLED"]],x.status||"IDEA")+
   inp("fReach","Reach","number",x.reach_count??0)+
   inp("fEngagement","Engagement","number",x.engagement_count??0)+
   inp("fLink","Link Publikasi","text",x.published_link,true)+
   inp("fAssetUrl","Link Asset/Desain","text",x.asset_url,true)+
   ta("fCaption","Caption",x.caption_text||"")+
   ta("fNote","Catatan",x.note)
 );
 else if(unitCode==="KEPALA_TU")setFields(
   sel("fLetterType","Jenis Surat",[["INCOMING","Surat Masuk"],["OUTGOING","Surat Keluar"]],x.letter_type||"INCOMING")+
   inp("fNumber","Nomor Surat","text",x.letter_number)+
   inp("fLetterDate","Tanggal Surat","date",x.letter_date||today())+
   inp("fAdminDate","Tanggal Administrasi","date",x.administration_date||today())+
   inp("fReceivedDate","Tanggal Diterima","date",x.received_date||"")+
   inp("fSender","Asal/Tujuan *","text",x.sender_recipient,true)+
   inp("fSubject","Perihal *","text",x.subject,true)+
   sel("fClass","Klasifikasi",[[ "", "Belum diklasifikasikan"],...letterClasses.map(c=>[c.code,c.name])],x.classification||"")+
   sel("fPriority","Prioritas",[["BIASA","Biasa"],["PENTING","Penting"],["SEGERA","Segera"]],x.priority||"BIASA")+
   sel("fConfidentiality","Sifat",[["BIASA","Biasa"],["TERBATAS","Terbatas"],["RAHASIA","Rahasia"]],x.confidentiality||"BIASA")+
   inp("fPIC","Penanggung Jawab","text",x.responsible_person||"")+
   inp("fDueDate","Batas Tindak Lanjut","date",x.due_date||"")+
   sel("fStatus","Status",[["RECORDED","RECORDED"],["PROCESS","PROCESS"],["DONE","DONE"],["ARCHIVED","ARCHIVED"]],x.status||"RECORDED")+
   ta("fDisposition","Catatan Disposisi Awal",x.disposition)+
   ta("fNote","Catatan",x.note)
 );
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
  if(mode==="tu_pick_disposition"){
    const letterId=v("fPickLetter");if(!letterId)throw new Error("Pilih surat.");
    openTuDisposition("",letterId);return;
  }
  else if(mode==="tu_disposition"){
    table="office_letter_dispositions";
    payload={
      letter_id:v("fLetterId"),
      disposition_date:v("fDate")||today(),
      from_name:v("fFrom")||null,
      to_name:v("fTo"),
      instruction:v("fInstruction"),
      due_date:v("fDue")||null,
      status:v("fStatus"),
      result:v("fResult")||null,
      completed_at:v("fStatus")==="DONE"?new Date().toISOString():null
    };
  }
  else if(mode==="tu_file"){
    const letterId=v("fLetterId"),file=$("fTuFile")?.files?.[0];
    if(!letterId||!file)throw new Error("Surat dan file wajib tersedia.");
    const path=await uploadTuLetterFile(file,letterId);
    table="office_letter_files";
    payload={
      letter_id:letterId,
      file_path:path,
      original_filename:file.name,
      mime_type:file.type||null,
      file_size:file.size,
      document_label:v("fLabel")||null,
      is_primary:v("fPrimary")==="true"
    };
  }
  else if(mode==="humas_doc"){
    const existing=humasDocs.find(x=>x.id===id)||null;
    const file=$("fMediaFile")?.files?.[0];
    if(!existing && !file)throw new Error("File dokumentasi wajib dipilih.");
    let filePath=existing?.file_path||null;
    if(file)filePath=await uploadHumasMedia(file);
    table="humas_documentations";
    payload={
      activity_date:v("fDate")||today(),
      title:v("fTitle"),
      activity_name:v("fActivity")||null,
      location:v("fLocation")||null,
      description:v("fDesc")||null,
      photographer:v("fPhotographer")||null,
      file_path:filePath,
      original_filename:file?.name||existing?.original_filename||null,
      mime_type:file?.type||existing?.mime_type||null,
      file_size:file?.size||existing?.file_size||null,
      is_featured:v("fFeatured")==="true"
    };
  }
  else if(mode==="humas_social"){
    table="humas_social_accounts";
    payload={
      platform:v("fPlatform"),
      account_name:v("fAccount"),
      username_handle:v("fUsername")||null,
      profile_url:v("fUrl")||null,
      follower_count:Number(v("fFollowers")||0),
      last_updated:v("fUpdated")||today(),
      is_active:true,
      note:v("fNote")||null
    };
  }
  else if(mode==="case_followup"){
    table="student_guidance_followups";
    payload={case_id:id,followup_date:v("fDate")||today(),action_type:v("fActionType"),description:v("fDesc"),result:v("fResult")||null,next_action:v("fNext")||null,handled_by:v("fHandler")||null};
  }
  else if(mode==="summon"){
    table="student_summons";
    payload={student_id:v("fStudent"),case_id:v("fCaseId")||null,summon_date:v("fSummonDate")||today(),meeting_date:v("fMeetingDate"),meeting_time:v("fMeetingTime")||null,parent_name:v("fParent")||null,reason:v("fReason"),place:v("fPlace")||"MA Nurul Islam",status:v("fStatus"),result:v("fResult")||null,note:v("fNote")||null};
  }
  else if(mode==="activity_group"){
    table="student_activity_groups";
    payload={group_type:v("fGroupType"),name:v("fName"),description:v("fDesc")||null,advisor_teacher_id:v("fAdvisor")||null,schedule_text:v("fSchedule")||null,location:v("fLocation")||null,is_active:true};
  }
  else if(mode==="activity_member"){
    table="student_activity_members";
    payload={group_id:id,student_id:v("fStudent"),academic_year_id:activeAcademicYearId(),position_name:v("fPosition")||null,joined_date:v("fJoined")||null,is_active:true,note:v("fNote")||null};
    id="";
  }
  else if(mode==="curr_doc"){
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
  else if(unitCode==="PKM_KESISWAAN"){table="student_guidance_cases";payload={
    student_id:v("fStudent"),
    case_date:v("fDate"),
    category:v("fCategory"),
    severity:v("fSeverity")||null,
    title:v("fTitle"),
    description:v("fDesc")||null,
    points:Number(v("fPoints")||0),
    action_taken:v("fAction")||null,
    follow_up:v("fFollow")||null,
    status:v("fStatus"),
    handled_by:v("fHandler")||null,
    parent_contacted:v("fParentContacted")==="true",
    parent_contact_date:v("fParentDate")||null,
    homeroom_note:v("fHomeroom")||null,
    resolution_date:v("fStatus")==="CLOSED"?today():null
  }}
  else if(unitCode==="PKM_BENDAHARA_SARPRAS"){table="school_assets";payload={asset_code:v("fCode")||null,asset_name:v("fName"),category:v("fCategory")||null,location:v("fLocation")||null,acquisition_date:v("fDate")||null,acquisition_value:Number(v("fValue")||0),quantity:Number(v("fQty")||0),unit:v("fUnit")||"UNIT",condition:v("fCondition"),status:v("fStatus"),responsible_person:v("fPIC")||null,note:v("fNote")||null}}
  else if(unitCode==="PKM_HUMASY"){table="humas_publication_plans";payload={
    publish_date:v("fDate"),
    planned_time:v("fTime")||null,
    channel:v("fChannel"),
    title:v("fTitle"),
    campaign_name:v("fCampaign")||null,
    target_audience:v("fTarget")||null,
    content_type:v("fType")||null,
    status:v("fStatus"),
    person_in_charge:v("fPIC")||null,
    published_link:v("fLink")||null,
    asset_url:v("fAssetUrl")||null,
    caption_text:v("fCaption")||null,
    reach_count:Number(v("fReach")||0),
    engagement_count:Number(v("fEngagement")||0),
    published_at:v("fStatus")==="PUBLISHED"?new Date().toISOString():null,
    note:v("fNote")||null
  }}
  else if(unitCode==="KEPALA_TU"){table="office_letters";payload={
    letter_type:v("fLetterType"),
    letter_number:v("fNumber")||null,
    letter_date:v("fLetterDate"),
    administration_date:v("fAdminDate"),
    received_date:v("fReceivedDate")||null,
    sender_recipient:v("fSender"),
    subject:v("fSubject"),
    classification:v("fClass")||null,
    priority:v("fPriority")||"BIASA",
    confidentiality:v("fConfidentiality")||"BIASA",
    responsible_person:v("fPIC")||null,
    due_date:v("fDueDate")||null,
    disposition:v("fDisposition")||null,
    status:v("fStatus"),
    completed_at:["DONE","ARCHIVED"].includes(v("fStatus"))?new Date().toISOString():null,
    note:v("fNote")||null
  }}
  else {table="lab_inventory";payload={lab_code:UNITS[unitCode].lab,item_code:v("fCode")||null,item_name:v("fName"),category:v("fCategory")||null,quantity:Number(v("fQty")||0),unit:v("fUnit")||"UNIT",condition:v("fCondition"),location:v("fLocation")||null,minimum_stock:Number(v("fMin")||0),note:v("fNote")||null}}
  if(mode==="asset_maintenance" && !payload.description)throw new Error("Deskripsi pemeliharaan wajib diisi.");
  if(mode==="tu_disposition" && (!payload.letter_id||!payload.to_name||!payload.instruction))throw new Error("Surat, tujuan, dan instruksi disposisi wajib diisi.");
  if(mode==="tu_file" && !payload.file_path)throw new Error("File arsip wajib diupload.");
  if(mode==="humas_doc" && !payload.title)throw new Error("Judul dokumentasi wajib diisi.");
  if(mode==="humas_social" && !payload.account_name)throw new Error("Nama akun media wajib diisi.");
  if(mode==="case_followup" && !payload.description)throw new Error("Uraian tindak lanjut wajib diisi.");
  if(mode==="summon" && (!payload.student_id||!payload.reason||!payload.meeting_date))throw new Error("Siswa, alasan, dan tanggal pertemuan wajib diisi.");
  if(mode==="activity_group" && !payload.name)throw new Error("Nama organisasi/ekskul wajib diisi.");
  if(mode==="activity_member" && (!payload.student_id||!payload.academic_year_id))throw new Error("Siswa dan tahun pelajaran aktif wajib tersedia.");
  if(!["asset_maintenance","curr_doc","curr_verify","curr_calendar","case_followup","summon","activity_group","activity_member","humas_doc","humas_social","tu_disposition","tu_file"].includes(mode) && !payload.title&&!payload.asset_name&&!payload.item_name&&!payload.activity&&!payload.subject&&!payload.teacher_id&&!payload.student_id)throw new Error("Data utama wajib diisi.");
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