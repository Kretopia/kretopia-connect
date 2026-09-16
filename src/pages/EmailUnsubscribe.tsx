import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, MailX } from "lucide-react";

type Status = "loading" | "valid" | "already" | "invalid" | "success" | "error";

const EmailUnsubscribe = () => {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<Status>("loading");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!token) { setStatus("invalid"); return; }
    const validate = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${token}`,
          { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
        );
        const data = await res.json();
        if (!res.ok) { setStatus("invalid"); return; }
        setStatus(data.valid ? "valid" : "already");
      } catch { setStatus("error"); }
    };
    validate();
  }, [token]);

  const handleUnsubscribe = async () => {
    setProcessing(true);
    try {
      const { error } = await supabase.functions.invoke("handle-email-unsubscribe", { body: { token } });
      setStatus(error ? "error" : "success");
    } catch { setStatus("error"); }
    setProcessing(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardContent className="flex flex-col items-center text-center py-10 px-6 space-y-4">
          {status === "loading" && <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />}

          {status === "valid" && (
            <>
              <MailX className="h-12 w-12 text-destructive" />
              <h1 className="text-xl font-bold">Unsubscribe from emails?</h1>
              <p className="text-sm text-muted-foreground">You'll stop receiving app emails from Kretopia. Authentication emails (password resets, etc.) will still be sent.</p>
              <Button onClick={handleUnsubscribe} disabled={processing} variant="destructive" className="mt-2">
                {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Unsubscribe
              </Button>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <h1 className="text-xl font-bold">You've been unsubscribed</h1>
              <p className="text-sm text-muted-foreground">You won't receive app emails from Kretopia anymore.</p>
            </>
          )}

          {status === "already" && (
            <>
              <CheckCircle2 className="h-12 w-12 text-muted-foreground" />
              <h1 className="text-xl font-bold">Already unsubscribed</h1>
              <p className="text-sm text-muted-foreground">This email has already been unsubscribed.</p>
            </>
          )}

          {(status === "invalid" || status === "error") && (
            <>
              <XCircle className="h-12 w-12 text-destructive" />
              <h1 className="text-xl font-bold">{status === "invalid" ? "Invalid link" : "Something went wrong"}</h1>
              <p className="text-sm text-muted-foreground">This unsubscribe link is invalid or has expired.</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailUnsubscribe;
