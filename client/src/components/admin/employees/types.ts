export type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phoneNumber: string | null;
  points: number;
  loginAttempts: number;
  isLocked: boolean;
  employeeId?: string | null;

  // ✅ NEW
  bulkBuyAllowed?: boolean;
  role?: "user" | "admin" | "procurement";
};