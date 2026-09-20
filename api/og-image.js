const SUPABASE_URL="https://zevdqmrlcrnwkeqejbxm.supabase.co";
const BUCKET="berita-cover";

function safePath(raw){
  const path=String(raw||"").trim();
  if(!path)return null;
  if(path.includes(".."))return null;
  if(path.startsWith("/"))return null;
  return path;
}

function storageUrl(path){
  const encoded=path.split("/").map(encodeURIComponent).join("/");
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encoded}`;
}

module.exports=async function(req,res){
  try{
    const path=safePath(req.query?.path);
    if(!path){
      res.statusCode=400;
      return res.end("Missing image path");
    }

    const upstream=await fetch(storageUrl(path),{
      headers:{
        "User-Agent":"SIMANIS-Social-Preview/1.0",
        "Accept":"image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
      }
    });

    if(!upstream.ok){
      res.statusCode=upstream.status===404?404:502;
      return res.end("Image unavailable");
    }

    const contentType=upstream.headers.get("content-type")||"image/jpeg";
    if(!contentType.toLowerCase().startsWith("image/")){
      res.statusCode=415;
      return res.end("Invalid image type");
    }

    const bytes=Buffer.from(await upstream.arrayBuffer());

    res.statusCode=200;
    res.setHeader("Content-Type",contentType);
    res.setHeader("Content-Length",String(bytes.length));
    res.setHeader("Content-Disposition",'inline; filename="berita-cover"');
    res.setHeader("Cache-Control","public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400");
    res.setHeader("Access-Control-Allow-Origin","*");
    res.setHeader("X-Content-Type-Options","nosniff");
    res.end(bytes);

  }catch(err){
    console.error("OG image proxy error:",err);
    res.statusCode=500;
    res.end("Image proxy error");
  }
};