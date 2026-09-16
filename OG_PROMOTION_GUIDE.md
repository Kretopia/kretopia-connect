# OG Member Promotion System

## Overview
All OG badge users automatically receive **2 months of free Thriver membership** as a thank you for being early supporters.

## How It Works

### Automatic Activation
1. When an OG user logs in, the system automatically detects their badge
2. If they haven't claimed the promotion yet, it's activated instantly
3. They're upgraded to Thriver tier for exactly 2 months
4. A celebration toast notification appears
5. A banner shows on their dashboard tracking days remaining

### What OG Members Get
- **Platform Fee**: Reduced from 15% → 10% on all transactions
- **Storage**: 5GB instead of 1GB
- **AI Features**: Access to all AI-powered tools
- **Partner Discounts**: Full access to 50+ partner locations
- **Priority Support**: Faster response times
- **Advanced Analytics**: Detailed insights and reports

### Expiration Process
- After exactly 2 months, the system automatically reverts them to Free tier
- They receive notification before expiration
- They can choose to continue Thriver by subscribing at $9/month

## Technical Implementation

### Database Fields
```sql
-- Tracks promotion status
og_promotion_used BOOLEAN
og_promotion_expires_at TIMESTAMP
```

### Edge Function
`activate-og-promotion` - Handles:
- Checking OG badge status
- Activating 2-month promotion
- Checking expiration and reverting to free tier

### Frontend Components
- `useOGPromotion` hook - Auto-checks and activates on login
- `OGPromotionBanner` - Shows remaining days on dashboard

## Admin Notes
- Promotion is one-time use per OG user
- Can be manually extended in database if needed
- Tracks exact activation and expiration dates
- System automatically handles tier changes

## Testing
To test the promotion:
1. Create a user with OG badge
2. Log in - should see activation toast
3. Check dashboard for promotion banner
4. Verify tier shows as "thriver"
5. Check ThrivePay fee rate (should be 10%)

## Monitoring
Track promotion usage:
```sql
SELECT 
  COUNT(*) as total_og_users,
  COUNT(CASE WHEN og_promotion_used THEN 1 END) as activated,
  COUNT(CASE WHEN og_promotion_expires_at > NOW() THEN 1 END) as active
FROM profiles
WHERE badge = 'og';
```
