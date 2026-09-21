(() => {
  "use strict";

  const SITE = "https://www.manuriska.sch.id";
  const PUBLIC_PATHS = new Set([
    "/", "/index.html", "/profil.html", "/berita-publik.html",
    "/prestasi-publik.html", "/pengumuman-publik.html",
    "/agenda-publik.html", "/404.html"
  ]);

  const path = location.pathname || "/";
  if (!PUBLIC_PATHS.has(path)) return;

  const pageMeta = {
    "/": {
      title: "MA Nurul Islam — Karangcempaka",
      description: "Website resmi MA Nurul Islam Karangcempaka, Bluto, Sumenep. Pendidikan, sains, riset, prestasi, berita, pengumuman, dan agenda madrasah.",
      canonical: "/"
    },
    "/index.html": {
      title: "MA Nurul Islam — Karangcempaka",
      description: "Website resmi MA Nurul Islam Karangcempaka, Bluto, Sumenep. Pendidikan, sains, riset, prestasi, berita, pengumuman, dan agenda madrasah.",
      canonical: "/"
    },
    "/profil.html": {
      title: "Profil Madrasah — MA Nurul Islam",
      description: "Profil MA Nurul Islam Karangcempaka, Bluto, Sumenep: sejarah, identitas, visi, misi, tujuan pendidikan, serta lingkungan belajar.",
      canonical: "/profil.html"
    },
    "/berita-publik.html": {
      title: "Berita Madrasah — MA Nurul Islam",
      description: "Berita, kegiatan, inovasi, riset, dan prestasi terbaru MA Nurul Islam Karangcempaka.",
      canonical: "/berita-publik.html"
    },
    "/prestasi-publik.html": {
      title: "Prestasi — MA Nurul Islam",
      description: "Capaian akademik, riset, seni, literasi, dan kompetisi siswa MA Nurul Islam Karangcempaka.",
      canonical: "/prestasi-publik.html"
    },
    "/pengumuman-publik.html": {
      title: "Pengumuman — MA Nurul Islam",
      description: "Pengumuman resmi MA Nurul Islam Karangcempaka untuk siswa, wali santri, alumni, dan masyarakat.",
      canonical: "/pengumuman-publik.html"
    },
    "/agenda-publik.html": {
      title: "Agenda Madrasah — MA Nurul Islam",
      description: "Agenda dan kegiatan publik MA Nurul Islam Karangcempaka lengkap dengan waktu, lokasi, kategori, dan penanggung jawab.",
      canonical: "/agenda-publik.html"
    },
    "/404.html": {
      title: "Halaman Tidak Ditemukan — MA Nurul Islam",
      description: "Halaman yang Anda cari tidak tersedia.",
      canonical: "/404.html",
      noindex: true
    }
  };

  const meta = pageMeta[path] || pageMeta["/"];
  const abs = p => `${SITE}${p.startsWith("/") ? p : `/${p}`}`;
  const head = document.head;

  function ensureMeta(selector, attrs) {
    let el = head.querySelector(selector);
    if (!el) {
      el = document.createElement("meta");
      head.appendChild(el);
    }
    Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k,v));
    return el;
  }

  function ensureLink(selector, attrs) {
    let el = head.querySelector(selector);
    if (!el) {
      el = document.createElement("link");
      head.appendChild(el);
    }
    Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k,v));
    return el;
  }

  document.title = meta.title;

  ensureMeta('meta[name="description"]', {name:"description", content:meta.description});
  ensureMeta('meta[name="theme-color"]', {name:"theme-color", content:"#075B3A"});
  ensureMeta('meta[name="color-scheme"]', {name:"color-scheme", content:"light"});
  ensureMeta('meta[name="robots"]', {
    name:"robots",
    content: meta.noindex ? "noindex,follow" : "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"
  });

  const canonicalURL = abs(meta.canonical);
  ensureLink('link[rel="canonical"]', {rel:"canonical", href:canonicalURL});
  ensureLink('link[rel="manifest"]', {rel:"manifest", href:"/site.webmanifest"});
  ensureLink('link[rel="icon"][sizes="32x32"]', {rel:"icon", type:"image/png", sizes:"32x32", href:"/icons/favicon-32x32.png"});
  ensureLink('link[rel="icon"][sizes="16x16"]', {rel:"icon", type:"image/png", sizes:"16x16", href:"/icons/favicon-16x16.png"});
  ensureLink('link[rel="apple-touch-icon"]', {rel:"apple-touch-icon", sizes:"180x180", href:"/icons/apple-touch-icon.png"});

  const og = [
    ["og:type","website"],
    ["og:site_name","MA Nurul Islam Karangcempaka"],
    ["og:locale","id_ID"],
    ["og:title",meta.title],
    ["og:description",meta.description],
    ["og:url",canonicalURL],
    ["og:image",`${SITE}/hero-madrasah.webp`],
    ["og:image:alt","MA Nurul Islam Karangcempaka"]
  ];
  og.forEach(([property,content]) => ensureMeta(`meta[property="${property}"]`, {property,content}));

  [
    ["twitter:card","summary_large_image"],
    ["twitter:title",meta.title],
    ["twitter:description",meta.description],
    ["twitter:image",`${SITE}/hero-madrasah.webp`]
  ].forEach(([name,content]) => ensureMeta(`meta[name="${name}"]`, {name,content}));

  ensureLink('link[data-public-finish-css]', {
    rel:"stylesheet",
    href:"/public-finish.css?v=1",
    "data-public-finish-css":"1"
  });

  // EducationalOrganization structured data on core identity pages.
  if (path === "/" || path === "/index.html" || path === "/profil.html") {
    if (!head.querySelector('script[data-simanis-org-schema]')) {
      const schema = document.createElement("script");
      schema.type = "application/ld+json";
      schema.dataset.simanisOrgSchema = "1";
      schema.textContent = JSON.stringify({
        "@context":"https://schema.org",
        "@type":"EducationalOrganization",
        "name":"MA Nurul Islam Karangcempaka",
        "alternateName":"MA Nurul Islam",
        "url":SITE,
        "logo":`${SITE}/logo.png`,
        "image":`${SITE}/hero-madrasah.webp`,
        "email":"psbnuriska@gmail.com",
        "telephone":"+62 877-5373-7923",
        "address":{
          "@type":"PostalAddress",
          "streetAddress":"Jl. KH. Moh. Sirajuddin No. 03",
          "addressLocality":"Karangcempaka, Bluto",
          "addressRegion":"Sumenep, Jawa Timur",
          "postalCode":"69466",
          "addressCountry":"ID"
        }
      });
      head.appendChild(schema);
    }
  }

  function enhanceImages(root=document) {
    root.querySelectorAll("img").forEach(img => {
      const src = img.getAttribute("src") || "";
      const isHero = src.includes("hero-madrasah") || img.closest(".hero-v5-photo,.profile-hero,.hero-photo");
      const isLogo = src.endsWith("logo.png");
      img.decoding = "async";
      if (!isHero && !isLogo && !img.hasAttribute("loading")) img.loading = "lazy";
      if (isHero && !img.hasAttribute("fetchpriority")) img.setAttribute("fetchpriority","high");
    });
  }

  function markLoadingStates(root=document) {
    const nodes = root.querySelectorAll(".empty,.home-empty,.px-empty,.ax-empty,.news-empty,.empty-achievement,.empty-state");
    nodes.forEach(el => {
      const txt = (el.textContent || "").trim().toLowerCase();
      el.classList.toggle("simanis-loading-state", txt.startsWith("memuat"));
    });
  }

  function accessibility() {
    if (!document.querySelector(".simanis-skip-link")) {
      const skip = document.createElement("a");
      skip.className = "simanis-skip-link";
      skip.href = "#main-content";
      skip.textContent = "Lewati ke konten utama";
      document.body.prepend(skip);
    }

    const main = document.querySelector("main");
    if (main && !main.id) main.id = "main-content";

    document.querySelectorAll(".nav-links a.active").forEach(a => a.setAttribute("aria-current","page"));

    document.querySelectorAll('a[target="_blank"]').forEach(a => {
      const rel = new Set((a.getAttribute("rel") || "").split(/\s+/).filter(Boolean));
      rel.add("noopener");
      rel.add("noreferrer");
      a.setAttribute("rel",[...rel].join(" "));
    });
  }

  function observeDynamicContent() {
    const observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        m.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          enhanceImages(node);
          markLoadingStates(node);
        });
      }
      markLoadingStates();
    });
    observer.observe(document.body,{childList:true,subtree:true});
  }

  function init() {
    accessibility();
    enhanceImages();
    markLoadingStates();
    observeDynamicContent();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded",init,{once:true});
  } else {
    init();
  }
})();
