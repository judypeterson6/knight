import { cn } from '@/lib/utils'
import { US_MAP_HEIGHT, US_MAP_WIDTH, US_STATE_SHAPES } from '@/components/ui/us-state-paths'

/**
 * US coverage map — real state geometry, rendered as inline SVG.
 *
 * The design source draws this with d3 + topojson pulled from a CDN inside an
 * <iframe>. Same projection here (geoAlbersUsa fitted to 1000x600), but the
 * paths are baked at build time by `npm run gen:map`, so there is no CDN
 * request, no client JavaScript, and no layout shift.
 *
 * The map is aria-hidden: it is a picture of a fact, not the fact. The
 * authoritative state and city lists render beside it as real text links in
 * CoverageMapBlock, which is what a crawler reads.
 */
export function UsCoverageMap({ servedCodes, className }: { servedCodes: Set<string>; className?: string }) {
  // Small north-eastern states cannot hold a label inside the shape; they get a
  // leader line out to the right instead, stacked in latitude order.
  const smallServed = US_STATE_SHAPES.filter((s) => s.small && servedCodes.has(s.code)).sort((a, b) => a.cy - b.cy)

  const LEADER_X = US_MAP_WIDTH - 92
  const firstY = 150
  const gap = 26

  return (
    <svg
      viewBox={`0 0 ${US_MAP_WIDTH} ${US_MAP_HEIGHT}`}
      className={cn('h-auto w-full', className)}
      role="presentation"
      aria-hidden
      focusable="false"
    >
      <g>
        {US_STATE_SHAPES.map((state) => {
          const served = servedCodes.has(state.code)
          return (
            <path
              key={state.code}
              d={state.d}
              fill={served ? 'var(--color-primary-soft)' : 'var(--color-surface-alt)'}
              stroke={served ? 'var(--color-primary)' : 'var(--color-border)'}
              strokeWidth={served ? 0.9 : 0.6}
              strokeLinejoin="round"
            />
          )
        })}
      </g>

      {/* Labels inside the shape, for states with room. */}
      <g>
        {US_STATE_SHAPES.filter((s) => !s.small).map((state) => (
          <text
            key={`label-${state.code}`}
            x={state.cx}
            y={state.cy}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={11}
            fontWeight={700}
            fill={servedCodes.has(state.code) ? 'var(--color-primary)' : 'var(--color-subtle)'}
            fontFamily="var(--font-heading)"
          >
            {state.code}
          </text>
        ))}
      </g>

      {/* Leader lines for the small north-eastern states. */}
      <g>
        {smallServed.map((state, i) => {
          const y = firstY + i * gap
          return (
            <g key={`leader-${state.code}`}>
              <polyline
                points={`${state.cx},${state.cy} ${LEADER_X - 14},${y} ${LEADER_X - 6},${y}`}
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth={0.7}
                opacity={0.55}
              />
              <circle cx={state.cx} cy={state.cy} r={1.6} fill="var(--color-primary)" />
              <text
                x={LEADER_X}
                y={y}
                dominantBaseline="central"
                fontSize={11}
                fontWeight={700}
                fill="var(--color-primary)"
                fontFamily="var(--font-heading)"
              >
                {state.code}
              </text>
            </g>
          )
        })}
      </g>
    </svg>
  )
}

export { US_STATE_SHAPES }
