/**
 * US coverage map — an inline SVG tile cartogram.
 *
 * The design source renders this as an <iframe> running d3 + topojson from a
 * CDN. That is replaced here with a self-contained SVG for three reasons: no
 * third-party request on the critical path, no layout shift, and no JavaScript
 * needed to see the coverage.
 *
 * The map itself is aria-hidden. It is a picture of a fact, not the fact — the
 * authoritative state and city lists render beside it as real text links in
 * CoverageMapBlock, which is what a crawler reads.
 */

interface Tile {
  code: string
  name: string
  col: number
  row: number
}

/** Standard US state tile grid: 12 columns x 8 rows, 50 states plus DC. */
const TILES: Tile[] = [
  { code: 'AK', name: 'Alaska', col: 0, row: 0 },
  { code: 'ME', name: 'Maine', col: 10, row: 0 },

  { code: 'VT', name: 'Vermont', col: 9, row: 1 },
  { code: 'NH', name: 'New Hampshire', col: 10, row: 1 },

  { code: 'WA', name: 'Washington', col: 0, row: 2 },
  { code: 'ID', name: 'Idaho', col: 1, row: 2 },
  { code: 'MT', name: 'Montana', col: 2, row: 2 },
  { code: 'ND', name: 'North Dakota', col: 3, row: 2 },
  { code: 'MN', name: 'Minnesota', col: 4, row: 2 },
  { code: 'IL', name: 'Illinois', col: 5, row: 2 },
  { code: 'WI', name: 'Wisconsin', col: 6, row: 2 },
  { code: 'MI', name: 'Michigan', col: 7, row: 2 },
  { code: 'NY', name: 'New York', col: 9, row: 2 },
  { code: 'MA', name: 'Massachusetts', col: 10, row: 2 },
  { code: 'RI', name: 'Rhode Island', col: 11, row: 2 },

  { code: 'OR', name: 'Oregon', col: 0, row: 3 },
  { code: 'NV', name: 'Nevada', col: 1, row: 3 },
  { code: 'WY', name: 'Wyoming', col: 2, row: 3 },
  { code: 'SD', name: 'South Dakota', col: 3, row: 3 },
  { code: 'IA', name: 'Iowa', col: 4, row: 3 },
  { code: 'IN', name: 'Indiana', col: 5, row: 3 },
  { code: 'OH', name: 'Ohio', col: 6, row: 3 },
  { code: 'PA', name: 'Pennsylvania', col: 7, row: 3 },
  { code: 'NJ', name: 'New Jersey', col: 8, row: 3 },
  { code: 'CT', name: 'Connecticut', col: 9, row: 3 },

  { code: 'CA', name: 'California', col: 0, row: 4 },
  { code: 'UT', name: 'Utah', col: 1, row: 4 },
  { code: 'CO', name: 'Colorado', col: 2, row: 4 },
  { code: 'NE', name: 'Nebraska', col: 3, row: 4 },
  { code: 'MO', name: 'Missouri', col: 4, row: 4 },
  { code: 'KY', name: 'Kentucky', col: 5, row: 4 },
  { code: 'WV', name: 'West Virginia', col: 6, row: 4 },
  { code: 'VA', name: 'Virginia', col: 7, row: 4 },
  { code: 'MD', name: 'Maryland', col: 8, row: 4 },
  { code: 'DE', name: 'Delaware', col: 9, row: 4 },

  { code: 'AZ', name: 'Arizona', col: 1, row: 5 },
  { code: 'NM', name: 'New Mexico', col: 2, row: 5 },
  { code: 'KS', name: 'Kansas', col: 3, row: 5 },
  { code: 'AR', name: 'Arkansas', col: 4, row: 5 },
  { code: 'TN', name: 'Tennessee', col: 5, row: 5 },
  { code: 'NC', name: 'North Carolina', col: 6, row: 5 },
  { code: 'SC', name: 'South Carolina', col: 7, row: 5 },
  { code: 'DC', name: 'District of Columbia', col: 8, row: 5 },

  { code: 'OK', name: 'Oklahoma', col: 3, row: 6 },
  { code: 'LA', name: 'Louisiana', col: 4, row: 6 },
  { code: 'MS', name: 'Mississippi', col: 5, row: 6 },
  { code: 'AL', name: 'Alabama', col: 6, row: 6 },
  { code: 'GA', name: 'Georgia', col: 7, row: 6 },

  { code: 'HI', name: 'Hawaii', col: 0, row: 7 },
  { code: 'TX', name: 'Texas', col: 3, row: 7 },
  { code: 'FL', name: 'Florida', col: 8, row: 7 },
]

const CELL = 74
const GAP = 6
const COLS = 12
const ROWS = 8

export function UsCoverageMap({ servedCodes }: { servedCodes: Set<string> }) {
  const width = COLS * CELL + (COLS - 1) * GAP
  const height = ROWS * CELL + (ROWS - 1) * GAP

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full"
      role="presentation"
      aria-hidden
      focusable="false"
    >
      {TILES.map((tile) => {
        const served = servedCodes.has(tile.code)
        const x = tile.col * (CELL + GAP)
        const y = tile.row * (CELL + GAP)
        return (
          <g key={tile.code}>
            <rect
              x={x}
              y={y}
              width={CELL}
              height={CELL}
              rx={12}
              fill={served ? 'var(--color-primary-soft)' : 'var(--color-surface-alt)'}
              stroke={served ? 'var(--color-primary)' : 'var(--color-border)'}
              strokeWidth={served ? 1.5 : 1}
            />
            <text
              x={x + CELL / 2}
              y={y + CELL / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={22}
              fontWeight={800}
              fill={served ? 'var(--color-primary)' : 'var(--color-subtle)'}
              fontFamily="var(--font-heading)"
            >
              {tile.code}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export const US_STATE_TILES = TILES
