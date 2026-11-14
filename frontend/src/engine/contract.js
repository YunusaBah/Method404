/**
 * The engine contract, written as JSDoc so plain JavaScript keeps the same
 * shape the UI was built against. Any real engine must satisfy this.
 *
 * @typedef {'groundnut'|'cowpea'|'millet'|'sorghum'|'maize'|'rice'|'cassava'} CropId
 * @typedef {'water'|'soil'|'income'|'food'|'labor'|'risk'} Criterion
 * @typedef {'sandy'|'loam'|'clay'|'unknown'} Soil
 * @typedef {'rainfed'|'lowland'|'irrigated'} Water
 * @typedef {'good'|'poor'|'failed'} Outcome
 * @typedef {'observed'|'derived'|'modeled'|'hypothetical'} Tag
 *
 * @typedef {Object} District
 * @property {string} id
 * @property {string} name
 * @property {Soil|null} defaultSoil
 *
 * @typedef {Object} FarmProfile
 * @property {string} cellId
 * @property {string} districtId
 * @property {Soil} soil
 * @property {boolean} soilIsDefault
 * @property {Water} water
 * @property {Criterion[]} priorities
 * @property {CropId[]} history
 * @property {number} seasons
 *
 * @typedef {Object} Scenario
 * @property {number} dTempC
 * @property {number} dRainPct
 *
 * @typedef {Object} SeasonResult
 * @property {number} slot
 * @property {CropId} crop
 * @property {Outcome[]} outcomes
 * @property {number[]} rainWeekly
 * @property {'ok'|'low'} confidence
 * @property {boolean} pinned
 *
 * @typedef {Object} Sequence
 * @property {SeasonResult[]} slots
 *
 * @typedef {Object} Reason
 * @property {string} code
 * @property {Record<string, string|number>} params
 *
 * @typedef {Object} DetailRow
 * @property {number} slot
 * @property {string} label
 * @property {string} value
 * @property {Tag} tag
 * @property {string} [source]
 *
 * @typedef {Object} DetailsPayload
 * @property {DetailRow[]} rows
 *
 * @typedef {Object} SlotOption
 * @property {CropId} crop
 * @property {Outcome[]} outcomes
 *
 * @typedef {Object} OkPlan
 * @property {'ok'} status
 * @property {Sequence} best
 * @property {Sequence[]} alternatives
 * @property {Reason[]} reasons
 * @property {number[]} changedSlots
 * @property {boolean} hypothetical
 * @property {DetailsPayload} details
 *
 * @typedef {Object} InsufficientPlan
 * @property {'insufficient'} status
 * @property {('location'|'soil'|'water')[]} missing
 *
 * @typedef {OkPlan|InsufficientPlan} PlanResult
 *
 * @typedef {Object} Engine
 * @property {(p: FarmProfile, s: Scenario, fixed?: Record<number, CropId>) => Promise<PlanResult>} plan
 * @property {(p: FarmProfile, s: Scenario, slot: number, fixed?: Record<number, CropId>) => Promise<SlotOption[]>} slotOptions
 * @property {() => District[]} districts
 * @property {(lat: number, lon: number) => {cellId: string, districtId: string}|null} nearestCell
 */

export {}
