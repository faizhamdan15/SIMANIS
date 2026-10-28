const $=id=>document.getElementById(id);
let api,profile,rows=[],categories=[],modulePerm={can_view:false,can_create:false,can_update:false,can_delete:false};
let feePlans=[],activePlan=null,bills=[],studentPayments=[],classes=[],classRates=[];
let selectedBillId=null;
let officialTreasurerName="";
let expenseCsvObjectUrl=null;
const STORAGE_BUCKET="keuangan-bukti";
const MAX_FILE_SIZE=10*1024*1024;
const ALLOWED_MIME=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);

function esc(s){return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}
function formatRole(r){return (r||"-").replaceAll("_"," ")}
function localDateID(){return new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date())}
function routeFor(code){return {DASHBOARD:"dashboard.html",ADMINISTRASI_KEPALA:"administrasi.html",DATA_SISWA:"siswa.html",DATA_GURU:"guru.html",KELAS:"kelas.html",MATA_PELAJARAN:"mapel.html",JADWAL:"jadwal.html",ABSENSI_GURU:"absensi-guru.html",ABSENSI_SISWA:"absensi-siswa.html",NILAI:"nilai.html",PRESTASI:"prestasi.html",BERITA:"berita.html",PENGUMUMAN:"pengumuman.html",AGENDA:"agenda.html",KEUANGAN:"keuangan.html",PKM_KURIKULUM:"unit-kerja.html?unit=PKM_KURIKULUM",PKM_KESISWAAN:"unit-kerja.html?unit=PKM_KESISWAAN",PKM_BENDAHARA_SARPRAS:"unit-kerja.html?unit=PKM_BENDAHARA_SARPRAS",PKM_HUMASY:"unit-kerja.html?unit=PKM_HUMASY",KEPALA_TU:"unit-kerja.html?unit=KEPALA_TU"}[code]||"#"}
function canCreate(){return !!modulePerm.can_create}
function canUpdate(){return !!modulePerm.can_update}
function canDelete(){return !!modulePerm.can_delete}
function money(n){return new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(n||0))}

/* Formulir rupiah: angka terlihat 1.000.000, tapi disimpan sebagai Number(1000000). */
const rupiahIntegerFormatter=new Intl.NumberFormat("id-ID",{maximumFractionDigits:0,useGrouping:true});
function rupiahInputDigits(raw){
 let text=String(raw??"").trim();
 // Tempelan nilai Rupiah dari spreadsheet kadang memiliki ,00 di belakang.
 // Pecahan selain nol tidak diterima, agar tak salah hitung berlipat.
 const fractional=text.match(/,(\d{1,2})$/);
 if(fractional){
  if(Number(fractional[1])!==0)return null;
  text=text.slice(0,-fractional[0].length);
 }
 return text.replace(/\D/g,"");
}
function formatRupiahInput(raw){
 const digits=rupiahInputDigits(raw);
 if(digits===null)return String(raw??"");
 const integer=digits.replace(/^0+(?=\d)/,"").slice(0,15);
 return integer?rupiahIntegerFormatter.format(Number(integer)):"";
}
function rupiahFromNumber(value){
 if(value===null||value===undefined||value==="")return "";
 const number=Number(value);
 return Number.isSafeInteger(number)&&number>=0?rupiahIntegerFormatter.format(number):"";
}
function readRupiahInput(field){
 const digits=rupiahInputDigits(field?.value);
 if(digits===null)return NaN;
 if(!digits||digits.length>15)return digits?NaN:0;
 const number=Number(digits);
 return Number.isSafeInteger(number)?number:NaN;
}
function bindRupiahField(id){
 const input=$(id);if(!input)return;
 input.addEventListener("input",()=>{
  const caret=input.selectionStart,old=input.value;
  const before=caret===null?null:(old.slice(0,caret).match(/\d/g)||[]).length;
  input.value=formatRupiahInput(old);
  if(before!==null&&document.activeElement===input){
   let newCaret=0,passed=0;
   for(;newCaret<input.value.length&&passed<before;newCaret++){
    if(/\d/.test(input.value[newCaret]))passed++;
   }
   try{input.setSelectionRange(newCaret,newCaret)}catch{}
  }
 });
 input.addEventListener("blur",()=>{input.value=formatRupiahInput(input.value)});
}

