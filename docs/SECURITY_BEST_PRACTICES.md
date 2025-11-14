# Security Best Practices: Meetdup Onboarding System

## Overview

This document outlines security best practices for the multi-path onboarding system, covering RLS policies, API security, token management, and data privacy.

---

## 1. Row Level Security (RLS) Policies

### Current Implementation

**chapter_invites** (Admin-Only Access):
```sql
-- Only admins can SELECT
CREATE POLICY "Only admins view invites"
  ON public.chapter_invites FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
      AND tenant_id = chapter_invites.tenant_id
      AND role IN ('super_admin', 'chapter_admin')
  ));

-- Only admins can INSERT
CREATE POLICY "Only admins create invites"
  ON public.chapter_invites FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
      AND tenant_id = chapter_invites.tenant_id
      AND role IN ('super_admin', 'chapter_admin')
  ));

-- Only admins can DELETE (revoke invites)
CREATE POLICY "Only admins delete invites"
  ON public.chapter_invites FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
      AND tenant_id = chapter_invites.tenant_id
      AND role IN ('super_admin', 'chapter_admin')
  ));
```

**chapter_join_requests** (Role-Based Visibility):
```sql
-- Admins see all for chapter, users see own only
CREATE POLICY "View join requests"
  ON public.chapter_join_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
        AND tenant_id = chapter_join_requests.tenant_id
        AND role IN ('super_admin', 'chapter_admin')
    )
    OR user_id = auth.uid()
  );
```

### Best Practices

✅ **DO**:
- Use `auth.uid()` for user identification
- Check role in `user_roles` table for authorization
- Use `EXISTS` subqueries for efficient permission checks
- Test policies with different user roles
- Document policy intent in comments

❌ **DON'T**:
- Grant broad permissions like `USING (true)`
- Rely solely on frontend checks
- Expose sensitive data to anonymous users
- Skip RLS policies (always enable RLS)

---

## 2. Token Security

### Invite Token Generation

**Current Implementation**:
```typescript
function generateToken(): string {
  return crypto.randomBytes(16).toString('hex'); // 32 characters
}
```

### Best Practices

✅ **DO**:
- Use cryptographically secure random generators
- Generate tokens with sufficient entropy (12+ characters)
- Set expiration dates on tokens
- Limit max uses per token
- Store tokens hashed (future enhancement)

❌ **DON'T**:
- Use predictable token patterns (e.g., sequential IDs)
- Make tokens too short (<12 characters)
- Create tokens without expiration
- Expose tokens in URLs to analytics services

### Token Lifecycle

```
1. Generation (Admin)
   ↓
2. Storage (Database, expires_at set)
   ↓
3. Distribution (Shared via secure channel)
   ↓
4. Validation (Backend service role)
   ↓
5. Usage (Increment uses_count)
   ↓
6. Expiration/Revocation (Delete or expire)
```

### Recommendations

1. **Hash tokens** in database (future):
   ```sql
   token_hash varchar NOT NULL UNIQUE,
   token_preview varchar(8) NOT NULL -- First 8 chars for admin display
   ```

2. **Rate limiting** on invite acceptance:
   ```typescript
   // Limit: 5 attempts per IP per hour
   const rateLimiter = rateLimit({
     windowMs: 60 * 60 * 1000,
     max: 5,
   });
   ```

3. **Audit logging**:
   ```sql
   CREATE TABLE invite_audit_log (
     log_id serial PRIMARY KEY,
     invite_id uuid REFERENCES chapter_invites,
     action text, -- 'accepted', 'attempted', 'revoked'
     user_id uuid,
     ip_address inet,
     created_at timestamptz DEFAULT now()
   );
   ```

---

## 3. API Security

### Authentication

**All API endpoints require authentication**:
```typescript
// server/routes/chapters.ts
router.post('/invite/generate', requireAuth, requireAdmin, async (req, res) => {
  // Only authenticated admins can generate invites
});
```

### Authorization Middleware

```typescript
function requireAdmin(req, res, next) {
  const { user, tenant } = req;
  
  // Check if user is admin for this tenant
  const isAdmin = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('tenant_id', tenant.id)
    .in('role', ['super_admin', 'chapter_admin'])
    .single();
  
  if (!isAdmin.data) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  next();
}
```

### Input Validation

**Always validate and sanitize inputs**:
```typescript
import { z } from 'zod';

const createChapterSchema = z.object({
  tenant_name: z.string()
    .min(3, 'Chapter name must be at least 3 characters')
    .max(100, 'Chapter name too long')
    .regex(/^[a-zA-Z0-9\s-]+$/, 'Invalid characters'),
  
  subdomain: z.string()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Subdomain must be lowercase, alphanumeric, and hyphens only')
    .refine(val => !val.startsWith('-') && !val.endsWith('-'), {
      message: 'Subdomain cannot start or end with hyphen'
    })
});

// Validate before processing
const result = createChapterSchema.safeParse(req.body);
if (!result.success) {
  return res.status(400).json({ errors: result.error.errors });
}
```

### SQL Injection Prevention

✅ **DO**:
- Use Supabase client (parameterized queries)
- Never concatenate user input into SQL
- Use prepared statements

❌ **DON'T**:
```typescript
// NEVER DO THIS
const sql = `SELECT * FROM tenants WHERE subdomain = '${userInput}'`;
```

✅ **DO THIS**:
```typescript
const { data } = await supabase
  .from('tenants')
  .select('*')
  .eq('subdomain', userInput);
```

---

## 4. Data Privacy

### Principle of Least Privilege

**Users should only see data they need**:

- **Admins**:
  - ✅ All chapter data
  - ✅ All member data
  - ✅ All join requests
  - ✅ All invite tokens

