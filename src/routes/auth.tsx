import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PinKeypad } from "@/components/PinKeypad";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"login" | "register">("login");

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPin, setLoginPin] = useState("");
  const [busy, setBusy] = useState(false);

  // Register
  const [fullName, setFullName] = useState("");
  const [school, setSchool] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPin, setRegPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [regStep, setRegStep] = useState<"pin" | "confirm">("pin");

  const handleLogin = async () => {
    if (!loginEmail || loginPin.length !== 6) {
      toast.error("Enter your email and 6-digit PIN");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim(),
      password: loginPin,
    });
    setBusy(false);
    if (error) {
      toast.error("Invalid email or PIN");
      setLoginPin("");
      return;
    }
    toast.success("Welcome back!");
    navigate({ to: "/dashboard" });
  };

  const handleRegister = async () => {
    if (!fullName || !school || !regEmail) {
      toast.error("Fill in all fields");
      return;
    }
    if (regPin.length !== 6) {
      toast.error("PIN must be exactly 6 digits");
      return;
    }
    if (regPin !== confirmPin) {
      toast.error("PINs do not match");
      setConfirmPin("");
      setRegStep("pin");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: regEmail.trim(),
      password: regPin,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName, school_name: school },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account created. You're signed in.");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto h-14 w-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center mb-2">
            <GraduationCap className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl">SSHS E-Class Record</CardTitle>
          <CardDescription>
            DepEd Strengthened Senior High School Three-Term E-Class Record
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "register")}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="login">Sign In</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input
                  type="email"
                  placeholder="teacher@example.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-center block">Enter your 6-digit PIN</Label>
                <PinKeypad value={loginPin} onChange={setLoginPin} />
              </div>
              <Button
                className="w-full"
                onClick={handleLogin}
                disabled={busy || loginPin.length !== 6}
              >
                {busy ? "Signing in..." : "Sign In"}
              </Button>
            </TabsContent>

            <TabsContent value="register" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Juan Dela Cruz" />
              </div>
              <div className="space-y-2">
                <Label>School Name</Label>
                <Input value={school} onChange={(e) => setSchool(e.target.value)} placeholder="Sample Senior High School" />
              </div>
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} placeholder="teacher@example.com" />
              </div>
              <div className="space-y-2">
                <Label className="text-center block">
                  {regStep === "pin" ? "Create a 6-digit PIN" : "Confirm your PIN"}
                </Label>
                {regStep === "pin" ? (
                  <>
                    <PinKeypad value={regPin} onChange={setRegPin} />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={regPin.length !== 6}
                      onClick={() => setRegStep("confirm")}
                    >
                      Continue
                    </Button>
                  </>
                ) : (
                  <>
                    <PinKeypad value={confirmPin} onChange={setConfirmPin} />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setRegStep("pin");
                          setConfirmPin("");
                        }}
                      >
                        Back
                      </Button>
                      <Button
                        className="flex-1"
                        disabled={busy || confirmPin.length !== 6}
                        onClick={handleRegister}
                      >
                        {busy ? "Creating..." : "Create Account"}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
