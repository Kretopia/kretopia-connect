import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

const Privacy = () => {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <SEO 
        title="Privacy Policy - Kretopia"
        description="How Kretopia collects, uses, and protects your personal information"
      />

      {/* Legal notice - professional version */}

      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Privacy Policy</CardTitle>
          <p className="text-muted-foreground">Last Updated: {new Date().toLocaleDateString()}</p>
        </CardHeader>
        <CardContent className="prose dark:prose-invert max-w-none space-y-6">
          <section>
            <h2>1. Introduction</h2>
            <p>
              Kretopia ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform.
            </p>
          </section>

          <section>
            <h2>2. Information We Collect</h2>
            
            <h3>2.1 Information You Provide</h3>
            <ul>
              <li><strong>Account Information:</strong> Name, email address, password, profile photo</li>
              <li><strong>Profile Information:</strong> Bio, role, skills, portfolio items, work history</li>
              <li><strong>Payment Information:</strong> Billing details (processed securely through Stripe)</li>
              <li><strong>Communications:</strong> Messages, support requests, feedback</li>
            </ul>

            <h3>2.2 Automatically Collected Information</h3>
            <ul>
              <li><strong>Usage Data:</strong> Pages visited, features used, time spent on platform</li>
              <li><strong>Device Information:</strong> IP address, browser type, operating system</li>
              <li><strong>Cookies and Tracking:</strong> See our Cookie Policy for details</li>
            </ul>
          </section>

          <section>
            <h2>3. How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul>
              <li>Provide and maintain the Platform</li>
              <li>Process transactions and send related information</li>
              <li>Send administrative information and updates</li>
              <li>Respond to support requests</li>
              <li>Personalize your experience</li>
              <li>Improve our services</li>
              <li>Detect and prevent fraud</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2>4. Information Sharing</h2>
            
            <h3>4.1 With Other Users</h3>
            <p>
              Your profile information is visible to other users to facilitate connections and collaborations. You can control visibility settings in your account preferences.
            </p>

            <h3>4.2 Service Providers</h3>
            <p>
              We share information with third-party service providers who perform services on our behalf:
            </p>
            <ul>
              <li><strong>Supabase:</strong> Database and authentication services</li>
              <li><strong>Stripe:</strong> Payment processing</li>
              <li><strong>Cloud Storage:</strong> File hosting services</li>
            </ul>

            <h3>4.3 Legal Requirements</h3>
            <p>
              We may disclose your information if required by law or in response to valid requests by public authorities.
            </p>

            <h3>4.4 Business Transfers</h3>
            <p>
              In the event of a merger, acquisition, or sale of assets, your information may be transferred to the acquiring entity.
            </p>
          </section>

          <section>
            <h2>5. Data Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect your personal information. However, no method of transmission over the internet is 100% secure.
            </p>
            <ul>
              <li>Encrypted data transmission (HTTPS)</li>
              <li>Secure password storage (hashed and salted)</li>
              <li>Regular security audits</li>
              <li>Access controls and authentication</li>
            </ul>
          </section>

          <section>
            <h2>6. Your Rights</h2>
            <p>You have the right to:</p>
            <ul>
              <li><strong>Access:</strong> Request a copy of your personal information</li>
              <li><strong>Correction:</strong> Update or correct inaccurate information</li>
              <li><strong>Deletion:</strong> Request deletion of your personal information</li>
              <li><strong>Portability:</strong> Receive your data in a machine-readable format</li>
              <li><strong>Objection:</strong> Object to certain processing of your data</li>
              <li><strong>Withdrawal:</strong> Withdraw consent at any time</li>
            </ul>
          </section>

          <section>
            <h2>7. Data Retention</h2>
            <p>
              We retain your personal information for as long as necessary to provide our services and comply with legal obligations. When you delete your account, we will delete or anonymize your personal information within 30 days.
            </p>
          </section>

          <section>
            <h2>8. International Data Transfers</h2>
            <p>
              Your information may be transferred to and processed in countries other than your country of residence. We ensure appropriate safeguards are in place for international transfers.
            </p>
          </section>

          <section>
            <h2>9. Children's Privacy</h2>
            <p>
              Kretopia is not intended for users under 18 years of age. We do not knowingly collect information from children under 18.
            </p>
          </section>

          <section>
            <h2>10. Cookies and Tracking</h2>
            <p>
              We use cookies and similar tracking technologies to enhance your experience. You can control cookie preferences through your browser settings.
            </p>
          </section>

          <section>
            <h2>11. Third-Party Links</h2>
            <p>
              The Platform may contain links to third-party websites. We are not responsible for the privacy practices of these external sites.
            </p>
          </section>

          <section>
            <h2>12. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of significant changes via email or through the Platform.
            </p>
          </section>

          <section>
            <h2>13. Contact Us</h2>
            <p>
              For questions about this Privacy Policy or to exercise your rights, contact us at:
            </p>
            <p>
              Email: privacy@kretopia.com<br />
              Address: [Your Business Address]
            </p>
          </section>

          <section>
            <h2>14. Data Protection Officer</h2>
            <p>
              If you have concerns about our data practices, you can contact our Data Protection Officer at: dpo@kretopia.com
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
};

export default Privacy;
