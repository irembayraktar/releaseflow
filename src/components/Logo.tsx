export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      role="img"
    >
      <defs>
        <linearGradient id="rf-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4f46e5" />
          <stop offset="1" stopColor="#9333ea" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#rf-gradient)" />
      {/* Yükselen adımlar: talep -> test -> canlıya alma */}
      <rect x="14" y="34" width="9" height="16" rx="4.5" fill="#c7d2fe" />
      <rect x="27.5" y="25" width="9" height="25" rx="4.5" fill="#e0e7ff" />
      <rect x="41" y="12" width="9" height="38" rx="4.5" fill="#ffffff" />
    </svg>
  )
}
