# Dashboard Monitoring Kinerja Pegawai PPPK
**Balai Guru dan Tenaga Kependidikan (BGTK) Provinsi Sumatera Barat**
*Kementerian Pendidikan Dasar dan Menengah RI*

Sistem Dashboard Pemantau Kinerja Harian Pegawai Pemerintah dengan Perjanjian Kerja (PPPK) yang bertugas di ranah Urusan Rumah Tangga, Kebersihan, Keamanan, dan Pemeliharaan Sarana Prasarana (Subbagian Umum).

---

## 🚀 Fitur Utama
1. **Single-Page Application (SPA) Super Cepat & Ringan**:
   - Berbasis HTML5 murni, Tailwind CSS, dan Vanilla ES6.
   - Tanpa ketergantungan framework server atau build step yang rumit — langsung siap dijalankan!
2. **Koneksi Live Google Sheets (Real-time)**:
   - Terhubung langsung ke spreadsheet `Monitoring Pegawai (Responses)` via Google Visualization JSONP.
   - Dilengkapi fallback `offline-data.js` sehingga tetap bisa dibuka seketika meski koneksi internet sedang lambat atau offline.
3. **Penyaringan Bertingkat (Hierarchical Filters)**:
   - **Filter Pegawai**: Pilih personil PPPK tertentu atau pantau seluruh tim sekaligus.
   - **Filter Periode**: Pilihan mode Bulanan, Mingguan (Minggu ke-1 s.d ke-5), atau Semua Riwayat.
   - **Filter Khusus**: Filter cepat hanya kegiatan bergambar (📸) atau yang memiliki kendala lapangan (⚠️).
   - **Pencarian Cepat**: Cari instan berdasarkan kata kunci pekerjaan (contoh: *sanyo, mushola, rumput, kaca, kabel PLN*).
4. **Metrik & Sebaran Kehadiran (Heatmap)**:
   - Kartu eksekutif: Total penugasan, hari kerja aktif fisik, rasio foto bukti, dan temuan kendala sarpras.
   - Matriks kalender harian (heatmap) visual hari-hari aktif pegawai dalam bulan terpilih.
5. **Penampil Bukti Foto Langsung (Direct Image Preview)**:
   - Menggunakan teknologi konversi Google UserContent ID (`lh3.googleusercontent.com/d/{ID}`), foto bukti dari Google Drive langsung tampil di kartu dan modal lightbox tanpa error CORS atau izin Google.
6. **Cetak Rekap Kinerja Bulanan Resmi (A4 Landscape Print/PDF)**:
   - Tombol **"Cetak Rekap A4"** yang menghasilkan format dokumen resmi kedinasan Kemendikdasmen BGTK Sumbar.
   - Lengkap dengan Kop Balai, rincian tanggal, uraian tugas, capaian, dan kolom tanda tangan pengesahan Kasubag Umum & Pegawai bersangkutan.

---

## 🌐 Cara Publikasi ke GitHub Pages (1 Menit)
Dashboard ini dirancang khusus untuk GitHub Pages:
1. Buat repositori baru di GitHub (misal: `monitoring-pppk-bgtk`).
2. Masukkan seluruh file di dalam folder ini (`index.html`, `app.js`, `styles.css`, `offline-data.js`, `README.md`) ke repositori tersebut:
   ```bash
   git init
   git add .
   git commit -m "feat: inisialisasi dashboard monitoring pppk bgtk sumbar"
   git branch -M main
   git remote add origin https://github.com/<username>/<nama-repo>.git
   git push -u origin main
   ```
3. Buka tab **Settings** di repositori GitHub $\rightarrow$ klik menu **Pages** di sebelah kiri.
4. Pada bagian **Build and deployment**, pilih Source: **Deploy from a branch** $\rightarrow$ Branch: `main` / `root` $\rightarrow$ Klik **Save**.
5. Dalam beberapa detik, dashboard pemantau Anda sudah aktif online di URL:
   `https://<username>.github.io/<nama-repo>/`

---

## 💻 Cara Uji Coba Lokal di Laptop
Cukup jalankan server lokal sederhana di folder ini:
```powershell
python -m http.server 8080
```
Lalu buka di browser: `http://localhost:8080`

Atau Anda juga dapat langsung mengklik dua kali file `index.html`.

---
*Dibuat oleh Robby Daryodi, S.Kom. untuk BGTK Provinsi Sumatera Barat.*
