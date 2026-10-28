# Data Halte Bus Surabaya

Simpan GeoJSON titik halte di folder ini. Setiap file berupa FeatureCollection dengan geometri Point.

Atribut penting:
- `Route_Id`: harus sesuai dengan nilai Route_Id yang digunakan pada file rute.
- `Halte_nama`: nama halte untuk popup dan informasi halte terdekat.

Konfigurasi awal website mengharapkan:
- `halte_bus_benowo_tunjungan.geojson`
- `halte_bus_kejawaan_putih_its_unesa.geojson`
- `halte_bus_gunung_anyar_its_kenpark.geojson`
- `halte_wira_wiri_gunung_anyar_its_kenpark.geojson`
- `halte_wira_wiri_tow_unesa.geojson`

Nama-nama di atas adalah nama file target untuk disederhanakan saat upload. Jika file halte yang sudah kamu punya berbeda atau pembagiannya ternyata berbeda, kita dapat mengubah konfigurasi agar mengikuti data aktual. Jangan membuang atribut lain yang mungkin berguna.

Sebelum upload, pastikan CRS GeoJSON adalah WGS 84 / EPSG:4326.
