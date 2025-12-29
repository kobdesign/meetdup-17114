import { usePlatformSettings } from "@/contexts/PlatformSettingsContext";
import { useTheme } from "next-themes";

interface MeetdupLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  variant?: "default" | "light" | "dark";
  className?: string;
}

const sizeConfig = {
  sm: { logo: "h-8", text: "text-base", textLogo: "text-lg" },
  md: { logo: "h-10", text: "text-lg", textLogo: "text-xl" },
  lg: { logo: "h-14", text: "text-xl", textLogo: "text-2xl" },
  xl: { logo: "h-20", text: "text-2xl", textLogo: "text-3xl" },
};

function TextLogo({ size, textColor, platformName }: { size: keyof typeof sizeConfig; textColor: string; platformName: string }) {
  const config = sizeConfig[size];
  return (
    <span className={`font-bold ${config.textLogo} ${textColor}`}>
      {platformName}
    </span>
  );
}

export function MeetdupLogo({ 
  size = "md", 
  showText = false,
  variant = "default",
  className = "" 
}: MeetdupLogoProps) {
  const config = sizeConfig[size];
  const { settings, isLoading } = usePlatformSettings();
  const { resolvedTheme } = useTheme();
  
  const isDarkMode = resolvedTheme === "dark";
  const platformName = settings.platform_name || "Meetdup";
  
  const textColor = variant === "light" 
    ? "text-white" 
    : variant === "dark" 
      ? "text-foreground" 
      : "text-foreground";
  
  // Determine which logo to use based on variant prop
  let logoUrl: string | null = null;
  
  if (variant === "light") {
    logoUrl = settings.platform_logo_dark_url || settings.platform_logo_url || null;
  } else if (variant === "dark") {
    logoUrl = settings.platform_logo_url || null;
  } else {
    if (isDarkMode && settings.platform_logo_dark_url) {
      logoUrl = settings.platform_logo_dark_url;
    } else if (settings.platform_logo_url) {
      logoUrl = settings.platform_logo_url;
    }
  }
  
  // Show text-based logo if no image URL available or still loading
  if (isLoading || !logoUrl) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <TextLogo size={size} textColor={textColor} platformName={platformName} />
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img 
        src={logoUrl} 
        alt={platformName} 
        className={`${config.logo} w-auto object-contain`}
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
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
  const { settings, isLoading } = usePlatformSettings();
  const { resolvedTheme } = useTheme();
  
  const isDarkMode = resolvedTheme === "dark";
  const platformName = settings.platform_name || "Meetdup";
  
  const textColor = variant === "light" 
    ? "text-white" 
    : "text-foreground";
  
  let logoUrl: string | null = null;
  
  if (variant === "light") {
    logoUrl = settings.platform_logo_dark_url || settings.platform_logo_url || null;
  } else if (variant === "dark") {
    logoUrl = settings.platform_logo_url || null;
  } else {
    if (isDarkMode && settings.platform_logo_dark_url) {
      logoUrl = settings.platform_logo_dark_url;
    } else if (settings.platform_logo_url) {
      logoUrl = settings.platform_logo_url;
    }
  }
  
  // Show text-based logo if no image URL available or still loading
  if (isLoading || !logoUrl) {
    return (
      <span className={`font-bold ${config.textLogo} ${textColor} ${className}`}>
        {platformName}
      </span>
    );
  }
  
  return (
    <img 
      src={logoUrl} 
      alt={platformName} 
      className={`${config.logo} w-auto object-contain ${className}`}
      onError={(e) => {
        e.currentTarget.style.display = 'none';
      }}
    />
  );
}

export default MeetdupLogo;
