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

  let api=null;
  let modules=[];
  let fixing=false;

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

      const byName=new Map(
        mods.map(m=>[normalizeText(m.name),m])
      );

      [...menu.querySelectorAll("a.nav-item")].forEach(a=>{
        const label=normalizeText(a.textContent);
        const mod=byName.get(label);
        if(!mod)return;

        const target=ROUTES[mod.code];
        if(!target)return;

        const shouldStripBrokenHandler=
          a.getAttribute("href")==="#" ||
          a.getAttribute("href")==="" ||
          !a.getAttribute("href");

        if(shouldStripBrokenHandler){
          const clone=a.cloneNode(true);
          clone.setAttribute("href",target);
          clone.removeAttribute("onclick");
          a.replaceWith(clone);
        }else{
          a.setAttribute("href",target);
          a.removeAttribute("onclick");
        }
      });
    }finally{
      fixing=false;
    }
  }

  function boot(){
    const menu=document.getElementById("sidebarMenu");
    if(menu){
      const observer=new MutationObserver(()=>fixSidebar());
      observer.observe(menu,{childList:true,subtree:true});
      fixSidebar();
    }else{
      setTimeout(boot,120);
    }
  }

  boot();
})();