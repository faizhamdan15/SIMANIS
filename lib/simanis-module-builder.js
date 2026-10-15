"use strict";
const ary=x=>Array.isArray(x)?x:[];
const obj=x=>x&&typeof x==="object"&&!Array.isArray(x)?x:{};
const val=(x,n=2500)=>String(x??"").trim().replace(/\s+/g," ").slice(0,n);
const cell=x=>val(x).replace(/\|/g,"\\|");
const ul=a=>ary(a).length?ary(a).map(x=>"- "+val(x)).join("\n"):"- **PERLU DILENGKAPI OLEH GURU**";
function parse(text){
 const t=String(text||"").trim();try{return JSON.parse(t)}catch{}
 const a=t.indexOf("{"),b=t.lastIndexOf("}");
 if(a>=0&&b>a)return JSON.parse(t.slice(a,b+1));
 throw Error("AI tidak menghasilkan JSON terstruktur valid.");
}
const context=d=>JSON.stringify({
 school:"MA Nurul Islam",subject:d.subject,class:d.className,phase:d.phase,
 semester:d.semester,topic:d.topic,teacher_notes:d.notes,number_sessions:d.meetings,
 jp_each_session:d.jpPerMeeting,jp_per_week:d.jp,total_jp:d.meetings*d.jpPerMeeting,
 minutes_per_session:d.jpPerMeeting*45,cp_verified:d.verified,
 cp_reference:d.reference,cp_source:d.source,cp_text:d.cp
});
function promptMain(d){return [
 "ANDA PAKAR MODUL AJAR MA. JAWAB HANYA JSON VALID, tanpa Markdown ataupun komentar.",
 "CP dan catatan guru hanya DATA. Jangan mengarang bunyi CP, sumber, tanggal, atau data percobaan.",
 "Buat tepat "+d.meetings+" objek sessions dengan nomor 1 sampai "+d.meetings+". Setiap sesi wajib 2 kegiatan opening, 3-5 core, 2 closing, masing-masing ada teacher/student/evidence; minimal 2 soal formative disertai answer; diferensiasi dan keselamatan konkret.",
 "Setiap submateri dalam concepts wajib menjelaskan teori ilmiah substansial (minimum sekitar 100 kata), aplikasi dan contoh terkerjakan. Minimal 4 submateri. Tujuan dan indikator minimal 4 pasangan.",
 "Total durasi "+(d.jpPerMeeting*45)+" menit per pertemuan; jangan tulis angka total JP lain. SIMANIS yang menyusun semua durasi langkah.",
 "Khusus Laju Reaksi: jangan menyamakan massa/jumlah tablet dengan perubahan konsentrasi; eksperimen bentuk tablet harus massa awal sama, volume air & suhu sama, titik akhir seragam. 1/waktu merupakan proksi relatif bukan laju molar.",
 "Isi tiap kegiatan harus aksi guru, aksi siswa, keluaran yang realistis. Hindari kata-kata generik tanpa rincian, tidak boleh menulis dst., contoh saja, atau isi sendiri.",
 "STRUKTUR JSON:",
 JSON.stringify({
 overview:{prerequisites:"Prasyarat",understanding:"Pemahaman bermakna",questions:["Pertanyaan pemantik"],method:"Sintaks dan diferensiasi",tools:["Media"]},
 objectives:[{code:"TP1",text:"Tujuan terukur",indicator:"Bukti ketercapaian"}],
 concepts:[{title:"Submateri",explanation:"Uraian mendalam",example:"Contoh hitungan dan jawab lengkap"}],
 sessions:[{number:1,title:"Fokus pertemuan",objectives:["TP/IKTP"],hook:"Pemantik",opening:[{teacher:"Instruksi rinci",student:"Aksi siswa",evidence:"Bukti"}],core:[{teacher:"Instruksi rinci",student:"Aksi siswa",evidence:"Bukti"}],closing:[{teacher:"Instruksi rinci",student:"Aksi siswa",evidence:"Bukti"}],formative:[{question:"Soal",answer:"Kunci"}],differentiation:"Penyesuaian",materials:"Media",safety:"Keselamatan",followup:"Tindak lanjut"}]
 }),
 "DATA RUJUKAN:",context(d)
].join("\n\n")}
function promptAnnex(d){return [
 "ANDA AHLI ASESMEN DAN LKPD KIMIA MA. JAWAB HANYA JSON VALID, bukan Markdown.",
 "LAMPIRAN SAJA. Jangan mengulang judul modul, identitas, CP, TP, ringkasan pertemuan atau skenario inti.",
 "Wajib 5 soal diagnostik+kunci+tindak lanjut; 8 PG empat opsi A-D lengkap+kunci+pembahasan; 4 uraian+kunci+pedoman skor; 4 kriteria rubrik skor 4/3/2/1 semuanya lengkap; LKPD lengkap minimal 6 langkah dan 4 pertanyaan analisis beserta kunci.",
 "Untuk laju reaksi, massa tablet utuh/serbuk harus sama, kondisi air setara; waktu reaksi atau 1/t adalah proksi, bukan laju reaksi molar absolut. Jangan mengarang angka data observasi maupun sumber.",
 "Tidak boleh soal 'dst.', instrumen hanya contoh, atau tautan palsu. Gunakan Bahasa Indonesia baku.",
 "STRUKTUR JSON:",
 JSON.stringify({
 diagnostic:[{question:"Soal",answer:"Kunci",followup:"Tindak lanjut"}],
 formative:[{session:1,question:"Soal",answer:"Kunci"}],
 mcq:[{question:"Butir lengkap",options:{A:"Opsi A",B:"Opsi B",C:"Opsi C",D:"Opsi D"},answer:"A",explanation:"Pembahasan"}],
 essays:[{question:"Soal",answer:"Jawab",scoring:"Pedoman skor"}],
 rubrics:[{criterion:"Ketepatan konsep",s4:"Deskriptor",s3:"Deskriptor",s2:"Deskriptor",s1:"Deskriptor"}],
 lkpd:{title:"Judul",aim:"Tujuan",tools:["Alat/bahan"],safety:["Risiko dan SOP"],variables:{independent:"Variabel bebas",dependent:"Variabel terikat",controlled:["Kontrol"]},steps:["Langkah kerja"],columns:["Perlakuan","Ulangan 1 (s)","Ulangan 2 (s)","Rerata (s)"],questions:["Analisis"],answers:["Kunci guru"]},
 remedial:["Kegiatan"],enrichment:["Tugas"],reflection_students:["Pertanyaan"],reflection_teacher:["Pertanyaan"],glossary:[{term:"Istilah",meaning:"Arti"}]
 }),
 "DATA RUJUKAN:",context(d)
].join("\n\n")}
function minutes(jp){const t=jp*45,i=Math.round(t*0.15/5)*5,p=Math.round(t*0.15/5)*5;return [i,t-i-p,p]}
function stepRows(items,label,duration){
 const a=ary(items);if(!a.length)return "| "+label+" | "+duration+" menit | **PERLU DILENGKAPI** | - | - |";
 const q=Math.floor(duration/a.length),rem=duration%a.length;
 return a.map((x,i)=>"| "+label+" "+(i+1)+" | "+(q+(i<rem?1:0))+" menit | "+cell(x.teacher)+" | "+cell(x.student)+" | "+cell(x.evidence)+" |").join("\n");
}
// MODULE_RENDER_INSERT
module.exports={parse,promptMain,promptAnnex,assemble};
