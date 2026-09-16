(function () {
  const urls = [
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
    "https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.js"
  ];

  window.simanisReady = new Promise((resolve, reject) => {
    let i = 0;

    function tryNext() {
      if (window.supabase && window.supabase.createClient) {
        init();
        return;
      }

      if (i >= urls.length) {
        reject(new Error("Library Supabase gagal dimuat. Periksa koneksi internet lalu muat ulang halaman."));
        return;
      }

      const s = document.createElement("script");
      s.src = urls[i++];
      s.async = true;
      s.onload = () => {
        if (window.supabase && window.supabase.createClient) init();
        else tryNext();
      };
      s.onerror = tryNext;
      document.head.appendChild(s);
    }

    function init() {
      try {
        const cfg = window.SIMANIS_CONFIG;
        if (!cfg?.SUPABASE_URL || !cfg?.SUPABASE_PUBLISHABLE_KEY) {
          throw new Error("Konfigurasi Supabase tidak ditemukan.");
        }

        const client = window.supabase.createClient(
          cfg.SUPABASE_URL,
          cfg.SUPABASE_PUBLISHABLE_KEY,
          {
            auth: {
              persistSession: true,
              autoRefreshToken: true,
              detectSessionInUrl: true,
              storageKey: "simanis-auth"
            }
          }
        );

        window.simanis = { supabase: client };
        resolve(window.simanis);
      } catch (err) {
        reject(err);
      }
    }

    tryNext();
  });
})();
