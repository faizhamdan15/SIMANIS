(function(){
  const PRIVATE_LOADING_TIMEOUT_MS=15000;

  function pageHasLoadingOverlay(){
    const el=document.getElementById("loading");
    if(!el)return false;
    return !el.classList.contains("hidden") && getComputedStyle(el).display!=="none";
  }

  function showRecovery(){
    if(document.getElementById("simanisLoadingRecovery"))return;

    const box=document.createElement("div");
    box.id="simanisLoadingRecovery";
    box.style.cssText=[
      "position:fixed","inset:0","z-index:100000",
      "display:grid","place-items:center","padding:24px",
      "background:rgba(244,248,245,.96)","font-family:Inter,Arial,sans-serif"
    ].join(";");

    box.innerHTML=`
      <section style="max-width:460px;width:100%;background:#fff;border:1px solid #dfe8e3;border-radius:20px;padding:24px;box-shadow:0 18px 50px rgba(7,91,58,.12)">
        <div style="width:44px;height:44px;border-radius:13px;display:grid;place-items:center;background:#fff4d7;color:#8a5a00;font-weight:900">!</div>
        <h2 style="font-size:17px;color:#153c2d;margin:14px 0 7px">Halaman terlalu lama dimuat</h2>
        <p style="font-size:11px;line-height:1.65;color:#687a71;margin:0">
          Koneksi atau proses inisialisasi SIMANIS belum selesai. Coba muat ulang halaman.
          Jika tetap terjadi, keluar lalu login kembali.
        </p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">
          <button id="simanisRetryBtn" style="border:0;border-radius:10px;padding:10px 13px;background:#075b3a;color:#fff;font-weight:800;cursor:pointer">Muat Ulang</button>
          <button id="simanisLoginBtn" style="border:1px solid #d7e2dc;border-radius:10px;padding:10px 13px;background:#fff;color:#075b3a;font-weight:800;cursor:pointer">Ke Login</button>
        </div>
      </section>
    `;

    document.body.appendChild(box);
    document.getElementById("simanisRetryBtn").onclick=()=>location.reload();
    document.getElementById("simanisLoginBtn").onclick=()=>location.href="index.html";
  }

  setTimeout(()=>{
    if(pageHasLoadingOverlay())showRecovery();
  },PRIVATE_LOADING_TIMEOUT_MS);
})();