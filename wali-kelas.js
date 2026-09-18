const $=id=>document.getElementById(id);
let api,profile,context=null,report={students:[],class_teachers:[],submissions:[],records:[]};

function esc(s){return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}
function formatRole(r){return(r||"-").replaceAll("_"," ")}
function localDateID(){return new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date())}
function localISODate(){const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const o={};p.forEach(x=>o[x.type]=x.value);return`${o.year}-${o.month}-${o.day}`}
function firstDayOfMonth(){const t=localISODate();return t.slice(0,8)+"01"}
function fmtDate(v){if(!v)return"-";try{return new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(v+"T12:00:00+07:00"))}catch{return v}}
function routeFor(code){return{DASHBOARD:"dashboard.html",ADMINISTRASI_KEPALA:"administrasi.html",DATA_SISWA:"siswa.html",DATA_GURU:"guru.html",KELAS:"kelas.html",MATA_PELAJARAN:"mapel.html",JADWAL:"jadwal.html",ABSENSI_GURU:"absensi-guru.html",ABSENSI_SISWA:"absensi-siswa.html",NILAI:"nilai.html",PRESTASI:"prestasi.html",BERITA:"berita.html",PENGUMUMAN:"pengumuman.html",AGENDA:"agenda.html",KEUANGAN:"keuangan.html",PORTAL_WALI:"wali-admin.html",PENGATURAN:"pengaturan.html"}[code]||"#"}

async function loadProfile(user){const r=await api.db.select("profiles",`select=id,full_name,role,is_active&id=eq.${encodeURIComponent(user.id)}&limit=1`);if(!r?.[0])throw new Error("Profil pengguna tidak ditemukan.");return r[0]}
async function loadMenu(){const m=await api.db.rpc("get_my_modules",{});$("sidebarMenu").innerHTML=(m||[]).map(x=>`<a href="${routeFor(x.code)}" class="nav-item"><span class="nav-dot"></span><span>${esc(x.name)}</span></a>`).join("");}

function teacherFilteredRecords(){const tid=$("teacherFilter").value;return(report.records||[]).filter(r=>!tid||r.teacher_id===tid)}
function teacherFilteredSubmissions(){const tid=$("teacherFilter").value;return(report.submissions||[]).filter(r=>!tid||r.teacher_id===tid)}

function summarizeStudents(){
  const records=teacherFilteredRecords(),map=new Map();
  (report.students||[]).forEach(s=>map.set(s.enrollment_id,{...s,HADIR:0,TERLAMBAT:0,IZIN:0,SAKIT:0,ALFA:0,total:0}));
  records.forEach(r=>{
    if(!map.has(r.enrollment_id))map.set(r.enrollment_id,{enrollment_id:r.enrollment_id,full_name:r.full_name,nis:r.nis,nisn:r.nisn,roll_number:r.roll_number,HADIR:0,TERLAMBAT:0,IZIN:0,SAKIT:0,ALFA:0,total:0});
    const s=map.get(r.enrollment_id);
    if(Object.hasOwn(s,r.attendance_status))s[r.attendance_status]++;
    s.total++;
  });
  return[...map.values()].sort((a,b)=>(Number(a.roll_number||9999)-Number(b.roll_number||9999))||String(a.full_name).localeCompare(String(b.full_name),"id"))
}

function renderStats(){
  const records=teacherFilteredRecords(),subs=teacherFilteredSubmissions();
  $("statStudents").textContent=(report.students||[]).length;
  $("statTeachers").textContent=(report.class_teachers||[]).length;
  $("statSubmissions").textContent=subs.length;
  $("statAbsent").textContent=records.filter(r=>r.attendance_status==="ALFA").length
}
function renderTeacherFilter(){
  const current=$("teacherFilter").value;
  $("teacherFilter").innerHTML='<option value="">Semua Guru</option>'+(report.class_teachers||[]).map(t=>`<option value="${t.teacher_id}">${esc(t.teacher_name)} · ${esc(t.subjects||"-")}</option>`).join("");
  if(current&&[...$("teacherFilter").options].some(o=>o.value===current))$("teacherFilter").value=current
}
function renderTeacherList(){
  const subs=report.submissions||[];
  $("teacherInfo").textContent=`${(report.class_teachers||[]).length} guru`;
  $("teacherList").innerHTML=(report.class_teachers||[]).map(t=>{
    const n=subs.filter(s=>s.teacher_id===t.teacher_id).length;
    return`<div class="teacher-row"><div><b>${esc(t.teacher_name)}</b><p>${esc(t.subjects||"-")}</p></div><span class="count">${n} kiriman</span></div>`
  }).join("")||'<div class="empty-wk">Belum ada guru terjadwal pada kelas ini.</div>'
}
function renderHistory(){
  const subs=teacherFilteredSubmissions();
  $("historyInfo").textContent=`${subs.length} kiriman`;
  $("historyList").innerHTML=subs.map(s=>`<div class="history-row"><div class="history-date">${fmtDate(s.attendance_date)}</div><div><h4>${esc(s.teacher_name)}</h4><p>${esc(s.subject_names||"-")}${s.schedule_slots?` · ${esc(s.schedule_slots)}`:""}</p></div><div class="history-counts"><span>H ${Number(s.present_count||0)}</span><span>T ${Number(s.late_count||0)}</span><span>I ${Number(s.permit_count||0)}</span><span>S ${Number(s.sick_count||0)}</span><span>A ${Number(s.absent_count||0)}</span></div></div>`).join("")||'<div class="empty-wk">Belum ada kiriman absensi guru pada rentang ini.</div>'
}
function renderSummary(){
  const data=summarizeStudents();
  $("summaryInfo").textContent=`${data.length} siswa`;
  $("summaryBody").innerHTML=data.map((s,i)=>`<tr><td>${s.roll_number??i+1}</td><td><div class="student">${esc(s.full_name)}</div><div class="sub">NIS ${esc(s.nis||"-")} · NISN ${esc(s.nisn||"-")}</div></td><td class="num">${s.HADIR}</td><td class="num">${s.TERLAMBAT}</td><td class="num">${s.IZIN}</td><td class="num">${s.SAKIT}</td><td class="num">${s.ALFA}</td><td class="num">${s.total}</td></tr>`).join("")||'<tr><td colspan="8"><div class="empty-wk">Belum ada data.</div></td></tr>'
}
function renderAll(){renderStats();renderTeacherFilter();renderTeacherList();renderHistory();renderSummary()}

