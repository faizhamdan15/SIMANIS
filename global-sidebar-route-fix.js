(function(){
  const ROUTES={
    DASHBOARD:"dashboard.html",
    ADMINISTRASI_KEPALA:"administrasi.html",
    DATA_SISWA:"siswa.html",
    DATA_GURU:"guru.html",
    KELAS:"kelas.html",
    MATA_PELAJARAN:"mapel.html",
    JADWAL:"jadwal.html",
    ABSENSI_GURU:"absensi-guru.html",
    ABSENSI_SISWA:"absensi-siswa.html",
    NILAI:"nilai.html",
    PRESTASI:"prestasi.html",
    BERITA:"berita.html",
    PENGUMUMAN:"pengumuman.html",
    AGENDA:"agenda.html",
    KEUANGAN:"keuangan.html",
    PORTAL_WALI:"wali-admin.html",
    PENGATURAN:"pengaturan.html",
    PKM_KURIKULUM:"unit-kerja.html?unit=PKM_KURIKULUM",
    PKM_KESISWAAN:"unit-kerja.html?unit=PKM_KESISWAAN",
    PKM_BENDAHARA_SARPRAS:"unit-kerja.html?unit=PKM_BENDAHARA_SARPRAS",
    PKM_HUMASY:"unit-kerja.html?unit=PKM_HUMASY",
    KEPALA_TU:"unit-kerja.html?unit=KEPALA_TU",
    KALAB_IPA:"unit-kerja.html?unit=KALAB_IPA",
    KALAB_BISNIS:"unit-kerja.html?unit=KALAB_BISNIS"
  };

  let api=null,modules=[],fixing=false;

  function normalizeText(s){
    return String(s??"").replace(/\s+/g," ").trim().toLowerCase();
  }

  async function ensureModules(){
    if(modules.length)return modules;
    try{
      api=api||await window.simanisReady;
      modules=await api.db.rpc("get_my_modules",{})||[];
    }catch(err){
      console.warn("SIMANIS route normalizer: gagal membaca modul",err);
      modules=[];
    }
    return modules;
  }

  async function fixSidebar(){
    if(fixing)return;
    const menu=document.getElementById("sidebarMenu");
    if(!menu || !menu.children.length)return;

    fixing=true;
    try{
      const mods=await ensureModules();
      if(!mods.length)return;

      const byName=new Map(mods.map(m=>[normalizeText(m.name),m]));

      [...menu.querySelectorAll("a.nav-item")].forEach(a=>{
        const mod=byName.get(normalizeText(a.textContent));
        if(!mod)return;

        const target=ROUTES[mod.code];
        if(!target)return;

        a.setAttribute("href",target);
        a.removeAttribute("onclick");
      });
    }finally{
      fixing=false;
    }
  }

  function boot(){
    const menu=document.getElementById("sidebarMenu");
    if(!menu){setTimeout(boot,120);return}

    new MutationObserver(()=>fixSidebar())
      .observe(menu,{childList:true,subtree:true});

    fixSidebar();
  }

  boot();
})();