# SplitKu

Pelacak pengeluaran bersama untuk teman kos, rumah tangga, atau kelompok yang sering belanja bareng.

## Fitur

- **Manajemen Orang** - Tambah/hapus/edit nama anggota
- **Transaksi** - Catat pengeluaran dengan deskripsi, kategori, dan tanggal
- **Pembagian Rata** - Auto hitung siapa yang perlu bayar ke siapa
- **Export/Import** - Backup data ke JSON, CSV, atau XLSX
- **Dark Mode** - Mode gelap untuk kenyamanan mata
- **Responsive** - Bisa dibuka di HP, tablet, atau komputer
- **Offline Support** - Berfungsi tanpa internet (PWA)
- **Chart** - Visualisasi pengeluaran per kategori dan orang

## Cara Pakai

### Tambah Transaksi
1. Isi form transaksi (deskripsi, kategori, tanggal)
2. Pilih siapa yang bayar
3. Centang orang yang ikut tanggung
4. Masukkan jumlah total
5. Klik "Tambah Transaksi"

### Lihat Penyelesaian
- Scroll ke section "Penyelesaian"
- Lihat siapa yang perlu bayar ke siapa
- Klik "Bayar" untuk menandai lunas

### Export Data
1. Klik menu "Export" di header
2. Pilih format: JSON, CSV, atau XLSX
3. File ter-download otomatis

### Import Data
1. Klik menu "Export" → "Import"
2. Pilih file backup (.json, .csv, .xlsx)
3. Konfirmasi replace data

## Instalasi Lokal

```bash
# Clone atau download project ini

# Jalankan dengan Python
cd "Harta Gono Gini"
python -m http.server 8080

# Buka browser: http://localhost:8080
```

## Deploy

### Netlify (Gampang)
1. Buka [netlify.com](https://netlify.com)
2. Drag & drop folder project
3. Selesai! Dapat URL langsung

### GitHub Pages
1. Upload ke GitHub repo
2. Settings → Pages → Source: main branch
3. Buka: `https://[username].github.io/[repo-name]`

## Struktur File

```
📁 Harta Gono Gini/
├── index.html          # Halaman utama
├── manifest.json       # PWA manifest
├── sw.js              # Service worker (offline)
├── css/
│   ├── styles.css     # Styling utama
│   └── dark.css       # Dark mode
└── js/
    ├── app.js         # Logic utama
    ├── storage.js     # Export/Import
    ├── validation.js  # Validasi input
    └── charts.js      # Visualisasi chart
```

## Teknologi

- HTML5, CSS3, JavaScript (Vanilla)
- LocalStorage untuk penyimpanan data
- SheetJS untuk import/export XLSX
- Canvas API untuk chart
- Service Worker untuk PWA

## Lisensi

MIT License - Bebas dipakai dan dimodifikasi.
