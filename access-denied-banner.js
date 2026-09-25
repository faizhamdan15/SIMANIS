(function(){
  const file=(location.pathname.split("/").pop()||"").toLowerCase();
  if(file!=="dashboard.html")return;

  function esc(s){
    return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
  }

  function render(){
    const q=new URLSearchParams(location.search);
    const moduleCode=q.get("access_denied");
    const reason=q.get("reason");
    const from=q.get("from");

    if(!moduleCode)return;

    const main=document.querySelector(".main");
    if(!main)return;

    const messages={
      permission:"Akun Anda tidak memiliki hak untuk membuka halaman tersebut.",
      update_required:"Halaman tersebut hanya dapat digunakan oleh akun yang memiliki izin Kelola/Update.",
      homeroom_required:"Workspace Wali Kelas hanya tersedia untuk guru yang sedang menjadi wali kelas aktif.",
      invalid_route:"Alamat workspace tidak valid.",
      verification:"SIMANIS tidak dapat memverifikasi hak akses halaman tersebut dengan aman."
    };

    const box=document.createElement("section");
    box.style.cssText="margin:0 0 14px;padding:13px 15px;border:1px solid #f0d7a2;background:#fff9e9;border-radius:14px;color:#6f5215";
    box.innerHTML=`
      <div style="font-size:10px;font-weight:900">AKSES DIBATASI</div>
      <div style="font-size:11px;font-weight:700;margin-top:4px">${esc(messages[reason]||messages.permission)}</div>
      <div style="font-size:9px;margin-top:4px;opacity:.78">Modul: ${esc(moduleCode)}${from?` · Halaman: ${esc(from)}`:""}</div>
    `;
    main.prepend(box);

    q.delete("access_denied");
    q.delete("reason");
    q.delete("from");
    const qs=q.toString();
    history.replaceState(null,"",location.pathname+(qs?`?${qs}`:""));
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",render,{once:true});
  else render();
})();