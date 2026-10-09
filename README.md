# CeirGo Status — status.ceirgo.id

Website monitoring publik untuk lima layanan CeirGo, dengan **Service Monitor**, **Uptime/Incident** (jika data historis tersedia), dan **Live Order Terminal** anonim.

> **Penting:** repository ini hanya berisi *frontend status terpisah*. Data asli harus disediakan aplikasi CeirGo melalui endpoint `/api/public/ceirgo-status`. Jangan menghubungkan website publik langsung ke database order atau menyimpan token provider di repository ini.

## Fitur
- Lima layanan: Cek Status IMEI, Cek History IMEI, Cek Bea Cukai, Cek Until, Create Barcode.
- Polling setiap 10 detik tanpa reload halaman.
- Status Online / Offline / Unknown; status keseluruhan merangkum semua layanan.
- Terminal aktivitas order anonim, maksimum 20 event.
- Mode demo yang jelas ditandai **DEMO**, tanpa membuat transaksi palsu.
- Tidak mengirim nama provider, kode produk, IMEI, user, harga, ID order, atau raw error ke browser.
- Server Node bawaan tanpa dependency npm tambahan; cache proxy 10 detik.

## Alur kerja
```text
Order CeirGo -> Riwayat Order -> klasifikasi error di backend CeirGo
 -> GET /api/public/ceirgo-status (data anonim)
 -> server.js (cache 10 detik) -> browser status.ceirgo.id (poll 10 detik)
 -> Monitor lima produk + terminal aktivitas
```

**Aturan status** harus ditentukan oleh backend CeirGo: order `completed` = online, error **teknis** = offline, pending dan kesalahan input pengguna tidak boleh dianggap provider offline. Bila data terlalu lama atau API gagal, gunakan **Unknown**, bukan mengklaim Online. Satu layanan offline tidak otomatis membuat semua layanan offline.

## Instalasi VPS
```bash
git clone https://github.com/scardbypass/status.ceirgo.git
cd status.ceirgo
cp .env.example .env
nano .env
npm run check
npm start
```
Default port `3108`. Untuk produksi jalankan dengan PM2:
```bash
pm2 start server.js --name ceirgo-status
pm2 save
```

### Nginx dan Cloudflare
Tambahkan DNS `status` yang mengarah ke VPS. Pasang reverse proxy Nginx dengan upstream `http://127.0.0.1:3108`, lalu aktifkan HTTPS (Cloudflare Full Strict dengan sertifikat origin yang valid atau Let's Encrypt). Jangan membuka port 3108 ke internet jika Nginx berada di server yang sama.

```nginx
server {
    listen 80;
    server_name status.ceirgo.id;
    location / {
        proxy_pass http://127.0.0.1:3108;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
Konfigurasi port 80 hanya contoh reverse proxy; aktifkan HTTPS sebelum digunakan publik.

## API yang dibutuhkan
`GET https://ceirgo.id/api/public/ceirgo-status` harus mengembalikan:
```json
{
  "updatedAt": "2026-10-09T07:00:00.000Z",
  "services": [
    {"name":"Cek Status IMEI","state":"online","lastActivity":"2026-10-09T06:59:00.000Z"}
  ],
  "activities": [
    {"name":"Cek Status IMEI","state":"completed","time":"2026-10-09T06:59:00.000Z"}
  ]
}
```
Nilai state layanan: `online|offline|unknown`; aktivitas: `completed|processing|error`. Gunakan lima nama produk yang didukung. API tidak boleh mengembalikan data sensitif. Server proxy melakukan *allowlist* field lagi.

## Demo
Set `DEMO_MODE=true` dalam `.env` dan restart proses. Tampilan akan bertanda **DEMO** dan menampilkan contoh lima produk beserta terminal. Kembalikan ke `false` untuk produksi. Jangan menyalakan demo di domain publik produksi.

## Pengujian
```bash
npm run check
curl -i http://127.0.0.1:3108/health
curl -i http://127.0.0.1:3108/api/status
```
Periksa kondisi API gagal, status Unknown, tidak ada order, status error teknis, dan sanitasi data sebelum produksi.

## Keamanan dan batasan
- Riwayat order harus tetap berada di backend CeirGo; gunakan database read-only jika perlu.
- Terminal adalah **feed aktivitas**, bukan shell/SSH.
- Jangan menghitung uptime historis 30 hari tanpa menyimpan snapshot status berkala.
- Cache dalam proses tidak dibagi antar-instance; untuk skala besar gunakan Redis atau CDN dengan konfigurasi sesuai kebutuhan.
- Jangan tampilkan aktivitas real-time jika berisiko mengungkap pola pelanggan; gunakan jeda/batching di backend.
