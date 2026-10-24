# SIMANIS — Jadwal Kerja Harian Tata Usaha & Staf

## Tujuan
Memberikan jadwal presensi **kerja harian** bagi tenaga TU/staf yang tidak mempunyai jadwal mengajar. Jangan membuat jadwal mata pelajaran palsu. Jam masuk, jam pulang, hari kerja, dan tanggal mulai ditetapkan oleh pengelola SIMANIS, **bukan diisi otomatis**.

## Alur pengguna
1. Super Admin, TU, Waka Kurikulum, atau pengguna berjabatan Kepala TU masuk ke **Absensi Guru & Staf**.
2. Klik **Atur Jadwal Kerja TU**. Pilih satu nama guru/staf aktif (data berasal dari tabel `teachers`).
3. Pilih **tanggal mulai berlaku**, hanya hari ini atau tanggal mendatang (WIB).
4. Centang hari kerja yang relevan. Tersedia pintasan **Senin–Sabtu**, **Senin–Ahad**, atau **Kosongkan Hari**. Hari Jumat dan Ahad bisa diaktifkan bila memang masuk kerja.
5. Isi jam masuk–pulang masing-masing hari, atau gunakan **Salin jam ke hari terpilih**, lalu Simpan.
6. Setelah migrasi aktif, halaman absensi menampilkan **Jadwal Kerja TU** bagi staf yang tidak memiliki jam mengajar di hari itu. `Check In`, `Check Out`, toleransi keterlambatan, status Izin/Sakit/Dinas, dan ALFA pada hari kerja berjalan menggunakan tabel absensi yang sama, tanpa menggandakan catatan.

**Penting:** Petugas belum diberi jadwal hanya karena memiliki akun atau tidak mempunyai jadwal mengajar. Administrator wajib memilih staf yang benar dan menyimpan jam kerja secara eksplisit.

## Perilaku tanggal dan hari
- `day_of_week`: 1=Senin, 2=Selasa, 3=Rabu, 4=Kamis, 5=Jumat, 6=Sabtu, 7=Ahad (ISO).
- `effective_from` dan `effective_until` membuat perubahan jadwal berlaku dari tanggal yang diatur, tanpa mengubah jadwal sebelum tanggal tersebut. Semua tanggal dibandingkan pada zona `Asia/Jakarta`.
- Hari tanpa jadwal kerja dan tanpa jadwal mengajar: `TIDAK_ADA_JADWAL`, **bukan ALFA**.
- Hari kerja sudah berlalu tanpa catatan kehadiran: `ALFA` pada tampilan. Pada hari berjalan sebelum check-in: `BELUM_ABSEN`.
- Guru yang juga mengajar pada hari yang sama tetap memakai jadwal mengajar pada hari itu; jadwal kerja hanya digunakan jika tidak ada jam mengajar.
- `teacher_check_in` mengikuti waktu awal jadwal kerja ketika tidak ada jadwal mengajar. Batas toleransi keterlambatan tetap membaca `attendance_settings.teacher_late_tolerance_minutes`.
- Perubahan tidak memodifikasi tabel `schedules`, siswa, nilai, maupun mata pelajaran.

## Persiapan akun TU
Data produksi saat implementasi: 38 entri `teachers` aktif; 4 tanpa jadwal mata pelajaran; 1 dari 4 itu mempunyai akun `profiles` aktif yang sudah tertaut ke `teacher_id`. Staf yang belum tertaut **tetap bisa diabsenkan oleh admin**, tetapi agar dapat melakukan check-in mandiri harus punya akun dan `profiles.teacher_id` yang terhubung dengan entri stafnya. Jangan menciptakan akun atau menautkan secara otomatis tanpa memeriksa identitas.

## Aktivasi
1. Tinjau [migrasi](../migrations/20261025_staff_daily_work_schedule.sql). Isinya satu tabel jadwal kerja historis, SELECT RLS, RPC admin khusus `set_staff_work_schedule`, dan penyesuaian **tiga** fungsi absensi yang sudah ada: `get_teacher_attendance_by_date`, `teacher_check_in`, dan `save_teacher_attendance_admin`.
2. Cadangkan definisi fungsi lama; uji migrasi di project staging atau SQL transaksi yang dapat di-*rollback* terlebih dahulu.
3. Jalankan migrasi Supabase; pastikan tabel/RPC tersedia dan RLS benar. **Jangan deploy UI baru sebelum migrasi ada** agar modul tetap tersedia bagi seluruh guru.
4. Gabungkan branch ke `main`, tunggu Vercel Production READY, buka ulang Absensi Guru & Staf.
5. Uji seorang staf yang memang tidak mengajar: tanggal sebelum effective_from **tanpa jadwal**, hari kerja sesudahnya **terjadwal**, hari libur **tidak terjadwal**, dan check-in tepat waktu/terlambat menghasilkan status benar.
6. Uji admin edit tanggal mulai masa depan untuk memastikan masa lalu tidak berubah.

## Keamanan
- Semua data jadwal hanya dapat dibaca oleh pemilik jadwal atau pengelola sesuai RLS.
- Penulisan jadwal tidak bisa langsung lewat REST dari guru: hanya fungsi `set_staff_work_schedule`, yang mengautentikasi dan memeriksa peran/jabatan admin.
- Jam pulang harus lebih besar daripada jam masuk pada tanggal yang sama (belum mendukung shift lintas tengah malam).
- Tidak ada penetapan status hadir otomatis: presensi tetap membutuhkan tindakan nyata atau pencatatan admin.
- Jadwal hanya mempengaruhi absensi staf yang dipilih, bukan seluruh guru tanpa jadwal.

## Daftar periksa
- [x] Struktur SQL, pembatasan peran, validitas jam dan tanggal efektif ditinjau.
- [x] HTML 7 hari kerja termasuk Jumat/Ahad dan form admin terpasang.
- [x] JS lulus pemeriksaan sintaks, ID referensi lengkap, mock UI menyimpan 7 hari berbeda.
- [ ] Migrasi Supabase staging dan uji transaksi/RLS.
- [ ] Uji nyata admin, guru, TU, scanner/QR serta rekap sebelum produksi.
- [ ] Pengisian hari dan jam kerja untuk staf TU setelah persetujuan jam kerja madrasah.