function dateLabel(v){return v?new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(v+"T00:00:00")):"-"}
function monthName(key){if(!key)return"Semua Bulan";const[y,m]=key.split("-").map(Number);return new Intl.DateTimeFormat("id-ID",{month:"long",year:"numeric"}).format(new Date(y,m-1,1))}
function todayInput(){const d=new Date(),pad=n=>String(n).padStart(2,"0");return`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
function currentMonthKey(){return todayInput().slice(0,7)}
function formatBytes(n){n=Number(n||0);if(n<1024)return`${n} B`;if(n<1048576)return`${(n/1024).toFixed(1)} KB`;return`${(n/1048576).toFixed(1)} MB`}

async function loadProfile(user){
  const r=await api.db.select("profiles",`select=id,full_name,role,is_active&id=eq.${encodeURIComponent(user.id)}&limit=1`);
  if(!r?.[0])throw new Error("Profil pengguna tidak ditemukan.");
  if(!r[0].is_active)throw new Error("Akun tidak aktif.");
  return r[0];
}
// Nama Bendahara dan gelar ditampilkan persis seperti penugasan resmi di profil.
// Tidak diambil dari akun yang mencetak nota atau dimodifikasi di sisi klien.
function financeTreasurerDisplayName(raw){
 return String(raw||"").trim();
}
function financeTreasurerSignature(){
 return officialTreasurerName||"__________________";
}
async function loadOfficialTreasurer(){
 const node=$("officialTreasurerName");
 try{
   const raw=await api.db.rpc("finance_get_treasurer_name",{});
   officialTreasurerName=financeTreasurerDisplayName(raw);
   if(!officialTreasurerName){
     node.textContent="Belum ada Bendahara aktif yang ditetapkan";
     console.warn("Tidak ada pemegang aktif jabatan PKM Bendahara & Sarpras.");
     return;
   }
   node.textContent=officialTreasurerName;
 }catch(error){
   officialTreasurerName="";
   node.textContent="Nama Bendahara gagal dimuat; coba muat ulang";
   console.warn("Gagal memuat Bendahara resmi:",error?.message||error);
 }
}

async function loadMenu(){
  const m=await api.db.rpc("get_my_modules",{})||[];
  const current=m.find(x=>x.code==="KEUANGAN");
  if(current){
    modulePerm=current;
  }else{
    const [view,create,update,del]=await Promise.all([
      api.db.rpc("has_module_permission",{p_module_code:"KEUANGAN",p_action:"view"}),
      api.db.rpc("has_module_permission",{p_module_code:"KEUANGAN",p_action:"create"}),
      api.db.rpc("has_module_permission",{p_module_code:"KEUANGAN",p_action:"update"}),
      api.db.rpc("has_module_permission",{p_module_code:"KEUANGAN",p_action:"delete"})
    ]);
    modulePerm={can_view:!!view,can_create:!!create,can_update:!!update,can_delete:!!del};
  }
  const fromPkm=new URLSearchParams(location.search).get("from")==="pkm";
  const menu=fromPkm?m.filter(x=>x.code!=="KEUANGAN"):m;
  $("sidebarMenu").innerHTML=menu.map(x=>`<a href="${routeFor(x.code)}" class="nav-item ${fromPkm&&x.code==="PKM_BENDAHARA_SARPRAS"?"active":(!fromPkm&&x.code==="KEUANGAN"?"active":"")}"><span class="nav-dot"></span><span>${esc(x.name)}</span></a>`).join("");
  document.querySelectorAll('.nav-item[href="#"]').forEach(a=>a.onclick=e=>{e.preventDefault();alert(`Modul "${a.textContent.trim()}" akan diaktifkan bertahap.`)});
}
async function loadMaster(){
  const [cat,plans,cls,rates]=await Promise.all([
    api.db.select("finance_categories","select=id,code,name,transaction_type,sort_order,is_active&is_active=eq.true&order=sort_order.asc,name.asc"),
    api.db.select("education_fee_plans","select=id,academic_year_id,name,default_amount,is_active,academic_years(name,is_active)&is_active=eq.true&order=created_at.desc"),
    api.db.select("classes","select=id,name,grade_level&is_active=eq.true&order=grade_level.asc,name.asc"),
    api.db.select("education_fee_class_rates","select=id,plan_id,class_id,amount&order=created_at.asc")
  ]);
  categories=cat||[];feePlans=plans||[];classes=cls||[];classRates=rates||[];
  activePlan=feePlans.find(p=>p.academic_years?.is_active)||feePlans[0]||null;
  renderCategoryOptions();
  renderExpenseCategoryOptions();
  $("studentClassFilter").innerHTML='<option value="">Semua Kelas</option>'+classes.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");
  $("rateClassSelect").innerHTML=classes.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");
  renderPlanCard();
  syncRateEditor();
}
// PostgREST dapat membatasi jumlah baris per respons. Ambil semua halaman agar
// pembayaran siswa dan Buku Kas tidak terpotong saat data semakin bertambah.
async function loadCompleteFinanceData(view,order){
  const size=500,maxPages=100,all=[];
  for(let pageNumber=0;pageNumber<maxPages;pageNumber++){
    const part=await api.db.select(view,
      "select=*&order="+order+"&limit="+size+"&offset="+(pageNumber*size));
    if(!Array.isArray(part))throw new Error("Format data "+view+" tidak valid.");
    all.push(...part);
    if(part.length<size)return all;
  }
  throw new Error("Data "+view+" melebihi batas laporan. Tidak boleh menampilkan jumlah parsial.");
}
async function loadData(){
  const [tx,b,p]=await Promise.all([
    loadCompleteFinanceData("v_finance_transactions_detail","transaction_date.desc,created_at.desc,id.desc"),
    loadCompleteFinanceData("v_student_education_bills","class_name_snapshot.asc,student_name.asc,id.asc"),
    loadCompleteFinanceData("v_student_education_payments","payment_date.desc,created_at.desc,id.desc")
  ]);
  rows=tx||[];bills=b||[];studentPayments=p||[];
  incomePaymentIndex=new Map(studentPayments.filter(x=>x.finance_transaction_id).map(x=>[x.finance_transaction_id,x]));
  clearExpenseCsvLink();
  clearIncomeCsvLink();
  renderMonthOptions();renderExpenseMonthOptions();renderIncomeOptions();render();renderStudentModule();renderRecapFilters();renderRecap();
}
function renderPlanCard(){
  $("planName").textContent=activePlan?.name||"Iuran Pendidikan";
  $("planYear").textContent=activePlan?.academic_years?.name?`Tahun Pelajaran ${activePlan.academic_years.name}`:"Tahun Pelajaran -";
  $("syncBillsBtn").style.display=canCreate()?"":"none";
  renderClassRates();
}

function setTab(name){
  document.querySelectorAll(".tabbtn").forEach(b=>b.classList.toggle("active",b.dataset.tab===name));
  $("tabRapbm").classList.toggle("hidden",name!=="rapbm");
  $("tabCashbook").classList.toggle("hidden",name!=="cashbook");
  $("tabIncome").classList.toggle("hidden",name!=="income");
  $("tabExpense").classList.toggle("hidden",name!=="expense");
  $("tabStudentpay").classList.toggle("hidden",name!=="studentpay");
  $("tabRecap").classList.toggle("hidden",name!=="recap");
  if(name==="recap")renderRecap();
}
document.querySelectorAll(".tabbtn").forEach(b=>b.onclick=()=>setTab(b.dataset.tab));


/* Pemasukan gabungan: pembayaran siswa dihitung sekali melalui finance_transactions.
   Hubungkan menggunakan ID finance_transaction_id, bukan kesamaan nominal/kategori.
   Jangan menambahkan nominal studentPayments ke saldo secara terpisah. */
let incomeCsvObjectUrl=null;
let incomePaymentIndex=new Map();
function incomePaymentForTransaction(r){
 return incomePaymentIndex.get(r.id)||null;
}
function incomeClassKey(p){
 return String(p?.class_id_snapshot||p?.class_name_snapshot||"");
}
function renderIncomeOptions(){
 const monthNode=$("incomeMonthFilter"),previousMonth=monthNode.value;
 const months=[...new Set(rows.filter(x=>x.transaction_type==="INCOME")
  .map(x=>String(x.transaction_date||"").slice(0,7)).filter(Boolean))].sort().reverse();
 monthNode.innerHTML='<option value="">Semua Bulan</option>'+
  months.map(k=>'<option value="'+esc(k)+'">'+esc(monthName(k))+'</option>').join("");
 monthNode.value=months.includes(previousMonth)?previousMonth:"";
 const classNode=$("incomeClassFilter"),previousClass=classNode.value;
 const found=new Map();
 for(const p of studentPayments){
  const key=incomeClassKey(p);
  if(key&&!found.has(key))found.set(key,String(p.class_name_snapshot||"Tanpa Kelas"));
 }
 const options=[...found].sort((a,b)=>
  new Intl.Collator("id-ID",{numeric:true,sensitivity:"base"}).compare(a[1],b[1]));
 classNode.innerHTML='<option value="">Semua Kelas</option>'+
  options.map(([id,name])=>'<option value="'+esc(id)+'">'+esc(name)+'</option>').join("");
 classNode.value=found.has(previousClass)?previousClass:"";
}
function filteredIncome({ignoreStatus=false}={}){
 const q=$("incomeSearch").value.trim().toLocaleLowerCase("id-ID"),
  month=$("incomeMonthFilter").value,source=$("incomeSourceFilter").value,
  cls=$("incomeClassFilter").value,status=$("incomeStatusFilter").value;
 return rows.filter(r=>{
  if(r.transaction_type!=="INCOME")return false;
  const payment=incomePaymentForTransaction(r);
  if(month&&!String(r.transaction_date||"").startsWith(month))return false;
  if(!ignoreStatus&&status&&r.status!==status)return false;
  if(source==="STUDENT"&&!payment)return false;
  if(source==="OTHER"&&payment)return false;
  if(cls&&(!payment||incomeClassKey(payment)!==cls))return false;
  const hay=[r.description,r.reference_number,r.category_name,r.account_name,
    r.created_by_name,payment?.student_name,payment?.class_name_snapshot,
    payment?.receipt_number,payment?.nisn,payment?.academic_year_name]
    .map(x=>String(x||"")).join(" ").toLocaleLowerCase("id-ID");
  return !q||hay.includes(q);
 });
}
function incomeTotals(data){
 const posted=data.filter(r=>r.status==="POSTED"),student=posted.filter(r=>!!incomePaymentForTransaction(r));
 const sum=list=>list.reduce((v,r)=>v+Number(r.amount||0),0);
 return {
  total:sum(posted),
  student:sum(student),
  other:sum(posted.filter(r=>!incomePaymentForTransaction(r))),
  cash:sum(posted.filter(r=>r.account_type==="CASH")),
  bank:sum(posted.filter(r=>r.account_type==="BANK")),
  payments:student.length,posted:posted.length,
  voided:data.filter(r=>r.status==="VOID").length
 };
}
function incomeSyncIssues(){
 const byId=new Map(rows.map(r=>[r.id,r])),issues=[];
 for(const p of studentPayments){
  const finance=byId.get(p.finance_transaction_id);
  if(!finance){
   issues.push("Pembayaran "+(p.receipt_number||p.id)+" belum mempunyai transaksi Buku Kas.");continue;
  }
  if(finance.transaction_type!=="INCOME"||
     finance.category_code!=="IURAN"||finance.status!==p.status||
     Math.abs(Number(finance.amount||0)-Number(p.amount||0))>0.005||
     finance.transaction_date!==p.payment_date||
     finance.account_type!==p.account_type){
   issues.push("Data pembayaran "+(p.receipt_number||p.id)+" tidak sesuai dengan Buku Kas.");
  }
 }
 const manuallyCategorized=rows.filter(r=>r.transaction_type==="INCOME"&&r.category_code==="IURAN"&&!incomePaymentForTransaction(r));
 if(manuallyCategorized.length)issues.push(manuallyCategorized.length+
  " pemasukan Iuran Pendidikan tidak terhubung dengan pembayaran siswa, perlu diperiksa agar tidak ganda.");
 return issues;
}
function incomeSourceLabel(r){
 return incomePaymentForTransaction(r)?"Pembayaran Siswa":"Pemasukan Lain";
}
function renderIncomeClassSummary(){
 const valid=filteredIncome({ignoreStatus:true}).filter(r=>r.status==="POSTED");
 const mapped=new Map();
 for(const r of valid){
  const p=incomePaymentForTransaction(r);
  if(!p)continue;
  const key=incomeClassKey(p)||String(p.class_name_snapshot||"-");
  if(!mapped.has(key))mapped.set(key,{
   name:p.class_name_snapshot||"Tanpa Kelas",amount:0,records:0,students:new Set()
  });
  const d=mapped.get(key);
  d.amount+=Number(r.amount||0);d.records++;d.students.add(String(p.student_id||p.bill_id||p.id));
 }
 const values=[...mapped.values()].sort((a,b)=>
   new Intl.Collator("id-ID",{numeric:true,sensitivity:"base"}).compare(a.name,b.name));
 $("incomeClassGrid").innerHTML=values.length?values.map(x=>
  '<article class="income-class-card"><span>'+esc(x.name)+' · '+x.records+
  ' pembayaran · '+x.students.size+' siswa</span><strong>'+esc(money(x.amount))+
  '</strong></article>').join(""):
  '<div class="income-empty">Belum ada pembayaran siswa yang dibukukan pada periode/filter ini.</div>';
}
function renderIncomes(){
 const data=filteredIncome(),t=incomeTotals(data);
 $("incomeStatTotal").textContent=money(t.total);
 $("incomeStatStudent").textContent=money(t.student);
 $("incomeStatOther").textContent=money(t.other);
 $("incomeStatCash").textContent=money(t.cash);
 $("incomeStatBank").textContent=money(t.bank);
 $("incomeOtherBtn").style.display=canCreate()?"":"none";
 const totalVoid=rows.filter(r=>r.transaction_type==="INCOME"&&r.status==="VOID").length;
 $("incomeSummaryLine").textContent=data.length+" transaksi ditampilkan · "+t.posted+
  " dibukukan ("+t.payments+" pembayaran siswa) · "+t.voided+
  " dibatalkan dalam filter · "+totalVoid+" pemasukan dibatalkan pada seluruh periode. "+
  "Total pemasukan dibukukan "+money(t.total)+". Pembayaran siswa yang dibatalkan tidak menambah saldo.";
 const issues=incomeSyncIssues(),warning=$("incomeSyncNotice");
 warning.hidden=!issues.length;
 warning.textContent=issues.length?"⚠ Perlu pemeriksaan sinkronisasi pembayaran dan Buku Kas ("+
  issues.length+" temuan). "+issues.slice(0,2).join(" ")+" Periksa bersama Bendahara; jangan menambah transaksi manual untuk mengatasinya.":"";
 if(!data.length){
  $("incomeTableBody").innerHTML='<tr><td colspan="9"><div class="income-empty">Belum ada pemasukan dibukukan sesuai filter. Jika ada pembayaran siswa yang dibatalkan, pilih status Dibatalkan atau Semua Status.</div></td></tr>';
  $("incomeCards").innerHTML='<div class="income-empty">Belum ada pemasukan sesuai filter.</div>';
 }else{
  $("incomeTableBody").innerHTML=data.map((r,i)=>{
   const p=incomePaymentForTransaction(r),linked=!!p;
   return '<tr><td>'+(i+1)+'</td><td>'+esc(dateLabel(r.transaction_date))+
    '</td><td><b>'+esc(incomeSourceLabel(r))+'</b><br>'+esc(r.category_name||"-")+
    '</td><td>'+(linked?'<b>'+esc(p.student_name||"-")+'</b> · '+esc(p.class_name_snapshot||"-")+'<br>':"")+
    esc(r.description||"-")+'</td><td>'+esc(p?.receipt_number||"-")+
    '</td><td>'+storageLabel(r)+'</td><td>'+typeBadge(r)+
    '</td><td>'+amountHtml(r)+'</td><td>'+
    (linked?'<button type="button" class="mini-btn" data-income-payment="'+esc(r.id)+'">Lihat Pembayaran</button>':
      canUpdate()?'<button type="button" class="mini-btn" data-income-edit="'+esc(r.id)+'">Edit</button>':"—")+
    '</td></tr>';
  }).join("");
  $("incomeCards").innerHTML=data.map(r=>{
   const p=incomePaymentForTransaction(r),linked=!!p;
   return '<article class="finance-card"><div class="finance-card-top"><b>'+
    esc(incomeSourceLabel(r))+'</b>'+amountHtml(r)+'</div><h4>'+
    esc(linked?p.student_name:r.category_name||"-")+'</h4><p>'+
    esc(linked?(p.class_name_snapshot||"-")+" · "+(p.receipt_number||""):r.description||"-")+
    '</p><p>'+esc(dateLabel(r.transaction_date))+' · '+storageLabel(r)+
    ' · '+(r.status==="POSTED"?"Dibukukan":"Dibatalkan")+'</p><div class="row-actions">'+
    (linked?'<button class="mini-btn" data-income-payment="'+esc(r.id)+'">Lihat Pembayaran</button>':
      canUpdate()?'<button class="mini-btn" data-income-edit="'+esc(r.id)+'">Edit</button>':"")+
    '</div></article>';
  }).join("");
 }
 document.querySelectorAll("[data-income-payment]").forEach(x=>x.onclick=()=>openLinkedStudentPayment(x.dataset.incomePayment));
 document.querySelectorAll("[data-income-edit]").forEach(x=>x.onclick=()=>openEdit(x.dataset.incomeEdit));
 renderIncomeClassSummary();
}
function clearIncomeCsvLink(){
 if(incomeCsvObjectUrl){URL.revokeObjectURL(incomeCsvObjectUrl);incomeCsvObjectUrl=null}
 const link=$("incomeManualDownloadLink");
 if(link){link.hidden=true;link.removeAttribute("href")}
}
function incomeCsvRows(data){
 const t=incomeTotals(data),month=$("incomeMonthFilter").value;
 const lines=[
  ["MA NURUL ISLAM KARANGCEMPAKA","REKAP PEMASUKAN KEUANGAN"],
  ["Periode",month?monthName(month):"Semua Bulan"],
  ["Keterangan","Pembayaran siswa terhubung otomatis ke Buku Kas. Jangan dicatat ulang."],
  ["Keterangan","Transaksi Batal / VOID tidak menambah saldo."],
  [],
  ["No.","Tanggal","Sumber","Kategori","Nama Siswa","Kelas","Nomor Nota",
   "Uraian","Kas/Bank","Rekening","Status","Nominal (Rp)","Pencatat"]
 ];
 data.forEach((r,i)=>{
  const p=incomePaymentForTransaction(r);
  lines.push([i+1,r.transaction_date,incomeSourceLabel(r),r.category_name||"",
   p?.student_name||"",p?.class_name_snapshot||"",p?.receipt_number||"",
   r.description||"",r.account_type==="CASH"?"Tunai":"Rekening",
   r.account_name||"",r.status==="POSTED"?"Dibukukan":"Dibatalkan",
   Number(r.amount||0),r.created_by_name||""]);
 });
 lines.push(["","TOTAL PEMASUKAN DIBUKUKAN","","","","","","","","","",t.total,""]);
 lines.push(["","Dari Pembayaran Siswa","","","","","","","","","",t.student,""]);
 lines.push(["","Pemasukan Lain","","","","","","","","","",t.other,""]);
 return lines;
}
function exportIncomeCsv(){
 const data=filteredIncome();
 if(!data.length){alert("Belum ada pemasukan sesuai filter yang dapat diunduh.");return}
 const csv="\ufeffsep=;\r\n"+incomeCsvRows(data).map(row=>row.map(expenseCsvCell).join(";")).join("\r\n");
 clearIncomeCsvLink();
 incomeCsvObjectUrl=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
 const link=$("incomeManualDownloadLink");
 link.href=incomeCsvObjectUrl;
 link.download="rekap-pemasukan-pembayaran-siswa-"+($("incomeMonthFilter").value||"semua-periode")+".csv";
 link.hidden=false;link.click();
}


function printIncomeReport(){
 const data=filteredIncome();
 if(!data.length){alert("Belum ada pemasukan sesuai filter untuk dicetak.");return}
 const totals=incomeTotals(data),period=$("incomeMonthFilter").value?
  monthName($("incomeMonthFilter").value):"Semua Bulan";
 const popup=window.open("","_blank");
 if(!popup){alert("Jendela cetak diblokir. Izinkan pop-up untuk SIMANIS.");return}
 const rowsHtml=data.map((r,i)=>{
  const p=incomePaymentForTransaction(r);
  return '<tr><td>'+(i+1)+'</td><td>'+esc(dateLabel(r.transaction_date))+
   '</td><td>'+esc(incomeSourceLabel(r))+'</td><td>'+esc(r.category_name||"")+'</td>'+
   '<td>'+esc(p?.student_name||"-")+'</td><td>'+esc(p?.class_name_snapshot||"-")+
   '</td><td>'+esc(p?.receipt_number||"-")+'</td><td>'+
   esc(r.status==="POSTED"?"Dibukukan":"Dibatalkan")+'</td>'+
   '<td style="text-align:right">'+esc(money(r.amount))+'</td></tr>';
 }).join("");
 const html='<!doctype html><html lang="id"><head><meta charset="utf-8">'+
  '<title>Rekap Pemasukan dan Pembayaran Siswa — '+esc(period)+'</title>'+
  '<style>@page{size:A4 landscape;margin:12mm}body{font:10px Arial,sans-serif;color:#233}'+
  'h2,h3,p{text-align:center;margin:7px 0}h2{font-size:16px}h3{font-size:12px}'+
  '.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin:15px 0}'+
  '.sum{border:1px solid #b7cabc;padding:9px}.sum b{display:block;font-size:14px;margin-top:5px}'+
  'table{width:100%;border-collapse:collapse;font-size:8px}th,td{border:1px solid #bbb;padding:6px}'+
  'th{background:#eef5ef}tr{break-inside:avoid}'+
  '.foot{display:flex;justify-content:space-between;margin-top:25px;text-align:center}'+
  '.foot div{width:230px}.space{height:52px}.note{text-align:left;margin-top:12px;font-size:9px}'+
  '</style></head><body><h2>MA NURUL ISLAM KARANGCEMPAKA</h2>'+
  '<h3>REKAP PEMASUKAN TERMASUK PEMBAYARAN SISWA</h3><p>Periode: '+esc(period)+'</p>'+
  '<div class="summary"><div class="sum">Total Pemasukan Dibukukan<b>'+
  esc(money(totals.total))+'</b></div><div class="sum">Dari Pembayaran Siswa<b>'+
  esc(money(totals.student))+'</b></div><div class="sum">Pemasukan Lain<b>'+
  esc(money(totals.other))+'</b></div></div>'+
  '<table><thead><tr><th>No.</th><th>Tanggal</th><th>Sumber</th><th>Kategori</th>'+
  '<th>Nama Siswa</th><th>Kelas</th><th>Nomor Nota</th><th>Status</th>'+
  '<th>Nominal (Rp)</th></tr></thead><tbody>'+rowsHtml+'</tbody></table>'+
  '<p class="note">Sumber data: Buku Kas SIMANIS. Setiap pembayaran siswa yang dibukukan'+
  ' terhitung satu kali sebagai Pemasukan – Iuran Pendidikan. Transaksi dibatalkan'+
  ' (VOID) tidak menambah saldo.</p>'+
  '<div class="foot"><div>Mengetahui,<br>Kepala Madrasah<div class="space"></div>'+
  '__________________</div><div>Bendahara<div class="space"></div><b>'+
  esc(financeTreasurerSignature())+'</b></div></div></body></html>';
 popup.document.write(html);popup.document.close();
 setTimeout(()=>popup.print(),450);
}

/* Pengeluaran memakai tabel finance_transactions yang sama dengan Buku Kas. */
function renderExpenseCategoryOptions(){
 const field=$("expenseCategoryFilter"),previous=field.value;
 const cats=categories.filter(x=>["EXPENSE","BOTH"].includes(x.transaction_type));
 field.innerHTML='<option value="">Semua Kategori Pengeluaran</option>'+
  cats.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>').join("");
 field.value=cats.some(c=>c.id===previous)?previous:"";
}
function renderExpenseMonthOptions(){
 const field=$("expenseMonthFilter"),previous=field.value;
 const months=[...new Set(rows.filter(r=>r.transaction_type==="EXPENSE")
  .map(r=>String(r.transaction_date||"").slice(0,7)).filter(Boolean))].sort().reverse();
 field.innerHTML='<option value="">Semua Bulan</option>'+
  months.map(k=>'<option value="'+esc(k)+'">'+esc(monthName(k))+'</option>').join("");
 field.value=months.includes(previous)?previous:"";
}
function filteredExpenses(){
 const q=$("expenseSearch").value.trim().toLocaleLowerCase("id-ID"),
  month=$("expenseMonthFilter").value,category=$("expenseCategoryFilter").value,
  status=$("expenseStatusFilter").value;
 return rows.filter(r=>r.transaction_type==="EXPENSE"
  &&(!month||String(r.transaction_date||"").startsWith(month))
  &&(!category||r.category_id===category)
  &&(!status||r.status===status)
  &&(!q||[r.category_name,r.description,r.reference_number,r.account_name,r.created_by_name]
   .join(" ").toLocaleLowerCase("id-ID").includes(q)));
}
function expenseTotals(data){
 const posted=data.filter(r=>r.status==="POSTED");
 return {
  total:posted.reduce((a,r)=>a+Number(r.amount||0),0),
  cash:posted.filter(r=>r.account_type==="CASH").reduce((a,r)=>a+Number(r.amount||0),0),
  bank:posted.filter(r=>r.account_type==="BANK").reduce((a,r)=>a+Number(r.amount||0),0),
  posted:posted.length,
  voided:data.filter(r=>r.status==="VOID").length
 };
}
function renderExpenses(){
 const data=filteredExpenses(),summary=expenseTotals(data);
 $("addExpenseBtn").style.display=canCreate()?"":"none";
 $("expenseStatTotal").textContent=money(summary.total);
 $("expenseStatCash").textContent=money(summary.cash);
 $("expenseStatBank").textContent=money(summary.bank);
 $("expenseStatCount").textContent=summary.posted;
 $("expenseSummaryLine").textContent=data.length+" transaksi ditampilkan · "+
  summary.posted+" dibukukan · "+summary.voided+
  " dibatalkan. Hanya transaksi dibukukan mengurangi saldo Buku Kas.";
 if(!data.length){
  $("expenseTableBody").innerHTML='<tr><td colspan="8"><div class="expense-empty">Belum ada pengeluaran yang sesuai filter.</div></td></tr>';
  $("expenseCards").innerHTML='<div class="expense-empty">Belum ada pengeluaran yang sesuai filter.</div>';
  return;
 }
 $("expenseTableBody").innerHTML=data.map((r,i)=>
  '<tr><td>'+(i+1)+'</td><td>'+esc(dateLabel(r.transaction_date))+
  '</td><td><b>'+esc(r.category_name||"-")+'</b><br>'+esc(r.description||"-")+
  (r.reference_number?'<br><small>Referensi: '+esc(r.reference_number)+'</small>':"")+
  '</td><td>'+storageLabel(r)+'</td><td>'+typeBadge(r)+
  '</td><td>'+amountHtml(r)+'</td><td>'+(r.receipt_path?
   '<button class="mini-btn" data-expense-receipt="'+esc(r.id)+'">Buka Bukti</button>':"—")+
  '</td><td>'+(canUpdate()?'<button class="mini-btn" data-expense-edit="'+esc(r.id)+'">Edit</button>':"—")+'</td></tr>'
 ).join("");
 $("expenseCards").innerHTML=data.map(r=>
  '<article class="finance-card"><div class="finance-card-top"><span>'+typeBadge(r)+
  '</span><span>'+amountHtml(r)+'</span></div><h4>'+esc(r.category_name||"-")+
  '</h4><p>'+esc(r.description||"-")+'</p><p>'+esc(dateLabel(r.transaction_date))+
  ' · '+storageLabel(r)+'</p><div class="row-actions">'+(r.receipt_path?
   '<button class="mini-btn" data-expense-receipt="'+esc(r.id)+'">Buka Bukti</button>':"")+
  (canUpdate()?'<button class="mini-btn" data-expense-edit="'+esc(r.id)+'">Edit</button>':"")+
  '</div></article>').join("");
 document.querySelectorAll("[data-expense-edit]").forEach(x=>x.onclick=()=>openEdit(x.dataset.expenseEdit));
 document.querySelectorAll("[data-expense-receipt]").forEach(x=>x.onclick=()=>openReceipt(x.dataset.expenseReceipt));
}
function expenseCsvCell(value){
 let v=String(value??"").replace(/[\r\n\u0000-\u001f]+/g," ").trim();
 if(/^[\s]*[=+\-@]/.test(v))v="'"+v;
 return '"'+v.replaceAll('"','""')+'"';
}
function expenseCsvRows(data){
 const sum=expenseTotals(data);
 const lines=[
  ["MA NURUL ISLAM","REKAP PENGELUARAN"],
  ["Periode",$("expenseMonthFilter").value?monthName($("expenseMonthFilter").value):"Semua Bulan"],
  ["Catatan","VOID tidak mengurangi saldo Buku Kas."],[],
  ["No","Tanggal","Status","Kategori","Uraian","Penyimpanan","Rekening","Referensi","Nominal (Rp)","Pencatat"]
 ];
 data.forEach((r,i)=>lines.push([
  i+1,r.transaction_date,r.status==="POSTED"?"Dibukukan":"Dibatalkan",
  r.category_name||"",r.description||"",r.account_type==="CASH"?"Tunai":"Bank",
  r.account_name||"",r.reference_number||"",Number(r.amount||0),r.created_by_name||""
 ]));
 lines.push(["","TOTAL PENGELUARAN DIBUKUKAN","","","","","","",sum.total,""]);
 return lines;
}
function clearExpenseCsvLink(){
 if(expenseCsvObjectUrl){URL.revokeObjectURL(expenseCsvObjectUrl);expenseCsvObjectUrl=null}
 const link=$("expenseManualDownloadLink");
 if(link){link.hidden=true;link.removeAttribute("href")}
}
function exportExpenseCsv(){
 const data=filteredExpenses();
 if(!data.length){alert("Belum ada transaksi pengeluaran untuk diunduh.");return}
 const csv="\ufeffsep=;\r\n"+expenseCsvRows(data).map(r=>r.map(expenseCsvCell).join(";")).join("\r\n");
 clearExpenseCsvLink();
 expenseCsvObjectUrl=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
 const link=$("expenseManualDownloadLink");
 link.href=expenseCsvObjectUrl;
 link.download="pengeluaran-keuangan-"+($("expenseMonthFilter").value||"semua-periode")+".csv";
 link.hidden=false;
 link.click();
}


function printExpenses(){
 const data=filteredExpenses();
 if(!data.length){alert("Belum ada transaksi pengeluaran untuk dicetak.");return}
 const total=expenseTotals(data),period=$("expenseMonthFilter").value?
  monthName($("expenseMonthFilter").value):"Semua Bulan";
 const printWindow=window.open("","_blank");
 if(!printWindow){alert("Jendela cetak diblokir. Izinkan pop-up pada SIMANIS.");return}
 const rowsHtml=data.map((r,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(dateLabel(r.transaction_date))+
  '</td><td>'+esc(r.status==="POSTED"?"Dibukukan":"Dibatalkan")+'</td><td>'+
  esc(r.category_name||"")+'</td><td>'+esc(r.description||"")+'</td><td>'+
  esc(r.account_type==="CASH"?"Tunai":r.account_name||"Bank")+
  '</td><td style="text-align:right">'+esc(money(r.amount))+'</td></tr>').join("");
 printWindow.document.write('<!doctype html><html lang="id"><head><meta charset="utf-8">'+
  '<title>Rekap Pengeluaran — '+esc(period)+'</title><style>'+
  '@page{size:A4 landscape;margin:12mm}body{font:10px Arial,sans-serif;color:#222}'+
  'h2,h3,p{text-align:center;margin:7px 0}h2{font-size:17px}h3{font-size:13px}'+
  'table{width:100%;border-collapse:collapse;margin-top:15px}th,td{border:1px solid #aaa;padding:7px;text-align:left}'+
  'th{background:#f1f1f1}tr{break-inside:avoid}.stats{display:flex;gap:14px;margin:15px 0}'+
  '.stats div{border:1px solid #ccc;flex:1;padding:10px}.stats b{display:block;font-size:14px;margin-top:5px}'+
  '.foot{display:flex;justify-content:space-between;margin-top:30px}.signature{width:220px;text-align:center}.sign-space{height:55px}'+
  '</style></head><body><h2>MA NURUL ISLAM KARANGCEMPAKA</h2>'+
  '<h3>REKAP PENGELUARAN KEUANGAN</h3><p>Periode: '+esc(period)+'</p>'+
  '<div class="stats"><div>Total Pengeluaran Dibukukan<b>'+esc(money(total.total))+'</b></div>'+
  '<div>Pengeluaran Tunai<b>'+esc(money(total.cash))+'</b></div>'+
  '<div>Pengeluaran Bank<b>'+esc(money(total.bank))+'</b></div></div>'+
  '<table><thead><tr><th>No.</th><th>Tanggal</th><th>Status</th><th>Kategori</th><th>Uraian</th>'+
  '<th>Penyimpanan</th><th>Nominal</th></tr></thead><tbody>'+rowsHtml+'</tbody></table>'+
  '<p style="text-align:left;font-size:9px;margin-top:10px">Transaksi dibatalkan (VOID) tidak mengurangi saldo Buku Kas.</p>'+
  '<div class="foot"><div class="signature">Mengetahui,<br>Kepala Madrasah'+
  '<div class="sign-space"></div>__________________</div>'+
  '<div class="signature">Bendahara<div class="sign-space"></div><b>'+
  esc(financeTreasurerSignature())+'</b></div></div></body></html>');
 printWindow.document.close();
 setTimeout(()=>printWindow.print(),450);
}

/* ==========================================================
   BUKU KAS V1
========================================================== */
function renderCategoryOptions(){
  const type=$("transactionType")?.value||"INCOME";
  const existing=rows.find(r=>r.id===$("transactionId").value);
  const list=categories.filter(c=>
    (c.transaction_type===type||c.transaction_type==="BOTH")&&
    // Iuran siswa harus dibuat dari menu Pembayaran Siswa saja.
    // Pertahankan kategori jika sedang mengedit data manual lama.
    !(type==="INCOME"&&c.code==="IURAN"&&c.id!==existing?.category_id));
  if($("category"))$("category").innerHTML=list.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");
  const hint=$("incomeCategoryHint");
  if(hint)hint.style.display=type==="INCOME"?"block":"none";
  $("categoryFilter").innerHTML='<option value="">Semua Kategori</option>'+categories.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");
}
function renderMonthOptions(){
  const current=$("monthFilter").value;
  const keys=[...new Set([currentMonthKey(),...rows.map(r=>String(r.transaction_date||"").slice(0,7)).filter(Boolean)])].sort().reverse();
  $("monthFilter").innerHTML='<option value="">Semua Bulan</option>'+keys.map(k=>`<option value="${k}">${esc(monthName(k))}</option>`).join("");
  if(current&&keys.includes(current))$("monthFilter").value=current;else $("monthFilter").value=currentMonthKey();
}
function activeRows(){return rows.filter(r=>r.status==="POSTED")}
function filtered(){
  const q=$("searchInput").value.trim().toLowerCase(),month=$("monthFilter").value,type=$("typeFilter").value,cat=$("categoryFilter").value,acc=$("accountFilter").value;
  return rows.filter(r=>{
    const hay=`${r.description||""} ${r.reference_number||""} ${r.category_name||""} ${r.account_name||""} ${r.created_by_name||""}`.toLowerCase();
    return(!q||hay.includes(q))&&(!month||String(r.transaction_date||"").startsWith(month))&&(!type||r.transaction_type===type)&&(!cat||r.category_id===cat)&&(!acc||r.account_type===acc);
  });
}
function periodPosted(){const month=$("monthFilter").value;return activeRows().filter(r=>!month||String(r.transaction_date||"").startsWith(month))}
function calcBalance(list){return list.reduce((s,r)=>s+Number(r.signed_amount||0),0)}
function renderStats(){
  const all=activeRows(),period=periodPosted();
  $("statBalance").textContent=money(calcBalance(all));
  $("statCash").textContent=money(calcBalance(all.filter(r=>r.account_type==="CASH")));
  $("statBank").textContent=money(calcBalance(all.filter(r=>r.account_type==="BANK")));
  $("statIncome").textContent=money(period.filter(r=>r.transaction_type==="INCOME").reduce((s,r)=>s+Number(r.amount||0),0));
  $("statExpense").textContent=money(period.filter(r=>r.transaction_type==="EXPENSE").reduce((s,r)=>s+Number(r.amount||0),0));
  const label=$("monthFilter").value?monthName($("monthFilter").value):"Semua periode";$("incomeSub").textContent=label;$("expenseSub").textContent=label;
}
function typeBadge(r){if(r.status==="VOID")return'<span class="badge-soft badge-void">BATAL</span>';return r.transaction_type==="INCOME"?'<span class="badge-soft badge-in">PEMASUKAN</span>':'<span class="badge-soft badge-out">PENGELUARAN</span>'}
function amountHtml(r){const cls=r.status==="VOID"?"money-void":(r.transaction_type==="INCOME"?"money-in":"money-out"),sign=r.transaction_type==="INCOME"?"+":"−";return`<span class="${cls}">${sign} ${money(r.amount)}</span>`}
function storageLabel(r){return r.account_type==="CASH"?"Cash / Tunai":`Rekening${r.account_name?` · ${esc(r.account_name)}`:""}`}
function linkedStudentPaymentByFinanceId(financeId){
  return incomePaymentIndex.get(financeId)||null;
}
function isStudentPaymentTransaction(r){
  return !!linkedStudentPaymentByFinanceId(r.id);
}
function openLinkedStudentPayment(financeId){
  const payment=linkedStudentPaymentByFinanceId(financeId);
  if(!payment){alert("Data pembayaran siswa terkait tidak ditemukan.");return}
  const bill=bills.find(b=>b.id===payment.bill_id);
  if(!bill){alert("Tagihan siswa tidak ditemukan dalam data yang dimuat.");return}
  // Riwayat pembayaran tahun sebelumnya harus membuka rencana/tagihan asal.
  const assignedPlan=feePlans.find(p=>p.id===bill.plan_id);
  if(!assignedPlan){alert("Rencana Iuran Pendidikan untuk pembayaran ini belum tersedia.");return}
  activePlan=assignedPlan;
  setTab("studentpay");
  selectedBillId=bill.id;
  $("studentClassFilter").value=bill.class_id_snapshot||"";
  renderStudentSelect();
  $("studentFilter").value=bill.student_id||"";
  renderStudentModule();
  setTimeout(()=>$("studentDetail")?.scrollIntoView({behavior:"smooth",block:"start"}),50);
}
function render(){
  renderStats();renderExpenses();renderIncomes();const data=filtered(),posted=data.filter(r=>r.status==="POSTED");
  const income=posted.filter(r=>r.transaction_type==="INCOME").reduce((s,r)=>s+Number(r.amount||0),0),expense=posted.filter(r=>r.transaction_type==="EXPENSE").reduce((s,r)=>s+Number(r.amount||0),0);
  $("summaryLine").textContent=`${data.length} transaksi · Pemasukan ${money(income)} · Pengeluaran ${money(expense)} · Selisih ${money(income-expense)}`;
  $("addBtn").style.display=canCreate()?"":"none";
  $("addExpenseQuickBtn").style.display=canCreate()?"":"none";
  if(!data.length){$("financeTableBody").innerHTML='<tr><td colspan="8"><div class="empty-state">Belum ada transaksi yang cocok.</div></td></tr>';$("financeCards").innerHTML='<div class="empty-state">Belum ada transaksi yang cocok.</div>';return}
  $("financeTableBody").innerHTML=data.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(dateLabel(r.transaction_date))}</td><td>${typeBadge(r)}</td><td><b>${esc(r.category_name)}</b>${isStudentPaymentTransaction(r)?` <span class="badge-soft badge-in">TERHUBUNG SISWA</span>`:""}<br>${esc(r.description)}${r.reference_number?`<br><span style="color:#7b8781">Ref: ${esc(r.reference_number)}</span>`:""}</td><td>${storageLabel(r)}</td><td>${amountHtml(r)}</td><td>${r.receipt_path?`<button class="mini-btn" data-open-receipt="${r.id}">Buka</button>`:"-"}</td><td>${isStudentPaymentTransaction(r)?`<button class="mini-btn" data-open-student-payment="${r.id}">Pembayaran Siswa</button>`:(canUpdate()?`<button class="mini-btn" data-edit="${r.id}">Edit</button>`:"")}</td></tr>`).join("");
  $("financeCards").innerHTML=data.map(r=>`<article class="finance-card"><div class="finance-card-top"><div>${typeBadge(r)}</div><div>${amountHtml(r)}</div></div><h4>${esc(r.category_name)}</h4><p>${esc(r.description)}</p><p><b>${esc(dateLabel(r.transaction_date))}</b> · ${storageLabel(r)}</p><div class="row-actions">${r.receipt_path?`<button class="mini-btn" data-open-receipt="${r.id}">Buka Bukti</button>`:""}${isStudentPaymentTransaction(r)?`<button class="mini-btn" data-open-student-payment="${r.id}">Pembayaran Siswa</button>`:(canUpdate()?`<button class="mini-btn" data-edit="${r.id}">Edit</button>`:"")}</div></article>`).join("");
  document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>openEdit(b.dataset.edit));
  document.querySelectorAll("[data-open-receipt]").forEach(b=>b.onclick=()=>openReceipt(b.dataset.openReceipt));
  document.querySelectorAll("[data-open-student-payment]").forEach(b=>b.onclick=()=>openLinkedStudentPayment(b.dataset.openStudentPayment));
}
function toggleBank(){const bank=$("accountType").value==="BANK";$("bankNameWrap").classList.toggle("hidden",!bank);$("accountName").required=bank;if(!bank)$("accountName").value=""}
function receiptBox(r){if(!r?.receipt_path){$("receiptCurrent").innerHTML='<span class="field-hint">Belum ada bukti tersimpan.</span>';return}$("receiptCurrent").innerHTML=`<div class="receipt-box"><div><b style="font-size:10px">📎 ${esc(r.receipt_name||"Bukti transaksi")}</b><div class="receipt-meta">${formatBytes(r.receipt_size)}</div></div><button class="mini-btn" type="button" id="openCurrentReceipt">Buka</button></div>`;$("openCurrentReceipt").onclick=()=>openReceipt(r.id)}
function openAdd(type="INCOME"){if(!canCreate())return;$("form").reset();$("transactionId").value="";$("oldReceiptPath").value="";$("oldReceiptName").value="";$("modalTitle").textContent=type==="EXPENSE"?"Catat Pengeluaran":"Catat Pemasukan";$("transactionDate").value=todayInput();$("transactionType").value=type==="EXPENSE"?"EXPENSE":"INCOME";$("accountType").value="CASH";$("status").value="POSTED";renderCategoryOptions();toggleBank();receiptBox(null);$("deleteBtn").style.display="none";$("formMessage").textContent="";$("modal").classList.remove("hidden")}
function openEdit(id){const r=rows.find(x=>x.id===id);if(!r||!canUpdate())return;
  if(isStudentPaymentTransaction(r)){
    alert("Transaksi ini berasal dari Pembayaran Siswa. Edit/batalkan dari menu Pembayaran Siswa agar Buku Kas dan cicilan tetap sinkron.");
    openLinkedStudentPayment(r.id);
    return;
  }$("form").reset();$("transactionId").value=r.id;$("oldReceiptPath").value=r.receipt_path||"";$("oldReceiptName").value=r.receipt_name||"";$("modalTitle").textContent="Edit Transaksi";$("transactionDate").value=r.transaction_date||"";$("transactionType").value=r.transaction_type||"INCOME";renderCategoryOptions();$("category").value=r.category_id||"";$("amount").value=rupiahFromNumber(r.amount);$("accountType").value=r.account_type||"CASH";toggleBank();$("accountName").value=r.account_name||"";$("referenceNumber").value=r.reference_number||"";$("description").value=r.description||"";$("status").value=r.status||"POSTED";receiptBox(r);$("deleteBtn").style.display=canDelete()?"":"none";$("formMessage").textContent="";$("modal").classList.remove("hidden")}
