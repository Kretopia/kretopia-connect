# Security Checklist - Follow for EVERY New Feature

## 🔐 Pre-Development Security Review

Before writing ANY code or creating tables, answer these questions:

### Data Classification
- [ ] Does this feature handle Personal Identifiable Information (PII)?
  - Emails, phone numbers, names, addresses, IP addresses, location data
- [ ] Does this feature track user behavior or analytics?
- [ ] Does this feature contain financial/payment information?
- [ ] Does this feature contain business-sensitive data (contact info, pricing, etc.)?
- [ ] Will this data be viewable by other users? If yes, which users?

### Access Control Design
- [ ] Who should have READ access? (Owner only, Connections, Public, Admins)
- [ ] Who should have WRITE access? (Owner only, Specific roles, Admins)
- [ ] Who should have DELETE access? (Owner only, Admins)
- [ ] Are there any fields that need column-level security?

---

## 🗄️ Database Table Security Checklist

### Before Creating the Table

1. **Default to Restrictive**
   - [ ] Start with NO public access
   - [ ] Explicitly add permissions based on use case
   - [ ] Never use `USING (true)` or `WITH CHECK (true)` without justification

2. **Column Design**
   - [ ] All user_id columns should be NOT NULL (unless explicitly justified)
   - [ ] Add foreign key constraints to auth tables
   - [ ] Sensitive columns should have explicit policies
   - [ ] Default values should be secure (e.g., false for public flags)

3. **RLS Policy Design Patterns**

```sql
-- ✅ CORRECT: Users can only see their own data
CREATE POLICY "Users view own data"
ON table_name FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- ✅ CORRECT: Admins can see everything
CREATE POLICY "Admins view all"
ON table_name FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- ❌ WRONG: Everyone can see everything
CREATE POLICY "Public read" 
ON table_name FOR SELECT
USING (true);  -- DANGEROUS! Only use for truly public data

-- ✅ CORRECT: Connections can see each other's data
CREATE POLICY "Connections can view"
ON table_name FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id OR
  user_id IN (
    SELECT connected_user_id FROM connections 
    WHERE user_id = auth.uid() AND status = 'accepted'
  )
);
```

### After Creating the Table

- [ ] Run security linter: Check for warnings
- [ ] Test with non-admin user: Can they see data they shouldn't?
- [ ] Test with anonymous user: Can they access anything?
- [ ] Review all policies: Are they specific enough?

---

## 🛡️ Common Table Security Patterns

### Analytics/Tracking Tables
```sql
-- Users insert events, but ONLY admins can read
CREATE POLICY "Users insert events"
ON analytics_table FOR INSERT
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Only admins read analytics"
ON analytics_table FOR SELECT
USING (has_role(auth.uid(), 'admin'));
```

### User-Generated Content (Posts, Portfolio)
```sql
-- Owner can CRUD, others can read
CREATE POLICY "Owner full access"
ON content_table FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public read"
ON content_table FOR SELECT
USING (true);  -- Only if truly meant to be public
```

### Financial/Payment Data
```sql
-- ONLY owner can view, NO public access
CREATE POLICY "Owner view only"
ON payment_table FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

-- System creates records (via edge functions)
-- Users should NOT be able to INSERT
```

### Contact/Submission Forms
```sql
-- Anyone can submit
CREATE POLICY "Anyone can submit"
ON submissions FOR INSERT
WITH CHECK (true);

-- Only admins and submitter can view
CREATE POLICY "Admins and submitter view"
ON submissions FOR SELECT
USING (
  contact_email = get_user_email(auth.uid()) OR 
  has_role(auth.uid(), 'admin')
);
```

---

## 💻 Code Security Checklist

### Input Validation
- [ ] All form inputs validated with Zod schemas
- [ ] Length limits enforced client and server side
- [ ] Email/URL validation before API calls
- [ ] SQL injection prevention (use parameterized queries)
- [ ] XSS prevention (no dangerouslySetInnerHTML with user content)

