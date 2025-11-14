# Meetdup Documentation

Welcome to the Meetdup documentation! This directory contains comprehensive guides for the multi-path onboarding system.

---

## 📚 Available Documentation

### 1. [User Journey: Onboarding](./USER_JOURNEY_ONBOARDING.md)
**Purpose**: Complete guide to all 3 onboarding flows

**Contents**:
- Pioneer Flow (Create Chapter)
- Invite Flow (Accept Invite Link)
- Discovery Flow (Search & Join)
- Database schema
- RLS policies
- API endpoints
- Troubleshooting

**Audience**: Developers, Product Managers, QA

---

### 2. [Migration Guide](./MIGRATION_GUIDE.md)
**Purpose**: How to run the security migration

**Contents**:
- 3 methods to run migration (Dashboard, CLI, Manual)
- Verification steps
- Testing after migration
- Rollback instructions
- Troubleshooting

**Audience**: DevOps, Backend Developers

⚠️ **Important**: Must run migration before testing onboarding flows!

---

### 3. [Testing Onboarding Flows](./TESTING_ONBOARDING_FLOWS.md)
**Purpose**: Comprehensive testing guide

**Contents**:
- Step-by-step test procedures for all 3 flows
- Security testing (RLS policies)
- Edge case testing
- Test account setup
- Performance testing
- Automated testing examples
- Testing checklist

**Audience**: QA Engineers, Developers

---

### 4. [Security Best Practices](./SECURITY_BEST_PRACTICES.md)
**Purpose**: Security guidelines and best practices

**Contents**:
- RLS policy best practices
- Token security
- API security (auth, validation, injection prevention)
- Data privacy (GDPR, least privilege)
- Secure communication (HTTPS, CORS, headers)
- Error handling
- Monitoring & auditing
- Common vulnerabilities
- Security checklist

**Audience**: Security Engineers, Backend Developers, DevOps

---

## 🚀 Quick Start

### For New Developers

1. **Read**: [User Journey Onboarding](./USER_JOURNEY_ONBOARDING.md)
   - Understand the 3 onboarding flows
   - Learn the database schema
   - Review API endpoints

2. **Run**: Migration
   - Follow [Migration Guide](./MIGRATION_GUIDE.md)
   - Verify with `npm run verify-migration`

3. **Test**: Onboarding flows
   - Follow [Testing Guide](./TESTING_ONBOARDING_FLOWS.md)
   - Create test accounts
   - Verify all flows work

4. **Review**: Security
   - Read [Security Best Practices](./SECURITY_BEST_PRACTICES.md)
   - Understand RLS policies
   - Follow secure coding guidelines

### For QA Engineers

1. **Setup**: Test environment
   - Run migration (see Migration Guide)
   - Create test accounts

2. **Test**: All flows
   - Follow [Testing Guide](./TESTING_ONBOARDING_FLOWS.md) step-by-step
   - Complete the testing checklist
   - Document any bugs found

3. **Verify**: Security
   - Test RLS policies (member cannot see invites, etc.)
   - Test edge cases
   - Verify error handling

### For DevOps/SRE

1. **Deploy**: Migration
   - Follow [Migration Guide](./MIGRATION_GUIDE.md)
   - Method 1 (Supabase Dashboard) recommended for first time
   - Verify deployment with scripts

2. **Monitor**: Security
   - Review [Security Best Practices](./SECURITY_BEST_PRACTICES.md)
   - Set up monitoring alerts
   - Review audit logs regularly

3. **Maintain**: System
   - Follow deployment checklist
   - Regular security reviews
   - Keep documentation updated

---

## 📁 File Structure

```
docs/
├── README.md                           # This file
├── USER_JOURNEY_ONBOARDING.md          # User flows, database schema, API docs
├── MIGRATION_GUIDE.md                  # How to run security migration
├── TESTING_ONBOARDING_FLOWS.md         # Comprehensive testing guide
└── SECURITY_BEST_PRACTICES.md          # Security guidelines

supabase/migrations/
├── 20251114_add_chapter_invites_and_join_requests.sql  # Initial (DEPRECATED)
├── 20251114_fix_permissions_and_rls.sql                # Fix V1 (DEPRECATED)
├── 20251114_fix_permissions_v2.sql                     # Fix V2 (DEPRECATED)
└── 20251114_fix_permissions_final.sql                  # Use THIS ✅

server/scripts/
├── verify-migration.ts                 # Check if tables exist
└── check-supabase-data.ts              # Display all data
```

---

## 🔧 Useful Commands

