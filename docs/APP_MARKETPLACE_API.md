# Meetdup App Marketplace - API Documentation

## Overview

This document describes the APIs available for the Meetdup App Marketplace system.

---

## Base URL

```
Development: https://your-repl.replit.app
Production: https://app.meetdup.app
```

---

## Authentication

### Public APIs
No authentication required. Available to anyone.

### Protected APIs
Require valid session or LINE authentication.

### Admin APIs
Require Chapter Admin or Super Admin role.

---

## Apps Registry APIs

### List All Active Apps

Get all apps available in the global registry.

```http
GET /api/apps
```

**Response:**
```json
[
  {
    "app_id": "boq-estimator",
    "name": "BOQ Estimator",
    "description": "ประเมินราคางานก่อสร้างเบื้องต้น",
    "icon": "calculator",
    "route": "/apps/boq-estimator",
    "category": "construction",
    "is_active": true,
    "created_at": "2024-12-01T00:00:00Z"
  }
]
```

---

### Get Chapter Apps with Status

Get all apps with their enabled status for a specific chapter.

```http
GET /api/apps/chapter/:tenantId
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| tenantId | UUID | Chapter ID |

**Response:**
```json
[
  {
    "app_id": "boq-estimator",
    "name": "BOQ Estimator",
    "description": "ประเมินราคางานก่อสร้างเบื้องต้น",
    "icon": "calculator",
    "route": "/apps/boq-estimator",
    "category": "construction",
    "is_enabled": true,
    "enabled_at": "2024-12-15T10:30:00Z",
    "enabled_by": "admin-user-id"
  }
]
```

---

### Get Enabled Apps for Chapter

Get only apps that are enabled for members to use.

```http
GET /api/apps/chapter/:tenantId/enabled
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| tenantId | UUID | Chapter ID |

**Response:**
```json
[
  {
    "app_id": "boq-estimator",
    "name": "BOQ Estimator",
    "description": "ประเมินราคางานก่อสร้างเบื้องต้น",
    "icon": "calculator",
    "route": "/apps/boq-estimator"
  }
]
```

---

### Enable App for Chapter

Enable an app for a specific chapter. **Requires Admin role.**

```http
POST /api/apps/chapter/:tenantId/:appId/enable
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| tenantId | UUID | Chapter ID |
| appId | string | App identifier |

**Headers:**
```
Authorization: Bearer <session_token>
```

**Response:**
```json
{
  "success": true,
  "message": "App enabled successfully",
  "data": {
    "tenant_id": "uuid",
    "app_id": "boq-estimator",
    "is_enabled": true,
    "enabled_at": "2024-12-22T10:00:00Z"
  }
}
```

---

### Disable App for Chapter

Disable an app for a specific chapter. **Requires Admin role.**

```http
POST /api/apps/chapter/:tenantId/:appId/disable
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| tenantId | UUID | Chapter ID |
| appId | string | App identifier |

**Headers:**
```
Authorization: Bearer <session_token>
```

**Response:**
```json
{
  "success": true,
  "message": "App disabled successfully"
}
```

---

## Member Verification APIs

### Verify LINE Member

Verify if a LINE user is a member of a specific chapter.

```http
GET /api/public/verify-line-member
```

**Query Parameters:**
| Name | Type | Description |
|------|------|-------------|
| lineUserId | string | LINE User ID |
| tenantId | UUID | Chapter ID |

**Response (Member found):**
```json
{
  "isMember": true,
  "isAdmin": false,
  "participant": {
    "participant_id": "uuid",
    "full_name_th": "สมชาย ใจดี",
    "nickname_th": "ชาย",
    "tenant_id": "uuid",
    "phone": "0812345678",
    "company_name": "บริษัท ตัวอย่าง จำกัด",
    "business_category_code": "IT"
  },
  "tenant": {
    "tenant_id": "uuid",
    "name": "Chapter Bangkok Central",
    "slug": "bangkok-central"
  }
}
```

**Response (Not a member):**
```json
{
  "isMember": false,
  "isAdmin": false,
  "participant": null,
  "tenant": {
    "tenant_id": "uuid",
    "name": "Chapter Bangkok Central"
  }
}
```