async function loadReport(){
  const start=$("startDate").value,end=$("endDate").value;
  if(!start||!end){alert("Pilih tanggal awal dan akhir.");return}
  if(end<start){alert("Tanggal akhir tidak boleh lebih kecil dari tanggal awal.");return}
  $("loadBtn").disabled=true;$("loadBtn").textContent="Memuat...";
  try{
    report=await api.db.rpc("get_my_homeroom_attendance",{p_start:start,p_end:end})||{students:[],class_teachers:[],submissions:[],records:[]};
    $("classChip").textContent=`${report.class_name||context.class_name} · ${(report.students||[]).length} siswa`;
    renderAll()
  }catch(err){alert("Gagal memuat rekap wali kelas: "+(err.message||err))}
  finally{$("loadBtn").disabled=false;$("loadBtn").textContent="Tampilkan"}
}

function csvCell(v){const s=String(v??"").replaceAll('"','""');return`"${s}"`}
function downloadCsv(filename,headers,rows){
  const sep=";";
  const text="sep=;\r\n"+headers.map(csvCell).join(sep)+"\r\n"+rows.map(r=>r.map(csvCell).join(sep)).join("\r\n");
  const blob=new Blob(["\ufeff",text],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500)
}
function safeName(v){return String(v||"kelas").replace(/[^\p{L}\p{N}]+/gu,"_").replace(/^_+|_+$/g,"")}

function downloadDetail(){
  const records=teacherFilteredRecords();
  if(!records.length){alert("Belum ada data detail untuk diunduh.");return}
  const rows=records.map(r=>[
    r.attendance_date,r.teacher_name,r.subject_names||"",r.schedule_slots||"",
    r.roll_number??"",r.full_name,r.nis||"",r.nisn||"",r.attendance_status,
    r.arrival_time||"",Number(r.late_minutes||0),r.note||""
  ]);
  downloadCsv(
    `Absensi_Semua_Guru_${safeName(report.class_name)}_${$("startDate").value}_${$("endDate").value}.csv`,
    ["Tanggal","Guru","Mata Pelajaran","Jam","No Urut","Nama Siswa","NIS","NISN","Status","Jam Datang","Terlambat (menit)","Catatan"],
    rows
  )
}
function downloadSummary(){
  const data=summarizeStudents();
  if(!data.length){alert("Belum ada data ringkasan untuk diunduh.");return}
  const rows=data.map(s=>[s.roll_number??"",s.full_name,s.nis||"",s.nisn||"",s.HADIR,s.TERLAMBAT,s.IZIN,s.SAKIT,s.ALFA,s.total]);
  downloadCsv(
    `Ringkasan_Absensi_${safeName(report.class_name)}_${$("startDate").value}_${$("endDate").value}.csv`,
    ["No Urut","Nama Siswa","NIS","NISN","Hadir","Terlambat","Izin","Sakit","Alfa","Total Catatan"],
    rows
  )
}

$("startDate").value=firstDayOfMonth();$("endDate").value=localISODate();
$("loadBtn").onclick=loadReport;
$("teacherFilter").onchange=renderAll;
$("downloadDetailBtn").onclick=downloadDetail;
$("downloadSummaryBtn").onclick=downloadSummary;
$("printBtn").onclick=()=>window.print();

(async()=>{
  try{
    api=await window.simanisReady;
    const sess=await api.auth.getSession();if(!sess){location.replace("index.html");return}
    const user=await api.auth.getUser();if(!user){location.replace("index.html");return}
    profile=await loadProfile(user);
    $("sideUserName").textContent=profile.full_name||user.email;$("sideUserRole").textContent=formatRole(profile.role);$("headerUser").textContent=profile.full_name||user.email;$("currentDate").textContent=localDateID();
    await loadMenu();

    context=await api.db.rpc("get_my_homeroom_context",{});
    if(!context?.has_homeroom){
      alert("Menu Wali Kelas hanya dapat dibuka oleh guru yang menjadi wali kelas aktif.");
      location.replace("dashboard.html");
      return
    }

    $("heroText").textContent=`${context.teacher_name||profile.full_name} · pantau absensi yang dikirim seluruh guru di kelas wali Anda.`;
    $("classChip").textContent=`${context.class_name} · ${Number(context.student_count||0)} siswa`;
    await loadReport();

    $("logoutBtn").onclick=async()=>{await api.auth.signOut();location.replace("index.html")}
  }catch(err){
    console.error(err);
    alert("Workspace Wali Kelas gagal dimuat: "+(err.message||err))
  }finally{
    $("loading").classList.add("hidden")
  }
})();