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
          <stop offset="1" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#rf-gradient)" />
      {/* Pano + onay: iş kaydı ve onay süreci */}
      <rect x="17" y="13" width="30" height="40" rx="5" fill="#ffffff" />
      <rect x="25" y="9" width="14" height="8" rx="3" fill="#bae6fd" />
      <rect x="23" y="24" width="18" height="4" rx="2" fill="#e0e7ff" />
      <path
        d="M24 40l6 6 11-12"
        stroke="#4f46e5"
        strokeWidth="4.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