- **Members**:
  - ✅ Own profile
  - ✅ Own join requests
  - ✅ Chapter public info
  - ❌ **Cannot** see invite tokens
  - ❌ **Cannot** see others' join requests

- **Anonymous**:
  - ✅ Public chapter listings (discover page)
  - ❌ **Cannot** see any sensitive data

### Personal Data Protection

**GDPR/Privacy Considerations**:

1. **Data Minimization**:
   - Only collect necessary data
   - Don't store unnecessary metadata

2. **Data Retention**:
   ```sql
   -- Delete expired invites after 90 days
   DELETE FROM chapter_invites 
   WHERE expires_at < NOW() - INTERVAL '90 days';
   
   -- Archive old join requests
   UPDATE chapter_join_requests 
   SET status = 'archived' 
   WHERE created_at < NOW() - INTERVAL '1 year'
     AND status IN ('approved', 'rejected');
   ```

3. **Right to be Forgotten**:
   ```sql
   -- Delete user and all associated data
   DELETE FROM chapter_join_requests WHERE user_id = :user_id;
   DELETE FROM user_roles WHERE user_id = :user_id;
   DELETE FROM profiles WHERE id = :user_id;
   ```

---

## 5. Secure Communication

### HTTPS Only

**Always use HTTPS in production**:
```typescript
// Redirect HTTP to HTTPS
if (process.env.NODE_ENV === 'production' && !req.secure) {
  return res.redirect(301, `https://${req.hostname}${req.url}`);
}
```

### CORS Configuration

```typescript
import cors from 'cors';

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:5000',
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

### Secure Headers

```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Minimize unsafe-inline
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  }
}));
```

---

## 6. Error Handling

### Don't Leak Information

❌ **BAD**:
```typescript
catch (error) {
  res.status(500).json({ 
    error: error.message, // Might expose database schema
    stack: error.stack     // Exposes internal paths
  });
}
```

✅ **GOOD**:
```typescript
catch (error) {
  console.error('Internal error:', error); // Log internally
  
  res.status(500).json({ 
    error: 'An error occurred. Please try again later.'
  });
}
```

### Specific Error Messages for Users

```typescript
// Invite acceptance
if (!invite) {
  return res.status(404).json({ 
    error: 'Invite not found or expired' 
  });
}

if (invite.uses_count >= invite.max_uses) {
  return res.status(400).json({ 
    error: 'This invite has reached its maximum uses' 
  });
}

if (new Date(invite.expires_at) < new Date()) {
  return res.status(400).json({ 
    error: 'This invite has expired' 
  });
}
```

---

## 7. Monitoring & Auditing

### Log Critical Events

```typescript
// Log invite generation
console.log({
  event: 'invite_generated',
  admin_id: req.user.id,
  tenant_id: tenantId,
  max_uses: invite.max_uses,
  expires_at: invite.expires_at,
  timestamp: new Date().toISOString()
});

// Log invite acceptance
console.log({
  event: 'invite_accepted',
  user_id: req.user.id,
  tenant_id: tenantId,
  invite_id: invite.invite_id,
  timestamp: new Date().toISOString()
});

// Log join request approval
console.log({
  event: 'join_request_approved',
  admin_id: req.user.id,
  requester_id: request.user_id,
  tenant_id: tenantId,
  timestamp: new Date().toISOString()
});
```

### Monitor Suspicious Activity

- Multiple failed invite attempts from same IP
- Rapid join requests from single user
- Token enumeration attempts
- Privilege escalation attempts

---

## 8. Security Checklist

### Deployment Checklist

Before deploying to production:

- [ ] All RLS policies enabled and tested
- [ ] HTTPS enforced
- [ ] CORS properly configured
- [ ] Rate limiting implemented
- [ ] Input validation on all endpoints
- [ ] Error handling doesn't leak information
- [ ] Secure headers configured (helmet)
- [ ] Audit logging implemented
- [ ] Monitoring alerts set up
- [ ] Backup strategy in place
- [ ] Secrets stored securely (not in code)
- [ ] Database access restricted to service accounts
- [ ] Admin accounts use strong passwords/2FA
- [ ] Security audit completed

### Regular Maintenance

- [ ] Review audit logs weekly
- [ ] Update dependencies monthly
- [ ] Rotate API keys quarterly
- [ ] Review RLS policies quarterly
- [ ] Security testing annually
- [ ] Penetration testing annually

---

## 9. Common Vulnerabilities

### Protect Against

1. **SQL Injection**:
   - Use Supabase client (parameterized queries)
   - Validate all inputs

2. **XSS (Cross-Site Scripting)**:
   - Sanitize user inputs
   - Use React (auto-escapes by default)
   - Set CSP headers

3. **CSRF (Cross-Site Request Forgery)**:
   - Use Supabase Auth (includes CSRF protection)
   - Verify origin headers

4. **Token Enumeration**:
   - Use long random tokens
   - Rate limit attempts
   - Don't expose tokens to non-admins

5. **Privilege Escalation**:
   - Always verify roles server-side
   - Use RLS policies
   - Never trust frontend role checks

6. **Data Leakage**:
   - RLS policies prevent unauthorized access
   - Don't log sensitive data
   - Use proper error messages

---

## 10. Resources

### External References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase RLS Best Practices](https://supabase.com/docs/guides/auth/row-level-security)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)

### Internal Documentation

- `docs/USER_JOURNEY_ONBOARDING.md` - User flows
- `docs/MIGRATION_GUIDE.md` - Migration instructions
- `docs/TESTING_ONBOARDING_FLOWS.md` - Testing procedures
- `supabase/migrations/20251114_fix_permissions_final.sql` - RLS policies

---

**Last Updated**: November 14, 2025

**Security Contact**: If you discover a security vulnerability, please report it immediately to the security team.
