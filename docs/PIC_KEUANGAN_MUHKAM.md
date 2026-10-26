# SIMANIS — Identitas Penanggung Jawab Keuangan

## Konteks koreksi
Pada halaman `keuangan.html`, teks **Faiz Hamdan** berasal dari kolom `headerUser` / `sideUserName`, yaitu nama **akun yang sedang login**. Kolom tersebut bukan sumber data pejabat Bendahara.

Dari basis data (26 Oktober 2026), jabatan aktif `PKM_BENDAHARA_SARPRAS` pada `profile_positions` telah ditetapkan kepada profil **Muhkam Habibi, S.Pd.I**. User meminta tulisan tampilan bagian Keuangan: **Muhkam Habibi, S.Pd**.

## Perbaikan
- Halaman `keuangan.html` menampilkan kartu **Penanggung Jawab Keuangan · PKM Bendahara & Sarpras** berisi nama dari penugasan jabatan aktif.
- Halaman `unit-kerja.html?unit=PKM_BENDAHARA_SARPRAS` menampilkan pemegang jabatan yang sama.
- Tulisan bagian atas kanan diberi label **Akun yang sedang login**. Bila Super Admin (Faiz Hamdan) mengakses, identitas login tetap ditampilkan apa adanya.
- Tanda tangan **Penanggung Jawab Keuangan** di cetakan buku kas diisi nama penanggung jawab yang sedang berlaku; jika data tidak dapat dimuat, tetap berupa garis kosong, **tidak memakai identitas akun pengelola**.
- Fungsi `get_finance_responsible_person()` membaca `profile_positions` dan `profiles` untuk jabatan tersebut. Tidak ada ID pengguna yang dikodekan permanen di JavaScript.
- Sesuai koreksi spesifik yang diminta, jika nama pemegang jabatan di database persis `Muhkam Habibi, S.Pd.I`, tampilan **modul Keuangan** menggunakan `Muhkam Habibi, S.Pd`. Ini adalah koreksi presentasi saja; catatan nama pada master `teachers` dan `profiles` belum diubah.

## Keamanan dan audit
- Fungsi baru `get_finance_responsible_person()` adalah **read-only** dan hanya dijalankan oleh pengguna terautentikasi yang mempunyai izin melihat modul Keuangan.
- RPC `SECURITY DEFINER` mengembalikan satu nilai nama penanggung jawab; tidak mengungkap email, kredensial, identitas akun, data keuangan, atau informasi seluruh pengguna.
- Tidak memutasi `profiles`, `teachers`, `profile_positions`, `finance_transactions`, `finance_categories` maupun data pembayaran siswa.
- Kolom historis `created_by_name` pada transaksi dan ekspor CSV tetap sesuai akun yang mencatat transaksi; tidak diganti menjadi nama bendahara karena itu akan merusak jejak audit.
- Kartu PIC terpisah dari identitas akun login sehingga informasi tidak menyesatkan.

## Uji
- [x] Konfirmasi tabel jabatan: pemegang aktif PKM_BENDAHARA_SARPRAS adalah Muhkam Habibi.
- [x] Migrasi RPC `migrations/20261026_finance_responsible_person.sql` berhasil dipasang.
- [x] Query dengan sesi Super Admin dan pemegang jabatan mengembalikan nama pemegang aktif.
- [x] Query tanpa sesi ditolak dengan SQLSTATE 42501; `anon` tidak punya izin execute.
- [x] Pemeriksaan sintaks JavaScript `keuangan.js` dan `unit-kerja.js` berhasil.
- [x] Simulasi UI mengembalikan **Muhkam Habibi, S.Pd** pada halaman keuangan dan workspace jabatan.
- [ ] Pemeriksaan visual setelah deploy pada browser dan akun Super Admin.

Jika gelar di **seluruh SIMANIS**, bukan hanya bagian Keuangan, juga perlu menjadi `S.Pd`, perbarui master data guru dan profil dengan persetujuan pengelola data sekolah secara terpisah.
