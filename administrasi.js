const $ = (id) => document.getElementById(id);
let api, profile;
let rows = [];
let categories = [];
let selectedCategory = null;
let uploadTarget = null;
let integrationSources = new Map();
let verifyTarget = null;
let systemSettings = null;
let attentionRows = [];
let attentionExpanded = false;
let followupTarget = null;
let headManager = false;
let picRecommendations = [];
let submitTarget = null;
let adminNotifications = [];
let adminNotificationUnread = 0;
let generatedDraftCurrent = null;
let generatedDraftEditing = false;
let generatedDraftAutosaveTimer = null;
let generatedDraftSaving = false;
let validationRows = [];
let validationSummary = null;
let validationReviewIndex = -1;
let picTaskExpanded = false;
let validationReturnAfterVerify = false;
let attachmentTarget = null;
let currentFinalDocument = null;
let picMonitorRows = [];
let activeAcademicYear = null;

function esc(s){
  return String(s ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
}
function formatRole(role){ return (role || "-").replaceAll("_"," "); }
function localDateID(){
  return new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date());
}
function routeFor(code){
  return {
    DASHBOARD:"dashboard.html",
    ADMINISTRASI_KEPALA:"administrasi.html",
    DATA_SISWA:"siswa.html",
    DATA_GURU:"guru.html",
    KELAS:"kelas.html",
    MATA_PELAJARAN:"mapel.html",
    JADWAL:"jadwal.html",
    ABSENSI_GURU:"absensi-guru.html",
    ABSENSI_SISWA:"absensi-siswa.html",
    NILAI:"nilai.html",
    PRESTASI:"prestasi.html",
    BERITA:"berita.html",
    PENGUMUMAN:"pengumuman.html",
    AGENDA:"agenda.html",
    KEUANGAN:"keuangan.html",
    PORTAL_WALI:"wali-admin.html",
    PENGATURAN:"pengaturan.html",
    PKM_KURIKULUM:"unit-kerja.html?unit=PKM_KURIKULUM",
    PKM_KESISWAAN:"unit-kerja.html?unit=PKM_KESISWAAN",
    PKM_BENDAHARA_SARPRAS:"unit-kerja.html?unit=PKM_BENDAHARA_SARPRAS",
    PKM_HUMASY:"unit-kerja.html?unit=PKM_HUMASY",
    KEPALA_TU:"unit-kerja.html?unit=KEPALA_TU",
    KALAB_IPA:"unit-kerja.html?unit=KALAB_IPA",
    KALAB_BISNIS:"unit-kerja.html?unit=KALAB_BISNIS"
  }[code]||"#";
}
function statusLabel(s){
  return {BELUM_ADA:"Belum Ada",DRAFT:"Draft",MENUNGGU_VERIFIKASI:"Menunggu Verifikasi",PERLU_REVISI:"Perlu Revisi",LENGKAP:"Lengkap"}[s] || s;
}
function integrationRoute(key){
  return {
    teacher_attendance_daily:"absensi-guru.html",
    teacher_attendance_monthly:"absensi-guru.html",
    student_master:"siswa.html",
    student_attendance_by_class:"absensi-siswa-rekap.html",
    student_count_by_class:"kelas.html",
    student_achievements:"prestasi.html",
    student_report_cards:"nilai-semester.html",
    promotion_graduation:"siswa.html",
    inventory_master:"unit-kerja.html?unit=PKM_BENDAHARA_SARPRAS",
    finance_cashbook:"unit-kerja.html?unit=PKM_BENDAHARA_SARPRAS&tab=finance",
    incoming_mail:"unit-kerja.html?unit=KEPALA_TU",
    outgoing_mail:"unit-kerja.html?unit=KEPALA_TU"
  }[key]||null;
}
function integrationBadge(r){
  if(!r.integration_key)return "";
  const count=integrationSources.get(r.integration_key)||0;
  return '<span class="integration-badge">Terhubung SIMANIS'+(count>0?' · '+count+' data':'')+'</span>';
}
function integrationButton(r){
  const route=r.integration_key?integrationRoute(r.integration_key):null;
  return route?'<a href="'+route+'" class="secondary-btn" style="text-decoration:none;display:inline-flex;align-items:center">Buka Sumber</a>':"";
}
function generatedDraftStateLabel(state){
  return {AUTO:"Draft Otomatis",EDITING:"Sedang Diedit",READY:"Siap Diverifikasi"}[state]||"Draft Otomatis";
}
function canVerify(){
  return !!headManager;
}
function verificationMeta(r){
  if(!r.verified_at)return "";
  const when=new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(r.verified_at));
  return '<span class="doc-file">Diverifikasi '+esc(r.verified_by_name||"-")+' · '+esc(when)+'</span>';
}
function submissionMeta(r){
  if(!r.submitted_at)return "";
  const when=new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(r.submitted_at));
  return '<span class="doc-file">Diajukan '+esc(r.submitted_by_name||"-")+' · '+esc(when)+'</span>';
}
async function loadProfile(user){
  const p = await api.db.select("profiles",`select=id,full_name,role,is_active&id=eq.${encodeURIComponent(user.id)}&limit=1`);
  if(!p?.[0]) throw new Error("Profil pengguna tidak ditemukan.");
  if(!p[0].is_active) throw new Error("Akun SIMANIS tidak aktif.");
  const role=String(p[0].role||"").toUpperCase();
  const perm=await api.db.rpc("get_my_module_permission",{p_module_code:"ADMINISTRASI_KEPALA"});
  if(!["SUPER_ADMIN","KEPALA_MADRASAH"].includes(role) && !perm?.can_view){
    throw new Error("Akun tidak memiliki akses Administrasi Kepala Madrasah.");
  }
  return p[0];
}
async function loadActiveAcademicYear(){
  const ay=await api.db.select("academic_years","select=id,name,start_date,end_date,is_active&is_active=eq.true&order=start_date.desc&limit=1");
  if(!ay?.[0]?.name)throw new Error("Tahun ajaran aktif belum ditetapkan.");
  activeAcademicYear=ay[0].name;
  const label=$("adminAcademicYearText");if(label)label.textContent=activeAcademicYear;
  const packageLink=$("adminPackageLink");if(packageLink)packageLink.textContent="Paket Administrasi "+activeAcademicYear;
  return ay[0];
}
function activeAcademicYearFolder(){
  return String(activeAcademicYear||"").replaceAll("/","-");
}
async function loadMenu(){
  const modules = await api.db.rpc("get_my_modules",{});
  $("sidebarMenu").innerHTML=(modules||[]).map(m=>`
    <a href="${routeFor(m.code)}" class="nav-item ${m.code==="ADMINISTRASI_KEPALA"?"active":""}">
      <span class="nav-dot"></span><span>${esc(m.name)}</span>
    </a>`).join("");
  document.querySelectorAll('.nav-item[href="#"]').forEach(a=>a.addEventListener("click",e=>{e.preventDefault();alert(`Modul "${a.textContent.trim()}" akan diaktifkan bertahap.`);}));
}
async function loadData(){
  try{
    const syncRows=await api.db.rpc("sync_admin_document_integrations",{})||[];
    integrationSources=new Map(syncRows.map(x=>[x.integration_key,Number(x.source_count||0)]));
  }catch(err){
    console.warn("Sinkronisasi administrasi:",err);
    integrationSources=new Map();
  }
  rows = await api.db.select("v_admin_document_status",`select=*&academic_year=eq.${encodeURIComponent(activeAcademicYear)}&order=category_order.asc,document_order.asc`) || [];
  try{attentionRows=await api.db.rpc("get_admin_document_attention",{p_academic_year:activeAcademicYear})||[]}catch(err){console.warn("Perlu perhatian:",err);attentionRows=[]}
  if(headManager){
    try{picRecommendations=await api.db.rpc("list_admin_pic_recommendations",{})||[]}catch(err){console.warn("PIC kategori:",err);picRecommendations=[]}
    try{picMonitorRows=await api.db.rpc("get_admin_pic_monitor",{p_academic_year:activeAcademicYear})||[]}catch(err){console.warn("Monitoring PIC:",err);picMonitorRows=[]}
  }else{
    picRecommendations=[];
    picMonitorRows=[];
  }
  try{
    const vr=await Promise.all([
      api.db.rpc("get_admin_document_readiness",{p_academic_year:activeAcademicYear}),
      api.db.rpc("get_admin_validation_summary",{p_academic_year:activeAcademicYear})
    ]);
    validationRows=vr[0]||[];
    validationSummary=vr[1]||null;
  }catch(err){
    console.warn("Kesiapan administrasi:",err);
    validationRows=[];validationSummary=null;
  }
  const map = new Map();
  rows.forEach(r=>{ if(!map.has(r.category_id)) map.set(r.category_id,{id:r.category_id,code:r.category_code,name:r.category_name,order:r.category_order,expected:r.expected_documents}); });
  categories=[...map.values()].sort((a,b)=>a.order-b.order);
  if(!selectedCategory && categories.length) selectedCategory=categories[0].id;
  renderStats(); renderValidationCenter(); renderPicMonitoring(); renderPicTaskCenter(); renderVerificationQueue(); renderAttention(); renderCategories(); renderDocs(); await loadAdminNotifications();
}
function renderStats(){
  const total=rows.length, complete=rows.filter(r=>r.status==="LENGKAP").length, draft=rows.filter(r=>r.status==="DRAFT").length, pending=rows.filter(r=>r.status==="MENUNGGU_VERIFIKASI").length, revision=rows.filter(r=>r.status==="PERLU_REVISI").length, missing=rows.filter(r=>r.status==="BELUM_ADA").length, manual=rows.filter(r=>!!r.manual_requirement_reason).length;
  const available=Math.max(0,total-missing), pct=total?Math.round(available/total*100):0;
  $("statComplete").textContent=complete; $("statDraft").textContent=draft; $("statPending").textContent=pending; $("statRevision").textContent=revision; $("statMissing").textContent=missing;
  $("overallText").textContent="Cakupan administrasi: "+available+" / "+total+" ("+pct+"%) · Lengkap terverifikasi: "+complete+" · Butuh bukti aktual: "+manual; $("overallFill").style.width=pct+"%";
}

