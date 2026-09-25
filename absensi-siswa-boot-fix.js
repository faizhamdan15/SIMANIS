(function(){
  const file=(location.pathname.split("/").pop()||"").toLowerCase();
  if(file!=="absensi-siswa.html")return;

  const VERSION="SIMANIS Absensi Siswa Boot Fix V6";
  const OVERLAY_WATCHDOG_MS=9000;
  const READ_RPC_TIMEOUT_MS=12000;

  const READ_RPCS=new Set([
    "get_my_modules",
    "get_my_attendance_classes",
    "get_my_scoped_schedule",
    "get_class_attendance_by_date",
    "get_my_attendance_subjects",
    "get_class_subject_attendance_by_date"
  ]);

  let overlayReleased=false;
  let rpcPatched=false;

  function overlay(){
    return document.getElementById("loading");
  }

  function isOverlayVisible(){
    const el=overlay();
    if(!el)return false;
    const s=getComputedStyle(el);
    return !el.classList.contains("hidden")
      && s.display!=="none"
      && s.visibility!=="hidden";
  }

  function hardHideOverlay(){
    const el=overlay();
    if(!el)return;
    el.classList.add("hidden");
    el.style.setProperty("display","none","important");
    el.setAttribute("aria-hidden","true");
    overlayReleased=true;
  }

  function esc(s){
    return String(s??"")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;");
  }

  function showBootNotice(title,message,detail=""){
    let box=document.getElementById("absensiSiswaBootFixNotice");
    if(!box){
      box=document.createElement("section");
      box.id="absensiSiswaBootFixNotice";
      box.style.cssText=[
        "margin:0 0 14px",
        "padding:12px 14px",
        "border:1px solid #efd28a",
        "background:#fff9e8",
        "color:#6c5007",
        "border-radius:14px",
        "font-size:10px",
        "line-height:1.55"
      ].join(";");

      const head=document.querySelector(".page-head");
      const main=document.querySelector(".main");

      if(head)head.insertAdjacentElement("afterend",box);
      else if(main)main.prepend(box);
      else document.body.appendChild(box);
    }

    box.innerHTML=`
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
        <div style="min-width:220px;flex:1">
          <strong style="display:block;font-size:11px;color:#704f00">${esc(title)}</strong>
          <div style="margin-top:3px">${esc(message)}</div>
          ${detail?`<div style="margin-top:5px;font-size:9px;opacity:.78">${esc(detail)}</div>`:""}
        </div>
        <button id="absensiSiswaBootReload" type="button"
          style="border:0;background:#075b3a;color:#fff;border-radius:9px;padding:8px 10px;font-size:9px;font-weight:800;cursor:pointer">
          Muat Ulang
        </button>
      </div>
    `;

    document.getElementById("absensiSiswaBootReload")?.addEventListener(
      "click",
      ()=>location.reload()
    );
  }

  function timeoutPromise(promise,ms,label){
    let timer;
    const timeout=new Promise((_,reject)=>{
      timer=setTimeout(()=>{
        reject(new Error(`${label} melewati batas waktu ${Math.round(ms/1000)} detik.`));
      },ms);
    });

    return Promise.race([Promise.resolve(promise),timeout])
      .finally(()=>clearTimeout(timer));
  }

  async function patchReadRpc(){
    if(rpcPatched)return;

    try{
      const api=await timeoutPromise(
        window.simanisReady,
        READ_RPC_TIMEOUT_MS,
        "Inisialisasi SIMANIS"
      );

      if(!api?.db?.rpc || rpcPatched)return;

      const originalRpc=api.db.rpc.bind(api.db);

      api.db.rpc=async function(name,params={}){
        const task=originalRpc(name,params);

        if(!READ_RPCS.has(String(name))){
          return task;
        }

        return timeoutPromise(
          task,
          READ_RPC_TIMEOUT_MS,
          `RPC ${name}`
        );
      };

      rpcPatched=true;
      window.SIMANIS_ABSENSI_SISWA_RPC_TIMEOUT_ACTIVE=true;

    }catch(err){
      console.warn(VERSION+": patch RPC tidak aktif:",err);

      if(isOverlayVisible()){
        hardHideOverlay();
        showBootNotice(
          "Absensi Siswa gagal menyelesaikan inisialisasi",
          "Overlay putih sudah dilepas agar halaman tidak terkunci.",
          err?.message||String(err)
        );
      }
    }
  }

  // Jika error JavaScript terjadi selagi overlay masih menutup layar,
  // tampilkan halaman dan tunjukkan error-nya daripada layar putih permanen.
  window.addEventListener("error",event=>{
    if(!isOverlayVisible())return;

    hardHideOverlay();
    showBootNotice(
      "Terjadi error saat memuat Absensi Siswa",
      "Overlay putih dilepas. Silakan lihat halaman atau muat ulang.",
      event?.message||"JavaScript error"
    );
  });

  window.addEventListener("unhandledrejection",event=>{
    if(!isOverlayVisible())return;

    hardHideOverlay();
    const reason=event?.reason?.message||String(event?.reason||"Promise error");

    showBootNotice(
      "Proses awal Absensi Siswa terhenti",
      "Overlay putih dilepas agar halaman tetap dapat digunakan.",
      reason
    );
  });

  // Watchdog terakhir. Ini tidak mengubah database/data absensi.
  // Bila proses loading normal, overlay sudah hilang sebelum timer ini.
  setTimeout(()=>{
    if(!isOverlayVisible())return;

    hardHideOverlay();
    showBootNotice(
      "Loading terlalu lama",
      "Overlay putih otomatis dilepas setelah 9 detik.",
      "Jika daftar kelas atau mata pelajaran belum tampil, klik Muat Ulang."
    );
  },OVERLAY_WATCHDOG_MS);

  patchReadRpc();

  window.SIMANIS_ABSENSI_SISWA_BOOT_FIX=VERSION;
})();