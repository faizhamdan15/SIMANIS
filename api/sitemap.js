const SUPABASE_URL="https://zevdqmrlcrnwkeqejbxm.supabase.co";
const SUPABASE_KEY="sb_publishable_wq4BZQjDm33hVB6E6QISuA_cQP7xmEH";
const SITE="https://www.manuriska.sch.id";

function x(s){
  return String(s??"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&apos;");
}
function publicSlug(slug){
  return String(slug||"").replace(/-\d{7}$/,"");
}
function isoDate(v){
  if(!v)return null;
  const d=new Date(v);
  return Number.isNaN(d.getTime())?null:d.toISOString().slice(0,10);
}
async function rpc(payload){
  const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_news`,{
    method:"POST",
    headers:{apikey:SUPABASE_KEY,"Content-Type":"application/json"},
    body:JSON.stringify(payload)
  });
  if(!r.ok)throw new Error(`Supabase HTTP ${r.status}`);
  return await r.json();
}
function node(loc,lastmod,changefreq,priority){
  return `<url><loc>${x(loc)}</loc>${lastmod?`<lastmod>${x(lastmod)}</lastmod>`:""}<changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
}

module.exports=async function handler(req,res){
  try{
    const staticPages=[
      ["/","2026-09-21","weekly","1.0"],
      ["/profil.html","2026-09-21","monthly","0.8"],
      ["/berita-publik.html","2026-09-21","daily","0.9"],
      ["/prestasi-publik.html","2026-09-21","weekly","0.8"],
      ["/pengumuman-publik.html","2026-09-21","daily","0.8"],
      ["/agenda-publik.html","2026-09-21","daily","0.8"]
    ];

    let news=[];
    try{
      news=await rpc({p_limit:500,p_slug:null});
      if(!Array.isArray(news))news=[];
    }catch(err){
      console.error("Sitemap news fallback:",err);
      news=[];
    }

    const seen=new Set();
    const urls=staticPages.map(([path,lastmod,freq,pri])=>node(`${SITE}${path}`,lastmod,freq,pri));

    for(const r of news){
      const slug=publicSlug(r.slug);
      if(!slug||seen.has(slug))continue;
      seen.add(slug);
      const lastmod=isoDate(r.updated_at||r.published_at||r.created_at);
      urls.push(node(`${SITE}/berita/${encodeURIComponent(slug)}`,lastmod,"monthly","0.7"));
    }

    const xml=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
    res.setHeader("Content-Type","application/xml; charset=utf-8");
    res.setHeader("Cache-Control","public, s-maxage=3600, stale-while-revalidate=86400");
    return res.status(200).send(xml);
  }catch(err){
    console.error(err);
    return res.status(500).send("Sitemap generation failed.");
  }
};
