# Dynamic Bar Frontend

Direktori ini berisi frontend Next.js yang dipakai aplikasi desktop Dynamic Bar. Konfigurasi Tauri aktif dan kode native berada satu tingkat di atas, di [`../src-tauri`](../src-tauri).

## Isi utama

- `app/page.js`: UI panel dan tab Media, System, serta Notifikasi.
- `app/useSystem.js`: listener event dan wrapper command Tauri.
- `app/globals.css`: style global frontend.
- `next.config.mjs`: static export (`output: "export"`) yang menghasilkan direktori `out/`.
- `package.json`: script Next.js frontend.

Saat dijalankan oleh Tauri, frontend menggunakan URL development `http://localhost:1420`. Pada build desktop, Tauri memuat hasil export `out/`. Integrasi fitur sistem memerlukan runtime Tauri; menjalankan frontend di browser biasa tidak menyediakan API `window.__TAURI__`.

## Perintah

Jalankan dari direktori ini:

```powershell
npm run dev
npm run build
```

Atau jalankan dari root project:

```powershell
npm run dev --prefix frontend-dynamicbar
npm run build --prefix frontend-dynamicbar
```

Untuk menjalankan aplikasi desktop secara keseluruhan, gunakan `npm run dev` dari root project. Build desktop menggunakan `npm run build` dari root; kedua perintah tersebut memanggil Tauri CLI lokal.

> **Catatan dependency:** manifest frontend hanya berisi script dan lockfile saat ini tidak mendefinisikan dependency. Next.js dan Tauri CLI harus tersedia di `node_modules` sebelum menjalankan perintah.