function readinessLabelText(label){
  return {SIAP:"Siap",HAMPIR_SIAP:"Hampir Siap",PERLU_DILENGKAPI:"Perlu Dilengkapi",BELUM_SIAP:"Belum Siap",TERVERIFIKASI:"Terverifikasi"}[label]||label||"-";
}
function renderValidationCenter(){
  const panel=$("validationCenter");if(!panel)return;
  if(!headManager){panel.style.display="none";return}
  panel.style.display="block";
  const sum=validationSummary||{};
  $("validationAvg").textContent=Number(sum.average_readiness||0).toFixed(1)+"%";
  $("validationReady").textContent=Number(sum.ready_to_submit||0);
  $("validationPending").textContent=Number(sum.pending_verification||0);
  $("validationRevision").textContent=Number(sum.needs_revision||0);
  $("validationVerified").textContent=Number(sum.verified||0);
  $("validationReviewStartBtn").textContent=Number(sum.pending_verification||0)>0?"Review Menunggu ("+Number(sum.pending_verification||0)+")":"Mulai Review";
  const priority=validationRows.filter(r=>r.status==='MENUNGGU_VERIFIKASI'||r.ready_to_submit||r.status==='PERLU_REVISI').slice(0,8);
  const fallback=validationRows.filter(r=>r.status!=='LENGKAP').slice(0,8);
  const data=priority.length?priority:fallback;
  $("validationPriorityList").innerHTML=data.length?data.map(r=>
    '<div class="validation-row"><strong>'+Number(r.readiness_score||0)+'%</strong><div><h4>'+esc(r.document_code.replace("ADM-",""))+' · '+esc(r.title)+'</h4><p>'+esc(r.category_name)+' · '+esc(statusLabel(r.status))+' · '+esc(readinessLabelText(r.readiness_label))+' · PIC: <b>'+esc(r.responsible_name||"-")+'</b></p></div><div><button class="secondary-btn" type="button" data-validation-review="'+r.record_id+'">Tinjau</button></div></div>'
  ).join(''):'<div class="admin-empty">Belum ada dokumen untuk ditinjau.</div>';
  document.querySelectorAll("[data-validation-review]").forEach(b=>b.onclick=()=>openValidationReview(b.dataset.validationReview));
}
function validationCheckHtml(ok,label,detail){
  return '<div class="validation-check '+(ok?"ok":"no")+'"><b>'+(ok?"✓ ":"! ")+esc(label)+'</b>'+(detail?'<div style="margin-top:3px;font-size:8px">'+esc(detail)+'</div>':'')+'</div>';
}
function openValidationReview(recordId){
  if(!validationRows.length)return;
  validationReviewIndex=validationRows.findIndex(x=>x.record_id===recordId);
  if(validationReviewIndex<0)validationReviewIndex=0;
  renderValidationReview();
  $("validationReviewModal").classList.remove("hidden");
}
function renderValidationReview(){
  const r=validationRows[validationReviewIndex];if(!r)return;
  const main=rows.find(x=>x.record_id===r.record_id);
  $("validationReviewTitle").textContent="Review · "+r.document_code.replace("ADM-","")+" · "+r.title;
  $("validationReviewMeta").textContent=r.category_name+" · Status "+statusLabel(r.status)+" · PIC: "+(r.responsible_name||"-")+" · "+readinessLabelText(r.readiness_label);
  $("validationReviewScore").textContent=Number(r.readiness_score||0)+"%";
  $("validationReviewFill").style.width=Math.max(0,Math.min(100,Number(r.readiness_score||0)))+"%";
  $("validationReviewChecks").innerHTML=[
    validationCheckHtml(r.check_pic,"PIC ditentukan",r.responsible_name||"Belum ada PIC"),
    validationCheckHtml(r.check_working_document,"Dokumen kerja tersedia",r.has_file?"Ada file":r.has_generated_draft?"Ada draft kerja":Number(r.source_count||0)>0?"Ada sumber SIMANIS":"Belum ada bukti"),
    validationCheckHtml(r.check_reviewed,"Sudah ditinjau/diedit",r.generated_draft_edit_state?generatedDraftStateLabel(r.generated_draft_edit_state):"Berbasis file/data"),
    validationCheckHtml(r.check_no_placeholders,"Placeholder / form isian",r.has_placeholders?(r.blank_form_allowed?"Form kosong diperbolehkan sebagai format administrasi":"Masih ada ... / kolom yang harus dilengkapi"):"Tidak terdeteksi placeholder"),
    validationCheckHtml(r.check_actual_evidence,"Bukti aktual terpenuhi",r.manual_requirement_reason?(r.check_actual_evidence?"Bukti aktual tersedia":"Masih membutuhkan bukti aktual"):"Tidak memerlukan bukti khusus"),
    validationCheckHtml(r.check_ready_state,"Status dokumen siap",r.check_ready_state?"Siap untuk tahap berikutnya":"Belum ditandai siap")
  ].join("");
  $("validationReviewReason").textContent=r.manual_requirement_reason?("Catatan bukti aktual: "+r.manual_requirement_reason):"";
  $("validationOpenDraft").style.display=main?.generated_draft_id?"inline-flex":"none";
  $("validationOpenSource").style.display=main?.integration_key&&integrationRoute(main.integration_key)?"inline-flex":"none";
  $("validationFollowup").style.display=headManager?"inline-flex":"none";
  $("validationVerify").style.display=headManager&&r.status==="MENUNGGU_VERIFIKASI"?"inline-flex":"none";
  $("validationPrev").disabled=validationReviewIndex<=0;
  $("validationNext").disabled=validationReviewIndex>=validationRows.length-1;
}
function closeValidationReview(){$("validationReviewModal").classList.add("hidden")}
async function dispatchPicTasks(){
  const btn=$("validationDispatchPicBtn");if(!btn||!headManager)return;
  btn.disabled=true;btn.textContent="Memeriksa...";
  try{
    const result=await api.db.rpc("dispatch_admin_tasks_to_pics",{p_academic_year:activeAcademicYear,p_force:false});
    const data=Array.isArray(result)?result[0]:result;
    const sent=Number(data?.sent_count||0),skipped=Number(data?.skipped_count||0);
    if(sent>0)alert("Tugas PIC diperbarui untuk "+sent+" kategori. "+skipped+" kategori tidak dikirim ulang karena belum berubah.");
    else alert("Tidak ada perubahan tugas PIC. Notifikasi duplikat tidak dikirim.");
  }catch(err){
    alert("Gagal memperbarui tugas PIC: "+(err.message||err));
  }finally{
    btn.disabled=false;btn.textContent="Perbarui Tugas PIC";
  }
}
async function runValidationSmartComplete(){
  const btn=$("validationSmartCompleteBtn");if(!btn||!headManager)return;
  btn.disabled=true;btn.textContent='Memproses...';
  try{
    const results=await Promise.all([
      api.db.rpc("auto_ready_structurally_valid_admin_drafts",{}),
      api.db.rpc("smart_complete_admin_data_drafts",{}),
      api.db.rpc("smart_complete_admin_plan_drafts",{})
    ]);
    const a=Array.isArray(results[0])?results[0][0]:results[0];
    const b=Array.isArray(results[1])?results[1][0]:results[1];
    const c=Array.isArray(results[2])?results[2][0]:results[2];
    await loadData();
    alert("Smart Complete selesai. Struktur: "+Number(a?.updated_count||0)+" · Data: "+Number(b?.completed_count||0)+" · Rencana/Prosedur: "+Number(c?.completed_count||0));
  }catch(err){
    alert("Smart Complete gagal: "+(err.message||err));
  }finally{btn.disabled=false;btn.textContent='Smart Complete Aman';}
}
function startValidationReview(){
  if(!validationRows.length)return;
  const idx=validationRows.findIndex(r=>r.status==='MENUNGGU_VERIFIKASI');
  const idx2=idx>=0?idx:validationRows.findIndex(r=>r.ready_to_submit);
  validationReviewIndex=idx2>=0?idx2:0;
  renderValidationReview();
  $("validationReviewModal").classList.remove("hidden");
}
function moveValidationReview(step){
  const next=validationReviewIndex+step;
  if(next<0||next>=validationRows.length)return;
  validationReviewIndex=next;renderValidationReview();
}
function monitorDateText(value){
  if(!value)return "Belum pernah";
  return new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(value));
}
function renderPicMonitoring(){
  const panel=$("picMonitoringPanel");if(!panel)return;
  if(!headManager){panel.style.display="none";return}
  panel.style.display="block";
  $("picMonitoringSummary").textContent=picMonitorRows.length+" kategori";
  if(!picMonitorRows.length){
    $("picMonitoringGrid").innerHTML='<div class="admin-empty">Data monitoring PIC belum tersedia.</div>';
    return;
  }
  $("picMonitoringGrid").innerHTML=picMonitorRows.map(r=>{
    const total=Number(r.total_count||0),fin=Number(r.final_count||0),pct=total?Math.round(fin/total*100):0;
    const self=profile?.id===r.recipient_id;
    const outstanding=Number(r.ready_count||0)+Number(r.needs_work_count||0)+Number(r.revision_count||0)+Number(r.pending_count||0);
    return '<article class="pic-monitor-card">'+
      '<div class="pic-monitor-head"><div><h4>'+String(r.category_order).padStart(2,"0")+'. '+esc(r.category_name)+'</h4><p>'+esc(r.recipient_name||"-")+' · '+esc(String(r.position_code||"").replaceAll("_"," "))+'</p></div><div class="pic-monitor-score">'+Number(r.average_readiness||0).toFixed(1)+'%</div></div>'+
      '<div class="pic-monitor-track"><div style="width:'+pct+'%"></div></div>'+
      '<div class="pic-monitor-stats">'+
        '<div class="pic-monitor-stat"><b>'+fin+'/'+total+'</b><span>FINAL</span></div>'+
        '<div class="pic-monitor-stat"><b>'+Number(r.ready_count||0)+'</b><span>Siap</span></div>'+
        '<div class="pic-monitor-stat"><b>'+Number(r.needs_work_count||0)+'</b><span>Kurang</span></div>'+
        '<div class="pic-monitor-stat"><b>'+Number(r.pending_count||0)+'</b><span>Menunggu</span></div>'+
      '</div>'+
      '<div class="pic-monitor-foot">Terlambat: <b>'+Number(r.overdue_count||0)+'</b> · Tugas dikirim: '+esc(monitorDateText(r.last_dispatch_at))+' · Pengingat: '+esc(monitorDateText(r.last_reminder_at))+'</div>'+
      '<div class="pic-monitor-actions"><button type="button" data-monitor-open="'+esc(r.category_code)+'">Buka Kategori</button>'+
      (!self&&outstanding>0?'<button type="button" class="secondary-btn" data-monitor-remind="'+esc(r.category_code)+'">Kirim Pengingat</button>':'')+
      '</div></article>';
  }).join("");
  document.querySelectorAll("[data-monitor-open]").forEach(b=>b.onclick=()=>openMonitorCategory(b.dataset.monitorOpen));
  document.querySelectorAll("[data-monitor-remind]").forEach(b=>b.onclick=()=>remindPicCategory(b.dataset.monitorRemind));
}
function openMonitorCategory(code){
  const cat=categories.find(c=>c.code===code);if(!cat)return;
  selectedCategory=cat.id;
  $("docSearch").value="";
  $("statusFilter").value="";
  renderCategories();renderDocs();
  setTimeout(()=>document.getElementById("docList")?.scrollIntoView({behavior:"smooth",block:"start"}),60);
}
async function remindPicCategory(code){
  const row=picMonitorRows.find(r=>r.category_code===code);if(!row)return;
  if(!confirm("Kirim pengingat administrasi "+row.category_name+" kepada "+row.recipient_name+"?"))return;
  try{
    await api.db.rpc("remind_admin_pic",{p_category_code:code,p_academic_year:activeAcademicYear});
    alert("Pengingat berhasil dikirim kepada "+row.recipient_name+".");
    await loadData();
  }catch(err){
    alert("Pengingat tidak dikirim: "+(err.message||err));
  }
}