function closeModal(){$("modal").classList.add("hidden")}

async function restWrite(path,method,body,prefer="return=representation"){
  const session=await api.auth.getSession();if(!session?.access_token)throw new Error("Sesi login tidak ditemukan.");
  const cfg=window.SIMANIS_CONFIG;
  const res=await fetch(`${cfg.SUPABASE_URL.replace(/\/$/,"")}/rest/v1/${path}`,{method,headers:{apikey:cfg.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json",Prefer:prefer},body:body===undefined?undefined:JSON.stringify(body)});
  const text=await res.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text}if(!res.ok)throw new Error(data?.message||data?.error||text||`HTTP ${res.status}`);return data;
}
function encodedPath(path){return path.split("/").map(encodeURIComponent).join("/")}
function ext(name){const p=String(name||"").split(".");return p.length>1?p.pop().toLowerCase().replace(/[^a-z0-9]/g,""):"bin"}
function mime(file){return file.type||({pdf:"application/pdf",jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp"}[ext(file.name)]||"")}
function validateReceipt(file){const m=mime(file);if(!ALLOWED_MIME.has(m))throw new Error("Bukti harus PDF, JPG, PNG, atau WEBP.");if(file.size>MAX_FILE_SIZE)throw new Error("Ukuran bukti lebih dari 10 MB.");return m}
async function storageUpload(file,id){const m=validateReceipt(file),session=await api.auth.getSession();if(!session?.access_token)throw new Error("Sesi login tidak ditemukan.");const cfg=window.SIMANIS_CONFIG,rand=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`,path=`${id}/${rand}.${ext(file.name)}`;const res=await fetch(`${cfg.SUPABASE_URL.replace(/\/$/,"")}/storage/v1/object/${STORAGE_BUCKET}/${encodedPath(path)}`,{method:"POST",headers:{apikey:cfg.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`,"Content-Type":m,"x-upsert":"false"},body:file});const text=await res.text();if(!res.ok)throw new Error("Upload bukti gagal: "+text);return{path,mime:m}}
async function storageDelete(path){if(!path)return;const session=await api.auth.getSession();if(!session?.access_token)return;const cfg=window.SIMANIS_CONFIG,res=await fetch(`${cfg.SUPABASE_URL.replace(/\/$/,"")}/storage/v1/object/${STORAGE_BUCKET}/${encodedPath(path)}`,{method:"DELETE",headers:{apikey:cfg.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`}});if(!res.ok)throw new Error(await res.text())}
async function storageBlob(path){const session=await api.auth.getSession();if(!session?.access_token)throw new Error("Sesi login tidak ditemukan.");const cfg=window.SIMANIS_CONFIG,res=await fetch(`${cfg.SUPABASE_URL.replace(/\/$/,"")}/storage/v1/object/authenticated/${STORAGE_BUCKET}/${encodedPath(path)}`,{headers:{apikey:cfg.SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`}});if(!res.ok)throw new Error(await res.text());return res.blob()}
async function openReceipt(id){const r=rows.find(x=>x.id===id);if(!r?.receipt_path)return;const tab=window.open("","_blank");try{if(tab)tab.document.write('<p style="font-family:sans-serif;padding:24px">Memuat bukti transaksi...</p>');const blob=await storageBlob(r.receipt_path),url=URL.createObjectURL(blob);if(tab)tab.location.href=url;else location.href=url;setTimeout(()=>URL.revokeObjectURL(url),120000)}catch(err){if(tab)tab.close();alert("Bukti gagal dibuka: "+err.message)}}
async function save(e){
  e.preventDefault();const btn=$("saveBtn");btn.disabled=true;btn.textContent="Menyimpan...";$("formMessage").textContent="";let uploaded=null;
  try{
    const id=$("transactionId").value,amount=readRupiahInput($("amount"));
    const submittedType=$("transactionType").value;
    const selectedCategory=categories.find(c=>c.id===$("category").value);
    if(!["INCOME","EXPENSE"].includes(submittedType))throw new Error("Jenis transaksi tidak valid.");
    if(!selectedCategory||![submittedType,"BOTH"].includes(selectedCategory.transaction_type)){
      throw new Error("Pilih kategori yang sesuai dengan jenis transaksi.");
    }
    if(!id&&submittedType==="INCOME"&&selectedCategory.code==="IURAN"){
      throw new Error("Pembayaran Iuran Pendidikan harus dicatat melalui menu Pembayaran Siswa agar pemasukan dan tagihan otomatis sinkron.");
    }
    if(!Number.isSafeInteger(amount)||amount<=0)throw new Error("Nominal rupiah harus berupa angka bulat lebih dari 0.");if(!$("description").value.trim())throw new Error("Uraian wajib diisi.");if($("accountType").value==="BANK"&&!$("accountName").value.trim())throw new Error("Nama rekening/bank wajib diisi.");
    const file=$("receiptFile").files?.[0];let finalId=id;
    if(!finalId){const ins=await restWrite("finance_transactions","POST",{transaction_date:$("transactionDate").value,transaction_type:$("transactionType").value,category_id:$("category").value,amount,account_type:$("accountType").value,account_name:$("accountType").value==="BANK"?$("accountName").value.trim():null,reference_number:$("referenceNumber").value.trim()||null,description:$("description").value.trim(),status:$("status").value});finalId=ins?.[0]?.id;if(!finalId)throw new Error("ID transaksi baru tidak diterima.")}
    if(file)uploaded=await storageUpload(file,finalId);
    const payload={transaction_date:$("transactionDate").value,transaction_type:$("transactionType").value,category_id:$("category").value,amount,account_type:$("accountType").value,account_name:$("accountType").value==="BANK"?$("accountName").value.trim():null,reference_number:$("referenceNumber").value.trim()||null,description:$("description").value.trim(),status:$("status").value};
    if(uploaded){payload.receipt_path=uploaded.path;payload.receipt_name=file.name;payload.receipt_mime=uploaded.mime;payload.receipt_size=file.size}
    if(id)await restWrite(`finance_transactions?id=eq.${encodeURIComponent(id)}`,"PATCH",payload);else if(uploaded)await restWrite(`finance_transactions?id=eq.${encodeURIComponent(finalId)}`,"PATCH",payload);
    const old=$("oldReceiptPath").value;if(uploaded&&old&&old!==uploaded.path){try{await storageDelete(old)}catch{}}
    closeModal();await loadData();
    if(!id&&submittedType==="EXPENSE")setTab("expense");
  }catch(err){if(uploaded){try{await storageDelete(uploaded.path)}catch{}}$("formMessage").textContent="Gagal menyimpan: "+err.message}finally{btn.disabled=false;btn.textContent="Simpan"}
}
async function remove(){
  const id=$("transactionId").value,r=rows.find(x=>x.id===id);if(!r||!canDelete())return;
  if(isStudentPaymentTransaction(r)){
    closeModal();
    alert("Transaksi Iuran Pendidikan tidak boleh dihapus dari Buku Kas karena terhubung ke cicilan siswa. Gunakan Pembayaran Siswa → Detail → Batalkan. Buku Kas akan otomatis menjadi VOID.");
    openLinkedStudentPayment(r.id);
    return;
  }
  if(!confirm(`Hapus permanen transaksi "${r.description}"?`))return;
  try{
    await restWrite(`finance_transactions?id=eq.${encodeURIComponent(id)}`,"DELETE",undefined,"return=minimal");
    if(r.receipt_path){try{await storageDelete(r.receipt_path)}catch{}}
    closeModal();await loadData();
  }catch(err){
    const msg=String(err.message||err);
    if(msg.includes("student_education_payments_finance_transaction_id")){
      alert("Transaksi ini berasal dari Pembayaran Siswa dan tidak boleh dihapus langsung. Batalkan dari menu Pembayaran Siswa agar cicilan dan Buku Kas tetap sinkron.");
      closeModal();openLinkedStudentPayment(id);
    }else{
      alert("Gagal menghapus transaksi: "+msg);
    }
  }
}
function csvCell(v){return`"${String(v??"").replaceAll('"','""')}"`}
function exportCsv(){const data=filtered();if(!data.length){alert("Tidak ada transaksi.");return}const header=["No","Tanggal","Status","Jenis","Kategori","Uraian","Penyimpanan","Rekening","Referensi","Nominal","Pembuat"],lines=[header.map(csvCell).join(";")];data.forEach((r,i)=>lines.push([i+1,r.transaction_date,r.status,r.transaction_type==="INCOME"?"Pemasukan":"Pengeluaran",r.category_name,r.description,r.account_type,r.account_name||"",r.reference_number||"",r.amount,r.created_by_name||""].map(csvCell).join(";")));const blob=new Blob(["\ufeffsep=;\r\n"+lines.join("\r\n")],{type:"text/csv;charset=utf-8;"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`laporan-keuangan-${$("monthFilter").value||"semua-periode"}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function printReport(){const data=filtered();if(!data.length){alert("Tidak ada transaksi.");return}const posted=data.filter(r=>r.status==="POSTED"),inc=posted.filter(r=>r.transaction_type==="INCOME").reduce((s,r)=>s+Number(r.amount||0),0),exp=posted.filter(r=>r.transaction_type==="EXPENSE").reduce((s,r)=>s+Number(r.amount||0),0),rowsHtml=data.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(dateLabel(r.transaction_date))}</td><td>${esc(r.status)}</td><td>${r.transaction_type==="INCOME"?"Pemasukan":"Pengeluaran"}</td><td>${esc(r.category_name)}</td><td>${esc(r.description)}</td><td>${esc(r.account_type==="CASH"?"Cash":r.account_name||"Rekening")}</td><td style="text-align:right">${esc(money(r.amount))}</td></tr>`).join(""),w=window.open("","_blank");if(!w){alert("Popup diblokir browser.");return}const today=new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",day:"2-digit",month:"long",year:"numeric"}).format(new Date());w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Laporan Keuangan</title><style>@page{size:A4 landscape;margin:12mm}body{font-family:Arial;font-size:10px}.kop{text-align:center;border-bottom:3px double #111;padding-bottom:8px}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0}.sum{border:1px solid #bbb;padding:8px}.sum b{display:block;font-size:15px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #999;padding:5px}.foot{display:flex;justify-content:space-between;margin-top:22px}.sign{width:260px;text-align:center}.space{height:55px}</style></head><body><div class="kop"><h1>MA NURUL ISLAM KARANGCEMPAKA</h1><h3>LAPORAN KEUANGAN</h3></div><p style="text-align:center">Periode: ${esc($("monthFilter").value?monthName($("monthFilter").value):"Semua Periode")}</p><div class="summary"><div class="sum">Pemasukan<b>${esc(money(inc))}</b></div><div class="sum">Pengeluaran<b>${esc(money(exp))}</b></div><div class="sum">Selisih<b>${esc(money(inc-exp))}</b></div></div><table><thead><tr><th>No</th><th>Tanggal</th><th>Status</th><th>Jenis</th><th>Kategori</th><th>Uraian</th><th>Penyimpanan</th><th>Nominal</th></tr></thead><tbody>${rowsHtml}</tbody></table><div class="foot"><div class="sign">Mengetahui,<br>Kepala Madrasah<div class="space"></div><b>__________________</b></div><div class="sign">Karangcempaka, ${today}<br>Bendahara<div class="space"></div><b>${esc(financeTreasurerSignature())}</b></div></div></body></html>`);w.document.close();setTimeout(()=>w.print(),400)}

/* ==========================================================
   IURAN PENDIDIKAN TAHUNAN + CICILAN
========================================================== */
function planBills(){return activePlan?bills.filter(b=>b.plan_id===activePlan.id):[]}
function studentFilteredBills(){
  const classId=$("studentClassFilter").value,studentId=$("studentFilter").value,q=$("studentSearch").value.trim().toLowerCase();
  return planBills().filter(b=>{
    const hay=`${b.student_name||""} ${b.nis||""} ${b.nisn||""}`.toLowerCase();
    return(!classId||b.class_id_snapshot===classId)&&(!studentId||b.student_id===studentId)&&(!q||hay.includes(q));
  });
}
function billStatusBadge(st){
  if(st==="LUNAS")return'<span class="badge-soft badge-lunas">LUNAS</span>';
  if(st==="CICILAN")return'<span class="badge-soft badge-cicilan">CICILAN</span>';
  return'<span class="badge-soft badge-belum">BELUM BAYAR</span>';
}
function renderStudentSelect(){
  const classId=$("studentClassFilter").value;
  const source=planBills().filter(b=>!classId||b.class_id_snapshot===classId);
  const current=$("studentFilter").value;
  $("studentFilter").innerHTML='<option value="">Semua Siswa</option>'+source.map(b=>`<option value="${b.student_id}">${esc(b.student_name)}</option>`).join("");
  if(source.some(b=>b.student_id===current))$("studentFilter").value=current;
}
function renderStudentModule(){
  renderPlanCard();renderStudentSelect();
  const all=planBills(),data=studentFilteredBills();
  $("studentStatBilled").textContent=money(all.reduce((s,b)=>s+Number(b.bill_amount||0),0));
  $("studentStatPaid").textContent=money(all.reduce((s,b)=>s+Number(b.total_paid||0),0));
  $("studentStatRemaining").textContent=money(all.reduce((s,b)=>s+Number(b.remaining_amount||0),0));
  $("studentStatLunas").textContent=all.filter(b=>b.payment_status==="LUNAS").length;
  $("studentStatCicilan").textContent=all.filter(b=>b.payment_status==="CICILAN").length;

  if(!data.length){
    $("studentBillBody").innerHTML='<tr><td colspan="8"><div class="empty-state">Belum ada tagihan siswa. Atur nominal lalu klik Sinkronkan Tagihan Siswa.</div></td></tr>';
    $("studentBillCards").innerHTML='<div class="empty-state">Belum ada tagihan siswa.</div>';
  }else{
    $("studentBillBody").innerHTML=data.map((b,i)=>`<tr data-bill-row="${b.id}" style="cursor:pointer"><td>${i+1}</td><td><b>${esc(b.student_name)}</b><br><span style="color:#77847e">${esc(b.nisn||"-")}</span></td><td>${esc(b.class_name_snapshot||"-")}</td><td>${money(b.bill_amount)}</td><td>${money(b.total_paid)}</td><td>${money(b.remaining_amount)}</td><td>${billStatusBadge(b.payment_status)}</td><td><div class="row-actions">${canCreate()&&Number(b.remaining_amount)>0?`<button class="mini-btn" data-pay-bill="${b.id}">Bayar</button>`:""}<button class="mini-btn" data-view-bill="${b.id}">Detail</button></div></td></tr>`).join("");
    $("studentBillCards").innerHTML=data.map(b=>`<article class="student-card"><h4>${esc(b.student_name)}</h4><p>${esc(b.class_name_snapshot||"-")} · ${esc(b.nisn||"-")}</p><p>Tagihan <b>${money(b.bill_amount)}</b> · Sisa <b>${money(b.remaining_amount)}</b></p>${billStatusBadge(b.payment_status)}<div class="row-actions" style="margin-top:9px">${canCreate()&&Number(b.remaining_amount)>0?`<button class="mini-btn" data-pay-bill="${b.id}">Bayar Cicilan</button>`:""}<button class="mini-btn" data-view-bill="${b.id}">Detail</button></div></article>`).join("");
    document.querySelectorAll("[data-bill-row]").forEach(el=>el.onclick=(e)=>{
      if(e.target.closest("button"))return;
      selectBill(el.dataset.billRow);
    });
    document.querySelectorAll("[data-view-bill]").forEach(el=>el.onclick=(e)=>{
      e.stopPropagation(); selectBill(el.dataset.viewBill);
      $("studentDetail").scrollIntoView({behavior:"smooth",block:"start"});
    });
    document.querySelectorAll("[data-pay-bill]").forEach(el=>el.onclick=(e)=>{
      e.stopPropagation(); selectBill(el.dataset.payBill); openPaymentModal(el.dataset.payBill);
    });
  }
  if(selectedBillId&&!all.some(b=>b.id===selectedBillId))selectedBillId=null;
  renderStudentDetail();
}
function paymentsForBill(id){return studentPayments.filter(p=>p.bill_id===id).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))}
function selectBill(id){selectedBillId=id;const b=planBills().find(x=>x.id===id);if(b){$("studentClassFilter").value=b.class_id_snapshot||"";renderStudentSelect();$("studentFilter").value=b.student_id}renderStudentDetail()}
function renderStudentDetail(){
  const b=planBills().find(x=>x.id===selectedBillId);
  if(!b){$("studentDetail").className="student-detail empty";$("studentDetail").innerHTML="Pilih siswa untuk melihat tagihan dan riwayat cicilan.";return}
  $("studentDetail").className="student-detail";
  const ps=paymentsForBill(b.id);
  $("studentDetail").innerHTML=`<div class="detail-head"><div><h3>${esc(b.student_name)}</h3><p>${esc(b.class_name_snapshot||"-")} · NISN ${esc(b.nisn||"-")}</p></div>${billStatusBadge(b.payment_status)}</div>
    <div class="detail-grid"><div class="detail-box">Tagihan Tahunan<b>${money(b.bill_amount)}</b></div><div class="detail-box">Sudah Dibayar<b>${money(b.total_paid)}</b></div><div class="detail-box">Sisa<b>${money(b.remaining_amount)}</b></div></div>
    <div class="detail-actions">
      ${canCreate()&&Number(b.remaining_amount)>0?'<button id="payInstallmentBtn" class="primary-btn">+ Bayar Cicilan</button>':""}
      ${canUpdate()?'<button id="adjustBillBtn" class="secondary-btn">Sesuaikan Tagihan</button>':""}
      <button id="printStudentRecapBtn" class="secondary-btn">Cetak Rekap</button>
    </div>
    <div class="payment-history"><h4>Riwayat Pembayaran (${ps.length})</h4>
      ${ps.length?ps.map(p=>`<div class="pay-row"><div><strong>${esc(p.receipt_number)} · ${money(p.amount)}</strong><p>${esc(dateLabel(p.payment_date))} · ${p.account_type==="CASH"?"Cash":esc(p.account_name||"Rekening")} · ${p.status}</p>${p.reference_number?`<p>Ref: ${esc(p.reference_number)}</p>`:""}${p.status==="VOID"&&p.void_reason?`<p>Alasan: ${esc(p.void_reason)}</p>`:""}</div><div class="row-actions"><button class="mini-btn" data-print-payment="${p.id}">Nota</button>${p.status==="POSTED"&&canUpdate()?`<button class="mini-btn" data-void-payment="${p.id}">Batalkan</button>`:""}</div></div>`).join(""):'<div class="empty-state">Belum ada pembayaran.</div>'}
    </div>`;
  if($("payInstallmentBtn"))$("payInstallmentBtn").onclick=()=>openPaymentModal(b.id);
  if($("adjustBillBtn"))$("adjustBillBtn").onclick=()=>adjustBill(b.id);
  $("printStudentRecapBtn").onclick=()=>printStudentRecap(b.id);
  document.querySelectorAll("[data-print-payment]").forEach(x=>x.onclick=()=>printPaymentReceipt(x.dataset.printPayment));
  document.querySelectorAll("[data-void-payment]").forEach(x=>x.onclick=()=>voidPayment(x.dataset.voidPayment));
}

function rateForClass(classId){
  return classRates.find(r=>r.plan_id===activePlan?.id&&r.class_id===classId)||null;
}
function syncRateEditor(){
  const classId=$("rateClassSelect")?.value||classes[0]?.id||"";
  if($("rateClassSelect")&&!$("rateClassSelect").value&&classId)$("rateClassSelect").value=classId;
  const r=rateForClass(classId);
  if($("rateAmountInput"))$("rateAmountInput").value=rupiahFromNumber(r?.amount);
}
async function saveClassRateUI(){
  if(!activePlan||!canUpdate())return;
  const classId=$("rateClassSelect").value;
  const c=classes.find(x=>x.id===classId);
  const amount=readRupiahInput($("rateAmountInput"));
  if(!c){alert("Pilih kelas terlebih dahulu.");return}
  if(!Number.isSafeInteger(amount)||amount<=0){alert("Nominal tahunan harus berupa angka bulat lebih dari 0.");return}
  const existing=rateForClass(classId);
  try{
    if(existing){
      await restWrite(`education_fee_class_rates?id=eq.${encodeURIComponent(existing.id)}`,"PATCH",{amount});
      existing.amount=amount;
    }else{
      const ins=await restWrite("education_fee_class_rates","POST",{plan_id:activePlan.id,class_id:classId,amount});
      const row=ins?.[0]; if(row) classRates.push(row);
    }
    renderClassRates();
    syncRateEditor();
    alert(`Nominal ${c.name} berhasil disimpan: ${money(amount)}`);
  }catch(err){alert("Gagal menyimpan nominal kelas: "+err.message)}
}
function renderClassRates(){
  const holder=$("classRateGrid");
  if(!holder)return;
  if(!activePlan){holder.innerHTML='<div class="empty-state">Plan tahun pelajaran aktif tidak ditemukan.</div>';return}
  holder.innerHTML=classes.map(c=>{
    const r=rateForClass(c.id);
    return `<div style="border:1px solid #e0e9e4;border-radius:11px;padding:10px;background:#fbfdfc">
      <div style="font-size:9px;color:#6b7b73">${esc(c.name)}</div>
      <div style="font-size:15px;font-weight:800;color:#0b7347;margin:3px 0">${money(r?.amount||0)}</div>
      ${canUpdate()?`<button type="button" class="mini-btn" data-set-class-rate="${c.id}">Edit Nominal</button>`:""}
    </div>`;
  }).join("");
  holder.querySelectorAll("[data-set-class-rate]").forEach(b=>b.onclick=()=>{
    $("rateClassSelect").value=b.dataset.setClassRate;
    syncRateEditor();
    $("rateAmountInput").focus();
    $("rateEditor").scrollIntoView({behavior:"smooth",block:"center"});
  });
}
async function setClassRate(classId){
  if(!activePlan||!canUpdate())return;
  const c=classes.find(x=>x.id===classId),existing=rateForClass(classId);
  if(!c)return;
  const raw=prompt(`Nominal Iuran Pendidikan untuk kelas ${c.name}\nTahun Pelajaran ${activePlan.academic_years?.name||""}:`,rupiahFromNumber(existing?.amount||0));
  if(raw===null)return;
  const amount=readRupiahInput({value:raw});
  if(!Number.isSafeInteger(amount)||amount<=0){alert("Nominal harus berupa angka bulat lebih dari 0.");return}
  try{
    if(existing){
      await restWrite(`education_fee_class_rates?id=eq.${encodeURIComponent(existing.id)}`,"PATCH",{amount});
      existing.amount=amount;
    }else{
      const ins=await restWrite("education_fee_class_rates","POST",{plan_id:activePlan.id,class_id:classId,amount});
      const row=ins?.[0];if(row)classRates.push(row);
    }
    renderClassRates();
  }catch(err){alert("Gagal menyimpan nominal kelas: "+err.message)}
}

async function syncBills(){
  if(!activePlan||!canCreate())return;
  const missing=classes.filter(c=>!rateForClass(c.id)||Number(rateForClass(c.id).amount||0)<=0);
  if(missing.length){
    alert(`Masih ada kelas yang nominalnya belum diatur:\n${missing.map(c=>"- "+c.name).join("\n")}`);
    return;
  }
  if(!confirm(`Sinkronkan tagihan ${activePlan.name} untuk seluruh siswa aktif sesuai nominal per kelas?\n\nTagihan siswa yang sudah pernah memiliki pembayaran tidak akan ditimpa.`))return;
  try{const result=await api.db.rpc("sync_student_education_bills",{p_plan_id:activePlan.id});await loadData();alert(`Sinkronisasi selesai. ${result??""}`)}catch(err){alert("Gagal sinkronisasi: "+err.message)}
}
async function adjustBill(id){
  const b=planBills().find(x=>x.id===id);if(!b||!canUpdate())return;
  const raw=prompt(`Sesuaikan tagihan ${b.student_name}\nSudah dibayar: ${money(b.total_paid)}\nNominal tagihan baru:`,rupiahFromNumber(b.bill_amount||0));
  if(raw===null)return;
  const amount=readRupiahInput({value:raw});
  if(!Number.isSafeInteger(amount)||amount<Number(b.total_paid)){alert(`Nominal tagihan tidak valid atau lebih kecil dari pembayaran (${money(b.total_paid)}).`);return}
  try{await restWrite(`student_education_bills?id=eq.${encodeURIComponent(id)}`,"PATCH",{bill_amount:amount});await loadData();selectedBillId=id;renderStudentModule()}catch(err){alert("Gagal menyesuaikan tagihan: "+err.message)}
}
function togglePaymentBank(){const bank=$("paymentAccountType").value==="BANK";$("paymentBankWrap").classList.toggle("hidden",!bank);$("paymentAccountName").required=bank;if(!bank)$("paymentAccountName").value=""}
function openPaymentModal(id){
  const b=planBills().find(x=>x.id===id);if(!b)return;
  $("paymentForm").reset();$("paymentBillId").value=id;$("paymentDate").value=todayInput();$("paymentAccountType").value="CASH";togglePaymentBank();
  $("paymentAmount").value="";$("paymentAmount").dataset.maxAmount=String(Number(b.remaining_amount));$("paymentStudentInfo").innerHTML=`<b>${esc(b.student_name)}</b> · ${esc(b.class_name_snapshot||"-")}<br>Tagihan ${money(b.bill_amount)} · Sudah dibayar ${money(b.total_paid)} · <b>Sisa ${money(b.remaining_amount)}</b>`;
  $("paymentMessage").textContent="";$("paymentModal").classList.remove("hidden");
}
function closePaymentModal(){$("paymentModal").classList.add("hidden")}
async function savePayment(e){
  e.preventDefault();const id=$("paymentBillId").value,b=planBills().find(x=>x.id===id),amount=readRupiahInput($("paymentAmount")),btn=$("savePaymentBtn");
  if(!b)return;if(!Number.isSafeInteger(amount)||amount<=0||amount>Number(b.remaining_amount)){$("paymentMessage").textContent=`Nominal harus antara Rp1 dan ${money(b.remaining_amount)}.`;return}
  if($("paymentAccountType").value==="BANK"&&!$("paymentAccountName").value.trim()){$("paymentMessage").textContent="Nama rekening/bank wajib diisi.";return}
  btn.disabled=true;btn.textContent="Menyimpan...";
  try{
    const res=await api.db.rpc("record_student_education_payment",{p_bill_id:id,p_payment_date:$("paymentDate").value,p_amount:amount,p_account_type:$("paymentAccountType").value,p_account_name:$("paymentAccountName").value.trim()||null,p_reference_number:$("paymentReference").value.trim()||null,p_note:$("paymentNote").value.trim()||null});
    // RPC menyimpan Pembayaran Siswa + Buku Kas secara atomik. Jangan menganggap
    // pembayaran gagal bila yang gagal hanyalah memuat ulang layar setelahnya.
    closePaymentModal();selectedBillId=id;
    const paymentReceipt=res?.receipt_number||res?.[0]?.receipt_number||"";
    $("paymentIncomeFeedback").textContent="Pembayaran "+(paymentReceipt||"siswa")+
      " telah dicatat sebagai Pemasukan – Iuran Pendidikan di Buku Kas. Tidak perlu input pemasukan ulang.";
    try{await loadData()}catch(refreshError){
      console.warn("Pembayaran disimpan, tetapi reload data gagal:",refreshError);
      alert("Pembayaran BERHASIL disimpan sebagai pemasukan Buku Kas ("+
        (paymentReceipt||"nota tersedia")+"). Data di layar belum diperbarui. Muat ulang halaman; JANGAN ulangi pembayaran.");
      return;
    }
    const paymentId=res?.payment_id||res?.[0]?.payment_id;
    if(paymentId)printPaymentReceipt(paymentId);
    else alert("Pembayaran berhasil disimpan dan otomatis tercatat sebagai pemasukan Buku Kas.");
  }catch(err){$("paymentMessage").textContent="Gagal menyimpan pembayaran: "+err.message}
  finally{btn.disabled=false;btn.textContent="Simpan & Cetak Nota"}
}
async function voidPayment(id){
  const p=studentPayments.find(x=>x.id===id);if(!p||p.status!=="POSTED"||!canUpdate())return;
  const reason=prompt(`Batalkan pembayaran ${p.receipt_number} sebesar ${money(p.amount)}?\nAlasan pembatalan:`);
  if(!reason?.trim())return;
  try{await api.db.rpc("void_student_education_payment",{p_payment_id:id,p_reason:reason.trim()});selectedBillId=p.bill_id;await loadData();alert("Pembayaran dibatalkan dan transaksi buku kas otomatis menjadi VOID.")}catch(err){alert("Gagal membatalkan: "+err.message)}
}
function cumulativeAtPayment(p){
  const list=studentPayments.filter(x=>x.bill_id===p.bill_id&&x.status==="POSTED").sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
  let total=0;for(const x of list){total+=Number(x.amount||0);if(x.id===p.id)break}return total;
}
function printPaymentReceipt(id){
  const p=studentPayments.find(x=>x.id===id),b=p&&planBills().find(x=>x.id===p.bill_id);if(!p||!b)return;
  const cumulative=p.status==="POSTED"?cumulativeAtPayment(p):Number(b.total_paid||0),remaining=Math.max(Number(b.bill_amount||0)-cumulative,0);
  const w=window.open("","_blank");if(!w){alert("Popup diblokir browser.");return}
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(p.receipt_number)}</title><style>@page{size:A5 portrait;margin:12mm}body{font-family:Arial;color:#111;font-size:11px}.kop{text-align:center;border-bottom:3px double #111;padding-bottom:8px}.kop h1{font-size:16px;margin:0}.kop p{margin:3px 0}.title{text-align:center;font-weight:bold;font-size:13px;margin:14px 0}.info{width:100%;border-collapse:collapse}.info td{padding:4px 2px}.pay{border:1px solid #999;border-radius:6px;padding:10px;margin-top:12px}.pay strong{font-size:18px}.summary{margin-top:12px;width:100%;border-collapse:collapse}.summary td{border:1px solid #aaa;padding:6px}.sign{margin-top:28px;margin-left:auto;width:220px;text-align:center}.space{height:50px}.note{font-size:9px;color:#555;margin-top:12px}</style></head><body><div class="kop"><h1>MA NURUL ISLAM KARANGCEMPAKA</h1><p>NOTA PEMBAYARAN IURAN PENDIDIKAN</p><p>${esc(b.plan_name)}</p></div><div class="title">${esc(p.receipt_number)}</div><table class="info"><tr><td>Nama Siswa</td><td>: <b>${esc(b.student_name)}</b></td></tr><tr><td>Kelas</td><td>: ${esc(b.class_name_snapshot||"-")}</td></tr><tr><td>NISN</td><td>: ${esc(b.nisn||"-")}</td></tr><tr><td>Tanggal</td><td>: ${esc(dateLabel(p.payment_date))}</td></tr><tr><td>Metode</td><td>: ${p.account_type==="CASH"?"Cash / Tunai":esc(p.account_name||"Rekening")}</td></tr></table><div class="pay">Pembayaran cicilan<br><strong>${esc(money(p.amount))}</strong></div><table class="summary"><tr><td>Tagihan Tahunan</td><td>${esc(money(b.bill_amount))}</td></tr><tr><td>Total Terbayar s.d. Nota Ini</td><td>${esc(money(cumulative))}</td></tr><tr><td>Sisa Tagihan</td><td><b>${esc(money(remaining))}</b></td></tr></table><div class="sign">Bendahara<div class="space"></div><b>${esc(financeTreasurerSignature())}</b></div><div class="note">Nota dicetak dari SIMANIS. Simpan sebagai bukti pembayaran.</div></body></html>`);
  w.document.close();setTimeout(()=>w.print(),400);
}
function printStudentRecap(id){
  const b=planBills().find(x=>x.id===id);if(!b)return;
  const ps=paymentsForBill(id).filter(p=>p.status==="POSTED").sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
  const rowsHtml=ps.map((p,i)=>`<tr><td>${i+1}</td><td>${esc(dateLabel(p.payment_date))}</td><td>${esc(p.receipt_number)}</td><td>${p.account_type==="CASH"?"Cash":esc(p.account_name||"Rekening")}</td><td style="text-align:right">${esc(money(p.amount))}</td></tr>`).join("");
  const w=window.open("","_blank");if(!w){alert("Popup diblokir browser.");return}
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Rekap ${esc(b.student_name)}</title><style>@page{size:A4 portrait;margin:15mm}body{font-family:Arial;font-size:11px}.kop{text-align:center;border-bottom:3px double #111}.kop h1{font-size:17px;margin:0}.info{margin:15px 0;line-height:1.7}table{width:100%;border-collapse:collapse}th,td{border:1px solid #999;padding:6px}th{background:#eee}.summary{margin-top:14px}.summary td:first-child{font-weight:bold}.sign{margin-top:30px;margin-left:auto;width:220px;text-align:center}.space{height:55px}</style></head><body><div class="kop"><h1>MA NURUL ISLAM KARANGCEMPAKA</h1><p>REKAP PEMBAYARAN IURAN PENDIDIKAN</p></div><div class="info"><b>${esc(b.student_name)}</b><br>${esc(b.class_name_snapshot||"-")} · NISN ${esc(b.nisn||"-")}<br>${esc(b.plan_name)}</div><table><thead><tr><th>No</th><th>Tanggal</th><th>No. Nota</th><th>Metode</th><th>Nominal</th></tr></thead><tbody>${rowsHtml||'<tr><td colspan="5">Belum ada pembayaran.</td></tr>'}</tbody></table><table class="summary"><tr><td>Tagihan Tahunan</td><td>${esc(money(b.bill_amount))}</td></tr><tr><td>Sudah Dibayar</td><td>${esc(money(b.total_paid))}</td></tr><tr><td>Sisa Tagihan</td><td>${esc(money(b.remaining_amount))}</td></tr><tr><td>Status</td><td><b>${esc(b.payment_status)}</b></td></tr></table><div class="sign">Bendahara<div class="space"></div><b>${esc(financeTreasurerSignature())}</b></div></body></html>`);w.document.close();setTimeout(()=>w.print(),400)
}


/* ==========================================================
   REKAP PEMBAYARAN
========================================================== */
function renderRecapFilters(){
  if(!$("recapYearFilter"))return;
  const currentYear=$("recapYearFilter").value;
  const years=[...new Map(feePlans.map(p=>[
    p.academic_years?.name||p.academic_year_id,
    {id:p.academic_year_id,name:p.academic_years?.name||p.academic_year_id}
  ])).values()];
  $("recapYearFilter").innerHTML='<option value="">Semua Tahun Pelajaran</option>'+years.map(y=>`<option value="${esc(y.name)}">${esc(y.name)}</option>`).join("");
  if(currentYear&&years.some(y=>y.name===currentYear))$("recapYearFilter").value=currentYear;
  else if(activePlan?.academic_years?.name)$("recapYearFilter").value=activePlan.academic_years.name;

  const currentClass=$("recapClassFilter").value;
  $("recapClassFilter").innerHTML='<option value="">Semua Kelas</option>'+classes.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");
  if(currentClass&&classes.some(c=>c.id===currentClass))$("recapClassFilter").value=currentClass;
}
function recapFilteredBills(){
  if(!$("recapYearFilter"))return[];
  const year=$("recapYearFilter").value,classId=$("recapClassFilter").value,status=$("recapStatusFilter").value,q=$("recapSearch").value.trim().toLowerCase();
  return bills.filter(b=>{
    const hay=`${b.student_name||""} ${b.nis||""} ${b.nisn||""}`.toLowerCase();
    return(!year||b.academic_year_name===year)&&(!classId||b.class_id_snapshot===classId)&&(!status||b.payment_status===status)&&(!q||hay.includes(q));
  }).sort((a,b)=>String(a.class_name_snapshot||"").localeCompare(String(b.class_name_snapshot||""),"id")||String(a.student_name||"").localeCompare(String(b.student_name||""),"id"));
}
function recapStatusBadge(st){
  if(st==="LUNAS")return'<span class="badge-soft badge-lunas">LUNAS</span>';
  if(st==="CICILAN")return'<span class="badge-soft badge-cicilan">CICILAN</span>';
  return'<span class="badge-soft badge-belum">BELUM BAYAR</span>';
}
function recapPct(b){
  const total=Number(b.bill_amount||0),paid=Number(b.total_paid||0);
  return total>0?Math.max(0,Math.min(100,Math.round(paid/total*100))):0;
}
function renderRecap(){
  if(!$("recapBody"))return;
  const data=recapFilteredBills();
  const totalBill=data.reduce((s,b)=>s+Number(b.bill_amount||0),0);
  const totalPaid=data.reduce((s,b)=>s+Number(b.total_paid||0),0);
  const totalRemaining=data.reduce((s,b)=>s+Number(b.remaining_amount||0),0);
  const lunas=data.filter(b=>b.payment_status==="LUNAS").length;
  const belum=data.filter(b=>b.payment_status!=="LUNAS").length;

  $("recapStatBilled").textContent=money(totalBill);
  $("recapStatPaid").textContent=money(totalPaid);
  $("recapStatRemaining").textContent=money(totalRemaining);
  $("recapStatLunas").textContent=lunas;
  $("recapStatBelum").textContent=belum;

  const pct=totalBill>0?Math.round(totalPaid/totalBill*100):0;
  $("recapSummaryLine").textContent=`${data.length} siswa · Progress pembayaran ${pct}% · ${lunas} lunas · ${belum} belum lunas`;

  const byClass=new Map();
  for(const b of data){
    const key=b.class_id_snapshot||b.class_name_snapshot||"-";
    if(!byClass.has(key))byClass.set(key,{name:b.class_name_snapshot||"-",count:0,bill:0,paid:0,remaining:0,lunas:0,belum:0});
    const x=byClass.get(key);
    x.count++;x.bill+=Number(b.bill_amount||0);x.paid+=Number(b.total_paid||0);x.remaining+=Number(b.remaining_amount||0);
    if(b.payment_status==="LUNAS")x.lunas++;else x.belum++;
  }
  $("recapClassGrid").innerHTML=[...byClass.values()].map(x=>{
    const p=x.bill>0?Math.round(x.paid/x.bill*100):0;
    return `<article class="recap-class-card"><h4>${esc(x.name)}</h4><p>${x.count} siswa · <strong>${x.lunas} lunas</strong> · ${x.belum} belum lunas</p><p>Tagihan ${money(x.bill)}</p><p>Dibayar ${money(x.paid)}</p><p>Sisa ${money(x.remaining)}</p><div class="recap-progress"><span style="width:${p}%"></span></div><p>Progress ${p}%</p></article>`;
  }).join("")||'<div class="empty-state">Belum ada data sesuai filter.</div>';

  if(!data.length){
    $("recapBody").innerHTML='<tr><td colspan="9"><div class="empty-state">Tidak ada data sesuai filter.</div></td></tr>';
    $("recapCards").innerHTML='<div class="empty-state">Tidak ada data sesuai filter.</div>';
    return;
  }

  $("recapBody").innerHTML=data.map((b,i)=>`<tr>
    <td>${i+1}</td>
    <td><b>${esc(b.student_name)}</b><br><span style="color:#77847e">${esc(b.nisn||"-")}</span></td>
    <td>${esc(b.class_name_snapshot||"-")}</td>
    <td>${esc(b.academic_year_name||"-")}</td>
    <td>${money(b.bill_amount)}</td>
    <td>${money(b.total_paid)}</td>
    <td>${money(b.remaining_amount)}</td>
    <td>${recapStatusBadge(b.payment_status)}</td>
    <td>${recapPct(b)}%</td>
  </tr>`).join("");

  $("recapCards").innerHTML=data.map(b=>`<article class="student-card">
    <h4>${esc(b.student_name)}</h4>
    <p>${esc(b.class_name_snapshot||"-")} · TP ${esc(b.academic_year_name||"-")}</p>
    <p>Tagihan <b>${money(b.bill_amount)}</b></p>
    <p>Dibayar <b>${money(b.total_paid)}</b> · Sisa <b>${money(b.remaining_amount)}</b></p>
    ${recapStatusBadge(b.payment_status)}
  </article>`).join("");
}
function recapCsv(){
  const data=recapFilteredBills();
  if(!data.length){alert("Tidak ada data rekap sesuai filter.");return}
  const header=["No","Nama Siswa","NIS","NISN","Kelas","Tahun Pelajaran","Tagihan","Dibayar","Sisa","Status","Progress"];
  const lines=[header.map(csvCell).join(";")];
  data.forEach((b,i)=>lines.push([
    i+1,b.student_name,b.nis||"",b.nisn||"",b.class_name_snapshot||"",b.academic_year_name||"",
    b.bill_amount,b.total_paid,b.remaining_amount,b.payment_status,`${recapPct(b)}%`
  ].map(csvCell).join(";")));
  const blob=new Blob(["\ufeffsep=;\r\n"+lines.join("\r\n")],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  const year=$("recapYearFilter").value||"semua-tahun",cls=$("recapClassFilter").selectedOptions?.[0]?.textContent||"semua-kelas";
  a.href=url;a.download=`rekap-iuran-${year}-${cls}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function recapPrint(){
  const data=recapFilteredBills();if(!data.length){alert("Tidak ada data rekap sesuai filter.");return}
  const totalBill=data.reduce((s,b)=>s+Number(b.bill_amount||0),0),totalPaid=data.reduce((s,b)=>s+Number(b.total_paid||0),0),totalRemaining=data.reduce((s,b)=>s+Number(b.remaining_amount||0),0);
  const lunas=data.filter(b=>b.payment_status==="LUNAS").length,belum=data.length-lunas;
  const year=$("recapYearFilter").value||"Semua Tahun Pelajaran",cls=$("recapClassFilter").selectedOptions?.[0]?.textContent||"Semua Kelas",status=$("recapStatusFilter").selectedOptions?.[0]?.textContent||"Semua Status";
  const trs=data.map((b,i)=>`<tr><td>${i+1}</td><td>${esc(b.student_name)}</td><td>${esc(b.nisn||"-")}</td><td>${esc(b.class_name_snapshot||"-")}</td><td style="text-align:right">${esc(money(b.bill_amount))}</td><td style="text-align:right">${esc(money(b.total_paid))}</td><td style="text-align:right">${esc(money(b.remaining_amount))}</td><td>${esc(b.payment_status)}</td><td>${recapPct(b)}%</td></tr>`).join("");
  const w=window.open("","_blank");if(!w){alert("Popup diblokir browser.");return}
  const today=new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",day:"2-digit",month:"long",year:"numeric"}).format(new Date());
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Rekap Pembayaran Iuran Pendidikan</title><style>@page{size:A4 landscape;margin:10mm}body{font-family:Arial,sans-serif;font-size:9px;color:#111}.kop{text-align:center;border-bottom:3px double #111;padding-bottom:7px}.kop h1{font-size:17px;margin:0}.kop p{margin:3px 0}.filter{text-align:center;margin:10px}.summary{display:grid;grid-template-columns:repeat(5,1fr);gap:5px;margin:10px 0}.box{border:1px solid #aaa;padding:6px}.box b{display:block;font-size:12px;margin-top:3px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #999;padding:4px;vertical-align:top}th{background:#eee}.foot{display:flex;justify-content:space-between;margin-top:20px}.sign{width:240px;text-align:center}.space{height:45px}</style></head><body><div class="kop"><h1>MA NURUL ISLAM KARANGCEMPAKA</h1><p>REKAP PEMBAYARAN IURAN PENDIDIKAN</p></div><div class="filter">Tahun Pelajaran: <b>${esc(year)}</b> · Kelas: <b>${esc(cls)}</b> · Status: <b>${esc(status)}</b></div><div class="summary"><div class="box">Total Tagihan<b>${esc(money(totalBill))}</b></div><div class="box">Sudah Dibayar<b>${esc(money(totalPaid))}</b></div><div class="box">Sisa<b>${esc(money(totalRemaining))}</b></div><div class="box">Lunas<b>${lunas} siswa</b></div><div class="box">Belum Lunas<b>${belum} siswa</b></div></div><table><thead><tr><th>No</th><th>Siswa</th><th>NISN</th><th>Kelas</th><th>Tagihan</th><th>Dibayar</th><th>Sisa</th><th>Status</th><th>Progress</th></tr></thead><tbody>${trs}</tbody></table><div class="foot"><div class="sign">Mengetahui,<br>Kepala Madrasah<div class="space"></div><b>________________________</b></div><div class="sign">Karangcempaka, ${today}<br>Bendahara<div class="space"></div><b>${esc(financeTreasurerSignature())}</b></div></div></body></html>`);
  w.document.close();setTimeout(()=>w.print(),350);
}

/* EVENTS */
["amount","rateAmountInput","paymentAmount"].forEach(bindRupiahField);

$("paymentIncomeTabBtn").addEventListener("click",()=>setTab("income"));
$("incomeOtherBtn").addEventListener("click",()=>openAdd("INCOME"));
$("incomeSearch").addEventListener("input",()=>{clearIncomeCsvLink();renderIncomes()});
$("incomeMonthFilter").addEventListener("change",()=>{clearIncomeCsvLink();renderIncomes()});
$("incomeSourceFilter").addEventListener("change",()=>{clearIncomeCsvLink();renderIncomes()});
$("incomeClassFilter").addEventListener("change",()=>{clearIncomeCsvLink();renderIncomes()});
$("incomeStatusFilter").addEventListener("change",()=>{clearIncomeCsvLink();renderIncomes()});
$("incomeCsvBtn").addEventListener("click",exportIncomeCsv);
$("incomePrintBtn").addEventListener("click",printIncomeReport);
window.addEventListener("pagehide",clearIncomeCsvLink);

$("searchInput").addEventListener("input",render);$("monthFilter").addEventListener("change",render);$("typeFilter").addEventListener("change",render);$("categoryFilter").addEventListener("change",render);$("accountFilter").addEventListener("change",render);
$("addBtn").addEventListener("click",()=>openAdd("INCOME"));
$("addExpenseQuickBtn").addEventListener("click",()=>openAdd("EXPENSE"));
$("addExpenseBtn").addEventListener("click",()=>openAdd("EXPENSE"));
$("expenseSearch").addEventListener("input",()=>{clearExpenseCsvLink();renderExpenses()});
$("expenseMonthFilter").addEventListener("change",()=>{clearExpenseCsvLink();renderExpenses()});
$("expenseCategoryFilter").addEventListener("change",()=>{clearExpenseCsvLink();renderExpenses()});
$("expenseStatusFilter").addEventListener("change",()=>{clearExpenseCsvLink();renderExpenses()});
$("expenseCsvBtn").addEventListener("click",exportExpenseCsv);
$("expensePrintBtn").addEventListener("click",printExpenses);
window.addEventListener("pagehide",clearExpenseCsvLink);
$("printBtn").addEventListener("click",printReport);$("csvBtn").addEventListener("click",exportCsv);$("closeModal").addEventListener("click",closeModal);$("cancelBtn").addEventListener("click",closeModal);$("deleteBtn").addEventListener("click",remove);$("form").addEventListener("submit",save);$("transactionType").addEventListener("change",renderCategoryOptions);$("accountType").addEventListener("change",toggleBank);$("modal").addEventListener("click",e=>{if(e.target===$("modal"))closeModal()});
$("rateClassSelect").addEventListener("change",syncRateEditor);$("saveClassRateBtn").addEventListener("click",saveClassRateUI);$("syncBillsBtn").addEventListener("click",syncBills);
$("studentClassFilter").addEventListener("change",()=>{renderStudentSelect();$("studentFilter").value="";selectedBillId=null;renderStudentModule()});
$("studentFilter").addEventListener("change",()=>{const id=$("studentFilter").value,b=planBills().find(x=>x.student_id===id);selectedBillId=b?.id||null;renderStudentModule()});
$("studentSearch").addEventListener("input",renderStudentModule);
$("recapYearFilter").addEventListener("change",renderRecap);
$("recapClassFilter").addEventListener("change",renderRecap);
$("recapStatusFilter").addEventListener("change",renderRecap);
$("recapSearch").addEventListener("input",renderRecap);
$("recapPrintBtn").addEventListener("click",recapPrint);
$("recapCsvBtn").addEventListener("click",recapCsv);
$("paymentAccountType").addEventListener("change",togglePaymentBank);$("paymentForm").addEventListener("submit",savePayment);$("closePaymentModal").addEventListener("click",closePaymentModal);$("cancelPaymentBtn").addEventListener("click",closePaymentModal);$("paymentModal").addEventListener("click",e=>{if(e.target===$("paymentModal"))closePaymentModal()});

(async()=>{
  try{
    api=await window.simanisReady;
    const user=await api.auth.getUser();if(!user){location.href="index.html";return}
    profile=await loadProfile(user);
    $("sideUserName").textContent=profile.full_name||"Pengguna";$("sideUserRole").textContent=formatRole(profile.role);$("headerUser").textContent=profile.full_name||"Pengguna";$("currentDate").textContent=localDateID();
    await loadMenu();if(!modulePerm.can_view)throw new Error("Akun tidak memiliki akses ke modul Keuangan.");
    await loadOfficialTreasurer();
    await loadMaster();await loadData();await loadRapbm();
    const params=new URLSearchParams(location.search),requestedTab=params.get("tab");
    if(["rapbm","cashbook","income","expense","studentpay","recap"].includes(requestedTab))setTab(requestedTab);
    if(params.get("from")==="pkm"&&$("backPkmBtn"))$("backPkmBtn").style.display="inline-flex";
    $("logoutBtn").onclick=async()=>{await api.auth.signOut();location.href="index.html"};
  }catch(err){console.error(err);alert("Modul Keuangan gagal dimuat: "+err.message)}
  finally{$("loading").style.display="none"}
})();


/* RAPBM: rencana tersimpan per kategori, realisasi dibaca dari buku kas yang sama. */
let rapbmLines=[],rapbmYear=null;
async function loadRapbm(){
  const status=$("rapbmStatus"),body=$("rapbmRows");
  try{
    status.textContent="Memuat data rencana dan realisasi...";
    const years=await api.from("academic_years").select("id,name,start_date,end_date").eq("name","2026/2027").limit(1);
    if(years.error)throw years.error;
    rapbmYear=years.data?.[0];
    if(!rapbmYear)throw new Error("Tahun pelajaran 2026/2027 belum ditemukan.");
    const result=await api.from("v_rapbm_realisasi").select("*").eq("academic_year_id",rapbmYear.id).order("transaction_type",{ascending:false}).order("category_name");
    if(result.error)throw result.error;
    rapbmLines=result.data||[];
    renderRapbm();
    status.textContent="Tahun Pelajaran 2026/2027 · "+rapbmYear.start_date+" s.d. "+rapbmYear.end_date+" · "+rapbmLines.length+" kategori";
  }catch(err){status.textContent="Gagal memuat RAPBM: "+err.message;body.innerHTML='<tr><td colspan="7">RAPBM gagal dimuat. Pastikan akun memiliki izin Keuangan.</td></tr>'}
}
function renderRapbm(){
  const sums=t=>rapbmLines.filter(r=>r.transaction_type===t).reduce((a,r)=>({planned:a.planned+Number(r.planned_amount||0),real:a.real+Number(r.realized_amount||0)}),{planned:0,real:0});
  const inc=sums("INCOME"),exp=sums("EXPENSE");
  const cards=[["Rencana Pemasukan",inc.planned],["Realisasi Pemasukan",inc.real],["Rencana Pengeluaran",exp.planned],["Realisasi Pengeluaran",exp.real]];
  $("rapbmStats").innerHTML=cards.map(([label,value])=>'<div class="dash-stat" style="background:#fff;border:1px solid #dbe7df;border-radius:13px;padding:13px"><div style="font-size:10px;color:#60756b">'+esc(label)+'</div><div style="font-size:18px;font-weight:850;color:#075b3a;margin-top:7px">'+esc(money(value))+'</div></div>').join("");
  $("rapbmRows").innerHTML=rapbmLines.map(r=>{
    const planned=Number(r.planned_amount||0),real=Number(r.realized_amount||0),difference=planned-real,pct=planned>0?Math.round(real/planned*100):null;
    return '<tr><td>'+(r.transaction_type==="INCOME"?"Pemasukan":"Pengeluaran")+'</td><td><b>'+esc(r.category_name)+'</b><br><small>'+esc(r.category_code)+'</small></td>'+
    '<td><input type="text" inputmode="numeric" data-rapbm-amount="'+esc(r.category_id)+'" value="'+esc(r.has_plan?rupiahIntegerFormatter.format(planned):"")+'" placeholder="Belum dianggarkan" style="min-width:140px;width:100%;box-sizing:border-box;padding:8px;border:1px solid #ccdcd2;border-radius:8px" '+(!canUpdate()&&!canCreate()?"disabled":"")+'></td>'+
    '<td>'+esc(money(real))+'</td><td style="color:'+(difference<0?"#a32929":"#16663e")+'">'+(r.has_plan?esc(money(difference)):"—")+'</td><td>'+(pct===null?"—":pct+"%")+'</td>'+
    '<td><button type="button" data-rapbm-save="'+esc(r.category_id)+'" class="secondary-btn" style="width:auto;padding:7px 10px" '+(!canUpdate()&&!canCreate()?"disabled":"")+'>Simpan</button></td></tr>';
  }).join("");
  $("rapbmRows").querySelectorAll("[data-rapbm-save]").forEach(btn=>btn.addEventListener("click",()=>saveRapbmLine(btn.dataset.rapbmSave,btn)));
  $("rapbmRows").querySelectorAll("[data-rapbm-amount]").forEach(el=>el.addEventListener("blur",()=>{const d=rupiahInputDigits(el.value);if(d!==null&&d!=="")el.value=rupiahIntegerFormatter.format(Number(d))}));
}
async function saveRapbmLine(categoryId,button){
  const item=rapbmLines.find(r=>r.category_id===categoryId),el=[...document.querySelectorAll("[data-rapbm-amount]")].find(x=>x.dataset.rapbmAmount===categoryId);
  if(!item||!el)return;
  const digits=rupiahInputDigits(el.value),amount=Number(digits);
  if(digits===null||digits===""||!Number.isSafeInteger(amount)||amount<0){alert("Isi rencana anggaran dengan bilangan rupiah yang valid (boleh 0).");return}
  if(item.has_plan&&!canUpdate()||!item.has_plan&&!canCreate()){alert("Akun tidak memiliki izin mengubah rencana anggaran.");return}
  button.disabled=true;button.textContent="Menyimpan...";
  try{
    const payload={academic_year_id:rapbmYear.id,category_id:categoryId,planned_amount:amount,updated_by:profile.id};
    let request;
    if(item.has_plan)request=api.from("rapbm_budget_lines").update(payload).eq("academic_year_id",rapbmYear.id).eq("category_id",categoryId).select("id");
    else request=api.from("rapbm_budget_lines").insert({...payload,created_by:profile.id}).select("id");
    const {error}=await request;
    if(error)throw error;
    await loadRapbm();
  }catch(err){alert("Gagal menyimpan RAPBM: "+err.message)}
  finally{button.disabled=false;button.textContent="Simpan"}
}
function printRapbm(){
  const w=window.open("","_blank");if(!w){alert("Izinkan pop-up untuk mencetak RAPBM.");return}
  const lines=rapbmLines.map((r,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(r.transaction_type==="INCOME"?"Pemasukan":"Pengeluaran")+'</td><td>'+esc(r.category_name)+'</td><td>'+esc(money(r.planned_amount))+'</td><td>'+esc(money(r.realized_amount))+'</td><td>'+esc(money(r.remaining_amount))+'</td></tr>').join("");
  w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>RAPBM 2026/2027</title><style>@page{size:A4 landscape;margin:12mm}body{font:11px Arial,sans-serif}h2,p{text-align:center}table{width:100%;border-collapse:collapse}th,td{border:1px solid #777;padding:7px;text-align:left}th{background:#eee}.sign{display:flex;justify-content:space-between;margin-top:45px}.sign div{width:260px;text-align:center}</style></head><body><h2>RAPBM MA NURUL ISLAM KARANGCEMPAKA</h2><p>Tahun Pelajaran 2026/2027 — Rencana dan Realisasi Anggaran</p><table><thead><tr><th>No</th><th>Jenis</th><th>Kategori</th><th>Rencana</th><th>Realisasi</th><th>Selisih</th></tr></thead><tbody>'+lines+'</tbody></table><div class="sign"><div>Mengetahui,<br>Kepala Madrasah</div><div>Bendahara<br><br><br><b>'+esc(financeTreasurerSignature())+'</b></div></div></body></html>');w.document.close();w.print();
}
$("rapbmRefresh").addEventListener("click",loadRapbm);
$("rapbmPrint").addEventListener("click",printRapbm);
