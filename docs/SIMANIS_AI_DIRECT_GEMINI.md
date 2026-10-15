# SIMANIS AI: Generate Dokumen Langsung di Aplikasi (Gemini)

## Tujuan
Guru dapat membuat perangkat pembelajaran **langsung di SIMANIS**, tanpa berpindah ke ChatGPT. Tombol **Buat Langsung dengan AI** mengirim konteks kelas, mata pelajaran, CP, topik dan instruksi guru dari akun terautentikasi ke **Gemini API (Google)** melalui endpoint Vercel server-side. Hasil teks tampil di editor, dapat diedit, disimpan, dan diekspor memakai fitur lama.

Sembilan jenis: TP, ATP, Prota, Promes, Modul Ajar/RPP, Bahan Ajar, LKPD, Rancangan Media Pembelajaran (teks/storyboard), Instrumen Asesmen.

## Pembaruan kualitas Modul Ajar (15 Oktober 2026)

- Guru kini mengisi **JP per Minggu** dan **JP per Pertemuan** secara terpisah. Sistem menghitung **jumlah pertemuan × JP per pertemuan**, dengan asumsi 45 menit/JP. Contoh: 8 × 2 = **16 JP = 720 menit**, bukan 32 JP. Jumlah minggu = total JP ÷ JP per minggu; cek kalender akademik.
- Mode **MODUL_AJAR** dibatasi 12 pertemuan per dokumen agar skenario pembelajaran mendalam tidak mengalahkan ruang asesmen/lampiran. Pecah topik besar menjadi beberapa modul.
- Saat tombol **Buat Langsung dengan AI** ditekan, SIMANIS menggunakan **dua permintaan Gemini paralel** dalam satu klaim kuota internal: (a) identitas, CP, TP, materi dan skenario **semua pertemuan**, (b) asesmen diagnostik, formatif, sumatif, LKPD, kunci jawaban dan rubrik. Hasil digabung otomatis dan tetap menjadi **DRAF** untuk diperiksa guru. Ini dapat menggunakan kuota permintaan Google lebih cepat daripada versi satu panggilan.
- Setiap pertemuan ditargetkan memiliki 15+60+15 menit pada contoh 2 JP, lengkap aktivitas guru/siswa, media, diferensiasi berdasarkan kebutuhan, asesmen formatif, exit ticket dan tindak lanjut.
- Pemeriksaan keluaran otomatis menandai **pertemuan yang tidak terdeteksi**, rubrik yang belum memiliki 4 tingkat, serta kunci dan LKPD yang tidak terdeteksi. Ini pemeriksaan heuristik, **bukan jaminan akurasi ilmiah atau kelengkapan**; guru harus meninjau dan melengkapi.
- Export **Word-kompatibel (.doc)** dan **Cetak/PDF** kini mengubah heading Markdown, tabel dan daftar menjadi layout dokumen yang lebih terstruktur. Belum merupakan file `.docx` native.
- Jika salah satu bagian Gemini gagal akibat kuota atau gangguan, bagian yang berhasil tetap ditampilkan tetapi diberi peringatan bahwa dokumen belum lengkap. Ulangi pembuatan saat kuota tersedia; jangan tandai final sebelum melengkapi.
- Petunjuk kimia menekankan keamanan laboratorium dan keakuratan eksperimen laju reaksi; hasil eksperimen tidak boleh diada-adakan.

## Persyaratan dan aktivasi
1. Tambahkan kunci API gratis melalui Google AI Studio: https://aistudio.google.com/apikey . Pastikan project mendapat kuota Free Tier untuk model yang dipilih.
2. **JANGAN kirim API Key ke chat, GitHub, JavaScript, atau siswa.** Masukkan hanya di **Vercel → Project SIMANIS → Settings → Environment Variables**:
   - Key: GEMINI_API_KEY
   - Value: kunci pribadi dari Google AI Studio.
   - Target: Production (opsional Preview untuk pengujian).
   - Opsional: GEMINI_MODEL = gemini-3.1-flash-lite (default). Pastikan model aktif pada akun pengguna.