function picTaskNextAction(r){
  if(r.status==="MENUNGGU_VERIFIKASI")return "Menunggu verifikasi Kepala Madrasah";
  if(r.status==="PERLU_REVISI")return "Perbaiki sesuai catatan revisi lalu tandai siap";
  if(r.ready_to_submit)return "Dokumen siap — ajukan verifikasi";
  if(!r.check_working_document)return "Buat draft kerja, buka sumber SIMANIS, atau unggah dokumen";
  if(!r.check_reviewed)return "Buka dan tinjau draft kerja";
  if(!r.check_no_placeholders)return "Lengkapi placeholder/kolom wajib";
  if(!r.check_actual_evidence)return "Isi data aktual dan tambahkan bukti pendukung";
  if(!r.check_ready_state)return "Tandai dokumen Siap Diverifikasi";
  return "Tinjau dokumen";
}
function picTaskActionLabel(r){
  if(r.status==="MENUNGGU_VERIFIKASI")return "Lihat";
  if(r.ready_to_submit)return "Ajukan Verifikasi";
  if(r.has_generated_draft)return "Kerjakan Draft";
  const main=rows.find(x=>x.record_id===r.record_id);
  if(main?.integration_key&&integrationRoute(main.integration_key))return "Buka Sumber";
  return "Buka Dokumen";
}
function renderPicTaskCenter(){
  const panel=$("picTaskCenter");if(!panel)return;
  if(headManager){panel.style.display="none";return}
  panel.style.display="block";
  const tasks=validationRows.filter(r=>r.status!=="LENGKAP");
  const ready=tasks.filter(r=>r.ready_to_submit).length;
  const revision=tasks.filter(r=>r.status==="PERLU_REVISI").length;
  const pending=tasks.filter(r=>r.status==="MENUNGGU_VERIFIKASI").length;
  const needs=tasks.filter(r=>!r.ready_to_submit&&r.status!=="PERLU_REVISI"&&r.status!=="MENUNGGU_VERIFIKASI").length;
  $("picTaskReady").textContent=ready;
  $("picTaskNeedsWork").textContent=needs;
  $("picTaskRevision").textContent=revision;
  $("picTaskPending").textContent=pending;
  $("picTaskSubmitAllBtn").style.display=ready>0?"inline-flex":"none";
  $("picTaskSubmitAllBtn").textContent=ready>0?("Ajukan Semua Siap ("+ready+")"):"Ajukan Semua Siap";
  const ordered=[...tasks].sort((a,b)=>{
    const rank=x=>x.status==="PERLU_REVISI"?0:x.ready_to_submit?1:x.status==="MENUNGGU_VERIFIKASI"?3:2;
    return rank(a)-rank(b)||Number(b.readiness_score||0)-Number(a.readiness_score||0)||Number(a.category_order||0)-Number(b.category_order||0)||Number(a.document_order||0)-Number(b.document_order||0);
  });
  const data=picTaskExpanded?ordered:ordered.slice(0,8);
  $("picTaskToggleBtn").textContent=picTaskExpanded?"Ringkas":"Lihat Semua ("+ordered.length+")";
  $("picTaskList").innerHTML=data.length?data.map(r=>
    '<div class="pic-task-row"><div class="pic-task-score">'+Number(r.readiness_score||0)+'%</div><div><h4>'+esc(r.document_code.replace("ADM-",""))+' · '+esc(r.title)+'</h4><p>'+esc(r.category_name)+' · '+esc(statusLabel(r.status))+' · '+esc(readinessLabelText(r.readiness_label))+'</p><div class="task-action-text">'+esc(picTaskNextAction(r))+'</div></div><div><button class="'+(r.ready_to_submit?"primary-small":"secondary-btn")+'" type="button" data-pic-task="'+r.record_id+'">'+esc(picTaskActionLabel(r))+'</button></div></div>'
  ).join(""):'<div class="admin-empty">Tidak ada tugas administrasi yang perlu ditindaklanjuti.</div>';
  document.querySelectorAll("[data-pic-task]").forEach(b=>b.onclick=()=>runPicTaskAction(b.dataset.picTask));
}
function openBulkSubmitModal(){
  const ready=validationRows.filter(r=>r.ready_to_submit&&["DRAFT","PERLU_REVISI"].includes(r.status));
  if(!ready.length){alert("Belum ada dokumen yang siap diajukan.");return}
  const categoryMap=new Map();
  ready.forEach(r=>categoryMap.set(r.category_name,(categoryMap.get(r.category_name)||0)+1));
  const cats=[...categoryMap.entries()].map(([name,n])=>esc(name)+": <b>"+n+"</b>").join("<br>");
  $("bulkSubmitSummary").innerHTML="<b>"+ready.length+" dokumen siap diajukan</b><br><br>"+cats+
    "<br><br>Semua dokumen di atas telah memiliki skor kesiapan 100% pada akun Anda.";
  $("bulkSubmitNote").value="";
  $("bulkSubmitMessage").textContent="";
  $("bulkSubmitModal").classList.remove("hidden");
}
function closeBulkSubmitModal(){
  $("bulkSubmitModal").classList.add("hidden");
  $("bulkSubmitMessage").textContent="";
}
async function confirmBulkSubmit(){
  const ready=validationRows.filter(r=>r.ready_to_submit&&["DRAFT","PERLU_REVISI"].includes(r.status));
  if(!ready.length){closeBulkSubmitModal();await loadData();return}
  const btn=$("bulkSubmitConfirm");
  btn.disabled=true;btn.textContent="Mengajukan...";
  $("bulkSubmitMessage").textContent="";
  try{
    const result=await api.db.rpc("submit_my_ready_admin_documents",{
      p_academic_year:activeAcademicYear,
      p_note:$("bulkSubmitNote").value.trim()||null
    });
    const data=Array.isArray(result)?result[0]:result;
    const count=Number(data?.submitted_count||0);
    closeBulkSubmitModal();
    await loadData();
    alert(count+" dokumen berhasil diajukan ke Kepala Madrasah untuk diverifikasi.");
  }catch(err){
    $("bulkSubmitMessage").textContent="Gagal mengajukan: "+(err.message||err);
  }finally{
    btn.disabled=false;btn.textContent="Ya, Ajukan Dokumen Siap";
  }
}
function runPicTaskAction(recordId){
  const task=validationRows.find(r=>r.record_id===recordId);
  const main=rows.find(r=>r.record_id===recordId);
  if(!task||!main)return;
  if(task.ready_to_submit){openSubmit(recordId);return}
  if(task.status==="MENUNGGU_VERIFIKASI"){focusAdminRecord(recordId);return}
  if(main.generated_draft_id){openGeneratedDraft(recordId);return}
  const route=main.integration_key?integrationRoute(main.integration_key):null;
  if(route){window.open(route,"_blank");return}
  focusAdminRecord(recordId);
}
function renderVerificationQueue(){
  const panel=$("verificationQueue");if(!panel)return;
  if(!headManager){panel.style.display="none";return}
  const pending=rows.filter(r=>r.status==="MENUNGGU_VERIFIKASI");
  $("verificationQueueCount").textContent=pending.length+" dokumen";
  panel.style.display=pending.length?"block":"none";
  if(!pending.length){$("verificationQueueList").innerHTML="";return}
  $("verificationQueueList").innerHTML=pending.map(r=>{
    const evidence=[r.file_name?("File: "+r.file_name):"",r.integration_key?(String(integrationSources.get(r.integration_key)||0)+" data SIMANIS"):""].filter(Boolean).join(" · ");
    return '<div class="attention-row"><div><h4>'+esc(r.document_code.replace("ADM-",""))+' · '+esc(r.title)+'</h4>'+
      '<p>'+esc(r.category_name)+' · PIC: <b>'+esc(r.responsible_name||"-")+'</b></p>'+
      '<p>'+esc(r.submitted_by_name||"-")+' mengajukan'+(r.submitted_at?' · '+esc(new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(r.submitted_at))):'')+
      (evidence?' · '+esc(evidence):'')+'</p></div>'+
      '<div><button class="primary-small" data-queue-verify="'+r.record_id+'">Verifikasi</button></div></div>';
  }).join("");
  document.querySelectorAll("[data-queue-verify]").forEach(b=>b.onclick=()=>openVerify(b.dataset.queueVerify));
}

