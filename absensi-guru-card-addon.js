(function(){
  const page=(location.pathname.split("/").pop()||"").toLowerCase();
  if(page!=="absensi-guru.html")return;

  async function boot(){
    try{
      const api=await window.simanisReady;
      const user=await api.auth.getUser();
      if(!user)return;

      const rows=await api.db.select(
        "profiles",
        `select=role,is_active&id=eq.${encodeURIComponent(user.id)}&limit=1`
      );

      const p=rows?.[0];
      if(!p?.is_active || !["SUPER_ADMIN","TU","WAKA_KURIKULUM"].includes(p.role))return;

      const head=document.querySelector(".page-head");
      if(!head || document.getElementById("teacherCardTools"))return;

      const tools=document.createElement("div");
      tools.id="teacherCardTools";
      tools.style.cssText="display:flex;gap:8px;flex-wrap:wrap";

      tools.innerHTML=`
        <a href="absensi-guru-kiosk.html" style="text-decoration:none;background:#075b3a;color:white;border-radius:10px;padding:10px 13px;font-size:10px;font-weight:800">Kiosk Scanner</a>
        <a href="kartu-guru.html" style="text-decoration:none;background:white;color:#075b3a;border:1px solid #d7e2dc;border-radius:10px;padding:10px 13px;font-size:10px;font-weight:800">Kartu Guru</a>
      `;

      head.appendChild(tools);
    }catch(err){
      console.warn("SIMANIS teacher-card addon:",err);
    }
  }

  boot();
})();
