import type { EthiopianIdData } from "@/types/id-card";
import { EthiopianFlag } from "./EthiopianFlag";
import { NationalIdLogo } from "./NationalIdLogo";
import { GuillochePattern } from "./GuillochePattern";
import { BarcodeDisplay } from "./BarcodeDisplay";

type LandscapeCardFrontProps = {
  data: EthiopianIdData;
  className?: string;
};

export function LandscapeCardFront({ data, className = "" }: LandscapeCardFrontProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-slate-300 shadow-md bg-[#D7F5ED] select-none ${className}`}
      style={{
        aspectRatio: "85.6 / 53.98",
        fontFamily: "'Noto Sans Ethiopic', 'Inter', system-ui, sans-serif",
      }}
      aria-label="Ethiopian Digital ID Card Front"
    >
      <GuillochePattern />

      <div className="relative z-10 flex flex-col h-full p-3 sm:p-3.5 justify-between">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <EthiopianFlag className="w-9.5 h-6 shrink-0 shadow-2xs" />
            <div className="flex flex-col leading-[1.12]">
              <h2 className="text-[12px] sm:text-[13px] font-bold text-slate-950 tracking-tight">
                የኢትዮጵያ ዲጂታል መታወቂያ ካርድ
              </h2>
              <p className="text-[11px] sm:text-[12px] font-black text-cyan-950 tracking-tight">
                Ethiopian Digital ID Card
              </p>
            </div>
          </div>
          <NationalIdLogo className="h-7.5 shrink-0" />
        </header>

        <div className="flex items-center gap-2 my-auto pt-0.5">
          <div className="relative flex items-center justify-center w-3 shrink-0 h-28">
            <div
              className="absolute whitespace-nowrap text-[7px] font-bold text-teal-800 tracking-tight"
              style={{
                transform: "rotate(-90deg)",
                transformOrigin: "center center",
              }}
            >
              የተሰጠበት ቀን : {data.dateOfIssueEth} &nbsp;&nbsp;&nbsp; Date of Issue : {data.dateOfIssueGreg}
            </div>
          </div>

          <div className="shrink-0 w-24 sm:w-27 h-28 sm:h-32 rounded-lg overflow-hidden border border-teal-800/20 shadow-xs bg-slate-100 flex items-center justify-center">
            {data.photoUrl ? (
              <img
                src={data.photoUrl}
                alt={`Portrait of ${data.fullNameEnglish}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-[10px] text-slate-400">Photo</span>
            )}
          </div>

          <div className="flex-1 flex flex-col justify-center space-y-1 pl-1 leading-none">
            <div>
              <span className="text-[8.5px] font-semibold text-[#B45309] block mb-0.5 tracking-tight">
                ሙሉ ስም | Full Name
              </span>
              <p className="text-[12.5px] sm:text-[13.5px] font-bold text-slate-950 leading-tight">
                {data.fullNameAmharic}
              </p>
              <p className="text-[11.5px] sm:text-[12.5px] font-bold text-slate-900 leading-tight">
                {data.fullNameEnglish}
              </p>
            </div>

            <div>
              <span className="text-[8.5px] font-semibold text-[#B45309] block mb-0.5 tracking-tight">
                የትውልድ ቀን | Date of Birth
              </span>
              <p className="text-[11px] sm:text-[12px] font-bold text-slate-900 leading-tight">
                {data.dateOfBirthEth} <span className="font-normal text-slate-400">|</span> {data.dateOfBirthGreg}
              </p>
            </div>

            <div>
              <span className="text-[8.5px] font-semibold text-[#B45309] block mb-0.5 tracking-tight">
                ፆታ | Sex
              </span>
              <p className="text-[11px] sm:text-[12px] font-bold text-slate-900 leading-tight">
                {data.sexAmharic} <span className="font-normal text-slate-400">|</span> {data.sexEnglish}
              </p>
            </div>

            <div>
              <span className="text-[8.5px] font-semibold text-[#B45309] block mb-0.5 tracking-tight">
                የሚያበቃበት ቀን | Date of Expiry
              </span>
              <p className="text-[11px] sm:text-[12px] font-bold text-slate-900 leading-tight">
                {data.dateOfExpiryEth} <span className="font-normal text-slate-400">|</span> {data.dateOfExpiryGreg}
              </p>
            </div>
          </div>
        </div>

        <footer className="flex items-end justify-between pt-0.5 gap-2">
          <div className="flex items-center gap-1.5 ml-2.5">
            <div className="text-[7.5px] font-extrabold text-teal-700 leading-[1.05] text-right flex flex-col">
              <span>ካርድ</span>
              <span>ቁጥር</span>
              <span>FAN</span>
            </div>
            <BarcodeDisplay fanNumber={data.fanNumber} className="w-44 sm:w-52" />
          </div>

          <div className="shrink-0 flex items-end h-8 sm:h-9 bg-transparent">
            <img
              src="/assets/fayda-transparent.png"
              alt="ፋ ይ ዳ"
              className="h-full w-auto object-contain block opacity-95 bg-transparent"
            />
          </div>

          <div className="shrink-0 w-8.5 h-11 rounded border border-teal-800/20 overflow-hidden bg-slate-100 opacity-75">
            {data.photoUrl ? (
              <img src={data.photoUrl} alt="Ghost identity portrait" className="w-full h-full object-cover" />
            ) : null}
          </div>
        </footer>
      </div>
    </div>
  );
}
