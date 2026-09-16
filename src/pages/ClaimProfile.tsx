import { useState, useEffect } from 'react';
import { CreativeLoader } from "@/components/ui/creative-loader";
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  Mail, 
  Share2, 
  Shield, 
  CheckCircle,
  Loader2,
  UserCheck,
  AlertTriangle,
  ExternalLink,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { SEO } from '@/components/SEO';

interface UnclaimedProfile {
  user_id: string;
  full_name: string;
  role: string;
  bio: string | null;
  avatar_url: string | null;
  location: string | null;
  is_claimed: boolean;
  imported_from_url: string | null;
  claim_token: string | null;
  professional_skills: any;
}

export default function ClaimProfile() {
  const { claimToken } = useParams<{ claimToken: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  const [profile, setProfile] = useState<UnclaimedProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [claimed, setClaimed] = useState(false);
  
  // Form state
  const [verificationMethod, setVerificationMethod] = useState<'email' | 'social' | 'admin'>('email');
  const [email, setEmail] = useState('');
  const [socialProof, setSocialProof] = useState('');
  const [adminMessage, setAdminMessage] = useState('');

  useEffect(() => {
    if (claimToken) {
      fetchProfile();
    }
  }, [claimToken]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, role, bio, avatar_url, location, is_claimed, imported_from_url, claim_token, professional_skills')
        .eq('claim_token', claimToken)
        .single();

      if (error) throw error;
      
      if (data?.is_claimed) {
        toast.error('This profile has already been claimed');
        navigate('/');
        return;
      }
      
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Profile not found or invalid claim link');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  // Instant claim for logged-in users
  const instantClaim = async () => {
    if (!profile || !user || !claimToken) return;
    
    setSubmitting(true);
    try {
      // Call the claim_profile function directly
      const { data: claimResult, error: claimError } = await supabase.rpc('claim_profile', {
        p_claim_token: claimToken,
        p_user_id: user.id
      });
      
      if (claimError) throw claimError;
      
      if (claimResult) {
        setClaimed(true);
        toast.success('Profile claimed successfully! Welcome to Kretopia.');
      } else {
        // Fallback to claim request if instant claim fails
        toast.error('Could not claim instantly. Submitting for review...');
        await submitClaimRequest();
      }
    } catch (error) {
      console.error('Error claiming profile:', error);
      toast.error('Failed to claim profile. Try submitting for review.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitClaimRequest = async () => {
    if (!profile) return;
    
    // Validation
    if (verificationMethod === 'email' && !email) {
      toast.error('Please enter your professional email');
      return;
    }
    if (verificationMethod === 'social' && !socialProof) {
      toast.error('Please provide a link to your social media post');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('profile_claim_requests').insert({
        profile_id: profile.user_id,
        claimant_email: email || user?.email || '',
        claimant_user_id: user?.id,
        verification_method: verificationMethod,
        verification_proof: verificationMethod === 'social' ? socialProof : 
                           verificationMethod === 'admin' ? adminMessage : null,
        status: 'pending'
      });

      if (error) throw error;

      setSubmitted(true);
      toast.success('Claim request submitted! We\'ll review it shortly.');
    } catch (error) {
      console.error('Error submitting claim:', error);
      toast.error('Failed to submit claim request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6"><CreativeLoader size="page" /></div>
    );
  }

  if (!profile) {
    return null;
  }

  // Successfully claimed
  if (claimed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center py-12">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-center mb-2">Welcome to Kretopia!</h2>
            <p className="text-muted-foreground text-center mb-2">
              Your profile has been claimed and data transferred to your account.
            </p>
            <p className="text-sm text-muted-foreground text-center mb-6">
              Now complete your profile to start connecting with other creators.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => navigate('/circle')}>
                Explore Creators
              </Button>
              <Button onClick={() => navigate('/profile')}>
                Complete Profile <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center py-12">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <CheckCircle className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-center mb-2">Claim Request Submitted</h2>
            <p className="text-muted-foreground text-center mb-6">
              We'll review your request and get back to you within 24-48 hours.
            </p>
            {user ? (
              <Button onClick={() => navigate('/circle')}>
                Explore While You Wait
              </Button>
            ) : (
              <Button onClick={() => navigate('/auth')}>
                Create Account
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <SEO 
        title={`Claim Your Profile - ${profile.full_name}`}
        description={`Claim your Kretopia profile for ${profile.full_name}`}
      />
      
      <div className="min-h-screen bg-background py-12 px-4">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Profile Preview */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="secondary" className="bg-amber-500/20 text-amber-600">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Unclaimed Profile
                </Badge>
              </div>
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={profile.avatar_url || undefined} />
                  <AvatarFallback className="text-2xl">
                    {profile.full_name?.split(' ').map(n => n[0]).join('') || '?'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-2xl">{profile.full_name}</CardTitle>
                  <CardDescription className="text-lg">{profile.role}</CardDescription>
                  {profile.location && (
                    <p className="text-sm text-muted-foreground mt-1">{profile.location}</p>
                  )}
                </div>
              </div>
            </CardHeader>
            {profile.bio && (
              <CardContent>
                <p className="text-muted-foreground">{profile.bio}</p>
                {profile.imported_from_url && (
                  <a 
                    href={profile.imported_from_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1 mt-4"
                  >
                    View Source <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </CardContent>
            )}
          </Card>

          {/* Instant Claim for Logged-in Users */}
          {user && (
            <Card className="border-primary/50 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <Sparkles className="h-5 w-5" />
                  Quick Claim
                </CardTitle>
                <CardDescription>
                  You're logged in! Claim this profile instantly and start building your presence.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={instantClaim}
                  disabled={submitting}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <UserCheck className="h-4 w-4 mr-2" />
                  )}
                  Claim Profile Now
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-3">
                  This will transfer the profile data to your account
                </p>
              </CardContent>
            </Card>
          )}

          {/* Sign Up Prompt for Non-logged Users */}
          {!user && (
            <Card className="border-primary/50 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <Sparkles className="h-5 w-5" />
                  Join Kretopia to Claim
                </CardTitle>
                <CardDescription>
                  Create an account to claim this profile and connect with other creators.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={() => navigate(`/auth?redirect=/claim/${claimToken}`)}
                >
                  Create Account <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Already have an account?{' '}
                  <button 
                    onClick={() => navigate(`/auth?redirect=/claim/${claimToken}`)}
                    className="text-white hover:text-[#FF2DA1] hover:underline transition-colors"
                  >
                    Sign in
                  </button>
                </p>
              </CardContent>
            </Card>
          )}

          {/* Alternative Verification (for users who need manual review) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Need Manual Verification?
              </CardTitle>
              <CardDescription>
                If you need additional verification, submit a claim request for review
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={verificationMethod} onValueChange={(v) => setVerificationMethod(v as any)}>
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="email" className="gap-2">
                    <Mail className="h-4 w-4" />
                    <span className="hidden sm:inline">Email</span>
                  </TabsTrigger>
                  <TabsTrigger value="social" className="gap-2">
                    <Share2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Social</span>
                  </TabsTrigger>
                  <TabsTrigger value="admin" className="gap-2">
                    <Shield className="h-4 w-4" />
                    <span className="hidden sm:inline">Manual</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="email" className="space-y-4 mt-6">
                  <div>
                    <Label>Professional Email</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@professional-email.com"
                    />
                    <p className="text-sm text-muted-foreground mt-2">
                      Enter an email associated with your professional work.
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="social" className="space-y-4 mt-6">
                  <div>
                    <Label>Social Media Proof</Label>
                    <Input
                      value={socialProof}
                      onChange={(e) => setSocialProof(e.target.value)}
                      placeholder="https://twitter.com/yourhandle/status/..."
                    />
                    <p className="text-sm text-muted-foreground mt-2">
                      Post about claiming your Kretopia profile from a verified account.
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="admin" className="space-y-4 mt-6">
                  <div>
                    <Label>Tell us how we can verify you</Label>
                    <Textarea
                      value={adminMessage}
                      onChange={(e) => setAdminMessage(e.target.value)}
                      placeholder="Agent contact, management email, official website, etc."
                      className="min-h-[100px]"
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <Button 
                variant="outline"
                className="w-full mt-6" 
                onClick={submitClaimRequest}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <UserCheck className="h-4 w-4 mr-2" />
                )}
                Submit for Review
              </Button>
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card className="bg-muted/30">
            <CardContent className="py-4">
              <p className="text-sm text-muted-foreground text-center">
                Don't recognize this profile? <a href="mailto:support@kretopia.com" className="text-primary hover:underline">Report an issue</a>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
