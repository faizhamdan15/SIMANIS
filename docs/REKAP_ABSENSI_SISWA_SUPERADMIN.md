# Fitur Rekap Absensi Siswa per Kelas — Super Admin

## Tujuan
Membantu Super Admin meninjau dan mengunduh **rekap siswa untuk setiap kelas** atau **gabungan seluruh kelas** dari menu **Absensi Siswa**. Menggunakan API rekap siswa yang sudah dipakai SIMANIS; tidak ada migrasi maupun perubahan kehadiran.

## Cara menggunakan
1. Login dengan akun **SUPER_ADMIN** SIMANIS.
2. Buka **Absensi Siswa** di `absensi-siswa.html`.
3. Pada panel **Rekap Absensi Siswa — Super Admin**, pilih **Bulan Rekap**.
4. Pilih **Kelas** melalui dropdown kelas utama, lalu klik **Download Rekap Kelas (CSV)**.
5. Untuk semua kelas aktif, klik **Download Semua Kelas (CSV)**. Kelas dijajarkan dalam file CSV yang sama; ada baris **TOTAL KELAS** per kelas dan **TOTAL MADRASAH** di akhir.
6. Klik **Lihat / Cetak Laporan PDF** untuk membuka format laporan bulanan siap cetak, dengan kelas serta bulan yang dipilih sudah otomatis disinkronkan. Cetak ke PDF melalui opsi browser.
7. Jika browser HP memblokir pengunduhan otomatis, gunakan tautan **Unduh file secara manual** pada panel.

Pada menu **Laporan Bulanan** yang sudah ada, guru pengelola/wali kelas tetap dapat mencetak laporan kelas sesuai aksesnya. Tombol **Rekap Absensi Guru** kini hanya terlihat untuk akun GURU/WALI_KELAS karena halaman `absensi-siswa-rekap.html` memang hanya menerima akun guru.

## Kolom CSV
Kelas, wali kelas, nomor absen asli, nama siswa (A–Z), NIS, NISN, jumlah **Hadir**, **Terlambat**, **Izin**, **Sakit**, **Alfa**, **Total Catatan**, dan **% Kehadiran**. Nomor absen tidak disusun ulang ketika nama diurutkan; CSV mencoba menjaga NIS/NISN yang diawali nol agar tetap diperlakukan sebagai teks oleh spreadsheet.

### Cara menghitung
- RPC yang digunakan: `public.get_student_attendance_summary(p_class_id,p_subject_id,p_date_from,p_date_to)`, dengan `p_subject_id=null` (semua mata pelajaran).
- Hanya status presensi yang **benar-benar disimpan** dalam `student_attendance` yang dihitung. Siswa yang belum diabsen tetap ada dalam rekap dengan 0 catatan.
- **Alfa bukan otomatis**: tanggal tanpa catatan (termasuk hari libur) tidak diubah menjadi ALFA.
- **Total Catatan** adalah jumlah entri presensi, bukan selalu jumlah hari kalender. Jika pada satu tanggal ada lebih dari satu catatan mata pelajaran, masing-masing merupakan entri sendiri. Jangan menyebutnya "hari hadir" secara otomatis.
- Persentase kehadiran = (Hadir + Terlambat) ÷ Total Catatan × 100%, jika ada catatan. Bila tidak ada catatan, persentase dikosongkan di CSV agar tidak disalahartikan sebagai 0% ketidakhadiran.
- Rekap bulan berjalan dibatasi sampai **hari ini dalam zona Asia/Jakarta**, bukan tanggal masa depan. Bulan masa depan ditolak.
- Daftar siswa mengikuti kelas **aktif saat laporan dibuat**. Saat laporan bulan lampau dibuat, riwayat pindah kelas tidak dibangun ulang otomatis; ini tetap mengikuti metode rekap SIMANIS yang sudah digunakan sebelumnya.

### Keamanan dan konsistensi
- Panel untuk unduh seluruh kelas hanya ditampilkan kepada **SUPER_ADMIN** dan pemeriksaan role dilakukan lagi dalam handler klik.
- RPC server memverifikasi bahwa kelas termasuk `get_my_attendance_classes()`, bukan hanya mengandalkan filter UI. Guru biasa yang mengakses kelas lain ditolak.
- **Tidak membuat file parsial**: saat mengunduh semua kelas, bila satu kelas gagal dimuat, ekspor dibatalkan dan menampilkan pesan kegagalan.
- Sumber data selalu dimuat langsung dari server saat mengunduh, tidak dipengaruhi filter pencarian/status siswa yang aktif pada layar.
- File CSV menggunakan UTF-8 BOM, separator ;, quoting dan mitigasi formula injection. Link unduh manual hanya berupa Object URL pada memori tab, dilepaskan ketika dipakai ulang atau halaman ditutup.
- Fitur read-only, tidak mengubah kelas, nomor absen, data siswa, hak akses, jadwal pelajaran maupun nilai.

## Uji
- [x] 26 Oktober 2026: akun Super Admin dapat membaca **13 kelas**, **348 siswa aktif**, **379 catatan presensi** yang dibuat pada 1–26 Oktober; total status yang tercatat konsisten.
- [x] Integrasi real RPC dengan 13 kelas: mismatch jumlah siswa = 0; mismatch rekap status = 0.
- [x] Percobaan baca kelas lain memakai akun guru tanpa hak kelas ditolak oleh RPC.
- [x] JS halaman Absensi Siswa dan JS inline halaman Laporan Bulanan lolos pemeriksaan sintaks, ID DOM tidak duplikat.
- [x] Simulasi unduh CSV satu kelas dan gabungan: nama urut abjad, per-class totals dan madrasah totals, leading zero codes, anti-injection formula, tautan manual.
- [x] Simulasi gagal satu kelas: ekspor seluruh kelas dibatalkan tanpa menghasilkan file parsial.
- [x] Role non-Super Admin tidak dapat memanggil handler download gabungan; bulan masa depan ditolak.
- [ ] Pemeriksaan klik/unduh melalui browser aktual dengan akun Super Admin pada deployment produksi.
