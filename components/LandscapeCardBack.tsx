import type { EthiopianIdData } from "@/types/id-card";

type LandscapeCardBackProps = {
  data: EthiopianIdData;
  className?: string;
};

export function LandscapeCardBack({ data, className = "" }: LandscapeCardBackProps) {
  const qrSource = data.qrCodeUrl || "/assets/target-qr.png";

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-slate-300 shadow-md bg-[#D7F5ED] select-none ${className}`}
      style={{
        aspectRatio: "85.6 / 53.98",
        fontFamily: "'Noto Sans Ethiopic', 'Inter', system-ui, sans-serif",
      }}
      aria-label="Ethiopian Digital ID Card Back"
    >
      {/* 1. Authentic Template Background with fine guilloche, uncut disclaimer & labels */}
      <img
        src="/assets/card-back-template.png"
        alt="Ethiopian Digital ID Back Template"
        className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
        draggable={false}
      />

      {/* 2. Dynamic Text Overlays on Left directly over pristine background */}
      <div className="absolute left-[4.0%] top-[14.2%] w-[38%] flex flex-col pointer-events-none">
        {/* Phone */}
        <div>
          <p className="text-[12px] sm:text-[13.5px] font-bold text-slate-950 leading-tight">
            {data.phoneNumber}
          </p>
        </div>

        {/* Nationality */}
        <div className="pt-[7.5%]">
          <p className="text-[11px] sm:text-[12.5px] font-bold text-slate-950 leading-tight">
            {data.nationalityAmharic} &nbsp;|&nbsp; {data.nationalityEnglish}
          </p>
        </div>

        {/* Address */}
        <div className="pt-[6.5%] space-y-[1px] text-[10px] sm:text-[11.5px] font-bold text-slate-950 leading-[1.25]">
          <p>{data.regionAmharic}</p>
          <p>{data.regionEnglish}</p>
          <p>{data.subcityAmharic}</p>
          <p>{data.subcityEnglish}</p>
          <p>{data.woredaAmharic}</p>
          <p>{data.woredaEnglish}</p>
        </div>
      </div>

      {/* 3. FIN Number inside bottom-left FIN Box */}
      <div className="absolute left-[10.3%] bottom-[12.2%] w-[24%] flex items-center pointer-events-none">
        <span className="text-[10.5px] sm:text-[12px] font-black tracking-wider text-slate-950">
          FIN &nbsp;{data.finNumber}
        </span>
      </div>

      {/* 4. Extracted QR Code inside QR Frame */}
      <div className="absolute left-[45.7%] top-[7.4%] w-[48.5%] h-[76.8%] flex items-center justify-center pointer-events-none">
        <img
          src={qrSource}
          alt="Identity verification QR code"
          className="w-full h-full object-contain"
        />
      </div>

      {/* 5. SN Number inside SN Badge */}
      <div className="absolute right-[4.2%] bottom-[4.2%] w-[19%] flex items-center justify-end px-1 pointer-events-none text-[8.5px] sm:text-[9.5px] font-black">
        <span className="text-slate-900 font-extrabold">{data.serialNumber || "65501482"}</span>
      </div>
    </div>
  );
}
