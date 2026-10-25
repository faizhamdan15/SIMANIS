const $ = id => document.getElementById(id);
let api, profile, rows = [];
const ADMIN_ROLES = ["SUPER_ADMIN","TU","WAKA_KURIKULUM"];

function esc(s){return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}
function formatRole(r){return (r||"-").replaceAll("_"," ")}
function localDateID(){return new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date())}
function todayYMD(){const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const o={};p.forEach(x=>o[x.type]=x.value);return `${o.year}-${o.month}-${o.day}`}
function formatTime(ts){if(!ts)return "-";return new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(ts))}
function routeFor(code){return {
  DASHBOARD:"dashboard.html",ADMINISTRASI_KEPALA:"administrasi.html",DATA_SISWA:"siswa.html",DATA_GURU:"guru.html",
  KELAS:"kelas.html",MATA_PELAJARAN:"mapel.html",JADWAL:"jadwal.html",ABSENSI_GURU:"absensi-guru.html",
  ABSENSI_SISWA:"absensi-siswa.html",NILAI:"nilai.html",PRESTASI:"prestasi.html",BERITA:"berita.html",
  PENGUMUMAN:"pengumuman.html",AGENDA:"agenda.html",KEUANGAN:"keuangan.html",
  PORTAL_WALI:"wali-admin.html",PENGATURAN:"pengaturan.html",PKM_KURIKULUM:"unit-kerja.html?unit=PKM_KURIKULUM",
  PKM_KESISWAAN:"unit-kerja.html?unit=PKM_KESISWAAN",PKM_BENDAHARA_SARPRAS:"unit-kerja.html?unit=PKM_BENDAHARA_SARPRAS",
  PKM_HUMASY:"unit-kerja.html?unit=PKM_HUMASY",KEPALA_TU:"unit-kerja.html?unit=KEPALA_TU",
  KALAB_IPA:"unit-kerja.html?unit=KALAB_IPA",KALAB_BISNIS:"unit-kerja.html?unit=KALAB_BISNIS"
}[code]||"#";}
const STAFF_WORK_DAYS=["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Ahad"];
let canEditStaffWork=false,staffWorkPanelReady=false;
function statusLabel(s){return {HADIR:"Hadir",TERLAMBAT:"Terlambat",IZIN:"Izin",SAKIT:"Sakit",DINAS:"Dinas",ALFA:"Alfa",BELUM_ABSEN:"Belum Absen",TIDAK_ADA_JADWAL:"Tidak Ada Jadwal"}[s]||s}
function isAdmin(){return ADMIN_ROLES.includes(profile?.role)}

async function loadProfile(user){const r=await api.db.select("profiles",`select=id,full_name,role,is_active,teacher_id&id=eq.${encodeURIComponent(user.id)}&limit=1`);if(!r?.[0])throw new Error("Profil pengguna tidak ditemukan.");if(!r[0].is_active)throw new Error("Akun tidak aktif.");return r[0]}

async function loadMenu(){const m=await api.db.rpc("get_my_modules",{});$("sidebarMenu").innerHTML=(m||[]).map(x=>`<a href="${routeFor(x.code)}" class="nav-item ${x.code==="ABSENSI_GURU"?"active":""}"><span class="nav-dot"></span><span>${esc(x.name)}</span></a>`).join("");document.querySelectorAll('.nav-item[href="#"]').forEach(a=>a.onclick=e=>{e.preventDefault();alert(`Modul "${a.textContent.trim()}" akan diaktifkan bertahap.`)})}

let attendanceLoading=false;
async function loadAttendance(){if(attendanceLoading)return;attendanceLoading=true;try{const d=$("attendanceDate").value;rows=await api.db.rpc("get_teacher_attendance_by_date",{p_date:d})||[];if(["GURU","WALI_KELAS"].includes(profile.role)&&profile.teacher_id){rows=rows.filter(r=>r.teacher_id===profile.teacher_id);$("scheduleFilter").value="ALL";$("scheduleFilter").disabled=true}
renderStats();render();$("dateCaption").textContent=`Data absensi tanggal ${new Intl.DateTimeFormat("id-ID",{dateStyle:"full",timeZone:"Asia/Jakarta"}).format(new Date(d+"T12:00:00+07:00"))}`;}catch(e){console.warn("Refresh absensi guru gagal:",e)}finally{attendanceLoading=false}}

function renderStats(){const scheduled=rows.filter(r=>r.has_schedule);$("statScheduled").textContent=scheduled.length;$("statPresent").textContent=scheduled.filter(r=>["HADIR","TERLAMBAT"].includes(r.attendance_status)).length;$("statExcused").textContent=scheduled.filter(r=>["IZIN","SAKIT","DINAS"].includes(r.attendance_status)).length;$("statMissing").textContent=scheduled.filter(r=>["BELUM_ABSEN","ALFA"].includes(r.attendance_status)).length}

