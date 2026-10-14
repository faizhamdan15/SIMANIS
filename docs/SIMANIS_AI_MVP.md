# SIMANIS AI — Tahap 1 (MVP Guru)

## Sudah disiapkan
- Halaman privat simanis-ai.html dan simanis-ai.js, mengikuti akun SIMANIS yang sudah ada.
- Sembilan jenis draf perangkat: TP, ATP, Prota, Promes, Modul Ajar/RPP, Bahan Ajar, LKPD, rancangan media, asesmen.
- Kelas/mapel berasal dari penugasan guru (get_my_grade_context).
- CP hanya dari tabel referensi resmi yang sudah diverifikasi. Tidak ada CP karangan AI.
- Hasil dapat diedit, disimpan sebagai draf/final, diarsipkan privat dan diekspor Word-kompatibel .doc atau lewat dialog Cetak/PDF.
- Backend api/simanis-ai.js memeriksa identitas login, hak modul, penugasan kelas/mapel, kesesuaian fase, dan kuota 10 generasi per hari (atomik).

## Aktivasi aman (urutannya penting)
1. Review PR dan uji pratinjau Vercel; jangan menggabungkan ke main tanpa persetujuan pengelola.
2. Gabungkan kode ke main, sehingga endpoint dan halaman tersedia tetapi menu SIMANIS AI belum terlihat.
3. Supabase SQL Editor → project SIMANIS → jalankan migrations/20261015_simanis_ai_mvp.sql sekali, setelah meninjau seluruh DDL/RLS. Ini mengaktifkan menu dan tabel.
4. Input teks CP pemerintah (fase E/F, mapel), regulasi, URL sumber resmi. Jangan set is_verified=true sebelum isi dibandingkan secara manual dengan dokumen asli. Tabel CP pada awalnya kosong, jadi generate dinonaktifkan.
5. Vercel → project SIMANIS → Settings → Environment Variables:
   - OPENAI_API_KEY = kunci API Anda sendiri (SERVER-SIDE; jangan pernah masukkan ke JS/HTML/GitHub/chat).
   - OPENAI_MODEL = gpt-4.1-mini (opsional; sesuaikan dengan model yang tersedia dan biaya API).
   - SUPABASE_URL dan SUPABASE_ANON_KEY opsional; kode memakai endpoint dan publishable key yang memang publik.
6. Redeploy Vercel setelah menyetel variabel.
7. Login sebagai guru berjadwal → SIMANIS AI → pilih mapel dengan CP yang telah disahkan → generate TP → simpan → buka lagi → ekspor. Cek akun guru lain tidak bisa membaca dokumen pengguna lain.

## Impor referensi CP
Gunakan nama kode mapel yang benar-benar tersedia di public.subjects. Contoh template (JANGAN isi teks contoh sebagai CP resmi):

    insert into public.curriculum_cp_sources
    (subject_id,phase,regulation,source_title,source_url,content,revision,is_verified)
    select s.id, 'F', '<nomor peraturan yang berlaku>',
           '<judul dokumen CP resmi>', 'https://<alamat-sumber-resmi>',
           '<PASTE TEKS CP LENGKAP DARI DOKUMEN RESMI>',
           '2025', false
    from public.subjects s where s.code='<KODE_MAPEL>' limit 1;

Setelah verifikasi independen, admin dapat mengubah is_verified = true dan verified_at = now() menggunakan SQL Editor (akses admin database saja).

## Batasan dan tindak lanjut
- Belum ada CP yang diunggah pada skema baru. AI baru aktif setelah minimal satu CP divalidasi.
- Format Word saat ini adalah .doc HTML-compatible, bukan .docx native. Cetak PDF memakai fitur browser.
- Media pembelajaran saat ini berupa rancangan isi/storyboard, bukan berkas PPT/video jadi.
- 10 permintaan generasi per akun/hari; kuota diklaim sebelum memanggil model, termasuk jika provider gagal.
- Sebelum digunakan skala besar, tambah audit penggunaan terpusat, observabilitas, dan biaya/budget alerts.
- OpenAI API memiliki penagihan tersendiri dari langganan ChatGPT. Periksa biaya model dan batas penggunaan.
- Penilaian dan keputusan akhir isi perangkat tetap menjadi tanggung jawab guru/pihak madrasah.
- Jangan mengunggah data sensitif siswa dalam kolom instruksi guru.