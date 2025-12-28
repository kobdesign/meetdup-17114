import meetdupLogoUrl from "@assets/Gemini_Generated_Image_cpdn83cpdn83cpdn_1766907954232.png";

interface MeetdupLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  variant?: "default" | "light" | "dark";
  className?: string;
}

const sizeConfig = {
  sm: { logo: "h-8", text: "text-base" },
  md: { logo: "h-10", text: "text-lg" },
  lg: { logo: "h-14", text: "text-xl" },
  xl: { logo: "h-20", text: "text-2xl" },
};

export function MeetdupLogo({ 
  size = "md", 
  showText = false,
  variant = "default",
  className = "" 
}: MeetdupLogoProps) {
  const config = sizeConfig[size];
  
  const textColor = variant === "light" 
    ? "text-white" 
    : variant === "dark" 
      ? "text-foreground" 
      : "text-foreground";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img 
        src={meetdupLogoUrl} 
        alt="Meetdup" 
        className={`${config.logo} w-auto object-contain`}
      />
      {showText && (
        <span className={`font-bold ${config.text} ${textColor}`}>
          Meetdup
        </span>
      )}
    </div>
  );
}

export function MeetdupLogoIcon({ 
  size = "md", 
  className = "" 
}: Pick<MeetdupLogoProps, "size" | "className">) {
  const config = sizeConfig[size];
  
  return (
    <img 
      src={meetdupLogoUrl} 
      alt="Meetdup" 
      className={`${config.logo} w-auto object-contain ${className}`}
    />
  );
}

export { meetdupLogoUrl };
export default MeetdupLogo;
