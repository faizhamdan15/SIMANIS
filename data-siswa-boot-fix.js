(function(){
  const file=(location.pathname.split("/").pop()||"").toLowerCase();
  if(file!=="siswa.html")return;

  const VERSION="SIMANIS Data Siswa Recovery V1";
  const SOURCE_URL="siswa.js";
  const WATCHDOG_MS=3500;

  function loadingEl(){
    return document.getElementById("loading");
  }

  function overlayVisible(){
    const el=loadingEl();
    if(!el)return false;
    const cs=getComputedStyle(el);
    return !el.classList.contains("hidden")
      && cs.display!=="none"
      && cs.visibility!=="hidden";
  }

  function hideOverlay(){
    const el=loadingEl();
    if(!el)return;
    el.classList.add("hidden");
    el.style.setProperty("display","none","important");
    el.setAttribute("aria-hidden","true");
  }

  function esc(s){
    return String(s??"")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;");
  }

  function notice(title,message,detail=""){
    let box=document.getElementById("dataSiswaRecoveryNotice");
    if(!box){
      box=document.createElement("section");
      box.id="dataSiswaRecoveryNotice";
      box.style.cssText=[
        "margin:0 0 14px","padding:12px 14px",
        "border:1px solid #efd28a","background:#fff9e8",
        "color:#6c5007","border-radius:14px",
        "font-size:10px","line-height:1.55"
      ].join(";");

      const head=document.querySelector(".page-head");
      const main=document.querySelector(".main");
      if(head)head.insertAdjacentElement("afterend",box);
      else if(main)main.prepend(box);
      else document.body.appendChild(box);
    }

    box.innerHTML=`
      <strong style="display:block;font-size:11px">${esc(title)}</strong>
      <div style="margin-top:3px">${esc(message)}</div>
      ${detail?`<div style="margin-top:5px;font-size:9px;opacity:.78">${esc(detail)}</div>`:""}
    `;
  }

  function compile(source,label){
    try{
      return {ok:true,fn:new Function(`${source}\n//# sourceURL=${label}`)};
    }catch(error){
      return {ok:false,error};
    }
  }

  async function recover(){
    try{
      /*
       * siswa.js production saat ini mempunyai syntax error di loadMaster():
       *
       * api.db.select("classes", ...)
       * api.db.select("semesters", ...)
       *
       * Elemen Promise.all pertama kehilangan koma.
       */
      const res=await fetch(`${SOURCE_URL}?recovery=${Date.now()}`,{
        cache:"no-store",
        credentials:"same-origin"
      });

      if(!res.ok)throw new Error(`siswa.js HTTP ${res.status}`);

      const source=await res.text();

      // Jika source sudah valid, jangan dieksekusi ulang.
      const original=compile(source,"siswa-original-check.js");
      if(original.ok){
        window.SIMANIS_DATA_SISWA_RECOVERY_STATUS="SOURCE_ALREADY_VALID";
        return;
      }

      const pattern=/(api\.db\.select\("classes","select=id,name,grade_level,homeroom_teacher_id&is_active=eq\.true&order=grade_level\.asc,name\.asc"\))(\s*)(api\.db\.select\("semesters")/;

      if(!pattern.test(source)){
        throw new Error(
          `Syntax error ditemukan tetapi pola perbaikan tidak cocok: ${original.error?.message||"unknown"}`
        );
      }

      const patched=source.replace(pattern,"$1,$2$3");
      const repaired=compile(patched,"siswa-recovered.js");

      if(!repaired.ok){
        throw repaired.error;
      }

      repaired.fn();

      window.SIMANIS_DATA_SISWA_RECOVERY_STATUS="RECOVERED";
      window.SIMANIS_DATA_SISWA_RECOVERY_VERSION=VERSION;

      console.warn(
        `${VERSION}: siswa.js dipulihkan sementara di browser. `+
        `Lakukan permanent fix dengan menambahkan koma pada Promise.all loadMaster().`
      );

    }catch(error){
      console.error(VERSION,error);

      if(overlayVisible())hideOverlay();

      notice(
        "Data Siswa gagal memuat",
        "Overlay putih sudah dilepas, tetapi script Data Siswa masih bermasalah.",
        error?.message||String(error)
      );

      window.SIMANIS_DATA_SISWA_RECOVERY_STATUS="FAILED";
    }
  }

  // Jika parser error siswa.js terjadi, halaman tidak menjalankan boot().
  // Tunggu sebentar; bila overlay masih terlihat, lakukan recovery source.
  setTimeout(()=>{
    if(overlayVisible())recover();
  },450);

  // Pengaman terakhir agar layar tidak terkunci putih tanpa informasi.
  setTimeout(()=>{
    if(!overlayVisible())return;
    hideOverlay();
    notice(
      "Loading Data Siswa terlalu lama",
      "Overlay putih otomatis dilepas.",
      "Muat ulang halaman setelah file perbaikan source dipasang."
    );
  },WATCHDOG_MS);

  window.SIMANIS_DATA_SISWA_RECOVERY_VERSION=VERSION;
})();