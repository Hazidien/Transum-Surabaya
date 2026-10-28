# Data Halte Bus Surabaya

Simpan GeoJSON titik halte di folder ini. Setiap file berupa FeatureCollection dengan geometri Point.

Atribut penting:
- `Route_Id`: harus sesuai dengan nilai Route_Id yang digunakan pada file rute.
- `Halte_name` (aplikasi juga menerima `Halte_nama`): nama halte untuk popup dan informasi halte terdekat.

Konfigurasi awal website mengharapkan:
- `halte_bus_Terminal Benowo-Tunjungan.geojson`
- `halte_bus_Kejawan Putih-Unesa.geojson`
- `halte_bus_Gnanyar-ITS-Kenpark.geojson` (duplikat dari data Wira Wiri; tidak dimuat dua kali)
- `halte_wirawiri_Gnanyar-ITS-Kenpark.geojson`
- `halte_wirawiri_TOW-Unesa.geojson`

Nama file di atas sama dengan file yang sudah diunggah. Data `halte_bus_Gnanyar-ITS-Kenpark.geojson` dan `halte_wirawiri_Gnanyar-ITS-Kenpark.geojson` memiliki 43 titik yang identik; aplikasi hanya menggunakan file Wira Wiri agar tidak menghitung halte ganda. Jangan membuang atribut lain yang mungkin berguna.

Sebelum upload, pastikan CRS GeoJSON adalah WGS 84 / EPSG:4326. File yang sudah diunggah telah dikonversi dari UTM Zone 49S ke longitude/latitude WGS 84 untuk ditampilkan pada web map.