// Daftar absensi menggunakan abjad nama, bukan kode pegawai dari RPC.
const attendanceNameCollator=new Intl.Collator("id-ID",{sensitivity:"base",numeric:true,ignorePunctuation:true});
function sortAttendanceByName(items){
 return [...items].sort((a,b)=>{
   const nameA=String(a.teacher_name||"").trim(),nameB=String(b.teacher_name||"").trim();
   const byName=attendanceNameCollator.compare(nameA,nameB);
   if(byName)return byName;
   const byCode=attendanceNameCollator.compare(String(a.teacher_code??""),String(b.teacher_code??""));
   return byCode||attendanceNameCollator.compare(String(a.teacher_id??""),String(b.teacher_id??""));
 });
}
function filtered(){
 const q=$("searchInput").value.trim().toLowerCase(),sf=$("scheduleFilter").value,st=$("statusFilter").value;
 const matching=rows.filter(r=>{
  const hay=`${r.teacher_code??""} ${r.teacher_name||""} ${r.schedule_detail||""}`.toLowerCase();
  return(!q||hay.includes(q))&&(sf==="ALL"||(sf==="SCHEDULED"&&r.has_schedule)||(sf==="NONE"&&!r.has_schedule))&&(!st||r.attendance_status===st);
 });
 return sortAttendanceByName(matching);
}

function actionHtml(r){const today=$("attendanceDate").value===todayYMD();let out=[];if(today&&r.has_schedule){if(r.attendance_status==="BELUM_ABSEN")out.push(`<button class="primary" data-checkin="${r.teacher_id}">Check In</button>`);if(["HADIR","TERLAMBAT"].includes(r.attendance_status)&&r.check_in&&!r.check_out)out.push(`<button class="primary" data-checkout="${r.teacher_id}">Check Out</button>`)}if(isAdmin())out.push(`<button data-manage="${r.teacher_id}">Kelola</button>`);return out.join("")||"-"}

function render(){const list=filtered();if(!list.length){$("attendanceBody").innerHTML='<tr><td colspan="9"><div class="empty-state">Tidak ada data yang cocok.</div></td></tr>';$("attendanceCards").innerHTML='<div class="empty-state">Tidak ada data yang cocok.</div>';return}
$("attendanceBody").innerHTML=list.map(r=>`<tr><td>${esc(r.teacher_code??"-")}</td><td><div class="att-name">${esc(r.teacher_name)}</div></td><td>${r.has_schedule?`<b>${String(r.scheduled_start).slice(0,5)}–${String(r.scheduled_end).slice(0,5)}</b><div class="muted-small">${esc(r.schedule_detail||"")}</div>`:"-"}</td><td><span class="att-status st-${r.attendance_status}">${statusLabel(r.attendance_status)}</span></td><td>${formatTime(r.check_in)}</td><td>${formatTime(r.check_out)}</td><td>${Number(r.late_minutes||0)>0?`${r.late_minutes} menit`:'-'}</td><td>${esc(r.note||"-")}</td><td><div class="att-actions">${actionHtml(r)}</div></td></tr>`).join("");
$("attendanceCards").innerHTML=list.map(r=>`<article class="att-card"><div class="att-card-head"><div><h4>${esc(r.teacher_name)}</h4><p>Kode ${esc(r.teacher_code??"-")} · ${r.has_schedule?`${String(r.scheduled_start).slice(0,5)}–${String(r.scheduled_end).slice(0,5)}`:"Tidak ada jadwal"}</p></div><span class="att-status st-${r.attendance_status}">${statusLabel(r.attendance_status)}</span></div><div class="att-card-grid"><div><b>Masuk</b><br>${formatTime(r.check_in)}</div><div><b>Pulang</b><br>${formatTime(r.check_out)}</div><div><b>Slot</b><br>${r.teaching_slots||0}</div><div><b>Terlambat</b><br>${r.late_minutes||0} menit</div></div>${r.schedule_detail?`<div class="attendance-note">${esc(r.schedule_detail)}</div>`:""}${r.note?`<div class="attendance-note"><b>Catatan:</b> ${esc(r.note)}</div>`:""}<div class="att-actions" style="margin-top:10px">${actionHtml(r)}</div></article>`).join("");
wireActions()}

function wireActions(){document.querySelectorAll("[data-checkin]").forEach(b=>b.onclick=()=>checkIn(b.dataset.checkin));document.querySelectorAll("[data-checkout]").forEach(b=>b.onclick=()=>checkOut(b.dataset.checkout));document.querySelectorAll("[data-manage]").forEach(b=>b.onclick=()=>openManage(b.dataset.manage))}

async function checkIn(id){try{await api.db.rpc("teacher_check_in",{p_teacher_id:id,p_method:isAdmin()?"ADMIN":"MANUAL",p_note:null});await loadAttendance()}catch(e){alert("Check-in gagal: "+e.message)}}
async function checkOut(id){try{await api.db.rpc("teacher_check_out",{p_teacher_id:id,p_method:isAdmin()?"ADMIN":"MANUAL",p_note:null});await loadAttendance()}catch(e){alert("Check-out gagal: "+e.message)}}