```bash
# Verify migration ran successfully
npm run verify-migration

# Check current data in Supabase
npm run check-data

# Start development server
npm run dev

# View migration guide
npm run migration:guide
```

---

## 🎯 Testing Checklist

Before deploying to production, ensure:

### Functional Testing
- [ ] Pioneer flow works (create chapter)
- [ ] Invite flow works (accept invite)
- [ ] Discovery flow works (search & join)
- [ ] All API endpoints respond correctly
- [ ] Redirects work properly

### Security Testing
- [ ] Members **cannot** see invite tokens
- [ ] Members **cannot** see others' join requests
- [ ] Non-admins **cannot** create invites
- [ ] Non-admins **cannot** approve requests
- [ ] RLS policies enforced

### Data Integrity
- [ ] No duplicate chapters created
- [ ] User roles assigned correctly
- [ ] Join requests tracked properly
- [ ] Invite usage counted correctly

### User Experience
- [ ] Error messages are clear
- [ ] Success messages displayed
- [ ] Loading states shown
- [ ] Mobile responsive

---

## 🐛 Troubleshooting

### Common Issues

**Problem**: "No Chapter Found" when discovering chapters

**Solution**: See [User Journey Onboarding - Troubleshooting](./USER_JOURNEY_ONBOARDING.md#troubleshooting)

---

**Problem**: Migration fails

**Solution**: See [Migration Guide - Troubleshooting](./MIGRATION_GUIDE.md#troubleshooting)

---

**Problem**: Permission denied errors

**Solution**: See [Testing Guide - Troubleshooting](./TESTING_ONBOARDING_FLOWS.md#troubleshooting)

---

**Problem**: Security concerns

**Solution**: See [Security Best Practices](./SECURITY_BEST_PRACTICES.md)

---

## 📊 System Status

Current implementation status:

| Feature | Status | Documentation |
|---------|--------|---------------|
| Pioneer Flow (Create Chapter) | ✅ Complete | [User Journey](./USER_JOURNEY_ONBOARDING.md#flow-1-pioneer-create-chapter) |
| Invite Flow (Accept Invite) | ✅ Complete | [User Journey](./USER_JOURNEY_ONBOARDING.md#flow-2-invite-accept-invite-link) |
| Discovery Flow (Search & Join) | ✅ Complete | [User Journey](./USER_JOURNEY_ONBOARDING.md#flow-3-discovery-search--request) |
| Admin-Only Invite Access | ✅ Complete | [Security](./SECURITY_BEST_PRACTICES.md#1-row-level-security-rls-policies) |
| Role-Based Join Requests | ✅ Complete | [Security](./SECURITY_BEST_PRACTICES.md#1-row-level-security-rls-policies) |
| Migration Scripts | ✅ Complete | [Migration Guide](./MIGRATION_GUIDE.md) |
| Testing Procedures | ✅ Complete | [Testing Guide](./TESTING_ONBOARDING_FLOWS.md) |
| Security Hardening | ✅ Complete | [Security](./SECURITY_BEST_PRACTICES.md) |

---

## 🔄 Next Steps

### Immediate (Before Production)

1. **Run Migration**:
   - Follow [Migration Guide](./MIGRATION_GUIDE.md)
   - Use Supabase Dashboard SQL Editor
   - Verify with `npm run verify-migration`

2. **Test All Flows**:
   - Complete [Testing Guide](./TESTING_ONBOARDING_FLOWS.md)
   - Fill out testing checklist
   - Fix any bugs found

3. **Security Review**:
   - Review [Security Best Practices](./SECURITY_BEST_PRACTICES.md)
   - Verify RLS policies in Supabase Dashboard
   - Test with different user roles

### Future Enhancements

- [ ] Email notifications for invites/approvals
- [ ] LINE notification integration
- [ ] Bulk invite generation
- [ ] Custom invite messages
- [ ] Chapter discovery filters (location, industry)
- [ ] Auto-approval rules
- [ ] Invite analytics dashboard
- [ ] Rate limiting on invite acceptance
- [ ] Token hashing in database
- [ ] Audit logging system

---

## 📞 Support

For questions or issues:

1. Check relevant documentation above
2. Review troubleshooting sections
3. Run verification scripts
4. Check Supabase Dashboard → Database → Policies
5. Review server logs

---

## 📝 Contributing to Documentation

When updating documentation:

1. Keep it clear and concise
2. Include code examples
3. Add troubleshooting sections
4. Update this README if adding new docs
5. Test all commands/scripts before documenting

---

**Last Updated**: November 14, 2025

**Maintainers**: Meetdup Development Team

**Version**: 1.0.0