---

## LIFF Configuration APIs

### Get LIFF Apps Configuration

Get LIFF ID for the Apps LIFF endpoint.

```http
GET /api/liff-config/apps
```

**Response:**
```json
{
  "liffId": "1234567890-abcdefgh",
  "endpoint": "/liff/apps"
}
```

---

## LINE Bot Integration

### Apps Command Handler

When a member types "apps" or "แอป" in LINE chat:

**Webhook Event:**
```json
{
  "type": "message",
  "message": {
    "type": "text",
    "text": "apps"
  },
  "source": {
    "userId": "Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "type": "user"
  }
}
```

**Bot Response (Flex Message Carousel):**
```json
{
  "type": "flex",
  "altText": "Chapter Apps",
  "contents": {
    "type": "carousel",
    "contents": [
      {
        "type": "bubble",
        "body": {
          "type": "box",
          "layout": "vertical",
          "contents": [
            {
              "type": "text",
              "text": "BOQ Estimator",
              "weight": "bold",
              "size": "lg"
            },
            {
              "type": "text",
              "text": "ประเมินราคางานก่อสร้าง",
              "size": "sm",
              "color": "#666666"
            }
          ]
        },
        "footer": {
          "type": "box",
          "layout": "vertical",
          "contents": [
            {
              "type": "button",
              "action": {
                "type": "uri",
                "label": "เปิดแอป",
                "uri": "https://liff.line.me/xxx-xxx/apps/boq-estimator?tenant=uuid"
              },
              "style": "primary"
            }
          ]
        }
      }
    ]
  }
}
```

---

## Database Schema

### apps Table

> **Note:** Current implementation uses in-code app registry. Database tables below are the target schema for Phase 3.

```sql
-- Target Schema (Phase 3)
CREATE TABLE apps (
  app_id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  route VARCHAR(100) NOT NULL,
  category VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Current Implementation:** Apps are defined in `LiffAppShell.tsx` as static configuration objects.

### chapter_apps Table

```sql
CREATE TABLE chapter_apps (
  id SERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  app_id VARCHAR(50) NOT NULL REFERENCES apps(app_id),
  is_enabled BOOLEAN DEFAULT false,
  enabled_at TIMESTAMP,
  enabled_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, app_id)
);
```

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `APP_NOT_FOUND` | 404 | App does not exist |
| `TENANT_NOT_FOUND` | 404 | Chapter does not exist |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `ALREADY_ENABLED` | 400 | App is already enabled |
| `ALREADY_DISABLED` | 400 | App is already disabled |

**Error Response Format:**
```json
{
  "error": true,
  "code": "APP_NOT_FOUND",
  "message": "The requested app does not exist"
}
```

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| Public APIs | 100 requests/minute |
| Protected APIs | 200 requests/minute |
| Admin APIs | 50 requests/minute |

---

## Webhooks (Future)

For app developers who need real-time notifications:

### App Enabled Webhook
```json
{
  "event": "app.enabled",
  "app_id": "your-app",
  "tenant_id": "uuid",
  "enabled_by": "admin-user-id",
  "timestamp": "2024-12-22T10:00:00Z"
}
```

### App Disabled Webhook
```json
{
  "event": "app.disabled",
  "app_id": "your-app",
  "tenant_id": "uuid",
  "disabled_by": "admin-user-id",
  "timestamp": "2024-12-22T10:00:00Z"
}
```

---

## SDK (Coming Soon)

We're developing an SDK to make app development easier:

```typescript
import { MeetdupAppSDK } from '@meetdup/app-sdk';

const sdk = new MeetdupAppSDK({
  appId: 'your-app',
  apiKey: 'your-api-key'
});

// Get current user context
const context = await sdk.getContext();
console.log(context.tenantId, context.participantId);

// Save app data
await sdk.saveData({ key: 'value' });

// Get app data
const data = await sdk.getData();

// Track analytics
sdk.track('button_clicked', { button: 'calculate' });
```

---

## Changelog

### v1.0.0 (December 2024)
- Initial API release
- Apps registry endpoints
- Chapter enable/disable endpoints
- Member verification endpoint
- LINE Bot integration

---

*Last updated: December 2024*