async function loadAdminNotifications(){
  try{
    const results=await Promise.all([
      api.db.rpc("list_my_admin_notifications",{p_limit:30,p_unread_only:false}),
      api.db.rpc("get_my_admin_notification_count",{})
    ]);
    adminNotifications=results[0]||[];
    adminNotificationUnread=Number(results[1]||0);
  }catch(err){
    console.warn("Notifikasi administrasi:",err);
    adminNotifications=[];
    adminNotificationUnread=0;
  }
  renderAdminNotificationBadge();
}
function renderAdminNotificationBadge(){
  const badge=$("adminNotifBadge");
  if(!badge)return;
  badge.textContent=adminNotificationUnread>99?"99+":String(adminNotificationUnread);
  badge.style.display=adminNotificationUnread>0?"inline-flex":"none";
}
function notificationTypeLabel(t){
  return {SUBMITTED:"Pengajuan",REVISION:"Perlu Revisi",COMPLETED:"Lengkap",INFO:"Informasi"}[t]||t;
}
function renderAdminNotifications(){
  const holder=$("notificationList");
  if(!holder)return;
  if(!adminNotifications.length){holder.innerHTML='<div class="admin-empty">Belum ada notifikasi administrasi.</div>';return}
  holder.innerHTML=adminNotifications.map(n=>{
    const when=new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(n.created_at));
    return '<article class="notif-item '+(n.is_read?"":"unread")+'" data-notif-id="'+n.id+'" data-notif-record="'+n.record_id+'"><h4>'+esc(n.title)+'</h4><p><b>'+esc(notificationTypeLabel(n.notification_type))+'</b> · '+esc(n.document_code||"")+' · '+esc(n.document_title||"")+'</p>'+(n.message?'<p>'+esc(n.message)+'</p>':'')+'<div class="notif-time">'+esc(when)+' · '+esc(n.category_name||"")+'</div></article>';
  }).join('');
  holder.querySelectorAll("[data-notif-id]").forEach(el=>el.onclick=()=>openAdminNotification(Number(el.dataset.notifId),el.dataset.notifRecord));
}
async function openAdminNotification(id,recordId){
  try{await api.db.rpc("mark_admin_notification_read",{p_notification_id:id})}catch(err){console.warn(err)}
  const n=adminNotifications.find(x=>Number(x.id)===Number(id));
  if(n)n.is_read=true;
  adminNotificationUnread=adminNotifications.filter(x=>!x.is_read).length;
  renderAdminNotificationBadge();
  renderAdminNotifications();
  closeAdminNotifications();
  focusAdminRecord(recordId);
}
function openAdminNotifications(){renderAdminNotifications();$("notificationModal").classList.remove("hidden")}
function closeAdminNotifications(){$("notificationModal").classList.add("hidden")}
async function markAllAdminNotificationsRead(){
  try{await api.db.rpc("mark_all_admin_notifications_read",{});adminNotifications.forEach(n=>n.is_read=true);adminNotificationUnread=0;renderAdminNotificationBadge();renderAdminNotifications()}catch(err){alert("Gagal menandai notifikasi: "+err.message)}
}
function focusAdminRecord(recordId){
  const r=rows.find(x=>x.record_id===recordId);
  if(!r)return;
  selectedCategory=r.category_id;
  $("docSearch").value="";
  $("statusFilter").value="";
  renderCategories();
  renderDocs();
  setTimeout(()=>{
    const el=document.querySelector('[data-record="'+recordId+'"]');
    if(!el)return;
    el.classList.add("doc-highlight");
    el.scrollIntoView({behavior:"smooth",block:"center"});
    setTimeout(()=>el.classList.remove("doc-highlight"),2500);
  },80);
}
function dueText(r){
  if(!r.due_date)return "Belum ada target";
  const d=new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(r.due_date+"T00:00:00"));
  if(r.is_overdue)return '<span class="due-overdue">Terlambat · '+esc(d)+'</span>';
  if(r.days_to_due!==null&&Number(r.days_to_due)<=7)return '<span class="due-soon">'+Number(r.days_to_due)+' hari lagi · '+esc(d)+'</span>';
  return esc(d);
}
function renderAttention(){
  const overdue=attentionRows.filter(r=>r.is_overdue).length;
  const soon=attentionRows.filter(r=>!r.is_overdue&&r.days_to_due!==null&&Number(r.days_to_due)>=0&&Number(r.days_to_due)<=7).length;
  const unassigned=attentionRows.filter(r=>!r.responsible_name).length;
  $("attentionOverdue").textContent=overdue;
  $("attentionSoon").textContent=soon;
  $("attentionUnassigned").textContent=unassigned;
  const important=attentionRows.filter(r=>r.is_overdue||r.priority==="MENDESAK"||r.priority==="PENTING"||(r.days_to_due!==null&&Number(r.days_to_due)<=7));
  const data=attentionExpanded?attentionRows.slice(0,30):important.slice(0,6);
  $("attentionToggleBtn").textContent=attentionExpanded?"Ringkas":"Lihat Semua";
  if(!data.length){
    $("attentionList").innerHTML='<div class="admin-empty">Belum ada dokumen yang diberi target atau prioritas.</div>';
    return;
  }
  $("attentionList").innerHTML=data.map(r=>'<div class="attention-row"><div>'+
    '<h4>'+esc(r.document_code.replace("ADM-",""))+' · '+esc(r.title)+'</h4>'+
    '<p>'+esc(r.category_name)+' · '+esc(statusLabel(r.status))+' · <span class="priority '+esc(r.priority||"NORMAL")+'">'+esc(r.priority||"NORMAL")+'</span></p>'+
    '<p>PIC: <b>'+esc(r.responsible_name||"Belum ditentukan")+'</b> · Target: '+dueText(r)+'</p>'+
    '</div><div>'+(canVerify()?'<button class="mini-btn" data-attention-followup="'+r.record_id+'">Atur Tindak Lanjut</button>':'')+'</div></div>'
  ).join("");
  document.querySelectorAll("[data-attention-followup]").forEach(b=>b.onclick=()=>openFollowup(b.dataset.attentionFollowup));
}
function renderCategories(){
  $("categoryGrid").innerHTML=categories.map(c=>{
    const rr=rows.filter(r=>r.category_id===c.id);
    const done=rr.filter(r=>r.status==="LENGKAP").length;
    const draft=rr.filter(r=>r.status==="DRAFT").length;
    const pending=rr.filter(r=>r.status==="MENUNGGU_VERIFIKASI").length;
    const revision=rr.filter(r=>r.status==="PERLU_REVISI").length;
    const available=done+draft+pending+revision, pct=rr.length?Math.round(available/rr.length*100):0;
    return `<article class="admin-cat ${selectedCategory===c.id?"active":""}" data-cat="${c.id}">
      <div class="admin-cat-top"><h4>${String(c.order).padStart(2,"0")}. ${esc(c.name)}</h4><span class="count">${available}/${rr.length}</span></div>
      <small>${available} tersedia · ${done} lengkap · ${pending} menunggu · ${draft} draft</small><div class="cat-track"><div class="cat-fill" style="width:${pct}%"></div></div></article>`;
  }).join("");
  document.querySelectorAll("[data-cat]").forEach(el=>el.addEventListener("click",()=>{selectedCategory=el.dataset.cat;renderCategories();renderDocs();}));
}
function filteredRows(){
  const q=$("docSearch").value.trim().toLowerCase(), st=$("statusFilter").value;
  return rows.filter(r=>(!selectedCategory||r.category_id===selectedCategory)&&(!st||r.status===st)&&(!q||`${r.document_code} ${r.title}`.toLowerCase().includes(q)));
}
function renderDocs(){
  const list=filteredRows(), cat=categories.find(c=>c.id===selectedCategory);
  $("listTitle").textContent=cat?`${String(cat.order).padStart(2,"0")}. ${cat.name}`:"Daftar Dokumen"; $("listCount").textContent=`${list.length} dokumen`;
  if(!list.length){$("docList").innerHTML='<div class="admin-empty">Tidak ada dokumen yang cocok.</div>';return;}
  $("docList").innerHTML=list.map(r=>`<article class="doc-item" data-record="${r.record_id}">
    <div class="doc-code">${esc(r.document_code.replace("ADM-",""))}</div>
    <div><div class="doc-title">${esc(r.title)}</div><div class="doc-meta">
      <span class="status-badge status-${r.status}">${statusLabel(r.status)}</span>
      ${integrationBadge(r)}
      ${r.file_name?`<span class="doc-file">${esc(r.file_name)} · v${r.version_no||1}</span>`:""}
      ${r.generated_draft_id?`<span class="generated-badge">${esc(generatedDraftStateLabel(r.generated_draft_edit_state))} · ${esc(r.generated_draft_kind==="EVIDENCE"?"FORM BUKTI AKTUAL":r.generated_draft_kind||"TEMPLATE")} · v${r.generated_draft_version||1}</span>`:""}
      ${Number(r.attachment_count||0)>0?`<span class="attachment-badge">${Number(r.attachment_count)} lampiran</span>`:""}
      ${r.final_id?`<span class="final-badge">FINAL v${r.final_version||1}</span>`:""}
      ${r.manual_requirement_reason?`<span class="manual-badge" title="${esc(r.manual_requirement_reason)}">Butuh Bukti Aktual</span><span class="doc-file">${esc(r.manual_requirement_reason)}</span>`:""}
      ${verificationMeta(r)}
      ${submissionMeta(r)}
      ${r.responsible_name||r.due_date?`<span class="doc-file">PIC: ${esc(r.responsible_name||"-")} · Target: ${r.due_date?esc(new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(r.due_date+"T00:00:00"))):"-"} · ${esc(r.priority||"NORMAL")}</span>`:""}
    </div></div>
    <div class="doc-actions">
      ${canVerify()?`<button data-followup="${r.record_id}">Tindak Lanjut</button>`:""}
      ${!canVerify()&&["DRAFT","PERLU_REVISI"].includes(r.status)&&(r.file_name||(r.generated_draft_id&&r.generated_draft_edit_state==="READY")||(r.integration_key&&Number(integrationSources.get(r.integration_key)||0)>0))?`<button class="primary-small" data-submit="${r.record_id}">Ajukan Verifikasi</button>`:""}
      ${!canVerify()&&r.status==="MENUNGGU_VERIFIKASI"?`<button type="button" disabled>Menunggu Kepala</button>`:""}
      ${canVerify()&&r.status!=="BELUM_ADA"&&r.status!=="LENGKAP"?`<button class="primary-small" data-verify="${r.record_id}">Verifikasi</button>`:""}
      ${canVerify()&&r.status==="LENGKAP"?`<button class="secondary-btn" data-reopen="${r.record_id}">Buka Revisi</button>`:""}
      ${r.final_id?`<button class="primary-small" data-final="${r.record_id}">Lihat FINAL v${r.final_version||1}</button>`:""}
      <button data-attachments="${r.record_id}">Lampiran${Number(r.attachment_count||0)>0?" ("+Number(r.attachment_count)+")":""}</button>
      <button data-history="${r.record_id}">Riwayat</button>
      ${r.status!=="LENGKAP"?`<button data-note="${r.record_id}">Catatan</button>`:""}${r.generated_draft_id?`<button data-generated="${r.record_id}">Buka Draft Kerja</button>`:""}${integrationButton(r)}${r.storage_path?`<button data-view="${r.record_id}">Lihat File</button>`:""}${r.status!=="LENGKAP"?`<button class="primary-small" data-upload="${r.record_id}">Upload</button>`:""}
    </div></article>`).join("");
  document.querySelectorAll("[data-followup]").forEach(el=>el.addEventListener("click",()=>openFollowup(el.dataset.followup)));
  document.querySelectorAll("[data-submit]").forEach(el=>el.addEventListener("click",()=>openSubmit(el.dataset.submit)));
  document.querySelectorAll("[data-verify]").forEach(el=>el.addEventListener("click",()=>openVerify(el.dataset.verify)));
  document.querySelectorAll("[data-reopen]").forEach(el=>el.addEventListener("click",()=>reopenFinalDocument(el.dataset.reopen)));
  document.querySelectorAll("[data-final]").forEach(el=>el.addEventListener("click",()=>openFinalDocument(el.dataset.final)));
  document.querySelectorAll("[data-attachments]").forEach(el=>el.addEventListener("click",()=>openAttachmentModal(el.dataset.attachments)));
  document.querySelectorAll("[data-history]").forEach(el=>el.addEventListener("click",()=>openHistory(el.dataset.history)));
  document.querySelectorAll("[data-note]").forEach(el=>el.addEventListener("click",()=>editNote(el.dataset.note)));
  document.querySelectorAll("[data-generated]").forEach(el=>el.addEventListener("click",()=>openGeneratedDraft(el.dataset.generated)));
  document.querySelectorAll("[data-upload]").forEach(el=>el.addEventListener("click",()=>{uploadTarget=rows.find(r=>r.record_id===el.dataset.upload);$("filePicker").value="";$("filePicker").click();}));
  document.querySelectorAll("[data-view]").forEach(el=>el.addEventListener("click",()=>openFile(el.dataset.view)));
}



