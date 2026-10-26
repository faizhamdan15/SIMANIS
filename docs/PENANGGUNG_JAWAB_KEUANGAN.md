# Perbaikan Penanggung Jawab Keuangan / Bendahara — SIMANIS

## Permintaan
Dalam modul Keuangan terlihat **Faiz Hamdan** sebagai Bendahara saat nota/laporan dicetak menggunakan akun Super Admin. Nama pejabat yang diminta adalah **Muhkam Habibi, S.Pd.**

## Hasil pemeriksaan database
- Pemegang aktif jabatan `PKM_BENDAHARA_SARPRAS` memang Muhkam Habibi.
- Nama profil dan master guru tersimpan dalam bentuk `Muhkam Habibi, S.Pd.I`. Berdasarkan koreksi pengguna, pada cetakan/halaman Keuangan saja ditampilkan `Muhkam Habibi, S.Pd.`. **Identitas master guru dan profil tidak diubah.**
- Beberapa cetakan lama memakai `profile.full_name`, yaitu **nama pengguna yang sedang login**, sebagai nama Bendahara. Ini keliru saat Super Admin mencetak.

## Implementasi
1. RPC database read-only `public.finance_get_treasurer_name()` mengembalikan nama pemegang jabatan `PKM_BENDAHARA_SARPRAS` yang masih aktif, tidak terikat akun yang mencetak. Menggunakan `SECURITY DEFINER` dengan `search_path=''`, pemeriksaan `auth.uid()`, dan izin `has_module_permission('KEUANGAN','view')` atau jabatan PKM Bendahara atau Super Admin.
2. `keuangan.js` membaca nama via RPC saat halaman dimuat, lalu memakai hasilnya untuk:
   - Cetak Laporan Buku Kas,
   - Nota Pembayaran Iuran Pendidikan,
   - Cetak Rekap Pembayaran Siswa,
   - Cetak Rekap Pembayaran keseluruhan.
3. `keuangan.html` menampilkan label **Penanggung Jawab Keuangan / Bendahara** terpisah dari nama pengguna yang sedang login pada topbar.
4. Bila nama belum terbaca, cetakan tidak memakai nama operator sebagai pengganti; hanya garis kosong dan status kesalahan. Tidak ada pengambilalihan identitas.
5. `financeTreasurerDisplayName()` secara khusus mengubah label nama sebelumnya dari `Muhkam Habibi, S.Pd.I` menjadi **`Muhkam Habibi, S.Pd.`** hanya pada Keuangan sesuai instruksi, dan membiarkan nama pejabat lain tampil sesuai penugasan jika kelak terjadi pergantian.
6. Pembuat transaksi (`created_by`/`created_by_name`), audit, data rekening, bukti, tagihan, dan semua nominal **tidak diubah**. Nama operator di kanan atas tetap identitas pengguna yang login.

## Validasi
- [x] RPC diterapkan ke database.
- [x] Sebagai Super Admin: RPC menghasilkan nama pejabat Muhkam Habibi.
- [x] Sebagai pemegang PKM Bendahara & Sarpras: RPC menghasilkan nama pejabat yang sama.
- [x] Sebagai guru biasa nonpengelola: RPC menolak dengan SQLSTATE `42501`.
- [x] Perizinan: `authenticated` execute true, `anon` execute false.
- [x] JS sintaks valid, empat cetakan memakai `financeTreasurerSignature()`.
- [x] Simulasi login Faiz: identitas operator tetap Faiz, tanda tangan Keuangan Muhkam Habibi, S.Pd.
- [ ] Verifikasi cetak nota dan laporan dari browser akun Super Admin sesudah rilis.
