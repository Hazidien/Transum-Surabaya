# Transum Surabaya — WebGIS 3D

WebGIS interaktif untuk lima koridor bus Surabaya (3 Suroboyo Bus dan 2 Wira Wiri), halte, visualisasi bangunan 3D, dan akses berjalan kaki ke halte terdekat.

## Struktur repository

- `bangunan/` — footprint dan tinggi bangunan.
- `rute/` — GeoJSON garis lima rute.
- `halte/` — GeoJSON titik halte.
- `index.html`, `style.css`, `app.js`, `config.js` — aplikasi.

## Atribut sumber

- Garis rute: `Route_Id`
- Halte: `Route_Id` dan `Halte_nama`
- Tinggi bangunan: `LIDAR_MEAN`

GeoJSON harus menggunakan geometri yang tepat (LineString/MultiLineString untuk rute, Point untuk halte) dan koordinat WGS 84 / EPSG:4326.

## Penting: GeoJSON bangunan sekitar 573 MB

Jangan commit file bangunan seluruh Surabaya sebesar itu sebagai file biasa ke GitHub. File GeoJSON besar akan melewati batas ukuran file GitHub dan membuat proses pemuatan peta terlalu berat.

Gunakan GeoJSON kecil untuk uji awal. Untuk semua bangunan Surabaya, konversikan ke vector tiles/PMTiles dan host arsipnya di layanan yang mendukung file besar serta HTTP range requests. Sesudah tersedia, ubah konfigurasi `buildings` di `config.js`.

`LIDAR_MEAN` dikonfigurasi sebagai tinggi ekstrusi bangunan. Pastikan nilai ini memang tinggi bangunan di atas tanah (meter), bukan elevasi absolut atap atau nilai NoData.

## Menjalankan lokal

Dari folder repository, jalankan:

```bash
python -m http.server 8000
```

Lalu buka http://localhost:8000.

## Publikasi GitHub Pages

Buka repository → **Settings → Pages** → pilih **Deploy from a branch** → branch `main` dan folder `/ (root)`.

## Routing pejalan kaki

Fitur halte terdekat menggunakan layanan publik Valhalla dengan profil pedestrian dan data OpenStreetMap. Endpoint publik menerapkan kebijakan penggunaan wajar/rate limiting, sehingga tidak cocok untuk trafik besar tanpa izin atau hosting routing sendiri. Jika routing tidak dapat diakses, aplikasi menampilkan fallback jarak garis lurus dan memberi label bahwa itu bukan jarak berjalan kaki jaringan.

Lihat README di masing-masing folder untuk nama file GeoJSON yang diharapkan.
