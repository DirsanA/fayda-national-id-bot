export function NationalIdLogo({ className = "h-8" }: { className?: string }) {
  return (
    <div className={`relative shrink-0 flex items-center gap-1.5 bg-transparent ${className}`}>
      {/* Circular Emblem */}
      <svg
        viewBox="0 0 44 44"
        className="h-full aspect-square bg-transparent"
        aria-label="National ID Emblem"
      >
        {/* Deep blue circle */}
        <circle cx="22" cy="22" r="21" fill="#104E70" />
        
        {/* Subtle cyan inner ring */}
        <circle cx="22" cy="22" r="19.5" fill="none" stroke="#38BDF8" strokeWidth="0.75" opacity="0.6" />
        
        {/* Stylized white bird / flight biometric motif */}
        <path
          d="M 22,8 C 14.5,8 10,13.5 10,21 C 10,27 13.5,32.5 19,34 C 20,34.3 20.8,33.5 20.8,32.5 C 20.8,31.7 20.2,31 19.4,30.8 C 15.5,29.8 13,26 13,21.5 C 13,16 16.8,11.5 22,11.5 C 27.2,11.5 31,16 31,21 C 31,24.5 29,27.5 26.2,28.2 C 24.8,28.6 23.5,27.5 23.5,26 C 23.5,22 26,19 26,16 C 26,14.5 24.8,13.2 23,13.2 C 21.2,13.2 20,14.5 20,16 C 20,19 20,23.5 20,26.5 C 20,29.8 22.2,32 25.5,31 C 29.8,29.5 33.5,25.5 33.5,21 C 33.5,14 29,8 22,8 Z"
          fill="#FFFFFF"
        />
        
        {/* Small cyan focal dot */}
        <circle cx="22" cy="22" r="2.2" fill="#38BDF8" />
      </svg>

      {/* Bilingual Text: Amharic above, English below */}
      <div className="flex flex-col justify-center leading-[1.05] select-none">
        <span className="text-[8.5px] sm:text-[9.5px] font-bold text-[#104E70] tracking-tight">
          ብሔራዊ መታወቂያ
        </span>
        <span className="text-[11px] sm:text-[12.5px] font-black text-[#104E70] tracking-tight">
          National ID
        </span>
      </div>
    </div>
  );
}
