# Data Rute Bus Surabaya

Simpan 5 GeoJSON garis rute di folder ini. Setiap file harus berupa FeatureCollection dengan geometri LineString atau MultiLineString.

Atribut penting:
- `Route_Id`: nama/ID rute yang digunakan untuk menghubungkan garis rute dengan halte.

Nama file yang dipakai konfigurasi awal website:
- `Bus_Suroboyo_Benowo-Tunjungan.geojson`
- `Bus_Suroboyo_Kejawan-Putih-ITS-UNESA.geojson`
- `Bus_Suroboyo_Purabaya-Rajawali.geojson`
- `WiraWiri_Gunung-Anyar-ITS-Kenpark.geojson`
- `WiraWiri_TOW-UNESA.geojson`

Jika nama file asli berbeda, sesuaikan daftar `routes` di `config.js`; jangan mengubah nilai Route_Id di data hanya demi menyesuaikan nama file.

Sebelum upload, pastikan CRS GeoJSON adalah WGS 84 / EPSG:4326 (koordinat longitude, latitude).
