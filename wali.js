const $=id=>document.getElementById(id);
const PENDING_KEY="simanis-guardian-pending-invite";
let api,user,children=[],selectedStudentId=null,finance=null,payments=[],guardianProfile=null;

function esc(s){return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}
function money(n){return new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(n||0))}
function dateLabel(v){return v?new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"long",year:"numeric"}).format(new Date(v+"T00:00:00")):"-"}
function statusHtml(st){if(st==="LUNAS")return'<span class="status lunas">LUNAS</span>';if(st==="CICILAN")return'<span class="status cicilan">CICILAN</span>';return'<span class="status belum">BELUM BAYAR</span>'}

async function loadProfile(){
 try{
  const rows=await api.db.select("guardian_portal_profiles",`select=user_id,full_name,phone,email&user_id=eq.${encodeURIComponent(user.id)}&limit=1`);
  guardianProfile=rows?.[0]||null;
 }catch{guardianProfile=null}
}
async function processPending(){
 const raw=localStorage.getItem(PENDING_KEY);if(!raw)return false;
 let p;try{p=JSON.parse(raw)}catch{localStorage.removeItem(PENDING_KEY);return false}
 if(!p?.code)return false;
 try{
  await api.db.rpc("claim_guardian_invite",{p_code:p.code,p_guardian_name:p.name||user.email||"Wali Siswa",p_phone:p.phone||null});
  localStorage.removeItem(PENDING_KEY);return true;
 }catch(err){
  if(String(err.message).includes("sudah pernah digunakan"))localStorage.removeItem(PENDING_KEY);
  else throw err;
  return false;
 }
}
async function loadChildren(){
 children=await api.db.rpc("guardian_get_children",{})||[];
 if(children.length&&!selectedStudentId)selectedStudentId=children[0].student_id;
 renderChildren();
 if(selectedStudentId)await loadFinance();
 else showActivation();
}
function renderChildren(){
 $("childTabs").innerHTML=children.map(c=>`<button class="child-tab ${c.student_id===selectedStudentId?"active":""}" data-child="${c.student_id}"><b>${esc(c.student_name)}</b><span>${esc(c.class_name||"-")} · ${esc(c.relationship)}</span></button>`).join("");
 document.querySelectorAll("[data-child]").forEach(b=>b.onclick=async()=>{selectedStudentId=b.dataset.child;renderChildren();await loadFinance()});
}
async function loadFinance(){
 const [f,p]=await Promise.all([
  api.db.rpc("guardian_get_child_finance",{p_student_id:selectedStudentId}),
  api.db.rpc("guardian_get_child_payments",{p_student_id:selectedStudentId})
 ]);
 finance=f?.[0]||null;payments=p||[];renderFinance();
}
function renderFinance(){
 const child=children.find(c=>c.student_id===selectedStudentId);
 if(!finance){
  $("financeCard").innerHTML=`<div class="fee-head"><div><h2>${esc(child?.student_name||"Siswa")}</h2><p>${esc(child?.class_name||"-")}</p></div></div><div class="empty">Tagihan Iuran Pendidikan tahun pelajaran aktif belum tersedia.</div>`;
  return;
 }
 const pct=Number(finance.bill_amount)>0?Math.min(100,Math.round(Number(finance.total_paid)/Number(finance.bill_amount)*100)):0;
 const posted=payments.filter(p=>p.status==="POSTED");
 $("financeCard").innerHTML=`<div class="fee-head"><div><h2>${esc(finance.plan_name)}</h2><p>${esc(finance.student_name)} · ${esc(finance.class_name||"-")} · NISN ${esc(finance.nisn||"-")}</p></div>${statusHtml(finance.payment_status)}</div>
 <div class="stats"><div class="stat"><span>Total Iuran</span><b>${money(finance.bill_amount)}</b></div><div class="stat"><span>Sudah Dibayar</span><b>${money(finance.total_paid)}</b></div><div class="stat"><span>Sisa</span><b>${money(finance.remaining_amount)}</b></div></div>
 <div class="progress"><div class="bar" style="width:${pct}%"></div></div><div class="progress-text"><span>Progress pembayaran</span><b>${pct}%</b></div>
 <div class="history"><h3>Riwayat Cicilan (${posted.length})</h3>${payments.length?payments.map(p=>`<div class="pay ${p.status==="VOID"?"void":""}"><div><b>${esc(p.receipt_number)} · ${money(p.amount)}</b><p>${esc(dateLabel(p.payment_date))} · ${p.account_type==="CASH"?"Cash / Tunai":esc(p.account_name||"Rekening")} · ${esc(p.status)}</p>${p.status==="VOID"&&p.void_reason?`<p>Alasan pembatalan: ${esc(p.void_reason)}</p>`:""}</div><button class="note-btn" data-note="${p.payment_id}">Nota</button></div>`).join(""):'<div class="empty">Belum ada pembayaran.</div>'}</div>`;
 document.querySelectorAll("[data-note]").forEach(b=>b.onclick=()=>printReceipt(b.dataset.note));
}
function cumulativeAt(p){
 const list=payments.filter(x=>x.status==="POSTED").sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
 let sum=0;for(const x of list){sum+=Number(x.amount||0);if(x.payment_id===p.payment_id)break}return sum;
}
function printReceipt(id){
 const p=payments.find(x=>x.payment_id===id);if(!p)return;
 const cumulative=p.status==="POSTED"?cumulativeAt(p):Number(finance.total_paid||0),remaining=Math.max(Number(finance.bill_amount||0)-cumulative,0);
 const w=window.open("","_blank");if(!w){alert("Popup diblokir browser.");return}
 w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(p.receipt_number)}</title><style>@page{size:A5 portrait;margin:12mm}body{font-family:Arial;font-size:11px;color:#111}.kop{text-align:center;border-bottom:3px double #111;padding-bottom:8px}.kop h1{font-size:16px;margin:0}.title{text-align:center;font-weight:bold;margin:13px}.info{width:100%;border-collapse:collapse}.info td{padding:4px}.pay{border:1px solid #aaa;border-radius:7px;padding:10px;margin:12px 0}.pay strong{font-size:18px}.sum{width:100%;border-collapse:collapse}.sum td{border:1px solid #aaa;padding:6px}.note{font-size:9px;color:#555;margin-top:15px}</style></head><body><div class="kop"><h1>MA NURUL ISLAM KARANGCEMPAKA</h1><p>NOTA PEMBAYARAN IURAN PENDIDIKAN</p></div><div class="title">${esc(p.receipt_number)}</div><table class="info"><tr><td>Nama</td><td>: <b>${esc(p.student_name)}</b></td></tr><tr><td>Kelas</td><td>: ${esc(p.class_name||"-")}</td></tr><tr><td>NISN</td><td>: ${esc(p.nisn||"-")}</td></tr><tr><td>Tanggal</td><td>: ${esc(dateLabel(p.payment_date))}</td></tr></table><div class="pay">Pembayaran cicilan<br><strong>${esc(money(p.amount))}</strong></div><table class="sum"><tr><td>Tagihan Tahunan</td><td>${esc(money(finance.bill_amount))}</td></tr><tr><td>Total Terbayar s.d. Nota Ini</td><td>${esc(money(cumulative))}</td></tr><tr><td>Sisa Tagihan</td><td><b>${esc(money(remaining))}</b></td></tr></table><div class="note">Nota ini dapat dicetak ulang melalui Portal Wali Siswa SIMANIS.</div></body></html>`);
 w.document.close();setTimeout(()=>w.print(),350);
}
function showActivation(){$("portalContent").style.display="none";$("activationBox").style.display="block"}
function showPortal(){$("activationBox").style.display="none";$("portalContent").style.display="block";$("helloName").textContent=`Assalamu'alaikum, ${guardianProfile?.full_name||"Wali Siswa"}`}
async function manualClaim(){
 const code=$("manualCode").value.trim(),name=$("manualName").value.trim();if(!code||!name){$("manualMessage").textContent="Kode dan nama wali wajib diisi.";return}
 try{await api.db.rpc("claim_guardian_invite",{p_code:code,p_guardian_name:name,p_phone:$("manualPhone").value.trim()||null});await loadProfile();await loadChildren();showPortal()}catch(e){$("manualMessage").textContent="Aktivasi gagal: "+e.message}
}
$("manualClaimBtn").onclick=manualClaim;
$("logoutBtn").onclick=async()=>{await api.auth.signOut();location.href="wali-login.html"};

(async()=>{
 try{
  api=await window.simanisReady;const session=await api.auth.getSession();if(!session){location.href="wali-login.html";return}
  user=await api.auth.getUser();if(!user){location.href="wali-login.html";return}
  await processPending();await loadProfile();await loadChildren();
  if(children.length)showPortal();else showActivation();
 }catch(e){console.error(e);alert("Portal Wali gagal dimuat: "+e.message);showActivation()}
})();