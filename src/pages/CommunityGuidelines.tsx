import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Heart, Shield, AlertTriangle } from "lucide-react";

const CommunityGuidelines = () => {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <SEO 
        title="Community Guidelines - Kretopia"
        description="Guidelines for maintaining a respectful and productive community on Kretopia"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Community Guidelines</CardTitle>
          <p className="text-muted-foreground">Last Updated: {new Date().toLocaleDateString()}</p>
        </CardHeader>
        <CardContent className="prose dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="flex items-center gap-2">
              <Heart className="h-6 w-6" />
              Our Values
            </h2>
            <p>
              Kretopia is a community of creators, collaborators, and innovators. We're committed to fostering a respectful, inclusive, and productive environment where everyone can thrive.
            </p>
          </section>

          <section>
            <h2 className="flex items-center gap-2">
              <Users className="h-6 w-6" />
              Expected Behavior
            </h2>
            
            <h3>Be Respectful</h3>
            <ul>
              <li>Treat all community members with courtesy and respect</li>
              <li>Value diverse perspectives and experiences</li>
              <li>Provide constructive feedback professionally</li>
              <li>Respect others' time and boundaries</li>
            </ul>

            <h3>Be Professional</h3>
            <ul>
              <li>Maintain professional communication in all interactions</li>
              <li>Honor commitments and deadlines</li>
              <li>Be transparent about capabilities and availability</li>
              <li>Respond to messages and requests in a timely manner</li>
            </ul>

            <h3>Be Authentic</h3>
            <ul>
              <li>Represent yourself and your work accurately</li>
              <li>Use real credentials and portfolio items</li>
              <li>Give credit where credit is due</li>
              <li>Be honest about your skills and experience</li>
            </ul>

            <h3>Be Supportive</h3>
            <ul>
              <li>Help fellow creators when you can</li>
              <li>Share knowledge and resources</li>
              <li>Celebrate others' successes</li>
              <li>Provide mentorship to those starting out</li>
            </ul>
          </section>

          <section>
            <h2 className="flex items-center gap-2">
              <AlertTriangle className="h-6 w-6" />
              Prohibited Conduct
            </h2>

            <h3>Harassment and Abuse</h3>
            <ul>
              <li>Harassment, bullying, or intimidation of any kind</li>
              <li>Discriminatory language or behavior</li>
              <li>Threats or violent content</li>
              <li>Sexual harassment or unwelcome advances</li>
            </ul>

            <h3>Fraudulent Activity</h3>
            <ul>
              <li>Misrepresenting your identity or credentials</li>
              <li>Posting fake reviews or testimonials</li>
              <li>Engaging in payment fraud or chargebacks</li>
              <li>Creating duplicate accounts to manipulate ratings</li>
            </ul>

            <h3>Intellectual Property Violations</h3>
            <ul>
              <li>Using copyrighted material without permission</li>
              <li>Claiming others' work as your own</li>
              <li>Violating trademark or patent rights</li>
              <li>Sharing pirated or stolen content</li>
            </ul>

            <h3>Spam and Manipulation</h3>
            <ul>
              <li>Sending unsolicited bulk messages</li>
              <li>Posting irrelevant or repetitive content</li>
              <li>Manipulating platform features or algorithms</li>
              <li>Using bots or automated systems inappropriately</li>
            </ul>

            <h3>Inappropriate Content</h3>
            <ul>
              <li>Adult, explicit, or NSFW content</li>
              <li>Graphic violence or disturbing imagery</li>
              <li>Hate speech or extremist content</li>
              <li>Content promoting illegal activities</li>
            </ul>
          </section>

          <section>
            <h2 className="flex items-center gap-2">
              <Shield className="h-6 w-6" />
              Reporting and Enforcement
            </h2>

            <h3>How to Report</h3>
            <p>
              If you encounter content or behavior that violates these guidelines:
            </p>
            <ul>
              <li>Use the "Report" button on profiles, posts, or messages</li>
              <li>Contact support at: support@kretopia.com</li>
              <li>For urgent safety concerns, email: safety@kretopia.com</li>
            </ul>

            <h3>What We Review</h3>
            <ul>
              <li>All reports are reviewed by our moderation team</li>
              <li>We investigate thoroughly before taking action</li>
              <li>Reporter identities are kept confidential</li>
              <li>False reports may result in account penalties</li>
            </ul>

            <h3>Consequences</h3>
            <p>Violations may result in:</p>
            <ul>
              <li><strong>Warning:</strong> First-time or minor infractions</li>
              <li><strong>Content Removal:</strong> Deletion of violating content</li>
              <li><strong>Temporary Suspension:</strong> Limited platform access</li>
              <li><strong>Permanent Ban:</strong> Account termination for severe or repeated violations</li>
              <li><strong>Legal Action:</strong> For illegal activities or serious harm</li>
            </ul>

            <h3>Appeals</h3>
            <p>
              If you believe a moderation decision was made in error, you can appeal by contacting appeals@kretopia.com within 30 days.
            </p>
          </section>

          <section>
            <h2>Collaboration Guidelines</h2>

            <h3>Clear Communication</h3>
            <ul>
              <li>Clearly define project scope, deliverables, and timelines</li>
              <li>Document agreements in writing</li>
              <li>Keep all parties informed of progress and changes</li>
              <li>Address issues promptly and professionally</li>
            </ul>

            <h3>Fair Compensation</h3>
            <ul>
              <li>Discuss rates and payment terms upfront</li>
              <li>Honor agreed-upon compensation</li>
              <li>Use platform payment systems for protection</li>
              <li>Provide detailed invoices</li>
            </ul>

            <h3>Quality Standards</h3>
            <ul>
              <li>Deliver work that meets agreed specifications</li>
              <li>Meet deadlines or communicate delays early</li>
              <li>Accept reasonable revision requests</li>
              <li>Maintain professional quality throughout</li>
            </ul>
          </section>

          <section>
            <h2>Content Guidelines</h2>

            <h3>Portfolio Content</h3>
            <ul>
              <li>Only showcase work you created or contributed to</li>
              <li>Clearly credit collaborators</li>
              <li>Obtain necessary permissions for client work</li>
              <li>Use appropriate content warnings when needed</li>
            </ul>

            <h3>Opportunity Postings</h3>
            <ul>
              <li>Provide accurate job descriptions and requirements</li>
              <li>Clearly state compensation and terms</li>
              <li>Respond to applications in a timely manner</li>
              <li>Don't post fake opportunities</li>
            </ul>

            <h3>Reviews and Feedback</h3>
            <ul>
              <li>Base reviews on actual experiences</li>
              <li>Be honest but constructive</li>
              <li>Don't use reviews for personal attacks</li>
              <li>Update reviews if situations improve</li>
            </ul>
          </section>

          <section>
            <h2>Changes to Guidelines</h2>
            <p>
              These guidelines may be updated as our community grows and evolves. Significant changes will be communicated to all users.
            </p>
          </section>

          <section>
            <h2>Questions?</h2>
            <p>
              If you have questions about these guidelines, contact us at: community@kretopia.com
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
};

export default CommunityGuidelines;
