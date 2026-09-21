window.SIMANIS_CONFIG = {
  SUPABASE_URL: "https://zevdqmrlcrnwkeqejbxm.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_wq4BZQjDm33hVB6E6QISuA_cQP7xmEH"
};

/* Global add-ons SIMANIS. */
(function(){
  const files = [
    "global-mobile-nav.js",
    "dashboard-guru-personal-v5.js",
    "pretty-news-links.js",
    "public-finish.js",
    "absensi-guru-card-addon.js"
  ];

  files.forEach(src => {
    if (document.querySelector(`script[data-simanis-addon="${src}"]`)) return;
    const s = document.createElement("script");
    s.src = src;
    s.defer = true;
    s.dataset.simanisAddon = src;
    document.head.appendChild(s);
  });
})();
