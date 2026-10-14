# SIMANIS AI — Asisten Perangkat Pembelajaran (Tanpa API)

**Status:** implementasi tahap 1 di GitHub branch `feature/simanis-ai-guru-mvp`, Pull Request #5. Belum aktif di produksi sampai kode di-merge, migrasi ditinjau/dijalankan, dan diuji dengan akun guru.

Tidak memerlukan OpenAI API Key dan **tidak** mengirim data ke model AI dari SIMANIS. Guru menyalin prompt ke ChatGPT menggunakan akun miliknya, lalu menempel kembali jawaban yang telah ditelaah guru.

## Alur guru

1. Login SIMANIS sebagai GURU/WALI_KELAS dengan jadwal mengajar yang aktif.
2. Buka menu **SIMANIS AI**; pilih kelas & mata pelajaran (diambil dari penugasan SIMANIS).
3. Pilih CP resmi dari perpustakaan CP SIMANIS **jika tersedia dan sudah diverifikasi**. Jika belum ada, tempel CP manual dari dokumen pemerintah yang sesuai fase/mapel dan, jika memungkinkan, tautan sumber.
4. Pilih salah satu dari 9 keluaran: TP, ATP, Prota, Promes, Modul Ajar/RPP, Bahan Ajar, LKPD, Rancangan Media Pembelajaran, Instrumen Asesmen.
5. Lengkapi semester, JP per minggu, jumlah pertemuan, topik, dan kebutuhan pembelajaran.
6. Klik **Siapkan Prompt ChatGPT** → **Salin Prompt** → **Buka ChatGPT** (akun Free atau Plus juga bisa digunakan sesuai batasannya).
7. Tempel prompt di ChatGPT. **Jika CP belum diberikan**, ChatGPT diarahkan meminta teks CP resmi terlebih dahulu, bukan mengarang CP.
8. Salin jawaban ChatGPT, tempel ke **Editor Hasil**, edit/periksa, kemudian **Simpan Draf** atau **Tandai Final**.
9. Buka kembali draf di **Dokumen Saya**; unduh Word-kompatibel `.doc` atau gunakan **Cetak/PDF** di browser.

**Alternatif:** tombol **Gunakan Kerangka Dokumen** menyisipkan struktur kosong sesuai jenis perangkat tanpa menjalankan ChatGPT.

## Penggunaan CP dan validasi

- Tabel `curriculum_cp_sources` awalnya kosong. Admin mengimpor teks dari dokumen kurikulum yang sah dan menandai `is_verified=true` **hanya setelah** membandingkan dengan dokumen pemerintah aslinya (isi, mata pelajaran, fase, tanggal keputusan, dan tautan).
- Saat CP berasal dari perpustakaan yang sudah diverifikasi, prompt menyertakan teks, regulasi, dan sumber.
- Saat guru menempel CP manual, prompt menyatakan bahwa isi tersebut **belum diverifikasi madrasah**. Guru bertanggung jawab memeriksa keaslian dan kesesuaiannya.
- Saat CP kosong, prompt berisi placeholder wajib. ChatGPT diperintahkan meminta CP dulu sebelum menyusun isi perangkat.
- Dokumen tetap bisa disimpan sebagai **DRAFT** tanpa CP. Agar menjadi **FINAL**, harus ada CP terverifikasi SIMANIS atau teks CP manual dengan URL sumber HTTPS serta konfirmasi review guru.
- Link pencarian referensi kurikulum umum: https://kurikulum.kemendikdasmen.go.id/panduan-mapel (khusus mapel keagamaan MA, cocokkan juga dengan regulasi Kementerian Agama yang berlaku).
- Konten yang ditempel adalah data guru; **jangan pernah memasukkan identitas, data kesehatan, alamat, atau informasi pribadi siswa** ke prompt.

## Deployment / aktivasi