function openManage(id){const r=rows.find(x=>x.teacher_id===id);if(!r)return;$("teacherId").value=id;$("modalDate").value=$("attendanceDate").value;$("teacherInfo").textContent=`${r.teacher_name} · ${r.has_schedule?`Jadwal ${String(r.scheduled_start).slice(0,5)}–${String(r.scheduled_end).slice(0,5)}`:"Tidak ada jadwal kerja/mengajar"}`;$("attendanceStatus").value=["BELUM_ABSEN","TIDAK_ADA_JADWAL"].includes(r.attendance_status)?(r.has_schedule?"HADIR":"DINAS"):r.attendance_status;$("checkInTime").value=r.check_in?formatTime(r.check_in).replace('.',':'):"";$("checkOutTime").value=r.check_out?formatTime(r.check_out).replace('.',':'):"";$("attendanceNote").value=r.note||"";$("formMessage").textContent="";toggleTimeFields();$("attendanceModal").classList.remove("hidden")}
function closeModal(){$("attendanceModal").classList.add("hidden")}
function toggleTimeFields(){const noTime=["IZIN","SAKIT","DINAS","ALFA"].includes($("attendanceStatus").value);$("checkInTime").disabled=noTime;$("checkOutTime").disabled=noTime;if(noTime){$("checkInTime").value="";$("checkOutTime").value=""}}

async function saveAttendance(e){e.preventDefault();const btn=$("saveBtn");btn.disabled=true;btn.textContent="Menyimpan...";try{await api.db.rpc("save_teacher_attendance_admin",{p_teacher_id:$("teacherId").value,p_date:$("modalDate").value,p_status:$("attendanceStatus").value,p_note:$("attendanceNote").value.trim()||null,p_check_in_time:$("checkInTime").value||null,p_check_out_time:$("checkOutTime").value||null});closeModal();await loadAttendance()}catch(err){$("formMessage").textContent="Gagal menyimpan: "+err.message}finally{btn.disabled=false;btn.textContent="Simpan"}}
async function clearAttendance(){if(!confirm("Hapus catatan absensi guru ini?"))return;try{const ok=await api.db.rpc("clear_teacher_attendance_admin",{p_teacher_id:$("teacherId").value,p_date:$("modalDate").value});closeModal();await loadAttendance();if(!ok)alert("Tidak ada catatan tersimpan yang perlu dihapus.")}catch(e){alert("Gagal menghapus: "+e.message)}}


