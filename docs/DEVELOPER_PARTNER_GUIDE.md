# Meetdup App Marketplace - Developer Partner Guide

## Overview

Welcome to the Meetdup App Marketplace! This guide will help you understand how to develop, submit, and distribute your apps to Business Networking Chapters across Thailand.

---

## Table of Contents

1. [Platform Overview](#platform-overview)
2. [Getting Started](#getting-started)
3. [App Architecture](#app-architecture)
4. [Development Guide](#development-guide)
5. [Submission Process](#submission-process)
6. [Revenue Model](#revenue-model)
7. [Support & Resources](#support--resources)

---

## Platform Overview

### What is Meetdup?

Meetdup is a multi-tenant SaaS platform for managing Business Networking Chapters (similar to BNI). Each chapter has:
- 10-60 members (business owners)
- Weekly meetings
- Referral tracking
- Visitor management

### What is the App Marketplace?

The App Marketplace allows third-party developers to create **micro-applications** that help chapter members in their daily business operations.

### Distribution Channels

| Channel | Description |
|---------|-------------|
| **LINE Bot** | Members type "apps" to see available apps as a carousel |
| **LIFF (LINE Front-end Framework)** | Apps run inside LINE app as web views |
| **Web Portal** | Members access via Profile > Apps Tab |
| **Admin Panel** | Chapter Admins enable/disable apps for their chapter |

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm/pnpm
- React 18+ experience
- TypeScript knowledge
- Understanding of Tailwind CSS (optional but recommended)

### Development Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite |
| UI Components | Shadcn/ui, Radix UI, Tailwind CSS |
| State Management | TanStack React Query |
| Forms | React Hook Form + Zod |
| Icons | Lucide React |

### App Types by Access Level

| Access Level | Who Can Use | LIFF Auth Required |
|--------------|-------------|-------------------|
| `public` | Anyone with link | No |
| `member` | Verified chapter members | Yes |
| `admin` | Chapter administrators only | Yes |

---

## App Architecture

### File Structure

```
client/src/pages/apps/
  YourApp.tsx           # Main app component

client/src/pages/liff/
  LiffAppShell.tsx      # App shell (handles routing & auth)
```

### App Component Interface

Every app receives these props:

```typescript
interface AppProps {
  isLiff: boolean;              // true if running in LINE app
  tenantId: string | null;      // Chapter ID (UUID)
  participantId?: string;       // Member ID (if authenticated)
}

export default function YourApp({ isLiff, tenantId, participantId }: AppProps) {
  return (
    <div className="p-4">
      {/* Your app content */}
    </div>
  );
}
```

### Registration in LiffAppShell

Apps must be registered in `LiffAppShell.tsx`:

```typescript
// 1. Lazy load your component
const appComponents = {
  "your-app": lazy(() => import("@/pages/apps/YourApp")),
};

// 2. Define app configuration
const appConfigs = {
  "your-app": {
    app_id: "your-app",
    name: "Your App Name",
    description: "Brief description in Thai",
    route: "/apps/your-app",
    access_level: "public",  // or "member" or "admin"
    component: "your-app",
  },
};
```

---

## Development Guide

### Step 1: Clone the Starter Template

```bash
# Create your app file
touch client/src/pages/apps/MyNewApp.tsx
```

### Step 2: Implement Your App

```typescript
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface MyNewAppProps {
  isLiff: boolean;
  tenantId: string | null;
  participantId?: string;
}

export default function MyNewApp({ isLiff, tenantId, participantId }: MyNewAppProps) {
  const [result, setResult] = useState<string>("");

  const handleCalculate = () => {
    // Your logic here
    setResult("Calculation complete!");
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
          {/* Your icon */}
        </div>
        <div>
          <h1 className="text-2xl font-bold">My New App</h1>
          <p className="text-muted-foreground">App description</p>
        </div>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle>Input Section</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="Enter value..." />
          <Button onClick={handleCalculate} data-testid="button-calculate">
            Calculate
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <Card>
          <CardContent className="pt-6">
            <p>{result}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

### Step 3: Use Available UI Components

We provide Shadcn/ui components. Common ones:

```typescript
// Layout
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";

// Forms
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

// Feedback
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

// Data Display
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Icons (Lucide)
import { Plus, Trash2, Download, Search, Settings } from "lucide-react";
```

### Step 4: Add Data-TestID for Testing

Every interactive element should have `data-testid`:

```typescript
<Button data-testid="button-submit">Submit</Button>
<Input data-testid="input-email" />
<Card data-testid="card-result-1">...</Card>
```

### Step 5: Export/Share Features (Optional)

For apps that generate reports:

```typescript
import * as XLSX from "xlsx";

const exportToExcel = (data: any[], filename: string) => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, `${filename}.xlsx`);
};
```

---

## Submission Process

### Phase 1: Self-Review Checklist

Before submitting, ensure:

- [ ] App works in both web and LIFF modes
- [ ] All interactive elements have `data-testid`
- [ ] No hardcoded tenant/member data
- [ ] Responsive design (mobile-first)
- [ ] Thai language UI (primary)
- [ ] No console errors
- [ ] Proper error handling

### Phase 2: Submit for Review

1. Create a Pull Request with your app
2. Include:
   - App name and description
   - Screenshots/demo video
   - Access level justification
   - Revenue model (if applicable)

### Phase 3: Review Process

| Step | Duration | Action |
|------|----------|--------|
| Initial Review | 1-2 days | Code quality check |
| Security Audit | 2-3 days | Data access review |
| UX Review | 1-2 days | User experience check |
| Approval | 1 day | Final sign-off |

### Phase 4: Go Live

Once approved:
1. App added to global registry
2. Chapter Admins can enable via App Center
3. Members access via LINE Bot or Profile

---

## Revenue Model

### Options for Developers

| Model | Description | Platform Fee |
|-------|-------------|--------------|
| **Free** | No charge, build reputation | 0% |
| **Freemium** | Basic free, premium features paid | 10% |
| **Subscription** | Monthly/yearly fee per chapter | 15% |
| **Usage-based** | Pay per use/export | 10% |

### Payment Flow

```
Member/Chapter pays → Meetdup collects → 
Monthly payout to Developer (minus platform fee)
```

### Revenue Tracking

Developers get access to:
- Installs per chapter
- Active users
- Feature usage analytics
- Revenue dashboard

---

## API Reference

### Available APIs

#### Get Chapter Apps
```
GET /api/apps/chapter/:tenantId/enabled
Response: [{ app_id, name, description, icon, route }]
```

#### Member Verification (for member/admin apps)
```
GET /api/public/verify-line-member?lineUserId=xxx&tenantId=xxx
Response: { isMember, isAdmin, participant: {...}, tenant: {...} }
```

#### Custom APIs (Roadmap)

> **Note:** Custom app-specific data endpoints are planned for Phase 3. Currently, apps should be self-contained without server-side data persistence.

For apps requiring data persistence, contact us to discuss implementation options.

---

## Support & Resources

### Documentation
- [Shadcn/ui Components](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Lucide Icons](https://lucide.dev/)
- [LINE LIFF SDK](https://developers.line.biz/en/docs/liff/)

### Example Apps
- **BOQ Estimator** (`client/src/pages/apps/BOQEstimator.tsx`) - Full featured example with Excel export

### Contact
- Developer Support: developer@meetdup.app
- Slack Community: #meetdup-developers

---

## FAQ

### Q: Can I use external APIs in my app?
**A:** Yes, but must go through our backend proxy for security. Contact us to set up.

### Q: How do I test LIFF features?
**A:** Use the sandbox environment with test LINE accounts. We provide test credentials.

### Q: Can I access member data?
**A:** Only through approved APIs. Direct database access is not allowed.

### Q: What languages are supported?
**A:** Primary: Thai. English optional for international chapters.

### Q: How long until my app is reviewed?
**A:** Typically 5-7 business days for initial review.

---

## Appendix: App Ideas

Looking for inspiration? Here are apps our chapters need:

| App | Description | Complexity |
|-----|-------------|------------|
| Invoice Generator | Create and send invoices | Medium |
| Quote Calculator | Service pricing calculator | Easy |
| Lead Tracker | Track referral leads | Medium |
| Business Card Scanner | OCR business cards | Hard |
| Meeting Timer | PALMS presentation timer | Easy |
| Referral Tracker | Track given/received referrals | Medium |
| Expense Splitter | Split group expenses | Easy |

---

*Last updated: December 2024*
*Version: 1.0*
