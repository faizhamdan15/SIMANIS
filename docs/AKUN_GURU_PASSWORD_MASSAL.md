# Panduan Super Admin — Unduh Semua Akun Guru dan Password Sementara

**SIMANIS · MA Nurul Islam · Oktober 2026**

## Fakta penting: Password yang sudah dipakai tidak bisa diunduh

SIMANIS menggunakan Supabase Auth. Password lama tidak disimpan dalam bentuk teks yang bisa dipulihkan. Daftar akun guru yang tersedia dari `settings_get_teacher_accounts` hanya berisi identitas, username, email login, role dan status—bukan password yang sedang dipakai.

**Tidak ada perubahan password tanpa aksi admin.** Unduhan data akun adalah operasi baca saja. Jika seluruh guru membutuhkan password sementara baru, Super Admin dapat melakukan reset massal secara sadar, yang langsung membuat password lama tidak berlaku.

## Dua jalur unduh

### A. Unduh Semua Akun + Password Tersedia (tanpa reset)

1. Login sebagai SUPER_ADMIN.
2. Menu Pengaturan → Akun Guru & Jobdesk.
3. Klik **Semua Akun + Password Tersedia**.
4. SIMANIS memuat ulang data seluruh guru dari RPC dan menghasilkan satu CSV berisi nama guru, kode, username, email, role, status akun, password sementara yang tersedia serta keterangannya.
5. Hanya password yang **baru dibuat/reset pada sesi halaman terbuka** yang bisa ikut dalam CSV. Kolom yang kosong berarti password tidak tersedia; **bukan** berarti akun tidak punya password. Guru yang sudah mengganti password sendiri tidak bisa diambil password lamanya.
6. Tidak ada password yang diganti.

### B. Reset Password Guru Aktif & Unduh CSV (aksi berdampak besar)

**Penting:** Jangan menggunakan fitur ini tanpa pemberitahuan resmi kepada seluruh guru terkait. Reset membuat password lama langsung tidak bisa digunakan untuk login ulang. Guru harus menerima password sementara baru secara privat dan menggantinya saat masuk.

1. Di Akun Guru & Jobdesk buka panel **Perlu password sementara baru untuk seluruh guru?**
2. Baca peringatan; klik **Reset Password Guru Aktif & Unduh CSV**.
3. SIMANIS memuat ulang daftar akun dari server; sasaran **hanya** akun aktif yang role-nya GURU/WALI_KELAS, kecuali pengguna Super Admin yang sedang login. Akun Super Admin, role pengelola lain, nonaktif dan guru tanpa akun tidak direset.
4. Konfirmasikan dua dialog `confirm()` dan satu dialog `prompt()` dengan frasa dinamis `RESET N PASSWORD GURU`. Jika salah satu dibatalkan, **nol akun** berubah.
5. SIMANIS memanggil fungsi Admin resmi **reset_password** satu per satu, dengan otentikasi/otorisasi Super Admin di server. Setiap respons sukses menyimpan password sementara sementara **dalam memori tab**, tidak ke database lokal.
6. Setelah selesai, satu CSV berisi seluruh akun guru, dengan password sementara baru di akun yang berhasil, serta kolom status untuk yang gagal, dilewati, atau belum memiliki password tersedia.
7. **Jika ada kegagalan/timeout**, akun tersebut diberi status `gagal/tidak pasti` dan password **dikosongkan**—jangan mengasumsikan password lama masih berlaku. Periksa akun tersebut dan lakukan reset individual bila perlu.
8. Jika browser terganggu selama proses, klik **Password Sementara Sesi Ini** sebelum menutup tab untuk mengambil password yang sudah berhasil dicatat. Jangan tutup tab selama reset berjalan.
9. Segera bagikan password kepada guru masing-masing melalui saluran privat dan hapus CSV yang sudah tidak diperlukan. Jangan unggah CSV berisi password ke grup, Drive publik, atau media yang dapat diakses umum.

## Validasi keamanan
- Tidak ada endpoint baru dan tidak ada perubahan database.
- Fungsi `teacher-account-admin` yang dipakai adalah endpoint eksisting dan memverifikasi Supabase Auth serta profil role SUPER_ADMIN pada server untuk setiap reset.
- Mass reset tidak dipanggil saat halaman dibuka atau saat tombol download metadata digunakan. Harus melewati **tiga konfirmasi**.
- Tidak memakai service-role key dalam browser dan tidak mendekripsi password lama.
- CSV menggunakan UTF-8 BOM, escaping kutip, mitigasi formula injection, dan waktu Asia/Jakarta.
- Respon sukses dicocokkan dengan `user_id` target sebelum password ditulis.
- Rekening Super Admin dan akun nonaktif dilewati agar tidak terkunci/diaktifkan tak sengaja.
- Daftar password sementara hanya disimpan selama halaman dibuka (bukan localStorage/server).
- Hasil tetap harus diuji menggunakan akun Super Admin sebelum dipakai pada seluruh guru.

## Hasil uji mock
- Pembatalan pada konfirmasi pertama, frasa salah dan konfirmasi terakhir -> 0 reset.
- Tiga akun guru aktif direset; Super Admin dan guru nonaktif dilewati.
- CSV keluaran memiliki baris untuk seluruh akun yang ada, dan password untuk tiga akun yang benar.
- Simulasi satu kegagalan server menghasilkan password kosong untuk akun tersebut, bukan password lama yang sudah tersimpan di sesi.
- Unduh akun + password tersedia tidak mengubah satu akun pun.
