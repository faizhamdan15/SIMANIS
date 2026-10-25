# SIMANIS — Rekap Absensi Guru & Staf Bulanan

## Alur penggunaan
1. Login sebagai **Super Admin**, **TU**, **Waka Kurikulum**, **Kepala Madrasah**, **Waka Kesiswaan** atau pengelola absensi yang memiliki jabatan struktural terkait.
2. Buka **Absensi Guru & Staf** → **Rekap Absensi Bulanan** (tombol pada bagian atas).
3. Pilih **bulan/tahun**, klik **Tampilkan Rekap**.
4. Lihat setiap guru/staf, total sekolah, hari terjadwal, HADIR, TERLAMBAT, IZIN, SAKIT, DINAS, ALFA, ALFA OTOMATIS, BELUM ABSEN, jumlah hari yang memiliki catatan, jumlah menit terlambat, dan persentase kehadiran.
5. Klik **Unduh Excel (CSV)** untuk ekspor seluruh guru/staf dalam satu file CSV UTF-8. Excel, Google Sheets, dan LibreOffice Calc dapat membuka CSV ini. Jika browser memblokir unduhan otomatis, ada tautan unduh manual.
6. Klik **Cetak / PDF** untuk halaman khusus A4 landscape; di dialog printer pilih **Simpan sebagai PDF**.

**File ekspor selalu memuat semua guru/staf aktif** tanpa terpengaruh filter pencarian nama di halaman rekap. Baris TOTAL SELURUH GURU / STAF disertakan; persentase total berbobot hari terjadwal (bukan rata-rata persentase antar guru). Urut nama A–Z Indonesia.

## Rumus dan peringatan integritas data
- **Hari terjadwal**: hari ketika ada jadwal mengajar pada semester yang sesuai, atau jadwal kerja TU yang berlaku pada tanggal itu. Jika keduanya ada, satu hari tetap dihitung **satu kali**; jam mengajar mendapat prioritas. Hari tanpa jadwal tidak dihitung ALFA.
- **Tahun/bulan** mengikuti kalender WIB, hingga tanggal hari ini saja; tanggal mendatang tidak dihitung dan tidak diprediksi.
- **Hadir**: status HADIR pada hari terjadwal.
- **Terlambat**: status TERLAMBAT pada hari terjadwal. **Total masuk = Hadir + Terlambat.**
- **Izin, Sakit, Dinas**: status masing-masing pada hari terjadwal.
- **Alfa**: status ALFA yang ditampilkan oleh Absensi Guru harian. Termasuk alfa yang ditandai otomatis ketika hari yang sudah berlalu tidak mempunyai catatan database.
- **Alfa Otomatis**: *subset* dari total Alfa, bukan tambahan. Semua hari ini **perlu diverifikasi manual** sebelum rekap digunakan sebagai bukti ketidakhadiran resmi. Jangan menjumlahkan kolom Alfa dan Alfa Otomatis.
- **Belum Absen**: hari berjalan yang terjadwal namun belum ada status.
- **Tercatat**: hari terjadwal yang memiliki baris absensi tersimpan di database. Alfa otomatis tidak masuk hitungan Tercatat.
- **Persentase Kehadiran** = `(Hadir + Terlambat) / Hari Terjadwal × 100%`; disajikan sebagai angka indikatif dan **bukan angka penilaian disiplin resmi** bila ada alfa otomatis yang belum diperiksa.

### Penting untuk periode lampau
Karena presensi historis di SIMANIS belum terisi untuk banyak tanggal yang lalu, **ALFA OTOMATIS pada laporan lama dapat sangat besar**, meskipun guru sebenarnya masuk. Jangan memakai angka tersebut untuk keputusan disiplin, penggajian, atau penilaian tanpa rekonsiliasi log dan sumber hadir manual. Riwayat jadwal mengajar juga dihitung dari **jadwal semester yang saat ini tersimpan**; perubahan historis jadwal pelajaran yang tidak diberi versi tanggal mungkin tidak tergambar sempurna. Jadwal TU memiliki tanggal efektif sehingga masa lalu lebih terjaga.

Pada saat validasi **25 Oktober 2026**, fungsi membaca 38 guru/staf aktif dan 361 hari terjadwal pada Oktober (sampai tanggal 25), tetapi 288 hari tergolong **Alfa Otomatis**. Angka ini bukan klaim bahwa 288 kehadiran resmi hilang.

## Teknis
- Database RPC: `public.get_teacher_attendance_monthly_summary(p_year int, p_month int)` dari `migrations/20261025_teacher_attendance_monthly_summary.sql`.
- Fungsi bersifat `security invoker`, mengecek `auth.uid()`, peran/jabatan pengelola, serta memanfaatkan fungsi harian `public.get_teacher_attendance_by_date(date)` dan RLS `teacher_attendance`.
- Fungsi read-only, tidak mengubah `teacher_attendance`, `schedules`, maupun `staff_work_schedules`.
- PostgREST: `api.db.rpc('get_teacher_attendance_monthly_summary',{p_year,p_month})`.
- Integrasi UI: `absensi-guru.html` dan `absensi-guru.js`; fitur menyatu dengan halaman absensi yang sudah ada.
- Tidak menambahkan akses publik. `anon` tidak memperoleh `EXECUTE`, dan fungsi menolak akun GURU biasa. Hak eksekusi `authenticated` tetap melalui pemeriksaan peran pada RPC.
- Ekspor CSV menggunakan sanitasi rumus spreadsheet dan escaping CRLF, tidak membuka nama seluruh guru ke akun biasa.

## Uji
- [x] Migrasi Supabase berhasil; fungsi dan izin execute terverifikasi.
- [x] Query Oktober 2026: total jadwal konsisten dengan status sampai tanggal saat diuji.
- [x] Query September 2026: data historis tidak dihitung sebagai kehadiran tanpa dasar; ALFA otomatis dipisah untuk verifikasi.
- [x] Query November 2026: tanggal masa depan tidak dihitung (semua 0).
- [x] Akun GURU biasa (nonpengelola) ditolak: SQLSTATE 42501.
- [x] Mock UI: pilihan bulan, nama A–Z, pencarian, total, CSV semua guru tanpa terpengaruh filter, sanitasi formula, cetak.
- [ ] Uji langsung login Super Admin di browser produksi dan unduh CSV.
- [ ] Verifikasi/rekonsiliasi Alfa Otomatis per guru sebelum penggunaan resmi.
