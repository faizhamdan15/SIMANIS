# SIMANIS Web V1

Versi awal frontend **SIMANIS — Sistem Informasi MA Nurul Islam**.

## Sudah berfungsi
- Login Supabase Auth
- Session login
- Profil & role
- Sidebar dinamis dari `get_my_modules()`
- Dashboard realtime
- Total siswa, guru, kelas, mapel, jadwal
- Jadwal hari ini
- Ringkasan absensi siswa
- Grafik kehadiran 7 hari
- Logout
- Responsive desktop/mobile

## File
- `index.html` — Login
- `dashboard.html` — Dashboard
- `styles.css` — Tampilan SIMANIS
- `config.js` — Project URL + publishable key Supabase
- `login.js` — Proses login
- `dashboard.js` — Data dashboard
- `assets/logo.png` — Logo MA Nurul Islam

## Deploy cepat ke GitHub + Vercel
1. Buat repository GitHub baru, misalnya `simanis`.
2. Upload seluruh isi folder ini ke root repository.
3. Di Vercel pilih **Add New > Project**.
4. Import repository `simanis`.
5. Framework Preset: `Other`.
6. Build Command: kosong.
7. Output Directory: kosong.
8. Klik Deploy.

Halaman awal otomatis memakai `index.html`.

## Catatan keamanan
`sb_publishable_...` boleh berada di frontend. Jangan pernah memasukkan Service Role Key atau database password ke file frontend.
Trigger deployment V2
