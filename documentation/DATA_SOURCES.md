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
| Temperature, rainfall, solar, humidity, soil wetness | NASA POWER | Values: `power` | https://power.larc.nasa.gov/ |
| Soil moisture | SMAP | Values with Earthdata token: `smap` | https://www.earthdata.nasa.gov/data/platforms/space-based-platforms/smap |
| Rainfall | GPM IMERG (Late Run) | Values with Earthdata token: `gpm-imerg` | https://gpm.nasa.gov/data |
| Vegetation indices, bare-field periods | MODIS / VIIRS | Values: `modis`, `viirs` (NDVI via NASA ORNL DAAC) | https://lpdaac.usgs.gov/products/ |
| Field-scale reflectance (30 m) | Landsat | Catalogue: `landsat` (USGS STAC) | https://earthexplorer.usgs.gov/ |
| Evapotranspiration, land-surface temperature | ECOSTRESS | Catalogue: `ecostress` | https://ecostress.jpl.nasa.gov/data |
| Elevation, slope, erosion risk | SRTM | Values: `srtm` (via OpenTopoData) | https://www.earthdata.nasa.gov/data/instruments/srtm |
| Land-surface water and energy | GLDAS | Values with Earthdata token: `gldas` | https://www.earthdata.nasa.gov/ |
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
- SMAP, GPM and GLDAS values need `EARTHDATA_TOKEN` in `backend/.env`. ECOSTRESS
  and GRACE-FO files are listed only; their values are not extracted yet.
- Landsat previews redirect to a USGS login, so none are shown.

## NASA POWER parameters currently supported

The backend's default daily parameters are:
`PRECTOTCORR`, `T2M`, `T2M_MAX`, `T2M_MIN`, `RH2M`, and
`ALLSKY_SFC_SW_DWN`. The climate overview also explicitly requests the
optional `GWETTOP` and `GWETROOT` soil-wetness parameters. Those NASA POWER
values are a dimensionless index from 0 to 1, not a percent of water in soil.
NASA SMAP adds satellite-based surface moisture when the backend has an
Earthdata token, and ERA5 (ECMWF, not NASA) adds topsoil and deeper-soil
estimates. NASA GLDAS can also provide modelled topsoil and root-zone estimates
when its Earthdata access is configured. None of these gridded products
measures moisture in a farmer's specific field.

## Locations and crop search

The Gambia API provides 18 searchable town-centre reference points. The
coordinates are used to request the nearest available satellite or gridded
records; they do not represent a farmer's exact field. Location names and
additional town-centre coordinates are based on OpenStreetMap data
(© OpenStreetMap contributors).

Crop cards use example photographs from Wikimedia Commons to help identify the
crops. They are illustrative photos, not NASA images, not necessarily from
The Gambia, and not proof that a crop is growing at the selected location.
Each photo links to its source and shows its creator and license. Images load
from Wikimedia Commons and need an internet connection.

Crop advice uses current NASA/ERA5 weather context and the FAO GAEZ v4
suitability model. The crop search lists 48 GAEZ crop layers and retrieves a
selected crop's suitability for the chosen location on demand. Only the 12
crops with planting guidance currently reviewed for The Gambia are ranked as
current recommendations; the other catalogue entries show their long-term
GAEZ suitability only and are not presented as planting advice.

The featured-crop NASA POWER lookup also provides preliminary climate scores
for crops without reviewed profiles. These estimated profiles are explicitly
marked in the response and UI, and are not used in the reviewed crop-ranking
or rotation model. They need validation against local varieties and agricultural
guidance; the scores indicate climate fit only, not yield or guaranteed success.
