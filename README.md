# SIMANIS

**SIMANIS — Sistem Informasi MA Nurul Islam** adalah platform web terintegrasi untuk administrasi madrasah, data akademik, kehadiran, nilai, unit kerja, keuangan, publikasi, Portal Wali, dan Administrasi Kepala Madrasah.

Website publik: **https://www.manuriska.sch.id**

## Status

SIMANIS saat ini berada pada tahap **Release Candidate**.

Audit finalisasi mencakup:
- role dan permission lintas jabatan,
- RLS dan SECURITY DEFINER RPC,
- Administrasi Kepala 141 dokumen,
- workflow FINAL dan Paket Administrasi,
- Nilai, Jadwal, Absensi, Keuangan,
- Portal Wali,
- halaman publik dan PWA,
- regression syntax frontend,
- Supabase Security & Performance Advisor.

Detail lengkap: [RELEASE_CANDIDATE_CHECKLIST.md](RELEASE_CANDIDATE_CHECKLIST.md)

## Modul Utama

- Dashboard
- Administrasi Kepala Madrasah
- PKM Kurikulum
- PKM Kesiswaan
- PKM Bendahara & Sarpras
- PKM Humasy
- Kepala TU
- Kepala Laboratorium IPA
- Kepala Laboratorium Bisnis
- Data Siswa
- Data Guru
- Kelas
- Mata Pelajaran
- Jadwal
- Absensi Guru
- Absensi Siswa
- Nilai
- Prestasi
- Berita
- Pengumuman
- Agenda
- Keuangan
- Portal Wali
- Pengaturan

## Arsitektur

- Frontend: static web application
- Backend/Auth/Database/Storage: Supabase
- Repository: GitHub
- Deployment: Vercel
- PWA: service worker + web manifest

## Administrasi Kepala

Administrasi Kepala memiliki alur:

**Draft -> Readiness -> Tugas PIC -> Monitoring PIC -> Pengajuan -> Verifikasi -> FINAL -> Paket Administrasi**

Setiap FINAL menyimpan snapshot, metadata verifier, versi, lampiran, dan checksum SHA-256.

## Keamanan

- RLS aktif pada tabel sensitif.
- Akses modul mengikuti role dan jabatan struktural.
- Storage Administrasi Kepala private dan category-aware.
- Perubahan status dokumen Administrasi Kepala dipaksa melalui RPC ber-audit.
- Security Advisor Supabase saat audit terakhir: **0 ERROR**.

Catatan: Leaked Password Protection Supabase Auth masih perlu diaktifkan dari pengaturan Auth sebelum status final production-ready.

## Deploy

Vercel terhubung ke branch utama repository. Status commit terbaru saat audit finalisasi: **SUCCESS**.

Framework preset: Other/static.

## Catatan

Jangan pernah menaruh Service Role Key, database password, atau secret server-side di frontend. Publishable key Supabase memang dapat digunakan di browser bersama RLS dan permission backend yang benar.
