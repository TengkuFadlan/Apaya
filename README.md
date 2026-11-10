# Apaya — Asisten Harian

Aplikasi desktop Electron untuk mencatat aktivitas, menulis refleksi, dan berbincang dengan AI pilihanmu.

## Menjalankan

```bash
npm install
npm run dev
```

Untuk menjalankan versi production lokal, gunakan `npm start` (build renderer lalu buka Electron). Build renderer saja dengan `npm run build`.

## Struktur proyek

```text
electron/                 Proses utama Electron dan preload aman
src/renderer/             UI React, entry point, dan stylesheet
vite.config.js            Konfigurasi build/development renderer
```

## Fitur

- Jurnal aktivitas bertimestamp, termasuk menambah dan menghapus catatan untuk tujuh hari terakhir.
- Catatan perasaan per hari dan profil berisi hobi, lifestyle, serta tujuan.
- Chat refleksi yang bisa dihapus per pesan atau seluruhnya. AI mendapat konteks aktivitas dan refleksi dari tujuh hari hingga tanggal chat yang dipilih, untuk membantu mengenali pola mingguan.
- Pengaturan API key dan model untuk OpenAI, NanoGPT, Gemini (endpoint kompatibel OpenAI), Claude, atau URL kustom. Claude menggunakan Messages API; penyedia lain menggunakan Chat Completions API.
- Aktivitas, refleksi, profil, dan chat tersimpan di local storage aplikasi. Data jurnal dan chat yang berumur lebih dari tujuh hari dibersihkan otomatis.

API key disimpan oleh proses utama Electron memakai `safeStorage`; permintaan AI dikirim langsung dari perangkat ke endpoint yang dikonfigurasi. Aktivitas tujuh hari dan profil dikirim sebagai konteks setiap pesan chat agar AI bisa memberi respons yang relevan. Pesan percakapan juga dikirim ke penyedia AI yang dipilih.

Apaya adalah teman refleksi, bukan layanan kesehatan mental atau pengganti psikolog.
