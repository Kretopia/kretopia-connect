import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Camera, CheckCircle, XCircle, Loader2, Shield, Sparkles, UserCheck, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClaimProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: any;
  onSuccess: () => void;
}

type Step = 'intro' | 'camera' | 'verifying' | 'credentials' | 'creating' | 'success' | 'failed';

export function ClaimProfileDialog({ open, onOpenChange, profile, onSuccess }: ClaimProfileDialogProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('intro');
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [newUserId, setNewUserId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      // First transition to camera step so video element is mounted
      setStep('camera');
      
      // Small delay to ensure DOM is ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user', 
          width: { ideal: 640 }, 
          height: { ideal: 480 } 
        } 
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Ensure video plays after stream is attached
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(e => {
            console.error('Video play error:', e);
          });
        };
      }
    } catch (error: any) {
      console.error('Camera access error:', error);
      setStep('intro');
      if (error.name === 'NotAllowedError') {
        toast.error("Camera permission denied. Please allow camera access and try again.");
      } else if (error.name === 'NotFoundError') {
        toast.error("No camera found. Please connect a camera and try again.");
      } else {
        toast.error("Camera access required for identity verification");
      }
    }
  };

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const handleStartVerification = async () => {
    // Always start with camera verification first
    startCamera();
  };

  const handleCreateAccountAndVerify = async () => {
    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setIsCreatingAccount(true);
    try {
      // Create account with auto-confirm enabled
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: profile.full_name,
            account_type: 'individual'
          }
        }
      });

      if (error) {
        if (error.message.includes('already registered')) {
          toast.error("This email is already registered. Please sign in instead.");
        } else {
          throw error;
        }
        return;
      }

      if (data.user) {
        setNewUserId(data.user.id);
        toast.success("Account created! Now let's verify your identity.");
        startCamera();
      }
    } catch (error: any) {
      console.error('Account creation error:', error);
      toast.error(error.message || "Failed to create account");
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const captureAndVerify = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Flip horizontally for selfie mode
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);

    const selfieDataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setSelfieImage(selfieDataUrl);
    stopCamera();
    setStep('verifying');

    try {
      // Call AI verification edge function
      const { data, error } = await supabase.functions.invoke('verify-profile-claim', {
        body: {
          profileId: profile.user_id,
          profileImageUrl: profile.avatar_url,
          selfieImage: selfieDataUrl,
          profileName: profile.full_name
        }
      });

      if (error) throw error;

      setVerificationResult(data);
      
      if (data.verified) {
        // Face verified! Now check if user needs to create account
        if (user) {
          // User is already logged in, complete the claim
          await completeProfileClaim(user.id);
        } else {
          // User needs to create account first
          toast.success("Identity verified! Now create your account.");
          setStep('credentials');
        }
      } else {
        setStep('failed');
      }
    } catch (error) {
      console.error('Verification error:', error);
      setStep('failed');
      toast.error("Verification failed. Please try again.");
    }
  };

  const completeProfileClaim = async (claimingUserId: string) => {
    try {
      // Transfer unclaimed profile data to the new user's profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          full_name: profile.full_name,
          role: profile.role,
          bio: profile.bio,
          avatar_url: profile.avatar_url,
          location: profile.location,
          professional_skills: profile.professional_skills,
          imported_data: profile.imported_data,
          imported_from_url: profile.imported_from_url,
        })
        .eq('user_id', claimingUserId);

      if (updateError) {
        console.error('Profile update error:', updateError);
        toast.error("Verified but failed to transfer profile. Please contact support.");
        setStep('failed');
        return;
      }

      // Mark the original unclaimed profile as claimed + set industry tier (server-side)
      await supabase.rpc('finalize_unclaimed_profile_claim' as any, {
        p_unclaimed_user_id: profile.user_id,
      });

      // Transfer credits from unclaimed profile to new user
      await supabase
        .from('credits')
        .update({ user_id: claimingUserId })
        .eq('user_id', profile.user_id);

      // Transfer awards from unclaimed profile to new user
      await supabase
        .from('awards')
        .update({ user_id: claimingUserId })
        .eq('user_id', profile.user_id);

      // Transfer press links from unclaimed profile to new user
      await supabase
        .from('press_links')
        .update({ user_id: claimingUserId })
        .eq('user_id', profile.user_id);

      setStep('success');
      toast.success("Profile claimed successfully!");
    } catch (error) {
      console.error('Claim error:', error);
      setStep('failed');
      toast.error("Failed to claim profile. Please contact support.");
    }
  };

  const handleCreateAccountAndClaim = async () => {
    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setIsCreatingAccount(true);
    setStep('creating');
    
    try {
      // Create account with auto-confirm enabled
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: profile.full_name,
            account_type: 'individual'
          }
        }
      });

      if (error) {
        if (error.message.includes('already registered')) {
          toast.error("This email is already registered. Please sign in instead.");
          setStep('credentials');
        } else {
          throw error;
        }
        return;
      }

      if (data.user) {
        setNewUserId(data.user.id);
        // Now complete the profile claim
        await completeProfileClaim(data.user.id);
      }
    } catch (error: any) {
      console.error('Account creation error:', error);
      toast.error(error.message || "Failed to create account");
      setStep('credentials');
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const handleClose = () => {
    stopCamera();
    setStep('intro');
    setSelfieImage(null);
    setVerificationResult(null);
    setEmail('');
    setPassword('');
    setNewUserId(null);
    onOpenChange(false);
    if (step === 'success') {
      onSuccess();
    }
  };

  const retryVerification = () => {
    setSelfieImage(null);
    setVerificationResult(null);
    setStep('intro');
  };

  const handleSuccessRedirect = () => {
    handleClose();
    // Redirect to the user's own profile
    const claimingUserId = user?.id || newUserId;
    if (claimingUserId) {
      navigate('/profile');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Claim Your Profile
          </DialogTitle>
          <DialogDescription>
            Verify your identity to claim this profile
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {step === 'intro' && (
            <>
              {/* Profile Preview */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border">
                <Avatar className="h-14 w-14 border-2 border-amber-500/30">
                  <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
                  <AvatarFallback>
                    {profile.full_name?.split(' ').map((n: string) => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{profile.full_name}</h3>
                  <p className="text-sm text-muted-foreground truncate">{profile.role}</p>
                  <Badge variant="secondary" className="mt-1 text-xs bg-amber-500/20 text-amber-500">
                    Unclaimed
                  </Badge>
                </div>
              </div>

              {/* How it works */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium">How verification works:</h4>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-medium text-primary">1</span>
                    </div>
                    <span>Take a quick selfie to verify it's you</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-medium text-primary">2</span>
                    </div>
                    <span>AI compares your face with the profile photo</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-medium text-primary">3</span>
                    </div>
                    <span>Create your account and claim your profile</span>
                  </div>
                </div>
              </div>

              {/* Industry Verified Badge Preview */}
              <div className="p-3 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <Sparkles className="h-4 w-4" />
                  <span className="text-sm font-medium">Industry Verified Badge</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Upon claiming, you'll receive the exclusive Industry Verified badge recognizing your professional achievements.
                </p>
              </div>

              <Button onClick={handleStartVerification} className="w-full gap-2">
                <Camera className="h-4 w-4" />
                Start Face Verification
              </Button>
            </>
          )}

          {step === 'credentials' && (
            <>
              {/* Verification Success Banner */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-green-500/10 border border-green-500/30">
                <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="font-semibold text-green-600 dark:text-green-400">Identity Verified!</p>
                  <p className="text-xs text-muted-foreground">Now create your account to claim this profile</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password">Create Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="At least 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              <Button 
                onClick={handleCreateAccountAndClaim} 
                className="w-full gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0"
                disabled={isCreatingAccount}
              >
                {isCreatingAccount ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserCheck className="h-4 w-4" />
                )}
                {isCreatingAccount ? "Claiming Profile..." : "Create Account & Claim Profile"}
              </Button>
            </>
          )}

          {step === 'creating' && (
            <div className="py-8 space-y-4 text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
              <div>
                <p className="font-semibold">Creating your account...</p>
                <p className="text-sm text-muted-foreground">Transferring your profile and achievements</p>
              </div>
            </div>
          )}

          {step === 'camera' && (
            <>
              <div className="relative aspect-[4/3] bg-black rounded-xl overflow-hidden">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                {/* Face guide overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-48 border-2 border-dashed border-white/50 rounded-full" />
                </div>
              </div>
              <canvas ref={canvasRef} className="hidden" />
              
              <p className="text-center text-sm text-muted-foreground">
                Position your face within the circle and tap capture
              </p>
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={captureAndVerify} className="flex-1 gap-2">
                  <Camera className="h-4 w-4" />
                  Capture & Verify
                </Button>
              </div>
            </>
          )}

          {step === 'verifying' && (
            <div className="py-8 space-y-4 text-center">
              <div className="flex justify-center gap-4">
                {selfieImage && (
                  <div className="relative">
                    <img 
                      src={selfieImage} 
                      alt="Your selfie"
                      className="w-20 h-20 rounded-full object-cover border-2 border-muted"
                    />
                    <span className="absolute -bottom-1 -right-1 text-xs bg-background px-1 rounded">You</span>
                  </div>
                )}
                <div className="flex items-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
                <div className="relative">
                  <Avatar className="h-20 w-20 border-2 border-muted">
                    <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
                    <AvatarFallback>
                      {profile.full_name?.split(' ').map((n: string) => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute -bottom-1 -right-1 text-xs bg-background px-1 rounded">Profile</span>
                </div>
              </div>
              <div>
                <h3 className="font-medium">Verifying Identity...</h3>
                <p className="text-sm text-muted-foreground">AI is comparing your face with the profile photo</p>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="py-6 space-y-4 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Identity Verified!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Your profile has been claimed with all credits and achievements transferred.
                </p>
              </div>
              
              {/* Industry Verified Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/50">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span className="font-semibold text-amber-600 dark:text-amber-400">Industry Verified</span>
              </div>
              
              {verificationResult?.confidence && (
                <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                  {Math.round(verificationResult.confidence * 100)}% match confidence
                </Badge>
              )}
              <Button onClick={handleSuccessRedirect} className="w-full gap-2">
                <Sparkles className="h-4 w-4" />
                View Your Profile
              </Button>
            </div>
          )}

          {step === 'failed' && (
            <div className="py-6 space-y-4 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="h-8 w-8 text-destructive" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Verification Failed</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {verificationResult?.reason || "We couldn't verify your identity. This could be due to lighting, image quality, or the faces not matching."}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                <p>Need help? Email us at <a href="mailto:support@kretopia.com" className="text-primary hover:underline">support@kretopia.com</a> with proof of identity for manual review.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={retryVerification} className="flex-1">
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
