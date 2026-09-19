const SUPABASE_URL = "https://zevdqmrlcrnwkeqejbxm.supabase.co";
const SUPABASE_KEY = "sb_publishable_wq4BZQjDm33hVB6E6QISuA_cQP7xmEH";
const SITE_URL = "https://www.manuriska.sch.id";
const NEWS_BUCKET = "berita-cover";

function esc(value){
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function stripHtml(value){
  return String(value ?? "")
    .replace(/<[^>]*>/g," ")
    .replace(/\s+/g," ")
    .trim();
}

function excerpt(value,max=220){
  const clean=stripHtml(value);
  return clean.length > max ? clean.slice(0,max).trim()+"…" : clean;
}

// Slug database SIMANIS lama memakai akhiran 7 digit dari Date.now().
// Akhiran itu tetap boleh tersimpan secara internal untuk menjaga unik,
// tetapi tidak perlu ditampilkan pada URL publik.
function publicSlug(slug){
  return String(slug || "").replace(/-\d{7}$/,"");
}

function coverUrl(path){
  if(!path) return `${SITE_URL}/hero-madrasah.webp`;
  const encoded=String(path).split("/").map(encodeURIComponent).join("/");
  return `${SUPABASE_URL}/storage/v1/object/public/${NEWS_BUCKET}/${encoded}`;
}

function fmtDate(value){
  if(!value) return "";
  try{
    return new Intl.DateTimeFormat("id-ID",{
      timeZone:"Asia/Jakarta",
      day:"numeric",
      month:"long",
      year:"numeric",
      hour:"2-digit",
      minute:"2-digit"
    }).format(new Date(value));
  }catch{
    return String(value);
  }
}

async function rpcNews(payload){
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_news`,{
    method:"POST",
    headers:{
      apikey:SUPABASE_KEY,
      "Content-Type":"application/json"
    },
    body:JSON.stringify(payload)
  });

  if(!response.ok){
    const body=await response.text();
    throw new Error(body || `Supabase HTTP ${response.status}`);
  }
  return await response.json();
}

async function findArticle(requestedSlug){
  // 1. Coba slug database persis.
  let rows=await rpcNews({p_limit:1,p_slug:requestedSlug});
  if(rows?.[0]) return rows[0];

  // 2. URL publik bersih: cari berita yang slug internalnya sama
  //    setelah akhiran timestamp 7 digit dibuang.
  rows=await rpcNews({p_limit:100,p_slug:null});
  return (rows || []).find(row => publicSlug(row.slug) === requestedSlug) || null;
}

function articleBody(content){
  return String(content || "")
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map(p=>`<p>${esc(p).replaceAll("\n","<br>")}</p>`)
    .join("");
}

function notFound(){
  return `<!doctype html>
<html lang="id"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Berita Tidak Ditemukan — MA Nurul Islam</title>
<link rel="stylesheet" href="/publik.css">
</head>
<body>
<main><article class="article">
<div class="empty">Berita tidak ditemukan atau belum dipublikasikan.</div>
<p style="margin-top:18px"><a href="/berita-publik.html">← Kembali ke Berita</a></p>
</article></main>
</body></html>`;
}

module.exports = async function handler(req,res){
  try{
    const raw = Array.isArray(req.query?.slug) ? req.query.slug[0] : req.query?.slug;
    const requestedSlug = decodeURIComponent(String(raw || "")).trim();

    if(!requestedSlug){
      res.statusCode=404;
      res.setHeader("Content-Type","text/html; charset=utf-8");
      res.end(notFound());
      return;
    }

    const r=await findArticle(requestedSlug);
    if(!r){
      res.statusCode=404;
      res.setHeader("Content-Type","text/html; charset=utf-8");
      res.end(notFound());
      return;
    }

    const cleanSlug=publicSlug(r.slug);
    const canonical=`${SITE_URL}/berita/${encodeURIComponent(cleanSlug)}`;
    const title=String(r.title || "Berita MA Nurul Islam");
    const description=excerpt(r.excerpt || r.content || "",220);
    const image=coverUrl(r.cover_path);
    const imageAlt=String(r.cover_alt || r.title || "MA Nurul Islam");
    const date=fmtDate(r.published_at || r.created_at);
    const category=String(r.category || "BERITA");
    const publishedTime=r.published_at || r.created_at || "";

    const html=`<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">

<title>${esc(title)} — MA Nurul Islam</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">

<meta property="og:type" content="article">
<meta property="og:site_name" content="MA Nurul Islam">
<meta property="og:locale" content="id_ID">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:secure_url" content="${esc(image)}">
<meta property="og:image:alt" content="${esc(imageAlt)}">
${publishedTime ? `<meta property="article:published_time" content="${esc(publishedTime)}">` : ""}

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(image)}">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Lora:wght@500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/publik.css">
</head>

<body data-page="ssr-detail">
<header class="site-header">
  <div class="wrap navbar">
    <a class="brand" href="/">
      <img src="/logo.png" alt="Logo MA Nurul Islam">
      <div><strong>MA NURUL ISLAM</strong><span>Karangcempaka · Bluto · Sumenep</span></div>
    </a>

    <button id="menuToggle" class="menu-toggle" type="button" aria-label="Buka menu">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
    </button>

    <nav id="navLinks" class="nav-links">
      <a href="/">Beranda</a>
      <a href="/profil.html">Profil</a>
      <a href="/berita-publik.html" class="active">Berita</a>
      <a href="/prestasi-publik.html">Prestasi</a>
      <a href="/pengumuman-publik.html">Pengumuman</a>
      <a href="/agenda-publik.html">Agenda</a>
      <a class="login-btn" href="/login.html">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 17l5-5-5-5M15 12H3"/><path d="M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5"/></svg>
        Masuk SIMANIS
      </a>
    </nav>
  </div>
</header>

<main>
  <article class="article">
    <div class="pill-row">
      <span class="pill">${esc(category)}</span>
      ${r.is_featured ? '<span class="pill gold">UNGGULAN</span>' : ""}
    </div>

    <h1>${esc(title)}</h1>
    <div class="meta">${esc(date)}</div>

    ${image ? `<img class="article-image" src="${esc(image)}" alt="${esc(imageAlt)}">` : ""}

    ${r.excerpt ? `<div class="article-lead">${esc(r.excerpt)}</div>` : ""}

    <div class="article-content">${articleBody(r.content)}</div>
  </article>
</main>

<footer class="site-footer">
  <div class="wrap footer-grid">
    <div class="footer-brand">
      <img src="/logo.png" alt="Logo MA Nurul Islam">
      <div>
        <strong>MA NURUL ISLAM</strong>
        <span>Karangcempaka · Bluto · Sumenep</span>
        <p class="footer-tagline">Ilmu · Akhlak · Prestasi · Untuk Umat dan Bangsa</p>
      </div>
    </div>
    <div class="footer-col">
      <h4>Kontak</h4>
      <p>Jl. KH. Moh. Sirajuddin No. 03, Karangcempaka, Bluto, Sumenep 69466</p>
      <a href="mailto:psbnuriska@gmail.com">psbnuriska@gmail.com</a>
      <a href="https://wa.me/6287753737923" target="_blank" rel="noopener">0877 5373 7923</a>
    </div>
    <div class="footer-col">
      <h4>Tautan Cepat</h4>
      <a href="/">Beranda</a>
      <a href="/profil.html">Profil Madrasah</a>
      <a href="/berita-publik.html">Berita</a>
      <a href="/prestasi-publik.html">Prestasi</a>
      <a href="/pengumuman-publik.html">Pengumuman</a>
      <a href="/agenda-publik.html">Agenda</a>
    </div>
    <div class="footer-col">
      <h4>SIMANIS</h4>
      <a href="/login.html">Masuk Sistem</a>
      <p>Sistem Informasi MA Nurul Islam</p>
    </div>
  </div>
  <div class="wrap footer-bottom">© 2026 MA Nurul Islam Karangcempaka. Portal publik terintegrasi SIMANIS.</div>
</footer>

<script src="/publik.js"></script>
</body>
</html>`;

    res.statusCode=200;
    res.setHeader("Content-Type","text/html; charset=utf-8");
    res.setHeader("Cache-Control","public, s-maxage=60, stale-while-revalidate=300");
    res.end(html);

  }catch(err){
    console.error("SSR berita error:",err);
    res.statusCode=500;
    res.setHeader("Content-Type","text/html; charset=utf-8");
    res.end(`<!doctype html><html><body><p>Berita sedang tidak dapat dimuat.</p></body></html>`);
  }
};