### Authentication
- [ ] Auth checks on all protected routes
- [ ] Session validation in edge functions
- [ ] No client-side role checks for security decisions
- [ ] Proper redirect after login/logout

### API Security
- [ ] Edge functions validate user permissions
- [ ] Rate limiting on sensitive endpoints
- [ ] Input sanitization in edge functions
- [ ] No sensitive data in error messages
- [ ] Proper CORS configuration

---

## 🚨 Post-Migration Security Verification

After EVERY database migration, complete these steps:

1. **Run Security Scanner**
```bash
# Check for security issues immediately
```
- [ ] Fix all ERROR level issues immediately
- [ ] Review all WARN level issues
- [ ] Document any intentional exceptions

2. **Manual Testing**
- [ ] Test as regular user - can you see others' data?
- [ ] Test as anonymous user - can you access protected data?
- [ ] Test CRUD operations - do policies work correctly?
- [ ] Test edge cases (deleted users, null values)

3. **Code Review**
- [ ] All queries use proper auth checks
- [ ] No hardcoded credentials
- [ ] Sensitive data not logged to console
- [ ] Error messages don't leak data

---

## 🚫 Security Anti-Patterns to AVOID

### ❌ NEVER Do This
```sql
-- Exposing all data
USING (true)  -- Unless explicitly public data

-- Nullable user_id with RLS
user_id UUID NULL  -- Should be NOT NULL for user data

-- Client-side admin checks
if (localStorage.getItem('isAdmin')) {  -- DANGEROUS!
  // show admin panel
}

-- Storing passwords/secrets in database
password TEXT  -- Use auth.users, never store passwords

-- Overly broad policies
USING (user_id IS NOT NULL)  -- Not specific enough
```

### ✅ Always Do This
```sql
-- Specific, explicit policies
USING (auth.uid() = user_id)

-- Required user association
user_id UUID NOT NULL REFERENCES auth.users

-- Server-side role checks
USING (has_role(auth.uid(), 'admin'))

-- Proper secret management
-- Use Supabase Secrets, never commit keys
```

---

## 📋 New Feature Security Workflow

1. **Design Phase**
   - Complete "Pre-Development Security Review"
   - Document data access requirements
   - Design RLS policies BEFORE writing code

2. **Implementation Phase**
   - Create tables with RLS from start
   - Write restrictive policies first
   - Add input validation
   - Implement auth checks

3. **Testing Phase**
   - Run security scanner
   - Manual security testing
   - Test with different user roles
   - Verify policies work as expected

4. **Launch Phase**
   - Final security scan
   - Document security decisions
   - Monitor for unauthorized access attempts

---

## 🎯 Key Principles

1. **Default Deny**: Start with no access, explicitly grant permissions
2. **Least Privilege**: Users should only access what they need
3. **Defense in Depth**: Multiple layers of security (RLS + code validation)
4. **Validate Everything**: Never trust client-side data
5. **Audit Trail**: Log security-relevant events for review

---

## 📊 Security Severity Levels

### 🔴 CRITICAL - Fix Immediately
- PII exposed to unauthorized users
- Financial data accessible by others
- Authentication bypass possible
- SQL injection vulnerabilities

### 🟡 HIGH - Fix Before Launch
- Weak access controls
- Missing input validation
- Overly permissive policies
- Lack of rate limiting

### 🟠 MEDIUM - Fix Soon
- Leaked password protection disabled
- Missing audit trails
- Inefficient queries exposing data
- Weak password requirements

### 🟢 LOW - Improvement
- Better error messages
- Enhanced logging
- Performance optimizations
- UX security improvements

---

## ✅ Sign-Off Checklist

Before considering any feature "complete":

- [ ] All security checklist items completed
- [ ] Security scanner shows no critical issues
- [ ] Manual testing passed
- [ ] Code review completed
- [ ] Documentation updated
- [ ] Security decisions documented

**Security is not optional. Every feature must pass this checklist.**
