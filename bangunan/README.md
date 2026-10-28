# Data Bangunan Surabaya

Letakkan data footprint bangunan berformat GeoJSON atau PMTiles di folder ini.

Atribut tinggi bangunan yang digunakan pada visualisasi 3D adalah `LIDAR_MEAN`.

Catatan: GeoJSON bangunan seluruh Surabaya berukuran besar (sekitar 573 MB menurut informasi lokal), sehingga jangan langsung dimuat seluruhnya ke browser. Untuk deployment, konversikan menjadi vector tiles/PMTiles atau pecah per wilayah dan validasi nilai `LIDAR_MEAN`.