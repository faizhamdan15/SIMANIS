window.SIMANIS_CONFIG = {
  SUPABASE_URL: "https://zevdqmrlcrnwkeqejbxm.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_wq4BZQjDm33hVB6E6QISuA_cQP7xmEH"
};

/*
 * SIMANIS FINALISASI SECURITY GATE V1
 *
 * Dipasang dari config.js SEBELUM sdk-loader.js.
 * Setter simanisReady membungkus SDK Promise sehingga halaman privat
 * belum menerima API sampai session + profile + permission diverifikasi.
 */
(function installSimanisSecurityGate(){
  const RULES={
    "dashboard.html":{module:"DASHBOARD"},
    "administrasi.html":{module:"ADMINISTRASI_KEPALA"},
    "siswa.html":{module:"DATA_SISWA"},
    "guru.html":{module:"DATA_GURU"},
    "kelas.html":{module:"KELAS"},
    "mapel.html":{module:"MATA_PELAJARAN"},
    "jadwal.html":{module:"JADWAL"},
    "absensi-guru.html":{module:"ABSENSI_GURU"},
    "absensi-guru-kiosk.html":{module:"ABSENSI_GURU",require:"update"},
    "absensi-guru-riwayat.html":{module:"ABSENSI_GURU",require:"update"},
    "kartu-guru.html":{module:"ABSENSI_GURU"},
    "absensi-siswa.html":{module:"ABSENSI_SISWA"},
    "absensi-siswa-riwayat.html":{module:"ABSENSI_SISWA",require:"update"},
    "wali-kelas.html":{module:"DATA_SISWA",homeroom:true},
    "nilai.html":{module:"NILAI"},
    "prestasi.html":{module:"PRESTASI"},
    "berita.html":{module:"BERITA"},
    "pengumuman.html":{module:"PENGUMUMAN"},
    "agenda.html":{module:"AGENDA"},
    "keuangan.html":{module:"KEUANGAN"},
    "wali-admin.html":{module:"PORTAL_WALI"},
    "pengaturan.html":{module:"PENGATURAN",superAdminOnly:true},
    "akses-audit.html":{module:"PENGATURAN",superAdminOnly:true},
    "account-security.html":{authOnly:true}
  };

  const file=(location.pathname.split("/").pop()||"index.html").toLowerCase();
  let rule=RULES[file]||null;

  if(file==="unit-kerja.html"){
    const unit=(new URLSearchParams(location.search).get("unit")||"").toUpperCase();
    rule=unit?{module:unit}:{invalid:true};
  }

  // Halaman publik dan Portal Wali eksternal tidak memakai gate staf ini.
  if(!rule)return;

  let storedReady;

  function esc(s){
    return String(s??"")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;");
  }

  function freeze(){
    return new Promise(()=>{});
  }

  function renderHardBlock(title,detail){
    const render=()=>{
      if(!document.body)return;
      document.body.innerHTML=`
        <main style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#f4f8f5;font-family:Inter,Arial,sans-serif">
          <section style="max-width:520px;width:100%;background:white;border:1px solid #dfe8e3;border-radius:22px;padding:28px;box-shadow:0 18px 50px rgba(7,91,58,.12)">
            <div style="width:48px;height:48px;border-radius:14px;display:grid;place-items:center;background:#fff0ed;color:#9b342a;font-weight:900">!</div>
            <h1 style="font-size:20px;color:#153c2d;margin:16px 0 8px">${esc(title)}</h1>
            <p style="font-size:12px;line-height:1.7;color:#687a71;margin:0">${esc(detail)}</p>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:18px">
              <button onclick="location.reload()" style="border:0;border-radius:10px;padding:10px 13px;background:#075b3a;color:white;font-weight:800;cursor:pointer">Muat Ulang</button>
              <button onclick="location.href='index.html'" style="border:1px solid #d7e2dc;border-radius:10px;padding:10px 13px;background:white;color:#075b3a;font-weight:800;cursor:pointer">Halaman Login</button>
            </div>
          </section>
        </main>`;
    };

    if(document.body)render();
    else document.addEventListener("DOMContentLoaded",render,{once:true});
  }

  function redirectDenied(moduleCode,reason){
    if(file==="dashboard.html"){
      renderHardBlock(
        "Verifikasi hak akses gagal",
        reason==="permission"
          ?"Akun ini tidak memiliki izin membuka Dashboard."
          :"SIMANIS tidak dapat memverifikasi hak akses dengan aman. Muat ulang halaman atau hubungi administrator."
      );
      return false;
    }

    const q=new URLSearchParams({
      access_denied:moduleCode||"UNKNOWN",
      from:file,
      reason:reason||"permission"
    });

    location.replace(`dashboard.html?${q.toString()}`);
    return false;
  }

  async function verify(api){
    if(!api?.auth || !api?.db){
      renderHardBlock("Security Gate gagal","API SIMANIS tidak tersedia.");
      return false;
    }

    let session;
    try{
      session=await api.auth.getSession();
    }catch(_){
      session=null;
    }

    if(!session?.access_token){
      location.replace("index.html");
      return false;
    }

    let user;
    try{
      user=await api.auth.getUser();
    }catch(_){
      user=null;
    }

    if(!user?.id){
      location.replace("index.html");
      return false;
    }

    let profile;
    try{
      const rows=await api.db.select(
        "profiles",
        `select=id,full_name,role,is_active&id=eq.${encodeURIComponent(user.id)}&limit=1`
      );
      profile=rows?.[0]||null;
    }catch(err){
      console.error("SIMANIS Security Gate profile:",err);
      return redirectDenied(rule.module,"verification");
    }

    if(!profile?.is_active){
      try{await api.auth.signOut()}catch(_){}
      location.replace("index.html");
      return false;
    }

    window.SIMANIS_SECURITY_PROFILE=profile;

    if(rule.authOnly)return true;

    if(rule.invalid){
      return redirectDenied("UNIT_KERJA","invalid_route");
    }

    if(rule.superAdminOnly && profile.role!=="SUPER_ADMIN"){
      return redirectDenied(rule.module,"permission");
    }

    // SUPER_ADMIN adalah full access by design.
    let perm={
      can_view:true,
      can_create:true,
      can_update:true,
      can_delete:true
    };

    if(profile.role!=="SUPER_ADMIN"){
      try{
        perm=await api.db.rpc("get_my_module_permission",{
          p_module_code:rule.module
        });
      }catch(err){
        console.error("SIMANIS Security Gate permission:",err);
        return redirectDenied(rule.module,"verification");
      }

      if(!perm || perm.can_view!==true){
        return redirectDenied(rule.module,"permission");
      }

      if(rule.require==="update" && perm.can_update!==true){
        return redirectDenied(rule.module,"update_required");
      }
    }

    if(rule.homeroom){
      try{
        const ctx=await api.db.rpc("get_my_homeroom_context",{});
        if(!ctx?.has_homeroom){
          return redirectDenied("WALI_KELAS","homeroom_required");
        }
      }catch(err){
        console.error("SIMANIS Security Gate homeroom:",err);
        return redirectDenied("WALI_KELAS","verification");
      }
    }

    window.SIMANIS_SECURITY_PERMISSION=perm;
    return true;
  }

  try{
    Object.defineProperty(window,"simanisReady",{
      configurable:true,
      enumerable:true,
      get(){return storedReady},
      set(value){
        storedReady=Promise.resolve(value).then(async api=>{
          const allowed=await verify(api);
          if(!allowed)return await freeze();
          return api;
        });
      }
    });
  }catch(err){
    console.error("SIMANIS Security Gate install:",err);
  }
})();

/* Global add-ons SIMANIS. */
(function(){
  const files = [
    "global-mobile-nav.js",
    "global-sidebar-route-fix.js",
    "access-denied-banner.js",
    "security-admin-addon.js",
    "dashboard-guru-personal-v5.js",
    "pretty-news-links.js",
    "public-finish.js",
    "absensi-guru-card-addon.js",
    "absensi-siswa-edit-addon.js"
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
