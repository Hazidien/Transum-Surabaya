# Data Rute Bus Surabaya

Simpan 5 GeoJSON garis rute di folder ini. Setiap file harus berupa FeatureCollection dengan geometri LineString atau MultiLineString.

Atribut penting:
- `Route_Id`: nama/ID rute yang digunakan untuk menghubungkan garis rute dengan halte.

Nama file yang dipakai konfigurasi awal website:
- `suroboyo_benowo_tunjungan.geojson`
- `suroboyo_kejawaan_putih_its_unesa.geojson`
- `suroboyo_purabaya_rajawali.geojson`
- `wira_wiri_gunung_anyar_its_kenpark.geojson`
- `wira_wiri_tow_unesa.geojson`

Jika nama file asli berbeda, sesuaikan daftar ROUTES di `app.js`; jangan mengubah nilai Route_Id di data hanya demi menyesuaikan nama file.

Sebelum upload, pastikan CRS GeoJSON adalah WGS 84 / EPSG:4326 (koordinat longitude, latitude).
