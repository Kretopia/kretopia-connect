import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";

export default function PaymentCanceled() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto py-16 px-4 flex items-center justify-center min-h-screen">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
            <XCircle className="h-10 w-10 text-orange-600 dark:text-orange-400" />
          </div>
          <CardTitle className="text-2xl">Payment Canceled</CardTitle>
          <CardDescription className="text-base mt-2">
            No worries! Your payment was canceled and you haven't been charged.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm text-muted-foreground">
              You can still enjoy the free tier features, or upgrade anytime when you're ready. We'll be here when you want to unlock more!
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Button onClick={() => navigate("/subscription")} className="w-full">
              View Plans Again
            </Button>
            <Button onClick={() => navigate("/circle")} variant="outline" className="w-full">
              Back to Match
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
