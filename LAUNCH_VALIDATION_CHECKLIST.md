# 🚀 Launch Validation Checklist - Bali Event Ready

## ✅ Completed Pre-Launch Tasks

### 1. Email & Notification System ✓
- [x] Test emails page at `/test-emails` - verify all email templates work
- [x] Bulk notification broadcaster at `/admin-broadcast` - send platform updates to all users
- [x] Email automation cron jobs scheduled (weekly digest, activity digest, streak warnings, onboarding reminders, re-engagement)
- [x] RESEND_API_KEY configured

**Action Required:** Test send emails via `/test-emails` before event

### 2. Communities Feature ✓
- [x] Kretopia Bali community visible and joinable
- [x] Bali Cre8ives community visible and joinable
- [x] RLS policies fixed (removed infinite recursion)
- [x] Public visibility for unauthenticated users

### 3. Subscription Visibility ✓
- [x] Landing page has full pricing section showcasing Pro ($9/mo)
- [x] Profile page has SubscriptionPromptCard in Stats tab
- [x] Discover page shows upgrade dialog when swipes run out
- [x] All 3 tiers properly displayed (Free, Pro $9, Studio $29)

**Current Status:** 42 users, 0 Pro conversions, 2 Studio - Pricing visibility in place but conversion funnel needs monitoring post-launch

---

## 🔥 Critical Pre-Event Validation (DO BEFORE EVENT)

### A. Core User Flow Testing
Test complete journey from QR code → signup → onboarding → first action:

1. **Landing Page (Desktop + Mobile)**
   - [ ] Loads under 3 seconds
   - [ ] "Get Started Free" button works
   - [ ] Pricing section visible
   - [ ] Communities showcased
   - [ ] All CTAs link correctly

2. **Auth Flow**
   - [ ] Sign up with email works
   - [ ] Auto-confirm emails enabled in Supabase settings
   - [ ] Redirects to onboarding after signup
   - [ ] Welcome email sent (test via `/test-emails`)

3. **Onboarding (3 Steps)**
   - [ ] Step 1: Profile basics (name, role, bio) saves correctly
   - [ ] Step 2: Skills selection works
   - [ ] Step 3: Done → Redirects to Spark feed
   - [ ] Onboarding completion tracked in profiles table
   - [ ] User badge assigned (OG vs Beta)

4. **Spark Feed (Primary Destination)**
   - [ ] Loads under 3 seconds
   - [ ] Portfolio items from all users display
   - [ ] "For You" tab shows content
   - [ ] "Following" tab works (empty until connections made)
   - [ ] Save/clip functionality works
   - [ ] Reactions work

5. **Discover (Matching Page)**
   - [ ] Opportunity cards load
   - [ ] Swipe left/right works
   - [ ] Daily swipes counter accurate
   - [ ] Upgrade prompt shows at 0 swipes
   - [ ] Bookmark/save works
   - [ ] Apply to opportunity dialog works

6. **Circle (Connections)**
   - [ ] Shows matches when users swipe right on each other
   - [ ] Direct message dialog works
   - [ ] Displays mutual connections
   - [ ] Real-time updates when new matches occur

7. **Communities**
   - [ ] Both Bali communities visible
   - [ ] Join community button works
   - [ ] Posts visible within communities
   - [ ] Create post works
   - [ ] Leave community works

8. **Cre8 (Challenges)**
   - [ ] Challenge cards display
   - [ ] Submit entry dialog works
   - [ ] Vote on entries works
   - [ ] Challenge deadline shown

### B. Performance Validation
All pages must load under 3 seconds:

- [ ] Landing: _____ seconds
- [ ] Auth: _____ seconds  
- [ ] Onboarding: _____ seconds
- [ ] Spark: _____ seconds
- [ ] Discover: _____ seconds
- [ ] Circle: _____ seconds
- [ ] Community: _____ seconds
- [ ] Profile: _____ seconds

**If any page exceeds 3 seconds:** Optimize queries, reduce data limits, remove heavy operations

### C. Mobile Experience (CRITICAL - Event Users Scanning QR)
Test on actual mobile devices:

- [ ] Landing page mobile-responsive
- [ ] Auth flow works on mobile
- [ ] Onboarding fits mobile screen
- [ ] Bottom navigation works
- [ ] All pages scrollable
- [ ] Touch gestures work (swipe cards)
- [ ] Forms submit properly
- [ ] Images load correctly

### D. Notification System Validation

