const VERSION="simanis-public-v2";
const SHELL_CACHE=`${VERSION}-shell`;
const RUNTIME_CACHE=`${VERSION}-runtime`;

const SHELL=[
  "/",
  "/index.html",
  "/profil.html",
  "/berita-publik.html",
  "/prestasi-publik.html",
  "/pengumuman-publik.html",
  "/agenda-publik.html",
  "/offline.html",
  "/publik.css",
  "/public-finish.css?v=2",
  "/public-finish.js",
  "/config.js",
  "/logo.png",
  "/hero-madrasah.webp",
  "/site.webmanifest",
  "/icons/favicon-32x32.png",
  "/icons/apple-touch-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

const NEVER_CACHE_PREFIXES=[
  "/api/",
  "/login.html",
  "/dashboard",
  "/siswa",
  "/guru",
  "/kelas",
  "/mapel",
  "/jadwal",
  "/nilai",
  "/prestasi.html",
  "/absensi-",
  "/administrasi"
];

function isPublicNavigation(url){
  if(url.origin!==self.location.origin)return false;
  if(url.pathname.startsWith("/berita/"))return true;
  return [
    "/", "/index.html", "/profil.html", "/berita-publik.html",
    "/prestasi-publik.html", "/pengumuman-publik.html", "/agenda-publik.html",
    "/404.html", "/offline.html"
  ].includes(url.pathname);
}

function shouldNeverCache(url){
  return NEVER_CACHE_PREFIXES.some(p=>url.pathname.startsWith(p));
}

async function putSafe(cacheName,request,response){
  if(!response || !response.ok || response.type==="opaque")return response;
  const cache=await caches.open(cacheName);
  await cache.put(request,response.clone());
  return response;
}

self.addEventListener("install",event=>{
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache=>cache.addAll(SHELL))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith("simanis-public-")&&!k.startsWith(VERSION)).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;

  const url=new URL(request.url);

  // Never intercept private/internal routes or API calls.
  if(url.origin===self.location.origin && shouldNeverCache(url))return;

  if(request.mode==="navigate" && isPublicNavigation(url)){
    event.respondWith((async()=>{
      try{
        const fresh=await fetch(request);
        if(url.pathname.startsWith("/berita/")){
          // Article SSR is network-first. Cache a successful article only as a fallback.
          await putSafe(RUNTIME_CACHE,request,fresh);
        }
        return fresh;
      }catch{
        const cached=await caches.match(request);
        return cached || caches.match("/offline.html");
      }
    })());
    return;
  }

  // Same-origin static assets: cache-first with background refresh.
  if(url.origin===self.location.origin && /\.(?:css|js|png|jpg|jpeg|webp|svg|ico|woff2?)$/i.test(url.pathname)){
    event.respondWith((async()=>{
      const cached=await caches.match(request);
      const update=fetch(request)
        .then(resp=>putSafe(RUNTIME_CACHE,request,resp))
        .catch(()=>null);
      if(cached){
        event.waitUntil(update);
        return cached;
      }
      return (await update) || Response.error();
    })());
  }
});
