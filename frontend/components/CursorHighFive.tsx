'use client'

const SPARKS = [
  { dx: -18, dy: -16, delay: '0ms', color: 'a' as const, size: 10 },
  { dx: 16, dy: -18, delay: '40ms', color: 'b' as const, size: 9 },
  { dx: 20, dy: 8, delay: '70ms', color: 'a' as const, size: 8 },
  { dx: -8, dy: 18, delay: '30ms', color: 'b' as const, size: 11 },
  { dx: -22, dy: 4, delay: '90ms', color: 'a' as const, size: 7 },
  { dx: 6, dy: -22, delay: '20ms', color: 'b' as const, size: 8 },
]

/** Sharp raised-hand icon (heroicons-style). */
function HandIcon({ className, color }: { className?: string; color: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={color}
      stroke="#111"
      strokeWidth="1.25"
      strokeLinejoin="round"
      paintOrder="stroke"
      aria-hidden
    >
      <path d="M10.5 1.875a1.125 1.125 0 0 0-1.125 1.125v6.75a.75.75 0 0 1-1.5 0V3.375a1.125 1.125 0 1 0-2.25 0v10.136A4.127 4.127 0 0 0 4.125 13.5a1.125 1.125 0 1 0-2.25 0 6.375 6.375 0 0 0 12.75 0V9.75a.75.75 0 0 1 1.5 0v1.5a.75.75 0 0 0 1.5 0V6.375a1.125 1.125 0 1 0-2.25 0v4.125a.75.75 0 0 1-1.5 0V3.375a1.125 1.125 0 1 0-2.25 0v7.5a.75.75 0 0 1-1.5 0V2.25A1.125 1.125 0 0 0 10.5 1.875Z" />
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
      <path d="M6 0.4 7.15 4.7 11.6 6 7.15 7.3 6 11.6 4.85 7.3.4 6 4.85 4.7Z" />
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
      <span className="cursor-high-five__ring" />
      {SPARKS.map((spark, i) => (
        <span
          key={i}
          className="cursor-high-five__spark"
          style={{
            ['--spark-x' as string]: `${spark.dx}px`,
            ['--spark-y' as string]: `${spark.dy}px`,
            ['--spark-delay' as string]: spark.delay,
          }}
        >
          <SparkIcon
            size={spark.size}
            color={spark.color === 'a' ? colorA : colorB}
          />
        </span>
      ))}
      <HandIcon
        className="cursor-high-five__hand cursor-high-five__hand--a"
        color={colorA}
      />
      <HandIcon
        className="cursor-high-five__hand cursor-high-five__hand--b"
        color={colorB}
      />
    </div>
  )
}
