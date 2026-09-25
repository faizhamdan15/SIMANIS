(function(){
  const file=(location.pathname.split("/").pop()||"").toLowerCase();
  if(file!=="pengaturan.html")return;

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
      if(!p?.is_active||p.role!=="SUPER_ADMIN")return;

      const head=document.querySelector(".page-head");
      if(!head||document.getElementById("securityAuditLink"))return;

      const a=document.createElement("a");
      a.id="securityAuditLink";
      a.href="akses-audit.html";
      a.textContent="Audit Hak Akses";
      a.style.cssText="text-decoration:none;background:#075b3a;color:white;border-radius:10px;padding:10px 13px;font-size:10px;font-weight:800";
      head.appendChild(a);
    }catch(err){
      console.warn("Security admin addon:",err);
    }
  }

  boot();
})();