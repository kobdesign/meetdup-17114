# LIFF Business Card Share - Technical Documentation

## Overview

This document describes the implementation of LINE LIFF (LINE Front-end Framework) v2 feature that allows users to share their business card as a Flex Message using the Share Target Picker.

## System Requirements

| Requirement | Version/Specification |
|-------------|----------------------|
| LIFF SDK | v2.x |
| LINE App | >= 10.3.0 |
| Browser Support | LINE in-app browser + External browsers |
| Message Type | Flex Message only |
| Max Bubbles | 5 per shared message |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         LIFF Share Flow                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────┐    ┌─────────────┐    ┌──────────────┐    ┌─────────┐ │
│  │ User    │───▶│ LIFF Page   │───▶│ Share Target │───▶│ LINE    │ │
│  │ Clicks  │    │ (React)     │    │ Picker       │    │ Friends │ │
│  │ Share   │    │             │    │ (Native)     │    │         │ │
│  └─────────┘    └──────┬──────┘    └──────────────┘    └─────────┘ │
│                        │                                            │
│                        ▼                                            │
│               ┌────────────────┐                                    │
│               │ Backend API    │                                    │
│               │ /share-flex    │                                    │
│               └────────────────┘                                    │
│                        │                                            │
│                        ▼                                            │
│               ┌────────────────┐                                    │
│               │ Flex Message   │                                    │
│               │ Template       │                                    │
│               └────────────────┘                                    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Sequence Flow

```
User                    LIFF App                  Backend                LINE
 │                         │                         │                     │
 │  1. Open Share Link     │                         │                     │
 │─────────────────────────▶                         │                     │
 │                         │                         │                     │
 │                         │  2. liff.init()         │                     │
 │                         │─────────────────────────▶                     │
 │                         │                         │                     │
 │                         │  3. Check isLoggedIn()  │                     │
 │                         │◀─────────────────────────                     │
 │                         │                         │                     │
 │                         │  4. liff.login() (if needed)                  │
 │                         │────────────────────────────────────────────────▶
 │                         │                         │                     │
 │                         │  5. GET /api/public/share-flex/:id            │
 │                         │─────────────────────────▶                     │
 │                         │                         │                     │
 │                         │  6. Return Flex Message │                     │
 │                         │◀─────────────────────────                     │
 │                         │                         │                     │
 │                         │  7. shareTargetPicker() │                     │
 │                         │────────────────────────────────────────────────▶
 │                         │                         │                     │
 │  8. Select Recipients   │                         │                     │
 │◀─────────────────────────────────────────────────────────────────────────
 │                         │                         │                     │
 │                         │  9. Share Success/Cancel                      │
 │                         │◀────────────────────────────────────────────────
 │                         │                         │                     │
 │  10. Show Result        │                         │                     │
 │◀─────────────────────────                         │                     │
```

## File Structure

```
client/src/
├── hooks/
│   └── useLiff.ts              # LIFF hook with init, login, share
├── pages/
│   └── liff/
│       ├── LiffCards.tsx       # Entry point with liff.state handling
│       └── LiffShareCard.tsx   # Share card UI component
└── App.tsx                     # Route: /liff/share/:tenantId/:participantId

server/
├── routes/
│   └── public.ts               # GET /api/public/share-flex/:participantId
├── services/
│   └── line/
│       ├── templates/
│       │   └── businessCard.ts # Flex Message template generator
│       └── urlValidator.ts     # URL sanitization utilities
└── utils/
    └── liffConfig.ts           # LIFF ID configuration
```

---

## 1. Complete Working Source Code

### 1.1 LIFF Hook (client/src/hooks/useLiff.ts)

