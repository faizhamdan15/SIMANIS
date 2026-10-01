# SIMANIS Scanner Bridge

Bridge Windows untuk HC-T58 mode USB-COM.

Fungsi:
- Scanner tetap aktif tanpa tab/browser SIMANIS.
- Auto-reconnect ketika COM terputus.
- Auto-start Windows melalui paket installer.
- HTTPS ke Supabase Edge Function.
- Device token hanya disimpan di komputer, bukan di repository.
- Scan gagal karena internet masuk antrean lokal.
- Setiap scan memiliki scan_id agar retry tidak memproses scan yang sama dua kali.

Arsitektur:

HC-T58 USB-COM -> Scanner Bridge -> HTTPS -> Supabase Edge Function -> Absensi Guru

Endpoint:
https://zevdqmrlcrnwkeqejbxm.supabase.co/functions/v1/scanner-bridge

Data lokal:
C:\ProgramData\SIMANIS-Scanner-Bridge\config.json
C:\ProgramData\SIMANIS-Scanner-Bridge\bridge.log
C:\ProgramData\SIMANIS-Scanner-Bridge\offline_queue.jsonl

Jangan membagikan config.json karena berisi device token.

Paket Windows dibangun oleh GitHub Actions pada workflow build-scanner-bridge.yml.
