const SUPABASE_URL="https://zevdqmrlcrnwkeqejbxm.supabase.co";
const SUPABASE_KEY="sb_publishable_wq4BZQjDm33hVB6E6QISuA_cQP7xmEH";
const SITE_URL="https://www.manuriska.sch.id";
const BUCKET="berita-cover";

function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function strip(v){return String(v??"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim()}
function excerpt(v,max=220){const s=strip(v);return s.length>max?s.slice(0,max).trim()+"…":s}
function publicSlug(s){return String(s||"").replace(/-\d{7}$/,"")}
function articleUrl(row){return `${SITE_URL}/berita/${encodeURIComponent(publicSlug(row?.slug||""))}`}
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
function fmtDate(v,withTime=true){
  if(!v)return "";
  try{
    return new Intl.DateTimeFormat("id-ID",{
      timeZone:"Asia/Jakarta",
      day:"numeric",month:"long",year:"numeric",
      ...(withTime?{hour:"2-digit",minute:"2-digit"}:{})
    }).format(new Date(v))
  }catch{return String(v)}
}
function readMinutes(content){
  const words=strip(content).split(/\s+/).filter(Boolean).length;
  return Math.max(1,Math.ceil(words/200));
}
function dateValue(row){
  const v=row?.published_at||row?.created_at||0;
  const n=Date.parse(v);
  return Number.isFinite(n)?n:0;
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
async function getAllNews(){
  return await rpc({p_limit:100,p_slug:null})||[];
}
function findArticle(rows,slug){
  return (rows||[]).find(x=>x.slug===slug)||(rows||[]).find(x=>publicSlug(x.slug)===slug)||null;
}
function bodyHtml(content){
  return String(content||"").split(/\n\s*\n/).filter(Boolean)
    .map(p=>`<p>${esc(p).replaceAll("\n","<br>")}</p>`).join("");
}
function relatedCard(row){
  const url=articleUrl(row);
  const img=directCoverUrl(row.cover_path);
  return `<a class="related-card" href="${esc(url)}">
    <img src="${esc(img)}" alt="${esc(row.cover_alt||row.title||"Berita MA Nurul Islam")}">
    <div class="related-body">
      <span class="related-cat">${esc(row.category||"BERITA")}</span>
      <h3>${esc(row.title||"Berita MA Nurul Islam")}</h3>
      <p>${esc(excerpt(row.excerpt||row.content||"",110))}</p>
      <small>${esc(fmtDate(row.published_at||row.created_at,false))}</small>
    </div>
  </a>`;
}
function navCard(row,label,arrow){
  if(!row)return "";
  return `<a class="article-nav-card" href="${esc(articleUrl(row))}">
    <span>${esc(label)}</span>
    <div class="article-nav-title">${arrow==="left"?"← ":""}${esc(row.title||"Berita")}${arrow==="right"?" →":""}</div>
  </a>`;
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

    const allNews=(await getAllNews()).slice().sort((a,b)=>dateValue(b)-dateValue(a));
    const r=findArticle(allNews,slug);

    if(!r){
      res.statusCode=404;
      res.setHeader("Content-Type","text/html; charset=utf-8");
      return res.end(notFound());
    }

    const idx=allNews.findIndex(x=>x.slug===r.slug);
    const newer=idx>0?allNews[idx-1]:null;
    const older=idx>=0&&idx<allNews.length-1?allNews[idx+1]:null;

    const sameCategory=allNews.filter(x=>x.slug!==r.slug && String(x.category||"").toLowerCase()===String(r.category||"").toLowerCase());
    const fallback=allNews.filter(x=>x.slug!==r.slug && !sameCategory.some(y=>y.slug===x.slug));
    const related=[...sameCategory,...fallback].slice(0,3);

    const clean=publicSlug(r.slug);
    const canonical=`${SITE_URL}/berita/${encodeURIComponent(clean)}`;
    const title=String(r.title||"Berita MA Nurul Islam");
    const desc=excerpt(r.excerpt||r.content||"",220);
    const articleImage=directCoverUrl(r.cover_path);
    const version=Date.parse(r.updated_at||r.published_at||r.created_at||"")||Date.now();
    const socialImage=shareCoverUrl(r.cover_path,version);
    const socialImageType=r.cover_path?imageType(r.cover_path):"image/webp";
    const imageAlt=String(r.cover_alt||r.title||"MA Nurul Islam");
    const date=fmtDate(r.published_at||r.created_at,true);
    const published=r.published_at||r.created_at||"";
    const modified=r.updated_at||published;
    const author=String(r.created_by_name||r.author_name||"Tim Redaksi MA Nurul Islam");
    const reading=readMinutes(r.content||"");
    const jsTitle=JSON.stringify(title);
    const jsUrl=JSON.stringify(canonical);

    const jsonLd=JSON.stringify({
      "@context":"https://schema.org",
      "@type":"NewsArticle",
      headline:title,
      description:desc,
      image:[socialImage],
      datePublished:published||undefined,
      dateModified:modified||undefined,
      author:{"@type":"Organization","name":author},
      publisher:{
        "@type":"Organization",
        name:"MA Nurul Islam Karangcempaka",
        logo:{"@type":"ImageObject","url":`${SITE_URL}/logo.png`}
      },
      mainEntityOfPage:canonical
    }).replace(/</g,"\\u003c");

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
${modified?`<meta property="article:modified_time" content="${esc(modified)}">`:""}

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(socialImage)}">

<script type="application/ld+json">${jsonLd}</script>

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Lora:wght@500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/publik.css">

<style>
.media-article{max-width:900px;margin:0 auto;padding:34px 20px 60px}
.article-back{
  display:inline-flex;align-items:center;gap:7px;margin:0 0 20px;
  color:#0b7347;font:800 12px/1.2 Inter,sans-serif;text-decoration:none
}
.article-back:hover{text-decoration:underline}
.article-head{max-width:820px;margin:0 auto}
.article-head h1{
  margin:10px 0 12px;font-family:Lora,serif;font-size:clamp(30px,5vw,50px);
  line-height:1.13;color:#16352a;letter-spacing:-.02em
}
.article-kicker{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.article-meta-pro{
  display:flex;align-items:center;gap:8px 14px;flex-wrap:wrap;
  margin:14px 0 18px;color:#65786f;font:600 12px/1.5 Inter,sans-serif
}
.article-meta-pro span{display:inline-flex;align-items:center;gap:6px}
.article-meta-pro svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8}
.article-lead-pro{
  margin:0 0 20px;padding:0 0 0 16px;border-left:3px solid #d4ae35;
  color:#425e52;font:600 16px/1.7 Inter,sans-serif
}
.article-share{
  display:flex;align-items:center;gap:8px;flex-wrap:wrap;
  margin:16px 0 22px;padding:12px 0;
  border-top:1px solid #e2ebe6;border-bottom:1px solid #e2ebe6
}
.article-share-label{margin-right:4px;font-size:12px;font-weight:800;color:#466257}
.share-btn{
  display:inline-flex;align-items:center;justify-content:center;gap:7px;
  min-height:38px;padding:8px 12px;border-radius:10px;
  border:1px solid #d9e6df;background:#fff;color:#075b3a;
  font:700 12px/1 Inter,system-ui,sans-serif;cursor:pointer;text-decoration:none
}
.share-btn:hover{border-color:#8fbda7;background:#f5faf7}
.share-btn.primary{background:#0b7347;border-color:#0b7347;color:#fff}
.share-btn svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.share-copy-status{font-size:11px;font-weight:700;color:#0b7347;min-width:50px}
.article-image-pro{
  display:block;width:100%;max-height:540px;object-fit:cover;border-radius:18px;
  margin:4px 0 8px;box-shadow:0 10px 32px rgba(15,61,42,.10)
}
.article-caption{margin:0 0 28px;color:#7c8c84;font:500 11px/1.5 Inter,sans-serif}
.article-content-pro{
  max-width:760px;margin:0 auto;color:#2c4439;font:400 16px/1.9 Inter,sans-serif
}
.article-content-pro p{margin:0 0 21px}
.article-divider{height:1px;background:#e4ece8;margin:38px 0}
.article-nav{
  display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:34px
}
.article-nav-card{
  display:block;border:1px solid #dfeae4;border-radius:14px;padding:16px;
  text-decoration:none;background:#fff;color:#173b2c
}
.article-nav-card:hover{border-color:#a8c9b9;box-shadow:0 8px 24px rgba(10,72,46,.07)}
.article-nav-card span{display:block;color:#7a8b83;font:800 10px/1.2 Inter,sans-serif;text-transform:uppercase;letter-spacing:.07em;margin-bottom:7px}
.article-nav-title{font:700 13px/1.45 Inter,sans-serif}
.related-section{margin-top:42px}
.related-section h2{
  font:700 25px/1.2 Lora,serif;color:#173b2c;margin:0 0 16px
}
.related-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.related-card{
  display:block;border:1px solid #e0e9e4;border-radius:15px;overflow:hidden;
  text-decoration:none;background:#fff;color:#173b2c
}
.related-card img{width:100%;aspect-ratio:16/9;object-fit:cover;display:block}
.related-body{padding:13px}
.related-cat{display:block;color:#0b7347;font:800 9px/1.2 Inter,sans-serif;letter-spacing:.05em;margin-bottom:6px}
.related-card h3{font:700 14px/1.4 Inter,sans-serif;margin:0 0 6px}
.related-card p{font:500 11px/1.55 Inter,sans-serif;color:#66796f;margin:0 0 9px}
.related-card small{font:600 10px/1.4 Inter,sans-serif;color:#88958f}
@media(max-width:760px){
  .media-article{padding-top:22px}
  .related-grid{grid-template-columns:1fr}
  .related-card{display:grid;grid-template-columns:128px 1fr}
  .related-card img{height:100%;aspect-ratio:auto}
}
@media(max-width:560px){
  .article-share-label{width:100%}
  .share-btn{flex:1 1 calc(50% - 6px)}
  .article-nav{grid-template-columns:1fr}
  .related-card{grid-template-columns:105px 1fr}
  .article-content-pro{font-size:15px;line-height:1.85}
}
</style>
</head><body>

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
      <a href="/">Beranda</a><a href="/profil.html">Profil</a><a href="/berita-publik.html" class="active">Berita</a><a href="/prestasi-publik.html">Prestasi</a><a href="/pengumuman-publik.html">Pengumuman</a><a href="/agenda-publik.html">Agenda</a><a class="login-btn" href="/login.html">Masuk SIMANIS</a>
    </nav>
  </div>
</header>

<main class="media-article">
  <a class="article-back" href="/berita-publik.html">← Kembali ke Berita</a>

  <article>
    <header class="article-head">
      <div class="article-kicker">
        <span class="pill">${esc(r.category||"BERITA")}</span>
        ${r.is_featured?'<span class="pill gold">UNGGULAN</span>':""}
      </div>

      <h1>${esc(title)}</h1>

      <div class="article-meta-pro">
        <span>
          <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>
          ${esc(author)}
        </span>
        <span>
          <svg viewBox="0 0 24 24"><path d="M4 5h16v15H4zM8 3v4M16 3v4M4 9h16"/></svg>
          ${esc(date)}
        </span>
        <span>
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
          ${reading} menit baca
        </span>
      </div>

      ${r.excerpt?`<div class="article-lead-pro">${esc(r.excerpt)}</div>`:""}

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
    </header>

    <img class="article-image-pro" src="${esc(articleImage)}" alt="${esc(imageAlt)}">
    <div class="article-caption">${esc(imageAlt)}</div>

    <div class="article-content-pro">${bodyHtml(r.content)}</div>

    <div class="article-divider"></div>

    <nav class="article-nav" aria-label="Navigasi berita">
      ${navCard(older,"Berita Sebelumnya","left")}
      ${navCard(newer,"Berita Berikutnya","right")}
    </nav>

    ${related.length?`
    <section class="related-section">
      <h2>Berita Terkait</h2>
      <div class="related-grid">${related.map(relatedCard).join("")}</div>
    </section>`:""}
  </article>
</main>

<footer class="site-footer">
  <div class="wrap footer-grid">
    <div class="footer-brand">
      <img src="/logo.png" alt="Logo MA Nurul Islam">
      <div><strong>MA NURUL ISLAM</strong><span>Karangcempaka · Bluto · Sumenep</span><p class="footer-tagline">Ilmu · Akhlak · Prestasi · Untuk Umat dan Bangsa</p></div>
    </div>
    <div class="footer-col"><h4>Kontak</h4><p>Jl. KH. Moh. Sirajuddin No. 03, Karangcempaka, Bluto, Sumenep 69466</p><a href="mailto:psbnuriska@gmail.com">psbnuriska@gmail.com</a><a href="https://wa.me/6287753737923" target="_blank" rel="noopener">0877 5373 7923</a></div>
    <div class="footer-col"><h4>Tautan Cepat</h4><a href="/">Beranda</a><a href="/profil.html">Profil Madrasah</a><a href="/berita-publik.html">Berita</a><a href="/prestasi-publik.html">Prestasi</a><a href="/pengumuman-publik.html">Pengumuman</a><a href="/agenda-publik.html">Agenda</a></div>
    <div class="footer-col"><h4>SIMANIS</h4><a href="/login.html">Masuk Sistem</a><p>Sistem Informasi MA Nurul Islam</p></div>
  </div>
  <div class="wrap footer-bottom">© 2026 MA Nurul Islam Karangcempaka. Portal publik terintegrasi SIMANIS.</div>
</footer>

<script>
(function(){
  const menuBtn=document.getElementById("menuToggle");
  const nav=document.getElementById("navLinks");
  if(menuBtn&&nav){
    menuBtn.addEventListener("click",()=>nav.classList.toggle("show"));
    nav.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>nav.classList.remove("show")));
  }

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
      try{await navigator.share({title:title,text:title,url:url})}
      catch(err){if(err&&err.name!=="AbortError")console.warn(err)}
    });
  }

  copyBtn.addEventListener("click",async()=>{
    try{
      await navigator.clipboard.writeText(url);
    }catch(_){
      const ta=document.createElement("textarea");
      ta.value=url;ta.style.position="fixed";ta.style.opacity="0";
      document.body.appendChild(ta);ta.focus();ta.select();document.execCommand("copy");ta.remove();
    }
    status.textContent="Tersalin";
    setTimeout(()=>status.textContent="",1800);
  });
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