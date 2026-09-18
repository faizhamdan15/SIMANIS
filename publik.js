const Portal=(()=>{
  const cfg=window.SIMANIS_CONFIG||{};
  const base=String(cfg.SUPABASE_URL||"").replace(/\/$/,"");
  const key=cfg.SUPABASE_PUBLISHABLE_KEY||"";
  const newsBucket="berita-cover";

  const esc=s=>String(s??"")
    .replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;");

  async function rpc(fn,payload={}){
    if(!base||!key)throw new Error("Konfigurasi Supabase belum tersedia.");
    const res=await fetch(`${base}/rest/v1/rpc/${encodeURIComponent(fn)}`,{
      method:"POST",
      headers:{apikey:key,"Content-Type":"application/json"},
      body:JSON.stringify(payload)
    });
    const text=await res.text();
    let data=null;
    try{data=text?JSON.parse(text):null}catch{data=text}
    if(!res.ok)throw new Error(data?.message||data?.error||text||`HTTP ${res.status}`);
    return data;
  }

  function coverUrl(path){
    if(!path)return "";
    return `${base}/storage/v1/object/public/${newsBucket}/${path.split("/").map(encodeURIComponent).join("/")}`;
  }

  function fmtDate(value,withTime=false){
    if(!value)return "-";
    return new Intl.DateTimeFormat("id-ID",{
      timeZone:"Asia/Jakarta",
      day:"numeric",month:"long",year:"numeric",
      ...(withTime?{hour:"2-digit",minute:"2-digit"}:{})
    }).format(new Date(value));
  }

  function dateParts(value){
    if(!value)return{day:"-",month:"-"};
    const d=new Date(value);
    return{
      day:new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",day:"2-digit"}).format(d),
      month:new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",month:"short"}).format(d)
    };
  }

  function excerpt(text,max=150){
    const clean=String(text||"").replace(/\s+/g," ").trim();
    return clean.length>max?clean.slice(0,max).trim()+"…":clean;
  }

  function newsCard(r){
    const cover=r.cover_path
      ?`<img src="${esc(coverUrl(r.cover_path))}" alt="${esc(r.cover_alt||r.title)}">`
      :"BERITA MADRASAH";
    return `<a class="news-card" href="berita-detail.html?slug=${encodeURIComponent(r.slug)}">
      <div class="news-card-cover">${cover}</div>
      <div class="news-card-body">
        <div class="pill-row"><span class="pill">${esc(r.category||"MADRASAH")}</span>${r.is_featured?'<span class="pill gold">UNGGULAN</span>':""}</div>
        <h3>${esc(r.title)}</h3>
        <p>${esc(r.excerpt||excerpt(r.content,150))}</p>
        <div class="meta">${esc(fmtDate(r.published_at||r.created_at))}</div>
      </div>
    </a>`;
  }

  function homeNewsCard(r){
    const cover=r.cover_path
      ?`<img src="${esc(coverUrl(r.cover_path))}" alt="${esc(r.cover_alt||r.title)}">`
      :"";
    return `<a class="news-mini" href="berita-detail.html?slug=${encodeURIComponent(r.slug)}">
      <div class="news-mini-cover ${cover?"":"placeholder"}">${cover||"BERITA MADRASAH"}</div>
      <div class="news-mini-body">
        <div class="news-mini-date">${esc(fmtDate(r.published_at||r.created_at))}</div>
        <h3>${esc(r.title)}</h3>
        <p>${esc(r.excerpt||excerpt(r.content,80))}</p>
        <div class="news-more">Baca Selengkapnya →</div>
      </div>
    </a>`;
  }

  function announcementHome(r){
    const icon=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/></svg>`;
    return `<a class="stack-item" href="pengumuman-publik.html">
      <div class="stack-icon">${icon}</div>
      <div><h3>${esc(r.title)}</h3><p>${esc(fmtDate(r.start_at||r.created_at))}</p></div>
      <div class="stack-arrow">›</div>
    </a>`;
  }

  function agendaHome(r){
    const d=dateParts(r.start_at);
    return `<a class="agenda-home-item" href="agenda-publik.html">
      <div class="agenda-date">${esc(d.day)}<small>${esc(d.month)}</small></div>
      <div><h3>${esc(r.title)}</h3><p>${esc(r.all_day?"Sehari penuh":fmtDate(r.start_at,true))}${r.location?` · ${esc(r.location)}`:""}</p></div>
    </a>`;
  }

  function setupMenu(){
    const btn=document.getElementById("menuToggle");
    const nav=document.getElementById("navLinks");
    if(!btn||!nav)return;
    btn.addEventListener("click",()=>nav.classList.toggle("show"));
    nav.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>nav.classList.remove("show")));
  }

  return{rpc,esc,coverUrl,fmtDate,dateParts,excerpt,newsCard,homeNewsCard,announcementHome,agendaHome,setupMenu};
})();

async function initHome(){
  const newsEl=document.getElementById("homeNews");
  const annEl=document.getElementById("homeAnnouncements");
  const agendaEl=document.getElementById("homeAgenda");

  try{
    const [news,ann,agenda]=await Promise.all([
      Portal.rpc("get_public_news",{p_limit:3,p_slug:null}),
      Portal.rpc("get_public_announcements",{p_limit:3}),
      Portal.rpc("get_public_agenda",{p_limit:3,p_upcoming_only:true})
    ]);

    newsEl.innerHTML=news?.length
      ?news.slice(0,3).map(Portal.homeNewsCard).join("")
      :'<div class="empty" style="grid-column:1/-1">Belum ada berita yang dipublikasikan.</div>';

    annEl.innerHTML=ann?.length
      ?ann.slice(0,3).map(Portal.announcementHome).join("")
      :'<div class="empty">Belum ada pengumuman publik.</div>';

    agendaEl.innerHTML=agenda?.length
      ?agenda.slice(0,3).map(Portal.agendaHome).join("")
      :'<div class="empty">Belum ada agenda publik mendatang.</div>';
  }catch(err){
    console.error(err);
    const msg='<div class="empty">Data publik gagal dimuat. Pastikan Public Portal V1 masih aktif di Supabase.</div>';
    if(newsEl)newsEl.innerHTML=msg;
    if(annEl)annEl.innerHTML=msg;
    if(agendaEl)agendaEl.innerHTML=msg;
  }
}

async function initNews(){
  const search=document.getElementById("search");
  const holder=document.getElementById("newsList");
  let rows=[];
  try{rows=await Portal.rpc("get_public_news",{p_limit:50,p_slug:null})||[]}
  catch(err){console.error(err)}
  const render=()=>{
    const q=(search?.value||"").trim().toLowerCase();
    const data=rows.filter(r=>!q||`${r.title} ${r.excerpt||""} ${r.content||""} ${r.category||""}`.toLowerCase().includes(q));
    holder.innerHTML=data.length
      ?data.map(Portal.newsCard).join("")
      :'<div class="empty" style="grid-column:1/-1">Berita tidak ditemukan.</div>';
  };
  if(search)search.addEventListener("input",render);
  render();
}

async function initArticle(){
  const slug=new URLSearchParams(location.search).get("slug")||"";
  const holder=document.getElementById("articleHolder");
  if(!slug){holder.innerHTML='<div class="empty">Berita tidak ditemukan.</div>';return}
  try{
    const rows=await Portal.rpc("get_public_news",{p_limit:1,p_slug:slug})||[];
    const r=rows[0];
    if(!r)throw new Error("Berita tidak tersedia.");
    document.title=`${r.title} — MA Nurul Islam`;
    const image=r.cover_path?`<img class="article-image" src="${Portal.esc(Portal.coverUrl(r.cover_path))}" alt="${Portal.esc(r.cover_alt||r.title)}">`:"";
    const paras=String(r.content||"").split(/\n\s*\n/).filter(Boolean)
      .map(p=>`<p>${Portal.esc(p).replaceAll("\n","<br>")}</p>`).join("");
    holder.innerHTML=`
      <div class="pill-row"><span class="pill">${Portal.esc(r.category||"BERITA")}</span>${r.is_featured?'<span class="pill gold">UNGGULAN</span>':""}</div>
      <h1>${Portal.esc(r.title)}</h1>
      <div class="meta">${Portal.esc(Portal.fmtDate(r.published_at||r.created_at,true))}</div>
      ${image}
      ${r.excerpt?`<div class="article-lead">${Portal.esc(r.excerpt)}</div>`:""}
      <div class="article-content">${paras}</div>`;
  }catch(err){
    console.error(err);
    holder.innerHTML='<div class="empty">Berita tidak ditemukan atau belum dipublikasikan.</div>';
  }
}

async function initAnnouncements(){
  const search=document.getElementById("search");
  const holder=document.getElementById("announcementList");
  let rows=[];
  try{rows=await Portal.rpc("get_public_announcements",{p_limit:50})||[]}
  catch(err){console.error(err)}
  const render=()=>{
    const q=(search?.value||"").trim().toLowerCase();
    const data=rows.filter(r=>!q||`${r.title} ${r.content||""} ${r.category||""} ${r.priority||""}`.toLowerCase().includes(q));
    holder.innerHTML=data.length?data.map(r=>`
      <article class="public-item">
        <div class="pill-row">
          <span class="pill">${Portal.esc(r.category||"UMUM")}</span>
          <span class="pill ${r.priority==="MENDESAK"?"red":r.priority==="PENTING"?"gold":""}">${Portal.esc(r.priority||"NORMAL")}</span>
          ${r.is_pinned?'<span class="pill gold">DISEMATKAN</span>':""}
        </div>
        <h3>${Portal.esc(r.title)}</h3>
        <p>${Portal.esc(r.content||"")}</p>
        <div class="public-meta"><span class="pill">${Portal.esc(Portal.fmtDate(r.start_at||r.created_at,true))}</span>${r.end_at?`<span class="pill">Berlaku s.d. ${Portal.esc(Portal.fmtDate(r.end_at,true))}</span>`:""}</div>
      </article>`).join("")
      :'<div class="empty">Pengumuman tidak ditemukan.</div>';
  };
  if(search)search.addEventListener("input",render);
  render();
}

async function initAgenda(){
  const search=document.getElementById("search");
  const holder=document.getElementById("agendaList");
  let rows=[];
  try{rows=await Portal.rpc("get_public_agenda",{p_limit:50,p_upcoming_only:true})||[]}
  catch(err){console.error(err)}
  const render=()=>{
    const q=(search?.value||"").trim().toLowerCase();
    const data=rows.filter(r=>!q||`${r.title} ${r.description||""} ${r.location||""} ${r.category||""}`.toLowerCase().includes(q));
    holder.innerHTML=data.length?data.map(r=>`
      <article class="public-item">
        <div class="pill-row"><span class="pill">${Portal.esc(r.category||"KEGIATAN")}</span>${r.is_important?'<span class="pill gold">PENTING</span>':""}</div>
        <h3>${Portal.esc(r.title)}</h3>
        <p>${Portal.esc(r.description||"")}</p>
        <div class="public-meta"><span class="pill">${Portal.esc(r.all_day?Portal.fmtDate(r.start_at):Portal.fmtDate(r.start_at,true))}</span><span class="pill">${Portal.esc(r.location||"Lokasi menyusul")}</span>${r.person_in_charge?`<span class="pill">PIC: ${Portal.esc(r.person_in_charge)}</span>`:""}</div>
      </article>`).join("")
      :'<div class="empty">Agenda tidak ditemukan.</div>';
  };
  if(search)search.addEventListener("input",render);
  render();
}

document.addEventListener("DOMContentLoaded",()=>{
  Portal.setupMenu();
  const page=document.body.dataset.page;
  if(page==="home")initHome();
  else if(page==="news")initNews();
  else if(page==="detail")initArticle();
  else if(page==="ann")initAnnouncements();
  else if(page==="agenda")initAgenda();
});
