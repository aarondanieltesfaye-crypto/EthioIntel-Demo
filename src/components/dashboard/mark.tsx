export function EthioMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <rect
        x="7.5"
        y="7.5"
        width="25"
        height="25"
        rx="1"
        transform="rotate(45 20 20)"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M20 6.5 V13.5 M20 26.5 V33.5 M6.5 20 H13.5 M26.5 20 H33.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="square"
      />
      <circle cx="20" cy="20" r="3.2" fill="currentColor" />
    </svg>
  );
}
