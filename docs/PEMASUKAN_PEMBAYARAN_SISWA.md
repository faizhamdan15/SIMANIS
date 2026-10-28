# SIMANIS — Pemasukan otomatis dari Pembayaran Siswa

## Hasil
Di halaman Keuangan kini terdapat tab **Pemasukan** di antara Buku Kas dan Pengeluaran.

- Tab menghitung seluruh pemasukan **dari Buku Kas (finance_transactions)**, bukan menambahkan total cicilan siswa secara terpisah. Ini menghindari penghitungan dua kali.
- Pembayaran siswa otomatis berstatus **Pemasukan – Iuran Pendidikan** ketika fungsi database `record_student_education_payment` berhasil menyimpan cicilan. RPC tersebut membuat satu transaksi keuangan dan satu pembayaran siswa dalam satu transaksi database, dikaitkan melalui `finance_transaction_id` yang unik.
- Fungsi `void_student_education_payment` mengubah status pembayaran **dan** transaksi keuangannya ke `VOID`. VOID terlihat saat dipilih pada filter, tetapi **tidak menambah saldo maupun total pemasukan dibukukan**.
- Sumber pemasukan ditentukan dari keberadaan tautan pembayaran `finance_transaction_id`, **bukan dari nama kategori atau kemiripan nominal**.
- Total: pemasukan dibukukan = pembayaran siswa dibukukan + pemasukan lain dibukukan; tunai dan bank berasal dari transaksi kas yang sama.
- Rekap pembayaran siswa per kelas dihitung hanya dari pembayaran `POSTED` yang terhubung; tidak menjumlahkan tagihan siswa yang belum dibayar.
- Filter: bulan, sumber pemasukan, kelas, status, pencarian siswa/nota.
- Ekspor CSV kompatibel Excel, cetak A4 landscape / simpan PDF. Semua nominal mengikuti filter. CSV memiliki backup tautan unduh yang dapat diklik secara manual.
- Kontrol **Pemasukan Lainnya** mempertahankan jalur pencatatan kas manual, tetapi kategori Iuran Pendidikan disembunyikan untuk transaksi baru; iuran harus masuk melalui menu Pembayaran Siswa.
- Ada indikator jika suatu pembayaran siswa tidak cocok dengan transaksi keuangannya dan peringatan jika ada pemasukan Iuran Pendidikan manual tanpa tautan pembayaran.
- Riwayat kelas/tahun pelajaran terkait pembayaran tetap bisa dibuka melalui tautan **Lihat Pembayaran** (jika rencana iurannya masih tersedia dalam data master yang dimuat).
- Hak akses Keuangan yang sudah ada tetap dipakai; tidak ada migrasi, modifikasi data keuangan lama, atau penambahan hak akses.

## Pengecekan real data saat implementasi
Per **28 Oktober 2026**, database berisi 4 catatan pembayaran siswa dengan total historis **Rp3.500.000**, dan seluruhnya berstatus `VOID`. Empat transaksi Buku Kas yang terhubung juga `VOID`; akibatnya **Pemasukan Pembayaran Siswa Dibukukan = Rp0** sampai ada pembayaran yang benar-benar berhasil dan belum dibatalkan. Jangan memulihkan status VOID tanpa bukti transaksi yang sah.

## Cara operasional
1. Buka **Keuangan → Pembayaran Siswa**.
2. Pilih siswa, klik **Bayar Cicilan**, masukkan tanggal, nominal dan metode, kemudian simpan.
3. Sistem menerbitkan satu nomor nota serta otomatis membuat Pemasukan di Buku Kas.
4. Buka **Keuangan → Pemasukan**, pilih bulan dan sumber **Pembayaran Siswa**, untuk melihat total dan rekap per kelas.
5. Unduh **CSV** atau **Cetak / PDF** bila memerlukan laporan.
6. Untuk membatalkan pembayaran yang salah, gunakan **Pembayaran Siswa → Detail → Batalkan**, bukan mengedit Buku Kas secara manual.

**Catatan penting:** saldo tidak berasal dari nominal tagihan atau riwayat pembayaran yang sudah VOID. Penghitungan didasarkan pada `finance_transactions.signed_amount` berstatus POSTED.

## Pengujian
- [x] Verifikasi di database: pembayaran dan keuangan dicatat atomik, relasi satu-ke-satu `finance_transaction_id UNIQUE`, pembatalan berpasangan.
- [x] Simulasi dua pembayaran POSTED (Rp150.000), pemasukan lain POSTED (Rp200.000), dan pembayaran VOID (Rp75.000): pemasukan = Rp350.000, dari siswa = Rp150.000, lainnya = Rp200.000.
- [x] Simulasi kas Rp300.000 / bank Rp50.000; void tidak masuk total.
- [x] Filter sumber, kelas, status VOID, bulan, rekap per kelas, CSV, dan cetak PDF.
- [x] Deteksi kasus transaksi Iuran manual yang tidak terhubung ke pembayaran.
- [x] Verifikasi kategori Iuran tidak bisa dipilih untuk pemasukan manual baru, tetapi edit data manual lama tetap dimungkinkan.
- [x] Navigasi dari pemasukan ke riwayat pembayaran sesuai asal tahun pelajaran.
- [x] Data asli tidak diubah saat pengujian.

Tidak dilakukan tes pembayaran nominal sungguhan pada data produksi agar tidak membuat catatan finansial fiktif.
