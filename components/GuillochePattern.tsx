export function GuillochePattern() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden select-none" aria-hidden="true">
      {/* Base mint-green gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#C2F2E7] via-[#D8F8F0] to-[#BFEFE4]" />

      {/* Central radiant warm golden starburst glow */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 65% 55% at 50% 48%, rgba(254, 240, 138, 0.85) 0%, rgba(253, 230, 138, 0.5) 30%, rgba(204, 251, 241, 0.15) 65%, transparent 100%)",
        }}
      />

      {/* High-density woven Guilloche micro-waves SVG */}
      <svg className="absolute inset-0 w-full h-full opacity-45" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="denseGuilloche" width="80" height="40" patternUnits="userSpaceOnUse">
            {/* Primary wave family */}
            <path
              d="M 0,20 C 20,4 20,36 40,20 C 60,4 60,36 80,20"
              fill="none"
              stroke="#0D9488"
              strokeWidth="0.6"
            />
            <path
              d="M 0,16 C 20,0 20,32 40,16 C 60,0 60,32 80,16"
              fill="none"
              stroke="#0891B2"
              strokeWidth="0.45"
            />
            <path
              d="M 0,24 C 20,8 20,40 40,24 C 60,8 60,40 80,24"
              fill="none"
              stroke="#059669"
              strokeWidth="0.45"
            />
            {/* Intersecting counter-phase wave family for moiré effect */}
            <path
              d="M 0,20 C 20,36 20,4 40,20 C 60,36 60,4 80,20"
              fill="none"
              stroke="#0D9488"
              strokeWidth="0.4"
              strokeOpacity="0.7"
            />
            <path
              d="M 0,12 C 20,28 20,-4 40,12 C 60,28 60,-4 80,12"
              fill="none"
              stroke="#0891B2"
              strokeWidth="0.35"
              strokeOpacity="0.6"
            />
            <path
              d="M 0,28 C 20,44 20,12 40,28 C 60,44 60,12 80,28"
              fill="none"
              stroke="#0D9488"
              strokeWidth="0.35"
              strokeOpacity="0.6"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#denseGuilloche)" />
      </svg>

      {/* Concentric subtle circular security arcs behind photo */}
      <div className="absolute top-[48%] left-[16%] -translate-x-1/2 -translate-y-1/2 w-[220px] h-[220px] opacity-20 pointer-events-none">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          <circle cx="100" cy="100" r="95" fill="none" stroke="#0D9488" strokeWidth="1" strokeDasharray="3,3" />
          <circle cx="100" cy="100" r="80" fill="none" stroke="#0D9488" strokeWidth="0.75" />
          <circle cx="100" cy="100" r="65" fill="none" stroke="#0D9488" strokeWidth="0.75" />
          <circle cx="100" cy="100" r="50" fill="none" stroke="#0D9488" strokeWidth="0.75" />
        </svg>
      </div>

      {/* Intricate 12-point Seal of Solomon Star Watermark in center-right */}
      <div className="absolute top-[46%] left-[49%] -translate-x-1/2 -translate-y-1/2 w-[250px] h-[250px] opacity-35 pointer-events-none">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          {/* Dual concentric circular rings */}
          <circle cx="100" cy="100" r="94" fill="none" stroke="#CA8A04" strokeWidth="1.2" strokeDasharray="3,2" />
          <circle cx="100" cy="100" r="84" fill="none" stroke="#0D9488" strokeWidth="0.8" />
          
          {/* Interlocking geometric 12-point star polygons */}
          <polygon
            points="100,10 118,65 174,72 131,107 146,162 100,132 54,162 69,107 26,72 82,65"
            fill="none"
            stroke="#CA8A04"
            strokeWidth="1.6"
          />
          <polygon
            points="100,190 118,135 174,128 131,93 146,38 100,68 54,38 69,93 26,128 82,135"
            fill="none"
            stroke="#CA8A04"
            strokeWidth="1.4"
            opacity="0.85"
          />
          {/* Central rosette */}
          <circle cx="100" cy="100" r="32" fill="none" stroke="#CA8A04" strokeWidth="1" />
          <circle cx="100" cy="100" r="16" fill="none" stroke="#CA8A04" strokeWidth="0.75" />
        </svg>
      </div>

      {/* Golden-yellow wavy security band along bottom */}
      <div className="absolute bottom-0 inset-x-0 h-10 opacity-30 pointer-events-none">
        <svg viewBox="0 0 500 40" preserveAspectRatio="none" className="w-full h-full">
          <path
            d="M 0,25 Q 125,5 250,25 T 500,25 L 500,40 L 0,40 Z"
            fill="#FDE047"
          />
          <path
            d="M 0,20 Q 125,35 250,20 T 500,20"
            fill="none"
            stroke="#CA8A04"
            strokeWidth="1"
          />
        </svg>
      </div>
    </div>
  );
}
