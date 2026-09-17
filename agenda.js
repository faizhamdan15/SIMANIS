const $=id=>document.getElementById(id);
let api,profile,rows=[],classes=[],modulePerm={can_view:false,can_create:false,can_update:false,can_delete:false};

let viewDate=new Date();
viewDate=new Date(viewDate.getFullYear(),viewDate.getMonth(),1);
let selectedDateKey=null;

function esc(s){return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}
function formatRole(r){return (r||"-").replaceAll("_"," ")}
function localDateID(){return new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date())}
function routeFor(code){return {DASHBOARD:"dashboard.html",ADMINISTRASI_KEPALA:"administrasi.html",DATA_SISWA:"siswa.html",DATA_GURU:"guru.html",KELAS:"kelas.html",MATA_PELAJARAN:"mapel.html",JADWAL:"jadwal.html",ABSENSI_GURU:"absensi-guru.html",ABSENSI_SISWA:"absensi-siswa.html",NILAI:"nilai.html",PRESTASI:"prestasi.html",BERITA:"berita.html",PENGUMUMAN:"pengumuman.html",AGENDA:"agenda.html"}[code]||"#"}
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
  const current=(m||[]).find(x=>x.code==="AGENDA");
  if(current)modulePerm=current;
  $("sidebarMenu").innerHTML=(m||[]).map(x=>`<a href="${routeFor(x.code)}" class="nav-item ${x.code==="AGENDA"?"active":""}"><span class="nav-dot"></span><span>${esc(x.name)}</span></a>`).join("");
  document.querySelectorAll('.nav-item[href="#"]').forEach(a=>a.onclick=e=>{e.preventDefault();alert(`Modul "${a.textContent.trim()}" akan diaktifkan bertahap.`)});
}

async function loadMaster(){
  classes=await api.db.select("classes","select=id,name,grade_level&is_active=eq.true&order=grade_level.asc,name.asc")||[];
  $("targetClass").innerHTML='<option value="">Pilih kelas</option>'+classes.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");
}

async function loadData(){
  rows=await api.db.select("v_school_agenda_detail","select=*&order=start_at.asc")||[];
  renderAll();
}

