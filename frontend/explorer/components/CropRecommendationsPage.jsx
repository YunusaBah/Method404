import { useState } from 'react'
import Icon from './Icon.jsx'
import LoadState from './LoadState.jsx'
import LocationSelect from './LocationSelect.jsx'
import { formatDate, formatNumber } from './dataFormat.js'
import { useApiResource } from '../hooks/useApiResource.js'
import cropPhotos from './cropPhotos.js'
import {
  fetchGambiaCropCatalog,
  fetchGambiaCropPhoto,
  fetchGambiaCropPrediction,
  fetchGambiaRecommendations,
} from '../services/api.js'

const MONTH_ABBREVIATIONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function ConditionTile({ label, value, unit, note }) {
  return (
    <div className="stat-tile">
      <span className="stat-label">{label}</span>
      <strong>{value}{unit && <small>{unit}</small>}</strong>
      {note && <span className="stat-note">{note}</span>}
    </div>
  )
}

function Conditions({ result }) {
  const { season, conditions } = result
  const { rainfall, rainOnset, soilMoisture, waterBalance } = conditions

  return (
    <section className="panel data-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">RECENT WEATHER</span>
          <h2>{season.monthName}: {season.current === 'rainy' ? 'rainy season' : 'dry season'}</h2>
        </div>
        <span className="live-label">Recent data</span>
      </div>
      <p className="panel-description panel-description--wide">{season.description}</p>
      <div className="stat-grid">
        <ConditionTile
          label="Rain in the last 30 days"
          note={rainfall ? `${rainfall.rainyDays} rainy days · ${rainfall.source}` : 'No rainfall data'}
          unit=" mm"
          value={formatNumber(rainfall?.totalMm)}
        />
        {season.current === 'rainy' && (
          <ConditionTile
            label="Rains started?"
            note={rainOnset?.onset ? `${rainOnset.onset.rainMm} mm from ${formatDate(rainOnset.onset.date)}` : '20 mm within 3 days needed'}
            value={rainOnset?.started ? 'Yes' : rainOnset?.onset ? 'False start' : 'Not yet'}
          />
        )}
        <ConditionTile
          label="Soil water estimate"
          note={soilMoisture ? `${soilMoisture.status} · ${formatDate(soilMoisture.date)}` : 'No soil data'}
          unit={soilMoisture ? ` ${soilMoisture.unit}` : ''}
          value={formatNumber(soilMoisture?.value, 2)}
        />
        <ConditionTile
          label="Rain for plant needs"
          note={waterBalance
            ? `${formatNumber(waterBalance.rainfallMm, 0)} mm rain · ${formatNumber(waterBalance.referenceEvapotranspirationMm, 0)} mm estimated need`
            : 'No ERA5 data'}
          unit="%"
          value={waterBalance?.percentOfDemandMet ?? '—'}
        />
      </div>
    </section>
  )
}

function SowingCalendar({ months, current }) {
  return (
    <div className="sowing-calendar" aria-label={`Sowing months: ${months.map((m) => MONTH_ABBREVIATIONS[m - 1]).join(', ')}`}>
      {MONTH_ABBREVIATIONS.map((name, index) => (
        <span
          className={[
            'sowing-month',
            months.includes(index + 1) ? 'sowing-month--on' : '',
            current === index + 1 ? 'sowing-month--current' : '',
          ].join(' ')}
          key={name}
          title={name}
        >
          {name[0]}
        </span>
      ))}
    </div>
  )
}

function CropPhoto({ crop }) {
  const [failed, setFailed] = useState(false)
  const localPhoto = cropPhotos[crop]
  const onlinePhoto = useApiResource(
    (signal) => fetchGambiaCropPhoto(crop, { signal }),
    [crop],
    { enabled: !localPhoto || failed },
  )
  const photo = failed ? onlinePhoto.data : localPhoto ?? onlinePhoto.data

  if (!photo) {
    return (
      <div className="crop-photo-unavailable" role="status">
        <Icon aria-hidden="true" name="sprout" size={20} />
        <span>{onlinePhoto.status === 'loading' ? 'Loading crop photo…' : 'Crop photo could not load'}</span>
      </div>
    )
  }

  return (
    <figure className="crop-photo">
      <img
        alt={photo.alt}
        decoding="async"
        loading="lazy"
        onError={() => {
          if (!failed) setFailed(true)
        }}
        src={photo.image}
      />
      <figcaption>
        Photo example · <a href={photo.page} rel="noreferrer" target="_blank">By {photo.artist}</a>
        {' · '}
        <a href={photo.licenseUrl} rel="noreferrer" target="_blank">{photo.license}</a>
      </figcaption>
    </figure>
  )
}

