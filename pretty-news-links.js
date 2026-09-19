(function(){
  "use strict";

  function cleanSlug(slug){
    return String(slug || "").replace(/-\d{7}$/,"");
  }

  function rewriteLinks(root=document){
    const scope=root?.querySelectorAll ? root : document;
    scope.querySelectorAll('a[href*="berita-detail.html?slug="]').forEach(a=>{
      try{
        const u=new URL(a.getAttribute("href"),location.href);
        const slug=u.searchParams.get("slug");
        if(!slug) return;
        a.setAttribute("href",`/berita/${encodeURIComponent(cleanSlug(slug))}`);
      }catch(_){}
    });
  }

  function start(){
    rewriteLinks(document);

    const observer=new MutationObserver(records=>{
      for(const record of records){
        for(const node of record.addedNodes){
          if(node.nodeType!==1) continue;
          if(node.matches?.('a[href*="berita-detail.html?slug="]')){
            rewriteLinks(node.parentElement || document);
          }else{
            rewriteLinks(node);
          }
        }
      }
    });

    observer.observe(document.documentElement,{
      childList:true,
      subtree:true
    });
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",start,{once:true});
  }else{
    start();
  }
})();