function staffWorkStatus(message,error=false){
 const el=$("staffWorkStatus");
 el.textContent=message;el.style.color=error?"#af3226":"#176044";
}
function buildStaffWorkDays(){
 $("staffWorkDays").innerHTML=STAFF_WORK_DAYS.map((day,i)=>{
   const d=i+1;
   return '<div class="staff-work-row" data-workday="'+d+'">'+
     '<label><input type="checkbox" data-work-enabled="'+d+'"> '+day+'</label>'+
     '<input type="time" data-work-start="'+d+'" aria-label="Jam masuk '+day+'" disabled>'+
     '<input type="time" data-work-end="'+d+'" aria-label="Jam pulang '+day+'" disabled>'+
     '<input type="text" maxlength="150" data-work-note="'+d+'" placeholder="Catatan kerja (opsional)" aria-label="Catatan '+day+'" disabled>'+
     '</div>';
 }).join("");
 document.querySelectorAll("[data-work-enabled]").forEach(input=>{
   input.onchange=()=>setWorkDayEnabled(Number(input.dataset.workEnabled),input.checked);
 });
}
function workEl(day,kind){
 return document.querySelector('[data-work-'+kind+'="'+day+'"]');
}
function setWorkDayEnabled(day,enabled){
 const box=workEl(day,"enabled");
 if(box)box.checked=enabled;
 for(const kind of ["start","end","note"]){
   const element=workEl(day,kind);
   element.disabled=!enabled;
 }
}
function setWorkDaysRange(endDay){
 for(let day=1;day<=7;day++)setWorkDayEnabled(day,day<=endDay);
 staffWorkStatus("Pilihan hari berubah. Tentukan jam masuk dan pulang, lalu simpan.");
}
// Kebijakan madrasah: TU bekerja Sabtu–Kamis, Jumat libur, pukul 07.00–12.30 WIB.
// Preset hanya mengisi form. TIDAK menyimpan tanpa persetujuan dan pilihan staf dari admin.
function setTuDefaultSchedule(){
  for(let day=1;day<=7;day++){
    const workday=day!==5;
    setWorkDayEnabled(day,workday);
    workEl(day,"start").value=workday?"07:00":"";
    workEl(day,"end").value=workday?"12:30":"";
    if(!workday)workEl(day,"note").value="";
  }
  $("staffBulkStart").value="07:00";
  $("staffBulkEnd").value="12:30";
  staffWorkStatus("Pola standar TU disiapkan: Sabtu–Kamis 07.00–12.30; Jumat libur. Belum disimpan — pilih staf, periksa, lalu klik Simpan Jadwal Kerja.");
}
async function loadStaffWorkSchedule(){
 const id=$("staffWorkTeacher").value,selectedDate=$("staffWorkFrom").value;
 for(let day=1;day<=7;day++){
   setWorkDayEnabled(day,false);
   for(const kind of ["start","end","note"])workEl(day,kind).value="";
 }
 if(!id){staffWorkStatus("Pilih staf terlebih dahulu.");return}
 if(!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)){staffWorkStatus("Isi tanggal mulai berlaku.",true);return}
 try{
   const records=await api.db.select("staff_work_schedules",
     "select=day_of_week,start_time,end_time,effective_from,effective_until,note"+
     "&teacher_id=eq."+encodeURIComponent(id)+"&order=effective_from.desc&limit=250")||[];
   const active=new Map();
   // Data historis dipertahankan oleh backend; tampilkan versi yang berlaku saat tanggal dipilih.
   for(const r of records){
     if(r.effective_from>selectedDate)continue;
     if(r.effective_until&&r.effective_until<selectedDate)continue;
     if(!active.has(Number(r.day_of_week)))active.set(Number(r.day_of_week),r);
   }
   for(const [day,r] of active){
     if(day<1||day>7)continue;
     setWorkDayEnabled(day,true);
     workEl(day,"start").value=String(r.start_time||"").slice(0,5);
     workEl(day,"end").value=String(r.end_time||"").slice(0,5);
     workEl(day,"note").value=r.note||"";
   }
   if(active.size===0){
     setTuDefaultSchedule();
   }else{
     staffWorkStatus(active.size+" hari kerja berlaku pada tanggal terpilih. Jumat/hari tanpa jadwal tidak dihitung alfa.");
   }
 }catch(err){staffWorkStatus("Gagal mengambil jadwal: "+err.message,true)}
}
async function saveStaffWorkSchedule(){
 if(!canEditStaffWork)return;
 const teacherId=$("staffWorkTeacher").value,from=$("staffWorkFrom").value;
 if(!teacherId){staffWorkStatus("Pilih staf yang akan dijadwalkan.",true);return}
 if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||from<todayYMD()){
   staffWorkStatus("Tanggal mulai berlaku harus hari ini atau tanggal mendatang (WIB).",true);return
 }
 const days=[];
 for(let day=1;day<=7;day++){
   if(!workEl(day,"enabled").checked)continue;
   const start=workEl(day,"start").value,end=workEl(day,"end").value,note=workEl(day,"note").value.trim();
   if(!start||!end||end<=start){
     staffWorkStatus(STAFF_WORK_DAYS[day-1]+": jam masuk harus lebih awal dari jam pulang.",true);return
   }
   if(note.length>150){staffWorkStatus("Catatan maksimal 150 karakter.",true);return}
   days.push({day_of_week:day,start_time:start,end_time:end,note});
 }
 if(!days.length&&!confirm("Semua hari kerja akan dinonaktifkan mulai "+from+". Lanjutkan?"))return;
 if(!confirm("Simpan "+days.length+" hari kerja untuk staf terpilih mulai "+from+"? Riwayat sebelum tanggal tersebut akan tetap berlaku."))return;
 const btn=$("staffWorkSave");btn.disabled=true;btn.textContent="Menyimpan...";
 try{
   const count=await api.db.rpc("set_staff_work_schedule",{
     p_teacher_id:teacherId,p_effective_from:from,p_days:days
   });
   staffWorkStatus("Jadwal kerja berhasil disimpan ("+count+" hari). Absensi mengikuti jadwal baru sejak "+from+".");
   await loadAttendance();
 }catch(err){staffWorkStatus("Gagal menyimpan jadwal kerja: "+err.message,true)}
 finally{btn.disabled=false;btn.textContent="Simpan Jadwal Kerja"}
}
function applyBulkStaffHours(){
 const start=$("staffBulkStart").value,end=$("staffBulkEnd").value;
 if(!start||!end||end<=start){staffWorkStatus("Isi jam masuk dan pulang yang valid terlebih dahulu.",true);return}
 let applied=0;
 for(let day=1;day<=7;day++){
   if(!workEl(day,"enabled").checked)continue;
   workEl(day,"start").value=start;
   workEl(day,"end").value=end;
   applied++;
 }
 staffWorkStatus(applied+" hari terpilih menggunakan jam "+start+"–"+end+". Klik Simpan Jadwal Kerja untuk mengaktifkan.");
}
async function initStaffWorkPanel(){
 const btn=$("staffWorkToggle");
 const hint=$("staffWorkAccessHint");
 // Tombol tampak sejak HTML dimuat. Hak untuk MENYIMPAN tetap diperiksa oleh RPC Supabase.
 btn.textContent="Atur Jadwal Kerja TU";
 btn.setAttribute("aria-expanded","false");
 canEditStaffWork=isAdmin();
 if(!canEditStaffWork){
   // Akun dasar GURU bisa saja merangkap Kepala TU.
   try{
     canEditStaffWork=(await api.db.rpc("has_staff_position",{p_position_code:"KEPALA_TU"}))===true;
   }catch(error){
     console.warn("Izin jabatan Kepala TU belum terbaca:",error?.message||error);
   }
 }
 if(!canEditStaffWork){
   const role=formatRole(profile?.role);
   const message="Akun aktif berperan "+role+". Mengatur jadwal kerja membutuhkan akun Super Admin, TU, Waka Kurikulum, atau jabatan Kepala TU. Silakan masuk dengan akun tersebut atau minta Super Admin memberikan hak yang tepat.";
   btn.textContent="🔒 Atur Jadwal Kerja TU";
   hint.textContent="Pengaturan hanya untuk Super Admin/Kepala TU. Klik tombol untuk keterangan.";
   btn.onclick=()=>{hint.textContent=message;alert(message)};
   return;
 }
 hint.textContent="Akses pengelola terverifikasi. Klik tombol untuk memilih staf dan menerapkan jadwal Sabtu–Kamis 07.00–12.30 (Jumat libur).";
 buildStaffWorkDays();
 $("staffWorkFrom").min=todayYMD();
 $("staffWorkFrom").value=todayYMD();
 $("staffWorkTeacher").onchange=loadStaffWorkSchedule;
 $("staffWorkFrom").onchange=loadStaffWorkSchedule;
 $("staffDaysTu").onclick=setTuDefaultSchedule;
 $("staffDaysSix").onclick=()=>setWorkDaysRange(6);
 $("staffDaysSeven").onclick=()=>setWorkDaysRange(7);
 $("staffDaysClear").onclick=()=>setWorkDaysRange(0);
 $("staffApplyHours").onclick=applyBulkStaffHours;
 $("staffWorkSave").onclick=saveStaffWorkSchedule;
 btn.onclick=async()=>{
   const panel=$("staffWorkPanel");
   panel.classList.toggle("hidden");
   const isOpen=!panel.classList.contains("hidden");
   btn.setAttribute("aria-expanded",String(isOpen));
   hint.textContent=isOpen?
      "Pilih staf, periksa enam hari kerja (Jumat libur), lalu Simpan Jadwal Kerja.":
      "Panel jadwal TU ditutup. Klik tombol untuk membuka kembali.";
   if(!isOpen)return;
   if(!staffWorkPanelReady){
     try{
       const staff=await api.db.select("teachers","select=id,full_name,teacher_code&is_active=eq.true&order=full_name.asc&limit=250");
       $("staffWorkTeacher").innerHTML='<option value="">Pilih guru atau staf...</option>'+
         (staff||[]).map(x=>'<option value="'+esc(x.id)+'">'+esc(x.full_name)+
         (x.teacher_code!=null?" · "+esc(x.teacher_code):"")+'</option>').join("");
       staffWorkPanelReady=true;
       if(!staff?.length)staffWorkStatus("Belum ada data staf yang dapat dipilih. Hubungi Super Admin untuk memastikan akun punya akses data staf.",true);
     }catch(e){staffWorkStatus("Gagal memuat daftar staf: "+e.message,true)}
   }
 };
}


