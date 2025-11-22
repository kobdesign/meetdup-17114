# Rich Menu Configuration Guide

## Image Specifications
- **Dimensions**: 2500 × 843 pixels (half-height rich menu)
- **Format**: PNG or JPEG
- **Layout**: 3 equal columns (833 pixels each)

## Area Configuration JSON

```json
[
  {
    "bounds": { "x": 0, "y": 0, "width": 833, "height": 843 },
    "action": { 
      "type": "message", 
      "text": "ค้นหานามบัตร" 
    }
  },
  {
    "bounds": { "x": 833, "y": 0, "width": 834, "height": 843 },
    "action": { 
      "type": "message", 
      "text": "ขอลิงก์ใหม่" 
    }
  },
  {
    "bounds": { "x": 1667, "y": 0, "width": 833, "height": 843 },
    "action": { 
      "type": "message", 
      "text": "ข้อมูลเพิ่มเติม" 
    }
  }
]
```

## Button Actions

### 1. CARD (Business Card Search) - Left Column
- **Bounds**: x=0, y=0, width=833, height=843
- **Action Type**: message
- **Message Text**: "ค้นหานามบัตร"
- **Behavior**: 
  - Triggers business card search flow
  - System prompts user for keyword
  - Searches across: full_name, nickname, phone, company, notes, tags
  - Returns results as Flex Message cards

### 2. JOIN NOW (Activation) - Middle Column
- **Bounds**: x=833, y=0, width=834, height=843
- **Action Type**: message
- **Message Text**: "ขอลิงก์ใหม่"
- **Behavior**: 
  - Triggers LIFF activation link request
  - System checks if user has participant record
  - Sends LIFF activation link via LINE if no account yet
  - Shows status message if already activated

### 3. MORE (Information) - Right Column
- **Bounds**: x=1667, y=0, width=833, height=843
- **Action Type**: message
- **Message Text**: "ข้อมูลเพิ่มเติม"
- **Behavior**: 
  - Can show chapter information
  - Can link to web app
  - Can provide help/FAQ

## Alternative Configuration (With URI Action)

If you want the "MORE" button to open a webpage:

```json
{
  "bounds": { "x": 1667, "y": 0, "width": 833, "height": 843 },
  "action": { 
    "type": "uri", 
    "uri": "https://your-domain.com/info" 
  }
}
```

## Rich Menu Switching

You can create multiple Rich Menus and allow users to switch between them by using the `richmenuswitch` action type.

### Example: Main Menu with "More" Button

**Main Menu** (richmenu-main):
```json
[
  {
    "bounds": { "x": 0, "y": 0, "width": 833, "height": 843 },
    "action": { 
      "type": "message", 
      "text": "ค้นหานามบัตร" 
    }
  },
  {
    "bounds": { "x": 833, "y": 0, "width": 834, "height": 843 },
    "action": { 
      "type": "message", 
      "text": "ขอลิงก์ใหม่" 
    }
  },
  {
    "bounds": { "x": 1667, "y": 0, "width": 833, "height": 843 },
    "action": { 
      "type": "richmenuswitch",
      "richMenuAliasId": "richmenu-xxxxx-more",
      "data": "switch-to-more-menu"
    }
  }
]
```

**More Menu** (richmenu-more):
```json
[
  {
    "bounds": { "x": 0, "y": 0, "width": 833, "height": 843 },
    "action": { 
      "type": "uri", 
      "uri": "https://your-domain.com/events" 
    }
  },
  {
    "bounds": { "x": 833, "y": 0, "width": 834, "height": 843 },
    "action": { 
      "type": "message", 
      "text": "ติดต่อแอดมิน" 
    }
  },
  {
    "bounds": { "x": 1667, "y": 0, "width": 833, "height": 843 },
    "action": { 
      "type": "richmenuswitch",
      "richMenuAliasId": "richmenu-xxxxx-main",
      "data": "back-to-main-menu"
    }
  }
]
```

### How to Set Up Menu Switching:
1. Create Menu 1 (Main Menu) in the admin panel
2. Create Menu 2 (More Menu) in the admin panel
3. Copy the "LINE Rich Menu ID" from Menu 2's card
4. Edit Menu 1's area configuration and paste the ID into `richMenuAliasId` field
5. Repeat for Menu 2's "Back" button using Menu 1's ID

**Important Notes:**
- Despite the parameter name `richMenuAliasId`, LINE API accepts the actual Rich Menu ID directly
- No need to create Rich Menu Aliases unless you want named references for advanced use cases
- The `data` field is optional but helpful for tracking which button was pressed in your webhook

## Integration with Webhook

The webhook handler automatically processes these messages:

1. **"ค้นหานามบัตร"** → `handleCardSearch()` with empty search term → prompts for keyword
2. **"ขอลิงก์ใหม่"** → `resendActivationHandler()` → sends activation link
3. **"ข้อมูลเพิ่มเติม"** → Can be mapped to any custom handler

## User Journey

### Business Card Search Flow:
1. User taps "CARD" button
2. System: "🔍 ค้นหานามบัตร กรุณาพิมพ์คำค้นหา..."
3. User types keyword (e.g., "Microsoft")
4. System searches across all fields + tags
5. Returns matching business cards as Flex Messages

### Activation Flow:
1. User taps "JOIN NOW" button  
2. System checks participant record
3. If no account: generates & sends LIFF activation link
4. If already activated: shows status message

## Deployment Steps

1. Upload your 2500×843 rich menu image
2. Use the area configuration JSON above
3. Set chat bar text (max 14 chars)
4. Mark as "Set as default menu" to apply to all users
5. Rich menu will appear at bottom of LINE chat
