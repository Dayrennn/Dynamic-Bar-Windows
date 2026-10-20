# Dynamic Bar for Windows

Dynamic Bar adalah aplikasi desktop Windows yang menampilkan bar kecil di tepi atas layar. Bar ini menggabungkan informasi media dan beberapa kontrol sistem Windows dalam panel yang dapat berubah ukuran sesuai aktivitas dan interaksi pengguna.

## Daftar Isi

- [Tentang Project](#tentang-project)
- [Tujuan Project](#tujuan-project)
- [Fitur](#fitur)
- [Teknologi](#teknologi)
- [Arsitektur dan Cara Kerja](#arsitektur-dan-cara-kerja)
- [Alur Teknis Cara Kerja Aplikasi](#alur-teknis-cara-kerja-aplikasi)
- [Struktur Project](#struktur-project)
- [Prasyarat](#prasyarat)
- [Setup dan Menjalankan Development](#setup-dan-menjalankan-development)
- [Build Production](#build-production)
- [Konfigurasi](#konfigurasi)
- [State, Interaksi, dan Animasi](#state-interaksi-dan-animasi)
- [Workflow Development](#workflow-development)
- [Troubleshooting](#troubleshooting)
- [Batasan dan Status](#batasan-dan-status)
- [Kesimpulan](#kesimpulan)

## Tentang Project

Dynamic Bar mengadaptasi gagasan Dynamic Island/Dynamic Bar perangkat modern menjadi elemen desktop Windows yang berada di tengah tepi atas layar. Panel ringkas ini dapat menyajikan status media, status sistem, dan notifikasi Windows, sementara bentuknya beralih antara strip, panel ringkas, HUD, dan tampilan penuh.

Aplikasi dibuat menggunakan frontend web yang berjalan di dalam window desktop Tauri. Informasi dan kontrol Windows disediakan oleh layer native Rust. Dengan demikian, antarmuka web tidak mengakses perangkat sistem secara langsung; UI berkomunikasi dengan Rust melalui event dan perintah Tauri.

## Tujuan Project

- Menampilkan kontrol media dan informasi sistem dalam satu area kecil yang mudah dijangkau.
- Menggabungkan UI berbasis web dengan API desktop Windows melalui Tauri.
- Menyediakan panel yang menyesuaikan ukurannya dengan aktivitas yang sedang ditampilkan.

## Fitur

Berdasarkan implementasi saat ini, aplikasi menyediakan:

- Bar transparan di bagian tengah atas layar, dengan window borderless, selalu di atas window lain, dan tidak ditampilkan di taskbar.
- Tampilan strip saat tidak ada aktivitas, tampilan ringkas setelah media baru saja diputar, HUD untuk perubahan sistem/notifikasi, dan panel penuh saat pointer berada di atas bar.
- Informasi sesi media Windows yang tersedia: judul, artis, artwork jika tersedia, posisi, durasi, dan status pemutaran.
- Kontrol media play/pause, lagu berikutnya, dan lagu sebelumnya melalui Windows System Media Transport Controls.
- Tampilan tingkat dan status pengisian baterai, serta peringatan saat baterai turun ke ambang 20%, 10%, dan 5%.
- Tampilan dan pengaturan volume sistem, termasuk status mute.
- Tampilan dan pengaturan kecerahan layar melalui Windows Management Instrumentation (WMI).
- Ringkasan notifikasi Windows baru, termasuk nama aplikasi, teks, dan ikon jika tersedia; daftar di panel menyimpan hingga 20 notifikasi dan dapat dihapus dari tampilan aplikasi.
- HUD sementara untuk perubahan volume/kecerahan, peringatan baterai rendah, dan notifikasi baru.
- Perubahan ukuran window native agar mengikuti mode UI, serta transisi ukuran, opasitas, posisi konten, dan bayangan.

Ketersediaan data media, notifikasi, baterai, dan kecerahan bergantung pada API Windows, izin, perangkat, dan aplikasi yang menyediakan data terkait.

## Teknologi

| Teknologi                                                 | Peran                                                                                                        |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Next.js 16.4.2                                            | Menyediakan aplikasi frontend dan proses development; output production dikonfigurasi sebagai static export. |
| React 19.3.0                                              | Membuat UI dan mengelola state komponen.                                                                     |
| JavaScript                                                | Bahasa untuk frontend dan hook integrasi sistem.                                                             |
| Tailwind CSS 4                                            | Styling utility pada antarmuka.                                                                              |
| Tauri 2                                                   | Membungkus frontend sebagai aplikasi desktop dan menyediakan komunikasi invoke/event.                        |
| Rust (edition 2024)                                       | Layer native yang mengakses API Windows dan mengirim data ke frontend.                                       |
| Windows API, WMI, Windows System Media Transport Controls | Menyediakan integrasi media, audio, baterai, kecerahan, dan notifikasi.                                      |
| npm                                                       | Mengelola dependency frontend dan menjalankan script project.                                                |

Dependency frontend dan Tauri CLI didefinisikan di `frontend-dynamicbar/package.json`. Dependency native didefinisikan di `src-tauri/Cargo.toml`.

## Arsitektur dan Cara Kerja

```text
Windows API / WMI
        ↕
Layer native Rust (src-tauri)
        ↕  Tauri commands dan events
Hook useSystem (React)
        ↕
Dynamic Bar UI (Next.js / React)
```

Saat aplikasi dimulai, Tauri membuat window utama dan menempatkannya di tengah atas monitor utama. Fungsi Rust `start` memulai worker yang membaca sesi media, volume, baterai, kecerahan, dan notifikasi Windows, lalu mengirim pembaruan ke frontend dengan event Tauri. Hook `useSystem` menerima event tersebut dan mengelola state data serta HUD sementara.

UI memanggil perintah Tauri untuk mengontrol media, volume, kecerahan, dan ukuran window. Ukuran window diperbarui mengikuti mode panel sehingga area transparan yang dimiliki aplikasi tidak lebih besar dari kebutuhan tampilannya.

## Struktur Project

```text
project-root/
├── frontend-dynamicbar/
│   ├── app/
│   │   ├── page.js
│   │   ├── useSystem.js
│   │   ├── layout.js
│   │   └── globals.css
│   ├── public/
│   ├── package.json
│   ├── package-lock.json
│   ├── next.config.mjs
│   ├── postcss.config.mjs
│   └── eslint.config.mjs
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs
│   │   ├── sys.rs
│   │   └── main.rs
│   ├── capabilities/
│   │   └── default.json
│   ├── icons/
│   ├── Cargo.toml
│   ├── Cargo.lock
│   └── tauri.conf.json
├── src/
│   ├── index.html
│   ├── main.js
│   └── styles.css
├── package.json
├── package-lock.json
└── README.md
```

File dan folder penting:

- `frontend-dynamicbar/app/page.js`: komponen utama Dynamic Bar, tampilan panel, state mode, tab, dan aksi pengguna.
- `frontend-dynamicbar/app/useSystem.js`: menerima event native, menyimpan data sistem, mengelola HUD, dan membungkus pemanggilan command Tauri.
- `frontend-dynamicbar/app/globals.css`: style global dan latar transparan untuk halaman.
- `frontend-dynamicbar/app/layout.js`: root layout Next.js dan metadata dasar halaman.
- `frontend-dynamicbar/package.json`: dependency frontend serta script Next.js, lint, dan Tauri CLI.
- `frontend-dynamicbar/next.config.mjs`: mengaktifkan static export dengan `output: "export"` dan menonaktifkan optimasi image bawaan.
- `src-tauri/src/lib.rs`: mendaftarkan command Tauri dan memulai pembacaan data native.
- `src-tauri/src/sys.rs`: integrasi Windows untuk media, volume, baterai, kecerahan, notifikasi, dan pengubahan ukuran window.
- `src-tauri/src/main.rs`: entry point binary desktop yang menjalankan library Tauri.
- `src-tauri/tauri.conf.json`: konfigurasi build frontend, window, security, identitas aplikasi, dan bundling.
- `src-tauri/capabilities/default.json`: capability untuk window utama dengan permission `core:default`.
- `src-tauri/Cargo.toml` dan `src-tauri/Cargo.lock`: dependency dan konfigurasi build Rust.
- `src-tauri/icons/`: ikon aplikasi untuk target bundle.
- `package.json` di root: perintah `npm run dev` dan `npm run build` yang menjalankan Tauri CLI dari dependency lokal di `frontend-dynamicbar`.
- `src/`: berisi halaman, JavaScript, dan CSS starter Tauri vanilla. Konfigurasi Tauri saat ini menunjuk ke `frontend-dynamicbar/out` sebagai frontend, sehingga folder `src/` bukan frontend yang digunakan oleh build desktop aktif.

## Prasyarat

- Windows; layer integrasi sistem pada project ini menggunakan API khusus Windows.
- Node.js **20.9.0 atau lebih baru** dan npm. Batas Node.js mengikuti persyaratan Next.js 16.4.2.
- Rust toolchain dan Cargo. `Cargo.toml` menggunakan edition 2024 (memerlukan Rust 1.85 atau lebih baru).
- Prasyarat build desktop Tauri di Windows, termasuk Microsoft C++ Build Tools (workload Desktop development with C++) dan WebView2 Runtime.

Project tidak menentukan versi npm atau konfigurasi environment khusus. Tidak ditemukan file environment `.env` yang digunakan aplikasi.

## Setup dan Menjalankan Development

Jalankan dari root project di terminal:

```powershell
npm ci --prefix frontend-dynamicbar
npm run dev
```

Perintah pertama memasang dependency berdasarkan lockfile di `frontend-dynamicbar`. Perintah kedua menjalankan script root yang memanggil Tauri CLI. Tauri kemudian menjalankan `npm run dev --prefix frontend-dynamicbar` sebelum membuka window desktop; Next.js development server menggunakan port `1420` seperti yang ditentukan di script dan `devUrl` Tauri.

Untuk menjalankan lint frontend, script yang tersedia berada di package frontend:

```powershell
npm run lint --prefix frontend-dynamicbar
```

Aplikasi sebaiknya dijalankan melalui Tauri (`npm run dev` dari root), bukan hanya membuka frontend Next.js di browser, karena pembacaan dan kontrol sistem memerlukan runtime Tauri serta command native.

## Build Production

Dari root project, jalankan:

```powershell
npm run build
```

Script root menjalankan Tauri build. Sebelum build native, Tauri memanggil `npm run build --prefix frontend-dynamicbar`; Next.js kemudian menghasilkan static export ke `frontend-dynamicbar/out`, lokasi yang ditetapkan sebagai `frontendDist` pada konfigurasi Tauri. Selanjutnya Tauri/Cargo membangun aplikasi desktop dan bundle yang didukung konfigurasi.

## Konfigurasi

Konfigurasi utama berada di `src-tauri/tauri.conf.json`:

- URL development adalah `http://localhost:1420`; frontend production diambil dari `../frontend-dynamicbar/out`.
- Window utama berukuran awal 140 × 6 logical pixel, tidak dapat diubah ukurannya secara manual, tanpa dekorasi, transparan, selalu di atas, tidak ditampilkan di taskbar, dan tanpa shadow native.
- Saat start dan saat ukuran berubah, Rust memosisikan window secara horizontal di tengah monitor utama dan pada tepi atasnya.
- Bundling Tauri aktif dan target bundle disetel ke `all`.
- Integrasi command/event frontend menggunakan global Tauri (`withGlobalTauri: true`).

Konfigurasi frontend berada di `frontend-dynamicbar/next.config.mjs`, `frontend-dynamicbar/postcss.config.mjs`, dan `frontend-dynamicbar/eslint.config.mjs`. Tidak ada environment variable aplikasi yang didefinisikan pada konfigurasi yang diperiksa.

## State, Interaksi, dan Animasi

### Mode tampilan

Komponen utama memilih mode berdasarkan prioritas berikut:

```text
expanded → hud → recentlyPlaying → strip
```

- `strip`: strip tipis ketika tidak ada aktivitas.
- `playing`: panel ringkas saat media aktif atau hingga empat detik setelah pemutaran berhenti.
- `hud`: tampilan informasi sementara untuk event volume, baterai rendah, kecerahan, atau notifikasi.
- `full`: panel penuh ketika state `expanded` aktif.

Mode penuh memiliki tiga tab: **Media**, **System**, dan **Notifikasi**. Pemilihan tab disimpan sebagai state React `activeTab`.

### Interaksi pengguna

- Mengarahkan pointer ke bar membuka tampilan penuh; meninggalkan area menutupnya setelah jeda singkat.
- Mengklik baris atas juga mengubah state expand/collapse.
- Tab Media menyediakan kontrol sebelumnya, play/pause, dan berikutnya.
- Tab System menyediakan slider volume dan kecerahan serta ringkasan baterai.
- Tab Notifikasi menampilkan notifikasi baru yang tersimpan di UI; tombol hapus mengeluarkan item dari daftar aplikasi.

### Transisi

Perubahan lebar dan tinggi panel menggunakan transisi CSS 480 ms dengan kurva cubic-bezier. Radius sudut dan shadow turut berubah menurut mode. Konten HUD dan panel penuh menggunakan transisi opacity dan pergeseran vertikal. Window native dibesarkan sebelum animasi ekspansi, sedangkan resize untuk mengecilkan window ditunda sekitar 520 ms agar konten tidak terpotong.

## Workflow Development

```text
Pasang dependency di frontend-dynamicbar
              ↓
Jalankan npm run dev dari root
              ↓
Uji UI dan integrasi Windows di window Tauri
              ↓
Ubah frontend di frontend-dynamicbar/app
atau integrasi native di src-tauri/src
              ↓
Jalankan lint frontend bila diperlukan
              ↓
Jalankan npm run build dari root
```

## Troubleshooting

### Perintah `npm run dev` tidak menemukan Tauri CLI

Pastikan dependency frontend sudah dipasang dari root:

```powershell
npm ci --prefix frontend-dynamicbar
```

### Next.js gagal dijalankan karena versi Node.js

Periksa `node --version`. Next.js 16.4.2 memerlukan Node.js 20.9.0 atau lebih baru.

### Build native Tauri gagal

Pastikan Rust/Cargo dan prasyarat build desktop Windows Tauri (Microsoft C++ Build Tools) tersedia. Jika menjalankan aplikasi desktop di Windows, periksa juga ketersediaan WebView2 Runtime.

### Data atau kontrol sistem tidak muncul/bekerja

Integrasi menggunakan Windows API dan memerlukan aplikasi media yang menerbitkan sesi media Windows. Pembacaan kecerahan bergantung pada dukungan WMI monitor. Untuk notifikasi, izinkan akses notifikasi Windows ketika diminta; jika izin tidak diberikan, worker notifikasi tidak dapat meneruskan notifikasi ke aplikasi.

## Batasan dan Status

- Integrasi media, volume, baterai, kecerahan, dan notifikasi diimplementasikan khusus untuk Windows, bukan lintas platform.
- Data media hanya tersedia ketika Windows menyediakan sesi System Media Transport Controls; artwork juga hanya ditampilkan jika tersedia dari sesi tersebut.
- Pengaturan kecerahan menggunakan WMI dan tidak menjamin dukungan pada setiap monitor atau konfigurasi perangkat.
- Window ditempatkan pada monitor utama. Tidak ada pilihan monitor, posisi, ukuran, tema, atau preferensi pengguna yang dikonfigurasi melalui UI.
- Notifikasi lama yang sudah berada di Notification Center pada awal proses diabaikan oleh listener. Tombol hapus menghapus notifikasi dari daftar aplikasi, bukan menjalankan dismiss Windows.
- Informasi dan kontrol bergantung pada perangkat keras, API Windows, izin, serta aplikasi sumbernya.
- Folder `src/` berisi starter Tauri vanilla; frontend yang dipakai konfigurasi build saat ini berada di `frontend-dynamicbar/`.

**Status: Functional.** Implementasi saat ini sudah menggabungkan panel UI desktop dengan pembacaan dan kontrol beberapa fitur Windows, dengan batasan ketersediaan API/perangkat yang dijelaskan di atas.

## Kesimpulan

Dynamic Bar for Windows adalah aplikasi desktop Tauri dengan antarmuka Next.js/React dan layer native Rust. UI menampilkan kontrol media, status sistem, dan notifikasi dalam panel yang berubah sesuai aktivitas. Untuk development, pasang dependency dengan `npm ci --prefix frontend-dynamicbar`, lalu jalankan `npm run dev` dari root; gunakan `npm run build` untuk membuat build desktop production.

# Alur Teknis Cara Kerja Aplikasi

Bagian ini membedah aliran data antara Next.js/React, Tauri, Rust, dan API Windows berdasarkan implementasi yang ada. Istilah “Next.js → Rust” digunakan sebagai penyederhanaan; keduanya tidak membuat koneksi langsung.

## Gambaran Besar Arsitektur

```text
┌───────────────────────────────────────────┐
│            Next.js / React                │
│                                           │
│  app/page.js       UI, state tampilan     │
│  app/useSystem.js  state data sistem      │
│  app/globals.css   style halaman           │
└──────────────────────┬────────────────────┘
                       │ window.__TAURI__.core.invoke(...)
                       │ window.__TAURI__.event.listen(...)
                       ▼
┌───────────────────────────────────────────┐
│                   Tauri                   │
│        Desktop WebView + IPC bridge       │
└──────────────────────┬────────────────────┘
                       │ command request / event
                       ▼
┌───────────────────────────────────────────┐
│             Native layer Rust             │
│  src-tauri/src/lib.rs  setup dan commands │
│  src-tauri/src/sys.rs  integrasi sistem   │
└──────────────────────┬────────────────────┘
                       │ Windows API / WMI / COM
                       ▼
┌───────────────────────────────────────────┐
│              Windows System               │
│   Media / Audio / Brightness / Battery    │
│   Notifications / Native window           │
└───────────────────────────────────────────┘
```

- **Next.js** menyediakan frontend dan proses development. Konfigurasi build-nya mengekspor halaman statis ke `frontend-dynamicbar/out`.
- **React** merender komponen dan menyimpan state UI/data yang diterima. `page.js` adalah komponen UI utama; `useSystem.js` menghubungkan data sistem ke state React.
- **Tauri** menjalankan frontend di desktop WebView dan menyediakan IPC (inter-process communication) untuk memanggil Rust serta menerima event Rust. `withGlobalTauri: true` mengaktifkan API global yang digunakan frontend.
- **Rust** menjalankan logic native. `lib.rs` menginisialisasi aplikasi dan mendaftarkan commands; `sys.rs` membaca/mengubah data sistem Windows dan mengirim event.
- **Windows API/WMI** menyediakan antarmuka OS yang digunakan Rust untuk sesi media, audio, daya, notifikasi, dan kecerahan.

Rust tidak menggambar komponen Dynamic Bar: tampilan dibuat oleh HTML/React di WebView. Sebaliknya, frontend web tidak mengakses API Windows tersebut langsung; ia memanggil API Tauri, yang meneruskan permintaan melalui IPC ke command Rust. Tauri diperlukan sebagai runtime desktop sekaligus jembatan antara WebView dan native layer.

## Konsep Komunikasi: Bukan Koneksi Langsung

Jalur permintaan dari frontend:

```text
React / Next.js
       ↓
Tauri JavaScript API (core.invoke)
       ↓
Tauri IPC
       ↓
Rust command
       ↓
Windows API / WMI
```

Jalur pembaruan dari sistem:

```text
Windows API / WMI
       ↓
Rust worker membaca data
       ↓
AppHandle.emit(event, payload)
       ↓
Tauri event bridge
       ↓
Tauri JavaScript API (event.listen)
       ↓
React state
       ↓
UI
```

Istilah dalam project:

| Istilah          | Makna pada implementasi ini                                                                                                                                     |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **WebView**      | Runtime tampilan web yang memuat frontend dalam window desktop Tauri.                                                                                           |
| **IPC**          | Jalur komunikasi antara JavaScript di WebView dan proses native Tauri. Frontend tidak memanggil fungsi Rust lewat pemanggilan fungsi JavaScript biasa.          |
| **Command**      | Fungsi Rust yang diberi `#[tauri::command]`, didaftarkan di `lib.rs`, lalu dapat diminta frontend menggunakan `core.invoke`.                                    |
| **invoke**       | API JavaScript untuk meminta Tauri menjalankan command. Hasilnya berupa Promise; command kontrol di project ini tidak mengembalikan data berguna (return unit). |
| **Event**        | Pesan bernama yang dikirim native dengan `emit`, misalnya `"volume"` atau `"media"`.                                                                            |
| **Listener**     | Callback JavaScript yang didaftarkan dengan `event.listen` untuk menerima event bernama.                                                                        |
| **Payload**      | Isi data yang dibawa event. Contohnya payload `"volume"` berisi `level` dan `muted`.                                                                            |
| **State**        | Data React yang menentukan nilai dan konten yang dirender; contoh `volume`, `battery`, `media`, dan `hud`.                                                      |
| **Native layer** | Bagian Rust/Tauri yang berinteraksi dengan Windows, bukan UI React.                                                                                             |

Kode aplikasi mendokumentasikan kontrak command, nama event, dan bentuk payload, tetapi tidak menentukan framing atau encoding byte internal IPC; bagian tersebut ditangani Tauri dan tidak dapat dipastikan hanya dari source project ini.

## Bedah `src-tauri/src/lib.rs`

File ini menyusun Tauri Builder, mendaftarkan command, mengatur posisi awal window, dan memulai worker sistem saat aplikasi siap.

### `run`

| Aspek                    | Penjelasan                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| **Function**             | `run()`                                                                                                      |
| **Lokasi**               | `src-tauri/src/lib.rs`                                                                                       |
| **Tujuan**               | Membuat dan menjalankan aplikasi Tauri.                                                                      |
| **Dipanggil oleh**       | `main()` pada `src-tauri/src/main.rs` melalui `dynamicbar_lib::run()`.                                       |
| **Memanggil**            | `tauri::Builder::default()`, `invoke_handler`, `setup`, lalu `.run(tauri::generate_context!())`.             |
| **Menghasilkan**         | Aplikasi desktop yang berjalan; kegagalan `.run` menyebabkan `expect` menghasilkan panic dengan pesan error. |
| **Berkomunikasi dengan** | Tauri runtime, window WebView utama, commands, dan worker di `sys.rs`.                                       |

`invoke_handler(tauri::generate_handler![...])` mendaftarkan empat command:

| Command frontend   | Fungsi Rust           | Parameter                                              | Nilai kembali                |
| ------------------ | --------------------- | ------------------------------------------------------ | ---------------------------- |
| `"media_control"`  | `sys::media_control`  | `action: String` (`"toggle"`, `"next"`, atau `"prev"`) | Tidak ada nilai data (`()`). |
| `"set_volume"`     | `sys::set_volume`     | `percent: f32`                                         | Tidak ada nilai data (`()`). |
| `"resize_window"`  | `sys::resize_window`  | `width: f64`, `height: f64`                            | Tidak ada nilai data (`()`). |
| `"set_brightness"` | `sys::set_brightness` | `percent: u32`                                         | Tidak ada nilai data (`()`). |

Command tidak mengembalikan state Windows terbaru. Untuk memperbarui UI, frontend menerima event terpisah seperti `"volume"` atau `"media"`.

Blok `.setup(|app| { ... })`:

1. Meminta Tauri mengambil WebView window dengan label `"main"` melalui `app.get_webview_window("main")`.
2. Jika monitor utama tersedia, menghitung posisi horizontal agar window berada di tengah, lalu meletakkannya pada koordinat atas monitor.
3. Memanggil `sys::start(app.handle().clone())` untuk memulai worker pembaca sistem.
4. Mengembalikan `Ok(())` agar proses setup berlanjut.

Window dibuat berdasarkan konfigurasi Tauri (bukan dengan menggambar window melalui React). Rust mengambil handle window utama untuk penempatan awal; command `resize_window` kemudian menerima handle `WebviewWindow` yang disediakan Tauri saat command dipanggil.

## Bedah `src-tauri/src/sys.rs`

File ini memuat struktur payload, helper Windows, commands, worker pemantau, dan command pengubahan ukuran window.

### Media

`MediaInfo` adalah payload serializable dengan field `title: String`, `artist: String`, `playing: bool`, `position: f64`, `duration: f64`, dan `art: Option<String>`.

- `pick_session` memilih sesi yang sedang diputar dari Windows System Media Transport Controls. Ia memprioritaskan current session yang sedang playing, kemudian sesi playing lain; jika tidak ada yang playing, ia mencoba sesi terakhir, current session, lalu sesi pertama.
- `read_media` membaca properti media, status playback, timeline, dan thumbnail dari sesi terpilih. Artwork diubah menjadi data URL JPEG base64. Posisi timeline dilengkapi perkiraan waktu berlalu dari `LastUpdatedTime` ketika media playing.
- Worker media di `start` meminta `GlobalSystemMediaTransportControlsSessionManager`, kemudian membaca tiap satu detik. Ia memancarkan event `"media"` hanya ketika `Option<MediaInfo>` berubah. Jika sesi/data tidak tersedia, nilai yang dipancarkan dapat berupa `null`.

Perintah kontrol:

```text
React control(action)
    → invoke("media_control", { action })
    → sys::media_control(action)
    → Windows media session
```

`media_control` meminta session manager, memilih sesi dengan `pick_session`, lalu memanggil `TryTogglePlayPauseAsync`, `TrySkipNextAsync`, atau `TrySkipPreviousAsync`. Fungsi ini tidak mengembalikan state playback; worker media mengamati perubahan sesudahnya dan mengirim `"media"` jika payload berubah.

### Volume

`endpoint()` menggunakan COM untuk mengambil default audio endpoint tipe render/multimedia melalui `IMMDeviceEnumerator`, lalu mengaktifkan `IAudioEndpointVolume`.

- Worker volume membaca level scalar dan mute menggunakan `GetMasterVolumeLevelScalar` serta `GetMute` setiap 120 ms.
- Level scalar dikonversi ke persentase integer; payload `Volume` memiliki `level: u32` dan `muted: bool`.
- Event `"volume"` dipancarkan saat nilai berubah dan dikirim ulang secara periodik sekitar tiga detik.
- Command `set_volume(percent)` membatasi `percent / 100` ke rentang 0–1 dan memanggil `SetMasterVolumeLevelScalar`.
- Tidak ada command khusus untuk mengatur mute. Status mute dibaca dan ditampilkan; slider UI mengubah level volume.

Alur command tidak menerima hasil volume secara langsung. Worker membaca nilai Windows berikutnya dan menjadi sumber event untuk state UI.

### Kecerahan

Worker kecerahan membuka koneksi WMI ke namespace `ROOT\\WMI`, menjalankan query untuk `WmiMonitorBrightness`, lalu membaca `CurrentBrightness`. Ia memeriksa tiap 300 ms dan memancarkan `"brightness"` saat berubah serta pengiriman ulang periodik sekitar tiga detik. Payload event ini berupa angka persentase (bukan object).

Command `set_brightness(percent)`:

1. Membatasi input menjadi maksimum 100 dan menyimpannya di atomic `PENDING`.
2. Menjalankan satu worker pemroses agar beberapa perubahan slider cepat dikoaleskan ke nilai terbaru.
3. Membuat proses PowerShell non-interaktif yang menjalankan `Get-CimInstance` pada `WmiMonitorBrightnessMethods`, lalu memanggil `WmiSetBrightness`.
4. Membaca hasil perubahan melalui worker WMI yang mengirim event `"brightness"`.

Command tidak mengembalikan hasil set brightness. Ketersediaannya bergantung pada dukungan WMI monitor.

### Baterai

Worker baterai memanggil Windows `GetSystemPowerStatus` tiap lima detik. Payload `Battery` memuat:

- `percent: u8`: `BatteryLifePercent` jika baterai terdeteksi, selain itu 0.
- `charging: bool`: diturunkan dari `ACLineStatus == 1`.
- `present: bool`: diturunkan dari `BatteryFlag` dan validitas persentase.

Worker memancarkan event `"battery"` tiap pembacaan berhasil. Di frontend, `useSystem.js` menggunakan payload ini untuk state dan memunculkan HUD pada ambang baterai rendah.

### Notifikasi

Worker notifikasi menggunakan `UserNotificationListener::Current()` dan meminta akses dengan `RequestAccessAsync`. Jika akses bukan `Allowed`, worker mencatat pesan ke stderr dan berhenti.

Jika izin tersedia, worker meminta daftar `NotificationKinds::Toast` tiap detik. Ia melewati item yang sudah terlihat/tercatat dalam `HashSet` dan melewati notifikasi lama pada pembacaan awal. Payload `Notif` berisi `id: u32`, `app`, `title`, `message`, dan `icon: Option<String>`. Teks diambil dari binding `"ToastGeneric"`; logo aplikasi dikonversi menjadi data URL PNG jika tersedia. Setiap notifikasi baru dikirim sebagai event `"notification"`.

Pembatasan hingga 20 item berada di React (`useSystem.js`), bukan pada worker Rust. Tombol hapus UI hanya menghapus item dari state frontend; tidak ada command dismiss yang memodifikasi Notification Center Windows.

### Worker dan pengiriman event

`start(app: AppHandle)` membuat thread terpisah untuk media, volume, baterai, kecerahan, dan notifikasi. Event dikirim dengan `a.emit("nama-event", payload)` atau `app.emit(...)`. Event name adalah kontrak yang harus sama antara Rust dan listener frontend.

Thread memakai interval polling masing-masing: media 1 detik; volume 120 ms; baterai 5 detik; brightness 300 ms; notifikasi 1 detik. Beberapa worker hanya memancarkan saat data berubah atau mengirim ulang berkala. Secara aktual banyak operasi Windows dan hasil `emit` ditangani dengan pola `if let Ok` atau `let _ = ...`; kegagalan tidak selalu diteruskan sebagai error kepada React.

### Resize native window

`resize_window(window, width, height)` adalah command Tauri. Ia memanggil `window.set_size(LogicalSize::new(width, height))`. Jika monitor utama dapat diperoleh, ia menggunakan scale factor untuk menghitung lebar fisik, memusatkan window secara horizontal, lalu menempatkannya di tepi atas. Hasil `set_size`/`set_position` tidak dikirim kembali sebagai event.

## Cara Next.js Berkomunikasi dengan Rust

Project mengaktifkan `withGlobalTauri: true`, sehingga hook memakai `window.__TAURI__` tanpa mengimpor modul API Tauri dari package frontend. Di `useSystem.js`, helper `invoke(cmd, args)` memanggil `window.__TAURI__?.core.invoke(cmd, args)`.

| Aksi frontend                                                | Command Tauri      | Fungsi Rust                                           | Parameter yang dikirim                                          | Dampak / hasil                                                                                                                       |
| ------------------------------------------------------------ | ------------------ | ----------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `control(action)` dari `useSystem`                           | `"media_control"`  | `sys::media_control(action: String)`                  | `{ action }`, dengan action `"toggle"`, `"next"`, atau `"prev"` | Meminta Windows session menjalankan aksi; tidak ada payload hasil command. Event `"media"` berikutnya memperbarui data jika berubah. |
| `setSystemVolume(percent)` dari `useSystem`                  | `"set_volume"`     | `sys::set_volume(percent: f32)`                       | `{ percent }`                                                   | Mengubah level endpoint audio default; worker volume membaca dan mengirim event `"volume"`.                                          |
| `setSystemBrightness(percent)` dari `useSystem`              | `"set_brightness"` | `sys::set_brightness(percent: u32)`                   | `{ percent }`                                                   | Menjadwalkan pengubahan brightness lewat WMI/PowerShell; worker brightness mengirim event `"brightness"`.                            |
| `window.__TAURI__.core.invoke(...)` dari effect di `page.js` | `"resize_window"`  | `sys::resize_window(window, width: f64, height: f64)` | `{ width, height }`                                             | Mengubah ukuran dan posisi WebView window.                                                                                           |

Alur umum untuk command:

1. Pengguna berinteraksi dengan elemen React.
2. Event handler memanggil fungsi yang dikembalikan `useSystem`.
3. Fungsi JavaScript memanggil `core.invoke` dengan nama command dan object argumen.
4. Tauri mengirim permintaan melewati IPC ke command Rust yang terdaftar.
5. Rust menjalankan operasi sistem terkait.
6. Command saat ini mengembalikan unit/tanpa data hasil yang dipakai UI.
7. Untuk data sistem yang dipantau, worker Rust mengirim event terpisah.
8. Listener React memproses event, mengubah state, lalu React merender ulang UI.

Karena command operasi sistem tidak mengembalikan state baru, jangan menyamakan penyelesaian Promise `invoke` dengan konfirmasi nilai Windows. State aktual di UI berasal dari event listener.

## Cara Rust Mengirim Data ke Next.js

Rust membuat payload dan mengirimkannya melalui `Emitter::emit`. `useSystem.js` memasang listener Tauri dengan `tauri.event.listen(name, callback)`. Callback mengambil `e.payload` lalu memperbarui state.

| Event            | Dibuat di                         | Payload                                                                              | Listener                                  | Tujuan UI                                                       |
| ---------------- | --------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------- | --------------------------------------------------------------- |
| `"media"`        | Worker media di `sys::start`      | `MediaInfo` atau `null`: `title`, `artist`, `playing`, `position`, `duration`, `art` | `on("media", setMedia)` di `useSystem.js` | Artwork, metadata, progress, dan kontrol playback di tab Media. |
| `"volume"`       | Worker volume di `sys::start`     | `{ level, muted }`                                                                   | `on("volume", ...)`                       | Slider/label volume dan HUD ketika nilai berubah.               |
| `"brightness"`   | Worker WMI di `sys::start`        | Angka persentase                                                                     | `on("brightness", ...)`                   | Slider/label kecerahan dan HUD saat nilainya berubah.           |
| `"battery"`      | Worker baterai di `sys::start`    | `{ percent, charging, present }`                                                     | `on("battery", ...)`                      | Informasi baterai serta HUD pada ambang rendah.                 |
| `"notification"` | Worker notifikasi di `sys::start` | `{ id, app, title, message, icon }`                                                  | `on("notification", ...)`                 | Menambahkan item ke daftar notifikasi dan menampilkan HUD.      |

Contoh siklus event volume:

```text
sys.rs: worker membaca IAudioEndpointVolume
       ↓
emit("volume", Volume { level, muted })
       ↓
Tauri mengirim event ke WebView
       ↓
useSystem.js: on("volume", callback)
       ↓
setVolume(v) dan, jika berubah, showHud(...)
       ↓
page.js membaca volume / hud dari hook
       ↓
React merender label, slider, atau HUD
```

`listen` bersifat asinkron dan mengembalikan fungsi unlisten. Hook menyimpan fungsi tersebut; saat komponen dibersihkan, ia menandai registrasi sebagai cancelled dan memanggil semua unlistener yang sudah tersedia. Jika listener selesai didaftarkan setelah cleanup, fungsi itu langsung dipanggil.

## Bedah `frontend-dynamicbar/app/useSystem.js`

Hook ini menjadi adaptor antara event/command Tauri dan UI React:

- State data: `media`, `volume`, `battery`, `notifications`, `hud`, dan `brightness`.
- Refs: `lastBrightness`, `lastVolume`, serta `lastAlert` menyimpan pembacaan sebelumnya agar HUD tidak tampil pada pembacaan awal/repeat dan agar peringatan baterai tidak diulang pada level yang sama. `hudTimer` mengelola timer HUD.
- `showHud(type, data, ms)` membersihkan timer sebelumnya, mengatur object `{ type, data }`, dan menghapus HUD setelah durasi.
- `useEffect` memeriksa `window.__TAURI__`, mendaftarkan listener untuk kelima event, dan membersihkannya saat unmount.
- Event volume hanya menampilkan HUD ketika level/mute berbeda dari pembacaan sebelumnya; event brightness menggunakan logika serupa.
- Event battery menyimpan payload. Jika baterai tidak hadir, callback selesai; saat charging atau di atas 20%, ambang alert direset. Jika turun melewati 20%, 10%, atau 5%, HUD ditampilkan selama lima detik.
- Event notification menambahkan item di awal array, membatasi daftar menjadi 20, lalu menunjukkan HUD selama empat detik.
- Helper `control`, `setSystemVolume`, dan `setSystemBrightness` memanggil command; `dismiss(id)` hanya memfilter state notifikasi lokal.

```text
Rust event
   ↓
useSystem.js listener
   ↓
React state / HUD
   ↓
page.js membaca nilai hook
   ↓
UI Dynamic Bar
```

Jika global Tauri tidak tersedia, effect tidak memasang listener dan helper invoke opsional tidak mengirim command. `page.js` tetap merupakan UI React; integrasi sistem memerlukan aplikasi yang dijalankan di runtime Tauri.

## Bedah `frontend-dynamicbar/app/page.js`

`Home` mengambil state/action dari `useSystem()` lalu mengatur state tampilan lokal, termasuk `expanded`, `activeTab`, `recentlyPlaying`, `dragBrightness`, dan timer/ref untuk hover, resize, serta slider brightness.

Mode dihitung sebagai:

```js
const mode = expanded ? "full" : hud ? "hud" : recentlyPlaying ? "playing" : "strip";
```

Prioritasnya dari yang tertinggi adalah `full`, `hud`, `playing`, lalu `strip`. Ukuran mode ditetapkan di file yang sama: `STRIP` 140×6, `COLLAPSED` 200×34, `HUD` 330×80, dan `EXPANDED` 390×244. Nilai ini adalah ukuran UI; ukuran native window ditambah ruang untuk sudut notch/isi HUD atau mode penuh.

Rangkaian UI:

```text
React state / event handler
       ↓
Pilihan mode dan active tab
       ↓
Conditional rendering konten Media / System / Notifikasi
       ↓
CSS transition, opacity, dan transform
       ↓
Resize window native melalui invoke("resize_window", ...)
```

- `onMouseEnter` memanggil `open()` untuk mengatur `expanded=true`; `onMouseLeave` menjadwalkan penutupan setelah 160 ms.
- Klik baris atas meng-toggle `expanded`.
- Perubahan `media.playing` mengatur `recentlyPlaying`; setelah playback berhenti panel ringkas dipertahankan empat detik.
- `changeBrightness` memperbarui nilai drag sementara dan memanggil `setSystemBrightness`.
- Saat `mode` berubah, effect menghitung target size. Window diperbesar sebelum animasi; saat mengecil, pemanggilan `resize_window` ditunda 520 ms.
- UI merender tab Media, System, atau Notifikasi berdasarkan `activeTab`. Nilai `hud.type` menentukan konten HUD yang dirender.

## Window Native Tauri

Konfigurasi `src-tauri/tauri.conf.json` membuat window utama dengan ukuran awal 140×6 logical pixel, `resizable: false`, `decorations: false`, `transparent: true`, `alwaysOnTop: true`, `skipTaskbar: true`, dan `shadow: false`. Maka aplikasi tidak memakai frame/title bar biasa dan area WebView transparan; panel hitam/strip digambar oleh React.

Posisi dan ukuran ditangani dalam dua tahap:

1. Saat startup, `lib.rs::run` mengambil window `"main"` dan memusatkan window pada monitor utama di koordinat atas layar.
2. Saat mode UI berubah, effect pada `page.js` mengirim `width` dan `height` ke command `"resize_window"`. `sys.rs` memanggil Tauri Window API `set_size` dan memusatkan ulang window pada monitor utama dengan memperhitungkan scale factor.

```text
React menghitung ukuran target
       ↓ invoke("resize_window", { width, height })
Tauri IPC
       ↓
sys::resize_window(WebviewWindow, width, height)
       ↓
Tauri Window API: set_size + set_position
       ↓
Native desktop window berubah
```

UI React tetap berada di WebView; command hanya mengatur geometri window desktop.

## Alur Fitur Sistem

### Media

```text
Windows media session
   ↓ GlobalSystemMediaTransportControlsSessionManager
Rust read_media / pick_session
   ↓ emit("media", MediaInfo)
useSystem.js → setMedia
   ↓
page.js → metadata, artwork, timeline, progress, tombol kontrol
```

`MediaInfo` berisi judul, artis, status playing, posisi/durasi dalam detik, dan artwork data URL jika tersedia. Artwork dibaca dari thumbnail sesi dan dikodekan base64. Jika playback aktif, pembacaan menambahkan waktu sejak `LastUpdatedTime` agar progress UI bergerak lebih sering daripada update timeline Windows. Worker media polling setiap detik dan hanya mengirim event ketika nilai payload berbeda.

Untuk kontrol, tombol di `page.js` memanggil `control("toggle")`, `control("next")`, atau `control("prev")`; helper hook meneruskan action ke `"media_control"`. Rust memanggil metode pada sesi terpilih. Konfirmasi perubahan tidak berasal dari return command, tetapi dari event `"media"` pada pembacaan berikutnya.

### Volume

```text
React slider → setSystemVolume(percent)
             → invoke("set_volume", { percent })
             → sys::set_volume
             → IAudioEndpointVolume::SetMasterVolumeLevelScalar

Windows audio → worker endpoint (level + mute)
              → emit("volume", { level, muted })
              → useSystem.js → setVolume
              → page.js slider / label / HUD
```

Pembacaan mengarah ke default audio endpoint render/multimedia. Slider mengatur level; mute hanya dibaca dan ditampilkan, bukan diubah melalui command khusus pada UI ini.

### Kecerahan

```text
React slider → setSystemBrightness(percent)
             → invoke("set_brightness", { percent })
             → sys::set_brightness
             → PowerShell / WMI WmiSetBrightness

WMI query WmiMonitorBrightness
             → emit("brightness", percent)
             → useSystem.js → setBrightness
             → page.js slider / label / HUD
```

### Baterai

`GetSystemPowerStatus` menyediakan level baterai, flag baterai, dan status AC. Rust mengemasnya ke `Battery { percent, charging, present }` lalu mengirim `"battery"`. Hook menyimpan state dan memeriksa ambang HUD 20/10/5%; `page.js` menampilkan level dan status charging pada tab System.

### Notifikasi

`UserNotificationListener` membaca toast notifications setelah akses diizinkan. Rust mengekstrak ID, nama aplikasi, teks toast, dan logo jika tersedia; payload dikirim lewat `"notification"`. Hook menambahkan notifikasi baru ke daftar React (maksimum 20) dan menunjukkan HUD. Tombol hapus di UI menghapus item dari state lokal saja.

## Data Flow Lengkap

```text
                              WINDOWS
          ┌──────────┬─────────┼──────────┬─────────────┐
          ↓          ↓         ↓          ↓             ↓
        Media      Audio    Battery      WMI       Notifications
          └──────────┴─────────┴──────────┴─────────────┘
                              ↓
                    Rust workers di sys.rs
                              │ emit(event, payload)
                              ↓
                        Tauri event IPC
                              ↓
                   useSystem.js listeners
                              ↓
                       React state
                              ↓
                        page.js / UI
                              ↑
                   User interaction
                              │ invoke(command, args)
                              ↑
                       Tauri IPC
                              ↑
                 Rust commands di sys.rs
                              ↑
                    Windows API / WMI
```

## Dua Jalur Komunikasi

### Jalur 1 — Frontend → Native

```text
User → React handler → Tauri core.invoke → IPC → Rust command → Windows API
```

Contoh aktual: slider volume memanggil `setSystemVolume` dari `useSystem.js`; helper menjalankan `core.invoke("set_volume", { percent })`; Tauri mengarahkan request ke `sys::set_volume`; Rust mengubah scalar default audio endpoint.

### Jalur 2 — Native → Frontend

```text
Windows → Rust worker → AppHandle.emit → Tauri event IPC
        → event.listen → React state → UI
```

Contoh aktual: worker volume membaca endpoint dan mengirim `"volume"` dengan `Volume { level, muted }`; callback `on("volume", ...)` menyimpan payload ke `volume` state; `page.js` menampilkan nilai tersebut dan dapat menampilkan HUD saat nilainya berubah.

## Cara Membuat Project Next.js + Rust Seperti Ini Dari Awal

Urutan berikut menerangkan pola yang benar-benar dipakai di project ini, bukan daftar perintah instalasi tambahan:

1. **Buat frontend Next.js/React.** Dalam project ini entry UI adalah `frontend-dynamicbar/app/page.js`, dan hook integrasi diletakkan di `frontend-dynamicbar/app/useSystem.js`.
2. **Jadikan frontend bagian dari aplikasi Tauri.** `src-tauri/tauri.conf.json` menetapkan URL development `http://localhost:1420` dan frontend build `../frontend-dynamicbar/out`.
3. **Aktifkan bridge yang dipakai frontend.** Konfigurasi menetapkan `withGlobalTauri: true`, sehingga kode menggunakan `window.__TAURI__`.
4. **Buat native entry point.** `src-tauri/src/main.rs` menjalankan `dynamicbar_lib::run()`; `src-tauri/src/lib.rs` membangun Tauri Builder.
5. **Daftarkan command Rust.** `lib.rs` memasukkan `sys::media_control`, `sys::set_volume`, `sys::resize_window`, dan `sys::set_brightness` ke `generate_handler!`.
6. **Panggil command dari React.** Hook membungkus `core.invoke` untuk tiga operasi sistem; `page.js` memanggil `resize_window` ketika mode berubah.
7. **Buat payload event yang serializable.** `sys.rs` mendefinisikan `MediaInfo`, `Volume`, `Battery`, dan `Notif` dengan `Serialize`.
8. **Pantau sistem dan kirim event.** `sys::start` menjalankan worker yang membaca Windows dan mengirim event bernama melalui `AppHandle.emit`.
9. **Dengarkan event di React.** `useSystem.js` memakai `event.listen`, membaca `e.payload`, dan menyimpannya pada React state.
10. **Render state ke UI.** `page.js` memilih mode dan konten panel dari state hook.

Untuk integrasi OS lain, titik yang berganti adalah implementasi native API di Rust; kontrak command/event dan state frontend perlu tetap konsisten. Detail implementasi platform lain tidak ditentukan oleh project ini.

## Contoh Konseptual Command dan Event

Contoh berikut hanya untuk memahami konsep, **bukan source code aktual project**:

### JavaScript frontend

```js
const result = await window.__TAURI__.core.invoke("nama_command", {
    value: 42,
});
```

### Rust command

```rust
#[tauri::command]
fn nama_command(value: u32) -> String {
    format!("Nilai diterima: {value}")
}
```

Command harus didaftarkan pada handler Tauri (seperti daftar `generate_handler!` pada `lib.rs`) agar dapat dipanggil dari frontend.

### Rust event dan listener frontend

```rust
app_handle.emit("nama_event", payload)?;
```

```js
const unlisten = await window.__TAURI__.event.listen("nama_event", (event) => {
    console.log(event.payload);
});
```

Di project aktual, pengiriman event menggunakan nama `"media"`, `"volume"`, `"brightness"`, `"battery"`, atau `"notification"` dan listener didaftarkan terpusat di hook `useSystem.js`.

## Pola Arsitektur yang Bisa Digunakan di Project Lain

Pola request:

```text
UI Layer → Tauri IPC → Native Service → Operating System API
```

Pola pembaruan:

```text
Operating System → Native Service → Tauri Event → UI State → UI
```

- Gunakan **`invoke()`** ketika UI meminta native layer melakukan aksi. Command pada project ini adalah kontrol media, volume, brightness, dan resize window.
- Gunakan **`emit()`** ketika native layer mengirim pembaruan hasil pembacaan sistem. Frontend project mendengarkannya lewat `listen()`.
- Gunakan **React state** untuk nilai yang menentukan render, seperti metadata media, volume, baterai, brightness, notifikasi, dan HUD.
- Gunakan **worker native** untuk pemantauan berulang yang tidak bergantung pada event handler UI. `sys::start` menjalankan worker terpisah untuk sumber data sistem.

## Kesalahan Arsitektur yang Perlu Dihindari

Hal berikut relevan dengan pemisahan tanggung jawab yang digunakan project:

- Jangan menaruh akses Windows API di React; di aplikasi ini akses Windows berada di `src-tauri/src/sys.rs`.
- Jangan membuat UI bergantung pada detail tipe COM/WMI; frontend menerima payload serializable dan event bernama.
- Jangan mencampur pembacaan sistem berulang dengan render komponen. Project memisahkannya ke worker Rust dan hook listener.
- Hindari polling native terlalu rapat tanpa alasan. Implementasi saat ini menggunakan interval terpisah untuk tiap jenis data; interval itu bagian dari perilaku aplikasi, bukan rekomendasi universal.
- Jaga kontrak event dan command konsisten di kedua sisi. Perbedaan nama event atau bentuk payload akan membuat listener/UI tidak menerima data yang diharapkan.
- Jangan anggap command selesai sebagai bukti state OS telah diperbarui bila command tidak mengembalikan state; pola project mengonfirmasi data sistem melalui event worker.

## Cheat Sheet Next.js ↔ Rust

| Kebutuhan                            | Mekanisme                                 | Contoh aktual                                                            |
| ------------------------------------ | ----------------------------------------- | ------------------------------------------------------------------------ |
| React meminta Rust melakukan sesuatu | `window.__TAURI__.core.invoke`            | `"media_control"`, `"set_volume"`, `"set_brightness"`, `"resize_window"` |
| Rust menerima permintaan             | `#[tauri::command]` + `generate_handler!` | `sys::set_volume` didaftarkan di `lib.rs`                                |
| Rust mengirim pembaruan              | `AppHandle.emit(event, payload)`          | `emit("battery", Battery { ... })`                                       |
| React menerima event                 | `window.__TAURI__.event.listen`           | `on("battery", ...)` di `useSystem.js`                                   |
| UI menyimpan data untuk render       | React `useState`                          | `setBattery(b)`                                                          |
| Rust mengakses sistem                | Windows API / COM / WMI                   | `GetSystemPowerStatus`, audio endpoint, WMI                              |
| Rust menjalankan monitoring berulang | `thread::spawn` dan loop dengan jeda      | Worker di `sys::start`                                                   |
| Window desktop diubah                | Tauri `WebviewWindow` API                 | `set_size` dan `set_position` di `resize_window`                         |

## Contoh End-to-End: Mengubah Volume

Alur ini menggunakan nama file, function, command, event, dan payload yang ada di project:

1. **User menggeser slider** pada tab System di `frontend-dynamicbar/app/page.js`. `onChange` mengubah nilai input menjadi angka dan memanggil `setSystemVolume(Number(...))`.
2. **Hook menerima aksi** di `frontend-dynamicbar/app/useSystem.js`. `setSystemVolume(percent)` memanggil helper `invoke("set_volume", { percent })`.
3. **JavaScript → Tauri:** karena `withGlobalTauri` aktif, `window.__TAURI__.core.invoke` mengirim request command melalui IPC. Argumen `percent` dipetakan ke parameter command.
4. **Tauri → Rust:** handler yang dibuat di `src-tauri/src/lib.rs` sudah mendaftarkan `sys::set_volume`.
5. **Rust → Windows:** `sys::set_volume(percent: f32)` menginisialisasi COM, mengambil default endpoint lewat `endpoint()`, lalu menetapkan `SetMasterVolumeLevelScalar((percent / 100.0).clamp(0.0, 1.0), ...)`.
6. **Worker membaca state baru:** thread volume di `sys::start` memanggil `GetMasterVolumeLevelScalar` dan `GetMute`. Ketika nilai berubah, Rust membentuk `Volume { level, muted }`.
7. **Rust → Tauri → React:** worker mengirim `emit("volume", cur.clone())`; listener `on("volume", ...)` pada `useSystem.js` menerima payload, memanggil `setVolume(v)`, dan jika nilai berbeda dari sebelumnya memanggil `showHud("volume", v, 1800)`.
8. **React → UI:** `page.js` membaca `volume`/`hud` dari hook. Render ulang menampilkan level volume, ikon mute/volume, dan HUD bila sesuai.

```text
Slider page.js
   ↓ setSystemVolume(percent)
useSystem.js
   ↓ invoke("set_volume", { percent })
Tauri IPC
   ↓
sys::set_volume
   ↓ SetMasterVolumeLevelScalar
Windows Audio Endpoint
   ↓ worker membaca level/mute
emit("volume", { level, muted })
   ↓
useSystem.js listener → setVolume / showHud
   ↓
page.js → UI diperbarui
```

Command `"set_volume"` sendiri tidak mengembalikan nilai volume. Konfirmasi tampilan datang dari payload event `"volume"` yang dibaca worker.

## Kesimpulan Arsitektur

```text
Next.js = framework frontend
React    = UI, interaksi, dan state
Tauri    = desktop WebView dan bridge IPC
Rust     = command, worker, dan native logic
Windows API / WMI = akses fitur sistem operasi
```

Untuk UI web modern yang memerlukan akses native Windows, pola aplikasi ini adalah:

```text
Next.js / React
       ↓ Tauri invoke / IPC
Tauri
       ↓
Rust
       ↓
Windows API / WMI
```

Data kembali melalui jalur:

```text
Windows API / WMI
       ↓
Rust worker
       ↓ Tauri emit / event IPC
React listener
       ↓
React state dan Dynamic Bar UI
```
