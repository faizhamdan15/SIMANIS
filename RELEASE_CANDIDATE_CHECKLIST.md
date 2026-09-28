# SIMANIS Release Candidate Checklist

Tanggal audit: 28 September 2026  
Target: Release Candidate sebelum penetapan production-ready 100%.

## Status Ringkas

- Backend Supabase: PASS
- RLS dan role scope: PASS
- Security Advisor ERROR: 0
- Controller utama JavaScript: 22/22 syntax PASS
- Route modul utama: PASS
- Tahun ajaran/semester aktif dinamis: PASS pada modul yang diaudit
- GitHub -> Vercel build/deploy status: SUCCESS
- Live HTTP/browser smoke test dari environment audit: BLOCKED oleh DNS/tool environment
- Portal Wali dengan akun wali nyata: BLOCKED karena belum ada guardian_portal_profiles produksi
- Supabase Auth Leaked Password Protection: WARN, perlu diaktifkan dari konfigurasi Auth

## Security

### PASS
- v_admin_document_status sudah security_invoker + RLS.
- Scope Administrasi Kepala terverifikasi:
  - SUPER_ADMIN / Kepala Madrasah: 141 dokumen.
  - PKM Kurikulum: 14.
  - Kepala TU: 34.
  - PKM Kesiswaan: 25.
  - PKM Bendahara/Sarpras: 23.
- admin_document_records tidak dapat di-update langsung oleh authenticated.
- Status administrasi dipaksa melalui RPC ber-audit.
- Storage administrasi-kepala private dan category-aware.
- File metadata administrasi dipaksa lewat RPC.
- Helper internal admin_document_source_count tidak exposed ke REST.
- Anonymous execute pada RPC sensitif sudah dicabut.
- Security Advisor: 0 ERROR.

### WARN yang diterima
- 4 anonymous SECURITY DEFINER adalah endpoint publik yang memang diperlukan:
  berita, pengumuman, agenda, dan pengaturan publik.
- 150 authenticated SECURITY DEFINER adalah RPC aplikasi; fungsi inti yang diaudit memiliki guard role/permission.
- 18 tabel RLS tanpa policy adalah tabel internal-only tanpa privilege langsung authenticated/anon.
- Leaked Password Protection belum aktif.

## Role QA

### SUPER_ADMIN
- 24 modul.
- Settings RPC: PASS.
- Portal Wali create invite dummy: PASS dalam rollback.

### Kepala Madrasah
- 16 modul.
- Administrasi Kepala E2E: submit -> verify -> FINAL -> Paket: PASS dalam rollback.
- Paket menghasilkan checksum SHA-256 64 karakter.
- Nilai: 272 konteks terlihat; hanya konteks mengajar sendiri yang editable.

### PKM Kurikulum
- 14 modul.
- Update mapel/kelas/jadwal: PASS dalam rollback.
- Nilai: 272 konteks terlihat dan editable.

### PKM Kesiswaan
- 13 modul.
- Insert prestasi dummy: PASS dalam rollback.

### PKM Bendahara/Sarpras
- 14 modul.
- Update transaksi keuangan: PASS dalam rollback.

### Kepala TU
- 14 modul.
- Update guru/siswa/kelas: PASS dalam rollback.

### Guru
- 12 modul untuk akun uji.
- Update master mapel: BLOCKED sesuai RLS.
- Keuangan: 0 baris terlihat.
- Nilai: 29 konteks terlihat; 12 editable.
- Guard teacher_check_in membatasi guru ke teacher_id sendiri.

### PKM Humasy
- 12 modul, 7 writable.

### Kalab IPA
- 12 modul, 4 writable.

### Kalab Bisnis
- 12 modul, 4 writable.

### Portal Wali
- Akun authenticated tanpa link wali: 0 anak terlihat.
- Kepala dapat melihat daftar 353 siswa tetapi tidak punya permission create invite.
- SUPER_ADMIN dapat membuat invite.
- Belum ada akun wali produksi untuk positive end-user login test.

## Frontend QA

- 22 controller utama: syntax OK.
- siswa.js Promise.all bug: fixed.
- Route sidebar legacy: standardized.
- Route KEUANGAN global: keuangan.html.
- Tidak ada route global KEUANGAN yang memaksa role umum masuk unit Bendahara.
- Hardcode 2026/2027 di controller utama yang diaudit: 0.
- Administrasi, Paket Administrasi, Jadwal, Guru, Mapel mengikuti academic year/semester aktif.
- Nilai view-only benar-benar menonaktifkan edit/input/save.

## Public Site / PWA

- index.html: present.
- login.html: present.
- profil.html: present.
- berita-publik.html: present.
- prestasi-publik.html: present.
- pengumuman-publik.html: present.
- agenda-publik.html: present.
- 404.html dan offline.html: present.
- login.js, publik.js, sdk-loader.js, sw.js: syntax PASS.
- site.webmanifest: present.
- PWA icons/logo/hero-madrasah: present.
- Service Worker shell references: verified in repository.
- Canonical site configured as https://www.manuriska.sch.id.
- Live HTTP fetch from audit runtime: blocked by DNS resolution limitation, not confirmed PASS/FAIL.

## Performance

- Performance Advisor ERROR/WARN: none.
- Unindexed FK INFO reduced from 123 to 117.
- Added hot-path indexes:
  - schedules(class_id)
  - schedules(subject_id)
  - schedules(teacher_id)
  - schedules(time_slot_id)
  - student_enrollments(semester_id)
  - admin_document_records(academic_year_id)
- 2 tables without PK are historical backup tables in simanis_backup.

## Administrasi Kepala

- 141/141 document structure covered.
- Workflow available: Draft -> Readiness -> PIC Task -> Monitoring -> Submit -> Verify -> FINAL -> Package.
- FINAL immutable archive/versioning: PASS.
- Attachment + evidence workflow: PASS.
- Package Administration follows latest FINAL versions.
- Production FINAL count depends on real PIC submission and headmaster verification; system coverage does not equal operational completion.

## Remaining Release Blockers

1. Activate Supabase Auth Leaked Password Protection.
2. Perform real browser login/logout test for representative accounts.
3. Perform positive Portal Wali login test after one real guardian account/link exists.
4. Verify public/live domain from an environment with DNS/browser access.
5. Complete real administrative submissions and headmaster approvals as operational data becomes available.

## Release Decision

Current engineering status: RELEASE CANDIDATE.

Do not label SIMANIS "100% production-ready" until all Remaining Release Blockers above are closed.