3. Redeploy versi terakhir dari GitHub main agar environment variable baru diterapkan.
4. Jalankan migrasi Supabase migrations/20261015_simanis_ai_direct_quota.sql (hanya sekali; DDL additive). Fungsi RPC claim_daily_quota mengizinkan 3 kali per akun guru/hari, dengan batas sekolah 60 kali/hari, berdasarkan WIB.
5. Login guru, pilih kelas/mapel yang benar-benar ditugaskan kepadanya, pilih CP terverifikasi atau tempel CP manual **minimal 100 karakter** dari dokumen resmi, pilih perangkat, klik **Buat Langsung dengan AI**.
6. Tinjau hasil; **Simpan Draf**, **Tandai Final**, atau cetak dan unduh dokumen. Jika sumber CP belum ada, siapkan satu kali dahulu.
7. Jika API Key tidak tersedia, tombol dinonaktifkan dengan status yang jelas dan mode prompt manual tetap dapat digunakan.

## Keamanan dan privasi
- API Key tidak pernah dikirim ke browser atau Supabase; hanya dieksekusi oleh Vercel Serverless Function.
- Backend wajib menerima token Supabase terautentikasi, memastikan profil GURU/WALI_KELAS/SUPER_ADMIN aktif, hak modul SIMANIS_AI, dan penugasan kelas + mapel melalui RPC.
- Mengambil CP terverifikasi dari database milik madrasah; jika menggunakan CP manual, teks wajib minimal 100 karakter, sumber dapat dilengkapi tautan HTTPS. AI tidak boleh mengarang bunyi CP atau mengklaim CP manual telah diverifikasi.
- Teks konteks, CP, topik, dan instruksi guru dikirim ke **Google Gemini**, bukan ke ChatGPT. **Menurut dokumentasi Google, Free Tier dapat menggunakan data untuk meningkatkan produk Google.** Jangan memasukkan data pribadi siswa, rekam medis, NIS/NISN, alamat, atau informasi sensitif.
- Hasil AI adalah DRAF; guru bertanggung jawab atas ketepatan CP, substansi ilmiah, asesmen dan kepatutan.
- Rate limits Google dapat berubah; backend menampilkan pesan kuota atau error yang jelas.
- Kuota diklaim sebelum API dipanggil; panggilan yang gagal juga mengonsumsi kuota internal. Ini sengaja konservatif agar penggunaan terkendali.
- Endpoint GET /api/simanis-ai hanya mengembalikan enabled dan nama model, tanpa membocorkan kunci API.

## Model dan biaya
Model default gemini-3.1-flash-lite memiliki Free Tier pada dokumentasi resmi: https://ai.google.dev/gemini-api/docs/pricing dan https://ai.google.dev/gemini-api/docs/rate-limits . Kuota gratis dan ketersediaan regional tergantung Google Cloud project. Mengaktifkan billing pada project Google dapat menyebabkan biaya; periksa status Free Tier dan pengaturan biaya pada AI Studio.

ChatGPT Plus **tidak memberikan akses OpenAI API**. Integrasi ini tidak memakai OpenAI API Key.

## Cakupan uji
- [x] Sintaks JS dan validasi HTML element ID
- [x] Mock test backend: berhasil untuk user berizin, 403 kelas tak diampu, 422 CP terlalu singkat, 429 batas kuota, 503 tanpa key.
- [ ] Real account login dan generasi ke Gemini, memerlukan GEMINI_API_KEY produksi yang aktif.
- [ ] Uji kuota dan isolasi data dua guru pada produksi.
- [ ] Review kualitas isi dan ekspor .doc/PDF.
- [ ] Pemeriksaan dokumen CP resmi oleh admin kurikulum.

Catatan: unduh Word masih format .doc (Word-compatible), bukan native .docx. Media Pembelajaran menyusun rancangan/isi, bukan langsung menghasilkan PPT/video.
