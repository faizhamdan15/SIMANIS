const $=id=>document.getElementById(id);
let api,profile,context=null,report={students:[],class_teachers:[],submissions:[],records:[]};
let gradeLedger=[],gradeSubjects=[];
function gradeObj(r){const x=r?.subject_scores;return x&&typeof x==="object"&&!Array.isArray(x)?x:{}}
function gradeKeys(){const m=new Map();gradeLedger.forEach(r=>Object.keys(gradeObj(r)).forEach(k=>m.set(k,k)));return [...m.keys()]}
function gradeVal(r,k){return gradeObj(r)[k]??null}
function gradeFmt(v){return v===null||v===undefined||v===""?"-":Number(v).toLocaleString("id-ID",{maximumFractionDigits:2})}
function renderGradeLedger(){const h=$("gradeHead"),b=$("gradeBody"),s=$("gradeSummary");if(!gradeLedger.length){h.innerHTML="";b.innerHTML='<tr><td><div class="wk-grade-empty">Belum ada data nilai untuk kelas ini.</div></td></tr>';s.innerHTML="";return}gradeSubjects=gradeKeys();h.innerHTML='<tr><th>No</th><th class="student">Siswa</th>'+gradeSubjects.map(k=>'<th>'+esc(k)+'</th>').join("")+'<th>Rata-rata</th><th>Kelengkapan</th></tr>';b.innerHTML=gradeLedger.map((r,i)=>{const complete=Number(r.complete_subjects||0),pct=gradeSubjects.length?Math.round(complete/gradeSubjects.length*100):0;return '<tr><td>'+(r.roll_number??i+1)+'</td><td class="student"><b>'+esc(r.full_name||"-")+'</b><span>NIS '+esc(r.nis||"-")+' · NISN '+esc(r.nisn||"-")+'</span></td>'+gradeSubjects.map(k=>{const v=gradeVal(r,k);return '<td class="wk-grade-score '+(v==null?"empty":"")+'">'+gradeFmt(v)+'</td>'}).join("")+'<td class="wk-grade-avg">'+gradeFmt(r.overall_average)+'</td><td><span class="'+(pct>=100?"wk-grade-complete":"wk-grade-incomplete")+'">'+complete+'/'+gradeSubjects.length+' · '+pct+'%</span></td></tr>'}).join("");const completeStudents=gradeLedger.filter(r=>gradeSubjects.length&&Number(r.complete_subjects||0)>=gradeSubjects.length).length;s.innerHTML='<span>'+gradeLedger.length+' siswa</span><span>'+gradeSubjects.length+' mata pelajaran</span><span>'+gradeLedger.filter(r=>Number(r.complete_subjects||0)>0).length+' siswa sudah punya nilai</span><span>'+completeStudents+' lengkap semua mapel</span>';$("gradeInfo").textContent=gradeSubjects.length+' mata pelajaran · nilai guru mapel tampil otomatis · '+gradeLedger.length+' siswa'}
async function loadGradeLedger(){try{gradeLedger=await api.db.rpc("get_homeroom_pts_ledger",{p_class_id:context.class_id})||[];renderGradeLedger()}catch(e){console.error(e);$("gradeInfo").textContent="Rekap nilai gagal dimuat";$("gradeBody").innerHTML='<tr><td><div class="wk-grade-empty">'+esc(e.message||e)+'</div></td></tr>'}}
function exportGradeExcel(){if(!gradeLedger.length){alert("Belum ada data nilai.");return}const rows=gradeLedger.map((r,i)=>'<tr><td>'+(r.roll_number??i+1)+'</td><td>'+esc(r.full_name||"")+'</td><td>'+esc(r.nis||"")+'</td><td>'+esc(r.nisn||"")+'</td>'+gradeSubjects.map(k=>{const v=gradeVal(r,k);return '<td>'+(v==null?"":Number(v))+'</td>'}).join("")+'<td>'+(r.overall_average==null?"":Number(r.overall_average))+'</td><td>'+Number(r.complete_subjects||0)+'/'+gradeSubjects.length+'</td></tr>').join(""),doc='<!doctype html><html><body><table><tr><th colspan="'+(6+gradeSubjects.length)+'">MA NURUL ISLAM KARANGCEMPAKA — REKAP NILAI KELAS</th></tr><tr><td colspan="'+(6+gradeSubjects.length)+'">Kelas: '+esc(context.class_name||"-")+'</td></tr><tr><th>No</th><th>Nama Siswa</th><th>NIS</th><th>NISN</th>'+gradeSubjects.map(k=>'<th>'+esc(k)+'</th>').join("")+'<th>Rata-rata</th><th>Kelengkapan</th></tr>'+rows+'</table></body></html>',u=URL.createObjectURL(new Blob(["\uFEFF",doc],{type:"application/vnd.ms-excel"})),a=document.createElement("a");a.href=u;a.download="Rekap_Nilai_"+safeName(context.class_name)+".xls";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),500)}
function printGradeLedger(){if(!gradeLedger.length){alert("Belum ada data nilai.");return}const w=window.open("","_blank");if(!w){alert("Popup diblokir browser.");return}const rows=gradeLedger.map((r,i)=>'<tr><td>'+(r.roll_number??i+1)+'</td><td>'+esc(r.full_name||"-")+'</td>'+gradeSubjects.map(k=>'<td>'+gradeFmt(gradeVal(r,k))+'</td>').join("")+'<td>'+gradeFmt(r.overall_average)+'</td><td>'+Number(r.complete_subjects||0)+'/'+gradeSubjects.length+'</td></tr>').join("");w.document.write('<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial;padding:10mm}h2{text-align:center;font-size:15pt}p{text-align:center;font-size:9pt}table{width:100%;border-collapse:collapse;font-size:7.5pt}th,td{border:1px solid #bbb;padding:2mm;text-align:center}th{background:#f2f7f4}@page{size:A4 landscape;margin:8mm}</style></head><body><h2>REKAP NILAI KELAS</h2><p>MA Nurul Islam Karangcempaka · '+esc(context.class_name||"-")+' · Wali Kelas: '+esc(context.teacher_name||profile.full_name||"-")+'</p><table><thead><tr><th>No</th><th>Siswa</th>'+gradeSubjects.map(k=>'<th>'+esc(k)+'</th>').join("")+'<th>Rata-rata</th><th>Lengkap</th></tr></thead><tbody>'+rows+'</tbody></table><script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>');w.document.close()}


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
$("printBtn").onclick=()=>window.print();$("downloadGradeExcelBtn").onclick=exportGradeExcel;$("printGradeBtn").onclick=printGradeLedger;

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
    await loadGradeLedger();

    $("logoutBtn").onclick=async()=>{await api.auth.signOut();location.replace("index.html")}
  }catch(err){
    console.error(err);
    alert("Workspace Wali Kelas gagal dimuat: "+(err.message||err))
  }finally{
    $("loading").classList.add("hidden")
  }
})();