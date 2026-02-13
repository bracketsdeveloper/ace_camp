// auth-otp.ts (or wherever these handlers live)
import type { Request, Response } from "express";
import { storage } from "./storage";
import { emailService } from "./email-service";
import "dotenv/config";

function normalizeEmail(input?: string | null): string {
  if (!input) return "";
  return String(input).trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

type OtpIssue = {
  id: string;
  email: string;
  expiresAt: Date | string | null;
  metadata?: { localCode?: string | null } | null;
};

async function saveLocalOtpIssue(args: {
  email: string;
  code: string;
  timeoutSec: number;
}): Promise<OtpIssue> {
  const expiresAt = new Date(Date.now() + args.timeoutSec * 1000);
  const rec = await storage.createOTP({
    email: args.email,
    code: args.code,
    expiresAt,
    metadata: { localCode: args.code },
  } as any);
  return rec as OtpIssue;
}

async function loadLatestOtpForEmail(email: string): Promise<OtpIssue | null> {
  try {
    const rec = await storage.getLastOTPForEmail(email);
    return (rec as any) || null;
  } catch (e) {
    console.error("[otp] load latest failed:", (e as any)?.message || e);
    return null;
  }
}

async function markOtpUsed(otpId: string): Promise<void> {
  try {
    await storage.markOTPAsUsed(otpId);
  } catch (e) {
    console.warn("[otp] mark used failed:", (e as any)?.message || e);
  }
}

/**
 * ✅ Key rule:
 * - If employee exists in DB -> allow login even if domain is NOT whitelisted
 * - If employee does NOT exist -> require domain whitelist (and optionally autoCreateUser)
 */
async function getLoginPolicy(email: string) {
  const emp = await storage.getEmployeeByEmail(email);
  const domainCheck = await storage.checkDomainWhitelisted(email);

  const exists = !!emp;
  const domainWhitelisted = !!domainCheck?.isWhitelisted;
  const domainConfig = domainCheck?.domain;

  const allowLogin =
    exists || domainWhitelisted; // existing employees bypass domain whitelist

  const canAutoCreate =
    !exists && domainWhitelisted && !!domainConfig?.autoCreateUser;

  return { emp, exists, domainWhitelisted, domainConfig, allowLogin, canAutoCreate };
}

// =======================
// lookupByEmail (UPDATED)
// =======================
export async function lookupByEmail(req: Request, res: Response) {
  try {
    const email = normalizeEmail(req.query.email as any);
    if (!email) return res.status(400).json({ message: "email required" });

    const { emp, exists, domainWhitelisted, domainConfig } = await getLoginPolicy(email);

    // If employee exists, return their data regardless of domain whitelist
    if (exists && emp) {
      return res.json({
        firstName: emp.firstName || null,
        lastName: emp.lastName || null,
        exists: true,
        domainWhitelisted, // informational
        autoCreate: false,
      });
    }

    // Employee not found: only whitelisted domains can proceed to autoCreate (if enabled)
    return res.json({
      firstName: null,
      lastName: null,
      exists: false,
      domainWhitelisted,
      autoCreate: domainWhitelisted ? !!domainConfig?.autoCreateUser : false,
      defaultPoints: domainWhitelisted ? (domainConfig?.defaultPoints || 0) : 0,
    });
  } catch (e) {
    console.error("lookupByEmail error:", (e as any)?.message || e);
    return res.status(500).json({ message: "Lookup failed" });
  }
}

// =======================
// sendOTP (UPDATED)
// =======================
export async function sendOTP(req: Request, res: Response) {
  try {
    const rawEmail = (req.body as any)?.email;
    if (!rawEmail) return res.status(400).json({ message: "email required" });

    const email = normalizeEmail(rawEmail);
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ message: "Invalid email address" });
    }

    const policy = await getLoginPolicy(email);

    // ✅ allow login for existing employees even if domain not whitelisted
    if (!policy.allowLogin) {
      return res.status(403).json({
        message:
          "Your email domain is not authorized, and no employee account exists. Please contact your administrator.",
      });
    }

    let user = policy.emp;
    let isNewUser = false;

    // Auto-create user only for whitelisted domains with autoCreateUser enabled
    if (!user && policy.canAutoCreate) {
      const emailName = email.split("@")[0];
      const firstName = emailName.split(".")[0] || "User";
      const lastName = emailName.split(".")[1] || "";

      user = await storage.createEmployee({
        firstName: firstName.charAt(0).toUpperCase() + firstName.slice(1),
        lastName: lastName ? lastName.charAt(0).toUpperCase() + lastName.slice(1) : "",
        email,
        points: policy.domainConfig?.defaultPoints || 0,
      } as any);

      isNewUser = true;
    }

    // If still no user -> employee doesn't exist and autoCreate isn't allowed
    if (!user) {
      return res.status(404).json({
        message: "Account not found. Please contact your administrator to create an account.",
      });
    }

    const employeePrefill = { firstName: user.firstName ?? "", lastName: user.lastName ?? "" };

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const timeoutSec = 600;

    await saveLocalOtpIssue({ email, code, timeoutSec });

    const branding = await storage.getBranding();
    const companyName = branding?.companyName || "TechCorp";

    const emailSent = await emailService.sendOTP(email, code, companyName);
    if (!emailSent) {
      return res.status(500).json({ message: "Failed to send OTP email" });
    }

    console.log(`OTP sent to ${email}: ${code} (valid ${timeoutSec}s)`);

    return res.json({
      ok: true,
      timeoutSec,
      employee: employeePrefill,
      isNewUser,
      message: isNewUser ? "Account created! OTP sent to your email." : "OTP sent to your email.",
    });
  } catch (e) {
    console.error("sendOTP error:", (e as any)?.message || e);
    return res.status(500).json({ message: "Failed to send OTP" });
  }
}

