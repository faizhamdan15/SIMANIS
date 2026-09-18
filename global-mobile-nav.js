(function(){
  "use strict";

  const STYLE_ID = "simanis-global-mobile-nav-style";
  const BODY_OPEN = "simanis-menu-open";

  function injectStyles(){
    if(document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .simanis-mobile-menu-toggle,
      .simanis-mobile-menu-close,
      .simanis-mobile-menu-backdrop{
        display:none;
      }

      @media(max-width:760px){
        html,body{
          overflow-x:hidden;
        }

        .app{
          display:block !important;
          min-height:100vh;
        }

        .content{
          width:100% !important;
          min-width:0 !important;
        }

        .sidebar{
          position:fixed !important;
          top:0 !important;
          left:0 !important;
          bottom:0 !important;
          width:min(84vw,310px) !important;
          height:100dvh !important;
          z-index:1200 !important;
          overflow-y:auto !important;
          padding-top:22px !important;
          transform:translateX(-105%);
          transition:transform .24s ease;
          box-shadow:18px 0 45px rgba(0,0,0,.22);
        }

        body.${BODY_OPEN} .sidebar{
          transform:translateX(0);
        }

        body.${BODY_OPEN}{
          overflow:hidden;
        }

        .simanis-mobile-menu-backdrop{
          display:block;
          position:fixed;
          inset:0;
          z-index:1190;
          background:rgba(3,25,17,.48);
          opacity:0;
          visibility:hidden;
          pointer-events:none;
          transition:opacity .2s ease,visibility .2s ease;
        }

        body.${BODY_OPEN} .simanis-mobile-menu-backdrop{
          opacity:1;
          visibility:visible;
          pointer-events:auto;
        }

        .simanis-mobile-menu-toggle{
          display:inline-grid !important;
          width:42px;
          height:42px;
          place-items:center;
          flex:0 0 auto;
          border:1px solid rgba(255,255,255,.24);
          border-radius:11px;
          padding:0;
          background:rgba(255,255,255,.10);
          color:#fff;
          cursor:pointer;
        }

        .simanis-mobile-menu-toggle svg{
          width:22px;
          height:22px;
          display:block;
        }

        .simanis-mobile-menu-close{
          display:grid;
          place-items:center;
          position:absolute;
          top:13px;
          right:12px;
          width:36px;
          height:36px;
          border-radius:10px;
          border:1px solid rgba(255,255,255,.18);
          background:rgba(255,255,255,.08);
          color:#fff;
          cursor:pointer;
          z-index:2;
        }

        .simanis-mobile-menu-close svg{
          width:19px;
          height:19px;
        }

        .side-brand{
          padding-right:46px !important;
        }

        #sidebarMenu{
          display:flex !important;
          flex-direction:column !important;
          grid-template-columns:none !important;
          gap:5px !important;
        }

        .nav-item{
          min-height:44px;
        }

        .topbar{
          min-height:76px !important;
          padding:13px 16px !important;
          display:grid !important;
          grid-template-columns:42px minmax(0,1fr) auto;
          gap:11px;
          align-items:center !important;
        }

        .topbar > div:first-of-type{
          min-width:0;
        }

        .topbar h1{
          font-size:22px !important;
          line-height:1.05;
          white-space:nowrap;
        }

        .topbar p{
          font-size:10px !important;
          line-height:1.35;
          margin-top:4px !important;
          white-space:normal;
        }

        .topbar-right{
          max-width:145px;
          text-align:right !important;
        }

        .topbar-right strong{
          font-size:10.5px !important;
          line-height:1.3;
        }

        .topbar-right span{
          font-size:9px !important;
          line-height:1.35;
        }

        .main{
          padding:16px !important;
        }

        .page-head,
        .dash-hero,
        .admin-hero,
        .unit-hero,
        .wk-hero{
          margin-top:0 !important;
        }
      }

      @media(max-width:470px){
        .topbar{
          grid-template-columns:42px minmax(0,1fr) !important;
        }

        .topbar-right{
          grid-column:2;
          max-width:none;
          text-align:left !important;
          margin-top:-4px;
        }

        .topbar-right strong,
        .topbar-right span{
          display:inline !important;
          margin-right:7px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function setup(){
    const sidebar = document.querySelector(".sidebar");
    const topbar = document.querySelector(".topbar");
    const app = document.querySelector(".app");

    // Public portal and login pages do not use this internal app shell.
    if(!app || !sidebar || !topbar) return;

    injectStyles();

    // Dashboard may still have the older V1 helper installed.
    // If so, let it control that page and avoid duplicate buttons.
    if(document.getElementById("simanisMobileMenuToggle")) return;
    if(document.getElementById("simanisGlobalMobileMenuToggle")) return;

    const toggle = document.createElement("button");
    toggle.id = "simanisGlobalMobileMenuToggle";
    toggle.className = "simanis-mobile-menu-toggle";
    toggle.type = "button";
    toggle.setAttribute("aria-label","Buka menu");
    toggle.setAttribute("aria-expanded","false");
    toggle.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round">
        <path d="M4 7h16M4 12h16M4 17h16"/>
      </svg>
    `;
    topbar.insertBefore(toggle,topbar.firstChild);

    const close = document.createElement("button");
    close.className = "simanis-mobile-menu-close";
    close.type = "button";
    close.setAttribute("aria-label","Tutup menu");
    close.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round">
        <path d="M6 6l12 12M18 6 6 18"/>
      </svg>
    `;
    sidebar.insertBefore(close,sidebar.firstChild);

    const backdrop = document.createElement("div");
    backdrop.className = "simanis-mobile-menu-backdrop";
    backdrop.setAttribute("aria-hidden","true");
    document.body.appendChild(backdrop);

    function openMenu(){
      document.body.classList.add(BODY_OPEN);
      toggle.setAttribute("aria-expanded","true");
      toggle.setAttribute("aria-label","Tutup menu");
    }

    function closeMenu(){
      document.body.classList.remove(BODY_OPEN);
      toggle.setAttribute("aria-expanded","false");
      toggle.setAttribute("aria-label","Buka menu");
    }

    toggle.addEventListener("click",()=>{
      document.body.classList.contains(BODY_OPEN) ? closeMenu() : openMenu();
    });

    close.addEventListener("click",closeMenu);
    backdrop.addEventListener("click",closeMenu);

    sidebar.addEventListener("click",(event)=>{
      if(event.target.closest("a.nav-item")) closeMenu();
    });

    document.addEventListener("keydown",(event)=>{
      if(event.key==="Escape") closeMenu();
    });

    window.addEventListener("resize",()=>{
      if(window.innerWidth>760) closeMenu();
    });
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",setup,{once:true});
  }else{
    setup();
  }
})();