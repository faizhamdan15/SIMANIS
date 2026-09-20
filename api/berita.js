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
    const articleImage=directCoverUrl(r.cover_path);
    const version=Date.parse(r.updated_at||r.published_at||r.created_at||"")||Date.now();
    const socialImage=shareCoverUrl(r.cover_path,version);
    const socialImageType=r.cover_path?imageType(r.cover_path):"image/webp";
    const imageAlt=String(r.cover_alt||r.title||"MA Nurul Islam");
    const date=fmtDate(r.published_at||r.created_at);
    const published=r.published_at||r.created_at||"";
    const jsTitle=JSON.stringify(title);
    const jsUrl=JSON.stringify(canonical);

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

<style>
.article-share{
  display:flex;align-items:center;gap:8px;flex-wrap:wrap;
  margin:16px 0 18px;padding:12px 0;
  border-top:1px solid #e2ebe6;border-bottom:1px solid #e2ebe6
}
.article-share-label{
  margin-right:4px;font-size:12px;font-weight:800;color:#466257
}
.share-btn{
  display:inline-flex;align-items:center;justify-content:center;gap:7px;
  min-height:38px;padding:8px 12px;border-radius:10px;
  border:1px solid #d9e6df;background:#fff;color:#075b3a;
  font:700 12px/1 Inter,system-ui,sans-serif;cursor:pointer;text-decoration:none;
  transition:.16s ease
}
.share-btn:hover{border-color:#8fbda7;background:#f5faf7;transform:translateY(-1px)}
.share-btn.primary{background:#0b7347;border-color:#0b7347;color:#fff}
.share-btn.primary:hover{background:#075b3a}
.share-btn svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.share-copy-status{font-size:11px;font-weight:700;color:#0b7347;min-width:50px}
@media(max-width:560px){
  .article-share-label{width:100%;margin-bottom:2px}
  .share-btn{flex:1 1 calc(50% - 6px)}
}
</style>
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

<div class="article-share" aria-label="Bagikan berita">
  <span class="article-share-label">Bagikan:</span>

  <button id="nativeShareBtn" class="share-btn primary" type="button">
    <svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/></svg>
    Bagikan
  </button>

  <a id="waShareBtn" class="share-btn" href="#" target="_blank" rel="noopener">
    <svg viewBox="0 0 24 24"><path d="M21 11.5a8.5 8.5 0 0 1-12.5 7.5L3 21l1.8-5.3A8.5 8.5 0 1 1 21 11.5Z"/><path d="M8.5 8.3c.5 2.7 2.6 4.8 5.3 5.3"/></svg>
    WhatsApp
  </a>

  <a id="fbShareBtn" class="share-btn" href="#" target="_blank" rel="noopener">
    <svg viewBox="0 0 24 24"><path d="M14 8h3V4h-3c-3 0-5 2-5 5v3H6v4h3v5h4v-5h3l1-4h-4V9c0-.7.3-1 1-1Z"/></svg>
    Facebook
  </a>

  <button id="copyShareBtn" class="share-btn" type="button">
    <svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>
    Salin Link
  </button>

  <span id="copyShareStatus" class="share-copy-status" aria-live="polite"></span>
</div>

<img class="article-image" src="${esc(articleImage)}" alt="${esc(imageAlt)}">
${r.excerpt?`<div class="article-lead">${esc(r.excerpt)}</div>`:""}
<div class="article-content">${bodyHtml(r.content)}</div>
</article></main>

<footer class="site-footer"><div class="wrap footer-bottom">© 2026 MA Nurul Islam Karangcempaka. Portal publik terintegrasi SIMANIS.</div></footer>

<script>
(function(){
  const title=${jsTitle};
  const url=${jsUrl};
  const shareText=title+"\\n"+url;

  const nativeBtn=document.getElementById("nativeShareBtn");
  const waBtn=document.getElementById("waShareBtn");
  const fbBtn=document.getElementById("fbShareBtn");
  const copyBtn=document.getElementById("copyShareBtn");
  const status=document.getElementById("copyShareStatus");

  waBtn.href="https://wa.me/?text="+encodeURIComponent(shareText);
  fbBtn.href="https://www.facebook.com/sharer/sharer.php?u="+encodeURIComponent(url);

  if(!navigator.share){
    nativeBtn.style.display="none";
  }else{
    nativeBtn.addEventListener("click",async()=>{
      try{
        await navigator.share({title:title,text:title,url:url});
      }catch(err){
        if(err && err.name!=="AbortError") console.warn(err);
      }
    });
  }

  async function copyLink(){
    try{
      await navigator.clipboard.writeText(url);
    }catch(_){
      const ta=document.createElement("textarea");
      ta.value=url;
      ta.style.position="fixed";
      ta.style.opacity="0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    status.textContent="Tersalin";
    copyBtn.textContent="Link Tersalin";
    setTimeout(()=>{
      status.textContent="";
      copyBtn.innerHTML='<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>Salin Link';
    },1800);
  }

  copyBtn.addEventListener("click",copyLink);
})();
</script>
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