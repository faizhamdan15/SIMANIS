(function(){
  const file=(location.pathname.split("/").pop()||"index.html").toLowerCase();
  const MODULE_BY_FILE={
    "dashboard.html":"DASHBOARD","administrasi.html":"ADMINISTRASI_KEPALA",
    "siswa.html":"DATA_SISWA","guru.html":"DATA_GURU","kelas.html":"KELAS",
    "mapel.html":"MATA_PELAJARAN","jadwal.html":"JADWAL",
    "absensi-guru.html":"ABSENSI_GURU","absensi-guru-kiosk.html":"ABSENSI_GURU",
    "absensi-guru-riwayat.html":"ABSENSI_GURU","kartu-guru.html":"ABSENSI_GURU",
    "absensi-siswa.html":"ABSENSI_SISWA","absensi-siswa-riwayat.html":"ABSENSI_SISWA",
    "wali-kelas.html":"DATA_SISWA","nilai.html":"NILAI","prestasi.html":"PRESTASI",
    "berita.html":"BERITA","pengumuman.html":"PENGUMUMAN","agenda.html":"AGENDA",
    "keuangan.html":"KEUANGAN","wali-admin.html":"PORTAL_WALI","pengaturan.html":"PENGATURAN",
    "security-access-check.html":"PENGATURAN","release-readiness.html":"PENGATURAN"
  };
  const AUTH_ONLY=new Set(["account-security.html"]);
  const isUnit=file==="unit-kerja.html";
  if(!(MODULE_BY_FILE[file]||AUTH_ONLY.has(file)||isUnit))return;

  function overlay(){
    if(document.getElementById("simanisSecurityGate"))return;
    const el=document.createElement("div");
    el.id="simanisSecurityGate";
    el.innerHTML=`<div class="sg-card"><div class="sg-mark">S</div>
      <strong id="sgTitle">Memeriksa akses SIMANIS</strong>
      <span id="sgText">Memvalidasi sesi, akun, dan hak akses halaman...</span>
      <div id="sgActions" class="sg-actions" style="display:none">
        <a href="dashboard.html">Dashboard</a><button id="sgReload" type="button">Muat Ulang</button>
        <button id="sgLogout" type="button">Keluar</button></div></div>`;
    const st=document.createElement("style");
    st.textContent=`#simanisSecurityGate{position:fixed;inset:0;z-index:2147483647;background:#f5f8f6;display:grid;place-items:center;padding:20px;font-family:Inter,Arial,sans-serif}
      #simanisSecurityGate .sg-card{width:min(430px,100%);background:#fff;border:1px solid #dbe7e0;border-radius:20px;padding:24px;text-align:center;box-shadow:0 20px 60px rgba(6,61,44,.13)}
      #simanisSecurityGate .sg-mark{width:52px;height:52px;margin:0 auto 14px;border-radius:15px;background:#075b3a;color:#fff;display:grid;place-items:center;font-weight:900;font-size:21px}
      #simanisSecurityGate strong{display:block;color:#123a2a;font-size:15px}#simanisSecurityGate span{display:block;margin-top:7px;color:#6d7d75;font-size:10px;line-height:1.6}
      #simanisSecurityGate .sg-actions{margin-top:16px;gap:8px;justify-content:center;flex-wrap:wrap}
      #simanisSecurityGate a,#simanisSecurityGate button{border:1px solid #d7e2dc;background:#fff;color:#075b3a;border-radius:10px;padding:9px 12px;font-size:10px;font-weight:800;text-decoration:none;cursor:pointer}`;
    document.head.appendChild(st);(document.body||document.documentElement).appendChild(el);
  }

  function denied(title,msg,api){
    overlay();
    document.getElementById("sgTitle").textContent=title;
    document.getElementById("sgText").textContent=msg;
    document.getElementById("sgActions").style.display="flex";
    document.getElementById("sgReload").onclick=()=>location.reload();
    document.getElementById("sgLogout").onclick=async()=>{try{await api?.auth?.signOut?.()}catch(_){}location.replace("index.html")};
  }
  function allow(){document.getElementById("simanisSecurityGate")?.remove()}
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const timeout=(ms,msg)=>new Promise((_,reject)=>setTimeout(()=>reject(new Error(msg)),ms));

  async function waitReady(){
    for(let i=0;i<120;i++){
      if(window.simanisReady){
        return Promise.race([window.simanisReady,timeout(12000,"Validasi hak akses melebihi batas waktu.")]);
      }
      await wait(50);
    }
    throw new Error("SIMANIS SDK belum siap.");
  }

  async function verify(){
    overlay();let api=null;
    try{
      api=await waitReady();
      const session=await api.auth.getSession();if(!session){location.replace("index.html");return}
      const user=await api.auth.getUser();if(!user){location.replace("index.html");return}
      const profiles=await api.db.select("profiles",`select=id,full_name,role,is_active&id=eq.${encodeURIComponent(user.id)}&limit=1`);
      const p=profiles?.[0];
      if(!p?.is_active){denied("Akun tidak aktif","Akun ini tidak diizinkan menggunakan halaman SIMANIS.",api);return}
      if(AUTH_ONLY.has(file)){allow();return}

      if(file==="wali-kelas.html"){
        const h=await api.db.rpc("get_my_homeroom_context",{});
        if(!h?.has_homeroom){denied("Akses Wali Kelas ditolak","Halaman ini hanya untuk guru yang menjadi wali kelas aktif.",api);return}
        allow();return;
      }

      let moduleCode=MODULE_BY_FILE[file]||null;
      if(isUnit){
        moduleCode=(new URLSearchParams(location.search).get("unit")||"").toUpperCase();
        const units=new Set(["PKM_KURIKULUM","PKM_KESISWAAN","PKM_BENDAHARA_SARPRAS","PKM_HUMASY","KEPALA_TU","KALAB_IPA","KALAB_BISNIS"]);
        if(!units.has(moduleCode)){denied("Unit kerja tidak valid","Kode unit pada alamat halaman tidak dikenali.",api);return}
      }
      if(!moduleCode){denied("Halaman tidak dipetakan","Halaman privat belum memiliki pemetaan permission.",api);return}

      const perm=await api.db.rpc("get_my_module_permission",{p_module_code:moduleCode});
      let allowed=!!perm?.can_view;
      if(file==="absensi-guru-kiosk.html"||file==="absensi-guru-riwayat.html"){
        allowed=!!perm?.can_update||p.role==="SUPER_ADMIN";
      }
      if(!allowed){denied("Akses halaman ditolak",`Akun ${p.full_name||""} tidak memiliki hak untuk membuka ${moduleCode}.`,api);return}
      allow();
    }catch(err){
      console.error("SIMANIS direct URL security:",err);
      denied("Verifikasi akses gagal","Hak akses halaman tidak dapat diverifikasi dengan aman. Sistem menutup akses sampai validasi berhasil.",api);
    }
  }
  if(document.body)verify();else document.addEventListener("DOMContentLoaded",verify,{once:true});
})();