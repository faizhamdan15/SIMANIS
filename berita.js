const $=id=>document.getElementById(id);
let api,profile,rows=[],modulePerm={can_view:false,can_create:false,can_update:false,can_delete:false};
const STORAGE_BUCKET="berita-cover";
const MAX_FILE_SIZE=5*1024*1024;
const ALLOWED_MIME=new Set(["image/jpeg","image/png","image/webp"]);

function esc(s){return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}
function formatRole(r){return (r||"-").replaceAll("_"," ")}
function localDateID(){return new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date())}
function routeFor(code){return {DASHBOARD:"dashboard.html",ADMINISTRASI_KEPALA:"administrasi.html",DATA_SISWA:"siswa.html",DATA_GURU:"guru.html",KELAS:"kelas.html",MATA_PELAJARAN:"mapel.html",JADWAL:"jadwal.html",ABSENSI_GURU:"absensi-guru.html",ABSENSI_SISWA:"absensi-siswa.html",NILAI:"nilai.html",PRESTASI:"prestasi.html",BERITA:"berita.html"}[code]||"#"}
function canCreate(){return !!modulePerm.can_create}
function canUpdate(){return !!modulePerm.can_update}
function canDelete(){return !!modulePerm.can_delete}

async function loadProfile(user){
  const r=await api.db.select("profiles",`select=id,full_name,role,is_active&id=eq.${encodeURIComponent(user.id)}&limit=1`);
  if(!r?.[0])throw new Error("Profil pengguna tidak ditemukan.");
  if(!r[0].is_active)throw new Error("Akun tidak aktif.");
  return r[0]
}

async function loadMenu(){
  const m=await api.db.rpc("get_my_modules",{});
  const current=(m||[]).find(x=>x.code==="BERITA");
  if(current)modulePerm=current;
  $("sidebarMenu").innerHTML=(m||[]).map(x=>`<a href="${routeFor(x.code)}" class="nav-item ${x.code==="BERITA"?"active":""}"><span class="nav-dot"></span><span>${esc(x.name)}</span></a>`).join("");
  document.querySelectorAll('.nav-item[href="#"]').forEach(a=>a.onclick=e=>{e.preventDefault();alert(`Modul "${a.textContent.trim()}" akan diaktifkan bertahap.`)});
}

async function loadData(){
  rows=await api.db.select("v_news_articles_detail","select=*&order=published_at.desc.nullslast,created_at.desc")||[];
  render();
}

function filtered(){
  const q=$("searchInput").value.trim().toLowerCase(),cat=$("categoryFilter").value,status=$("statusFilter").value;
  return rows.filter(r=>{
    const hay=`${r.title||""} ${r.excerpt||""} ${r.content||""} ${r.created_by_name||""}`.toLowerCase();
    return (!q||hay.includes(q))&&(!cat||r.category===cat)&&(!status||r.status===status);
  });
}

function publicCoverUrl(path){
  if(!path)return "";
  const cfg=window.SIMANIS_CONFIG;
  const encoded=path.split("/").map(encodeURIComponent).join("/");
  return `${cfg.SUPABASE_URL.replace(/\/$/,"")}/storage/v1/object/public/${STORAGE_BUCKET}/${encoded}`;
}

function dateLabel(value){
  if(!value)return "Belum dijadwalkan";
  return new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(value));
}

function statusPill(r){
  if(r.status==="PUBLISHED"){
    const future=r.published_at&&new Date(r.published_at)>new Date();
    return `<span class="pill p-pub">${future?"TERJADWAL":"TERBIT"}</span>`;
  }
  if(r.status==="ARCHIVED")return '<span class="pill p-arc">ARSIP</span>';
  return '<span class="pill p-draft">DRAFT</span>';
}

function render(){
  const data=filtered();
  $("statTotal").textContent=rows.length;
  $("statPublished").textContent=rows.filter(r=>r.status==="PUBLISHED"&&(!r.published_at||new Date(r.published_at)<=new Date())).length;
  $("statDraft").textContent=rows.filter(r=>r.status==="DRAFT").length;
  $("statFeatured").textContent=rows.filter(r=>r.is_featured).length;
  $("addBtn").style.display=canCreate()?"":"none";

  if(!data.length){
    $("newsGrid").innerHTML='<div class="empty-state" style="grid-column:1/-1">Belum ada berita yang cocok dengan filter.</div>';
    return;
  }

  $("newsGrid").innerHTML=data.map(r=>{
    const cover=r.cover_path?`<img src="${esc(publicCoverUrl(r.cover_path))}" alt="${esc(r.cover_alt||r.title)}">`:"📰 BERITA MADRASAH";
    return `<article class="news-card">
      <div class="news-cover">${cover}</div>
      <div class="news-body">
        <div class="news-head">
          <div class="news-pills">
            <span class="pill p-cat">${esc(r.category)}</span>
            ${statusPill(r)}
            ${r.is_featured?'<span class="pill p-featured">⭐ UNGGULAN</span>':""}
          </div>
        </div>
        <h3>${esc(r.title)}</h3>
        <p>${esc(r.excerpt||makeExcerpt(r.content,160))}</p>
        <div class="news-meta">${esc(r.created_by_name||"SIMANIS")} · ${esc(dateLabel(r.published_at||r.created_at))}</div>
        <div class="news-actions">
          <button class="mini-btn" data-preview="${r.id}">Preview</button>
          ${canUpdate()?`<button class="mini-btn" data-edit="${r.id}">Edit</button>`:""}
        </div>
      </div>
    </article>`;
  }).join("");

  document.querySelectorAll("[data-preview]").forEach(b=>b.onclick=()=>previewArticle(rows.find(x=>x.id===b.dataset.preview)));
  document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>openEdit(b.dataset.edit));
}

