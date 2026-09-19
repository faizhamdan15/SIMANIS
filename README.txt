SIMANIS — BERITA PRETTY URL + OG WHATSAPP V1

MASALAH YANG DIPERBAIKI

1. URL lama:
   /berita-detail.html?slug=judul-berita-9931735

   Menjadi:
   /berita/judul-berita

2. Preview WhatsApp sebelumnya sering tanpa gambar karena berita detail
   dirender oleh JavaScript di browser. Crawler WhatsApp membaca HTML awal
   dan tidak menunggu JavaScript mengisi judul/gambar.

3. Versi ini membuat halaman berita dari Vercel Function sehingga metadata
   Open Graph sudah ada LANGSUNG pada HTML yang diterima WhatsApp:
   - og:title
   - og:description
   - og:url
   - og:image
   - twitter:card

4. Akhiran 7 digit slug tetap boleh tersimpan di database untuk keunikan,
   tetapi disembunyikan dari URL publik.

CARA PASANG KE ROOT REPO GITHUB

ADD:
- vercel.json
- pretty-news-links.js
- folder api/
  - api/berita/[slug].js

REPLACE:
- config.js
- berita-detail.html

STRUKTUR YANG HARUS TERLIHAT DI GITHUB:

SIMANIS/
├── api/
│   └── berita/
│       └── [slug].js
├── vercel.json
├── pretty-news-links.js
├── config.js
├── berita-detail.html
└── ...file SIMANIS lainnya

TIDAK PERLU:
- SQL
- mengubah tabel berita
- mengubah publik.js
- mengubah foto berita yang sudah ada
- mengubah DNS/domain

SETELAH UPLOAD
1. Commit ke main.
2. Tunggu Vercel deployment menjadi Ready.
3. Buka halaman Berita.
4. Klik salah satu berita.
5. URL seharusnya menjadi:
   https://www.manuriska.sch.id/berita/judul-berita
6. Share URL BARU tersebut ke WhatsApp.

CATATAN WHATSAPP
WhatsApp dapat menyimpan cache preview URL lama.
Gunakan URL /berita/... yang baru; URL tersebut belum memakai cache
berita-detail.html?slug=... sehingga preview biasanya diperbarui.

FALLBACK GAMBAR
Jika sebuah berita tidak memiliki cover_path, preview menggunakan
hero-madrasah.webp agar share tetap memiliki gambar.

KEAMANAN
Vercel Function hanya membaca RPC publik get_public_news.
Publishable key yang dipakai sama dengan frontend publik dan bukan service_role.
