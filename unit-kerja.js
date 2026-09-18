const $=id=>document.getElementById(id);
let api,profile,myModules=[];
const ROUTES={DASHBOARD:"dashboard.html",ADMINISTRASI_KEPALA:"administrasi.html",DATA_SISWA:"siswa.html",DATA_GURU:"guru.html",KELAS:"kelas.html",MATA_PELAJARAN:"mapel.html",JADWAL:"jadwal.html",ABSENSI_GURU:"absensi-guru.html",ABSENSI_SISWA:"absensi-siswa.html",NILAI:"nilai.html",PRESTASI:"prestasi.html",BERITA:"berita.html",PENGUMUMAN:"pengumuman.html",AGENDA:"agenda.html",KEUANGAN:"keuangan.html",PORTAL_WALI:"wali-admin.html",PENGATURAN:"pengaturan.html"};
const UNITS={
 PKM_KURIKULUM:{name:"PKM Kurikulum",desc:"Koordinasi kurikulum, pembelajaran, jadwal, penilaian, dan peningkatan mutu akademik.",icon:"book",focus:["Perencanaan dan pelaksanaan kurikulum","Koordinasi jadwal dan beban mengajar","Pemantauan proses pembelajaran dan penilaian","Evaluasi program akademik"],related:["KELAS","MATA_PELAJARAN","JADWAL","NILAI","DATA_GURU"]},
 PKM_KESISWAAN:{name:"PKM Kesiswaan",desc:"Koordinasi pembinaan siswa, kedisiplinan, prestasi, kegiatan, dan layanan kesiswaan.",icon:"users",focus:["Pembinaan dan kedisiplinan siswa","Pemantauan kehadiran siswa","Pengembangan prestasi dan kegiatan siswa","Koordinasi informasi kesiswaan"],related:["DATA_SISWA","ABSENSI_SISWA","PRESTASI","PENGUMUMAN","AGENDA"]},
 PKM_BENDAHARA_SARPRAS:{name:"PKM Bendahara & Sarpras",desc:"Koordinasi keuangan madrasah serta perencanaan dan pengelolaan sarana-prasarana.",icon:"wallet",focus:["Pengelolaan pemasukan dan pengeluaran","Pemantauan Iuran Pendidikan","Perencanaan kebutuhan sarana-prasarana","Dokumentasi dan pertanggungjawaban keuangan"],related:["KEUANGAN","AGENDA","ADMINISTRASI_KEPALA"]},
 PKM_HUMASY:{name:"PKM Humasy",desc:"Koordinasi hubungan masyarakat, publikasi, informasi, dan komunikasi kelembagaan.",icon:"megaphone",focus:["Publikasi kegiatan dan prestasi madrasah","Pengelolaan berita dan informasi","Koordinasi pengumuman publik","Dokumentasi komunikasi kelembagaan"],related:["BERITA","PENGUMUMAN","AGENDA"]},
 KEPALA_TU:{name:"Kepala TU",desc:"Koordinasi administrasi, layanan tata usaha, data kelembagaan, dan dokumen madrasah.",icon:"briefcase",focus:["Administrasi data siswa dan guru","Pengelolaan dokumen tata usaha","Koordinasi layanan administrasi madrasah","Ketertiban arsip dan data kelembagaan"],related:["ADMINISTRASI_KEPALA","DATA_SISWA","DATA_GURU","PENGUMUMAN","AGENDA"]},
 KALAB_IPA:{name:"Kepala Laboratorium IPA",desc:"Koordinasi pengelolaan Laboratorium IPA, kegiatan praktikum, inventaris, dan keselamatan laboratorium.",icon:"flask",focus:["Perencanaan kegiatan praktikum","Pengelolaan inventaris alat dan bahan","Keselamatan dan tata tertib laboratorium","Dokumentasi penggunaan Laboratorium IPA"],related:["AGENDA","ADMINISTRASI_KEPALA"]},
 KALAB_BISNIS:{name:"Kepala Laboratorium Bisnis",desc:"Koordinasi Laboratorium Bisnis sebagai sarana praktik, kewirausahaan, dan pembelajaran berbasis aktivitas bisnis.",icon:"chart",focus:["Perencanaan kegiatan praktik bisnis","Pengelolaan fasilitas dan inventaris","Pendampingan aktivitas kewirausahaan siswa","Dokumentasi penggunaan Laboratorium Bisnis"],related:["AGENDA","ADMINISTRASI_KEPALA","KEUANGAN"]}
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
function roleLabel(r){return String(r||"-").replaceAll("_"," ")}
function localDateID(){return new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date())}
async function loadProfile(user){const r=await api.db.select("profiles",`select=id,full_name,role,is_active&id=eq.${encodeURIComponent(user.id)}&limit=1`);if(!r?.[0])throw new Error("Profil pengguna tidak ditemukan.");if(!r[0].is_active)throw new Error("Akun tidak aktif.");return r[0]}
async function loadMenu(){myModules=await api.db.rpc("get_my_modules",{})||[];$("sidebarMenu").innerHTML=myModules.map(x=>`<a href="${x.route||ROUTES[x.code]||"#"}" class="nav-item ${x.code===unitCode?"active":""}"><span class="nav-dot"></span><span>${esc(x.name)}</span></a>`).join("")}
const unitCode=new URLSearchParams(location.search).get("unit")||"";
async function checkAccess(){return !!(await api.db.rpc("has_module_permission",{p_module_code:unitCode,p_action:"view"}))}
function renderUnit(){
 const u=UNITS[unitCode];if(!u)throw new Error("Unit kerja tidak dikenali.");
 document.title=`${u.name} — SIMANIS`;$("topSubtitle").textContent=u.name;$("unitTitle").textContent=u.name;$("unitDesc").textContent=u.desc;$("unitIcon").innerHTML=icon(u.icon);
 $("focusList").innerHTML=u.focus.map(x=>`<div class="focus-item"><span class="dot"></span><span>${esc(x)}</span></div>`).join("");
 const related=u.related.map(code=>myModules.find(m=>m.code===code)).filter(Boolean);
 $("relatedModules").innerHTML=related.length?related.map(m=>`<a class="quick-unit" href="${m.route||ROUTES[m.code]||"#"}"><b>${esc(m.name)}</b><p>Buka modul SIMANIS</p></a>`).join(""):'<div class="empty-state">Belum ada modul terkait yang tersedia untuk akun ini.</div>';
}
(async()=>{try{api=await window.simanisReady;const user=await api.auth.getUser();if(!user){location.href="index.html";return}profile=await loadProfile(user);$("sideUserName").textContent=profile.full_name;$("sideUserRole").textContent=roleLabel(profile.role);$("headerUser").textContent=profile.full_name;$("currentDate").textContent=localDateID();if(!UNITS[unitCode])throw new Error("Parameter unit kerja tidak valid.");if(!await checkAccess())throw new Error("Akun ini tidak ditugaskan pada unit kerja tersebut.");await loadMenu();renderUnit();$("logoutBtn").onclick=async()=>{await api.auth.signOut();location.href="index.html"}}catch(err){console.error(err);alert("Unit Kerja gagal dimuat: "+err.message);if(String(err.message).includes("tidak ditugaskan"))location.href="dashboard.html"}finally{$("loading").style.display="none"}})();