function makeExcerpt(text,max=180){
  const clean=String(text||"").replace(/\s+/g," ").trim();
  return clean.length>max?clean.slice(0,max).trim()+"…":clean;
}

function slugify(s){
  return String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,90)||"berita";
}
function newSlug(title){return `${slugify(title)}-${Date.now().toString().slice(-7)}`}

function toLocalInput(iso){
  if(!iso)return "";
  const d=new Date(iso);
  const pad=n=>String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(v){return v?new Date(v).toISOString():null}

function previewArticle(r){
  if(!r)return;
  const img=r.cover_path?`<img src="${esc(publicCoverUrl(r.cover_path))}" alt="${esc(r.cover_alt||r.title)}">`:"";
  const paras=String(r.content||"").split(/\n\s*\n/).map(p=>`<p>${esc(p).replaceAll("\n","<br>")}</p>`).join("");
  const w=window.open("","_blank");
  if(!w){alert("Popup diblokir browser.");return}
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(r.title)}</title><style>
    body{font-family:Arial,sans-serif;max-width:820px;margin:0 auto;padding:32px;color:#18362a;line-height:1.7}
    .cat{font-size:12px;font-weight:700;color:#0b7347}.meta{font-size:12px;color:#718078;margin-bottom:20px}
    h1{font-size:32px;line-height:1.25;margin:8px 0 12px}img{width:100%;max-height:470px;object-fit:cover;border-radius:16px;margin:12px 0 22px}
    .excerpt{font-size:17px;color:#52655c;font-weight:600}p{font-size:16px;color:#293c33}hr{border:0;border-top:1px solid #ddd;margin:24px 0}
  </style></head><body><div class="cat">${esc(r.category)}</div><h1>${esc(r.title)}</h1>
  <div class="meta">${esc(r.created_by_name||"SIMANIS")} · ${esc(dateLabel(r.published_at||r.created_at))}</div>
  ${img}<div class="excerpt">${esc(r.excerpt||"")}</div><hr>${paras}</body></html>`);
  w.document.close();
}

function previewForm(){
  const pseudo={
    title:$("title").value.trim()||"Judul Berita",
    category:$("category").value,
    excerpt:$("excerpt").value.trim(),
    content:$("content").value,
    created_by_name:profile?.full_name,
    published_at:fromLocalInput($("publishedAt").value)||new Date().toISOString(),
    cover_alt:$("coverAlt").value.trim()
  };
  const file=$("coverFile").files?.[0];
  if(file){
    const url=URL.createObjectURL(file);
    pseudo.cover_path=null;
    const w=window.open("","_blank");
    if(!w){URL.revokeObjectURL(url);alert("Popup diblokir browser.");return}
    const paras=String(pseudo.content||"").split(/\n\s*\n/).map(p=>`<p>${esc(p).replaceAll("\n","<br>")}</p>`).join("");
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(pseudo.title)}</title><style>body{font-family:Arial,sans-serif;max-width:820px;margin:0 auto;padding:32px;color:#18362a;line-height:1.7}.cat{font-size:12px;font-weight:700;color:#0b7347}.meta{font-size:12px;color:#718078;margin-bottom:20px}h1{font-size:32px;line-height:1.25;margin:8px 0 12px}img{width:100%;max-height:470px;object-fit:cover;border-radius:16px;margin:12px 0 22px}.excerpt{font-size:17px;color:#52655c;font-weight:600}p{font-size:16px;color:#293c33}hr{border:0;border-top:1px solid #ddd;margin:24px 0}</style></head><body><div class="cat">${esc(pseudo.category)}</div><h1>${esc(pseudo.title)}</h1><div class="meta">${esc(profile?.full_name||"SIMANIS")} · Preview</div><img src="${url}" alt="${esc(pseudo.cover_alt||pseudo.title)}"><div class="excerpt">${esc(pseudo.excerpt)}</div><hr>${paras}</body></html>`);
    w.document.close();
    setTimeout(()=>URL.revokeObjectURL(url),120000);
    return;
  }
  const existing=$("oldCoverPath").value;
  if(existing)pseudo.cover_path=existing;
  previewArticle(pseudo);
}

function updateCounts(){
  $("excerptCount").textContent=`${$("excerpt").value.length} / 320`;
  $("contentCount").textContent=`${$("content").value.length} karakter`;
}

function showCover(pathOrUrl){
  if(!pathOrUrl){$("coverPreview").innerHTML="Belum ada foto sampul";return}
  const url=pathOrUrl.startsWith("blob:")?pathOrUrl:publicCoverUrl(pathOrUrl);
  $("coverPreview").innerHTML=`<img src="${esc(url)}" alt="Preview sampul">`;
}

function openAdd(){
  if(!canCreate())return;
  $("form").reset();
  $("articleId").value="";$("articleSlug").value="";$("oldCoverPath").value="";
  $("modalTitle").textContent="Tulis Berita";
  $("deleteBtn").style.display="none";
  $("status").value="DRAFT";
  $("publishedAt").value="";
  $("formMessage").textContent="";
  showCover("");
  updateCounts();
  $("modal").classList.remove("hidden");
}

function openEdit(id){
  const r=rows.find(x=>x.id===id);
  if(!r||!canUpdate())return;
  $("form").reset();
  $("articleId").value=r.id;$("articleSlug").value=r.slug;$("oldCoverPath").value=r.cover_path||"";
  $("modalTitle").textContent="Edit Berita";
  $("title").value=r.title||"";$("category").value=r.category||"MADRASAH";$("status").value=r.status||"DRAFT";
  $("publishedAt").value=toLocalInput(r.published_at);
  $("featured").checked=!!r.is_featured;$("excerpt").value=r.excerpt||"";$("content").value=r.content||"";
  $("coverAlt").value=r.cover_alt||"";
  $("deleteBtn").style.display=canDelete()?"":"none";
  $("formMessage").textContent="";
  showCover(r.cover_path||"");
  updateCounts();
  $("modal").classList.remove("hidden");
}

function closeModal(){$("modal").classList.add("hidden")}

async function restWrite(path,method,body,prefer="return=representation"){
  const session=await api.auth.getSession();if(!session?.access_token)throw new Error("Sesi login tidak ditemukan.");
  const cfg=window.SIMANIS_CONFIG;
  const res=await fetch(`${cfg.SUPABASE_URL.replace(/\/$/,"")}/rest/v1/${path}`,{
    method,
    headers:{apikey:cfg.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json",Prefer:prefer},
    body:body===undefined?undefined:JSON.stringify(body)
  });
  const text=await res.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
  if(!res.ok)throw new Error(data?.message||data?.error||text||`HTTP ${res.status}`);
  return data;
}

function fileExt(name){const p=String(name||"").split(".");return p.length>1?p.pop().toLowerCase().replace(/[^a-z0-9]/g,""):"jpg"}
function safeMime(file){return file.type||({jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp"}[fileExt(file.name)]||"")}
function validateCover(file){
  const mime=safeMime(file);
  if(!ALLOWED_MIME.has(mime))throw new Error("Foto sampul harus JPG, PNG, atau WEBP.");
  if(file.size>MAX_FILE_SIZE)throw new Error("Ukuran foto sampul lebih dari 5 MB.");
  return mime;
}
function encodedStoragePath(path){return path.split("/").map(encodeURIComponent).join("/")}

async function uploadCover(file){
  const mime=validateCover(file);
  const session=await api.auth.getSession();if(!session?.access_token)throw new Error("Sesi login tidak ditemukan.");
  const cfg=window.SIMANIS_CONFIG,ext=fileExt(file.name),rand=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const path=`articles/${new Date().getFullYear()}/${rand}.${ext}`;
  const res=await fetch(`${cfg.SUPABASE_URL.replace(/\/$/,"")}/storage/v1/object/${STORAGE_BUCKET}/${encodedStoragePath(path)}`,{
    method:"POST",
    headers:{apikey:cfg.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`,"Content-Type":mime,"x-upsert":"false"},
    body:file
  });
  const text=await res.text();
  if(!res.ok){let msg=text;try{const j=JSON.parse(text);msg=j.message||j.error||text}catch{}throw new Error("Upload foto gagal: "+msg)}
  return path;
}

async function deleteCover(path){
  if(!path)return;
  const session=await api.auth.getSession();if(!session?.access_token)return;
  const cfg=window.SIMANIS_CONFIG;
  const res=await fetch(`${cfg.SUPABASE_URL.replace(/\/$/,"")}/storage/v1/object/${STORAGE_BUCKET}/${encodedStoragePath(path)}`,{
    method:"DELETE",
    headers:{apikey:cfg.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`}
  });
  if(!res.ok)console.warn("Cover lama gagal dihapus");
}

async function save(e){
  e.preventDefault();
  const btn=$("saveBtn");btn.disabled=true;btn.textContent="Menyimpan...";
  let uploadedPath=null;
  try{
    const id=$("articleId").value;
    const title=$("title").value.trim(),content=$("content").value.trim();
    if(!title||!content)throw new Error("Judul dan isi berita wajib diisi.");

    const coverFile=$("coverFile").files?.[0];
    if(coverFile)uploadedPath=await uploadCover(coverFile);

    const oldCover=$("oldCoverPath").value||null;
    const status=$("status").value;
    let pub=fromLocalInput($("publishedAt").value);
    if(status==="PUBLISHED"&&!pub)pub=new Date().toISOString();
    if(status==="DRAFT")pub=null;

    const excerpt=$("excerpt").value.trim()||makeExcerpt(content,240);
    const payload={
      title,
      slug:id?$("articleSlug").value:newSlug(title),
      excerpt,
      content,
      category:$("category").value,
      status,
      cover_path:uploadedPath||oldCover,
      cover_alt:$("coverAlt").value.trim()||null,
      is_featured:$("featured").checked,
      published_at:pub
    };

    if(id){
      await restWrite(`news_articles?id=eq.${encodeURIComponent(id)}`,"PATCH",payload);
      if(uploadedPath&&oldCover&&oldCover!==uploadedPath)await deleteCover(oldCover);
    }else{
      await restWrite("news_articles","POST",payload);
    }

    closeModal();
    await loadData();
  }catch(err){
    if(uploadedPath){try{await deleteCover(uploadedPath)}catch{}}
    $("formMessage").textContent="Gagal menyimpan: "+err.message;
  }finally{
    btn.disabled=false;btn.textContent="Simpan";
  }
}

async function remove(){
  const id=$("articleId").value;
  if(!id||!canDelete())return;
  const r=rows.find(x=>x.id===id);
  if(!r)return;
  if(!confirm(`Hapus berita "${r.title}"?`))return;
  try{
    await restWrite(`news_articles?id=eq.${encodeURIComponent(id)}`,"DELETE",undefined,"return=minimal");
    if(r.cover_path)await deleteCover(r.cover_path);
    closeModal();await loadData();
  }catch(err){alert("Gagal menghapus berita: "+err.message)}
}

$("searchInput").addEventListener("input",render);
$("categoryFilter").addEventListener("change",render);
$("statusFilter").addEventListener("change",render);
$("addBtn").addEventListener("click",openAdd);
$("closeModal").addEventListener("click",closeModal);
$("cancelBtn").addEventListener("click",closeModal);
$("deleteBtn").addEventListener("click",remove);
$("previewBtn").addEventListener("click",previewForm);
$("form").addEventListener("submit",save);
$("excerpt").addEventListener("input",updateCounts);
$("content").addEventListener("input",updateCounts);
$("coverFile").addEventListener("change",()=>{
  const f=$("coverFile").files?.[0];
  if(!f){showCover($("oldCoverPath").value||"");return}
  try{validateCover(f);const url=URL.createObjectURL(f);showCover(url);setTimeout(()=>URL.revokeObjectURL(url),120000)}
  catch(err){alert(err.message);$("coverFile").value="";showCover($("oldCoverPath").value||"")}
});
$("status").addEventListener("change",()=>{
  if($("status").value==="PUBLISHED"&&!$("publishedAt").value){
    const d=new Date(),pad=n=>String(n).padStart(2,"0");
    $("publishedAt").value=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  if($("status").value==="DRAFT")$("publishedAt").value="";
});
$("modal").addEventListener("click",e=>{if(e.target===$("modal"))closeModal()});

(async()=>{
  try{
    api=await window.simanisReady;
    const user=await api.auth.getUser();
    if(!user){location.href="index.html";return}
    profile=await loadProfile(user);
    $("sideUserName").textContent=profile.full_name||"Pengguna";
    $("sideUserRole").textContent=formatRole(profile.role);
    $("headerUser").textContent=profile.full_name||"Pengguna";
    $("currentDate").textContent=localDateID();
    await loadMenu();
    if(!modulePerm.can_view)throw new Error("Akun tidak memiliki akses ke modul Berita Madrasah.");
    await loadData();
    $("logoutBtn").onclick=async()=>{await api.auth.signOut();location.href="index.html"};
  }catch(err){
    console.error(err);
    alert("Modul Berita gagal dimuat: "+err.message);
  }finally{
    $("loading").style.display="none";
  }
})();
