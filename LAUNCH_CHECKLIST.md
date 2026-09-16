# Kretopia Launch Checklist

## ⚡ Quick Setup (Do These First - 15 minutes)

### 1. Configure Stripe Customer Portal (5 min)
**Why**: Users need to manage their subscriptions

**Steps**:
1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Settings** → **Customer Portal**
3. Click **Activate test link** (for testing)
4. Configure these settings:
   - ✅ Enable **Update payment method**
   - ✅ Enable **Cancel subscription**
   - ✅ Enable **Update subscription** (for upgrades/downgrades)
5. Set **Return URL** to: `https://your-domain.com/subscription`
6. **Save changes**

**Test It**:
- Subscribe to Thriver
- Click "Manage Subscription" button
- Verify portal opens correctly

---

### 2. Enable Password Security (2 min)
**Why**: Protect users from leaked passwords

**Steps**:
1. Open [Lovable Cloud Backend](your-backend-url)
2. Go to **Authentication** → **Policies**
3. Under **Password Security**:
   - ✅ Enable **Password strength requirements**
   - ✅ Enable **Leaked password protection**
4. **Save**

**What This Does**:
- Blocks commonly leaked passwords
- Requires minimum password complexity

---

### 3. Test Complete Payment Flow (8 min)
**Test Card**: `4242 4242 4242 4242` (any future date, any CVC)

**Test Checklist**:
- [ ] Sign up new user
- [ ] Go to /subscription page
- [ ] Click "Subscribe" on Thriver
- [ ] Complete Stripe checkout
- [ ] Verify redirect to dashboard
- [ ] Check subscription shows as active
- [ ] Test "Manage Subscription" button
- [ ] Verify unlimited swipes work
- [ ] Test downgrade/cancel in portal

---

## 🎯 Optional But Recommended (30 minutes)

### 4. Add Analytics (15 min) ✅ DONE
**Status**: Vercel Analytics installed and active

Vercel Analytics will automatically track when deployed:
- User signups
- Subscription purchases  
- Matches created
- Messages sent
- Projects created

**No additional configuration needed!** Analytics activate on deployment.

---

### 5. Set Up Error Monitoring (15 min) ✅ DONE
**Status**: Sentry installed (optional DSN configuration)

