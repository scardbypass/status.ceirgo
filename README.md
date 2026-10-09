# CeirGo Status — status.ceirgo.id

Dashboard publik untuk lima layanan CeirGo dengan **Service Monitor** dan **Live Order Terminal** anonim. Data asli berasal dari API aplikasi utama CeirGo; tidak ada database tambahan pada server status.

## Fitur
- Cek Status IMEI, Cek History IMEI, Cek Bea Cukai, Cek Until, Create Barcode.
- **On-demand**: tidak ada scheduler/background polling ke API ketika tidak ada pengunjung atau permintaan bot.
- Saat halaman terlihat, browser refresh setiap **10 detik**; saat tab disembunyikan, polling berhenti dan dilanjutkan ketika tab aktif.
- Cache bersama dalam satu proses Node.js selama **10 detik**, deduplikasi request bersamaan (*single-flight*), cache gagal 5 detik.
- Perintah WhatsApp Bot `/status` memakai API publik yang sama, satu request per perintah.
- Status `online / offline / unknown`; jika API utama gagal, tampilkan **Unknown**, bukan Online palsu.
- Aktivitas maksimal 20 event, tanpa IMEI, nomor pelanggan, username, ID order, provider, harga, atau pesan error mentah.
- Tanpa WebSocket, cron, Redis, dan dependency npm tambahan.

## Arsitektur
```text
Order website + order WhatsApp Bot
       ↓ (keduanya tersimpan di CeirGo)
Riwayat Order CeirGo (database utama)
       ↓
GET https://ceirgo.id/api/public/ceirgo-status
       ↓
status.ceirgo.id/server.js (cache 10 detik)
       ├── Browser (GET /api/status tiap 10 detik hanya saat tab terlihat)
       └── SUPER-BOT (/status → GET /api/status sekali)
```

**Penting:** sistem ini membaca hasil order yang sudah tercatat, bukan melakukan synthetic probe ke provider. Ketika tidak ada request, server tetap idle menggunakan sedikit RAM tetapi **tidak** menjalankan query berkala. Karena itu, uptime 24 jam/30 hari tidak boleh diklaim tanpa sistem pencatatan historis yang terpisah.

## 1. Integrasi API utama CeirGo
Contoh Next.js route berada di `integration/ceirgo-main/route.ts`. **File ini tidak otomatis terpasang di aplikasi utama**: cocokkan Prisma schema, status transaksi, dan lokasi route dengan source CeirGo yang berjalan, lalu deploy pada aplikasi utama sebagai:
`GET https://ceirgo.id/api/public/ceirgo-status`.

Aturan klasifikasi: completed = online; kegagalan teknis = offline; pending/processing bukan bukti layanan rusak; tidak ada data baru = unknown. Satu produk gagal tidak berarti semua produk gagal. Jangan mengekspos raw order atau token internal. Endpoint utama sebaiknya juga memakai cache pendek dan pembatasan request.

Contoh respons:
```json
{
  "updatedAt": "2026-10-09T07:00:00.000Z",
  "services": [{"name":"Cek Status IMEI","state":"online","lastActivity":"2026-10-09T06:59:00.000Z"}],
  "activities": [{"name":"Cek Status IMEI","state":"completed","time":"2026-10-09T06:59:00.000Z"}]
}
```
Status proxy selalu memfilter ke lima nama publik yang didukung.

## 2. Install status server (Node.js 18+)
```bash
git clone https://github.com/scardbypass/status.ceirgo.git
cd status.ceirgo
cp .env.example .env
# Isi CEIRGO_STATUS_API jika URL berbeda, DEMO_MODE=false
npm run check
pm2 start server.js --name ceirgo-status
pm2 save
curl -s http://127.0.0.1:3108/health
curl -s http://127.0.0.1:3108/api/status
```
Default bind `127.0.0.1:3108`. Arahkan DNS `status.ceirgo.id` ke VPS, konfigurasi Nginx HTTPS reverse proxy ke `http://127.0.0.1:3108`. Gunakan Cloudflare Full (Strict) dengan sertifikat origin valid atau Let's Encrypt.

Contoh Nginx (pasang pada server block HTTPS yang sudah ada):
```nginx
location / {
    proxy_pass http://127.0.0.1:3108;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## 3. SUPER-BOT — perintah /status
Salin `integration/super-bot/status.js` ke direktori plugin bot yang sesuai (contoh: `plugins/status.js`). Plugin memakai pola `module.exports = {commands, menuSection, menu, run({reply})}`; **sesuaikan jika loader SUPER-BOT menggunakan struktur berbeda**. Restart PM2 bot setelah dipasang.

- User mengetik `/status` atau `/ceirgostatus`.
- Bot melakukan **satu** GET ke `https://status.ceirgo.id/api/status`, timeout 6 detik.
- Bot menampilkan lima layanan dan jumlah operational.
- Bila API tidak bisa dijangkau, bot memberi pesan tidak tersedia, bukan status palsu.
- Opsional: set `CEIRGO_PUBLIC_STATUS_URL` untuk mengganti endpoint.

Contoh:
```text
📡 CEIRGO • SYSTEM STATUS
✅ ALL SYSTEMS OPERATIONAL

🟢 Cek Status IMEI — ONLINE
🟢 Cek History IMEI — ONLINE
🟢 Cek Bea Cukai — ONLINE
🟢 Cek Until — ONLINE
🟢 Create Barcode — ONLINE

Operational: 5/5 Services

🌐 https://status.ceirgo.id
```
**Contoh saja**, bukan data real.

## 4. Verifikasi
```bash
npm run check
node --check public/app.js
node --check integration/super-bot/status.js
curl -i http://127.0.0.1:3108/api/status
```
Cek bahwa endpoint utama sudah terpasang, lima nama layanan benar, error teknis menghasilkan Offline, pending tidak menghasilkan Offline, dan ketika upstream mati semua status Unknown. Uji juga saat tab disembunyikan dan saat bot memanggil endpoint.

## Demo dan keamanan
`DEMO_MODE=true` hanya untuk pengembangan; **jangan** aktifkan di domain produksi. Jangan menaruh kredensial database atau API provider dalam repo publik. `/health` hanya mengecek proses status, bukan kesehatan layanan provider. `Live Order Terminal` adalah aktivitas anonim, bukan shell/SSH.
