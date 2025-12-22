import { useState, useEffect, useCallback, useRef } from "react";
import {
  initializeLiff,
  getLiffState,
  subscribeLiffState,
  liffLogin,
  liffCloseWindow,
  liffShareTargetPicker,
  isShareApiAvailable,
} from "@/lib/liffManager";

interface ShareResult {
  success: boolean;
  cancelled: boolean;
}

interface UseLiffReturn {
  isLiffReady: boolean;
  isInLiff: boolean;
  isLoggedIn: boolean;
  needsLogin: boolean;
  canShare: boolean;
  liffError: string | null;
  profile: {
    userId: string;
    displayName: string;
    pictureUrl?: string;
  } | null;
  login: () => void;
  shareTargetPicker: (messages: any[]) => Promise<ShareResult>;
  closeWindow: () => void;
}

export function useLiff(): UseLiffReturn {
  const [state, setState] = useState(() => getLiffState());
  const initAttempted = useRef(false);

  useEffect(() => {
    const unsubscribe = subscribeLiffState(() => {
      setState(getLiffState());
    });

    if (!initAttempted.current) {
      initAttempted.current = true;
      initializeLiff("share", "/api/public/liff-config").then(() => {
        setState(getLiffState());
      });
    }

    return unsubscribe;
  }, []);

  const needsLogin =
    state.initialized &&
    !state.isInClient &&
    !state.isLoggedIn &&
    !!state.liffId;

  const canShare = isShareApiAvailable();

  const login = useCallback(() => {
    liffLogin();
  }, []);

  const shareTargetPicker = useCallback(
    async (messages: any[]): Promise<ShareResult> => {
      return liffShareTargetPicker(messages);
    },
    []
  );

  const closeWindow = useCallback(() => {
    liffCloseWindow();
  }, []);

  return {
    isLiffReady: state.initialized,
    isInLiff: state.isInClient,
    isLoggedIn: state.isLoggedIn,
    needsLogin,
    canShare,
    liffError: state.error,
    profile: state.profile,
    login,
    shareTargetPicker,
    closeWindow,
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
