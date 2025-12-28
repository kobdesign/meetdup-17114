import defaultLogoUrl from "@assets/Gemini_Generated_Image_cpdn83cpdn83cpdn_1766907954232.png";
import { usePlatformSettings } from "@/contexts/PlatformSettingsContext";
import { useTheme } from "next-themes";

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
  const { settings } = usePlatformSettings();
  const { resolvedTheme } = useTheme();
  
  const isDarkMode = resolvedTheme === "dark";
  
  let logoUrl = defaultLogoUrl;
  if (isDarkMode && settings.platform_logo_dark_url) {
    logoUrl = settings.platform_logo_dark_url;
  } else if (!isDarkMode && settings.platform_logo_url) {
    logoUrl = settings.platform_logo_url;
  } else if (settings.platform_logo_url) {
    logoUrl = settings.platform_logo_url;
  }
  
  const platformName = settings.platform_name || "Meetdup";
  
  const textColor = variant === "light" 
    ? "text-white" 
    : variant === "dark" 
      ? "text-foreground" 
      : "text-foreground";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img 
        src={logoUrl} 
        alt={platformName} 
        className={`${config.logo} w-auto object-contain`}
      />
      {showText && (
        <span className={`font-bold ${config.text} ${textColor}`}>
          {platformName}
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
  const { settings } = usePlatformSettings();
  const { resolvedTheme } = useTheme();
  
  const isDarkMode = resolvedTheme === "dark";
  
  let logoUrl = defaultLogoUrl;
  if (isDarkMode && settings.platform_logo_dark_url) {
    logoUrl = settings.platform_logo_dark_url;
  } else if (!isDarkMode && settings.platform_logo_url) {
    logoUrl = settings.platform_logo_url;
  } else if (settings.platform_logo_url) {
    logoUrl = settings.platform_logo_url;
  }
  
  const platformName = settings.platform_name || "Meetdup";
  
  return (
    <img 
      src={logoUrl} 
      alt={platformName} 
      className={`${config.logo} w-auto object-contain ${className}`}
    />
  );
}

export { defaultLogoUrl as meetdupLogoUrl };
export default MeetdupLogo;
