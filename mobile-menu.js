(function(){
  "use strict";

  // Inject CSS immediately so the mobile sidebar never occupies the page on load.
  const style = document.createElement("style");
  style.id = "simanis-mobile-hamburger-style";
  style.textContent = `
    .mobile-menu-toggle,
    .mobile-menu-close,
    .mobile-menu-backdrop{display:none}

    @media (max-width:760px){
      html,body{overflow-x:hidden}

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
        transform:translateX(-105%);
        transition:transform .24s ease;
        box-shadow:18px 0 45px rgba(0,0,0,.22);
      }

      body.simanis-menu-open .sidebar{
        transform:translateX(0);
      }

      .mobile-menu-backdrop{
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

      body.simanis-menu-open .mobile-menu-backdrop{
        opacity:1;
        visibility:visible;
        pointer-events:auto;
      }

      body.simanis-menu-open{
        overflow:hidden;
      }

      .mobile-menu-toggle{
        width:42px;
        height:42px;
        border:1px solid rgba(255,255,255,.24);
        border-radius:11px;
        background:rgba(255,255,255,.10);
        color:#fff;
        padding:0;
        align-items:center;
        justify-content:center;
        cursor:pointer;
        flex:0 0 auto;
      }

      .mobile-menu-toggle svg{
        width:22px;
        height:22px;
        display:block;
      }

      .topbar .mobile-menu-toggle{
        display:inline-flex !important;
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

      .mobile-menu-close{
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

      .mobile-menu-close svg{
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
      }

      .nav-item{
        min-height:44px;
      }

      /* Dashboard langsung terlihat setelah topbar */
      .main{
        padding:16px !important;
      }

      .dash-hero{
        margin-top:0 !important;
      }
    }

    @media (max-width:470px){
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

  function setup(){
    const sidebar = document.querySelector(".sidebar");
    const topbar = document.querySelector(".topbar");
    if(!sidebar || !topbar || document.getElementById("simanisMobileMenuToggle")) return;

    const toggle = document.createElement("button");
    toggle.id = "simanisMobileMenuToggle";
    toggle.className = "mobile-menu-toggle";
    toggle.type = "button";
    toggle.setAttribute("aria-label","Buka menu");
    toggle.setAttribute("aria-expanded","false");
    toggle.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round">
        <path d="M4 7h16M4 12h16M4 17h16"/>
      </svg>`;
    topbar.insertBefore(toggle, topbar.firstChild);

    const close = document.createElement("button");
    close.className = "mobile-menu-close";
    close.type = "button";
    close.setAttribute("aria-label","Tutup menu");
    close.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round">
        <path d="M6 6l12 12M18 6 6 18"/>
      </svg>`;
    sidebar.insertBefore(close, sidebar.firstChild);

    const backdrop = document.createElement("div");
    backdrop.className = "mobile-menu-backdrop";
    backdrop.setAttribute("aria-hidden","true");
    document.body.appendChild(backdrop);

    const openMenu = ()=>{
      document.body.classList.add("simanis-menu-open");
      toggle.setAttribute("aria-expanded","true");
      toggle.setAttribute("aria-label","Tutup menu");
    };

    const closeMenu = ()=>{
      document.body.classList.remove("simanis-menu-open");
      toggle.setAttribute("aria-expanded","false");
      toggle.setAttribute("aria-label","Buka menu");
    };

    toggle.addEventListener("click",()=>{
      document.body.classList.contains("simanis-menu-open") ? closeMenu() : openMenu();
    });
    close.addEventListener("click",closeMenu);
    backdrop.addEventListener("click",closeMenu);

    sidebar.addEventListener("click",(e)=>{
      if(e.target.closest("a.nav-item")) closeMenu();
    });

    document.addEventListener("keydown",(e)=>{
      if(e.key==="Escape") closeMenu();
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