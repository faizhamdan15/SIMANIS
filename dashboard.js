let supabase;

const $ = (id) => document.getElementById(id);
function formatRole(role){ return (role || "-").replaceAll("_"," "); }
function localDateID(){
  return new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date());
}
function todayCode(){
  const d = new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",weekday:"long"}).format(new Date()).toUpperCase();
  return ({SENIN:"SENIN",SELASA:"SELASA",RABU:"RABU",KAMIS:"KAMIS",JUMAT:"JUMAT",SABTU:"SABTU",MINGGU:"AHAD"})[d] || d;
}
async function countTable(table, filters=[]){
  let q = supabase.from(table).select("*",{count:"exact",head:true});
  for(const [op,col,val] of filters) q=q[op](col,val);
  const {count,error}=await q;
  if(error){ console.warn(table,error.message); return 0; }
  return count||0;
}
async function loadProfile(session){
  const {data,error}=await supabase.from("profiles").select("id,full_name,role,is_active,teacher_id").eq("id",session.user.id).single();
  if(error||!data) throw new Error("Profil pengguna tidak ditemukan: "+(error?.message||""));
  if(!data.is_active) throw new Error("Akun SIMANIS tidak aktif.");
  return data;
}
async function loadMenu(){
  const {data,error}=await supabase.rpc("get_my_modules");
  if(error) throw new Error("Menu gagal dimuat: "+error.message);
  $("sidebarMenu").innerHTML=(data||[]).map(m=>`<a href="${m.code==="DASHBOARD"?"dashboard.html":"#"}" class="nav-item ${m.code==="DASHBOARD"?"active":""}"><span class="nav-dot"></span><span>${m.name}</span></a>`).join("");
}
async function loadStats(profile){
  const [students,teachers,classes,subjects,schedules]=await Promise.all([
    countTable("students",[["eq","status","AKTIF"]]),
    countTable("teachers",[["eq","is_active",true]]),
    countTable("classes",[["eq","is_active",true]]),
    countTable("subjects",[["eq","is_active",true]]),
    countTable("schedules")
  ]);
  $("statStudents").textContent=students;
  $("statTeachers").textContent=teachers;
  $("statClasses").textContent=classes;
  $("summarySubjects").textContent=`${subjects} mapel`;
  $("summarySchedules").textContent=`${schedules} slot`;
  $("summaryRole").textContent=formatRole(profile.role);
}
async function loadTodaySchedule(){
  const day=todayCode(); $("todayName").textContent=day;
  if(day==="JUMAT"){ $("todaySchedule").innerHTML='<div class="placeholder">Tidak ada jadwal reguler pada hari Jumat.</div>'; return; }
  const {data,error}=await supabase.from("v_schedule_detail").select("jam,start_time,end_time,kelas,mata_pelajaran,guru,urutan_jam").eq("tahun_pelajaran","2026/2027").eq("semester","GANJIL").eq("hari",day).order("urutan_jam").limit(8);
  if(error||!data?.length){ $("todaySchedule").innerHTML=`<div class="placeholder">Jadwal belum dapat dimuat${error?": "+error.message:""}.</div>`; return; }
  $("todaySchedule").innerHTML=data.map(x=>`<div class="schedule-item"><div class="time">${String(x.start_time).slice(0,5)}<br>${String(x.end_time).slice(0,5)}</div><div><strong>${x.mata_pelajaran} · ${x.kelas}</strong><small>${x.guru}</small></div></div>`).join("");
}
async function loadAttendanceChart(){
  const box=$("attendanceChart");
  box.innerHTML = ["Sen","Sel","Rab","Kam","Jum","Sab","Ahd"].map((d,i)=>`<div class="bar-wrap"><div class="bar-value">0%</div><div class="bar" style="height:8px"></div><div class="bar-label">${d}</div></div>`).join("");
}
async function boot(){
  try{
    ({supabase}=await window.simanisReady);
    const {data:{session},error}=await supabase.auth.getSession();
    if(error) throw error;
    if(!session){ location.replace("index.html"); return; }
    const profile=await loadProfile(session);
    $("sideUserName").textContent=profile.full_name||session.user.email;
    $("sideUserRole").textContent=formatRole(profile.role);
    $("headerUser").textContent=profile.full_name||"Pengguna";
    $("welcomeTitle").textContent=`Selamat Datang, ${profile.full_name||"Pengguna"}!`;
    $("currentDate").textContent=localDateID();
    await Promise.all([loadMenu(),loadStats(profile),loadTodaySchedule(),loadAttendanceChart()]);
  }catch(err){
    console.error(err);
    alert("SIMANIS gagal dimuat: "+(err.message||err));
  }finally{
    $("loading")?.classList.add("hidden");
  }
}
$("logoutBtn").addEventListener("click",async()=>{
  try{
    if(!supabase) ({supabase}=await window.simanisReady);
    await supabase.auth.signOut();
  }finally{
    location.replace("index.html");
  }
});
boot();
