# Perbaikan Kuota SIMANIS AI — 15 Oktober 2026

## Masalah
Batas awal 3 generasi/guru/hari sangat rendah untuk fase uji coba. Pada 15 Oktober ada satu akun yang telah memakai ketiga kesempatan, sementara batas sekolah baru dipakai 3 dari 60.

## Perubahan
- Batas internal guru: **12 generasi/hari**.
- Batas internal sekolah: **120 generasi/hari**.
- Hari penggunaan dihitung berdasarkan Asia/Jakarta.
- Sistem membuat **reservation UUID** untuk setiap permintaan. Bila Google Gemini gagal menghasilkan satu modul utuh (misalnya HTTP 429, timeout, output invalid), fungsi server akan mencoba mengembalikan satu jatah guru dan sekolah secara aman.
- Refund hanya bagi pemilik reservasi, hanya satu kali, dalam 10 menit, menggunakan transaksi terkunci (advisory lock). Browser tidak mengetahui UUID reservasi; fungsi SQL mengisolasi kuota pengguna lain.
- Tampilan guru memperlihatkan **sisa kesempatan** setelah login dan setelah generasi.
- Tidak mengubah nilai siswa, absensi, kelas, dokumen lama, maupun konfigurasi Gemini dan penagihan Google.
- Kuota resmi provider Gemini tetap berlaku; batas internal SIMANIS tidak memberi jaminan free tier tak habis.

## Cara aktivasi jika migrasi connector tidak diizinkan

1. Login di [Supabase Dashboard SIMANIS](https://supabase.com/dashboard/project/zevdqmrlcrnwkeqejbxm/sql/new) melalui akun pemilik proyek.
2. Buka dan salin **seluruh** isi [migrations/20261015_simanis_ai_retry_refund.sql](https://github.com/faizhamdan15/SIMANIS/blob/fix/simanis-ai-quota-retries/migrations/20261015_simanis_ai_retry_refund.sql).
3. Tempel ke SQL Editor. Tinjau SQL, lalu klik **Run** sekali. Migrasi aman untuk data perangkat/akademik: hanya membuat fungsi dan tabel reservasi serta memperbarui batas fungsi kuota lama. Tidak mereset catatan pemakaian sebelumnya.
4. Setelah berhasil, gabungkan PR ke `main` dan tunggu deployment Vercel Production READY. Jangan merge versi kode yang memanggil RPC baru **sebelum** migrasi berhasil, karena akan membuat permintaan gagal.
5. Login guru dan cek sisa kuota, lalu uji Modul Ajar.

## Uji Teknis
- Mock endpoint model berhasil: 2 panggilan Gemini dan 1 reservasi, tanpa refund pada sukses.
- Jika 1 dari 2 panggilan Gemini gagal HTTP 429, terjadi 1 refund dan dokumen lama tidak diganti.
- Jika batas internal terlampaui, model tidak dipanggil.
- Endpoint info kuota menampilkan sisa 9/12 jika pemakaian masih 3.
- Uji RLS database dan end-to-end setelah migrasi produksi tetap diperlukan.