function CropCard({ crop, month }) {
  return (
    <article className="panel crop-card">
      <CropPhoto crop={crop.crop} />
      <div className="panel-heading">
        <div>
          <span className="eyebrow">
            {crop.system === 'irrigated' ? 'NEEDS WATER' : crop.system === 'lowland' ? 'LOWLAND' : 'RAINFED'}
          </span>
          <h3>{crop.crop}</h3>
        </div>
        <span className="crop-score" title="A long-term crop suitability rating, from 0 to 100">
          {crop.suitabilityIndex === null ? '—' : Math.round(crop.suitabilityIndex)}
          <small>/100</small>
        </span>
      </div>
      <span className="ndvi-track crop-track" aria-hidden="true">
        <span className="ndvi-fill" style={{ width: `${crop.suitabilityIndex ?? 0}%` }} />
      </span>
      <p className="crop-class">
        {crop.system === 'irrigated'
          ? `Without irrigation: ${(crop.suitabilityClass ?? 'not rated').toLowerCase()}. Water may help.`
          : `${crop.suitabilityClass ?? 'No rating'} long-term crop fit`}
      </p>
      <SowingCalendar current={month} months={crop.sowingMonths} />
      <p className="crop-tip">{crop.tip}</p>
      <details className="card-notes">
        <summary>Why this crop?</summary>
        <ul>{crop.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
      </details>
    </article>
  )
}

function CropSearch({ locationId }) {
  const catalog = useApiResource((signal) => fetchGambiaCropCatalog({ signal }), [])
  const [query, setQuery] = useState('')
  const selectedCrop = catalog.data?.featuredCrops.find(
    (item) => item.crop.toLowerCase() === query.trim().toLowerCase(),
  )
  const cropPrediction = useApiResource(
    (signal) => fetchGambiaCropPrediction(
      selectedCrop.id,
      { location: locationId },
      { signal },
    ),
    [locationId, selectedCrop?.crop, selectedCrop?.id],
    { enabled: Boolean(selectedCrop) },
  )
  const prediction = cropPrediction.data?.prediction
  const climate = cropPrediction.data?.climate

  return (
    <section aria-labelledby="crop-search-title" className="panel crop-search">
      <div className="section-heading">
        <div>
          <h2 id="crop-search-title">Search other crops</h2>
          <p className="category-description">
            Check pictured crops against NASA POWER climate data for this area.
          </p>
        </div>
      </div>
      <LoadState loadingMessage="Loading the crop list…" resource={catalog} />
      {catalog.status === 'success' && (
        <label className="location-select crop-search-field">
          <span>Crop name</span>
          <input
            autoComplete="off"
            list="farmshift-crop-catalog"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type a crop name"
            value={query}
          />
          <datalist id="farmshift-crop-catalog">
            {catalog.data.featuredCrops.map((item) => (
              <option key={item.id} value={item.crop} />
            ))}
          </datalist>
          <small>{catalog.data.featuredCrops.length} pictured crops. Estimated profiles are clearly marked and need local validation.</small>
        </label>
      )}
      {!selectedCrop && query.trim() && catalog.status === 'success' && (
        <p className="crop-search-hint">Choose a crop name from the list to see its data.</p>
      )}
      {selectedCrop && (
        <LoadState loadingMessage={`Checking ${selectedCrop.crop}…`} resource={cropPrediction} />
      )}
      {cropPrediction.status === 'success' && (
        <>
          <CropPhoto crop={selectedCrop.crop} />
          {cropPrediction.data.available && prediction ? (
            <article className="crop-search-result">
              <div>
                <span className="eyebrow">
                  NASA POWER · THREE-YEAR CLIMATE
                  {cropPrediction.data.profile?.confidence === 'estimated'
                    ? ' · ESTIMATED PROFILE'
                    : ' · REVIEWED PROFILE'}
                </span>
                <h3>{prediction.name}</h3>
              </div>
              <strong>{prediction.score} / 100</strong>
              <p>
                {selectedCrop.predictionType === 'establishment'
                  ? `Estimated climate fit for orchard establishment${prediction.limiting
                    ? `; the model flags ${prediction.limiting.replace('_', ' ')} conditions.`
                    : '.'} Establishment may need irrigation during dry months.`
                  : prediction.limiting
                    ? `The model flags ${prediction.limiting.replace('_', ' ')} conditions for its best planting month.`
                    : `Best planting month: ${MONTH_ABBREVIATIONS[prediction.bestMonth - 1]}.`}
                {' '}This climate estimate is not a yield forecast.
              </p>
              <small>
                NASA POWER daily rainfall and maximum temperatures from {cropPrediction.data.period.start} to {cropPrediction.data.period.end}.
                {selectedCrop.predictionType === 'establishment'
                  ? ` Annual rainfall: ${formatNumber(prediction.annualRainMm, 0)} mm; mean monthly maximum: ${formatNumber(prediction.meanMaxTemperatureC, 1)} °C.`
                  : ` Best months: ${prediction.bestMonths.map((month) => MONTH_ABBREVIATIONS[month - 1]).join(', ') || 'none identified'}.`}
                {cropPrediction.data.profile?.confidence === 'estimated' ? ` ${cropPrediction.data.profile.basis}` : ''}
              </small>
            </article>
          ) : (
            <article className="crop-search-result">
              <div>
                <span className="eyebrow">
                  NASA POWER CLIMATE DIAGNOSTICS
                  {selectedCrop.predictionType === 'establishment'
                    ? ' · ORCHARD ESTABLISHMENT'
                    : ' · GROWING SEASON'}
                </span>
                <h3>{selectedCrop.crop}</h3>
              </div>
              <strong>No verified crop profile</strong>
              <p>A crop prediction is not available yet. Climate data is shown below without assigning a score.</p>
              <small>
                Three-year NASA POWER diagnostics: {formatNumber(climate.annualRainMm, 0)} mm average annual rain;
                {' '}{formatNumber(climate.meanMaxTemperatureC, 1)} °C average monthly maximum temperature.
                {' '}Data period: {cropPrediction.data.period.start} to {cropPrediction.data.period.end}.
              </small>
              <details className="card-notes">
                <summary>Monthly NASA POWER climate diagnostics</summary>
                <div className="table-scroll">
                  <table className="data-table data-table--compact">
                    <thead>
                      <tr><th>Month</th><th>Rain (mm)</th><th>Rain days</th><th>Mean max (°C)</th></tr>
                    </thead>
                    <tbody>
                      {climate.months.map((month) => (
                        <tr key={month.month}>
                          <th scope="row">{MONTH_ABBREVIATIONS[month.month - 1]}</th>
                          <td>{formatNumber(month.rainMm, 0)}</td>
                          <td>{formatNumber(month.rainDays, 0)}</td>
                          <td>{formatNumber(month.tMaxC, 1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </article>
          )}
        </>
      )}
    </section>
  )
}

function CropRecommendationsPage({ section, region, locationId, onLocationChange }) {
  const [input, setInput] = useState('low')
  const location = region.data?.locations.find((candidate) => candidate.id === locationId)
  const result = useApiResource(
    (signal) => fetchGambiaRecommendations({ location: locationId, input }, { signal }),
    [locationId, input],
  )
  const data = result.data

  return (
    <div className="section-page">
      <div className="page-heading">
        <div>
          <div className="page-kicker"><span /> FARM PLANNING <span className="kicker-divider">/</span> THE GAMBIA</div>
          <h1>{section.label}</h1>
          <p>
            Crops that may grow well near {location ? `${location.name}, ${location.region}` : 'you'}.
            The advice uses local weather and long-term crop information.
          </p>
        </div>
        <div className="page-controls">
          <LocationSelect locations={region.data?.locations} onChange={onLocationChange} value={locationId} />
          <div className="location-select">
            <span>Farm inputs</span>
            <div className="segmented segmented--flush" role="group" aria-label="Farming input level">
              {['low', 'high'].map((level) => (
                <button aria-pressed={input === level} key={level} onClick={() => setInput(level)} type="button">
                  {level === 'low' ? 'Few inputs' : 'More inputs'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <LoadState loadingMessage="Combining suitability, rainfall and soil moisture data…" resource={result} />

      {result.status === 'success' && (
        <>
          <Conditions result={data} />

          <section aria-labelledby="recommended-crops-title" className="source-category">
            <div className="section-heading">
              <div>
                <h2 id="recommended-crops-title">Recommended crops</h2>
                <p className="category-description">
                  The first three matches for this season, using recent rain and long-term crop fit.
                </p>
              </div>
            </div>
            {data.crops.filter((crop) => crop.group !== 'not-suitable').length > 0 ? (
              <div className="crop-grid">
                {data.crops
                  .filter((crop) => crop.group !== 'not-suitable')
                  .slice(0, 3)
                  .map((crop) => <CropCard crop={crop} key={crop.crop} month={data.season.month} />)}
              </div>
            ) : (
              <p className="panel crop-empty">No strong match is available for this season. Search a crop below to check its long-term rating.</p>
            )}
          </section>

          <CropSearch locationId={locationId} />

          <p className="crop-advice-note">
            Advice uses weather estimates and long-term crop ratings. Your field may be different.
          </p>
        </>
      )}
    </div>
  )
}

export default CropRecommendationsPage
