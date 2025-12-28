import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";

interface PlatformSettings {
  platform_logo_url: string | null;
  platform_logo_dark_url: string | null;
  platform_name: string;
}

interface PlatformSettingsContextType {
  settings: PlatformSettings;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const defaultSettings: PlatformSettings = {
  platform_logo_url: null,
  platform_logo_dark_url: null,
  platform_name: "Meetdup",
};

const PlatformSettingsContext = createContext<PlatformSettingsContextType>({
  settings: defaultSettings,
  isLoading: true,
  refetch: async () => {},
});

export function PlatformSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PlatformSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/system-settings/platform/public");
      if (response.ok) {
        const data = await response.json();
        setSettings({
          platform_logo_url: data.platform_logo_url || null,
          platform_logo_dark_url: data.platform_logo_dark_url || null,
          platform_name: data.platform_name || "Meetdup",
        });
      }
    } catch (error) {
      console.warn("[PlatformSettings] Failed to fetch settings, using defaults");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    await fetchSettings();
  }, [fetchSettings]);

  return (
    <PlatformSettingsContext.Provider value={{ settings, isLoading, refetch }}>
      {children}
    </PlatformSettingsContext.Provider>
  );
}

export function usePlatformSettings() {
  return useContext(PlatformSettingsContext);
}

export { PlatformSettingsContext };
