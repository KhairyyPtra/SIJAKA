# SIJAKA

SIJAKA (Sistem Informasi Jalan Kota) adalah aplikasi web untuk melaporkan, memantau, dan mengelola kondisi jalan berbasis lokasi.

Source code ini dirilis sebagai open source di bawah lisensi Apache-2.0.

## Fitur

- Autentikasi pengguna dengan Supabase Auth
- Pelaporan kerusakan jalan dengan foto dan koordinat lokasi
- Peta interaktif berbasis Leaflet
- Pemantauan status laporan
- Konfirmasi laporan oleh pengguna
- Panel pengelolaan untuk pemerintah/instansi dan komunitas
- Profil, pengaturan aplikasi, dan dukungan offline untuk antrean laporan
- Progressive Web App dengan service worker

## Teknologi

- React 19
- Vite
- React Router
- Supabase Auth, Database, Realtime, dan Storage
- Leaflet dan React Leaflet
- Oxlint
- Vercel

## Persyaratan

- Node.js 20 atau versi lebih baru
- npm
- Project Supabase yang sudah dikonfigurasi

## Instalasi

```bash
npm install
```

Buat file `.env` di root project berdasarkan `.env.example`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Jangan masukkan `service_role` key atau secret lain ke source code.

## Menjalankan Lokal

```bash
npm run dev
```

Aplikasi tersedia pada URL yang ditampilkan Vite, biasanya `http://localhost:5173`.

## Perintah

```bash
npm run lint
npm run build
npm run preview
```

`npm run build` menghasilkan folder `dist/`, yaitu artefak generated untuk deployment.

## Deployment ke Vercel

1. Tambahkan repository project ke Vercel.
2. Atur environment variables berikut pada Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Jalankan deployment dengan build command `npm run build`.
4. Pastikan output directory menggunakan `dist`.
5. Periksa konfigurasi redirect dan security header pada `vercel.json`.
6. Tambahkan URL production ke konfigurasi redirect dan email authentication Supabase.

## Catatan

- Frontend route guard bukan pengganti RLS atau otorisasi database.
- Jangan commit `.env` atau kredensial Supabase.
- Gunakan HTTPS agar kamera dan geolocation dapat digunakan.

## Kontribusi dan Lisensi

Kontribusi dipersilakan melalui pull request. Sebelum mengirim perubahan, jalankan `npm run lint` dan `npm run build`.

Source code menggunakan [Apache License 2.0](LICENSE). Nama dan logo SIJAKA tidak otomatis dilisensikan oleh lisensi source code.
