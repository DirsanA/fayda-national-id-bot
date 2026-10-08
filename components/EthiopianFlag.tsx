export function EthiopianFlag({ className = "w-10 h-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 54 34"
      className={`overflow-hidden rounded-[1px] shadow-2xs shrink-0 bg-transparent ${className}`}
      aria-label="Flag of Ethiopia"
    >
      {/* Green, Yellow, Red horizontal stripes */}
      <rect x="0" y="0" width="54" height="11.33" fill="#078930" />
      <rect x="0" y="11.33" width="54" height="11.34" fill="#FCD116" />
      <rect x="0" y="22.67" width="54" height="11.33" fill="#DA121A" />
      
      {/* Central Blue Disc */}
      <circle cx="27" cy="17" r="7.8" fill="#0F47AF" />
      
      {/* 5-pointed Yellow Star */}
      <polygon
        points="27,10.6 28.7,14.6 33,15.1 29.8,18 30.7,22.3 27,20.1 23.3,22.3 24.2,18 21,15.1 25.3,14.6"
        fill="#FCD116"
      />
      
      {/* 5 Radiating Golden Rays */}
      <line x1="27" y1="17" x2="27" y2="9.8" stroke="#FCD116" strokeWidth="0.8" />
      <line x1="27" y1="17" x2="33.8" y2="14.8" stroke="#FCD116" strokeWidth="0.8" />
      <line x1="27" y1="17" x2="31.2" y2="23.2" stroke="#FCD116" strokeWidth="0.8" />
      <line x1="27" y1="17" x2="22.8" y2="23.2" stroke="#FCD116" strokeWidth="0.8" />
      <line x1="27" y1="17" x2="20.2" y2="14.8" stroke="#FCD116" strokeWidth="0.8" />
    </svg>
  );
}
