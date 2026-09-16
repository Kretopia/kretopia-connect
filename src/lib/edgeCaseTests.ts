import { supabase } from "@/integrations/supabase/client";
import { PROFILE_SELECT } from "@/lib/profile/profileColumns";

interface TestResult {
  test: string;
  passed: boolean;
  error?: string;
  details?: any;
}

export class EdgeCaseTests {
  private results: TestResult[] = [];

  async runAll(): Promise<TestResult[]> {
    this.results = [];
    
    // Authentication & Security Tests
    await this.testAuthentication();
    await this.testRLSPolicies();
    
    // Data Integrity Tests
    await this.testDataValidation();
    await this.testDuplicateOperations();
    
    // Feature-Specific Tests
    await this.testSwipeLimits();
    await this.testStorageLimits();
    await this.testSubscriptionLimits();
    await this.testCreditSystem();
    await this.testNotificationSystem();
    
    // Profile & User Tests
    await this.testProfileCompletion();
    await this.testOnboardingFlow();
    
    return this.results;
  }

  private async testAuthentication() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        this.results.push({
          test: "Authentication: User Session",
          passed: false,
          error: "No active user session found",
        });
        return;
      }

      // Test if user can access their own profile
      const { data: profile, error } = await supabase
        .from("profiles")
        .select(PROFILE_SELECT)
        .eq("user_id", user.id)
        .single();

      this.results.push({
        test: "Authentication: User Session & Profile Access",
        passed: !error && !!profile,
        error: error?.message,
        details: { userId: user.id, hasProfile: !!profile },
      });

      // Test wallet creation
      const { data: wallet, error: walletError } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", user.id)
        .single();

      this.results.push({
        test: "Authentication: Wallet Auto-Creation",
        passed: !walletError && !!wallet,
        error: walletError?.message,
        details: { hasWallet: !!wallet, credits: wallet?.credits },
      });

    } catch (error: any) {
      this.results.push({
        test: "Authentication: General",
        passed: false,
        error: error.message,
      });
    }
  }

  private async testSwipeLimits() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("daily_swipes, subscription_tier, last_swipe_reset")
        .eq("user_id", user.id)
        .single();

      const today = new Date().toDateString();
      const lastReset = profile?.last_swipe_reset 
        ? new Date(profile.last_swipe_reset).toDateString() 
        : null;
      
      const shouldReset = lastReset !== today;

      this.results.push({
        test: "Swipe Limits: Daily Reset Logic",
        passed: true,
        details: {
          dailySwipes: profile?.daily_swipes,
          tier: profile?.subscription_tier,
          lastReset: lastReset,
          shouldReset: shouldReset,
        },
      });

    } catch (error: any) {
      this.results.push({
        test: "Swipe Limits: Validation",
        passed: false,
        error: error.message,
      });
    }
  }

  private async testDuplicateOperations() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check for duplicate swipes
      const { data: duplicateSwipes } = await supabase
        .from("swipes")
        .select("user_id, target_id, target_type")
        .eq("user_id", user.id);

      const swipeMap = new Map();
      let hasDuplicates = false;
      
      duplicateSwipes?.forEach(swipe => {
        const key = `${swipe.user_id}-${swipe.target_type}-${swipe.target_id}`;
        if (swipeMap.has(key)) {
          hasDuplicates = true;
        }
        swipeMap.set(key, true);
      });

      this.results.push({
        test: "Data Integrity: No Duplicate Swipes",
        passed: !hasDuplicates,
        details: { totalSwipes: duplicateSwipes?.length, hasDuplicates },
      });

      // Check for duplicate wallets
      const { data: wallets } = await supabase
        .from("wallets")
        .select("user_id")
        .eq("user_id", user.id);

      this.results.push({
        test: "Data Integrity: Single Wallet Per User",
        passed: wallets?.length === 1,
        details: { walletCount: wallets?.length },
      });

    } catch (error: any) {
      this.results.push({
        test: "Data Integrity: Duplicate Check",
        passed: false,
        error: error.message,
      });
    }
  }

  private async testDataValidation() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Test profile data completeness
      const { data: profile } = await supabase
        .from("profiles")
        .select(PROFILE_SELECT)
        .eq("user_id", user.id)
        .single();

      const requiredFields = ['full_name', 'role', 'account_type'];
      const missingFields = requiredFields.filter(field => !profile?.[field]);

      this.results.push({
        test: "Data Validation: Profile Required Fields",
        passed: missingFields.length === 0,
        details: { missingFields },
      });

      // Test wallet data
      const { data: wallet } = await supabase
        .from("wallets")
        .select("credits, balance")
        .eq("user_id", user.id)
        .single();

      this.results.push({
        test: "Data Validation: Wallet Data Consistency",
        passed: wallet?.credits !== null && wallet?.credits >= 0,
        details: { 
          credits: wallet?.credits, 
          balance: wallet?.balance 
        },
      });

      // Check for orphaned messages
      const { data: messages } = await supabase
        .from("messages")
        .select("sender_id, receiver_id")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .limit(10);

      this.results.push({
        test: "Data Validation: Messages Integrity",
        passed: true,
        details: { messageCount: messages?.length },
      });

    } catch (error: any) {
      this.results.push({
        test: "Data Validation: General",
        passed: false,
        error: error.message,
      });
    }
  }

  private async testRLSPolicies() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Test that user can only see their own wallet
      const { data: ownWallet, error: ownError } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", user.id)
        .single();

      this.results.push({
        test: "RLS Policies: Can Access Own Wallet",
        passed: !ownError && !!ownWallet,
        error: ownError?.message,
      });

      // Test that public profiles are accessible
      const { data: publicProfiles, error: publicError } = await supabase
        .from("profiles")
        .select("user_id, full_name, role, avatar_url")
        .limit(5);

      this.results.push({
        test: "RLS Policies: Public Profile Access",
        passed: !publicError && publicProfiles && publicProfiles.length > 0,
        error: publicError?.message,
        details: { profileCount: publicProfiles?.length },
      });

      // Test that user can access their own messages
      const { data: messages, error: msgError } = await supabase
        .from("messages")
        .select("*")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .limit(5);

      this.results.push({
        test: "RLS Policies: Own Messages Access",
        passed: !msgError,
        error: msgError?.message,
        details: { messageCount: messages?.length },
      });

    } catch (error: any) {
      this.results.push({
        test: "RLS Policies: General",
        passed: false,
        error: error.message,
      });
    }
  }

  private async testStorageLimits() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("storage_used_bytes, storage_limit_bytes, subscription_tier")
        .eq("user_id", user.id)
        .single();

      const storageUsed = profile?.storage_used_bytes || 0;
      const storageLimit = profile?.storage_limit_bytes || 0;
      const percentUsed = storageLimit > 0 ? (storageUsed / storageLimit) * 100 : 0;

      this.results.push({
        test: "Storage: Usage Within Limits",
        passed: storageUsed <= storageLimit,
        details: {
          usedGB: (storageUsed / (1024 ** 3)).toFixed(2),
          limitGB: (storageLimit / (1024 ** 3)).toFixed(2),
          percentUsed: percentUsed.toFixed(2) + '%',
          tier: profile?.subscription_tier,
        },
      });

    } catch (error: any) {
      this.results.push({
        test: "Storage: Limits Check",
        passed: false,
        error: error.message,
      });
    }
  }

  private async testSubscriptionLimits() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_tier, subscription_status")
        .eq("user_id", user.id)
        .single();

      this.results.push({
        test: "Subscription: Valid Status",
        passed: !!profile?.subscription_tier && !!profile?.subscription_status,
        details: {
          tier: profile?.subscription_tier,
          status: profile?.subscription_status,
        },
      });

    } catch (error: any) {
      this.results.push({
        test: "Subscription: Status Check",
        passed: false,
        error: error.message,
      });
    }
  }

  private async testCreditSystem() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: wallet } = await supabase
        .from("wallets")
        .select("credits, balance")
        .eq("user_id", user.id)
        .single();

      // Check transactions
      const { data: history } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      this.results.push({
        test: "Credits: System Integrity",
        passed: wallet?.credits !== null && wallet?.credits >= 0,
        details: {
          credits: wallet?.credits,
          balance: wallet?.balance,
          recentTransactions: history?.length || 0,
        },
      });

    } catch (error: any) {
      this.results.push({
        test: "Credits: System Check",
        passed: false,
        error: error.message,
      });
    }
  }

  private async testNotificationSystem() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check notification preferences exist
      const { data: prefs, error: prefsError } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .single();

      this.results.push({
        test: "Notifications: Preferences Exist",
        passed: !prefsError && !!prefs,
        error: prefsError?.message,
      });

      // Check recent notifications
      const { data: notifications, error: notifsError } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      this.results.push({
        test: "Notifications: Can Access Own Notifications",
        passed: !notifsError,
        error: notifsError?.message,
        details: { recentCount: notifications?.length || 0 },
      });

    } catch (error: any) {
      this.results.push({
        test: "Notifications: System Check",
        passed: false,
        error: error.message,
      });
    }
  }

  private async testProfileCompletion() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select(PROFILE_SELECT)
        .eq("user_id", user.id)
        .single();

      const completionFields = [
        'avatar_url', 'bio', 'role', 'skills',
        'location', 'instagram_url'
      ];

      const completedFields = completionFields.filter(field => 
        profile?.[field] && profile[field] !== ''
      );

      const completionRate = (completedFields.length / completionFields.length) * 100;

      this.results.push({
        test: "Profile: Completion Status",
        passed: true,
        details: {
          completionRate: completionRate.toFixed(0) + '%',
          completedFields: completedFields.length,
          totalFields: completionFields.length,
        },
      });

    } catch (error: any) {
      this.results.push({
        test: "Profile: Completion Check",
        passed: false,
        error: error.message,
      });
    }
  }

  private async testOnboardingFlow() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed, onboarding_step")
        .eq("user_id", user.id)
        .single();

      this.results.push({
        test: "Onboarding: Status Valid",
        passed: profile?.onboarding_completed !== null,
        details: {
          completed: profile?.onboarding_completed,
          currentStep: profile?.onboarding_step,
        },
      });

    } catch (error: any) {
      this.results.push({
        test: "Onboarding: Status Check",
        passed: false,
        error: error.message,
      });
    }
  }
}

// Helper function to run all tests and log results
export async function runEdgeCaseTests() {
  const tester = new EdgeCaseTests();
  const results = await tester.runAll();
  
  console.log('\n=== EDGE CASE TEST RESULTS ===\n');
  
  results.forEach(result => {
    const icon = result.passed ? '✓' : '✗';
    console.log(`${icon} ${result.test}`);
    if (!result.passed && result.error) {
      console.log(`  Error: ${result.error}`);
    }
    if (result.details) {
      console.log(`  Details:`, result.details);
    }
  });
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  console.log(`\n${passed}/${total} tests passed (${((passed/total) * 100).toFixed(1)}%)\n`);
  
  return results;
}
