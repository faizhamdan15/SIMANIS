window.SIMANIS_CONFIG = {
  SUPABASE_URL: "https://zevdqmrlcrnwkeqejbxm.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_wq4BZQjDm33hVB6E6QISuA_cQP7xmEH"
};

/*
 * SIMANIS Direct URL Guard V1
 * - Berjalan SEBELUM sdk-loader.js.
 * - Hanya untuk halaman internal yang dipetakan ke modul.
 * - Jika sesi/permission gagal diverifikasi, akses ditutup (fail closed).
 * - Tetap mengandalkan RLS/RPC Supabase sebagai lapisan keamanan data utama.
 */
(function(){
  const cfg=window.SIMANIS_CONFIG;
  const STORAGE_KEY="simanis-session";

  const PAGE_MODULE={
    "dashboard.html":"DASHBOARD",
    "administrasi.html":"ADMINISTRASI_KEPALA",
    "siswa.html":"DATA_SISWA",
    "guru.html":"DATA_GURU",
    "kelas.html":"KELAS",
    "mapel.html":"MATA_PELAJARAN",
    "jadwal.html":"JADWAL",
    "absensi-guru.html":"ABSENSI_GURU",
    "absensi-guru-kiosk.html":"ABSENSI_GURU",
    "absensi-guru-riwayat.html":"ABSENSI_GURU",
    "kartu-guru.html":"ABSENSI_GURU",
    "absensi-siswa.html":"ABSENSI_SISWA",
    "absensi-siswa-riwayat.html":"ABSENSI_SISWA",
    "wali-kelas.html":"DATA_SISWA",
    "nilai.html":"NILAI",
    "prestasi.html":"PRESTASI",
    "berita.html":"BERITA",
    "pengumuman.html":"PENGUMUMAN",
    "agenda.html":"AGENDA",
    "keuangan.html":"KEUANGAN",
    "wali-admin.html":"PORTAL_WALI",
    "pengaturan.html":"PENGATURAN",
    "akses-audit.html":"PENGATURAN"
  };

  const file=(location.pathname.split("/").pop()||"index.html").toLowerCase();
  const unit=file==="unit-kerja.html"
    ?(new URLSearchParams(location.search).get("unit")||"").toUpperCase()
    :"";
  const moduleCode=unit||PAGE_MODULE[file]||null;

  if(!moduleCode)return;

  document.documentElement.style.visibility="hidden";

  function redirect(url){
    try{location.replace(url)}catch(_){location.href=url}
  }

  function readSession(){
    try{
      const raw=localStorage.getItem(STORAGE_KEY);
      return raw?JSON.parse(raw):null;
    }catch{
      return null;
    }
  }

  function saveSession(s){
    try{
      if(s)localStorage.setItem(STORAGE_KEY,JSON.stringify(s));
      else localStorage.removeItem(STORAGE_KEY);
    }catch(_){}
  }

  async function freshSession(){
    let s=readSession();
    if(!s?.access_token)return null;

    const now=Math.floor(Date.now()/1000);
    if(s.expires_at && s.expires_at>now+60)return s;

    if(!s.refresh_token)return null;

    try{
      const res=await fetch(
        `${cfg.SUPABASE_URL.replace(/\/$/,"")}/auth/v1/token?grant_type=refresh_token`,
        {
          method:"POST",
          headers:{
            apikey:cfg.SUPABASE_PUBLISHABLE_KEY,
            "Content-Type":"application/json"
          },
          body:JSON.stringify({refresh_token:s.refresh_token})
        }
      );

      if(!res.ok){
        saveSession(null);
        return null;
      }

      const body=await res.json();
      s={
        access_token:body.access_token,
        refresh_token:body.refresh_token||s.refresh_token,
        expires_in:body.expires_in,
        expires_at:Math.floor(Date.now()/1000)+(body.expires_in||3600),
        token_type:body.token_type||"bearer",
        user:body.user||s.user
      };
      saveSession(s);
      return s;
    }catch{
      return null;
    }
  }

  async function verify(){
    const session=await freshSession();

    if(!session?.access_token){
      const next=encodeURIComponent(location.pathname+location.search);
      redirect(`index.html?next=${next}`);
      return false;
    }

    try{
      const res=await fetch(
        `${cfg.SUPABASE_URL.replace(/\/$/,"")}/rest/v1/rpc/get_my_module_permission`,
        {
          method:"POST",
          headers:{
            apikey:cfg.SUPABASE_PUBLISHABLE_KEY,
            Authorization:`Bearer ${session.access_token}`,
            "Content-Type":"application/json"
          },
          body:JSON.stringify({p_module_code:moduleCode})
        }
      );

      if(res.status===401 || res.status===403){
        if(res.status===401)saveSession(null);
        redirect(
          res.status===401
            ?`index.html?next=${encodeURIComponent(location.pathname+location.search)}`
            :`akses-ditolak.html?module=${encodeURIComponent(moduleCode)}&reason=permission`
        );
        return false;
      }

      if(!res.ok){
        redirect(`akses-ditolak.html?module=${encodeURIComponent(moduleCode)}&reason=check`);
        return false;
      }

      let perm=await res.json();
      if(Array.isArray(perm))perm=perm[0]||null;

      if(perm?.can_view!==true){
        redirect(`akses-ditolak.html?module=${encodeURIComponent(moduleCode)}&reason=permission`);
        return false;
      }

      window.SIMANIS_PRE_ACCESS_RESULT={
        allowed:true,
        module_code:moduleCode,
        checked_at:new Date().toISOString()
      };

      document.documentElement.style.visibility="";
      return true;
    }catch(err){
      console.warn("SIMANIS direct URL guard:",err);
      redirect(`akses-ditolak.html?module=${encodeURIComponent(moduleCode)}&reason=check`);
      return false;
    }
  }

  const guardPromise=verify();
  window.SIMANIS_PRE_ACCESS_GUARD=guardPromise;

  /*
   * sdk-loader menetapkan window.simanisReady setelah config.js.
   * Setter ini membungkus promise tersebut agar page-script tidak menerima
   * API sebelum direct URL guard dinyatakan lolos.
   */
  let readyValue;
  try{
    Object.defineProperty(window,"simanisReady",{
      configurable:true,
      enumerable:true,
      get(){return readyValue},
      set(v){
        readyValue=(async()=>{
          const allowed=await guardPromise;
          if(!allowed)return await new Promise(()=>{});
          return await v;
        })();
      }
    });
  }catch(_){}
})();

/* Global add-ons SIMANIS. */
(function(){
  const files = [
    "global-mobile-nav.js",
    "global-sidebar-route-fix.js",
    "dashboard-guru-personal-v5.js",
    "pretty-news-links.js",
    "public-finish.js",
    "absensi-guru-card-addon.js",
    "absensi-siswa-edit-addon.js",
    "finalization-tools-addon.js"
  ];

  files.forEach(src => {
    if (document.querySelector(`script[data-simanis-addon="${src}"]`)) return;
    const s = document.createElement("script");
    s.src = src;
    s.defer = true;
    s.dataset.simanisAddon = src;
    document.head.appendChild(s);
  });
})();