```typescript
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
  needsLogin: boolean;
  canShare: boolean;
  liffError: string | null;
  profile: {
    userId: string;
    displayName: string;
    pictureUrl?: string;
  } | null;
  login: () => void;
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
        // Fetch LIFF config from backend
        const response = await fetch("/api/public/liff-config");
        const config: LiffConfig = await response.json();
        setLiffConfig(config);

        if (!config.liff_enabled || !config.liff_id) {
          console.log("[LIFF] LIFF is not enabled or no LIFF ID configured");
          setIsLiffReady(true);
          return;
        }

        console.log("[LIFF] Initializing with ID:", config.liff_id);

        // Initialize LIFF SDK
        await liff.init({ liffId: config.liff_id });
        
        setIsLiffReady(true);
        setIsInLiff(liff.isInClient());
        setIsLoggedIn(liff.isLoggedIn());

        console.log("[LIFF] Initialized successfully", {
          isInClient: liff.isInClient(),
          isLoggedIn: liff.isLoggedIn()
        });

        // Get user profile if logged in
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

  // Check if user needs to login (External browser only)
  const needsLogin = isLiffReady && !isInLiff && !isLoggedIn && liffConfig?.liff_enabled === true;

  // Check if shareTargetPicker API is available
  const canShare = isLiffReady && isLoggedIn && liffConfig?.liff_enabled === true && 
    (typeof liff !== 'undefined' && liff.isApiAvailable?.('shareTargetPicker'));

  // Login function for External browser
  const login = useCallback(() => {
    if (!liffConfig?.liff_enabled || !liffConfig?.liff_id) {
      console.log("[LIFF] Cannot login - LIFF not configured");
      return;
    }

    console.log("[LIFF] Calling liff.login() for External browser");
    liff.login({ redirectUri: window.location.href });
  }, [liffConfig]);

  // Share Target Picker wrapper
  const shareTargetPicker = useCallback(async (messages: any[]) => {
    if (!liffConfig?.liff_enabled || !liffConfig?.liff_id) {
      throw new Error("LIFF is not configured");
    }

    if (!liff.isApiAvailable("shareTargetPicker")) {
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

  // Close LIFF window
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
    needsLogin,
    canShare,
    liffError,
    profile,
    login,
    shareTargetPicker,
    closeWindow
  };
}
```

### 1.2 Share Card Component (client/src/pages/liff/LiffShareCard.tsx)

```tsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, Share2, CheckCircle2, XCircle, AlertCircle, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLiff } from "@/hooks/useLiff";

type ShareStatus = "loading" | "ready" | "sharing" | "success" | "cancelled" | "error" | "not-in-liff" | "missing-tenant" | "needs-login";

export default function LiffShareCard() {
  const { tenantId, participantId } = useParams<{ tenantId: string; participantId: string }>();
  
  const { isLiffReady, isInLiff, isLoggedIn, needsLogin, canShare, login, shareTargetPicker, closeWindow, liffError } = useLiff();
  
  const [status, setStatus] = useState<ShareStatus>("loading");
  const [memberName, setMemberName] = useState<string>("");
  const [flexMessage, setFlexMessage] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Fetch Flex Message from API
  useEffect(() => {
    if (!participantId || !tenantId) {
      setStatus(!participantId ? "error" : "missing-tenant");
      setErrorMessage(!participantId ? "Missing participant ID" : "Missing tenant ID");
      return;
    }

    const fetchFlexMessage = async () => {
      try {
        const url = `/api/public/share-flex/${participantId}?tenantId=${tenantId}`;
        const response = await fetch(url);
        
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || `HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.flexMessage) {
          setFlexMessage(data.flexMessage);
          setMemberName(data.memberName || "Member");
          setStatus("ready");
        } else {
          throw new Error(data.error || "Failed to load business card");
        }
      } catch (err: any) {
        console.error("[LiffShareCard] Error fetching flex message:", err);
        setStatus("error");
        setErrorMessage(err.message || "Error loading data");
      }
    };

    fetchFlexMessage();
  }, [participantId, tenantId]);

  // Auto-share when ready
  useEffect(() => {
    if (status !== "ready" || !isLiffReady || !flexMessage) return;

    if (needsLogin) {
      setStatus("needs-login");
      return;
    }

    if (!canShare) {
      setStatus(isLoggedIn ? "not-in-liff" : "needs-login");
      return;
    }

    const autoShare = async () => {
      setStatus("sharing");
      
      try {
        await shareTargetPicker([flexMessage]);
        setStatus("success");
        
        setTimeout(() => {
          closeWindow();
        }, 1500);
      } catch (err: any) {
        if (err.message?.includes("cancel")) {
          setStatus("cancelled");
        } else {
          setStatus("error");
          setErrorMessage(err.message || "Cannot share");
        }
      }
    };

    autoShare();
  }, [status, isLiffReady, needsLogin, canShare, flexMessage]);

  const handleRetry = async () => {
    if (!flexMessage) return;
    
    setStatus("sharing");
    
    try {
      await shareTargetPicker([flexMessage]);
      setStatus("success");
      setTimeout(() => closeWindow(), 1500);
    } catch (err: any) {
      if (err.message?.includes("cancel")) {
        setStatus("cancelled");
      } else {
        setStatus("error");
        setErrorMessage(err.message || "Cannot share");
      }
    }
  };

  // UI rendering based on status...
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background flex items-center justify-center p-4">
      {/* Status-based UI components */}
    </div>
  );
}
```

### 1.3 Backend API (server/routes/public.ts)

```typescript
router.get("/share-flex/:participantId", async (req: Request, res: Response) => {
  try {
    const { participantId } = req.params;
    const tenantId = req.query.tenantId as string;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // Validation
    if (!participantId || !uuidRegex.test(participantId)) {
      return res.status(400).json({ success: false, error: "Invalid participantId" });
    }

    if (!tenantId || !uuidRegex.test(tenantId)) {
      return res.status(400).json({ success: false, error: "Invalid tenantId" });
    }

    // Fetch participant with tenant isolation
    const { data: member, error } = await supabaseAdmin
      .from("participants")
      .select(`
        participant_id, tenant_id, full_name_th, nickname_th,
        company, position, tagline, photo_url, company_logo_url,
        phone, email, website_url, facebook_url, instagram_url,
        linkedin_url, line_id, business_address, tags, onepage_url
      `)
      .eq("participant_id", participantId)
      .eq("tenant_id", tenantId)
      .single();

    if (error || !member) {
      return res.status(404).json({ success: false, error: "Member not found" });
    }

    // Build card data
    const cardData: BusinessCardData = {
      participant_id: member.participant_id,
      tenant_id: member.tenant_id,
      full_name_th: member.full_name_th,
      nickname_th: member.nickname_th,
      position: member.position,
      company: member.company,
      tagline: member.tagline,
      photo_url: member.photo_url,
      company_logo_url: member.company_logo_url,
      email: member.email,
      phone: member.phone,
      website_url: member.website_url,
      facebook_url: member.facebook_url,
      instagram_url: member.instagram_url,
      linkedin_url: member.linkedin_url,
      business_address: member.business_address,
      line_id: member.line_id,
      tags: member.tags,
      onepage_url: member.onepage_url
    };

    const baseUrl = getProductionBaseUrl();
    const flexMessage = createBusinessCardFlexMessage(cardData, baseUrl);

    return res.json({
      success: true,
      flexMessage,
      memberName: member.full_name_th
    });
  } catch (error: any) {
    console.error("[share-flex] Error:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});
```

---

## 2. Flex Message JSON Example

```json
{
  "type": "flex",
  "altText": "นามบัตร - สมชาย ใจดี",
  "contents": {
    "type": "bubble",
    "size": "giga",
    "header": {
      "type": "box",
      "layout": "horizontal",
      "contents": [
        {
          "type": "box",
          "layout": "vertical",
          "contents": [
            {
              "type": "image",
              "url": "https://example.com/photo.jpg",
              "size": "full",
              "aspectRatio": "1:1",
              "aspectMode": "cover"
            }
          ],
          "width": "80px",
          "height": "80px",
          "cornerRadius": "40px",
          "borderWidth": "3px",
          "borderColor": "#D4AF37"
        },
        {
          "type": "box",
          "layout": "vertical",
          "contents": [
            {
              "type": "text",
              "text": "สมชาย ใจดี",
              "weight": "bold",
              "size": "xl",
              "color": "#1F2937",
              "wrap": true
            },
            {
              "type": "text",
              "text": "\"ชาย\"",
              "size": "md",
              "color": "#D4AF37",
              "weight": "bold",
              "margin": "xs"
            },
            {
              "type": "text",
              "text": "CEO",
              "size": "sm",
              "color": "#4B5563",
              "margin": "sm"
            },
            {
              "type": "text",
              "text": "บริษัท ABC จำกัด",
              "size": "sm",
              "color": "#1E3A5F",
              "weight": "bold",
              "margin": "xs"
            }
          ],
          "flex": 1,
          "paddingStart": "16px",
          "justifyContent": "center"
        }
      ],
      "paddingAll": "20px",
      "backgroundColor": "#FFFFFF"
    },
    "body": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        {
          "type": "box",
          "layout": "vertical",
          "contents": [
            {
              "type": "text",
              "text": "\"ผู้เชี่ยวชาญด้านการตลาดดิจิทัล\"",
              "size": "sm",
              "color": "#4B5563",
              "wrap": true,
              "style": "italic"
            }
          ],
          "backgroundColor": "#F1F5F9",
          "paddingAll": "12px",
          "cornerRadius": "8px",
          "margin": "lg"
        },
        {
          "type": "separator",
          "margin": "lg",
          "color": "#E2E8F0"
        },
        {
          "type": "box",
          "layout": "vertical",
          "contents": [
            {
              "type": "box",
              "layout": "horizontal",
              "contents": [
                {
                  "type": "box",
                  "layout": "vertical",
                  "contents": [
                    {
                      "type": "text",
                      "text": "TEL",
                      "size": "xxs",
                      "color": "#FFFFFF",
                      "align": "center"
                    }
                  ],
                  "backgroundColor": "#1E3A5F",
                  "width": "36px",
                  "height": "18px",
                  "cornerRadius": "4px",
                  "justifyContent": "center",
                  "alignItems": "center"
                },
                {
                  "type": "text",
                  "text": "081-234-5678",
                  "size": "sm",
                  "color": "#1F2937",
                  "margin": "md",
                  "flex": 1
                }
              ],
              "alignItems": "center"
            }
          ],
          "margin": "lg"
        }
      ],
      "paddingAll": "20px",
      "paddingTop": "0px"
    },
    "footer": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        {
          "type": "box",
          "layout": "horizontal",
          "contents": [
            {
              "type": "button",
              "action": {
                "type": "uri",
                "label": "โทร",
                "uri": "tel:0812345678"
              },
              "style": "primary",
              "color": "#1E3A5F",
              "height": "sm"
            },
            {
              "type": "button",
              "action": {
                "type": "uri",
                "label": "LINE",
                "uri": "https://line.me/R/ti/p/~somchai_jaidee"
              },
              "style": "primary",
              "color": "#06C755",
              "height": "sm"
            }
          ],
          "spacing": "sm"
        },
        {
          "type": "box",
          "layout": "horizontal",
          "contents": [
            {
              "type": "button",
              "action": {
                "type": "uri",
                "label": "Profile",
                "uri": "https://meetdup.com/p/abc-123"
              },
              "style": "secondary",
              "height": "sm"
            }
          ],
          "spacing": "sm",
          "margin": "sm"
        }
      ],
      "spacing": "none",
      "paddingAll": "16px",
      "backgroundColor": "#F8FAFC"
    },
    "styles": {
      "footer": {
        "separator": true,
        "separatorColor": "#E2E8F0"
      }
    }
  }
}
```

---

## 3. Error Handling

### 3.1 Status States

| Status | Description | User Action |
|--------|-------------|-------------|
| `loading` | Fetching Flex Message from API | Wait |
| `ready` | Flex Message loaded, preparing to share | Auto-proceed |
| `sharing` | Share Target Picker is open | Select recipients |
| `success` | Message shared successfully | Auto-close |
| `cancelled` | User cancelled the share | Retry or close |
| `error` | API or share failed | Retry or close |
| `needs-login` | External browser, not logged in | Login button |
| `not-in-liff` | Cannot share (not in LINE app) | Copy link fallback |
| `missing-tenant` | Tenant ID not provided | Error message |

### 3.2 Error Scenarios

```typescript
// 1. LIFF not configured
if (!config.liff_enabled || !config.liff_id) {
  // Show error, provide fallback
}