**In-App Notifications:**
- [ ] Notification bell shows unread count
- [ ] Clicking bell opens notification center
- [ ] Notifications marked as read
- [ ] Notifications link to correct pages

**Email Notifications:**
- [ ] Welcome email sends on signup (test via `/test-emails`)
- [ ] Match notification email works
- [ ] Weekly digest scheduled (Sundays 10 AM UTC)
- [ ] Activity digest scheduled (daily 9 AM UTC)
- [ ] Streak warning scheduled (daily 8 AM UTC)

**Push Notifications:**
- [ ] Service worker active
- [ ] Push permission prompt shows
- [ ] Notifications fire on matches
- [ ] Notifications fire on messages
- [ ] Unsubscribe works

### E. Subscription & Monetization

- [ ] Free tier limits enforced (30 swipes/day)
- [ ] Pro upgrade flow works (`/subscription`)
- [ ] Studio upgrade flow works
- [ ] Subscription status shows in profile
- [ ] Payment success redirects correctly
- [ ] Payment canceled handled gracefully

### F. Data Integrity & Security

**Database Checks (via Backend or SQL):**
```sql
-- Verify profiles created properly
SELECT COUNT(*), onboarding_completed, subscription_tier 
FROM profiles 
GROUP BY onboarding_completed, subscription_tier;

-- Check notification preferences exist for all users
SELECT COUNT(*) FROM notification_preferences;
SELECT COUNT(*) FROM profiles;

-- Verify communities exist and are public
SELECT id, name, is_private, member_count FROM communities WHERE name LIKE '%Bali%';

-- Check RLS policies active
SELECT schemaname, tablename, policyname, permissive 
FROM pg_policies 
WHERE tablename IN ('profiles', 'communities', 'community_members', 'opportunities');
```

### G. Error Handling & Edge Cases

- [ ] No internet connection handled
- [ ] 404 pages styled properly
- [ ] Form validation shows errors
- [ ] Image upload failures handled
- [ ] Large file uploads blocked with message
- [ ] Empty states show helpful messages
- [ ] Loading states prevent double-clicks

---

## 📊 Post-Event Monitoring (First 24 Hours)

### Metrics to Track:
1. **Acquisition Funnel**
   - QR scans → Landing visits
   - Landing visits → Signups
   - Signups → Onboarding completion
   - Onboarding completion → First action (Spark view, Discover swipe, Community join)

2. **Engagement Metrics**
   - Day 1 retention (users returning next day)
   - Average session time
   - Actions per session
   - Pages visited per session

3. **Feature Usage**
   - Spark feed views
   - Discover swipes completed
   - Communities joined
   - Matches made
   - Messages sent
   - Opportunities applied to

4. **Conversion Metrics**
   - Free → Pro upgrades
   - Free → Studio upgrades
   - Subscription retention (if any)

### Quick Wins to Track:
- [ ] First 10 signups from event
- [ ] First match between event attendees
- [ ] First community post in Kretopia Bali
- [ ] First Cre8 challenge entry from new users

---

## 🚨 Emergency Contacts & Rollback Plan

### If Critical Issues Arise:
1. **Landing Page Down:** Check Vercel deployment, rollback via History
2. **Auth Broken:** Check Supabase auth settings, auto-confirm emails
3. **Communities Not Loading:** Check RLS policies, verify data exists
4. **Performance Issues:** Check Supabase instance size, upgrade if needed
5. **Email Not Sending:** Verify RESEND_API_KEY in Supabase secrets

### Access Points:
- Backend: `/admin-broadcast` (send emergency notifications)
- Test Emails: `/test-emails` (verify email system working)
- Database: Lovable Cloud dashboard → Tables
- Logs: Lovable Cloud dashboard → Edge Function Logs

---

## ✅ Final Pre-Launch Sign-Off

Before announcing platform at event:

- [ ] All A-F validation checks completed
- [ ] Test user account created and tested full flow
- [ ] Mobile QR code tested from actual device
- [ ] Communities confirmed visible for unauthenticated users
- [ ] Email notifications tested and working
- [ ] Performance benchmarks under 3 seconds
- [ ] Admin broadcast tested (send test notification)
- [ ] No console errors on any page
- [ ] All links functional
- [ ] Legal pages accessible (Terms, Privacy)

**Sign-Off Date:** _____________  
**Signed By:** _____________  
**Ready for Launch:** ☐ YES  ☐ NO (Blockers: _________________________)
