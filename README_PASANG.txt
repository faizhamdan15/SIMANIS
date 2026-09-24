SIMANIS FINALISASI BATCH 2 — ROLE & DIRECT URL SECURITY V1

Isi paket:
1. direct-url-security-v2.js
   Guard tambahan untuk direct URL halaman private.
2. global-sidebar-route-fix.js
   Dibundel lagi supaya Batch 2 bisa dipasang langsung meski Batch 1 belum dipasang.
3. security-access-check.html
   Halaman QA untuk melihat matrix permission akun yang sedang login.
4. config.js
   Memuat guard security dan route normalizer.
5. ROLE_SECURITY_TEST_MATRIX.md
   Checklist tes untuk semua role.

CARA PASANG
Upload FILE BARU ke root repo:
- direct-url-security-v2.js
- global-sidebar-route-fix.js
- security-access-check.html

Replace:
- config.js

Tidak perlu SQL.

SETELAH DEPLOY
1. Login sebagai SUPER_ADMIN.
2. Buka /security-access-check.html
3. Pastikan permission terlihat.
4. Login bergantian sebagai role lain dan ulangi.
5. Tes direct URL sesuai matrix.

CATATAN
Guard ini melengkapi pemeriksaan yang sudah ada di sdk-loader.js.
Backend RLS/RPC tetap merupakan pengaman utama.