// =======================
// verifyOTP (UPDATED)
// =======================
export async function verifyOTP(req: Request, res: Response) {
  try {
    const rawEmail = (req.body as any)?.email;
    const code = String((req.body as any)?.code || "").trim();
    const firstName = (req.body as any)?.firstName || "";
    const lastName = (req.body as any)?.lastName || "";

    const email = normalizeEmail(rawEmail);
    if (!email || !code) return res.status(400).json({ message: "email and code required" });

    const policy = await getLoginPolicy(email);

    // ✅ allow existing employees even if domain not whitelisted
    if (!policy.allowLogin) {
      return res.status(403).json({
        message:
          "Your email domain is not authorized, and no employee account exists. Please contact your administrator.",
      });
    }

    const otpRec = await loadLatestOtpForEmail(email);
    if (!otpRec) return res.status(400).json({ message: "No OTP issued" });

    if (otpRec.expiresAt && new Date(otpRec.expiresAt) < new Date()) {
      return res.status(400).json({ message: "OTP expired" });
    }

    const localCode = (otpRec.metadata as any)?.localCode || (otpRec as any)?.code || "";
    if (!localCode || localCode !== code) {
      return res.status(401).json({ message: "Invalid or expired OTP" });
    }

    await markOtpUsed(otpRec.id);

    let user = policy.emp;

    // Auto-create only for whitelisted + autoCreateUser
    if (!user && policy.canAutoCreate) {
      const emailName = email.split("@")[0];
      const defaultFirstName = firstName || emailName.split(".")[0] || "User";
      const defaultLastName = lastName || emailName.split(".")[1] || "";

      user = await storage.createEmployee({
        firstName: defaultFirstName.charAt(0).toUpperCase() + defaultFirstName.slice(1),
        lastName: defaultLastName ? defaultLastName.charAt(0).toUpperCase() + defaultLastName.slice(1) : "",
        email,
        points: policy.domainConfig?.defaultPoints || 0,
      } as any);
    }

    if (!user) {
      return res.status(404).json({
        message: "Account not found. Please contact your administrator.",
      });
    }

    const session = await storage.createSession(user.id);

    return res.json({
      token: session.token,
      employee: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        points: user.points ?? 0,
      },
      expiresAt: session.expiresAt,
    });
  } catch (e) {
    console.error("verifyOTP error:", (e as any)?.message || e);
    return res.status(500).json({ message: "Failed to verify OTP" });
  }
}
