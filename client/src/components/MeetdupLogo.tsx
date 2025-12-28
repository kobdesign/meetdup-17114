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
  
  // Determine which logo to use based on variant prop
  // variant="light" = light text on dark background → use dark logo
  // variant="dark" = dark text on light background → use light logo
  // variant="default" = use system theme to decide
  let logoUrl = defaultLogoUrl;
  
  if (variant === "light") {
    // On dark background, use dark logo (light-colored logo for dark bg)
    logoUrl = settings.platform_logo_dark_url || settings.platform_logo_url || defaultLogoUrl;
  } else if (variant === "dark") {
    // On light background, use light logo (dark-colored logo for light bg)
    logoUrl = settings.platform_logo_url || defaultLogoUrl;
  } else {
    // Default: use system theme
    if (isDarkMode && settings.platform_logo_dark_url) {
      logoUrl = settings.platform_logo_dark_url;
    } else if (settings.platform_logo_url) {
      logoUrl = settings.platform_logo_url;
    }
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
  variant = "default",
  className = "" 
}: Pick<MeetdupLogoProps, "size" | "variant" | "className">) {
  const config = sizeConfig[size];
  const { settings } = usePlatformSettings();
  const { resolvedTheme } = useTheme();
  
  const isDarkMode = resolvedTheme === "dark";
  
  let logoUrl = defaultLogoUrl;
  
  if (variant === "light") {
    logoUrl = settings.platform_logo_dark_url || settings.platform_logo_url || defaultLogoUrl;
  } else if (variant === "dark") {
    logoUrl = settings.platform_logo_url || defaultLogoUrl;
  } else {
    if (isDarkMode && settings.platform_logo_dark_url) {
      logoUrl = settings.platform_logo_dark_url;
    } else if (settings.platform_logo_url) {
      logoUrl = settings.platform_logo_url;
    }
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
