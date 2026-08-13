'use client'

const SPARKS = [
  { angle: -18, dist: 20, size: 8, delay: '0ms', spin: '70deg', fill: '#FFD54A' },
  { angle: 28, dist: 23, size: 6, delay: '25ms', spin: '-55deg', fill: '#fff' },
  { angle: 72, dist: 18, size: 7, delay: '8ms', spin: '110deg', fill: '#FFE89A' },
  { angle: 118, dist: 22, size: 5, delay: '40ms', spin: '-80deg', fill: '#FFD54A' },
  { angle: 162, dist: 19, size: 8, delay: '12ms', spin: '45deg', fill: '#fff' },
  { angle: 208, dist: 24, size: 6, delay: '32ms', spin: '-95deg', fill: '#FFE89A' },
  { angle: 248, dist: 17, size: 5, delay: '18ms', spin: '60deg', fill: '#FFD54A' },
  { angle: 292, dist: 21, size: 7, delay: '5ms', spin: '-40deg', fill: '#fff' },
  { angle: 335, dist: 16, size: 5, delay: '36ms', spin: '90deg', fill: '#FFE89A' },
]

function CursorPointer({ className, color }: { className?: string; color: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 35 35"
      fill="none"
      fillRule="evenodd"
      aria-hidden
    >
      <g fill="rgba(0,0,0,.2)" transform="translate(1,1)">
        <path d="m12 24.4219v-16.015l11.591 11.619h-6.781l-.411.124z" />
        <path d="m21.0845 25.0962-3.605 1.535-4.682-11.089 3.686-1.553z" />
      </g>
      <g fill="white">
        <path d="m12 24.4219v-16.015l11.591 11.619h-6.781l-.411.124z" />
        <path d="m21.0845 25.0962-3.605 1.535-4.682-11.089 3.686-1.553z" />
      </g>
      <g fill={color}>
        <path d="m19.751 24.4155-1.844.774-3.1-7.374 1.841-.775z" />
        <path d="m13 10.814v11.188l2.969-2.866.428-.139h4.768z" />
      </g>
    </svg>
  )
}

function SparkIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill={color}
      aria-hidden
    >
      <path d="M6 0.2 7.05 4.85 11.8 6 7.05 7.15 6 11.8 4.95 7.15.2 6 4.95 4.85Z" />
    </svg>
  )
}

export default function CursorHighFive({
  x,
  y,
  colorA,
  colorB,
  scale = 1,
}: {
  x: number
  y: number
  colorA: string
  colorB: string
  /** Counter-scale so the burst stays a consistent screen size (board zoom). */
  scale?: number
}) {
  return (
    <div
      className="cursor-high-five"
      style={{ transform: `translate(${x}px, ${y}px) scale(${scale})` }}
      aria-hidden
    >
      <span className="cursor-high-five__flash" />
      {SPARKS.map((spark, i) => {
        const rad = (spark.angle * Math.PI) / 180
        return (
          <span
            key={i}
            className="cursor-high-five__spark"
            style={{
              ['--spark-x' as string]: `${Math.cos(rad) * spark.dist}px`,
              ['--spark-y' as string]: `${Math.sin(rad) * spark.dist}px`,
              ['--spark-delay' as string]: spark.delay,
              ['--spark-spin' as string]: spark.spin,
            }}
          >
            <SparkIcon size={spark.size} color={spark.fill} />
          </span>
        )
      })}
      <CursorPointer
        className="cursor-high-five__pointer cursor-high-five__pointer--a"
        color={colorA}
      />
      <CursorPointer
        className="cursor-high-five__pointer cursor-high-five__pointer--b"
        color={colorB}
      />
    </div>
  )
}
