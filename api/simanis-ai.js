// Vercel serverless API. Secret OPENAI_API_KEY hanya di Environment Variables Vercel.
const SUPABASE_URL=(process.env.SUPABASE_URL||"https://zevdqmrlcrnwkeqejbxm.supabase.co").replace(/\/$/,"");
const SUPABASE_KEY=process.env.SUPABASE_ANON_KEY||"sb_publishable_wq4BZQjDm33hVB6E6QISuA_cQP7xmEH";
const ALLOWED=new Set(["TP","ATP","PROTA","PROMES","MODUL_AJAR","BAHAN_AJAR","LKPD","MEDIA_PEMBELAJARAN","ASESMEN"]);
const NAMES={TP:"Tujuan Pembelajaran",ATP:"Alur Tujuan Pembelajaran",PROTA:"Program Tahunan",PROMES:"Program Semester",MODUL_AJAR:"Modul Ajar/RPP",BAHAN_AJAR:"Bahan Ajar",LKPD:"LKPD",MEDIA_PEMBELAJARAN:"Rancangan Media Pembelajaran",ASESMEN:"Instrumen Asesmen"};
function bad(res,status,message){res.statusCode=status;return res.end(JSON.stringify({error:message}));}
async function db(token,route,method="GET",payload){
  const result=await fetch(SUPABASE_URL+"/rest/v1/"+route,{
    method,headers:{"apikey":SUPABASE_KEY,"Authorization":"Bearer "+token,"Content-Type":"application/json"},
    body:payload===undefined?undefined:JSON.stringify(payload)
  });
  const txt=await result.text();let val;try{val=txt?JSON.parse(txt):null}catch{val=txt}
  if(!result.ok)throw new Error("Database error ("+result.status+"): "+String(val?.message||val?.error||"akses ditolak"));
  return val;
}
function text(v,max=250){return typeof v==="string"?v.trim().slice(0,max):""}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const promptRules=[
"Anda adalah pakar kurikulum dan perancang perangkat ajar Madrasah Aliyah di Indonesia.",
"Hanya CP dalam data referensi database terverifikasi yang boleh digunakan sebagai dasar.",
"JANGAN mengubah/mengarang kutipan CP atau mengklaim rujukan regulasi lain yang tidak diberikan.",
"Hasil dalam bahasa Indonesia baku, kontekstual, praktis, siap diedit guru.",
"Buat isi operasional dan rinci, bukan outline kosong. Tandai sebagai DRAF YANG PERLU VERIFIKASI GURU.",
"Semua TP harus terukur, ATP berurutan, alokasi waktu realistis.",
"Prota dan Promes memiliki tabel alokasi materi, minggu/JP, dan catatan kalender asumsi.",
"Modul Ajar/RPP mencantumkan tujuan, materi, langkah pendahuluan-inti-penutup, diferensiasi, asesmen, rubrik, tindak lanjut, refleksi.",
"LKPD berisi instruksi, aktivitas dan lembar jawaban serta rubrik untuk guru.",
"Media Pembelajaran berupa storyboard/isi slide/aktivitas media, bukan klaim telah membuat file PPT/video.",
"Asesmen memuat kisi-kisi, soal formatif dan sumatif, kunci dan rubrik, tingkat kesulitan berimbang.",
"Jika CP tidak cukup rinci untuk aspek tertentu, sampaikan sebagai asumsi dan minta guru memverifikasi."
].join("\n");
module.exports=async function(req,res){
  res.setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("Cache-Control","no-store");
  if(req.method!=="POST")return bad(res,405,"Gunakan metode POST.");
  try{
    const token=String(req.headers.authorization||"").match(/^Bearer\s+(.+)$/i)?.[1];
    if(!token)return bad(res,401,"Silakan login kembali.");
    const body=typeof req.body==="string"?JSON.parse(req.body||"{}"):(req.body||{});
    const {class_id,subject_id,cp_source_id,document_type}=body;
    if(![class_id,subject_id,cp_source_id].every(x=>uuid.test(String(x)))||!ALLOWED.has(document_type))return bad(res,400,"Kelas, mata pelajaran, CP dan jenis perangkat harus dipilih.");
    const semester=text(body.semester,16),topic=text(body.topic,180),notes=text(body.notes,700);
    const jp=Number(body.jp_per_week),meetings=Number(body.meetings);
    if(!Number.isInteger(jp)||jp<1||jp>20||!Number.isInteger(meetings)||meetings<1||meetings>40)return bad(res,400,"Alokasi JP atau jumlah pertemuan tidak valid.");
    const ur=await fetch(SUPABASE_URL+"/auth/v1/user",{headers:{apikey:SUPABASE_KEY,Authorization:"Bearer "+token}});
    if(!ur.ok)return bad(res,401,"Sesi login kedaluwarsa.");
    const user=await ur.json();
    const [profiles,perm,ctx,cpRows,classes]=await Promise.all([
      db(token,"profiles?select=id,role,is_active&id=eq."+user.id+"&limit=1"),
      db(token,"rpc/get_my_module_permission","POST",{p_module_code:"SIMANIS_AI"}),
      db(token,"rpc/get_my_grade_context","POST",{}),
      db(token,"curriculum_cp_sources?select=id,subject_id,phase,regulation,source_title,source_url,content,revision&id=eq."+cp_source_id+"&is_verified=eq.true&limit=1"),
      db(token,"classes?select=id,grade_level,name&id=eq."+class_id+"&limit=1")
    ]);
    if(!profiles?.[0]?.is_active||!["GURU","WALI_KELAS","SUPER_ADMIN"].includes(profiles[0].role))return bad(res,403,"Akun ini tidak diizinkan menggunakan fitur AI.");
    if(perm?.can_view!==true||perm?.can_create!==true)return bad(res,403,"Akses SIMANIS AI belum diaktifkan.");
    if(!Array.isArray(ctx)||!ctx.some(c=>c.class_id===class_id&&c.subject_id===subject_id))return bad(res,403,"Kelas dan mapel tidak ada dalam penugasan guru.");
    const cp=cpRows?.[0],cl=classes?.[0];
    if(!cp||!cl||cp.subject_id!==subject_id)return bad(res,400,"CP belum terverifikasi atau tidak cocok dengan mata pelajaran.");
    const phase=Number(cl.grade_level)===10?"E":"F";
    if(cp.phase!==phase)return bad(res,400,"Fase CP tidak cocok dengan kelas yang dipilih.");
    if(!process.env.OPENAI_API_KEY)return bad(res,503,"Layanan AI belum diaktifkan. Admin perlu mengisi OPENAI_API_KEY pada Vercel.");
    const allowed=await db(token,"rpc/simanis_ai_claim_daily_quota","POST",{});
    if(allowed!==true)return bad(res,429,"Kuota 10 generasi per hari telah habis. Coba lagi besok.");
    const model=process.env.OPENAI_MODEL||"gpt-4.1-mini";
    const input=JSON.stringify({
      perangkat:NAMES[document_type],kelas:cl.name,fase:phase,semester:semester||"Belum ditentukan",
      jp_per_minggu:jp,jumlah_pertemuan:meetings,topik:topic||"Semua lingkup CP",
      preferensi_guru:notes,referensi_cp:{
        nama_dokumen:cp.source_title,regulasi:cp.regulation,revisi:cp.revision,
        url:cp.source_url,teks_cp:cp.content
      }
    });
    const generated=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",signal:AbortSignal.timeout(60000),
      headers:{"Authorization":"Bearer "+process.env.OPENAI_API_KEY,"Content-Type":"application/json"},
      body:JSON.stringify({model,store:false,instructions:promptRules,input,max_output_tokens:5000})
    });
    const answer=await generated.json().catch(()=>({}));
    if(!generated.ok){
      console.warn("SIMANIS AI provider status:",generated.status);
      return bad(res,502,"AI belum dapat menghasilkan dokumen. Periksa konfigurasi model, kuota, atau billing API.");
    }
    const output=(answer.output_text||((answer.output||[]).flatMap(x=>(x.content||[]).filter(c=>c.type==="output_text").map(c=>c.text)).join("\n"))).trim();
    if(!output)return bad(res,502,"AI belum mengembalikan teks perangkat pembelajaran.");
    return res.end(JSON.stringify({content:output,title:NAMES[document_type]+(topic?" — "+topic:""),model,reference:cp.source_title}));
  }catch(err){
    console.error("SIMANIS AI server error:",err?.name||"Error");
    return bad(res,500,"Permintaan gagal diproses. Silakan ulangi atau hubungi admin SIMANIS.");
  }
};