async function openStoragePath(path){
  if(!path)return;
  const session=await api.auth.getSession(),cfg=window.SIMANIS_CONFIG;
  try{
    const base=cfg.SUPABASE_URL.replace(/\/$/,"");
    const res=await fetch(base+"/storage/v1/object/sign/administrasi-kepala/"+encodePath(path),{
      method:"POST",
      headers:{apikey:cfg.SUPABASE_PUBLISHABLE_KEY,Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},
      body:JSON.stringify({expiresIn:3600})
    });
    const data=await res.json();
    if(!res.ok)throw new Error(data?.message||"Gagal membuat link file.");
    const signed=data.signedURL||data.signedUrl;
    if(!signed)throw new Error("Signed URL tidak diterima.");
    window.open(signed.startsWith("http")?signed:base+"/storage/v1"+signed,"_blank");
  }catch(err){alert("File gagal dibuka: "+(err.message||err))}
}
async function openAttachmentModal(recordId){
  const row=rows.find(r=>r.record_id===recordId);if(!row)return;
  attachmentTarget=row;
  $("attachmentTitle").textContent="Lampiran · "+row.document_code.replace("ADM-","")+" · "+row.title;
  $("attachmentDescription").value="";
  $("attachmentType").value="BUKTI";
  $("attachmentMessage").textContent="";
  const locked=row.status==="LENGKAP";
  $("attachmentForm").style.display=locked?"none":"grid";
  $("attachmentLockInfo").style.display=locked?"block":"none";
  $("attachmentModal").classList.remove("hidden");
  await loadAttachmentList();
}
function closeAttachmentModal(){
  $("attachmentModal").classList.add("hidden");
  attachmentTarget=null;
  $("attachmentMessage").textContent="";
}
async function loadAttachmentList(){
  if(!attachmentTarget)return;
  $("attachmentList").innerHTML='<div class="admin-empty">Memuat lampiran...</div>';
  try{
    const list=await api.db.rpc("list_admin_document_attachments",{p_record_id:attachmentTarget.record_id})||[];
    const locked=attachmentTarget.status==="LENGKAP";
    $("attachmentList").innerHTML=list.length?list.map(a=>{
      const when=new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(a.uploaded_at));
      return '<div class="attachment-row"><span class="attachment-badge">'+esc(String(a.attachment_type||"BUKTI").replaceAll("_"," "))+'</span><div><h4>'+esc(a.file_name)+'</h4><p>'+esc(a.description||"Tanpa keterangan")+' · '+esc(a.uploaded_by_name||"-")+' · '+esc(when)+'</p></div><div style="display:flex;gap:5px;flex-wrap:wrap"><button type="button" data-open-attachment="'+esc(a.storage_path)+'">Buka</button>'+(!locked?'<button type="button" data-remove-attachment="'+a.id+'">Hapus</button>':'')+'</div></div>';
    }).join(""):'<div class="admin-empty">Belum ada lampiran bukti.</div>';
    $("attachmentList").querySelectorAll("[data-open-attachment]").forEach(b=>b.onclick=()=>openStoragePath(b.dataset.openAttachment));
    $("attachmentList").querySelectorAll("[data-remove-attachment]").forEach(b=>b.onclick=()=>removeAttachment(b.dataset.removeAttachment));
  }catch(err){
    $("attachmentList").innerHTML='<div class="admin-empty">Lampiran gagal dimuat: '+esc(err.message||err)+'</div>';
  }
}
async function uploadAttachment(file){
  if(!attachmentTarget||!file)return;
  if(attachmentTarget.status==="LENGKAP"){alert("Dokumen FINAL terkunci.");return}
  if(file.size>20*1024*1024){alert("Ukuran file maksimal 20 MB.");return}
  const recordId=attachmentTarget.record_id;
  const code=attachmentTarget.document_code;
  const session=await api.auth.getSession(),cfg=window.SIMANIS_CONFIG;
  const base=cfg.SUPABASE_URL.replace(/\/$/,"");
  const safe=file.name.replace(/[^a-zA-Z0-9._-]+/g,"_");
  const path=activeAcademicYearFolder()+"/"+code+"/attachments/"+Date.now()+"_"+safe;
  let uploaded=false;
  try{
    $("attachmentMessage").style.color="#66766e";
    $("attachmentMessage").textContent="Mengupload lampiran...";
    const resp=await fetch(base+"/storage/v1/object/administrasi-kepala/"+encodePath(path),{
      method:"POST",
      headers:{apikey:cfg.SUPABASE_PUBLISHABLE_KEY,Authorization:"Bearer "+session.access_token,"Content-Type":file.type||"application/octet-stream","x-upsert":"false"},
      body:file
    });
    const txt=await resp.text();if(!resp.ok)throw new Error(txt||("HTTP "+resp.status));
    uploaded=true;
    await api.db.rpc("register_admin_document_attachment",{
      p_record_id:recordId,p_storage_path:path,p_file_name:file.name,p_mime_type:file.type||null,p_file_size:file.size,
      p_attachment_type:$("attachmentType").value,p_description:$("attachmentDescription").value.trim()||null
    });
    $("attachmentDescription").value="";
    $("attachmentMessage").style.color="#08733f";
    $("attachmentMessage").textContent="Lampiran berhasil ditambahkan.";
    await loadData();
    attachmentTarget=rows.find(r=>r.record_id===recordId)||attachmentTarget;
    await loadAttachmentList();
  }catch(err){
    if(uploaded){
      try{
        await fetch(base+"/storage/v1/object/administrasi-kepala/"+encodePath(path),{
          method:"DELETE",
          headers:{apikey:cfg.SUPABASE_PUBLISHABLE_KEY,Authorization:"Bearer "+session.access_token}
        });
      }catch(_){}
    }
    $("attachmentMessage").style.color="#a13b33";
    $("attachmentMessage").textContent="Upload gagal: "+(err.message||err);
  }
}
async function removeAttachment(id){
  if(!attachmentTarget||!confirm("Hapus lampiran ini dari dokumen kerja?"))return;
  const recordId=attachmentTarget.record_id;
  try{
    await api.db.rpc("remove_admin_document_attachment",{p_attachment_id:id});
    await loadData();
    attachmentTarget=rows.find(r=>r.record_id===recordId)||attachmentTarget;
    await loadAttachmentList();
  }catch(err){alert("Lampiran gagal dihapus: "+(err.message||err))}
}
function finalArtifactList(data){
  const files=Array.isArray(data.file_snapshot)?data.file_snapshot:[];
  const atts=Array.isArray(data.attachments_snapshot)?data.attachments_snapshot:[];
  const all=[
    ...files.map(x=>Object.assign({},x,{label:"File Utama"})),
    ...atts.map(x=>Object.assign({},x,{label:String(x.attachment_type||"Lampiran").replaceAll("_"," ")}))
  ];
  if(!all.length)return '<div class="admin-empty">Versi final ini tidak memiliki file tambahan; isi utama tersimpan sebagai snapshot dokumen/data.</div>';
  return all.map((a,i)=>'<div class="attachment-row"><span class="attachment-badge">'+esc(a.label)+'</span><div><h4>'+esc(a.file_name||("Artefak "+(i+1)))+'</h4><p>'+esc(a.description||a.mime_type||"Arsip FINAL")+'</p></div><div><button type="button" data-final-artifact="'+esc(a.storage_path||"")+'">Buka</button></div></div>').join("");
}
async function openFinalDocument(recordId,version=null){
  const row=rows.find(r=>r.record_id===recordId);if(!row)return;
  $("finalDocumentTitle").textContent="FINAL · "+row.document_code.replace("ADM-","")+" · "+row.title;
  $("finalDocumentMeta").innerHTML="Memuat versi final...";
  $("finalDocumentArtifacts").innerHTML="";
  $("finalDocumentBody").innerHTML="";
  $("finalDocumentModal").classList.remove("hidden");
  try{
    const result=await api.db.rpc("get_admin_document_final_version",{p_record_id:recordId,p_final_version:version});
    const data=Array.isArray(result)?result[0]:result;
    if(!data)throw new Error("Versi FINAL tidak ditemukan.");
    currentFinalDocument=Object.assign({},data,{record_id:recordId,row});
    const when=new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",day:"2-digit",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(data.finalized_at));
    $("finalDocumentMeta").innerHTML='<b>FINAL v'+Number(data.final_version)+'</b> · '+esc(data.source_kind)+' · '+esc(when)+'<br>Disahkan oleh <b>'+esc(data.verified_by_name||"-")+'</b>'+(data.verification_note?'<br>Catatan: '+esc(data.verification_note):'')+'<div class="checksum"><b>SHA-256:</b> '+esc(data.checksum_sha256)+'</div>';
    $("finalDocumentArtifacts").innerHTML=finalArtifactList(data);
    $("finalDocumentBody").innerHTML=data.content_html_snapshot?cleanGeneratedDraftHtml(data.content_html_snapshot):'<div class="admin-empty">Tidak ada snapshot HTML. Dokumen FINAL berbasis file atau sumber data SIMANIS.</div>';
    $("finalDocumentArtifacts").querySelectorAll("[data-final-artifact]").forEach(b=>b.onclick=()=>openStoragePath(b.dataset.finalArtifact));
  }catch(err){
    $("finalDocumentMeta").textContent="FINAL gagal dimuat: "+(err.message||err);
  }
}
function closeFinalDocument(){
  $("finalDocumentModal").classList.add("hidden");
  currentFinalDocument=null;
}
async function openFinalHistory(){
  if(!currentFinalDocument)return;
  $("finalHistoryList").innerHTML='<div class="admin-empty">Memuat riwayat FINAL...</div>';
  $("finalHistoryModal").classList.remove("hidden");
  try{
    const list=await api.db.rpc("list_admin_document_final_versions",{p_record_id:currentFinalDocument.record_id})||[];
    $("finalHistoryList").innerHTML=list.length?list.map(v=>{
      const when=new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(v.finalized_at));
      return '<div class="draft-version-row"><b>FINAL v'+v.final_version+'</b><div><div style="font-size:9px;font-weight:800">'+esc(v.source_kind)+'</div><div style="font-size:8px;color:#718078">'+esc(when)+' · '+esc(v.verified_by_name||"-")+'</div></div><button type="button" data-open-final-version="'+v.final_version+'">Buka</button></div>';
    }).join(""):'<div class="admin-empty">Belum ada riwayat FINAL.</div>';
    $("finalHistoryList").querySelectorAll("[data-open-final-version]").forEach(b=>b.onclick=async()=>{
      const recordId=currentFinalDocument.record_id;
      $("finalHistoryModal").classList.add("hidden");
      await openFinalDocument(recordId,Number(b.dataset.openFinalVersion));
    });
  }catch(err){
    $("finalHistoryList").innerHTML='<div class="admin-empty">Riwayat FINAL gagal dimuat: '+esc(err.message||err)+'</div>';
  }
}
function closeFinalHistory(){$("finalHistoryModal").classList.add("hidden")}
function printFinalDocument(){
  if(!currentFinalDocument)return;
  const w=window.open("","_blank");if(!w){alert("Popup diblokir browser.");return}
  const d=currentFinalDocument;
  const body=d.content_html_snapshot?cleanGeneratedDraftHtml(d.content_html_snapshot):'<h2>Dokumen FINAL berbasis file/data SIMANIS</h2><p>Gunakan artefak final yang tercatat pada SIMANIS.</p>';
  const html='<!doctype html><html><head><meta charset="utf-8"><title>FINAL v'+d.final_version+'</title><style>@page{size:A4;margin:15mm}body{font-family:Arial,sans-serif;color:#1d2a24;line-height:1.5}table{width:100%;border-collapse:collapse;margin:12px 0}th,td{border:1px solid #bfcac4;padding:6px;font-size:10px}.finalmark{border-bottom:2px solid #173f30;padding-bottom:8px;margin-bottom:15px;font-size:10px}.checksum{font-family:monospace;font-size:7px;word-break:break-all}</style></head><body><div class="finalmark"><b>FINAL v'+d.final_version+'</b> · Disahkan '+esc(d.verified_by_name||"-")+'<br><span class="checksum">SHA-256: '+esc(d.checksum_sha256)+'</span></div>'+body+'</body></html>';
  w.document.write(html);w.document.close();setTimeout(()=>w.print(),250);
}
async function reopenFinalDocument(recordId){
  const row=rows.find(r=>r.record_id===recordId);if(!row||row.status!=="LENGKAP")return;
  const reason=prompt("Alasan membuka revisi untuk "+row.document_code.replace("ADM-","")+" · "+row.title+":","");
  if(reason===null)return;
  if(!reason.trim()){alert("Alasan revisi wajib diisi.");return}
  if(!confirm("Buka dokumen FINAL untuk revisi? FINAL v"+(row.final_version||1)+" tetap disimpan sebagai arsip dan tidak akan ditimpa."))return;
  try{
    await api.db.rpc("reopen_admin_document_for_revision",{p_record_id:recordId,p_reason:reason.trim()});
    await loadData();
    alert("Dokumen dibuka untuk revisi. FINAL v"+(row.final_version||1)+" tetap tersimpan.");
  }catch(err){alert("Gagal membuka revisi: "+(err.message||err))}
}

function closeSubmit(){
  $("submitModal").classList.add("hidden");
  submitTarget=null;
  $("submitMessage").textContent="";
}
function openSubmit(recordId){
  const r=rows.find(x=>x.record_id===recordId);if(!r)return;
  submitTarget=r;
  const sourceCount=r.integration_key?(integrationSources.get(r.integration_key)||0):0;
  $("submitTitle").textContent="Ajukan Verifikasi · "+r.document_code.replace("ADM-","");
  $("submitEvidence").innerHTML="<b>"+esc(r.title)+"</b><br>"+
    (r.file_name?"File: "+esc(r.file_name)+" (v"+(r.version_no||1)+")<br>":"")+
    (r.generated_draft_id?"Draft kerja: "+esc(generatedDraftStateLabel(r.generated_draft_edit_state))+" · v"+(r.generated_draft_version||1)+"<br>":"")+
    (r.integration_key?"Sumber SIMANIS: "+sourceCount+" data<br>":"")+
    "Setelah diajukan, dokumen akan masuk antrean Kepala Madrasah.";
  $("submitNote").value=r.submission_note||"";
  $("submitMessage").textContent="";
  $("submitModal").classList.remove("hidden");
}
async function saveSubmission(){
  if(!submitTarget)return;
  const btn=$("submitSave");btn.disabled=true;btn.textContent="Mengajukan...";
  try{
    await api.db.rpc("submit_admin_document_for_verification",{p_record_id:submitTarget.record_id,p_note:$("submitNote").value.trim()||null});
    closeSubmit();await loadData();
  }catch(err){
    $("submitMessage").textContent="Gagal: "+(err.message||err);
  }finally{
    btn.disabled=false;btn.textContent="Ajukan Verifikasi";
  }
}

