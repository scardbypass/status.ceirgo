# Integrasi Riwayat Order CeirGo (REAL DATA)

## Penting
Website status di repository ini **sudah mendukung data asli**, tetapi memerlukan endpoint di **website utama CeirGo**. Tanpa endpoint, semua layanan tampil **Unknown**, bukan status palsu.

## Instalasi integrasi
1. Ambil file `src/app/(api)/api/public/ceirgo-status/route.ts` dari patch CeirGo utama.
2. Pasang pada source Next.js utama di path yang sama.
3. Deploy ulang CeirGo utama, lalu pastikan `https://ceirgo.id/api/public/ceirgo-status` menghasilkan JSON berisi lima layanan.
4. Di VPS status, set `CEIRGO_STATUS_API=https://ceirgo.id/api/public/ceirgo-status` dan `DEMO_MODE=false`.
5. Restart `pm2 restart ceirgo-status`.

## Alur data asli
```
Prisma orders + services (CeirGo utama)
  -> API publik dengan field terbatas (nama layanan, status, waktu, event anonim)
  -> proxy status.ceirgo.id (cache 10 detik)
  -> Service Monitor + Live Order Terminal
```

## Kebijakan status
- `completed` terbaru dalam 30 menit: Online.
- `processing`: tidak mengubah status.
- Kegagalan **teknis yang teridentifikasi**: Offline.
- Kesalahan input, pembatalan, refund, saldo kurang: tidak otomatis Offline.
- Tidak ada hasil relevan dalam 30 menit: Unknown.
- Service nonaktif oleh admin: Unknown (bukan bukti provider sedang offline).
- API gagal: Unknown.

## Privasi
Data publik **tidak** berisi IMEI, username, order ID, harga, kode produk, provider, atau error mentah. Terminal hanya menampilkan nama layanan, jenis peristiwa, dan waktu.

## Validasi sebelum produksi
Uji dengan satu order completed, satu error teknis, satu processing, satu input invalid, dan satu layanan tanpa order terbaru. Periksa payload API publik di browser Network tab untuk memastikan tidak ada data rahasia.

## Batasan uptime
Belum ada histori uptime 30 hari yang valid sampai sistem menyimpan snapshot monitoring periodik. Jangan menampilkan persentase uptime buatan.
