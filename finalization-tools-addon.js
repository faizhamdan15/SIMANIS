(function(){
  const page=(location.pathname.split("/").pop()||"").toLowerCase();
  if(page!=="pengaturan.html")return;

  function addButton(){
    const head=document.querySelector(".page-head");
    if(!head || document.getElementById("simanisAccessAuditBtn"))return;

    const actions=head.lastElementChild || head;
    const a=document.createElement("a");
    a.id="simanisAccessAuditBtn";
    a.href="akses-audit.html";
    a.textContent="Audit Hak Akses";
    a.className="secondary-btn";
    a.style.cssText="text-decoration:none;display:inline-flex;align-items:center;justify-content:center;margin-left:8px";
    actions.appendChild(a);
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",addButton,{once:true});
  }else{
    addButton();
  }
})();