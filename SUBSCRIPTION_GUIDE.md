# Kretopia Subscription System Guide

## Overview

Kretopia uses Stripe for subscription management with two tiers: Free and Pro ($12/month with 7-day free trial).

## Subscription Tiers

### Free Tier
- **Price**: $0
- **Features**:
  - 10 swipes per day
  - Basic profile
  - Direct messaging
  - 1 active project
  - Portfolio showcase

### Thriver ($9/month)
- **Stripe Product ID**: `prod_TA72LxYWp18g5A`
- **Stripe Price ID**: `price_1SDmofJvOS7zG18hIQ8v9pHA`
- **Features**:
  - Unlimited swipes
  - AI match recommendations
  - Profile verification badge
  - Unlimited projects
  - Advanced analytics
  - Undo swipe feature
  - 5% partner discounts

### Creator Pro ($29/month)
- **Stripe Product ID**: `prod_TA73Hatv66ZqLu`
- **Stripe Price ID**: `price_1SDmouJvOS7zG18hHZgIbITt`
- **Features**:
  - Everything in Thriver
  - Featured profile (2x visibility)
  - Priority matching
  - Advanced collaboration tools
  - 15% partner discounts
  - Early access to new features
  - Dedicated support

## Technical Implementation

### Edge Functions

#### 1. create-checkout
**Purpose**: Creates Stripe Checkout session for new subscriptions
**Location**: `supabase/functions/create-checkout/index.ts`
**How it works**:
- Accepts priceId in request body
- Checks for existing Stripe customer
- Creates new Checkout session
- Redirects to: `/dashboard?subscription_success=true` on success

#### 2. check-subscription
**Purpose**: Verifies user's subscription status with Stripe
**Location**: `supabase/functions/check-subscription/index.ts`
**How it works**:
- Called automatically on login and periodically
- Fetches active subscriptions from Stripe
- Maps product IDs to tier names
- Updates user profile with subscription info
- Returns: `{ subscribed, tier, product_id, subscription_end }`

#### 3. customer-portal
**Purpose**: Opens Stripe Customer Portal for subscription management
**Location**: `supabase/functions/customer-portal/index.ts`
**How it works**:
- Finds customer by email
- Creates portal session
- Returns portal URL for user to manage their subscription

### Frontend Integration

#### Subscription Configuration
**File**: `src/lib/subscriptionConfig.ts`
- Centralized source of truth for all subscription data
- Product IDs, prices, features
- Legacy product mapping
- Helper functions for tier display names

#### Subscription Page
**File**: `src/pages/Subscription.tsx`
- Displays all available tiers
- Shows current user's plan
- Subscribe buttons for each tier
- "Manage Subscription" button for active subscribers

#### Auth Hook
**File**: `src/hooks/useAuth.tsx`
- Provides `subscriptionInfo` in auth context
- Automatically checks subscription on login
- Available throughout the app

### Database

#### Profiles Table Fields
```sql
- subscription_tier: text (free, thriver, creator_pro)
- subscription_status: text (none, active, cancelled, etc.)
- subscription_product_id: text (Stripe product ID)
- subscription_end_date: timestamp
- stripe_customer_id: text
- stripe_subscription_id: text
```

## User Flow

### Subscribing
1. User clicks "Subscribe" on pricing card
2. `create-checkout` edge function called
3. User redirected to Stripe Checkout
4. After payment, redirected to `/dashboard?subscription_success=true`
5. Dashboard calls `check-subscription`
6. User profile updated with subscription info
7. Success toast shown

### Managing Subscription
1. User clicks "Manage Subscription"
2. `customer-portal` edge function called
3. User redirected to Stripe Customer Portal
4. Can update payment method, cancel, etc.
5. Returns to Kretopia
6. Subscription status automatically synced

### Checking Status
- Automatic on login/token refresh
- Manual via `checkSubscription()` function
- Updates happen in background
- UI reflects changes immediately

## Testing

### Test Mode
1. Use Stripe test mode keys
2. Test card: `4242 4242 4242 4242`
3. Any future expiry date
4. Any CVC

### Verify Flow
1. Subscribe to Thriver
2. Check profile shows correct tier
3. Verify features are unlocked
4. Test customer portal
5. Test cancellation
6. Verify downgrade to free

## Stripe Configuration Required

### Before Launch
1. **Enable Customer Portal** in Stripe Dashboard
   - Go to Settings → Customer Portal
   - Configure allowed actions (cancel, update payment, etc.)
   - Set return URL to your domain

2. **Configure Webhook Endpoints** (optional, not currently used)
   - If you want real-time updates
   - Point to your edge function URL

3. **Set Business Information**
   - Business name
   - Support email
   - Terms of service
   - Privacy policy URLs

## Troubleshooting

### Common Issues

**Issue**: Subscription not showing after payment
**Solution**: Check that `check-subscription` is being called after redirect

**Issue**: Wrong tier displayed
**Solution**: Verify product ID mapping in `check-subscription` edge function

**Issue**: Customer portal not opening
**Solution**: Ensure Stripe Customer Portal is enabled in dashboard

**Issue**: Payment succeeded but user still on free tier
**Solution**: Check console logs in edge function logs for errors

### Debugging
1. Check browser console for errors
2. Check Supabase edge function logs
3. Check Stripe dashboard for payment status
4. Verify product/price IDs match

## Maintenance

### Changing Prices
1. Create new price in Stripe (don't delete old ones)
2. Update price ID in `subscriptionConfig.ts`
3. Update `create-checkout` if needed
4. Deploy changes

### Adding New Tier
1. Create product and price in Stripe
2. Add to `SUBSCRIPTION_PRODUCTS` in `subscriptionConfig.ts`
3. Add to `SUBSCRIPTION_TIERS` in `Subscription.tsx`
4. Update `check-subscription` product mapping
5. Update `mapProductIdToTier` function
6. Test thoroughly

## Security Notes

- All subscription checks require authentication
- RLS policies protect subscription data
- Stripe keys stored as environment variables
- Customer portal sessions expire automatically
- Subscription status cached to reduce API calls

---

**Need Help?**
- Stripe API Docs: https://stripe.com/docs/api
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- Kretopia Support: [your support email]
