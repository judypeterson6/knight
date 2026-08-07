/**
 * Bakes the US state outlines into a static TypeScript module.
 *
 *   npm run gen:map
 *
 * The design source draws this map with d3 + topojson loaded from a CDN inside
 * an <iframe>. That is a third-party request on the critical path, a layout
 * shift, and invisible without JavaScript. This script runs the *same*
 * projection (geoAlbersUsa, fitted to 1000x600) at build time and writes the
 * resulting SVG path strings to src/components/ui/us-state-paths.ts, so the
 * runtime ships plain inline SVG — no d3, no topojson, no network.
 *
 * Re-run only if you want different geometry or a different projection.
 */

import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { geoAlbersUsa, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type { FeatureCollection, Geometry } from 'geojson'

/**
 * Minimal shape of the us-atlas topology. Declared locally rather than pulling
 * in @types/topojson-specification, which is not published.
 */
interface StatesTopology {
  type: 'Topology'
  objects: { states: { type: 'GeometryCollection' } }
  arcs: number[][][]
  transform?: { scale: [number, number]; translate: [number, number] }
}

const require = createRequire(import.meta.url)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const WIDTH = 1000
const HEIGHT = 600

/** FIPS state code -> postal abbreviation. us-atlas keys states by FIPS id. */
const FIPS_TO_CODE: Record<string, string> = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT',
  '10': 'DE', '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL',
  '18': 'IN', '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD',
  '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE',
  '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND',
  '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI', '45': 'SC', '46': 'SD',
  '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV',
  '55': 'WI', '56': 'WY',
}

/** Too small to hold a label inside the shape — labelled with a leader line. */
const SMALL_STATES = new Set(['DC', 'DE', 'MD', 'NJ', 'CT', 'RI', 'MA', 'NH', 'VT'])

interface StateShape {
  code: string
  name: string
  d: string
  cx: number
  cy: number
  small: boolean
}

const topology = require('us-atlas/states-10m.json') as StatesTopology

/* eslint-disable @typescript-eslint/no-explicit-any */
const collection = feature(topology as any, topology.objects.states as any) as unknown as FeatureCollection<
  Geometry,
  { name: string }
>
/* eslint-enable @typescript-eslint/no-explicit-any */

const projection = geoAlbersUsa().fitSize([WIDTH, HEIGHT], collection)
// One decimal is 0.1px in a 1000x600 viewBox — far finer than any display needs,
// and it roughly halves the generated file compared with full precision.
const pathFor = geoPath(projection).digits(1)

const shapes: StateShape[] = []
const skipped: string[] = []

for (const f of collection.features) {
  const code = FIPS_TO_CODE[String(f.id)]
  const name = f.properties?.name ?? ''
  if (!code) {
    skipped.push(`${String(f.id)} ${name}`)
    continue
  }

  const d = pathFor(f)
  const centroid = pathFor.centroid(f)
  if (!d || Number.isNaN(centroid[0])) {
    skipped.push(`${code} (no projected geometry)`)
    continue
  }

  shapes.push({
    code,
    name,
    d,
    cx: Number(centroid[0].toFixed(1)),
    cy: Number(centroid[1].toFixed(1)),
    small: SMALL_STATES.has(code),
  })
}

shapes.sort((a, b) => a.code.localeCompare(b.code))

const out = `/**
 * GENERATED FILE — do not edit by hand. Run \`npm run gen:map\`.
 *
 * US state outlines projected with geoAlbersUsa fitted to ${WIDTH}x${HEIGHT},
 * baked from us-atlas/states-10m at build time so the runtime ships plain
 * inline SVG with no d3, no topojson and no CDN request.
 */

export interface UsStateShape {
  code: string
  name: string
  /** SVG path data in a 0 0 ${WIDTH} ${HEIGHT} viewBox. */
  d: string
  /** Projected centroid, for the label. */
  cx: number
  cy: number
  /** Too small to hold an inside label; rendered with a leader line. */
  small: boolean
}

export const US_MAP_WIDTH = ${WIDTH}
export const US_MAP_HEIGHT = ${HEIGHT}

export const US_STATE_SHAPES: UsStateShape[] = ${JSON.stringify(shapes, null, 2)}
`

const dest = path.join(ROOT, 'src', 'components', 'ui', 'us-state-paths.ts')
writeFileSync(dest, out, 'utf8')

console.log(`\n  states projected : ${shapes.length}`)
if (skipped.length) console.log(`  skipped          : ${skipped.join(', ')}`)
console.log(`  written          : ${path.relative(ROOT, dest)}`)
console.log(`  size             : ${(out.length / 1024).toFixed(0)} kB\n`)
