import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Helmet } from "react-helmet-async";

const BrandVerify = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error" | "no-token">("loading");
  const [result, setResult] = useState<{ project?: string; brand?: string } | null>(null);

  useEffect(() => {
    if (!token) { setStatus("no-token"); return; }
    verify();
  }, [token]);

  const verify = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("verify-brand-credit", {
        body: { action: "verify", token },
      });
      if (error) throw error;
      setResult(data);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  return (
    <>
      <Helmet><title>Brand Verification | Kretopia Credits</title></Helmet>
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-primary/5">
        <Card className="max-w-md w-full">
          <CardContent className="text-center py-10 space-y-4">
            {status === "loading" && (
              <>
                <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
                <p className="text-sm text-muted-foreground">Verifying credit...</p>
              </>
            )}
            {status === "success" && (
              <>
                <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
                <h2 className="text-xl font-bold">Credit Verified!</h2>
                <p className="text-sm text-muted-foreground">
                  <strong>{result?.brand}</strong> has confirmed the credit on <strong>{result?.project}</strong>.
                </p>
                <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                  <ShieldCheck className="h-3 w-3 mr-1" /> Brand Verified
                </Badge>
              </>
            )}
            {status === "error" && (
              <>
                <XCircle className="h-16 w-16 text-destructive mx-auto" />
                <h2 className="text-xl font-bold">Verification Failed</h2>
                <p className="text-sm text-muted-foreground">This token is invalid or has already been used.</p>
              </>
            )}
            {status === "no-token" && (
              <>
                <ShieldCheck className="h-16 w-16 text-muted-foreground mx-auto" />
                <h2 className="text-xl font-bold">Brand Verification</h2>
                <p className="text-sm text-muted-foreground">No verification token provided.</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default BrandVerify;
