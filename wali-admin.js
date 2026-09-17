const $=id=>document.getElementById(id);
let api,profile,students=[],links=[],modulePerm={can_view:false,can_create:false,can_update:false,can_delete:false};

function esc(s){return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}
function formatRole(r){return(r||"-").replaceAll("_"," ")}
function localDateID(){return new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date())}
function routeFor(code){return{DASHBOARD:"dashboard.html",ADMINISTRASI_KEPALA:"administrasi.html",DATA_SISWA:"siswa.html",DATA_GURU:"guru.html",KELAS:"kelas.html",MATA_PELAJARAN:"mapel.html",JADWAL:"jadwal.html",ABSENSI_GURU:"absensi-guru.html",ABSENSI_SISWA:"absensi-siswa.html",NILAI:"nilai.html",PRESTASI:"prestasi.html",BERITA:"berita.html",PENGUMUMAN:"pengumuman.html",AGENDA:"agenda.html",KEUANGAN:"keuangan.html",PORTAL_WALI:"wali-admin.html"}[code]||"#"}

async function loadProfile(user){
 const r=await api.db.select("profiles",`select=id,full_name,role,is_active&id=eq.${encodeURIComponent(user.id)}&limit=1`);
 if(!r?.[0])throw new Error("Profil pengguna tidak ditemukan.");if(!r[0].is_active)throw new Error("Akun tidak aktif.");return r[0];
}
async function loadMenu(){
 const m=await api.db.rpc("get_my_modules",{});
 const cur=(m||[]).find(x=>x.code==="PORTAL_WALI");if(cur)modulePerm=cur;
 $("sidebarMenu").innerHTML=(m||[]).map(x=>`<a href="${routeFor(x.code)}" class="nav-item ${x.code==="PORTAL_WALI"?"active":""}"><span class="nav-dot"></span><span>${esc(x.name)}</span></a>`).join("");
}
async function loadData(){
 students=await api.db.rpc("admin_guardian_students",{})||[];
 const classes=[...new Map(students.map(s=>[s.class_id,s.class_name])).entries()].sort((a,b)=>String(a[1]).localeCompare(String(b[1]),"id"));
 $("classFilter").innerHTML='<option value="">Pilih kelas</option>'+classes.map(([id,name])=>`<option value="${id}">${esc(name)}</option>`).join("");
 renderStudents();await loadLinks();
}
function renderStudents(){
 const classId=$("classFilter").value,current=$("studentSelect").value;
 const list=students.filter(s=>!classId||s.class_id===classId);
 $("studentSelect").innerHTML='<option value="">Pilih siswa</option>'+list.map(s=>`<option value="${s.student_id}">${esc(s.student_name)}${Number(s.guardian_count)>0?` · ${s.guardian_count} wali`:""}</option>`).join("");
 if(list.some(s=>s.student_id===current))$("studentSelect").value=current;
}
async function loadLinks(){
 const studentId=$("studentSelect").value||null;
 links=await api.db.rpc("admin_guardian_links",{p_student_id:studentId})||[];
 renderLinks();
}
function renderLinks(){
 const studentId=$("studentSelect").value,s=students.find(x=>x.student_id===studentId);
 $("selectedStudentText").textContent=s?`${s.student_name} · ${s.class_name}`:"Pilih siswa untuk melihat akun wali.";
 if(!studentId){$("guardianList").innerHTML='<div class="empty-state">Belum ada siswa dipilih.</div>';return}
 if(!links.length){$("guardianList").innerHTML='<div class="empty-state">Belum ada akun wali yang terhubung dengan siswa ini.</div>';return}
 $("guardianList").innerHTML=links.map(l=>`<article class="guardian-item"><div class="guardian-top"><div><h4>${esc(l.guardian_name||"Nama belum tersedia")}</h4><p>${esc(l.relationship)} · ${esc(l.guardian_email||"-")} · ${esc(l.guardian_phone||"-")}</p></div><span class="${l.is_active?"badge-active":"badge-active badge-off"}">${l.is_active?"AKTIF":"NONAKTIF"}</span></div>${modulePerm.can_update?`<div style="margin-top:8px"><button class="mini-btn" data-toggle-link="${l.link_id}" data-next="${!l.is_active}">${l.is_active?"Nonaktifkan":"Aktifkan Kembali"}</button></div>`:""}</article>`).join("");
 document.querySelectorAll("[data-toggle-link]").forEach(b=>b.onclick=()=>toggleLink(b.dataset.toggleLink,b.dataset.next==="true"));
}
async function generateInvite(){
 const studentId=$("studentSelect").value;if(!studentId){alert("Pilih siswa terlebih dahulu.");return}
 if(!modulePerm.can_create){alert("Akun tidak memiliki izin membuat kode aktivasi.");return}
 const btn=$("generateBtn");btn.disabled=true;btn.textContent="Membuat...";
 try{
  const r=await api.db.rpc("create_guardian_invite",{p_student_id:studentId,p_relationship:$("relationship").value,p_expires_days:Number($("expiresDays").value)});
  const code=r?.invite_code||r?.[0]?.invite_code;if(!code)throw new Error("Kode aktivasi tidak diterima.");
  $("inviteResult").innerHTML=`<div class="invite-result"><div style="font-size:9px;color:#62746a">Kode aktivasi untuk <b>${esc(r.student_name||"siswa")}</b></div><div class="invite-code">${esc(code)}</div><div style="font-size:8.5px;color:#62746a;margin:5px 0">Hubungan: ${esc(r.relationship||"-")} · Berlaku sampai ${new Intl.DateTimeFormat("id-ID",{dateStyle:"medium",timeStyle:"short"}).format(new Date(r.expires_at))}</div><button id="copyInviteBtn" class="secondary-btn">Salin Kode</button></div>`;
  $("copyInviteBtn").onclick=()=>navigator.clipboard.writeText(code).then(()=>alert("Kode aktivasi disalin."));
 }catch(e){alert("Gagal membuat kode: "+e.message)}
 finally{btn.disabled=false;btn.textContent="Buat Kode Aktivasi"}
}
async function toggleLink(id,next){
 const verb=next?"aktifkan kembali":"nonaktifkan";
 if(!confirm(`Yakin ingin ${verb} akses wali ini?`))return;
 try{await api.db.rpc("set_guardian_link_active",{p_link_id:id,p_is_active:next});await loadLinks()}catch(e){alert("Gagal mengubah akses: "+e.message)}
}

$("classFilter").onchange=()=>{renderStudents();$("studentSelect").value="";loadLinks()};
$("studentSelect").onchange=loadLinks;
$("generateBtn").onclick=generateInvite;
$("copyPortalLinkBtn").onclick=()=>navigator.clipboard.writeText(new URL("wali-login.html",location.href).href).then(()=>alert("Link Portal Wali disalin."));

(async()=>{
 try{
  api=await window.simanisReady;const user=await api.auth.getUser();if(!user){location.href="index.html";return}
  profile=await loadProfile(user);$("sideUserName").textContent=profile.full_name;$("sideUserRole").textContent=formatRole(profile.role);$("headerUser").textContent=profile.full_name;$("currentDate").textContent=localDateID();
  await loadMenu();if(!modulePerm.can_view)throw new Error("Tidak memiliki akses Portal Wali Siswa.");
  await loadData();$("logoutBtn").onclick=async()=>{await api.auth.signOut();location.href="index.html"}
 }catch(e){console.error(e);alert("Portal Wali gagal dimuat: "+e.message)}
 finally{$("loading").style.display="none"}
})();