// Rekap absensi bulanan (baca saja). Angka berdasarkan RPC pengelola terautentikasi,
// memakai definisi hari terjadwal yang sama dengan tampilan Absensi Guru harian.
const MONTHLY_RECAP_COUNT_FIELDS=[
 "scheduled_days","present_days","late_days","leave_days","sick_days",
 "duty_days","absence_days","automatic_absence_days","pending_days",
 "recorded_days","total_late_minutes"
];
let monthlyRecapRows=[],monthlyRecapKey="",monthlyRecapLoading=false,monthlyRecapDownloadUrl=null;
function recapNum(value){const n=Number(value);return Number.isFinite(n)&&n>=0?n:0}
function recapMonthLabel(key){
 const [year,month]=String(key).split("-").map(Number);
 return new Intl.DateTimeFormat("id-ID",{month:"long",year:"numeric",timeZone:"Asia/Jakarta"})
  .format(new Date(Date.UTC(year,month-1,15)));
}
function recapTotals(data){
 const totals={};
 for(const field of MONTHLY_RECAP_COUNT_FIELDS){
  totals[field]=data.reduce((sum,row)=>sum+recapNum(row[field]),0);
 }
 totals.teacher_count=data.length;
 totals.attendance_rate=totals.scheduled_days?
  Math.round((totals.present_days+totals.late_days)*1000/totals.scheduled_days)/10:0;
 return totals;
}
function recapPercent(row){
 if(!recapNum(row.scheduled_days))return "—";
 return recapNum(row.attendance_rate).toLocaleString("id-ID",{maximumFractionDigits:1,minimumFractionDigits:1})+"%";
}
function recapMessage(message,isError=false){
 const el=$("monthlyRecapStatus");
 el.textContent=message;el.style.color=isError?"#a32b27":"#276242";
}
function recapSorted(data){
 return [...data].sort((a,b)=>
  attendanceNameCollator.compare(String(a.teacher_name||"").trim(),String(b.teacher_name||"").trim())||
  attendanceNameCollator.compare(String(a.teacher_code??""),String(b.teacher_code??""))||
  attendanceNameCollator.compare(String(a.teacher_id??""),String(b.teacher_id??"")));
}
function recapVisibleRows(){
 const q=$("monthlyRecapSearch").value.trim().toLowerCase();
 if(!q)return monthlyRecapRows;
 return monthlyRecapRows.filter(x=>String(x.teacher_name||"").toLowerCase().includes(q)||
  String(x.teacher_code??"").toLowerCase().includes(q));
}
function recapCell(value,className=""){
 return '<td'+(className?' class="'+className+'"':'')+'>'+esc(value)+'</td>';
}
function monthlyRecapTableRow(row,no){
 const auto=recapNum(row.automatic_absence_days);
 return "<tr>"+recapCell(no)+recapCell(row.teacher_name||"-")+recapCell(row.teacher_code??"-")+
  MONTHLY_RECAP_COUNT_FIELDS.map(field=>recapCell(recapNum(row[field]),field==="automatic_absence_days"&&auto?"month-warn":"")).join("")+
  recapCell(recapPercent(row))+"</tr>";
}
function monthlyRecapFooter(totals){
 return '<tr class="month-total">'+recapCell("Σ")+recapCell("TOTAL SELURUH GURU / STAF")+
  recapCell("-")+MONTHLY_RECAP_COUNT_FIELDS.map(field=>recapCell(totals[field])).join("")+
  recapCell(totals.scheduled_days?totals.attendance_rate.toLocaleString("id-ID",{minimumFractionDigits:1,maximumFractionDigits:1})+"%":"—")+"</tr>";
}
function renderMonthlyRecap(){
 if(!monthlyRecapKey)return;
 const shown=recapVisibleRows(),totals=recapTotals(monthlyRecapRows);
 $("monthlyRecapTeachers").textContent=totals.teacher_count;
 $("monthlyRecapScheduled").textContent=totals.scheduled_days;
 $("monthlyRecapPresent").textContent=totals.present_days+totals.late_days;
 $("monthlyRecapAutoAlfa").textContent=totals.automatic_absence_days;
 $("monthlyRecapBody").innerHTML=shown.length?shown.map((r,i)=>monthlyRecapTableRow(r,i+1)).join(""):
  '<tr><td colspan="15" style="text-align:center;padding:20px">Nama atau kode guru tidak ditemukan.</td></tr>';
 $("monthlyRecapFooter").innerHTML=monthlyRecapFooter(totals);
 $("monthlyRecapResult").classList.remove("hidden");
 $("monthlyRecapDownload").disabled=false;
 $("monthlyRecapPrint").disabled=false;
 recapMessage("Rekap "+recapMonthLabel(monthlyRecapKey)+": "+shown.length+" dari "+totals.teacher_count+
   " guru/staf ditampilkan. Unduhan selalu mencakup SELURUH guru/staf. "+
   (totals.automatic_absence_days>0?"⚠ "+totals.automatic_absence_days+" hari Alfa otomatis belum diverifikasi; jangan dianggap ketidakhadiran pasti. ":"")+
   "Data sampai hari ini (WIB).");
}
function invalidateMonthlyRecap(){
 monthlyRecapRows=[];monthlyRecapKey="";
 $("monthlyRecapResult").classList.add("hidden");
 $("monthlyRecapDownload").disabled=true;$("monthlyRecapPrint").disabled=true;
 clearMonthlyRecapLink();
 recapMessage("Bulan berubah. Klik Tampilkan Rekap untuk menghitung ulang data.");
}
async function loadMonthlyRecap(){
 const key=$("monthlyRecapMonth").value;
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(key)){
  recapMessage("Pilih bulan dan tahun yang valid.",true);return;
 }
 if(monthlyRecapLoading)return;
 monthlyRecapLoading=true;
 const btn=$("monthlyRecapLoad");btn.disabled=true;btn.textContent="Memuat Rekap...";
 invalidateMonthlyRecap();
 recapMessage("Menghitung rekap "+recapMonthLabel(key)+" dari jadwal dan catatan absensi...");
 try{
  const [year,month]=key.split("-").map(Number);
  const records=await api.db.rpc("get_teacher_attendance_monthly_summary",{p_year:year,p_month:month});
  if(!Array.isArray(records))throw Error("Format data rekap tidak valid.");
  monthlyRecapRows=recapSorted(records);
  monthlyRecapKey=key;
  renderMonthlyRecap();
 }catch(error){recapMessage("Gagal memuat rekap: "+(error.message||error),true)}
 finally{monthlyRecapLoading=false;btn.disabled=false;btn.textContent="Tampilkan Rekap"}
}
function recapCsvCell(value){
 let safe=String(value??"").replace(/[\r\n\u0000]+/g," ").trim();
 if(/^[\s]*[=+\-@]/.test(safe))safe="'"+safe;
 return '"'+safe.replaceAll('"','""')+'"';
}
function recapCsvRows(){
 const headers=["No","Nama Guru / Staf","Kode Guru","Hari Terjadwal",
  "Hadir","Terlambat","Izin","Sakit","Dinas","Alfa Total",
  "Alfa Otomatis (Bagian dari Alfa)","Belum Absen","Presensi Tercatat",
  "Jumlah Menit Terlambat","Persentase Kehadiran (%)"];
 const result=[headers];
 monthlyRecapRows.forEach((a,i)=>result.push([
  i+1,a.teacher_name||"",a.teacher_code??"",
  ...MONTHLY_RECAP_COUNT_FIELDS.map(field=>recapNum(a[field])),
  recapNum(a.scheduled_days)?recapNum(a.attendance_rate):""
 ]));
 const totals=recapTotals(monthlyRecapRows);
 result.push(["","TOTAL SELURUH GURU / STAF","",
  ...MONTHLY_RECAP_COUNT_FIELDS.map(field=>totals[field]),
  totals.scheduled_days?totals.attendance_rate:""]);
 result.push(["CATATAN","Alfa otomatis merupakan bagian dari Alfa total dan perlu verifikasi.",""]);
 result.push(["CATATAN","Tanggal mendatang dan hari tanpa jadwal tidak dihitung.",""]);
 return result;
}
function clearMonthlyRecapLink(){
 if(monthlyRecapDownloadUrl){
  URL.revokeObjectURL(monthlyRecapDownloadUrl);
  monthlyRecapDownloadUrl=null;
 }
 const a=$("monthlyRecapManualDownload");
 if(a){a.removeAttribute("href");a.classList.add("hidden")}
}
function downloadMonthlyRecap(){
 if(!monthlyRecapKey || $("monthlyRecapMonth").value!==monthlyRecapKey || monthlyRecapLoading){
  recapMessage("Tampilkan rekap bulan yang dipilih terlebih dahulu.",true);return;
 }
 clearMonthlyRecapLink();
 const csv="\ufeff"+recapCsvRows().map(row=>row.map(recapCsvCell).join(",")).join("\r\n");
 monthlyRecapDownloadUrl=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
 const a=$("monthlyRecapManualDownload");
 a.href=monthlyRecapDownloadUrl;
 a.download="rekap-absensi-guru-staf-"+monthlyRecapKey+".csv";
 a.classList.remove("hidden");
 a.click();
 recapMessage("CSV seluruh "+monthlyRecapRows.length+" guru/staf disiapkan. Jika tidak otomatis terunduh, tekan tautan 'Klik di sini untuk unduh manual'. Simpan berkas secara aman.");
}
function printMonthlyRecap(){
 if(!monthlyRecapKey || $("monthlyRecapMonth").value!==monthlyRecapKey){
  recapMessage("Tampilkan rekap bulan yang dipilih terlebih dahulu.",true);return;
 }
 const w=window.open("","_blank");
 if(!w){recapMessage("Browser memblokir jendela cetak. Izinkan pop-up SIMANIS atau gunakan CSV.",true);return}
 const totals=recapTotals(monthlyRecapRows);
 const rows=monthlyRecapRows.map((r,i)=>monthlyRecapTableRow(r,i+1)).join("");
 const html='<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Rekap Absensi Guru '+esc(recapMonthLabel(monthlyRecapKey))+'</title>'+
  '<style>@page{size:A4 landscape;margin:12mm}body{font:9px Arial,sans-serif;color:#182e23;margin:0}h2{margin:0 0 3px;font-size:16px;color:#13563b}p{margin:2px 0 10px}table{border-collapse:collapse;width:100%;font-size:8px}th,td{border:1px solid #b9cfc1;padding:4px 3px;text-align:right}th{background:#edf4ef}th:nth-child(2),td:nth-child(2){text-align:left}.month-total{font-weight:bold;background:#ecf3ef}.month-warn{color:#9c4921}.note{font-size:8px;margin-top:10px;line-height:1.5}thead{display:table-header-group}tr{break-inside:avoid}</style></head><body>'+
  '<h2>REKAP ABSENSI GURU &amp; STAF — MA NURUL ISLAM</h2><p>Periode: '+esc(recapMonthLabel(monthlyRecapKey))+
  ' | Guru/staf: '+totals.teacher_count+' | Hari terjadwal: '+totals.scheduled_days+
  ' | Hadir + Terlambat: '+(totals.present_days+totals.late_days)+'</p>'+
  '<table><thead><tr>'+["No.","Nama Guru / Staf","Kode","Jadwal","Hadir","Telat","Izin","Sakit","Dinas","Alfa","Alfa Otomatis*","Belum","Tercatat","Menit Telat","Kehadiran"].map(x=>'<th>'+esc(x)+'</th>').join("")+
  '</tr></thead><tbody>'+rows+'</tbody><tfoot>'+monthlyRecapFooter(totals)+'</tfoot></table>'+
  '<p class="note">*Alfa otomatis termasuk dalam total Alfa, yaitu hari terjadwal tanpa catatan absensi; perlu diverifikasi. Hari tanpa jadwal dan tanggal mendatang tidak dihitung. Persentase hadir = (hadir + terlambat) / hari terjadwal.</p>'+
  '</body></html>';
 w.document.open();w.document.write(html);w.document.close();w.focus();
 let printed=false;
 const startPrint=()=>{if(printed)return;printed=true;try{w.print()}catch(e){console.warn("Gagal membuka dialog cetak:",e)}};
 w.addEventListener("load",startPrint,{once:true});
 // Beberapa browser sudah menuntaskan load sebelum listener dipasang.
 setTimeout(startPrint,500);
 recapMessage("Jendela cetak dibuka. Pilih 'Simpan sebagai PDF' pada opsi tujuan printer, atau cetak langsung.");
}
async function initMonthlyRecap(){
 const btn=$("monthlyRecapToggle");
 $("monthlyRecapMonth").value=todayYMD().slice(0,7);
 $("monthlyRecapMonth").max=todayYMD().slice(0,7);
 $("monthlyRecapMonth").onchange=invalidateMonthlyRecap;
 $("monthlyRecapSearch").oninput=renderMonthlyRecap;
 $("monthlyRecapLoad").onclick=loadMonthlyRecap;
 $("monthlyRecapDownload").onclick=downloadMonthlyRecap;
 $("monthlyRecapPrint").onclick=printMonthlyRecap;
 window.addEventListener("pagehide",clearMonthlyRecapLink);
 const allow=["SUPER_ADMIN","TU","WAKA_KURIKULUM","KEPALA_MADRASAH","WAKA_KESISWAAN"].includes(profile?.role)||
  canEditStaffWork;
 if(!allow){
  btn.textContent="🔒 Rekap Absensi Bulanan";
  btn.onclick=()=>alert("Rekap seluruh guru/staf hanya dapat dibuka oleh pengelola absensi (Super Admin, Kepala Madrasah, TU, Waka, atau Kepala TU).");
  return;
 }
 btn.onclick=()=>{
  const panel=$("monthlyRecapPanel");panel.classList.toggle("hidden");
  const opened=!panel.classList.contains("hidden");
  btn.setAttribute("aria-expanded",String(opened));
  if(opened&&!monthlyRecapKey)recapMessage("Pilih bulan dan tahun, lalu klik Tampilkan Rekap.");
 };
}

