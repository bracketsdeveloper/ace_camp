import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { OTPVerificationModal } from "@/components/auth/otp-verification-modal";
import { ArrowRight, CheckCircle, XCircle, Loader2, Building } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import virtusaBg2 from "@assets/virtusa_bg_2.png";

type Branding = {
  id: string;
  logoUrl: string | null;
  companyName: string;
  primaryColor: string;
  accentColor: string;
  bannerUrl: string | null;
  bannerText: string | null;
  updatedAt: string;
};

interface DomainCheckResult {
  isWhitelisted: boolean;
  domain: {
    domain: string;
    autoCreateUser: boolean;
    defaultPoints: number;
    canLoginWithoutEmployeeId: boolean;
  } | null;
}

interface LookupResponse {
  firstName: string | null;
  lastName: string | null;
  exists: boolean;
  domainWhitelisted?: boolean;
  autoCreate?: boolean;
  defaultPoints?: number;
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [fetchedName, setFetchedName] = useState<LookupResponse | null>(null);
  const [isFetchingName, setIsFetchingName] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [prefill, setPrefill] = useState<{ firstName: string; lastName: string } | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);

  const [domainStatus, setDomainStatus] = useState<{
    isWhitelisted: boolean;
    domain: any;
    isLoading: boolean;
    checked: boolean;
  }>({
    isWhitelisted: false,
    domain: null,
    isLoading: false,
    checked: false,
  });

  const { toast } = useToast();
  const { login } = useAuth();
  const [, setLocation] = useLocation();

  const { data: branding } = useQuery<Branding>({ queryKey: ["/api/admin/branding"] });

  const primary = branding?.primaryColor || "#053354";
  const accent = branding?.accentColor || "#02F576";
  const company = branding?.companyName || "Virtusa";
  const logoUrl = branding?.logoUrl || null;

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--brand-primary", primary);
    root.style.setProperty("--brand-accent", accent);
  }, [primary, accent]);

  // Domain check is UI-only (does NOT block login).
  useEffect(() => {
    const checkDomain = async () => {
      const emailDomain = email.split("@")[1];
      if (!emailDomain) {
        setDomainStatus({ isWhitelisted: false, domain: null, isLoading: false, checked: false });
        return;
      }

      setDomainStatus((prev) => ({ ...prev, isLoading: true }));

      try {
        const response = await fetch(`/api/auth/check-domain/${emailDomain}`);
        if (response.ok) {
          const data: DomainCheckResult = await response.json();
          setDomainStatus({
            isWhitelisted: data.isWhitelisted,
            domain: data.domain,
            isLoading: false,
            checked: true,
          });
        } else {
          setDomainStatus({ isWhitelisted: false, domain: null, isLoading: false, checked: true });
        }
      } catch {
        setDomainStatus({ isWhitelisted: false, domain: null, isLoading: false, checked: true });
      }
    };

    const debounce = setTimeout(checkDomain, 500);
    return () => clearTimeout(debounce);
  }, [email]);

  const sendOtpMutation = useMutation({
    mutationFn: async (data: { email: string }) => {
      const res = await apiRequest("POST", "/api/auth/send-otp", data);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      setPrefill(
        fetchedName
          ? { firstName: fetchedName.firstName || "", lastName: fetchedName.lastName || "" }
          : { firstName: "", lastName: "" }
      );
      setIsNewUser(data.isNewUser || false);
      setShowConfirmModal(false);
      setShowVerificationModal(true);
      toast({
        title: "OTP sent",
        description: data.message || "Please check your email",
        variant: "default",
      });
    },
    onError: (err: any) => {
      let message = "Failed to send OTP";
      try {
        const json = JSON.parse(String(err.message).split(": ").slice(1).join(": "));
        message = json?.message || message;
      } catch { }
      toast({ title: "Error", description: message, variant: "destructive" });
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async (data: { email: string; code: string; firstName: string; lastName: string }) => {
      const res = await apiRequest("POST", "/api/auth/verify-otp", data);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      login(data.token, data.employee, data.expiresAt);
      toast({ title: "Login Successful", description: `Welcome, ${data.employee.firstName}!` });
      setShowVerificationModal(false);
      setLocation("/home");
    },
    onError: (err: any) => {
      let message = "Verification failed";
      let remaining: number | undefined;
      let isLocked: boolean | undefined;
      try {
        const json = JSON.parse(String(err.message).split(": ").slice(1).join(": "));
        message = json?.message || message;
        remaining = json?.remainingAttempts;
        isLocked = json?.isLocked;
      } catch { }

      if (isLocked) {
        toast({ title: "Unsuccessful attempts .. Please contact HR Team !!", variant: "destructive" });
        setShowVerificationModal(false);
        return;
      }
      if (remaining === 1) {
        toast({ title: "One attempt left .. Please enter the correct OTP !!", variant: "destructive" });
        return;
      }
      toast({ title: "Verification Failed", description: message, variant: "destructive" });
    },
  });

  // ✅ IMPORTANT: frontend must NOT block based on domain whitelist.
  // It should only show info, and let backend decide via lookup+sendOtp.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      toast({ title: "Error", description: "Please enter a valid email address", variant: "destructive" });
      return;
    }

    setConfirmEmail(normalizedEmail);
    setFetchedName(null);
    setShowConfirmModal(true);
    setIsFetchingName(true);

    try {
      const res = await fetch(`/api/auth/lookup-by-email?email=${encodeURIComponent(normalizedEmail)}`, {
        method: "GET",
        headers: { accept: "application/json" },
      });

      if (!res.ok) {
        const msg = await res.text();
        toast({
          title: "Lookup failed",
          description: msg || "Unable to fetch user information.",
          variant: "destructive",
        });
        setShowConfirmModal(false);
        return;
      }

      const data: LookupResponse = await res.json();
      setFetchedName(data);

      // ✅ allow proceed if:
      // - employee exists (even if domain not whitelisted)
      // - OR backend says autoCreate allowed
      const allowed = Boolean(data.exists || data.autoCreate);

      if (!allowed) {
        toast({
          title: "Account Not Found",
          description: "No employee account exists for this email. Please contact your administrator.",
          variant: "destructive",
        });
        setShowConfirmModal(false);
        return;
      }
    } catch (err: any) {
      toast({
        title: "Lookup error",
        description: err?.message || "Unable to fetch user information.",
        variant: "destructive",
      });
      setShowConfirmModal(false);
    } finally {
      setIsFetchingName(false);
    }
  };

  function ConfirmUserModal() {
    const isExistingUser = Boolean(fetchedName?.exists);
    const isAutoCreateUser = Boolean(fetchedName?.autoCreate && !fetchedName?.exists);

    // ✅ Proceed if backend says exists OR autoCreate (do NOT use domainStatus here)
    const canProceed = !isFetchingName && (isExistingUser || isAutoCreateUser);

    return (
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="max-w-md rounded-2xl border border-white/10 bg-[#071f33]/90 text-white backdrop-blur-md">
          <DialogHeader>
            <DialogTitle className="text-white">Confirm Login</DialogTitle>
            <DialogDescription className="text-white/70">Verify your email and account details</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="confirm-email" className="text-white/80">
                Email Address
              </Label>
              <Input
                id="confirm-email"
                type="email"
                value={confirmEmail}
                readOnly
                className="bg-white/10 text-white border-white/15"
              />
            </div>

            {isExistingUser && fetchedName && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-white/80">First Name</Label>
                  <Input value={fetchedName.firstName || ""} readOnly className="bg-white/10 text-white border-white/15" />
                </div>
                <div>
                  <Label className="text-white/80">Last Name</Label>
                  <Input value={fetchedName.lastName || ""} readOnly className="bg-white/10 text-white border-white/15" />
                </div>
              </div>
            )}

            {/* Info blocks (do not block) */}
            {!domainStatus.isWhitelisted && isExistingUser && (
              <div className="rounded-xl border border-white/15 bg-white/5 p-3">
                <p className="text-sm text-white/80">
                  Your domain is not whitelisted, but your employee account exists — you can proceed.
                </p>
              </div>
            )}


          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowConfirmModal(false)} className="rounded-full">
              Cancel
            </Button>

            <Button
              onClick={() => {
                const finalEmail = confirmEmail.trim().toLowerCase();
                if (!finalEmail || !isValidEmail(finalEmail)) {
                  toast({ title: "Invalid email", description: "Please check the email address.", variant: "destructive" });
                  return;
                }
                if (!canProceed) {
                  toast({
                    title: "Cannot Proceed",
                    description: "Your account cannot be created or accessed.",
                    variant: "destructive",
                  });
                  return;
                }
                setEmail(finalEmail);
                sendOtpMutation.mutate({ email: finalEmail });
              }}
              disabled={!canProceed || sendOtpMutation.isPending}
              className="rounded-full"
              style={{ backgroundColor: accent, color: primary }}
            >
              {sendOtpMutation.isPending
                ? "Sending OTP..."
                : isAutoCreateUser
                  ? "Create Account & Send OTP"
                  : "Send OTP"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const isEmailValid = email.includes("@") && email.includes(".");
  const emailDomain = email.split("@")[1];

  // ✅ Allow clicking "Log in" even if domain not whitelisted (employee may exist)
  const canLogin = isEmailValid && !domainStatus.isLoading;

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${virtusaBg2})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, rgba(2,245,118,0.10) 0%, transparent 55%), linear-gradient(180deg, rgba(5,51,84,0.85) 0%, rgba(5,51,84,0.92) 60%, rgba(5,51,84,0.96) 100%)",
        }}
      />

      <div className="absolute top-8 left-8 z-20">
        {logoUrl ? (
          <img src={logoUrl} alt={`${company} Logo`} className="h-10 md:h-12" />
        ) : (
          <Building className="h-10 w-10 md:h-12 md:w-12" style={{ color: "#FFFFFF" }} />
        )}
      </div>

      <div className="relative min-h-screen flex items-center justify-center p-4 z-10">
        <div className="w-full max-w-2xl text-center">
          <h1 className="text-5xl font-semibold mb-3" style={{ color: "#FFFFFF" }}>
            Welcome
          </h1>
          <p className="text-lg md:text-xl mb-10" style={{ color: "rgba(255,255,255,0.75)" }}>
            Login to your account
          </p>



          <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-md">
            <form onSubmit={handleSubmit} className="space-y-7">
              <div className="text-left">
                <Label htmlFor="email" className="text-base mb-3 block text-white/80">
                  Email Address*
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-14 bg-white/10 text-white border-white/15 rounded-xl placeholder:text-white/40"
                />
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full h-14 text-lg rounded-full flex items-center justify-center gap-2"
                style={{ backgroundColor: accent, color: primary }}
                disabled={sendOtpMutation.isPending || domainStatus.isLoading || !canLogin}
              >
                {sendOtpMutation.isPending ? "Sending..." : domainStatus.isLoading ? "Checking..." : "Log in"}
                <ArrowRight className="h-5 w-5" />
              </Button>

              <p className="text-xs text-white/55">By continuing, you agree to your organization’s access policies.</p>
            </form>
          </div>
        </div>
      </div>

      <ConfirmUserModal />

      <OTPVerificationModal
        isOpen={showVerificationModal}
        onClose={() => setShowVerificationModal(false)}
        initialFirstName={prefill?.firstName || ""}
        initialLastName={prefill?.lastName || ""}
        isLoading={verifyOtpMutation.isPending}
        onVerify={(payload) => {
          const finalEmail = email.trim().toLowerCase();
          verifyOtpMutation.mutate({
            email: finalEmail,
            code: payload.code,
            firstName: payload.firstName,
            lastName: payload.lastName,
          });
        }}
        onChangeEmail={() => {
          setShowVerificationModal(false);
          setEmail("");
        }}
        primaryColor={primary}
        companyName={company}
        isNewUser={isNewUser}
      />
    </div>
  );
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
