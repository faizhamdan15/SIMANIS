window.SIMANIS_CONFIG = {
  SUPABASE_URL: "https://zevdqmrlcrnwkeqejbxm.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_wq4BZQjDm33hVB6E6QISuA_cQP7xmEH"
};

/* Load global mobile navigation for internal SIMANIS pages.
   Public portal/login remain untouched because the helper only activates
   when .app + .sidebar + .topbar exist on the page. */
(function(){
  if (document.querySelector('script[data-simanis-global-mobile-nav]')) return;
  const s = document.createElement("script");
  s.src = "global-mobile-nav.js";
  s.defer = true;
  s.dataset.simanisGlobalMobileNav = "true";
  document.head.appendChild(s);
})();
