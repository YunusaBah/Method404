# Data sources

Datasets for FarmShift AI, taken from the Resources tab of the NASA Space Apps
Challenge 2026 page "Field Shift: Adapting Farms with NASA Data":
https://www.spaceappschallenge.org/2026/challenges/adapting-farms-with-nasa-data/

Each source below is connected through `/api/gambia/data/:sourceId` (see
API_CONFIGURATION.md). "Values" sources return numbers for a point;
"catalogue" sources list the files or scenes that cover it.

## Sources that cover The Gambia

| Need | Source | Status | Link |
| --- | --- | --- | --- |
| Temperature, rainfall, solar, humidity | NASA POWER | Values: `power` | https://power.larc.nasa.gov/ |
| Soil moisture | SMAP | Catalogue: `smap` | https://www.earthdata.nasa.gov/data/platforms/space-based-platforms/smap |
| Rainfall | GPM IMERG (Late Run) | Catalogue: `gpm-imerg` | https://gpm.nasa.gov/data |
| Vegetation indices, bare-field periods | MODIS / VIIRS | Values: `modis`, `viirs` (NDVI via NASA ORNL DAAC) | https://lpdaac.usgs.gov/products/ |
| Field-scale reflectance (30 m) | Landsat | Catalogue: `landsat` (USGS STAC) | https://earthexplorer.usgs.gov/ |
| Evapotranspiration, land-surface temperature | ECOSTRESS | Catalogue: `ecostress` | https://ecostress.jpl.nasa.gov/data |
| Elevation, slope, erosion risk | SRTM | Values: `srtm` (via OpenTopoData) | https://www.earthdata.nasa.gov/data/instruments/srtm |
| Land-surface water and energy | GLDAS | Catalogue: `gldas` | https://www.earthdata.nasa.gov/ |
| Crop suitability, soil constraints | FAO GAEZ v4 | Values: `gaez` | https://gaez.fao.org |
| Field imagery (10-20 m) | Copernicus Sentinel-2 (ESA) | Catalogue: `sentinel2` (Copernicus STAC) | https://dataspace.copernicus.eu |
| Daily climate reanalysis | ERA5 (ECMWF) | Values: `era5` (via Open-Meteo) | https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels?tab=overview |

The challenge statement also names GRACE and GRACE-FO (long-term water
storage). It is connected as a catalogue source: `grace-fo` (JPL mascons).

## Listed by the challenge but not usable for The Gambia

These official resources cover the United States or North America only:
Web Soil Survey, SSURGO/STATSGO2, Cropland Data Layer (CropScape), PRISM,
NAIP, NLCD, CoCoRaHS, USGS NWIS, USDA NASS QuickStats, USDA AMS Market News,
OpenET and LANDFIRE. USDA Ag Data Commons and GEDI (forest structure) are
also listed and are not expected to be needed.

## Gaps

- Local soil data and crop characteristics for The Gambia are not in the
  challenge list. They must come from verified national or local sources,
  which take priority over global data for recommendations.
- SMAP, GPM, ECOSTRESS, GLDAS and GRACE-FO files need a free Earthdata Login
  to download. The backend lists them but does not yet download or decode
  them, so it has no values from these sources.
- Landsat previews redirect to a USGS login, so none are shown.

## NASA POWER parameters to request first

The existing proxy accepts up to 20 parameter names per request. Candidates,
to be confirmed against the POWER parameter dictionary before use:
T2M, T2M_MAX, T2M_MIN, PRECTOTCORR, RH2M, ALLSKY_SFC_SW_DWN, GWETTOP, GWETROOT.
