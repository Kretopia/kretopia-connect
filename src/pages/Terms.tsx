import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

const Terms = () => {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <SEO 
        title="Terms of Service - Kretopia"
        description="Terms and conditions for using Kretopia platform"
      />

      {/* Legal notice - professional version */}

      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Terms of Service</CardTitle>
          <p className="text-muted-foreground">Last Updated: {new Date().toLocaleDateString()}</p>
        </CardHeader>
        <CardContent className="prose dark:prose-invert max-w-none space-y-6">
          <section>
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing and using Kretopia ("the Platform"), you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to these Terms of Service, please do not use the Platform.
            </p>
          </section>

          <section>
            <h2>2. Description of Service</h2>
            <p>
              Kretopia is a professional networking and collaboration platform for creators, offering features including:
            </p>
            <ul>
              <li>Profile creation and portfolio showcase</li>
              <li>Connection and collaboration tools</li>
              <li>Opportunity discovery and application</li>
              <li>Project management workspace</li>
              <li>Payment processing for projects and subscriptions</li>
            </ul>
          </section>

          <section>
            <h2>3. User Accounts</h2>
            <h3>3.1 Account Creation</h3>
            <p>
              You must provide accurate, current, and complete information during registration. You are responsible for maintaining the confidentiality of your account credentials.
            </p>
            <h3>3.2 Account Responsibilities</h3>
            <p>
              You are responsible for all activities that occur under your account. Notify us immediately of any unauthorized use.
            </p>
          </section>

          <section>
            <h2>4. User Content</h2>
            <h3>4.1 Content Ownership</h3>
            <p>
              You retain all rights to the content you upload, post, or display on the Platform. By posting content, you grant Kretopia a worldwide, non-exclusive, royalty-free license to use, reproduce, and display your content solely for operating and improving the Platform.
            </p>
            <h3>4.2 Content Guidelines</h3>
            <p>
              You agree not to post content that:
            </p>
            <ul>
              <li>Violates any laws or regulations</li>
              <li>Infringes on intellectual property rights</li>
              <li>Contains harmful, threatening, or abusive material</li>
              <li>Is fraudulent, false, or misleading</li>
              <li>Violates the privacy or rights of others</li>
            </ul>
          </section>

          <section>
            <h2>5. Payments and Subscriptions</h2>
            <h3>5.1 Subscription Tiers</h3>
            <p>
              Kretopia offers various subscription tiers with different features and pricing. All payments are processed securely through Stripe.
            </p>
            <h3>5.2 Billing</h3>
            <p>
              Subscription fees are billed in advance on a recurring basis (monthly or annually). You authorize us to charge your payment method for all fees.
            </p>
            <h3>5.3 Refunds</h3>
            <p>
              Refund policies vary by subscription type. Please contact support for refund requests.
            </p>
            <h3>5.4 Platform Fees</h3>
            <p>
              Kretopia charges a platform fee on certain transactions between users. Fee structures are clearly disclosed before transactions.
            </p>
          </section>

          <section>
            <h2>6. Prohibited Activities</h2>
            <p>You may not:</p>
            <ul>
              <li>Use the Platform for any illegal purpose</li>
              <li>Impersonate another person or entity</li>
              <li>Interfere with or disrupt the Platform's operation</li>
              <li>Attempt to gain unauthorized access to other accounts</li>
              <li>Collect user information without consent</li>
              <li>Use automated systems (bots) without permission</li>
            </ul>
          </section>

          <section>
            <h2>7. Intellectual Property</h2>
            <p>
              The Platform and its original content, features, and functionality are owned by Kretopia and are protected by international copyright, trademark, and other intellectual property laws.
            </p>
          </section>

          <section>
            <h2>8. Termination</h2>
            <p>
              We may terminate or suspend your account and access to the Platform immediately, without prior notice, for conduct that we believe violates these Terms or is harmful to other users, us, or third parties.
            </p>
          </section>

          <section>
            <h2>9. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Kretopia shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use or inability to use the Platform.
            </p>
          </section>

          <section>
            <h2>10. Dispute Resolution</h2>
            <p>
              Any disputes arising from these Terms will be resolved through binding arbitration in accordance with applicable laws.
            </p>
          </section>

          <section>
            <h2>11. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. We will notify users of significant changes via email or through the Platform.
            </p>
          </section>

          <section>
            <h2>12. Contact Information</h2>
            <p>
              For questions about these Terms, please contact us at: legal@kretopia.com
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
};

export default Terms;
