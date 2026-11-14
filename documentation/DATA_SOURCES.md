# Data sources

Datasets for FarmShift AI, taken from the Resources tab of the NASA Space Apps
Challenge 2026 page "Field Shift: Adapting Farms with NASA Data":
https://www.spaceappschallenge.org/2026/challenges/adapting-farms-with-nasa-data/

This file is a plan. Only NASA POWER is implemented (see API_CONFIGURATION.md).
Nothing here should be shown in the interface as an observation until the
source is connected and verified.

## Sources that cover The Gambia

| Need | Source | Status | Link |
| --- | --- | --- | --- |
| Temperature, rainfall, solar, humidity | NASA POWER | Proxied at /api/nasa/power/daily | https://power.larc.nasa.gov/ |
| Soil moisture | SMAP | Planned | https://www.earthdata.nasa.gov/data/platforms/space-based-platforms/smap |
| Rainfall | GPM IMERG | Planned | https://gpm.nasa.gov/data |
| Vegetation indices, bare-field periods | MODIS / VIIRS | Planned | https://lpdaac.usgs.gov/products/ |
| Field-scale reflectance (30 m) | Landsat | Planned | https://earthexplorer.usgs.gov/ |
| Evapotranspiration, land-surface temperature | ECOSTRESS | Planned | https://ecostress.jpl.nasa.gov/data |
| Elevation, slope, erosion risk | SRTM | Planned | https://www.earthdata.nasa.gov/data/instruments/srtm |
| Land-surface water and energy | GLDAS (search in Earthdata) | Planned | https://www.earthdata.nasa.gov/ |
| Crop suitability, soil constraints | FAO GAEZ | Planned | https://gaez.fao.org |
| Field imagery (10-20 m) | Copernicus Sentinel-2 (ESA) | Planned | https://dataspace.copernicus.eu |
| Hourly climate reanalysis | ERA5 (ECMWF) | Planned | https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels?tab=overview |

The challenge statement also names GRACE and GRACE-FO (long-term water
storage). The Resources tab gives no link for it.

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
- Most NASA downloads other than POWER need a free Earthdata Login. The
  backend has no handling for those credentials yet.

## NASA POWER parameters to request first

The existing proxy accepts up to 20 parameter names per request. Candidates,
to be confirmed against the POWER parameter dictionary before use:
T2M, T2M_MAX, T2M_MIN, PRECTOTCORR, RH2M, ALLSKY_SFC_SW_DWN, GWETTOP, GWETROOT.
