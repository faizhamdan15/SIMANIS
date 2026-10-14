const $=id=>document.getElementById(id);
let api,profile,user,contexts=[],classes=[],cpSources=[],activeDocument=null,documentId=null;
const ROUTES={DASHBOARD:"dashboard.html",ADMINISTRASI_KEPALA:"administrasi.html",DATA_SISWA:"siswa.html",DATA_GURU:"guru.html",KELAS:"kelas.html",MATA_PELAJARAN:"mapel.html",JADWAL:"jadwal.html",ABSENSI_GURU:"absensi-guru.html",ABSENSI_SISWA:"absensi-siswa.html",NILAI:"nilai.html",SIMANIS_AI:"simanis-ai.html",PRESTASI:"prestasi.html",BERITA:"berita.html",PENGUMUMAN:"pengumuman.html",AGENDA:"agenda.html",KEUANGAN:"unit-kerja.html?unit=PKM_BENDAHARA_SARPRAS&tab=finance",PORTAL_WALI:"wali-admin.html",PENGATURAN:"pengaturan.html",PKM_KURIKULUM:"unit-kerja.html?unit=PKM_KURIKULUM",PKM_KESISWAAN:"unit-kerja.html?unit=PKM_KESISWAAN",PKM_BENDAHARA_SARPRAS:"unit-kerja.html?unit=PKM_BENDAHARA_SARPRAS",PKM_HUMASY:"unit-kerja.html?unit=PKM_HUMASY",KEPALA_TU:"unit-kerja.html?unit=KEPALA_TU",KALAB_IPA:"unit-kerja.html?unit=KALAB_IPA",KALAB_BISNIS:"unit-kerja.html?unit=KALAB_BISNIS"};
const DOC_NAMES={TP:"Tujuan Pembelajaran",ATP:"Alur Tujuan Pembelajaran",PROTA:"Program Tahunan",PROMES:"Program Semester",MODUL_AJAR:"Modul Ajar / RPP",BAHAN_AJAR:"Bahan Ajar",LKPD:"Lembar Kerja Peserta Didik",MEDIA_PEMBELAJARAN:"Rancangan Media Pembelajaran",ASESMEN:"Instrumen Asesmen"};
function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}
function status(message,isError=false){$("status").textContent=message;$("status").style.color=isError?"#ad352e":"#426350"}
function setBusy(b){$("generateBtn").disabled=b;$("generateBtn").textContent=b?"Sedang membuat perangkat...":"✦ Generate dengan AI"}
function setDocumentButtons(on){["saveBtn","finalBtn","wordBtn","pdfBtn"].forEach(k=>$(k).disabled=!on)}
function currentContext(){return contexts.find(x=>x.class_id+"|"+x.subject_id===$("context").value)}
function phaseFor(c){const cl=classes.find(x=>x.id===c?.class_id);if(cl)return Number(cl.grade_level)===10?"E":"F";return /^X(?:\s|$|[-_0-9])/.test(c?.class_name||"")?"E":"F"}
async function rawWrite(path,method,payload){
  const s=await api.auth.getSession(),cfg=window.SIMANIS_CONFIG;
  if(!s?.access_token)throw new Error("Sesi login habis.");
  const r=await fetch(cfg.SUPABASE_URL.replace(/\/$/,"")+"/rest/v1/"+path,{
    method,headers:{"apikey":cfg.SUPABASE_PUBLISHABLE_KEY,Authorization:"Bearer "+s.access_token,"Content-Type":"application/json",Prefer:"return=representation"},
    body:JSON.stringify(payload)
  });
  const txt=await r.text();let data;try{data=txt?JSON.parse(txt):null}catch{data=txt}
  if(!r.ok)throw new Error(data?.message||data?.error||"Gagal menyimpan dokumen.");
  return data;
}
async function loadMenu(){
  const m=await api.db.rpc("get_my_modules",{});
  $("sidebarMenu").innerHTML=(m||[]).map(x=>'<a class="nav-item '+(x.code==="SIMANIS_AI"?"active":"")+'" href="'+esc(x.route||ROUTES[x.code]||"#")+'"><span class="nav-dot"></span><span>'+esc(x.name)+'</span></a>').join("");
}
async function loadContexts(){
  [contexts,classes]=await Promise.all([
    api.db.rpc("get_my_grade_context",{}),
    api.db.select("classes","select=id,name,grade_level&is_active=eq.true")
  ]);
  const seen=new Set();
  const opts=(contexts||[]).filter(x=>{const key=x.class_id+"|"+x.subject_id;if(seen.has(key))return false;seen.add(key);return true});
  contexts=opts;
  $("context").innerHTML='<option value="">Pilih kelas dan mapel...</option>'+opts.map(x=>'<option value="'+esc(x.class_id+"|"+x.subject_id)+'">'+esc(x.class_name+" • "+x.subject_name)+'</option>').join("");
  if(opts.length){$("context").value=opts[0].class_id+"|"+opts[0].subject_id;await loadCP()}
  else status("Belum ada penugasan kelas dan mapel pada akun ini.",true);
}
async function loadCP(){
  const c=currentContext();
  cpSources=[];$("cp").innerHTML='<option value="">Memuat CP resmi...</option>';
  if(!c){$("cp").innerHTML='<option value="">Pilih kelas dahulu</option>';return}
  try{
    const phase=phaseFor(c);
    cpSources=await api.db.select("curriculum_cp_sources","select=id,subject_id,phase,regulation,source_title,source_url,revision&subject_id=eq."+encodeURIComponent(c.subject_id)+"&phase=eq."+phase+"&is_verified=eq.true&order=created_at.desc");
    $("cp").innerHTML=cpSources.length?cpSources.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.source_title+" • Fase "+x.phase+" • "+x.revision)+'</option>').join(""):'<option value="">CP belum tersedia atau belum diverifikasi</option>';
    showCP();
    if(!cpSources.length)status("CP Fase "+phase+" untuk mapel ini belum diunggah dan diverifikasi admin. Generasi AI dinonaktifkan.",true);
    else status("CP resmi ditemukan. Pilih perangkat pembelajaran lalu klik Generate.");
  }catch(e){$("cp").innerHTML='<option value="">Referensi CP belum siap</option>';status("Basis data CP belum tersedia. Minta admin menjalankan migrasi SIMANIS AI.",true)}
}
function showCP(){
  const c=cpSources.find(x=>x.id===$("cp").value);
  if(!c){$("cpInfo").textContent="Hanya CP yang telah diverifikasi oleh admin kurikulum dapat digunakan.";return}
  $("cpInfo").innerHTML="Sumber: "+esc(c.regulation)+" · "+esc(c.source_title)+' · <a href="'+esc(c.source_url)+'" target="_blank" rel="noopener noreferrer">Lihat sumber resmi ↗</a>';
}
async function loadHistory(){
  try{
    const rows=await api.db.select("teacher_ai_documents","select=id,title,document_type,status,created_at&owner_id=eq."+encodeURIComponent(user.id)+"&order=created_at.desc&limit=30")||[];
    $("history").innerHTML=rows.length?rows.map(x=>'<li><button type="button" data-id="'+esc(x.id)+'"><strong>'+esc(x.title)+'</strong><small>'+esc(DOC_NAMES[x.document_type]||x.document_type)+" · "+esc(x.status)+" · "+esc(new Date(x.created_at).toLocaleDateString("id-ID"))+'</small></button></li>').join(""):'<li class="ai-empty">Belum ada dokumen yang tersimpan.</li>';
    document.querySelectorAll("[data-id]").forEach(el=>el.onclick=()=>openHistory(el.dataset.id));
  }catch(e){$("history").innerHTML='<li class="ai-empty">Arsip belum dapat dimuat.</li>'}
}
async function openHistory(id){
  try{
    const rows=await api.db.select("teacher_ai_documents","select=*&id=eq."+encodeURIComponent(id)+"&limit=1");
    const doc=rows?.[0];if(!doc)return;
    documentId=doc.id;activeDocument={class_id:doc.class_id,subject_id:doc.subject_id,cp_source_id:doc.cp_source_id,document_type:doc.document_type,semester:doc.semester,topic:doc.topic,model_name:doc.model_name};
    $("documentTitle").value=doc.title;
    $("result").value=doc.content||"";
    $("documentMeta").textContent=(DOC_NAMES[doc.document_type]||doc.document_type)+" · "+(doc.status||"DRAFT")+" · Arsip pribadi";
    $("context").value=doc.class_id+"|"+doc.subject_id;
    await loadCP();
    $("cp").value=doc.cp_source_id;
    showCP();
    $("documentType").value=doc.document_type;
    $("semester").value=doc.semester||"Ganjil";
    $("topic").value=doc.topic||"";
    setDocumentButtons(Boolean(doc.content?.trim()));
    status("Dokumen dari arsip dimuat. Perubahan baru tersimpan setelah menekan Simpan Draf.");
  }catch(e){status(e.message,true)}
}
async function generate(e){
  e.preventDefault();
  const c=currentContext(),cp=cpSources.find(x=>x.id===$("cp").value);
  if(!c||!cp){status("Pilih kelas dan CP resmi yang telah diverifikasi terlebih dahulu.",true);return}
  if($("result").value.trim()&&!confirm("Hasil yang belum disimpan akan diganti. Lanjutkan?"))return;
  setBusy(true);
  try{
    const s=await api.auth.getSession();
    if(!s?.access_token)throw new Error("Sesi telah habis, masuk kembali.");
    const payload={
      class_id:c.class_id,subject_id:c.subject_id,cp_source_id:cp.id,
      document_type:$("documentType").value,semester:$("semester").value,
      topic:$("topic").value,jp_per_week:Number($("jp").value),
      meetings:Number($("meetings").value),notes:$("notes").value
    };
    const res=await fetch("/api/simanis-ai",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+s.access_token},body:JSON.stringify(payload)});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.error||"Layanan AI gagal diakses.");
    documentId=null;
    activeDocument={...payload,model_name:data.model};
    $("result").value=data.content;
    $("documentTitle").value=data.title;
    $("documentMeta").textContent=(DOC_NAMES[payload.document_type]||payload.document_type)+" · DRAF AI · "+data.reference+" · "+data.model;
    setDocumentButtons(true);
    status("Draf berhasil dihasilkan. Periksa, edit, lalu klik Simpan Draf.");
  }catch(e){status(e.message,true)}
  finally{setBusy(false)}
}
async function saveDocument(final=false){
  if(!activeDocument){status("Buat atau buka dokumen terlebih dahulu.",true);return}
  const title=$("documentTitle").value.trim(),content=$("result").value.trim();
  if(title.length<3||!content){status("Judul dan isi dokumen wajib dilengkapi.",true);return}
  const data={
    owner_id:user.id,class_id:activeDocument.class_id,subject_id:activeDocument.subject_id,
    cp_source_id:activeDocument.cp_source_id,document_type:activeDocument.document_type,
    semester:activeDocument.semester||null,topic:activeDocument.topic||null,
    model_name:activeDocument.model_name||null,title,content,
    status:final?"FINAL":"DRAFT",updated_at:new Date().toISOString()
  };
  try{
    const rows=documentId?
      await rawWrite("teacher_ai_documents?id=eq."+encodeURIComponent(documentId),"PATCH",data):
      await rawWrite("teacher_ai_documents","POST",data);
    documentId=rows?.[0]?.id||documentId;
    $("documentMeta").textContent=(DOC_NAMES[activeDocument.document_type]||activeDocument.document_type)+" · "+data.status+" · Tersimpan";
    status(final?"Dokumen berhasil ditandai FINAL.":"Draf berhasil disimpan di akun Anda.");
    await loadHistory();
  }catch(e){status(e.message,true)}
}
function filename(){return ($("documentTitle").value||"Perangkat_Pembelajaran").replace(/[^a-zA-Z0-9_-]+/g,"_").slice(0,65)}
function wordDownload(){
  const title=esc($("documentTitle").value),body=esc($("result").value);
  const html='<!doctype html><html><head><meta charset="utf-8"><style>body{font:12pt/1.6 "Times New Roman",serif;margin:2.5cm}h1{text-align:center;font-size:16pt}pre{white-space:pre-wrap;font:inherit}</style></head><body><h1>'+title+'</h1><p><em>Draf SIMANIS AI — Periksa sebelum digunakan.</em></p><pre>'+body+'</pre></body></html>';
  const blob=new Blob(["\ufeff",html],{type:"application/msword;charset=utf-8"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename()+".doc";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  status("Dokumen Word-kompatibel diunduh (.doc), silakan buka dan simpan ulang sebagai .docx jika diperlukan.");
}
function printPDF(){
  $("printBody").textContent=$("result").value;
  window.print();
}
async function init(){
  try{
    api=await window.simanisReady;
    user=await api.auth.getUser();
    if(!user){location.replace("index.html?login_required=1");return}
    const p=await api.db.select("profiles","select=id,full_name,role,is_active&id=eq."+encodeURIComponent(user.id)+"&limit=1");
    profile=p?.[0];
    if(!profile?.is_active)throw new Error("Akun SIMANIS tidak aktif.");
    const permission=await api.db.rpc("get_my_module_permission",{p_module_code:"SIMANIS_AI"});
    if(permission?.can_view!==true){location.replace("dashboard.html?access_denied=SIMANIS_AI");return}
    $("sideUserName").textContent=$("headerUser").textContent=profile.full_name;
    $("sideUserRole").textContent=profile.role.replaceAll("_"," ");
    $("currentDate").textContent=new Date().toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"});
    await loadMenu();
    await loadContexts();
    await loadHistory();
    $("logoutBtn").onclick=async()=>{await api.auth.signOut();location.href="index.html"};
    $("context").onchange=loadCP;
    $("cp").onchange=showCP;
    $("aiForm").onsubmit=generate;
    $("refreshHistory").onclick=loadHistory;
    $("saveBtn").onclick=()=>saveDocument(false);
    $("finalBtn").onclick=()=>saveDocument(true);
    $("wordBtn").onclick=wordDownload;
    $("pdfBtn").onclick=printPDF;
  }catch(err){console.error("SIMANIS AI initialization failed:",err);status("SIMANIS AI belum dapat dimuat: "+err.message,true)}
  finally{$("loading").style.display="none"}
}
init();