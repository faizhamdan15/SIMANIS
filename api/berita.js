const SUPABASE_URL="https://zevdqmrlcrnwkeqejbxm.supabase.co";
const SUPABASE_KEY="sb_publishable_wq4BZQjDm33hVB6E6QISuA_cQP7xmEH";
const SITE_URL="https://www.manuriska.sch.id";
const BUCKET="berita-cover";

function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function strip(v){return String(v??"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim()}
function excerpt(v,max=220){const s=strip(v);return s.length>max?s.slice(0,max).trim()+"…":s}
function publicSlug(s){return String(s||"").replace(/-\d{7}$/,"")}
function directCoverUrl(path){
  if(!path)return `${SITE_URL}/hero-madrasah.webp`;
  const enc=String(path).split("/").map(encodeURIComponent).join("/");
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${enc}`;
}
function shareCoverUrl(path,version){
  if(!path)return `${SITE_URL}/hero-madrasah.webp`;
  const q=new URLSearchParams({path:String(path)});
  if(version)q.set("v",String(version));
  return `${SITE_URL}/api/og-image?${q.toString()}`;
}
function imageType(path){
  const ext=String(path||"").split(".").pop().toLowerCase();
  if(ext==="png")return "image/png";
  if(ext==="webp")return "image/webp";
  return "image/jpeg";
}
function fmtDate(v){
  if(!v)return "";
  try{return new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(v))}
  catch{return String(v)}
}
async function rpc(payload){
  const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_news`,{
    method:"POST",
    headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},
    body:JSON.stringify(payload)
  });
  if(!r.ok)throw new Error(await r.text());
  return await r.json();
}
async function findArticle(slug){
  let rows=await rpc({p_limit:1,p_slug:slug});
  if(rows?.[0])return rows[0];
  rows=await rpc({p_limit:100,p_slug:null});
  return (rows||[]).find(x=>publicSlug(x.slug)===slug)||null;
}
function bodyHtml(content){
  return String(content||"").split(/\n\s*\n/).filter(Boolean)
    .map(p=>`<p>${esc(p).replaceAll("\n","<br>")}</p>`).join("");
}
function notFound(){
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Berita Tidak Ditemukan — MA Nurul Islam</title><link rel="stylesheet" href="/publik.css"></head><body><main><article class="article"><div class="empty">Berita tidak ditemukan atau belum dipublikasikan.</div><p><a href="/berita-publik.html">← Kembali ke Berita</a></p></article></main></body></html>`;
}

module.exports=async function(req,res){
  try{
    const slug=decodeURIComponent(String(req.query?.slug||"")).trim();
    if(!slug){
      res.statusCode=404;
      res.setHeader("Content-Type","text/html; charset=utf-8");
      return res.end(notFound());
    }

    const r=await findArticle(slug);
    if(!r){
      res.statusCode=404;
      res.setHeader("Content-Type","text/html; charset=utf-8");
      return res.end(notFound());
    }

    const clean=publicSlug(r.slug);
    const canonical=`${SITE_URL}/berita/${encodeURIComponent(clean)}`;
    const title=String(r.title||"Berita MA Nurul Islam");
    const desc=excerpt(r.excerpt||r.content||"",220);

    // Browser article may load the original Supabase image directly.
    const articleImage=directCoverUrl(r.cover_path);

    // Social crawlers receive the image through the same manuriska.sch.id domain.
    // This avoids hotlink/crawler issues with an external Storage origin.
    const version=Date.parse(r.updated_at||r.published_at||r.created_at||"")||Date.now();
    const socialImage=shareCoverUrl(r.cover_path,version);
    const socialImageType=r.cover_path?imageType(r.cover_path):"image/webp";

    const imageAlt=String(r.cover_alt||r.title||"MA Nurul Islam");
    const date=fmtDate(r.published_at||r.created_at);
    const published=r.published_at||r.created_at||"";

    const html=`<!doctype html>
<html lang="id"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">

<title>${esc(title)} — MA Nurul Islam</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">

<meta property="og:type" content="article">
<meta property="og:site_name" content="MA Nurul Islam">
<meta property="og:locale" content="id_ID">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(socialImage)}">
<meta property="og:image:secure_url" content="${esc(socialImage)}">
<meta property="og:image:type" content="${esc(socialImageType)}">
<meta property="og:image:alt" content="${esc(imageAlt)}">
${published?`<meta property="article:published_time" content="${esc(published)}">`:""}

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(socialImage)}">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Lora:wght@500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/publik.css">
</head><body>
<header class="site-header"><div class="wrap navbar">
<a class="brand" href="/"><img src="/logo.png" alt="Logo MA Nurul Islam"><div><strong>MA NURUL ISLAM</strong><span>Karangcempaka · Bluto · Sumenep</span></div></a>
<nav class="nav-links">
<a href="/">Beranda</a><a href="/profil.html">Profil</a><a href="/berita-publik.html" class="active">Berita</a><a href="/prestasi-publik.html">Prestasi</a><a href="/pengumuman-publik.html">Pengumuman</a><a href="/agenda-publik.html">Agenda</a><a class="login-btn" href="/login.html">Masuk SIMANIS</a>
</nav></div></header>

<main><article class="article">
<div class="pill-row"><span class="pill">${esc(r.category||"BERITA")}</span>${r.is_featured?'<span class="pill gold">UNGGULAN</span>':""}</div>
<h1>${esc(title)}</h1>
<div class="meta">${esc(date)}</div>
<img class="article-image" src="${esc(articleImage)}" alt="${esc(imageAlt)}">
${r.excerpt?`<div class="article-lead">${esc(r.excerpt)}</div>`:""}
<div class="article-content">${bodyHtml(r.content)}</div>
</article></main>

<footer class="site-footer"><div class="wrap footer-bottom">© 2026 MA Nurul Islam Karangcempaka. Portal publik terintegrasi SIMANIS.</div></footer>
</body></html>`;

    res.statusCode=200;
    res.setHeader("Content-Type","text/html; charset=utf-8");
    res.setHeader("Cache-Control","public, s-maxage=60, stale-while-revalidate=300");
    res.end(html);

  }catch(err){
    console.error(err);
    res.statusCode=500;
    res.setHeader("Content-Type","text/html; charset=utf-8");
    res.end("<!doctype html><html><body><p>Berita sedang tidak dapat dimuat.</p></body></html>");
  }
};