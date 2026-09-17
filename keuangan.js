const $=id=>document.getElementById(id);
let api,profile,rows=[],categories=[],modulePerm={can_view:false,can_create:false,can_update:false,can_delete:false};
const STORAGE_BUCKET="keuangan-bukti";
const MAX_FILE_SIZE=10*1024*1024;
const ALLOWED_MIME=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);

function esc(s){return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}
function formatRole(r){return (r||"-").replaceAll("_"," ")}
function localDateID(){return new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date())}
function routeFor(code){return {DASHBOARD:"dashboard.html",ADMINISTRASI_KEPALA:"administrasi.html",DATA_SISWA:"siswa.html",DATA_GURU:"guru.html",KELAS:"kelas.html",MATA_PELAJARAN:"mapel.html",JADWAL:"jadwal.html",ABSENSI_GURU:"absensi-guru.html",ABSENSI_SISWA:"absensi-siswa.html",NILAI:"nilai.html",PRESTASI:"prestasi.html",BERITA:"berita.html",PENGUMUMAN:"pengumuman.html",AGENDA:"agenda.html",KEUANGAN:"keuangan.html"}[code]||"#"}
function canCreate(){return !!modulePerm.can_create}
function canUpdate(){return !!modulePerm.can_update}
function canDelete(){return !!modulePerm.can_delete}
function money(n){return new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(n||0))}
function dateLabel(v){return v?new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(v+"T00:00:00")):"-"}
function monthName(key){
  if(!key)return "Semua Bulan";
  const [y,m]=key.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID",{month:"long",year:"numeric"}).format(new Date(y,m-1,1));
}
function todayInput(){
  const d=new Date(),pad=n=>String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function currentMonthKey(){return todayInput().slice(0,7)}

async function loadProfile(user){
  const r=await api.db.select("profiles",`select=id,full_name,role,is_active&id=eq.${encodeURIComponent(user.id)}&limit=1`);
  if(!r?.[0])throw new Error("Profil pengguna tidak ditemukan.");
  if(!r[0].is_active)throw new Error("Akun tidak aktif.");
  return r[0];
}
async function loadMenu(){
  const m=await api.db.rpc("get_my_modules",{});
  const current=(m||[]).find(x=>x.code==="KEUANGAN");
  if(current)modulePerm=current;
  $("sidebarMenu").innerHTML=(m||[]).map(x=>`<a href="${routeFor(x.code)}" class="nav-item ${x.code==="KEUANGAN"?"active":""}"><span class="nav-dot"></span><span>${esc(x.name)}</span></a>`).join("");
  document.querySelectorAll('.nav-item[href="#"]').forEach(a=>a.onclick=e=>{e.preventDefault();alert(`Modul "${a.textContent.trim()}" akan diaktifkan bertahap.`)});
}
async function loadMaster(){
  categories=await api.db.select("finance_categories","select=id,code,name,transaction_type,sort_order,is_active&is_active=eq.true&order=sort_order.asc,name.asc")||[];
  renderCategoryOptions();
}
async function loadData(){
  rows=await api.db.select("v_finance_transactions_detail","select=*&order=transaction_date.desc,created_at.desc")||[];
  renderMonthOptions();
  render();
}
function renderCategoryOptions(){
  const type=$("transactionType")?.value||"INCOME";
  const list=categories.filter(c=>c.transaction_type===type||c.transaction_type==="BOTH");
  if($("category"))$("category").innerHTML=list.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");
  $("categoryFilter").innerHTML='<option value="">Semua Kategori</option>'+categories.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");
}
function renderMonthOptions(){
  const current=$("monthFilter").value;
  const keys=[...new Set([currentMonthKey(),...rows.map(r=>String(r.transaction_date||"").slice(0,7)).filter(Boolean)])].sort().reverse();
  $("monthFilter").innerHTML='<option value="">Semua Bulan</option>'+keys.map(k=>`<option value="${k}">${esc(monthName(k))}</option>`).join("");
  if(current&&keys.includes(current))$("monthFilter").value=current;
  else $("monthFilter").value=currentMonthKey();
}
function activeRows(){return rows.filter(r=>r.status==="POSTED")}
function filtered(){
  const q=$("searchInput").value.trim().toLowerCase(),month=$("monthFilter").value,type=$("typeFilter").value,cat=$("categoryFilter").value,acc=$("accountFilter").value;
  return rows.filter(r=>{
    const hay=`${r.description||""} ${r.reference_number||""} ${r.category_name||""} ${r.account_name||""} ${r.created_by_name||""}`.toLowerCase();
    return (!q||hay.includes(q))&&(!month||String(r.transaction_date||"").startsWith(month))&&(!type||r.transaction_type===type)&&(!cat||r.category_id===cat)&&(!acc||r.account_type===acc);
  });
}
function periodPosted(){
  const month=$("monthFilter").value;
  return activeRows().filter(r=>!month||String(r.transaction_date||"").startsWith(month));
}
function calcBalance(list){return list.reduce((s,r)=>s+Number(r.signed_amount||0),0)}
function renderStats(){
  const all=activeRows(),period=periodPosted();
  $("statBalance").textContent=money(calcBalance(all));
  $("statCash").textContent=money(calcBalance(all.filter(r=>r.account_type==="CASH")));
  $("statBank").textContent=money(calcBalance(all.filter(r=>r.account_type==="BANK")));
  $("statIncome").textContent=money(period.filter(r=>r.transaction_type==="INCOME").reduce((s,r)=>s+Number(r.amount||0),0));
  $("statExpense").textContent=money(period.filter(r=>r.transaction_type==="EXPENSE").reduce((s,r)=>s+Number(r.amount||0),0));
  const label=$("monthFilter").value?monthName($("monthFilter").value):"Semua periode";
  $("incomeSub").textContent=label;$("expenseSub").textContent=label;
}
function typeBadge(r){
  if(r.status==="VOID")return '<span class="badge-soft badge-void">BATAL</span>';
  return r.transaction_type==="INCOME"?'<span class="badge-soft badge-in">PEMASUKAN</span>':'<span class="badge-soft badge-out">PENGELUARAN</span>';
}
function amountHtml(r){
  const cls=r.status==="VOID"?"money-void":(r.transaction_type==="INCOME"?"money-in":"money-out");
  const sign=r.transaction_type==="INCOME"?"+":"−";
  return `<span class="${cls}">${sign} ${money(r.amount)}</span>`;
}
function storageLabel(r){return r.account_type==="CASH"?"Cash / Tunai":`Rekening${r.account_name?` · ${esc(r.account_name)}`:""}`}
function render(){
  renderStats();
  const data=filtered();
  const posted=data.filter(r=>r.status==="POSTED");
  const income=posted.filter(r=>r.transaction_type==="INCOME").reduce((s,r)=>s+Number(r.amount||0),0);
  const expense=posted.filter(r=>r.transaction_type==="EXPENSE").reduce((s,r)=>s+Number(r.amount||0),0);
  $("summaryLine").textContent=`${data.length} transaksi · Pemasukan ${money(income)} · Pengeluaran ${money(expense)} · Selisih ${money(income-expense)}`;
  $("addBtn").style.display=canCreate()?"":"none";

  if(!data.length){
    $("financeTableBody").innerHTML='<tr><td colspan="8"><div class="empty-state">Belum ada transaksi yang cocok dengan filter.</div></td></tr>';
    $("financeCards").innerHTML='<div class="empty-state">Belum ada transaksi yang cocok dengan filter.</div>';
    return;
  }

  $("financeTableBody").innerHTML=data.map((r,i)=>`<tr>
    <td>${i+1}</td>
    <td>${esc(dateLabel(r.transaction_date))}</td>
    <td>${typeBadge(r)}</td>
    <td><b>${esc(r.category_name)}</b><br>${esc(r.description)}${r.reference_number?`<br><span style="color:#7b8781">Ref: ${esc(r.reference_number)}</span>`:""}</td>
    <td>${storageLabel(r)}</td>
    <td>${amountHtml(r)}</td>
    <td>${r.receipt_path?`<button class="mini-btn" data-open-receipt="${r.id}">Buka</button>`:"-"}</td>
    <td>${canUpdate()?`<button class="mini-btn" data-edit="${r.id}">Edit</button>`:""}</td>
  </tr>`).join("");

  $("financeCards").innerHTML=data.map(r=>`<article class="finance-card">
    <div class="finance-card-top"><div>${typeBadge(r)}</div><div>${amountHtml(r)}</div></div>
    <h4>${esc(r.category_name)}</h4>
    <p>${esc(r.description)}</p>
    <p><b>${esc(dateLabel(r.transaction_date))}</b> · ${storageLabel(r)}</p>
    ${r.reference_number?`<p>Ref: ${esc(r.reference_number)}</p>`:""}
    <div class="row-actions">
      ${r.receipt_path?`<button class="mini-btn" data-open-receipt="${r.id}">Buka Bukti</button>`:""}
      ${canUpdate()?`<button class="mini-btn" data-edit="${r.id}">Edit</button>`:""}
    </div>
  </article>`).join("");

  document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>openEdit(b.dataset.edit));
  document.querySelectorAll("[data-open-receipt]").forEach(b=>b.onclick=()=>openReceipt(b.dataset.openReceipt));
}
function toggleBank(){
  const bank=$("accountType").value==="BANK";
  $("bankNameWrap").classList.toggle("hidden",!bank);
  $("accountName").required=bank;
  if(!bank)$("accountName").value="";
}
function receiptBox(r){
  if(!r?.receipt_path){$("receiptCurrent").innerHTML='<span class="field-hint">Belum ada bukti tersimpan.</span>';return}
  $("receiptCurrent").innerHTML=`<div class="receipt-box"><div><b style="font-size:10px">📎 ${esc(r.receipt_name||"Bukti transaksi")}</b><div class="receipt-meta">${formatBytes(r.receipt_size)}</div></div><button class="mini-btn" type="button" id="openCurrentReceipt">Buka</button></div>`;
  $("openCurrentReceipt").onclick=()=>openReceipt(r.id);
}
function formatBytes(n){n=Number(n||0);if(n<1024)return `${n} B`;if(n<1048576)return `${(n/1024).toFixed(1)} KB`;return `${(n/1048576).toFixed(1)} MB`}
function openAdd(){
  if(!canCreate())return;
  $("form").reset();$("transactionId").value="";$("oldReceiptPath").value="";$("oldReceiptName").value="";
  $("modalTitle").textContent="Tambah Transaksi";$("transactionDate").value=todayInput();$("transactionType").value="INCOME";$("accountType").value="CASH";$("status").value="POSTED";
  renderCategoryOptions();toggleBank();receiptBox(null);$("deleteBtn").style.display="none";$("formMessage").textContent="";$("modal").classList.remove("hidden");
}
function openEdit(id){
  const r=rows.find(x=>x.id===id);if(!r||!canUpdate())return;
  $("form").reset();$("transactionId").value=r.id;$("oldReceiptPath").value=r.receipt_path||"";$("oldReceiptName").value=r.receipt_name||"";
  $("modalTitle").textContent="Edit Transaksi";$("transactionDate").value=r.transaction_date||"";$("transactionType").value=r.transaction_type||"INCOME";
  renderCategoryOptions();$("category").value=r.category_id||"";$("amount").value=Number(r.amount||0);$("accountType").value=r.account_type||"CASH";toggleBank();$("accountName").value=r.account_name||"";
  $("referenceNumber").value=r.reference_number||"";$("description").value=r.description||"";$("status").value=r.status||"POSTED";
  receiptBox(r);$("deleteBtn").style.display=canDelete()?"":"none";$("formMessage").textContent="";$("modal").classList.remove("hidden");
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
function encodedPath(path){return path.split("/").map(encodeURIComponent).join("/")}
function ext(name){const p=String(name||"").split(".");return p.length>1?p.pop().toLowerCase().replace(/[^a-z0-9]/g,""):"bin"}
function mime(file){return file.type||({pdf:"application/pdf",jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp"}[ext(file.name)]||"")}
function validateReceipt(file){
  const m=mime(file);
  if(!ALLOWED_MIME.has(m))throw new Error("Bukti harus PDF, JPG, PNG, atau WEBP.");
  if(file.size>MAX_FILE_SIZE)throw new Error("Ukuran bukti lebih dari 10 MB.");
  return m;
}
async function storageUpload(file,id){
  const m=validateReceipt(file),session=await api.auth.getSession();if(!session?.access_token)throw new Error("Sesi login tidak ditemukan.");
  const cfg=window.SIMANIS_CONFIG,rand=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const path=`${id}/${rand}.${ext(file.name)}`;
  const res=await fetch(`${cfg.SUPABASE_URL.replace(/\/$/,"")}/storage/v1/object/${STORAGE_BUCKET}/${encodedPath(path)}`,{
    method:"POST",headers:{apikey:cfg.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`,"Content-Type":m,"x-upsert":"false"},body:file
  });
  const text=await res.text();if(!res.ok){let msg=text;try{const j=JSON.parse(text);msg=j.message||j.error||text}catch{}throw new Error("Upload bukti gagal: "+msg)}
  return {path,mime:m};
}
async function storageDelete(path){
  if(!path)return;
  const session=await api.auth.getSession();if(!session?.access_token)return;
  const cfg=window.SIMANIS_CONFIG,res=await fetch(`${cfg.SUPABASE_URL.replace(/\/$/,"")}/storage/v1/object/${STORAGE_BUCKET}/${encodedPath(path)}`,{
    method:"DELETE",headers:{apikey:cfg.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`}
  });
  if(!res.ok)throw new Error(await res.text());
}
async function storageBlob(path){
  const session=await api.auth.getSession();if(!session?.access_token)throw new Error("Sesi login tidak ditemukan.");
  const cfg=window.SIMANIS_CONFIG,res=await fetch(`${cfg.SUPABASE_URL.replace(/\/$/,"")}/storage/v1/object/authenticated/${STORAGE_BUCKET}/${encodedPath(path)}`,{
    headers:{apikey:cfg.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`}
  });
  if(!res.ok)throw new Error(await res.text());
  return res.blob();
}
async function openReceipt(id){
  const r=rows.find(x=>x.id===id);if(!r?.receipt_path)return;
  const tab=window.open("","_blank");
  try{
    if(tab)tab.document.write('<p style="font-family:sans-serif;padding:24px">Memuat bukti transaksi...</p>');
    const blob=await storageBlob(r.receipt_path),url=URL.createObjectURL(blob);
    if(tab)tab.location.href=url;else location.href=url;
    setTimeout(()=>URL.revokeObjectURL(url),120000);
  }catch(err){if(tab)tab.close();alert("Bukti gagal dibuka: "+err.message)}
}
async function save(e){
  e.preventDefault();
  const btn=$("saveBtn");btn.disabled=true;btn.textContent="Menyimpan...";$("formMessage").textContent="";
  let uploaded=null;
  try{
    const id=$("transactionId").value;
    const amount=Number($("amount").value||0);
    if(amount<=0)throw new Error("Nominal harus lebih dari 0.");
    if(!$("description").value.trim())throw new Error("Uraian transaksi wajib diisi.");
    if($("accountType").value==="BANK"&&!$("accountName").value.trim())throw new Error("Nama rekening/bank wajib diisi.");

    const file=$("receiptFile").files?.[0];
    let finalId=id;
    if(!finalId){
      const ins=await restWrite("finance_transactions","POST",{
        transaction_date:$("transactionDate").value,
        transaction_type:$("transactionType").value,
        category_id:$("category").value,
        amount,
        account_type:$("accountType").value,
        account_name:$("accountType").value==="BANK"?$("accountName").value.trim():null,
        reference_number:$("referenceNumber").value.trim()||null,
        description:$("description").value.trim(),
        status:$("status").value
      });
      finalId=ins?.[0]?.id;if(!finalId)throw new Error("ID transaksi baru tidak diterima.");
    }

    if(file)uploaded=await storageUpload(file,finalId);

    const payload={
      transaction_date:$("transactionDate").value,
      transaction_type:$("transactionType").value,
      category_id:$("category").value,
      amount,
      account_type:$("accountType").value,
      account_name:$("accountType").value==="BANK"?$("accountName").value.trim():null,
      reference_number:$("referenceNumber").value.trim()||null,
      description:$("description").value.trim(),
      status:$("status").value
    };
    if(uploaded){
      payload.receipt_path=uploaded.path;
      payload.receipt_name=file.name;
      payload.receipt_mime=uploaded.mime;
      payload.receipt_size=file.size;
    }

    if(id)await restWrite(`finance_transactions?id=eq.${encodeURIComponent(id)}`,"PATCH",payload);
    else if(uploaded)await restWrite(`finance_transactions?id=eq.${encodeURIComponent(finalId)}`,"PATCH",payload);

    const old=$("oldReceiptPath").value;
    if(uploaded&&old&&old!==uploaded.path){try{await storageDelete(old)}catch(err){console.warn("Bukti lama gagal dihapus",err)}}

    closeModal();await loadData();
  }catch(err){
    if(uploaded){try{await storageDelete(uploaded.path)}catch{}}
    $("formMessage").textContent="Gagal menyimpan: "+err.message;
  }finally{btn.disabled=false;btn.textContent="Simpan"}
}
async function remove(){
  const id=$("transactionId").value,r=rows.find(x=>x.id===id);if(!r||!canDelete())return;
  if(!confirm(`Hapus permanen transaksi "${r.description}"?`))return;
  try{
    await restWrite(`finance_transactions?id=eq.${encodeURIComponent(id)}`,"DELETE",undefined,"return=minimal");
    if(r.receipt_path){try{await storageDelete(r.receipt_path)}catch{}}
    closeModal();await loadData();
  }catch(err){alert("Gagal menghapus transaksi: "+err.message)}
}
function csvCell(v){return `"${String(v??"").replaceAll('"','""')}"`}
function exportCsv(){
  const data=filtered();if(!data.length){alert("Tidak ada transaksi pada filter saat ini.");return}
  const header=["No","Tanggal","Status","Jenis","Kategori","Uraian","Penyimpanan","Rekening","Nomor Referensi","Nominal","Pembuat"];
  const lines=[header.map(csvCell).join(";")];
  data.forEach((r,i)=>lines.push([i+1,r.transaction_date,r.status,r.transaction_type==="INCOME"?"Pemasukan":"Pengeluaran",r.category_name,r.description,r.account_type,r.account_name||"",r.reference_number||"",r.amount,r.created_by_name||""].map(csvCell).join(";")));
  const blob=new Blob(["\ufeffsep=;\r\n"+lines.join("\r\n")],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`laporan-keuangan-${$("monthFilter").value||"semua-periode"}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function printReport(){
  const data=filtered();if(!data.length){alert("Tidak ada transaksi pada filter saat ini.");return}
  const posted=data.filter(r=>r.status==="POSTED"),inc=posted.filter(r=>r.transaction_type==="INCOME").reduce((s,r)=>s+Number(r.amount||0),0),exp=posted.filter(r=>r.transaction_type==="EXPENSE").reduce((s,r)=>s+Number(r.amount||0),0);
  const rowsHtml=data.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(dateLabel(r.transaction_date))}</td><td>${esc(r.status)}</td><td>${r.transaction_type==="INCOME"?"Pemasukan":"Pengeluaran"}</td><td>${esc(r.category_name)}</td><td>${esc(r.description)}</td><td>${esc(r.account_type==="CASH"?"Cash":r.account_name||"Rekening")}</td><td style="text-align:right">${esc(money(r.amount))}</td></tr>`).join("");
  const w=window.open("","_blank");if(!w){alert("Popup diblokir browser.");return}
  const today=new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",day:"2-digit",month:"long",year:"numeric"}).format(new Date());
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Laporan Keuangan</title><style>@page{size:A4 landscape;margin:12mm}body{font-family:Arial,sans-serif;color:#111;font-size:10px;margin:0}.kop{text-align:center;border-bottom:3px double #111;padding-bottom:8px;margin-bottom:12px}.kop h1{font-size:18px;margin:0}.kop h2{font-size:13px;margin:3px 0}.title{text-align:center;margin:12px 0}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0}.sum{border:1px solid #bbb;padding:8px;border-radius:6px}.sum b{display:block;font-size:15px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #999;padding:5px;vertical-align:top}th{background:#eee;font-size:9px}.foot{display:flex;justify-content:space-between;margin-top:22px}.sign{width:260px;text-align:center}.space{height:55px}.meta{font-size:8px;color:#555;margin-top:6px}</style></head><body><div class="kop"><h1>MA NURUL ISLAM KARANGCEMPAKA</h1><h2>SIMANIS — LAPORAN KEUANGAN</h2></div><div class="title"><h3>BUKU KAS MADRASAH</h3><div>Periode: ${esc($("monthFilter").value?monthName($("monthFilter").value):"Semua Periode")}</div></div><div class="summary"><div class="sum">Pemasukan<b>${esc(money(inc))}</b></div><div class="sum">Pengeluaran<b>${esc(money(exp))}</b></div><div class="sum">Selisih<b>${esc(money(inc-exp))}</b></div></div><table><thead><tr><th>No</th><th>Tanggal</th><th>Status</th><th>Jenis</th><th>Kategori</th><th>Uraian</th><th>Penyimpanan</th><th>Nominal</th></tr></thead><tbody>${rowsHtml}</tbody></table><div class="meta">Dicetak dari SIMANIS pada ${today}</div><div class="foot"><div class="sign">Mengetahui,<br>Kepala Madrasah<div class="space"></div><b>__________________________</b></div><div class="sign">Karangcempaka, ${today}<br>Bendahara<div class="space"></div><b>__________________________</b></div></div></body></html>`);
  w.document.close();w.focus();setTimeout(()=>w.print(),400);
}

$("searchInput").addEventListener("input",render);
$("monthFilter").addEventListener("change",render);
$("typeFilter").addEventListener("change",render);
$("categoryFilter").addEventListener("change",render);
$("accountFilter").addEventListener("change",render);
$("addBtn").addEventListener("click",openAdd);
$("printBtn").addEventListener("click",printReport);
$("csvBtn").addEventListener("click",exportCsv);
$("closeModal").addEventListener("click",closeModal);
$("cancelBtn").addEventListener("click",closeModal);
$("deleteBtn").addEventListener("click",remove);
$("form").addEventListener("submit",save);
$("transactionType").addEventListener("change",renderCategoryOptions);
$("accountType").addEventListener("change",toggleBank);
$("modal").addEventListener("click",e=>{if(e.target===$("modal"))closeModal()});

(async()=>{
  try{
    api=await window.simanisReady;
    const user=await api.auth.getUser();if(!user){location.href="index.html";return}
    profile=await loadProfile(user);
    $("sideUserName").textContent=profile.full_name||"Pengguna";$("sideUserRole").textContent=formatRole(profile.role);$("headerUser").textContent=profile.full_name||"Pengguna";$("currentDate").textContent=localDateID();
    await loadMenu();if(!modulePerm.can_view)throw new Error("Akun tidak memiliki akses ke modul Keuangan.");
    await loadMaster();await loadData();
    $("logoutBtn").onclick=async()=>{await api.auth.signOut();location.href="index.html"};
  }catch(err){
    console.error(err);alert("Modul Keuangan gagal dimuat: "+err.message);
  }finally{$("loading").style.display="none"}
})();
