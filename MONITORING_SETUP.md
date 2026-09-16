# Monitoring & Analytics Setup Guide

## ✅ Installed

Both Vercel Analytics and Sentry are now integrated into Kretopia!

---

## 📊 Vercel Analytics

### Status: **ACTIVE (Auto-configured)**

Vercel Analytics is now tracking:
- ✅ Page views
- ✅ User interactions  
- ✅ Performance metrics
- ✅ Real-time visitor data

### No Setup Required!
Vercel Analytics works automatically when deployed on Vercel. It's already integrated and will start collecting data immediately upon deployment.

### Access Your Analytics:
1. Go to your Vercel Dashboard
2. Select your Kretopia project
3. Click on "Analytics" tab
4. View real-time and historical data

**Free Tier Includes:**
- Unlimited page views
- Visitor analytics
- Performance insights
- No configuration needed

---

## 🐛 Sentry Error Monitoring

### Status: **CONFIGURED (Needs DSN)**

Sentry is integrated but needs your project DSN to start monitoring errors.

### Setup Steps (5 minutes):

#### 1. Create Sentry Account
- Go to [sentry.io](https://sentry.io)
- Sign up for free (generous free tier)
- Create a new project
- Select "React" as the platform

#### 2. Get Your DSN
- After creating the project, Sentry will show you a DSN
- It looks like: `https://xxx@xxx.ingest.sentry.io/xxx`
- Copy this DSN

#### 3. Add DSN to Environment
In your Lovable project settings, add:
```
VITE_SENTRY_DSN=your-dsn-here
```

#### 4. Deploy
Once deployed with the DSN, Sentry will start capturing:
- ✅ Runtime errors
- ✅ Unhandled promise rejections  
- ✅ Console errors
- ✅ Performance issues
- ✅ User session replays (10% sample rate)
- ✅ Error session replays (100% on errors)

---

## 🎯 What Gets Tracked

### Custom Events (via existing analytics.ts):
- ✅ User sign-ups
- ✅ Matches created
- ✅ Messages sent  
- ✅ Projects created
- ✅ Opportunities posted
- ✅ Subscription purchases
- ✅ Profile completions
- ✅ Connection requests

### Automatic Tracking:
- Page views (Vercel Analytics)
- Errors and crashes (Sentry)
- Performance metrics (both)
- User sessions (Sentry Replay)

---

## 📈 Key Metrics to Monitor Week 1

### Vercel Analytics:
- **Total visitors**: Target 100+ (OG launch)
- **Bounce rate**: Keep under 50%
- **Top pages**: /discover, /dashboard, /subscription
- **Geographic distribution**: Where users are coming from

### Sentry:
- **Error rate**: Keep under 1%  
- **Most common errors**: Fix immediately
- **Affected users**: Who's experiencing issues
- **Error trends**: Watch for spikes after deployments

---

## 🚀 Next Steps

### Immediate:
1. **Deploy to production** - Analytics start working automatically
2. **Add Sentry DSN** (optional but recommended)
3. **Monitor first users** - Watch real-time in Vercel dashboard

### Post-Launch:
4. Review analytics daily for first week
5. Set up Sentry alerts for critical errors
6. Track conversion funnels (signup → paid)
7. Monitor AI feature usage via custom events

---

## 💡 Pro Tips

### Vercel Analytics:
- Use the real-time view on launch day
- Filter by page to see hotspots
- Check mobile vs desktop split
- Monitor load times

### Sentry:
- Create alerts for error spikes
- Use breadcrumbs to debug user flows
- Watch session replays to see what users experienced
- Tag errors by subscription tier for prioritization

---

## 📞 Support

- **Vercel Analytics**: [vercel.com/docs/analytics](https://vercel.com/docs/analytics)
- **Sentry**: [docs.sentry.io](https://docs.sentry.io)
- **Custom Events**: Check `src/lib/analytics.ts` for tracking functions

---

**Status**: ✅ Ready for launch! Analytics will activate on deployment.
