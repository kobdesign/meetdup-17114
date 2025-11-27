import { useState, useEffect, useCallback } from "react";
import liff from "@line/liff";

interface LiffConfig {
  liff_id: string | null;
  liff_enabled: boolean;
}

interface UseLiffReturn {
  isLiffReady: boolean;
  isInLiff: boolean;
  isLoggedIn: boolean;
  liffError: string | null;
  profile: {
    userId: string;
    displayName: string;
    pictureUrl?: string;
  } | null;
  shareTargetPicker: (messages: any[]) => Promise<void>;
  closeWindow: () => void;
}

export function useLiff(): UseLiffReturn {
  const [isLiffReady, setIsLiffReady] = useState(false);
  const [isInLiff, setIsInLiff] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [liffError, setLiffError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UseLiffReturn["profile"]>(null);
  const [liffConfig, setLiffConfig] = useState<LiffConfig | null>(null);

  useEffect(() => {
    const initLiff = async () => {
      try {
        const response = await fetch("/api/public/liff-config");
        const config: LiffConfig = await response.json();
        setLiffConfig(config);

        if (!config.liff_enabled || !config.liff_id) {
          console.log("[LIFF] LIFF is not enabled or no LIFF ID configured");
          setIsLiffReady(true);
          return;
        }

        console.log("[LIFF] Initializing with ID:", config.liff_id);

        await liff.init({ liffId: config.liff_id });
        
        setIsLiffReady(true);
        setIsInLiff(liff.isInClient());
        setIsLoggedIn(liff.isLoggedIn());

        console.log("[LIFF] Initialized successfully", {
          isInClient: liff.isInClient(),
          isLoggedIn: liff.isLoggedIn()
        });

        if (liff.isLoggedIn()) {
          try {
            const userProfile = await liff.getProfile();
            setProfile({
              userId: userProfile.userId,
              displayName: userProfile.displayName,
              pictureUrl: userProfile.pictureUrl
            });
          } catch (profileError) {
            console.error("[LIFF] Error getting profile:", profileError);
          }
        }
      } catch (error: any) {
        console.error("[LIFF] Initialization error:", error);
        setLiffError(error.message || "Failed to initialize LIFF");
        setIsLiffReady(true);
      }
    };

    initLiff();
  }, []);

  const shareTargetPicker = useCallback(async (messages: any[]) => {
    if (!liffConfig?.liff_enabled || !liffConfig?.liff_id) {
      console.log("[LIFF] Share not available - LIFF not configured");
      throw new Error("LIFF is not configured");
    }

    if (!liff.isApiAvailable("shareTargetPicker")) {
      console.log("[LIFF] shareTargetPicker API not available");
      throw new Error("Share feature is not available in this context");
    }

    try {
      const result = await liff.shareTargetPicker(messages);
      
      if (result) {
        console.log("[LIFF] Share successful");
      } else {
        console.log("[LIFF] Share cancelled by user");
      }
    } catch (error: any) {
      console.error("[LIFF] Share error:", error);
      throw error;
    }
  }, [liffConfig]);

  const closeWindow = useCallback(() => {
    if (liff.isInClient()) {
      liff.closeWindow();
    } else {
      window.close();
    }
  }, []);

  return {
    isLiffReady,
    isInLiff,
    isLoggedIn,
    liffError,
    profile,
    shareTargetPicker,
    closeWindow
  };
}

export function generateFlexMessage(member: any, category: any): any {
  const baseUrl = window.location.origin;
  const cardUrl = `${baseUrl}/liff/card/${member.participant_id}?tenant=${member.tenant_id}`;
  
  return {
    type: "flex",
    altText: `นามบัตร - ${member.full_name}`,
    contents: {
      type: "bubble",
      hero: member.photo_url ? {
        type: "image",
        url: member.photo_url,
        size: "full",
        aspectRatio: "1:1",
        aspectMode: "cover"
      } : undefined,
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: member.full_name,
            weight: "bold",
            size: "xl",
            wrap: true
          },
          member.nickname ? {
            type: "text",
            text: `(${member.nickname})`,
            size: "sm",
            color: "#888888"
          } : null,
          {
            type: "box",
            layout: "vertical",
            margin: "lg",
            spacing: "sm",
            contents: [
              member.position ? {
                type: "text",
                text: member.position,
                size: "sm",
                color: "#666666",
                wrap: true
              } : null,
              member.company ? {
                type: "text",
                text: member.company,
                size: "sm",
                color: "#666666",
                wrap: true
              } : null,
              category ? {
                type: "text",
                text: category.name_th,
                size: "xs",
                color: "#1DB446",
                margin: "md"
              } : null
            ].filter(Boolean)
          },
          member.tagline ? {
            type: "text",
            text: `"${member.tagline}"`,
            size: "xs",
            color: "#999999",
            margin: "lg",
            wrap: true,
            style: "italic"
          } : null
        ].filter(Boolean)
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            action: {
              type: "uri",
              label: "ดูนามบัตรเต็ม",
              uri: cardUrl
            },
            style: "primary",
            color: "#1DB446"
          },
          member.phone ? {
            type: "button",
            action: {
              type: "uri",
              label: "โทร",
              uri: `tel:${member.phone}`
            },
            style: "secondary"
          } : null
        ].filter(Boolean)
      }
    }
  };
}