Sentry is integrated but needs your DSN to start monitoring:
1. Sign up at [sentry.io](https://sentry.io)
2. Create new React project
3. Copy your DSN
4. Add to environment: `VITE_SENTRY_DSN=your-dsn-here`

**What You Get**:
- Real-time error alerts
- Stack traces
- User context  
- Performance monitoring
- Session replays

See `MONITORING_SETUP.md` for detailed setup instructions.

---

## 📝 Content Preparation (1-2 hours)

### 6. Add Partner Locations
**Where**: `/admin` → Locations Tab

**Add 3-5 locations**:
- Coworking spaces
- Coffee shops
- Studios
- Equipment rental places

**Include**:
- Name, address, description
- Image/logo
- Benefits by tier
- QR code generation

---

### 7. Seed Opportunities
**Where**: Post via landing page or `/discover`

**Create 10-20 sample opportunities**:
- Mix of paid/unpaid/collaboration
- Different roles (filmmaker, musician, designer, etc.)
- Variety of locations (remote, local, hybrid)
- Various compensation types

**Why**: New users need content to discover

---

### 8. Create Test Profiles
**Create 5-10 diverse profiles**:
- Different creative roles
- Various experience levels
- Mix of portfolios
- Different locations

**Why**: Test matching algorithm

---

## 🚀 Deployment

### 9. Deploy to Production
**With Lovable**:
1. Click **Publish** button (top right)
2. Lovable handles deployment automatically
3. Get your production URL

**Custom Domain** (optional):
1. Go to Project Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed
4. Enable SSL (automatic)

---

### 10. Update Stripe Redirect URLs
**After deployment**:

1. Go to Stripe Dashboard
2. Update Customer Portal **return URL** to production domain
3. Update webhook endpoint if using webhooks
4. Switch from test mode to live mode

**Edge Function URLs** (if needed):
- Check-subscription: auto-updated
- Create-checkout: auto-updated
- Customer-portal: needs return_url update

---

## 🔒 Security Checks

### Pre-Launch Security Audit
- [x] RLS enabled on all tables
- [x] No API keys in code
- [x] All secrets in environment variables
- [x] Input validation on all forms
- [x] HTTPS enabled (automatic with Lovable)
- [ ] Password protection enabled (do in step 2)
- [x] Error messages don't leak sensitive info

---

## 📱 Final Testing

### Cross-Browser Testing
Test on:
- [ ] Chrome
- [ ] Safari
- [ ] Firefox
- [ ] Edge
- [ ] Mobile Chrome (Android)
- [ ] Mobile Safari (iOS)

### Key Flows to Test
1. **Sign Up Flow**:
   - [ ] With valid invite code
   - [ ] Email validation works
   - [ ] Redirects to onboarding

2. **Subscription Flow**:
   - [ ] Free → Thriver upgrade
   - [ ] Thriver → Creator Pro upgrade
   - [ ] Downgrade in portal
   - [ ] Cancel and renew

3. **Matching Flow**:
   - [ ] Swipe left/right
   - [ ] Match notification
   - [ ] Send first message

4. **Project Flow**:
   - [ ] Create project
   - [ ] Invite collaborator
   - [ ] Add milestone
   - [ ] Complete task

---

## 🎯 Launch Day

### Morning Of
- [ ] Check all systems operational
- [ ] Test payment flow one more time
- [ ] Verify email notifications working
- [ ] Check mobile responsiveness
- [ ] Clear any test data

### After Launch
- [ ] Monitor Supabase logs for errors
- [ ] Watch Stripe dashboard for payments
- [ ] Check analytics for traffic
- [ ] Respond to support tickets quickly

---

## 📊 Week 1 Metrics to Watch

### Success Indicators
- **Sign-up rate**: Target 10-50/day
- **Activation rate**: 60%+ complete profile
- **Subscription rate**: 5-10% convert to paid
- **Engagement**: 30%+ daily active users
- **Match rate**: 20%+ of swipes result in matches

### Red Flags
- ⚠️ Error rate > 5%
- ⚠️ Bounce rate > 70%
- ⚠️ No conversions to paid
- ⚠️ Support tickets piling up

---

## 🎉 You're Ready!

### Pre-Launch Checklist Summary
Essential:
- [x] Code complete and tested
- [x] Database configured with RLS
- [x] Stripe products created
- [ ] Stripe Customer Portal configured (step 1)
- [ ] Password security enabled (step 2)
- [ ] Payment flow tested (step 3)

Recommended:
- [x] Analytics added (Vercel Analytics)
- [x] Error monitoring setup (Sentry integrated)
- [ ] Content seeded (steps 6-8)
- [ ] Custom domain configured (step 9)
- [ ] Production URLs updated (step 10)

---

## 🆘 Troubleshooting Common Issues

### Issue: Subscription not showing after payment
**Fix**: Check `check-subscription` edge function logs

### Issue: Customer Portal not working
**Fix**: Ensure it's activated in Stripe dashboard

### Issue: Users can't sign up
**Fix**: Check invite code system, verify database connection

### Issue: Images not loading
**Fix**: Check storage bucket policies in Supabase

### Issue: Slow page loads
**Fix**: Check Supabase query performance, enable caching

---

## 📞 Support Resources

- **Lovable Docs**: https://docs.lovable.dev
- **Supabase Docs**: https://supabase.com/docs
- **Stripe Docs**: https://stripe.com/docs
- **Your Backend**: [Lovable Cloud Dashboard]

---

**Total Setup Time**: 15 min (essential) + 30 min (recommended) = 45 minutes

**You're ready to THRIVE! 🚀**