function localDateKey(d){
  const x=new Date(d);
  const y=x.getFullYear(),m=String(x.getMonth()+1).padStart(2,"0"),day=String(x.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function todayKey(){return localDateKey(new Date())}
function monthKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`}
function monthTitle(d){return new Intl.DateTimeFormat("id-ID",{month:"long",year:"numeric"}).format(d)}
function dateLabel(v,allDay=false){
  if(!v)return "-";
  const opts=allDay?{day:"2-digit",month:"short",year:"numeric"}:{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"};
  return new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",...opts}).format(new Date(v));
}
function timeLabel(v){return v?new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",hour:"2-digit",minute:"2-digit"}).format(new Date(v)):"-"}
function dateOnlyInJakarta(v){
  if(!v)return "";
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(v));
  const get=t=>parts.find(p=>p.type===t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function categoryClass(c){return `ev-${String(c||"lainnya").toLowerCase()}`}
function audienceLabel(r){
  if(r.audience==="KELAS_TERTENTU")return `Kelas ${r.target_class_name||"-"}`;
  return {SELURUH_MADRASAH:"Seluruh Madrasah",GURU_PEGAWAI:"Guru & Pegawai",SISWA:"Seluruh Siswa"}[r.audience]||r.audience;
}
function statusPill(st){
  if(st==="COMPLETED")return '<span class="pill p-done">SELESAI</span>';
  if(st==="CANCELLED")return '<span class="pill p-cancel">DIBATALKAN</span>';
  return '<span class="pill p-plan">DIRENCANAKAN</span>';
}
function eventRangeKeys(r){
  const start=dateOnlyInJakarta(r.start_at);
  const end=dateOnlyInJakarta(r.end_at||r.start_at);
  return {start,end};
}
function dateInRange(key,r){
  const {start,end}=eventRangeKeys(r);
  return key>=start&&key<=end;
}

function baseFiltered(){
  const q=$("searchInput").value.trim().toLowerCase(),cat=$("categoryFilter").value,aud=$("audienceFilter").value,st=$("statusFilter").value;
  return rows.filter(r=>{
    const hay=`${r.title||""} ${r.description||""} ${r.location||""} ${r.person_in_charge||""} ${r.created_by_name||""}`.toLowerCase();
    return (!q||hay.includes(q))&&(!cat||r.category===cat)&&(!aud||r.audience===aud)&&(!st||r.status===st);
  });
}
function eventsForDate(key){return baseFiltered().filter(r=>dateInRange(key,r))}
function eventsForMonth(d){
  const first=`${monthKey(d)}-01`;
  const lastDate=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
  const last=`${monthKey(d)}-${String(lastDate).padStart(2,"0")}`;
  return baseFiltered().filter(r=>{
    const {start,end}=eventRangeKeys(r);
    return start<=last&&end>=first;
  });
}

function renderStats(){
  const monthEvents=eventsForMonth(viewDate);
  const today=eventsForDate(todayKey());
  const now=new Date();
  $("statMonth").textContent=monthEvents.length;
  $("statToday").textContent=today.length;
  $("statUpcoming").textContent=baseFiltered().filter(r=>r.status==="PLANNED"&&new Date(r.end_at||r.start_at)>=now).length;
  $("statImportant").textContent=baseFiltered().filter(r=>r.is_important&&r.status!=="CANCELLED").length;
}

function renderCalendar(){
  $("calendarTitle").textContent=monthTitle(viewDate);
  const y=viewDate.getFullYear(),m=viewDate.getMonth();
  const first=new Date(y,m,1);
  const last=new Date(y,m+1,0);
  const mondayIndex=(first.getDay()+6)%7;
  const total=42;
  const start=new Date(y,m,1-mondayIndex);
  let html="";

  for(let i=0;i<total;i++){
    const d=new Date(start);
    d.setDate(start.getDate()+i);
    const key=localDateKey(d);
    const outside=d.getMonth()!==m;
    const events=eventsForDate(key);
    html+=`<div class="day ${outside?"outside":""} ${key===todayKey()?"today":""} ${key===selectedDateKey?"selected":""}" data-day="${key}">
      <div class="day-num">${d.getDate()}</div>
      <div class="day-events">
        ${events.slice(0,3).map(r=>`<span class="event-chip ${categoryClass(r.category)}" title="${esc(r.title)}">${r.is_important?"⭐ ":""}${esc(r.title)}</span>`).join("")}
        ${events.length>3?`<span class="event-chip ev-lainnya">+${events.length-3} agenda</span>`:""}
      </div>
    </div>`;
  }
  $("calendarGrid").innerHTML=html;
  document.querySelectorAll("[data-day]").forEach(el=>el.onclick=()=>{
    selectedDateKey=selectedDateKey===el.dataset.day?null:el.dataset.day;
    renderCalendar();renderList();
  });
}

function listData(){
  if(selectedDateKey)return eventsForDate(selectedDateKey).sort((a,b)=>new Date(a.start_at)-new Date(b.start_at));
  return eventsForMonth(viewDate).sort((a,b)=>new Date(a.start_at)-new Date(b.start_at));
}

function renderList(){
  const data=listData();
  if(selectedDateKey){
    const d=new Date(selectedDateKey+"T00:00:00");
    $("listTitle").textContent=new Intl.DateTimeFormat("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(d);
  }else $("listTitle").textContent=`Agenda ${monthTitle(viewDate)}`;

  $("listSummary").textContent=`${data.length} agenda`;
  if(!data.length){
    $("agendaList").innerHTML='<div class="empty-state">Belum ada agenda pada periode ini.</div>';
    return;
  }

  $("agendaList").innerHTML=data.map(r=>`<article class="agenda-item ${r.is_important?"important":""} ${r.status==="CANCELLED"?"cancelled":""}">
    <div class="item-top">
      <div class="pills">
        <span class="pill p-cat">${esc(r.category)}</span>
        ${statusPill(r.status)}
        ${r.is_important?'<span class="pill p-important">⭐ PENTING</span>':""}
      </div>
    </div>
    <h4>${esc(r.title)}</h4>
    ${r.description?`<p>${esc(r.description)}</p>`:""}
    <div class="meta-grid">
      <div><b>Waktu</b>${r.all_day?`${esc(dateLabel(r.start_at,true))}${r.end_at&&dateOnlyInJakarta(r.end_at)!==dateOnlyInJakarta(r.start_at)?` – ${esc(dateLabel(r.end_at,true))}`:""} · Sehari penuh`:`${esc(dateLabel(r.start_at))}${r.end_at?` – ${esc(dateLabel(r.end_at))}`:""}`}</div>
      <div><b>Sasaran</b>${esc(audienceLabel(r))}</div>
      <div><b>Lokasi</b>${esc(r.location||"-")}</div>
      <div><b>Penanggung Jawab</b>${esc(r.person_in_charge||"-")}</div>
    </div>
    <div class="row-actions">
      ${r.external_link?`<a class="mini-btn" href="${esc(r.external_link)}" target="_blank" rel="noopener">Buka Tautan ↗</a>`:""}
      ${canUpdate()?`<button class="mini-btn" data-edit="${r.id}">Edit</button>`:""}
    </div>
  </article>`).join("");

  document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>openEdit(b.dataset.edit));
}

function renderAll(){
  renderStats();renderCalendar();renderList();
  $("addBtn").style.display=canCreate()?"":"none";
}

function toggleTargetClass(){
  const isClass=$("audience").value==="KELAS_TERTENTU";
  $("targetClassWrap").classList.toggle("hidden",!isClass);
  $("targetClass").required=isClass;
  if(!isClass)$("targetClass").value="";
}
function toggleAllDay(){
  const all=$("allDay").checked;
  $("startTimeWrap").classList.toggle("hidden",all);
  $("endTimeWrap").classList.toggle("hidden",all);
  $("startTime").required=!all;
  if(all){$("startTime").value="";$("endTime").value=""}
}
function localParts(iso){
  if(!iso)return {date:"",time:""};
  const d=new Date(iso);
  const dateParts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d);
  const timeParts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Jakarta",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(d);
  const g=(arr,t)=>arr.find(p=>p.type===t)?.value;
  return {date:`${g(dateParts,"year")}-${g(dateParts,"month")}-${g(dateParts,"day")}`,time:`${g(timeParts,"hour")}:${g(timeParts,"minute")}`};
}
function jakartaIso(date,time){
  if(!date)return null;
  const t=time||"00:00";
  return new Date(`${date}T${t}:00+07:00`).toISOString();
}
function openAdd(){
  if(!canCreate())return;
  $("form").reset();$("agendaId").value="";$("modalTitle").textContent="Tambah Agenda";$("status").value="PLANNED";$("category").value="KEGIATAN";$("audience").value="SELURUH_MADRASAH";
  $("deleteBtn").style.display="none";$("formMessage").textContent="";
  const base=selectedDateKey||todayKey();$("startDate").value=base;$("startTime").value="08:00";$("endDate").value=base;$("endTime").value="09:00";
  toggleTargetClass();toggleAllDay();$("modal").classList.remove("hidden");
}
function openEdit(id){
  const r=rows.find(x=>x.id===id);if(!r||!canUpdate())return;
  $("form").reset();$("agendaId").value=r.id;$("modalTitle").textContent="Edit Agenda";
  $("title").value=r.title||"";$("description").value=r.description||"";$("category").value=r.category||"KEGIATAN";$("status").value=r.status||"PLANNED";
  $("audience").value=r.audience||"SELURUH_MADRASAH";toggleTargetClass();$("targetClass").value=r.target_class_id||"";
  $("allDay").checked=!!r.all_day;toggleAllDay();
  const s=localParts(r.start_at),e=localParts(r.end_at||r.start_at);
  $("startDate").value=s.date;$("startTime").value=r.all_day?"":s.time;$("endDate").value=r.end_at?e.date:"";$("endTime").value=r.all_day?"":(r.end_at?e.time:"");
  $("location").value=r.location||"";$("pic").value=r.person_in_charge||"";$("externalLink").value=r.external_link||"";$("important").checked=!!r.is_important;
  $("deleteBtn").style.display=canDelete()?"":"none";$("formMessage").textContent="";$("modal").classList.remove("hidden");
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

async function save(e){
  e.preventDefault();
  const btn=$("saveBtn");btn.disabled=true;btn.textContent="Menyimpan...";$("formMessage").textContent="";
  try{
    const id=$("agendaId").value,title=$("title").value.trim();
    if(!title)throw new Error("Judul agenda wajib diisi.");
    if($("audience").value==="KELAS_TERTENTU"&&!$("targetClass").value)throw new Error("Pilih kelas tujuan.");

    const all=$("allDay").checked;
    const startDate=$("startDate").value,startTime=all?"00:00":$("startTime").value;
    if(!startDate)throw new Error("Tanggal mulai wajib diisi.");
    if(!all&&!startTime)throw new Error("Jam mulai wajib diisi.");

    const endDate=$("endDate").value||null,endTime=all?"23:59":($("endTime").value||null);
    const startAt=jakartaIso(startDate,startTime);
    let endAt=null;
    if(endDate)endAt=jakartaIso(endDate,endTime||(all?"23:59":startTime));
    if(endAt&&new Date(endAt)<new Date(startAt))throw new Error("Waktu selesai tidak boleh sebelum waktu mulai.");

    const payload={
      title,
      description:$("description").value.trim()||null,
      category:$("category").value,
      audience:$("audience").value,
      target_class_id:$("audience").value==="KELAS_TERTENTU"?$("targetClass").value:null,
      all_day:all,
      start_at:startAt,
      end_at:endAt,
      location:$("location").value.trim()||null,
      person_in_charge:$("pic").value.trim()||null,
      external_link:$("externalLink").value.trim()||null,
      status:$("status").value,
      is_important:$("important").checked
    };

    if(id)await restWrite(`school_agenda?id=eq.${encodeURIComponent(id)}`,"PATCH",payload);
    else await restWrite("school_agenda","POST",payload);

    closeModal();await loadData();
  }catch(err){$("formMessage").textContent="Gagal menyimpan: "+err.message}
  finally{btn.disabled=false;btn.textContent="Simpan"}
}

async function remove(){
  const id=$("agendaId").value,r=rows.find(x=>x.id===id);
  if(!r||!canDelete())return;
  if(!confirm(`Hapus agenda "${r.title}"?`))return;
  try{
    await restWrite(`school_agenda?id=eq.${encodeURIComponent(id)}`,"DELETE",undefined,"return=minimal");
    closeModal();await loadData();
  }catch(err){alert("Gagal menghapus agenda: "+err.message)}
}

$("searchInput").addEventListener("input",renderAll);
$("categoryFilter").addEventListener("change",renderAll);
$("audienceFilter").addEventListener("change",renderAll);
$("statusFilter").addEventListener("change",renderAll);
$("prevMonth").addEventListener("click",()=>{viewDate=new Date(viewDate.getFullYear(),viewDate.getMonth()-1,1);selectedDateKey=null;renderAll()});
$("nextMonth").addEventListener("click",()=>{viewDate=new Date(viewDate.getFullYear(),viewDate.getMonth()+1,1);selectedDateKey=null;renderAll()});
$("todayBtn").addEventListener("click",()=>{const d=new Date();viewDate=new Date(d.getFullYear(),d.getMonth(),1);selectedDateKey=todayKey();renderAll()});
$("addBtn").addEventListener("click",openAdd);
$("closeModal").addEventListener("click",closeModal);
$("cancelBtn").addEventListener("click",closeModal);
$("deleteBtn").addEventListener("click",remove);
$("form").addEventListener("submit",save);
$("audience").addEventListener("change",toggleTargetClass);
$("allDay").addEventListener("change",toggleAllDay);
$("startDate").addEventListener("change",()=>{if(!$("endDate").value)$("endDate").value=$("startDate").value});
$("modal").addEventListener("click",e=>{if(e.target===$("modal"))closeModal()});

(async()=>{
  try{
    api=await window.simanisReady;
    const user=await api.auth.getUser();if(!user){location.href="index.html";return}
    profile=await loadProfile(user);
    $("sideUserName").textContent=profile.full_name||"Pengguna";$("sideUserRole").textContent=formatRole(profile.role);$("headerUser").textContent=profile.full_name||"Pengguna";$("currentDate").textContent=localDateID();
    await loadMenu();if(!modulePerm.can_view)throw new Error("Akun tidak memiliki akses ke modul Agenda Madrasah.");
    await loadMaster();await loadData();
    $("logoutBtn").onclick=async()=>{await api.auth.signOut();location.href="index.html"};
  }catch(err){
    console.error(err);alert("Modul Agenda gagal dimuat: "+err.message);
  }finally{$("loading").style.display="none"}
})();
