(function(){
  const FILE=(location.pathname.split("/").pop()||"index.html").toLowerCase();

  const MODULE_BY_FILE={
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
    "pengaturan.html":"PENGATURAN"
  };

  const UNIT_CODES=new Set([
    "PKM_KURIKULUM",
    "PKM_KESISWAAN",
    "PKM_BENDAHARA_SARPRAS",
    "PKM_HUMASY",
    "KEPALA_TU",
    "KALAB_IPA",
    "KALAB_BISNIS"
  ]);

  function currentModule(){
    if(FILE==="unit-kerja.html"){
      const unit=(new URLSearchParams(location.search).get("unit")||"").toUpperCase();
      return UNIT_CODES.has(unit)?unit:null;
    }
    return MODULE_BY_FILE[FILE]||null;
  }

  const moduleCode=currentModule();

  // Hanya halaman modul privat yang diproteksi addon ini.
  if(!moduleCode)return;

  let finished=false;
  let overlay=null;

  function showGate(text="Memverifikasi hak akses..."){
    document.documentElement.style.visibility="visible";

    if(!document.getElementById("simanisAccessGuardStyle")){
      const style=document.createElement("style");
      style.id="simanisAccessGuardStyle";
      style.textContent=`
        #simanisAccessGuard{
          position:fixed;inset:0;z-index:2147483647;
          display:grid;place-items:center;
          background:linear-gradient(145deg,#f5faf7,#eaf4ee);
          font-family:Inter,Arial,sans-serif;color:#17372c
        }
        #simanisAccessGuard .box{
          width:min(390px,calc(100% - 32px));
          background:#fff;border:1px solid #dce8e1;border-radius:20px;
          padding:24px;text-align:center;
          box-shadow:0 20px 60px rgba(6,61,44,.14)
        }
        #simanisAccessGuard .mark{
          width:52px;height:52px;border-radius:16px;
          display:grid;place-items:center;margin:0 auto 13px;
          background:#e8f5ee;color:#075b3a;font-weight:900;font-size:18px
        }
        #simanisAccessGuard strong{display:block;font-size:14px;color:#075b3a}
        #simanisAccessGuard span{display:block;margin-top:7px;font-size:10px;line-height:1.6;color:#6d7c74}
      `;
      document.head.appendChild(style);
    }

    overlay=document.getElementById("simanisAccessGuard");
    if(!overlay){
      overlay=document.createElement("div");
      overlay.id="simanisAccessGuard";
      overlay.innerHTML=`
        <div class="box">
          <div class="mark">S</div>
          <strong>SIMANIS</strong>
          <span id="simanisAccessGuardText"></span>
        </div>`;
      (document.body||document.documentElement).appendChild(overlay);
    }

    const t=document.getElementById("simanisAccessGuardText");
    if(t)t.textContent=text;
  }

  function hideGate(){
    finished=true;
    overlay?.remove();
    document.documentElement.style.visibility="";
  }

  function redirect(url){
    finished=true;
    location.replace(url);
  }

  async function verify(){
    showGate();

    try{
      const api=await window.simanisReady;

      const session=await api.auth.getSession();
      if(!session?.access_token){
        const next=encodeURIComponent(location.pathname+location.search);
        redirect(`index.html?login_required=1&next=${next}`);
        return;
      }

      const user=await api.auth.getUser();
      if(!user){
        redirect("index.html?login_required=1");
        return;
      }

      const profiles=await api.db.select(
        "profiles",
        `select=id,is_active,role&id=eq.${encodeURIComponent(user.id)}&limit=1`
      );

      const p=profiles?.[0];
      if(!p?.is_active){
        try{await api.auth.signOut()}catch(_){}
        redirect("index.html?account_inactive=1");
        return;
      }

      const perm=await api.db.rpc(
        "get_my_module_permission",
        {p_module_code:moduleCode}
      );

      // SUPER_ADMIN tetap harus melalui RPC; fallback role tidak digunakan
      // agar kegagalan verifikasi tidak berubah menjadi fail-open.
      if(perm?.can_view!==true){
        redirect(`dashboard.html?access_denied=${encodeURIComponent(moduleCode)}`);
        return;
      }

      // Subhalaman tertentu membutuhkan hak lebih tinggi dari sekadar view.
      if(
        ["absensi-guru-kiosk.html","absensi-guru-riwayat.html"].includes(FILE)
        && perm?.can_update!==true
      ){
        redirect("absensi-guru.html?access_denied=MANAGE");
        return;
      }

      hideGate();
    }catch(err){
      console.error("SIMANIS Direct Access Guard:",err);

      // FAIL CLOSED. Jangan membuka halaman bila hak akses tidak dapat diverifikasi.
      if(FILE==="dashboard.html"){
        showGate("Hak akses belum dapat diverifikasi. Muat ulang halaman atau login kembali.");
        setTimeout(()=>{
          if(!finished) location.replace("index.html?access_error=1");
        },3500);
      }else{
        redirect(`dashboard.html?access_error=${encodeURIComponent(moduleCode)}`);
      }
    }
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",verify,{once:true});
  }else{
    verify();
  }
})();