// 2. API not available (External browser without login)
if (!liff.isApiAvailable("shareTargetPicker")) {
  // Show login button or copy link option
}

// 3. User cancels share
if (err.message?.includes("cancel")) {
  setStatus("cancelled");
  // Show retry button
}

// 4. Network/API error
setStatus("error");
setErrorMessage(err.message);
// Show retry and close buttons
```

---

## 4. Security Considerations

### 4.1 Input Validation

```typescript
// UUID format validation for all IDs
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

if (!uuidRegex.test(participantId)) {
  return res.status(400).json({ error: "Invalid participantId format" });
}

if (!uuidRegex.test(tenantId)) {
  return res.status(400).json({ error: "Invalid tenantId format" });
}
```

### 4.2 Tenant Isolation

```typescript
// Always require tenantId and verify membership
const { data: member } = await supabaseAdmin
  .from("participants")
  .select("*")
  .eq("participant_id", participantId)
  .eq("tenant_id", tenantId)  // Tenant isolation
  .single();
```

### 4.3 URL Sanitization

```typescript
// All URLs are sanitized before use
import { sanitizeUrl, sanitizePhone, sanitizeEmail } from "../urlValidator";

const phoneUri = sanitizePhone(data.phone);      // Returns tel: URI or null
const emailUri = sanitizeEmail(data.email);      // Returns mailto: URI or null
const websiteUrl = sanitizeUrl(data.website_url); // Returns valid URL or null
```

### 4.4 LIFF Security

- LIFF ID stored server-side, fetched via API
- No sensitive data in URL parameters
- Profile data validated on server
- Access token not exposed to frontend

---

## 5. Production Deployment Checklist

### 5.1 LINE Developer Console

- [ ] Create LIFF app in LINE Developer Console
- [ ] Set LIFF Endpoint URL to production domain
- [ ] Enable "shareTargetPicker" in LIFF scopes
- [ ] Configure LIFF to allow external browser access (if needed)
- [ ] Set correct Redirect URI for OAuth

### 5.2 Environment Configuration

```bash
# Production environment variables
LIFF_ID=1234567890-abcdefgh  # From LINE Developer Console
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
```

### 5.3 Database Setup

```sql
-- Store LIFF ID in system_settings
INSERT INTO system_settings (key, value, description)
VALUES ('liff_id', '1234567890-abcdefgh', 'Production LIFF App ID');
```

### 5.4 DNS & SSL

- [ ] Production domain (e.g., meetdup.com) configured
- [ ] SSL certificate valid and installed
- [ ] LIFF requires HTTPS

### 5.5 Testing Checklist

- [ ] Share works in LINE app (iOS)
- [ ] Share works in LINE app (Android)
- [ ] Login flow works in external browser
- [ ] Error states display correctly
- [ ] Cancel behavior is handled
- [ ] Profile link fallback works
- [ ] Multiple language support (Thai/English)

### 5.6 Monitoring

- [ ] Error logging configured
- [ ] Analytics for share success/failure rates
- [ ] Alert on high error rates

---

## 6. Usage

### 6.1 URL Format

```
https://meetdup.com/liff/share/{tenantId}/{participantId}
```

### 6.2 LIFF State Format (for Rich Menu)

```
share:{tenantId}:{participantId}
```

### 6.3 Integration with Rich Menu

Configure Rich Menu action:
```json
{
  "type": "uri",
  "uri": "https://liff.line.me/{LIFF_ID}?liff.state=share%3A{tenantId}%3A{participantId}"
}
```

---

## 7. Troubleshooting

### Common Issues

1. **"Share feature is not available"**
   - User is in external browser and not logged in
   - Solution: Call `liff.login()` first

2. **"LIFF is not configured"**
   - LIFF ID not set in database
   - Solution: Check `system_settings.liff_id`

3. **"Member not found"**
   - Participant doesn't exist or wrong tenant
   - Solution: Verify participant_id and tenant_id

4. **Share button not appearing**
   - `shareTargetPicker` not available
   - Solution: Ensure LINE App version >= 10.3.0

---

## 8. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-11 | Initial implementation |
| 1.1.0 | 2024-12 | Added external browser login support |
| 1.2.0 | 2024-12 | Enhanced error handling and fallbacks |