1. Review **Pull Request #5** di GitHub dan semua berkas yang berubah.
2. Lakukan pengujian pratinjau branch bila tersedia dari Vercel; jangan merge tanpa persetujuan pengelola.
3. Setelah disetujui, merge kode GitHub ke `main`.
4. Supabase → project **SIMANIS** → SQL Editor: **review dan jalankan** `migrations/20261015_simanis_ai_mvp.sql`. Migrasi:
   - membuat `curriculum_cp_sources` dan `teacher_ai_documents`, keduanya dengan RLS;
   - memberi izin baca CP **hanya** untuk yang terverifikasi;
   - memberi izin guru untuk mengelola dokumen miliknya sendiri;
   - mendaftarkan menu SIMANIS AI untuk peran guru, wali kelas, dan super admin.
5. Siapkan CP Fase E/F mapel prioritas (contoh Kimia); verifikasi sumbernya sebelum `is_verified=true`.
6. Buka menu sebagai guru untuk verifikasi langkah 1–9, lalu uji isolasi data dengan akun guru kedua.

**Tidak ada OpenAI API Key, billing, backend generasi, atau kuota token.** Karena pekerjaan AI dilakukan di ChatGPT, batas penggunaannya bergantung paket ChatGPT yang digunakan masing-masing guru.

## Contoh SQL impor CP (placeholder, bukan data CP)

```sql
insert into public.curriculum_cp_sources
(subject_id,phase,regulation,source_title,source_url,content,revision,is_verified)
select s.id, 'F', '<NOMOR KEPUTUSAN RESMI>',
       '<JUDUL CP RESMI>', 'https://<SUMBER RESMI>',
       '<TEMPELKAN TEKS CP LENGKAP DARI DOKUMEN RESMI>',
       '2025', false
from public.subjects s
where s.code='<KODE MATA PELAJARAN>'
limit 1;
```

Catatan: kolom `content` memiliki batas minimum 100 karakter agar tidak terjadi pengisian CP kosong; contoh placeholder di atas tidak boleh dijalankan sebagai data sesungguhnya.

## Cakupan dan batasan

- Versi awal ini membuat **prompt yang bisa disalin**, bukan memanggil atau mengendalikan ChatGPT langsung.
- Unduhan Word berupa HTML-compatible `.doc`, **bukan `.docx` native**; untuk versi `.docx` pilih Save As di Word.
- Media Pembelajaran berupa kerangka/storyboard, bukan file PPT/video otomatis.
- Dokumen milik guru hanya dapat diakses oleh akun pemilik melalui RLS Supabase; halaman memiliki pemeriksaan menu dan login SIMANIS.
- Akun guru hanya melihat konteks kelas/mapel yang diperoleh dari fungsi `get_my_grade_context`.
- Guru bertanggung jawab mengecek ketepatan materi, CP, tujuan, waktu, asesmen, dan referensi.

## Rencana uji sebelum rilis

- [ ] Guru melihat menu SIMANIS AI.
- [ ] Kelas/mapel sesuai penugasan aktif, tidak menampilkan kelas yang tidak diampu.
- [ ] Jika perpustakaan CP kosong, pengguna masih dapat menyiapkan prompt dengan CP manual atau placeholder.
- [ ] Jika CP terverifikasi tersedia, teks asli CP tercantum di prompt dengan label terverifikasi.
- [ ] Tombol **Salin Prompt** menyalin teks lengkap termasuk instruksi jenis perangkat.
- [ ] Sembilan pilihan menghasilkan prompt & kerangka yang berbeda.
- [ ] Tempel jawaban, simpan draf, muat ulang, dan edit draf.
- [ ] Guru lain tidak dapat membaca dokumen akun berbeda.
- [ ] FINAL tidak bisa tanpa CP; finalisasi manual membutuhkan URL sumber.
- [ ] Cetak/PDF dan unduh `.doc` berfungsi di Chrome desktop dan ponsel.
- [ ] Tidak ada perubahan pada menu nilai/absensi/administrasi lama.