$("attendanceDate").value=todayYMD();
$("attendanceDate").onchange=loadAttendance;$("searchInput").oninput=render;$("scheduleFilter").onchange=render;$("statusFilter").onchange=render;$("attendanceStatus").onchange=toggleTimeFields;$("closeModalBtn").onclick=closeModal;$("cancelBtn").onclick=closeModal;$("attendanceForm").onsubmit=saveAttendance;$("clearBtn").onclick=clearAttendance;$("attendanceModal").onclick=e=>{if(e.target===$("attendanceModal"))closeModal()};

(async function boot(){try{api=await window.simanisReady;const session=await api.auth.getSession();if(!session){location.replace("index.html");return}const user=await api.auth.getUser();if(!user){location.replace("index.html");return}profile=await loadProfile(user);$("sideUserName").textContent=profile.full_name||user.email||"Pengguna";$("sideUserRole").textContent=formatRole(profile.role);$("headerUser").textContent=profile.full_name||user.email||"Pengguna";$("currentDate").textContent=localDateID();if(!isAdmin()){$("clearBtn").classList.add("hidden")}await initStaffWorkPanel();await initMonthlyRecap();await loadMenu();await loadAttendance();setInterval(()=>{if(document.visibilityState==="visible"&&$("attendanceDate").value===todayYMD())loadAttendance()},5000);$("logoutBtn").onclick=async()=>{await api.auth.signOut();location.replace("index.html")}}catch(err){console.error(err);alert("Absensi Guru gagal dimuat: "+(err.message||err))}finally{$("loading").classList.add("hidden")}})();
