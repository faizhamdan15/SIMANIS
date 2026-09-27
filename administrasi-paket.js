const $=id=>document.getElementById(id);
let api,profile,systemSettings=null,packageSummary=null,packageDocs=[],headManager=false;

function esc(s){
  return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
}
function formatRole(role){return (role||"-").replaceAll("_"," ")}
function localDateID(){
  return new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date());
}
function routeFor(code){
  return {
    DASHBOARD:"dashboard.html",ADMINISTRASI_KEPALA:"administrasi.html",DATA_SISWA:"siswa.html",DATA_GURU:"guru.html",
    KELAS:"kelas.html",MATA_PELAJARAN:"mapel.html",JADWAL:"jadwal.html",ABSENSI_GURU:"absensi-guru.html",
    ABSENSI_SISWA:"absensi-siswa.html",NILAI:"nilai.html",PRESTASI:"prestasi.html",BERITA:"berita.html",
    PENGUMUMAN:"pengumuman.html",AGENDA:"agenda.html",KEUANGAN:"unit-kerja.html?unit=PKM_BENDAHARA_SARPRAS&tab=finance",
    PORTAL_WALI:"wali-admin.html",PENGATURAN:"pengaturan.html",PKM_KURIKULUM:"unit-kerja.html?unit=PKM_KURIKULUM",
    PKM_KESISWAAN:"unit-kerja.html?unit=PKM_KESISWAAN",PKM_BENDAHARA_SARPRAS:"unit-kerja.html?unit=PKM_BENDAHARA_SARPRAS",
    PKM_HUMASY:"unit-kerja.html?unit=PKM_HUMASY",KEPALA_TU:"unit-kerja.html?unit=KEPALA_TU",
    KALAB_IPA:"unit-kerja.html?unit=KALAB_IPA",KALAB_BISNIS:"unit-kerja.html?unit=KALAB_BISNIS"
  }[code]||"#";
}
function sanitizeHtml(html){
  const tpl=document.createElement("template");tpl.innerHTML=String(html||"");
  tpl.content.querySelectorAll("script,iframe,object,embed,form,meta,base").forEach(el=>el.remove());
  tpl.content.querySelectorAll("*").forEach(el=>{
    [...el.attributes].forEach(a=>{
      const n=a.name.toLowerCase(),v=String(a.value||"").trim().toLowerCase();
      if(n.startsWith("on")||v.startsWith("javascript:")||v.startsWith("data:text/html"))el.removeAttribute(a.name);
    });
  });
  return tpl.innerHTML;
}
function asObject(x){return Array.isArray(x)?x[0]:x}
function artifactCount(d){
  return (Array.isArray(d.file_snapshot)?d.file_snapshot.length:0)+(Array.isArray(d.attachments_snapshot)?d.attachments_snapshot.length:0);
}
async function loadProfile(user){
  const query="select=id,full_name,role,is_active&id=eq."+encodeURIComponent(user.id)+"&limit=1";
  const p=await api.db.select("profiles",query);
  if(!p?.[0]||!p[0].is_active)throw new Error("Profil pengguna tidak aktif.");
  return p[0];
}
async function loadMenu(){
  const modules=await api.db.rpc("get_my_modules",{});
  $("sidebarMenu").innerHTML=(modules||[]).map(m=>
    '<a href="'+routeFor(m.code)+'" class="nav-item '+(m.code==="ADMINISTRASI_KEPALA"?"active":"")+'">'+
    '<span class="nav-dot"></span><span>'+esc(m.name)+'</span></a>'
  ).join("");
}
async function loadPackage(){
  const results=await Promise.all([
    api.db.rpc("get_admin_final_package_summary",{p_academic_year:"2026/2027"}),
    api.db.rpc("get_admin_final_package_documents",{p_academic_year:"2026/2027",p_category_code:null})
  ]);
  packageSummary=asObject(results[0])||{};
  packageDocs=results[1]||[];
  renderPackage();
}
function renderPackage(){
  const total=Number(packageSummary.total_documents||0);
  const finals=Number(packageSummary.final_documents||0);
  const missing=Number(packageSummary.missing_final_documents||0);
  const pct=Number(packageSummary.completion_percent||0);
  $("totalDocs").textContent=total;
  $("finalDocs").textContent=finals;
  $("missingDocs").textContent=missing;
  $("packagePercent").textContent=pct.toFixed(1)+"%";
  $("packageProgress").style.width=Math.max(0,Math.min(100,pct))+"%";
  $("packageChecksum").textContent=packageSummary.package_checksum_sha256||"Belum tersedia karena belum ada dokumen FINAL.";

  const alert=$("packageAlert");
  if(packageSummary.is_complete){
    alert.className="package-alert complete";
    alert.innerHTML="<b>Paket lengkap.</b> Seluruh "+total+" dokumen sudah FINAL dan siap dicetak sebagai arsip resmi TA 2026/2027.";
  }else{
    alert.className="package-alert";
    alert.innerHTML="<b>Paket belum lengkap.</b> "+finals+" dari "+total+" dokumen sudah FINAL. Masih ada <b>"+missing+"</b> dokumen yang belum disahkan. Preview struktur tetap dapat digunakan; cetak paket akan memuat FINAL yang tersedia.";
  }

  const cats=Array.isArray(packageSummary.categories)?packageSummary.categories:[];
  $("categoryGrid").innerHTML=cats.map(c=>{
    const cp=Number(c.completion_percent||0),cf=Number(c.final_documents||0),ct=Number(c.total_documents||0);
    return '<article class="package-category"><h4>'+String(c.category_order).padStart(2,"0")+'. '+esc(c.category_name)+'</h4>'+
      '<p>'+cf+' / '+ct+' FINAL · '+cp.toFixed(1)+'%</p><div class="bar"><div style="width:'+cp+'%"></div></div>'+
      '<div class="package-category-actions"><button type="button" data-cat-preview="'+esc(c.category_code)+'">Preview</button>'+
      '<button type="button" class="primary-small" data-cat-print="'+esc(c.category_code)+'">Cetak FINAL</button></div></article>';
  }).join("");
  document.querySelectorAll("[data-cat-preview]").forEach(b=>b.onclick=()=>openPackageWindow(b.dataset.catPreview,true,false));
  document.querySelectorAll("[data-cat-print]").forEach(b=>b.onclick=()=>openPackageWindow(b.dataset.catPrint,false,true));

  $("manifestCount").textContent=packageDocs.length+" dokumen";
  $("manifestBody").innerHTML=packageDocs.map(d=>{
    const final=!!d.final_id;
    const when=final?new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",day:"2-digit",month:"short",year:"numeric"}).format(new Date(d.finalized_at)):"-";
    const artifacts=artifactCount(d);
    return "<tr><td class=\"code\">"+esc(d.document_code.replace("ADM-",""))+"</td><td>"+esc(d.category_name)+"</td><td><b>"+esc(d.title)+"</b><div class=\"muted\">PIC: "+esc(d.responsible_name||"-")+"</div></td>"+
      "<td>"+(final?'<span class="final-chip">FINAL v'+Number(d.final_version)+'</span><div class="muted">'+esc(d.final_source_kind||"")+" · "+esc(when)+"</div>':'<span class="missing-chip">BELUM FINAL</span>')+"</td>"+
      "<td>"+esc(d.verified_by_name||"-")+"</td><td>"+(final?(artifacts+" file/lampiran"):"-")+"</td></tr>";
  }).join("");
}
function schoolAddress(){
  return [systemSettings?.address,systemSettings?.village,systemSettings?.district,systemSettings?.regency,systemSettings?.province].filter(Boolean).join(", ");
}
function categoryGroups(docs){
  const map=new Map();
  docs.forEach(d=>{
    if(!map.has(d.category_code))map.set(d.category_code,{code:d.category_code,name:d.category_name,order:Number(d.category_order||0),docs:[]});
    map.get(d.category_code).docs.push(d);
  });
  return [...map.values()].sort((a,b)=>a.order-b.order);
}
function finalManifestHtml(d){
  const files=Array.isArray(d.file_snapshot)?d.file_snapshot:[];
  const atts=Array.isArray(d.attachments_snapshot)?d.attachments_snapshot:[];
  const all=[
    ...files.map(x=>Object.assign({},x,{kind:"File Utama"})),
    ...atts.map(x=>Object.assign({},x,{kind:String(x.attachment_type||"Lampiran").replaceAll("_"," ")}))
  ];
  if(!all.length)return "";
  return '<div class="artifact-box"><b>Manifest Artefak FINAL</b><table><thead><tr><th>Jenis</th><th>Nama File</th><th>Keterangan</th></tr></thead><tbody>'+
    all.map(a=>'<tr><td>'+esc(a.kind)+'</td><td>'+esc(a.file_name||"-")+'</td><td>'+esc(a.description||a.mime_type||"-")+'</td></tr>').join("")+
    '</tbody></table></div>';
}
function finalDocHtml(d,index,total){
  if(!d.final_id){
    return '<section class="missing-final"><div class="package-code">'+esc(d.document_code)+'</div><h2>'+esc(d.title)+'</h2><div class="missing-stamp">BELUM FINAL</div><p>Dokumen ini tercantum dalam struktur paket, tetapi belum memiliki versi FINAL yang disahkan.</p></section>';
  }
  const when=new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",day:"2-digit",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(d.finalized_at));
  const content=d.content_html_snapshot?sanitizeHtml(d.content_html_snapshot):
    '<div class="file-only"><h3>Dokumen FINAL berbasis file/data</h3><p>Isi utama tersimpan sebagai artefak FINAL di SIMANIS. Manifest artefak tercantum di bawah.</p></div>';
  return '<section class="final-document"><div class="final-head"><div><b>'+esc(d.document_code)+' · '+esc(d.title)+'</b><span>'+esc(d.category_name)+'</span></div><div class="final-tag">FINAL v'+Number(d.final_version)+'</div></div>'+
    '<div class="final-audit">Disahkan: <b>'+esc(d.verified_by_name||"-")+'</b> · '+esc(when)+' · Sumber: '+esc(d.final_source_kind||"-")+
    (d.verification_note?' · Catatan: '+esc(d.verification_note):'')+
    '<div class="hash">SHA-256: '+esc(d.checksum_sha256||"-")+'</div></div>'+
    content+finalManifestHtml(d)+
    '<div class="doc-seq">Dokumen '+index+' dari '+total+'</div></section>';
}
function buildPackageHtml(categoryCode=null,previewAll=false){
  const all=categoryCode?packageDocs.filter(d=>d.category_code===categoryCode):packageDocs;
  const docs=previewAll?all:all.filter(d=>d.final_id);
  const groups=categoryGroups(previewAll?all:docs);
  const school=(systemSettings?.school_name||"MA Nurul Islam").toUpperCase();
  const short=systemSettings?.school_short_name||"MANISKA";
  const head=systemSettings?.headmaster_name||"Kepala Madrasah";
  const logo=new URL("logo.png",location.href).href;
  const title=categoryCode?(groups[0]?.name||categoryCode):"ADMINISTRASI KEPALA MADRASAH";
  const statusText=packageSummary.is_complete?"PAKET FINAL LENGKAP":"PAKET FINAL SEMENTARA";
  const checksum=packageSummary.package_checksum_sha256||"Belum tersedia";
  const generated=new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",day:"2-digit",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date());

  const tocGroups=categoryGroups(all);
  const toc=tocGroups.map(g=>'<div class="toc-group"><h3>'+String(g.order).padStart(2,"0")+'. '+esc(g.name)+'</h3>'+
    g.docs.map(d=>'<div class="toc-row"><span>'+esc(d.document_code.replace("ADM-",""))+' · '+esc(d.title)+'</span><b>'+(d.final_id?("FINAL v"+d.final_version):"BELUM FINAL")+'</b></div>').join("")+'</div>').join("");

  let seq=0;
  const body=groups.map(g=>'<section class="category-cover"><div class="cat-no">'+String(g.order).padStart(2,"0")+'</div><h2>'+esc(g.name)+'</h2><p>'+g.docs.filter(d=>d.final_id).length+' dari '+g.docs.length+' dokumen FINAL</p></section>'+
    g.docs.map(d=>finalDocHtml(d,++seq,docs.length)).join("")).join("");

  return '<!doctype html><html><head><meta charset="utf-8"><title>Paket Administrasi Kepala 2026-2027</title><style>'+
    '@page{size:A4;margin:17mm 15mm 18mm;@bottom-center{content:"SIMANIS · Administrasi Kepala · Halaman " counter(page) " dari " counter(pages);font:8pt Arial;color:#6b7871}}'+
    '@page cover{margin:0;@bottom-center{content:none}}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#17251e;margin:0;font-size:10pt;line-height:1.5}'+
    '.cover{page:cover;height:297mm;padding:30mm 23mm;display:flex;flex-direction:column;justify-content:space-between;background:#0b5f3d;color:#fff;page-break-after:always}.cover img{width:28mm;height:28mm;object-fit:contain;background:#fff;border-radius:50%;padding:3mm}.cover h1{font-size:28pt;line-height:1.08;margin:10mm 0 4mm}.cover h2{font-size:15pt;margin:0;color:#d5efe2}.cover .year{font-size:24pt;font-weight:800;margin-top:5mm}.cover-foot{font-size:9pt;color:#d8efe4}.cover-status{display:inline-block;margin-top:10mm;padding:3mm 5mm;border:1px solid rgba(255,255,255,.45);border-radius:99px;font-weight:bold;font-size:9pt}'+
    '.cert{page-break-after:always}.cert h1,.toc h1{text-align:center;font-size:18pt;color:#173f30}.cert-box{border:1px solid #cbd8d1;border-radius:4mm;padding:6mm;margin:7mm 0}.hash{font-family:monospace;font-size:7pt;word-break:break-all;background:#f3f6f4;padding:2mm;margin-top:2mm}.sign{margin-top:18mm;width:55%;margin-left:auto;text-align:center}.sign-space{height:20mm}'+
    '.toc{page-break-after:always}.toc-group{margin:4mm 0 7mm}.toc-group h3{font-size:11pt;color:#0b5f3d;border-bottom:1px solid #cbd8d1;padding-bottom:2mm}.toc-row{display:grid;grid-template-columns:1fr auto;gap:6mm;padding:1.3mm 0;border-bottom:1px dotted #d8e1dc;font-size:8.5pt}.toc-row b{font-size:7.5pt}'+
    '.category-cover{page-break-before:always;page-break-after:always;min-height:245mm;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;border:2px solid #0b5f3d}.category-cover .cat-no{font-size:54pt;font-weight:800;color:#12a97b}.category-cover h2{font-size:24pt;color:#173f30;margin:3mm 10mm}.category-cover p{color:#68776f}'+
    '.final-document{page-break-before:always;position:relative}.final-head{display:flex;justify-content:space-between;gap:8mm;border-bottom:2px solid #173f30;padding-bottom:3mm;margin-bottom:3mm}.final-head b{display:block;font-size:11pt}.final-head span{font-size:8pt;color:#6a7971}.final-tag{background:#173f30;color:#fff;border-radius:99px;padding:2mm 4mm;height:max-content;font-size:8pt;font-weight:bold;white-space:nowrap}.final-audit{font-size:8pt;background:#f1f8f4;border:1px solid #c8dfd1;padding:3mm;margin-bottom:5mm}.final-document table{width:100%;border-collapse:collapse;margin:3mm 0}.final-document th,.final-document td{border:1px solid #bcc9c2;padding:2mm;font-size:8pt;vertical-align:top}.final-document h1{font-size:16pt}.final-document h2{font-size:14pt}.final-document h3{font-size:11pt}.artifact-box{page-break-inside:avoid;margin-top:6mm;border-top:1px solid #ccd8d1;padding-top:3mm}.doc-seq{text-align:right;font-size:7pt;color:#78857e;margin-top:5mm}.file-only{padding:6mm;border:1px dashed #9aaca2;background:#fafcfb}.missing-final{page-break-before:always;min-height:220mm;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;border:2px dashed #d7a485;padding:15mm}.missing-final h2{font-size:20pt}.missing-stamp{font-size:11pt;font-weight:bold;color:#a44b1f;background:#fff0e8;padding:3mm 6mm;border-radius:99px;margin:5mm}.package-code{font-size:9pt;color:#67766e}'+
    '</style></head><body>'+
    '<section class="cover"><div><img src="'+logo+'"><h1>PAKET<br>'+esc(title)+'</h1><h2>'+esc(school)+'</h2><div class="year">TA 2026/2027</div><div class="cover-status">'+esc(statusText)+'</div></div><div class="cover-foot">'+esc(schoolAddress())+'<br>'+esc(short)+' · SIMANIS</div></section>'+
    '<section class="cert"><h1>LEMBAR KENDALI PAKET</h1><div class="cert-box"><table><tr><td><b>Satuan Pendidikan</b></td><td>'+esc(school)+'</td></tr><tr><td><b>Tahun Ajaran</b></td><td>2026/2027</td></tr><tr><td><b>Dokumen dalam struktur</b></td><td>'+all.length+'</td></tr><tr><td><b>Dokumen FINAL dalam cetakan</b></td><td>'+docs.filter(d=>d.final_id).length+'</td></tr><tr><td><b>Dibuat</b></td><td>'+esc(generated)+'</td></tr></table><div class="hash"><b>Checksum Paket SHA-256</b><br>'+esc(checksum)+'</div></div><p>Paket ini disusun dari versi FINAL terbaru yang tersimpan pada SIMANIS. Setiap dokumen FINAL memiliki checksum individual dan riwayat verifikasi.</p><div class="sign">Mengetahui,<br>Kepala Madrasah<div class="sign-space"></div><b>'+esc(head)+'</b></div></section>'+
    '<section class="toc"><h1>DAFTAR ISI / MANIFEST DOKUMEN</h1>'+toc+'</section>'+body+
    '</body></html>';
}
function openPackageWindow(categoryCode=null,previewAll=false,autoPrint=false){
  const all=categoryCode?packageDocs.filter(d=>d.category_code===categoryCode):packageDocs;
  const finals=all.filter(d=>d.final_id);
  if(!previewAll&&!finals.length){alert("Belum ada dokumen FINAL pada pilihan ini.");return}
  if(!previewAll&&finals.length<all.length){
    const ok=confirm("Paket belum lengkap. Cetakan hanya akan memuat "+finals.length+" dokumen FINAL dari "+all.length+" dokumen. Lanjutkan?");
    if(!ok)return;
  }
  const w=window.open("","_blank");if(!w){alert("Popup diblokir browser.");return}
  w.document.write(buildPackageHtml(categoryCode,previewAll));
  w.document.close();
  if(autoPrint)setTimeout(()=>w.print(),700);
}
$("previewStructureBtn").onclick=()=>openPackageWindow(null,true,false);
$("printFinalPackageBtn").onclick=()=>openPackageWindow(null,false,true);

(async function boot(){
  try{
    api=await window.simanisReady;
    const session=await api.auth.getSession();if(!session){location.replace("index.html");return}
    const user=await api.auth.getUser();if(!user){location.replace("index.html");return}
    profile=await loadProfile(user);
    headManager=!!(await api.db.rpc("is_admin_head_manager",{}));
    if(!headManager){alert("Paket Administrasi Kepala hanya dapat diakses Kepala Madrasah atau SUPER_ADMIN.");location.replace("administrasi.html");return}
    $("sideUserName").textContent=profile.full_name||user.email||"Pengguna";
    $("sideUserRole").textContent=formatRole(profile.role);
    $("headerUser").textContent=profile.full_name||user.email||"Pengguna";
    $("currentDate").textContent=localDateID();
    try{const x=await api.db.rpc("get_public_system_settings",{});systemSettings=asObject(x)}catch(_){systemSettings=null}
    await loadMenu();
    await loadPackage();
    $("logoutBtn").onclick=async()=>{await api.auth.signOut();location.replace("index.html")};
  }catch(err){
    console.error(err);
    alert("Paket Administrasi gagal dimuat: "+(err.message||err));
  }finally{$("loading").classList.add("hidden")}
})();