function renderPicSummary(){
  const holder=$("picSummaryBody");if(!holder)return;
  if(!picRecommendations.length){holder.innerHTML='<div class="admin-empty">Belum ada mapping PIC kategori.</div>';return}
  holder.innerHTML='<div class="table-wrap"><table class="data-table" style="width:100%;border-collapse:collapse"><thead><tr><th>Kategori</th><th>Jabatan PIC</th><th>Nama PIC</th><th>Dokumen</th><th>Terisi</th></tr></thead><tbody>'+picRecommendations.map(x=>'<tr><td><b>'+esc(x.category_name)+'</b></td><td>'+esc(x.position_name)+'</td><td>'+esc(x.responsible_name||"Belum ada pemegang jabatan")+'</td><td>'+Number(x.document_count||0)+'</td><td>'+Number(x.assigned_count||0)+'</td></tr>').join("")+'</tbody></table></div>';
}
function openPicSummary(){
  if(!headManager)return;
  $("picMessage").textContent="";
  renderPicSummary();
  $("picModal").classList.remove("hidden");
}
function closePicSummary(){$("picModal").classList.add("hidden")}
async function applyPicEmpty(){
  if(!headManager)return;
  const btn=$("picApplyEmptyBtn");btn.disabled=true;btn.textContent="Menerapkan...";
  try{
    const result=await api.db.rpc("apply_admin_pic_recommendations",{p_only_empty:true})||[];
    const total=result.reduce((n,x)=>n+Number(x.updated_documents||0),0);
    $("picMessage").style.color="#08733f";$("picMessage").textContent=total?total+" dokumen berhasil diberi PIC.":"Semua dokumen yang tersedia sudah memiliki PIC.";
    await loadData();renderPicSummary();
  }catch(err){
    $("picMessage").style.color="#a13b33";$("picMessage").textContent="Gagal: "+(err.message||err);
  }finally{
    btn.disabled=false;btn.textContent="Terapkan ke PIC Kosong";
  }
}
function closeFollowup(){
  $("followupModal").classList.add("hidden");
  followupTarget=null;
  $("followupMessage").textContent="";
}
function openFollowup(recordId){
  const r=rows.find(x=>x.record_id===recordId);if(!r)return;
  followupTarget=r;
  $("followupTitle").textContent="Tindak Lanjut · "+r.document_code.replace("ADM-","");
  $("followupInfo").innerHTML="<b>"+esc(r.title)+"</b><br>"+esc(r.category_name)+" · Status "+esc(statusLabel(r.status));
  $("followupPIC").value=r.responsible_name||"";
  $("followupDueDate").value=r.due_date||"";
  $("followupPriority").value=r.priority||"NORMAL";
  $("followupNote").value=r.note||"";
  $("followupMessage").textContent="";
  $("followupModal").classList.remove("hidden");
}
async function saveFollowup(){
  if(!followupTarget)return;
  const btn=$("followupSave");btn.disabled=true;btn.textContent="Menyimpan...";
  try{
    await api.db.rpc("update_admin_document_followup",{
      p_record_id:followupTarget.record_id,
      p_responsible_name:$("followupPIC").value.trim()||null,
      p_due_date:$("followupDueDate").value||null,
      p_priority:$("followupPriority").value,
      p_note:$("followupNote").value.trim()||null
    });
    closeFollowup();await loadData();
  }catch(err){
    $("followupMessage").textContent="Gagal: "+(err.message||err);
  }finally{
    btn.disabled=false;btn.textContent="Simpan Tindak Lanjut";
  }
}
function closeVerify(){
  $("verifyModal").classList.add("hidden");
  verifyTarget=null;
  $("verifyMessage").textContent="";
}
function openVerify(recordId){
  const r=rows.find(x=>x.record_id===recordId);if(!r)return;
  verifyTarget=r;
  $("verifyTitle").textContent="Verifikasi · "+r.document_code.replace("ADM-","")+" · "+r.title;
  const sourceCount=r.integration_key?(integrationSources.get(r.integration_key)||0):0;
  $("verifyEvidence").innerHTML=
    "<b>Bukti tersedia</b><br>"+
    (r.file_name?"File: "+esc(r.file_name)+" (v"+(r.version_no||1)+")<br>":"")+
    (r.generated_draft_id?"Draft kerja: "+esc(generatedDraftStateLabel(r.generated_draft_edit_state))+" · v"+(r.generated_draft_version||1)+"<br>":"")+
    (r.integration_key?"Sumber SIMANIS: "+sourceCount+" data<br>":"")+
    (Number(r.attachment_count||0)>0?"Lampiran bukti: "+Number(r.attachment_count)+" file<br>":"")+
    (!r.file_name&&!r.generated_draft_id&&!r.integration_key&&!Number(r.attachment_count||0)?"Belum ada bukti yang dapat diverifikasi.":"");
  $("verifyStatus").value=r.status==="PERLU_REVISI"?"PERLU_REVISI":"LENGKAP";
  $("verifyNote").value=r.verification_note||"";
  $("verifyMessage").textContent="";
  $("verifyModal").classList.remove("hidden");
}
async function saveVerification(){
  if(!verifyTarget)return;
  const status=$("verifyStatus").value,note=$("verifyNote").value.trim();
  if(status==="PERLU_REVISI"&&!note){$("verifyMessage").textContent="Catatan revisi wajib diisi.";return}
  const btn=$("verifySave");btn.disabled=true;btn.textContent="Menyimpan...";
  try{
    await api.db.rpc("verify_admin_document",{p_record_id:verifyTarget.record_id,p_status:status,p_note:note||null});
    closeVerify();
    await loadData();
    if(validationReturnAfterVerify){
      validationReturnAfterVerify=false;
      const next=validationRows.find(r=>r.status==="MENUNGGU_VERIFIKASI");
      if(next)openValidationReview(next.record_id);
      else alert("Antrean verifikasi yang diajukan saat ini sudah selesai.");
    }
  }catch(err){
    $("verifyMessage").textContent="Gagal: "+(err.message||err);
  }finally{
    btn.disabled=false;btn.textContent="Simpan Verifikasi";
  }
}
async function openHistory(recordId){
  const r=rows.find(x=>x.record_id===recordId);if(!r)return;
  $("historyTitle").textContent="Riwayat · "+r.document_code.replace("ADM-","")+" · "+r.title;
  $("historyBody").innerHTML='<div class="admin-empty">Memuat riwayat...</div>';
  $("historyModal").classList.remove("hidden");
  try{
    const logs=await api.db.rpc("list_admin_document_verification_logs",{p_record_id:recordId})||[];
    $("historyBody").innerHTML=logs.length?logs.map(l=>{
      const dt=new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(l.created_at));
      return '<div style="border:1px solid #e1e9e5;border-radius:11px;padding:10px;margin-bottom:8px">'+
        '<b style="font-size:10px">'+esc(statusLabel(l.old_status||"-"))+' → '+esc(statusLabel(l.new_status))+'</b>'+
        '<div style="font-size:8px;color:#718078;margin-top:3px">'+esc(l.changed_by_name||"-")+' · '+esc(dt)+'</div>'+
        (l.verification_note?'<div style="font-size:9px;margin-top:6px">'+esc(l.verification_note)+'</div>':'')+
      '</div>';
    }).join(""):'<div class="admin-empty">Belum ada riwayat verifikasi.</div>';
  }catch(err){
    $("historyBody").innerHTML='<div class="admin-empty">Riwayat gagal dimuat: '+esc(err.message||err)+'</div>';
  }
}
function closeHistory(){$("historyModal").classList.add("hidden")}
function exportAdminCsv(){
  const header=["Kode","Kategori","Dokumen","Status","Prioritas","Penanggung Jawab","Target Selesai","Pengaju","Waktu Pengajuan","Catatan Pengajuan","Sumber SIMANIS","File","Versi","Verifier","Waktu Verifikasi","Catatan Verifikasi","Catatan Dokumen"];
  const body=rows.map(r=>[
    r.document_code,r.category_name,r.title,statusLabel(r.status),
    r.priority||"NORMAL",r.responsible_name||"",r.due_date||"",
    r.submitted_by_name||"",r.submitted_at||"",r.submission_note||"",
    r.integration_key?(integrationSources.get(r.integration_key)||0):"",
    r.file_name||"",r.version_no||"",
    r.verified_by_name||"",r.verified_at||"",r.verification_note||"",r.note||""
  ]);
  const csv=[header,...body].map(row=>row.map(v=>'"'+String(v??"").replaceAll('"','""')+'"').join(",")).join("\n");
  const url=URL.createObjectURL(new Blob(["\uFEFF",csv],{type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a");a.href=url;a.download="Administrasi_Kepala_Madrasah_"+activeAcademicYearFolder()+".csv";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
}
function printAdminReport(){
  const total=rows.length,complete=rows.filter(r=>r.status==="LENGKAP").length,draft=rows.filter(r=>r.status==="DRAFT").length,pending=rows.filter(r=>r.status==="MENUNGGU_VERIFIKASI").length,revision=rows.filter(r=>r.status==="PERLU_REVISI").length,missing=rows.filter(r=>r.status==="BELUM_ADA").length;
  const w=window.open("","_blank");if(!w){alert("Popup diblokir browser.");return}
  const school=(systemSettings?.school_name||"MA Nurul Islam").toUpperCase();
  const addr=[systemSettings?.address,systemSettings?.village,systemSettings?.district,systemSettings?.regency,systemSettings?.province].filter(Boolean).join(", ");
  const logo=new URL("logo.png",location.href).href;
  const catRows=categories.map(c=>{
    const rr=rows.filter(r=>r.category_id===c.id);
    const c1=rr.filter(r=>r.status==="LENGKAP").length,c2=rr.filter(r=>r.status==="DRAFT").length,c3=rr.filter(r=>r.status==="MENUNGGU_VERIFIKASI").length,c4=rr.filter(r=>r.status==="PERLU_REVISI").length,c5=rr.filter(r=>r.status==="BELUM_ADA").length;
    return '<tr><td>'+String(c.order).padStart(2,"0")+'. '+esc(c.name)+'</td><td>'+rr.length+'</td><td>'+c1+'</td><td>'+c2+'</td><td>'+c3+'</td><td>'+c4+'</td><td>'+c5+'</td></tr>';
  }).join("");
  const docRows=rows.map(r=>'<tr><td>'+esc(r.document_code.replace("ADM-",""))+'</td><td>'+esc(r.category_name)+'</td><td class="left">'+esc(r.title)+'</td><td>'+esc(statusLabel(r.status))+'</td><td>'+esc(r.priority||"NORMAL")+'</td><td>'+esc(r.responsible_name||"-")+'</td><td>'+esc(r.due_date||"-")+'</td><td>'+esc(r.verified_by_name||"-")+'</td></tr>').join("");
  w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Rekap Administrasi Kepala Madrasah</title><style>@page{size:A4 landscape;margin:9mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#17251e;margin:0}.head{display:grid;grid-template-columns:16mm 1fr 16mm;align-items:center;border-bottom:3px double #173f30;padding-bottom:3mm;margin-bottom:4mm}.head img{width:14mm}.school{text-align:center}.school h2{font-size:14pt;margin:0}.school p{font-size:7pt;margin:1mm 0 0;color:#566}h3{text-align:center;font-size:11pt;margin:0 0 4mm}.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:2mm;margin-bottom:4mm}.box{border:1px solid #ccd8d1;padding:2.5mm;text-align:center}.box b{display:block;font-size:13pt;color:#075b3a}.box span{font-size:7pt}table{width:100%;border-collapse:collapse;font-size:7pt;margin-bottom:5mm}th,td{border:1px solid #cdd8d2;padding:1.6mm;text-align:center}th{background:#f2f7f4}.left{text-align:left}.pagebreak{page-break-before:always}.sign{display:grid;grid-template-columns:1fr 1fr;gap:30mm;margin-top:8mm;text-align:center;font-size:8pt}.space{height:16mm}</style></head><body>'+
    '<div class="head"><img src="'+logo+'"><div class="school"><h2>'+esc(school)+'</h2><p>'+esc(addr||"Karangcempaka, Bluto, Sumenep")+'</p></div><div></div></div>'+
    '<h3>REKAP ADMINISTRASI KEPALA MADRASAH · TA '+esc(activeAcademicYear)+'</h3>'+
    '<div class="stats"><div class="box"><b>'+total+'</b><span>Total</span></div><div class="box"><b>'+complete+'</b><span>Lengkap</span></div><div class="box"><b>'+draft+'</b><span>Draft</span></div><div class="box"><b>'+pending+'</b><span>Menunggu</span></div><div class="box"><b>'+revision+'</b><span>Perlu Revisi</span></div><div class="box"><b>'+missing+'</b><span>Belum Ada</span></div></div>'+
    '<table><thead><tr><th>Kategori</th><th>Total</th><th>Lengkap</th><th>Draft</th><th>Menunggu</th><th>Revisi</th><th>Belum Ada</th></tr></thead><tbody>'+catRows+'</tbody></table>'+
    '<div class="pagebreak"></div><h3>DAFTAR STATUS 141 DOKUMEN</h3><table><thead><tr><th>Kode</th><th>Kategori</th><th>Dokumen</th><th>Status</th><th>Prioritas</th><th>PIC</th><th>Target</th><th>Verifier</th></tr></thead><tbody>'+docRows+'</tbody></table>'+
    '<div class="sign"><div>Mengetahui,<br>Kepala Madrasah<div class="space"></div><b>'+esc(systemSettings?.headmaster_name||"Kepala Madrasah")+'</b></div><div>Dicetak oleh<div class="space"></div><b>'+esc(profile?.full_name||"-")+'</b></div></div>'+
    '<script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>');
  w.document.close();
}

function cleanGeneratedDraftHtml(html){
  const tpl=document.createElement("template");
  tpl.innerHTML=String(html||'');
  tpl.content.querySelectorAll("script,iframe,object,embed,form,meta,base").forEach(el=>el.remove());
  tpl.content.querySelectorAll("*").forEach(el=>{
    [...el.attributes].forEach(a=>{
      const n=a.name.toLowerCase(),v=String(a.value||"").trim().toLowerCase();
      if(n.startsWith("on")||v.startsWith("javascript:")||v.startsWith("data:text/html"))el.removeAttribute(a.name);
    });
  });
  return tpl.innerHTML;
}
function setGeneratedDraftSaveState(text,state){
  const el=$("generatedDraftSaveState");if(!el)return;
  el.textContent=text;
  el.className="draft-save-state"+(state?" "+state:"");
}
function generatedDraftCanEdit(){
  return !!generatedDraftCurrent?.can_edit && ["DRAFT","PERLU_REVISI"].includes(generatedDraftCurrent?.row?.status);
}
function updateGeneratedDraftControls(){
  if(!generatedDraftCurrent)return;
  const d=generatedDraftCurrent,row=d.row,canEdit=generatedDraftCanEdit();
  const kind=d.generator_kind==="DATA"?"Berbasis data SIMANIS":d.generator_kind==="EVIDENCE"?"Form Bukti Aktual":"Template terstruktur";
  const made=new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(d.generated_at));
  const edited=d.edited_at?new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(d.edited_at)):null;
  $("generatedDraftInfo").textContent=kind+" · versi "+d.version_no+" · dibuat "+made+(edited?" · terakhir diedit "+edited+(d.edited_by_name?" oleh "+d.edited_by_name:""):"");
  $("generatedDraftEdit").style.display=canEdit?"inline-flex":"none";
  $("generatedDraftRegenerate").style.display=canEdit?"inline-flex":"none";
  $("generatedDraftSaveVersion").style.display=generatedDraftEditing&&canEdit?"inline-flex":"none";
  $("generatedDraftReady").style.display=generatedDraftEditing&&canEdit?"inline-flex":"none";
  $("generatedDraftSubmit").style.display=!canVerify()&&d.edit_state==="READY"&&["DRAFT","PERLU_REVISI"].includes(row.status)?"inline-flex":"none";
  $("generatedDraftEdit").textContent=generatedDraftEditing?"Selesai Edit":"Edit Draft";
  if(generatedDraftSaving)setGeneratedDraftSaveState('Menyimpan...','saving');
  else if(d.edit_state==='READY')setGeneratedDraftSaveState('Siap Diverifikasi','saved');
  else if(d.edit_state==='EDITING')setGeneratedDraftSaveState('Sedang Diedit','saved');
  else setGeneratedDraftSaveState('Draft Otomatis','');
}
function setGeneratedDraftEditing(enabled){
  if(!generatedDraftCurrent)return;
  if(enabled&&!generatedDraftCanEdit())return;
  generatedDraftEditing=!!enabled;
  const body=$("generatedDraftBody");
  body.setAttribute("contenteditable",generatedDraftEditing?"true":"false");
  body.classList.toggle("editing",generatedDraftEditing);
  $("generatedDraftToolbar").classList.toggle("active",generatedDraftEditing);
  if(generatedDraftEditing){body.focus();}
  updateGeneratedDraftControls();
}
async function closeGeneratedDraft(){
  if(generatedDraftEditing){
    const ok=await flushGeneratedDraftAutosave();
    if(!ok)return;
  }
  clearTimeout(generatedDraftAutosaveTimer);
  generatedDraftAutosaveTimer=null;
  generatedDraftEditing=false;
  $("generatedDraftModal").classList.add("hidden");
  generatedDraftCurrent=null;
  await loadData();
}
async function openGeneratedDraft(recordId){
  const row=rows.find(x=>x.record_id===recordId);if(!row)return;
  $("generatedDraftTitle").textContent="Draft Kerja · "+row.document_code.replace("ADM-","")+" · "+row.title;
  $("generatedDraftInfo").textContent="Memuat draft...";
  $("generatedDraftBody").innerHTML="";
  generatedDraftEditing=false;
  $("generatedDraftToolbar").classList.remove("active");
  $("generatedDraftBody").classList.remove("editing");
  $("generatedDraftBody").setAttribute("contenteditable","false");
  $("generatedDraftModal").classList.remove("hidden");
  try{
    const results=await Promise.all([
      api.db.rpc("get_admin_document_generated_draft",{p_record_id:recordId}),
      api.db.rpc("has_admin_category_permission",{p_category_id:row.category_id,p_action:"update"}).catch(()=>false)
    ]);
    const data=results[0]||[],canEdit=!!results[1];
    const d=Array.isArray(data)?data[0]:data;
    if(!d)throw new Error("Draft otomatis tidak ditemukan.");
    generatedDraftCurrent={...d,row,can_edit:canEdit};
    $("generatedDraftBody").innerHTML=d.content_html;
    updateGeneratedDraftControls();
  }catch(err){
    $("generatedDraftInfo").textContent="Gagal memuat draft: "+(err.message||err);
    setGeneratedDraftSaveState("Gagal memuat","error");
  }
}
function scheduleGeneratedDraftAutosave(){
  if(!generatedDraftEditing||!generatedDraftCurrent)return;
  clearTimeout(generatedDraftAutosaveTimer);
  setGeneratedDraftSaveState('Perubahan belum disimpan','saving');
  generatedDraftAutosaveTimer=setTimeout(()=>saveGeneratedDraft(false,null),1200);
}
async function saveGeneratedDraft(createVersion=false,note=null){
  if(!generatedDraftCurrent||!generatedDraftCanEdit())return false;
  if(generatedDraftSaving)return false;
  clearTimeout(generatedDraftAutosaveTimer);generatedDraftAutosaveTimer=null;
  generatedDraftSaving=true;setGeneratedDraftSaveState('Menyimpan...','saving');
  try{
    const html=cleanGeneratedDraftHtml($("generatedDraftBody").innerHTML);
    $("generatedDraftBody").innerHTML=html;
    const result=await api.db.rpc("save_admin_document_generated_draft",{p_record_id:generatedDraftCurrent.row.record_id,p_content_html:html,p_create_version:!!createVersion,p_save_note:note||null});
    generatedDraftCurrent.content_html=html;
    generatedDraftCurrent.edit_state='EDITING';
    generatedDraftCurrent.edited_at=new Date().toISOString();
    generatedDraftCurrent.edited_by_name=profile?.full_name||null;
    if(result?.version_no){generatedDraftCurrent.version_no=Number(result.version_no);generatedDraftCurrent.row.generated_draft_version=Number(result.version_no);}
    generatedDraftCurrent.row.generated_draft_edit_state='EDITING';
    setGeneratedDraftSaveState(createVersion?'Versi baru tersimpan':'Tersimpan otomatis','saved');
    return true;
  }catch(err){
    setGeneratedDraftSaveState("Gagal menyimpan","error");
    alert("Draft gagal disimpan: "+(err.message||err));
    return false;
  }finally{
    generatedDraftSaving=false;updateGeneratedDraftControls();
  }
}
async function flushGeneratedDraftAutosave(){
  if(!generatedDraftEditing||!generatedDraftCurrent)return true;
  if(generatedDraftAutosaveTimer){clearTimeout(generatedDraftAutosaveTimer);generatedDraftAutosaveTimer=null;return await saveGeneratedDraft(false,null);}
  return true;
}
async function saveGeneratedDraftVersion(){
  const note=prompt('Catatan versi (opsional):','');if(note===null)return;
  await saveGeneratedDraft(true,note.trim()||null);
}
async function markGeneratedDraftReady(){
  if(!generatedDraftCurrent)return;
  const ok=await flushGeneratedDraftAutosave();if(!ok)return;
  try{
    await api.db.rpc("mark_admin_generated_draft_ready",{p_record_id:generatedDraftCurrent.row.record_id});
    generatedDraftCurrent.edit_state='READY';
    generatedDraftCurrent.row.generated_draft_edit_state='READY';
    generatedDraftEditing=false;
    $("generatedDraftBody").setAttribute("contenteditable","false");
    $("generatedDraftBody").classList.remove("editing");
    $("generatedDraftToolbar").classList.remove("active");
    updateGeneratedDraftControls();
  }catch(err){alert('Gagal menandai draft siap: '+(err.message||err));}
}
async function openDraftVersionHistory(){
  if(!generatedDraftCurrent)return;
  $("draftVersionList").innerHTML='<div class="admin-empty">Memuat riwayat versi...</div>';
  $("draftVersionModal").classList.remove("hidden");
  try{
    const versions=await api.db.rpc("list_admin_document_generated_draft_versions",{p_record_id:generatedDraftCurrent.row.record_id})||[];
    const canRestore=generatedDraftCanEdit();
    $("draftVersionList").innerHTML=versions.length?versions.map(v=>{
      const when=new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(v.edited_at||v.generated_at));
      return '<div class="draft-version-row '+(v.is_current?"current":"")+'"><b>v'+v.version_no+(v.is_current?" · Aktif":"")+'</b><div><div style="font-size:9px;font-weight:800">'+esc(generatedDraftStateLabel(v.edit_state))+'</div><div style="font-size:8px;color:#718078">'+esc(when)+(v.edited_by_name?" · "+esc(v.edited_by_name):v.generated_by_name?" · "+esc(v.generated_by_name):"")+(v.save_note?" · "+esc(v.save_note):"")+'</div></div>'+(!v.is_current&&canRestore?'<button class="secondary-btn" type="button" data-restore-version="'+v.version_no+'">Pulihkan</button>':'')+'</div>';
    }).join(''):'<div class="admin-empty">Belum ada riwayat versi.</div>';
    $("draftVersionList").querySelectorAll("[data-restore-version]").forEach(b=>b.onclick=()=>restoreGeneratedDraftVersion(Number(b.dataset.restoreVersion)));
  }catch(err){
    $("draftVersionList").innerHTML='<div class="admin-empty">Riwayat versi gagal dimuat: '+esc(err.message||err)+'</div>';
  }
}
function closeDraftVersionHistory(){$("draftVersionModal").classList.add("hidden")}
async function restoreGeneratedDraftVersion(versionNo){
  if(!generatedDraftCurrent)return;
  if(!confirm('Pulihkan versi '+versionNo+'? Sistem akan membuat versi baru dari versi tersebut; versi sekarang tetap tersimpan di riwayat.'))return;
  const recordId=generatedDraftCurrent.row.record_id;
  try{
    await api.db.rpc("restore_admin_document_generated_draft_version",{p_record_id:recordId,p_version_no:versionNo});
    closeDraftVersionHistory();
    await loadData();
    await openGeneratedDraft(recordId);
  }catch(err){alert('Gagal memulihkan versi: '+(err.message||err));}
}
async function regenerateGeneratedDraft(){
  if(!generatedDraftCurrent||!generatedDraftCanEdit())return;
  const recordId=generatedDraftCurrent.row.record_id;
  if(!confirm('Generate ulang dari template/data SIMANIS? Versi edit saat ini tetap disimpan di Riwayat Versi, tetapi hasil generate baru akan menjadi versi aktif.'))return;
  const ok=await flushGeneratedDraftAutosave();if(!ok)return;
  try{
    await api.db.rpc("generate_admin_document_draft",{p_record_id:recordId});
    await loadData();
    await openGeneratedDraft(recordId);
  }catch(err){alert('Generate ulang gagal: '+(err.message||err));}
}
function insertGeneratedDraftTable(){
  if(!generatedDraftEditing)return;
  const html='<table><tbody><tr><th>Kolom 1</th><th>Kolom 2</th></tr><tr><td>...</td><td>...</td></tr></tbody></table><p><br></p>';
  document.execCommand("insertHTML",false,html);
  $("generatedDraftBody").focus();scheduleGeneratedDraftAutosave();
}
async function submitGeneratedDraft(){
  if(!generatedDraftCurrent)return;
  const recordId=generatedDraftCurrent.row.record_id;
  const ok=await flushGeneratedDraftAutosave();if(!ok)return;
  generatedDraftEditing=false;
  $("generatedDraftModal").classList.add("hidden");
  generatedDraftCurrent=null;
  const row=rows.find(r=>r.record_id===recordId);if(row){row.generated_draft_edit_state='READY';openSubmit(recordId);}
}
function printGeneratedDraft(){
  if(!generatedDraftCurrent)return;
  const w=window.open("","_blank");if(!w){alert("Popup diblokir browser.");return}
  const content=cleanGeneratedDraftHtml($("generatedDraftBody").innerHTML||generatedDraftCurrent.content_html);
  const html="<!doctype html><html><head><meta charset=\"utf-8\"><title>Draft Administrasi</title><style>@page{size:A4;margin:15mm}body{font-family:Arial,sans-serif;color:#1d2a24;line-height:1.5}table{width:100%;border-collapse:collapse;margin:12px 0}th,td{border:1px solid #bfcac4;padding:6px;font-size:10px}h1{font-size:18px}h2{font-size:16px}h3{font-size:13px}</style></head><body>"+content+"</body></html>";
  w.document.write(html);w.document.close();setTimeout(()=>w.print(),250);
}
async function editNote(recordId){
  const row=rows.find(r=>r.record_id===recordId), note=prompt("Catatan dokumen:",row?.note||""); if(note===null)return;
  try{await api.db.rpc("update_admin_document_note",{p_record_id:recordId,p_note:note.trim()||null});await loadData();}catch(err){alert("Gagal menyimpan catatan: "+err.message)}
}
function encodePath(path){return path.split("/").map(encodeURIComponent).join("/");}
async function uploadFile(file){
  if(!uploadTarget||!file)return; if(file.size>20*1024*1024){alert("Ukuran file maksimal 20 MB.");return;}
  const session=await api.auth.getSession(), cfg=window.SIMANIS_CONFIG, safe=file.name.replace(/[^a-zA-Z0-9._-]+/g,"_"), path=`${activeAcademicYearFolder()}/${uploadTarget.document_code}/${Date.now()}_${safe}`;
  try{
    const resp=await fetch(`${cfg.SUPABASE_URL.replace(/\/$/,"")}/storage/v1/object/administrasi-kepala/${encodePath(path)}`,{method:"POST",headers:{apikey:cfg.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`,"Content-Type":file.type||"application/octet-stream","x-upsert":"false"},body:file});
    const txt=await resp.text(); if(!resp.ok) throw new Error(txt||`HTTP ${resp.status}`);
    await api.db.rpc("register_admin_document_file",{
      p_record_id:uploadTarget.record_id,
      p_storage_path:path,
      p_file_name:file.name,
      p_mime_type:file.type||null,
      p_file_size:file.size
    });
    await loadData(); alert("File berhasil diupload.");
  }catch(err){alert("Upload gagal: "+err.message)}finally{uploadTarget=null;}
}
async function openFile(recordId){
  const row=rows.find(r=>r.record_id===recordId); if(!row?.storage_path)return;
  const session=await api.auth.getSession(), cfg=window.SIMANIS_CONFIG;
  try{
    const res=await fetch(`${cfg.SUPABASE_URL.replace(/\/$/,"")}/storage/v1/object/sign/administrasi-kepala/${encodePath(row.storage_path)}`,{method:"POST",headers:{apikey:cfg.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({expiresIn:3600})});
    const data=await res.json(); if(!res.ok) throw new Error(data?.message||"Gagal membuat link file."); const signed=data.signedURL||data.signedUrl; if(!signed) throw new Error("Signed URL tidak diterima.");
    window.open(signed.startsWith("http")?signed:`${cfg.SUPABASE_URL.replace(/\/$/,"")}/storage/v1${signed}`,"_blank");
  }catch(err){alert("File gagal dibuka: "+err.message)}
}
$("picTaskToggleBtn").onclick=()=>{picTaskExpanded=!picTaskExpanded;renderPicTaskCenter()};
$("picTaskSubmitAllBtn").onclick=openBulkSubmitModal;
$("bulkSubmitClose").onclick=closeBulkSubmitModal;
$("bulkSubmitCancel").onclick=closeBulkSubmitModal;
$("bulkSubmitConfirm").onclick=confirmBulkSubmit;
$("bulkSubmitModal").onclick=e=>{if(e.target===$("bulkSubmitModal"))closeBulkSubmitModal()};
$("validationDispatchPicBtn").onclick=dispatchPicTasks;
$("validationSmartCompleteBtn").onclick=runValidationSmartComplete;
$("validationReviewStartBtn").onclick=startValidationReview;
$("validationReviewClose").onclick=closeValidationReview;
$("validationReviewModal").onclick=e=>{if(e.target===$("validationReviewModal"))closeValidationReview()};
$("validationPrev").onclick=()=>moveValidationReview(-1);
$("validationNext").onclick=()=>moveValidationReview(1);
$("validationOpenDraft").onclick=()=>{
  const r=validationRows[validationReviewIndex];if(!r)return;closeValidationReview();openGeneratedDraft(r.record_id);
};
$("validationOpenSource").onclick=()=>{
  const r=validationRows[validationReviewIndex];if(!r)return;const main=rows.find(x=>x.record_id===r.record_id);const route=main?.integration_key?integrationRoute(main.integration_key):null;if(route)window.open(route,"_blank");
};
$("validationFollowup").onclick=()=>{
  const r=validationRows[validationReviewIndex];if(!r)return;closeValidationReview();openFollowup(r.record_id);
};
$("validationVerify").onclick=()=>{
  const r=validationRows[validationReviewIndex];if(!r)return;
  validationReturnAfterVerify=true;
  closeValidationReview();
  openVerify(r.record_id);
};
$("docSearch").addEventListener("input",renderDocs);
$("statusFilter").addEventListener("change",renderDocs);
$("filePicker").addEventListener("change",e=>uploadFile(e.target.files?.[0]));
$("attachmentPicker").addEventListener("change",e=>uploadAttachment(e.target.files?.[0]));
$("attachmentClose").onclick=closeAttachmentModal;
$("attachmentDone").onclick=closeAttachmentModal;
$("attachmentAddBtn").onclick=()=>{$("attachmentPicker").value="";$("attachmentPicker").click()};
$("attachmentModal").onclick=e=>{if(e.target===$("attachmentModal"))closeAttachmentModal()};
$("finalDocumentClose").onclick=closeFinalDocument;
$("finalDocumentDone").onclick=closeFinalDocument;
$("finalDocumentHistory").onclick=openFinalHistory;
$("finalDocumentPrint").onclick=printFinalDocument;
$("finalDocumentModal").onclick=e=>{if(e.target===$("finalDocumentModal"))closeFinalDocument()};
$("finalHistoryClose").onclick=closeFinalHistory;
$("finalHistoryDone").onclick=closeFinalHistory;
$("finalHistoryModal").onclick=e=>{if(e.target===$("finalHistoryModal"))closeFinalHistory()};
$("generatedDraftClose").onclick=()=>closeGeneratedDraft();
$("generatedDraftDone").onclick=()=>closeGeneratedDraft();
$("generatedDraftPrint").onclick=printGeneratedDraft;
$("generatedDraftEdit").onclick=async()=>{
  if(generatedDraftEditing){
    const ok=await flushGeneratedDraftAutosave();if(ok)setGeneratedDraftEditing(false);
  }else setGeneratedDraftEditing(true);
};
$("generatedDraftSaveVersion").onclick=saveGeneratedDraftVersion;
$("generatedDraftReady").onclick=markGeneratedDraftReady;
$("generatedDraftHistory").onclick=openDraftVersionHistory;
$("generatedDraftRegenerate").onclick=regenerateGeneratedDraft;
$("generatedDraftSubmit").onclick=submitGeneratedDraft;
$("generatedDraftInsertTable").onclick=insertGeneratedDraftTable;
$("generatedDraftBody").addEventListener("input",scheduleGeneratedDraftAutosave);
document.querySelectorAll("[data-editor-cmd]").forEach(btn=>{
  btn.addEventListener("mousedown",e=>{
    e.preventDefault();
    if(!generatedDraftEditing)return;
    document.execCommand(btn.dataset.editorCmd,false,null);
    $("generatedDraftBody").focus();
    scheduleGeneratedDraftAutosave();
  });
});
document.querySelectorAll("[data-editor-block]").forEach(btn=>{
  btn.addEventListener("mousedown",e=>{
    e.preventDefault();
    if(!generatedDraftEditing)return;
    document.execCommand("formatBlock",false,btn.dataset.editorBlock);
    $("generatedDraftBody").focus();
    scheduleGeneratedDraftAutosave();
  });
});
$("generatedDraftModal").onclick=e=>{if(e.target===$("generatedDraftModal"))closeGeneratedDraft()};
$("draftVersionClose").onclick=closeDraftVersionHistory;
$("draftVersionDone").onclick=closeDraftVersionHistory;
$("draftVersionModal").onclick=e=>{if(e.target===$("draftVersionModal"))closeDraftVersionHistory()};
$("adminNotifBtn").onclick=openAdminNotifications;$("notificationClose").onclick=closeAdminNotifications;$("notificationDone").onclick=closeAdminNotifications;$("notificationReadAll").onclick=markAllAdminNotificationsRead;
$("notificationModal").onclick=e=>{if(e.target===$("notificationModal"))closeAdminNotifications()};
$("submitClose").onclick=closeSubmit;$("submitCancel").onclick=closeSubmit;$("submitSave").onclick=saveSubmission;
$("submitModal").onclick=e=>{if(e.target===$("submitModal"))closeSubmit()};
$("attentionToggleBtn").onclick=()=>{attentionExpanded=!attentionExpanded;renderAttention()};
$("picSummaryBtn").onclick=openPicSummary;$("picClose").onclick=closePicSummary;$("picDone").onclick=closePicSummary;$("picApplyEmptyBtn").onclick=applyPicEmpty;
$("picModal").onclick=e=>{if(e.target===$("picModal"))closePicSummary()};
$("followupClose").onclick=closeFollowup;$("followupCancel").onclick=closeFollowup;$("followupSave").onclick=saveFollowup;
$("followupModal").onclick=e=>{if(e.target===$("followupModal"))closeFollowup()};
$("verifyClose").onclick=closeVerify;$("verifyCancel").onclick=closeVerify;$("verifySave").onclick=saveVerification;
$("verifyModal").onclick=e=>{if(e.target===$("verifyModal"))closeVerify()};
$("historyClose").onclick=closeHistory;$("historyDone").onclick=closeHistory;
$("historyModal").onclick=e=>{if(e.target===$("historyModal"))closeHistory()};
$("exportAdminCsvBtn").onclick=exportAdminCsv;
$("printAdminReportBtn").onclick=printAdminReport;
(async function boot(){
  try{api=await window.simanisReady; const session=await api.auth.getSession(); if(!session){location.replace("index.html");return} const user=await api.auth.getUser(); if(!user){location.replace("index.html");return} profile=await loadProfile(user);
    try{headManager=!!(await api.db.rpc("is_admin_head_manager",{}))}catch(_){headManager=false}
    $("picSummaryBtn").style.display=headManager?"inline-flex":"none";
    $("adminPackageLink").style.display=headManager?"inline-flex":"none";
    $("sideUserName").textContent=profile.full_name||user.email||"Pengguna"; $("sideUserRole").textContent=formatRole(profile.role); $("headerUser").textContent=profile.full_name||user.email||"Pengguna"; $("currentDate").textContent=localDateID();
    try{const x=await api.db.rpc("get_public_system_settings",{});systemSettings=Array.isArray(x)?x[0]:x}catch(_){systemSettings=null}
    await loadActiveAcademicYear(); await loadMenu(); await loadData(); $("logoutBtn").addEventListener("click",async()=>{await api.auth.signOut();location.replace("index.html");});
  }catch(err){console.error(err);alert("Administrasi Kepala gagal dimuat: "+(err.message||err));}finally{$("loading").classList.add("hidden");}
})();
