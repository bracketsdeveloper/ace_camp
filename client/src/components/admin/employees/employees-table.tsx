import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Save, X, Unlock } from "lucide-react";
import { useState } from "react";
import type { Employee } from "./types";

// ✅ Define allowed roles (match your backend enum/check constraint)
type EmployeeRole = "user" | "admin" | "procurement";

const ROLE_LABEL: Record<EmployeeRole, string> = {
  user: "User",
  admin: "Admin",
  procurement: "Procurement",
};

function roleBadgeVariant(role?: string) {
  switch (role) {
    case "admin":
      return "destructive";
    case "procurement":
      return "default";
    default:
      return "secondary";
  }
}

export function EmployeesTable() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/admin/employees"],
  });

  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [editEmpDraft, setEditEmpDraft] = useState<Partial<Employee>>({});

  const unlockEmployeeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/employees/${id}/unlock`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/employees"] });
      toast({ title: "Employee unlocked" });
    },
    onError: (e: any) =>
      toast({
        title: "Failed to unlock",
        description: e.message,
        variant: "destructive",
      }),
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: async (payload: Partial<Employee> & { id: string }) => {
      const { id, ...body } = payload;

      // ✅ Only send fields that are actually editable (optional but safer)
      const cleaned: any = {};
      if (body.firstName !== undefined) cleaned.firstName = body.firstName;
      if (body.lastName !== undefined) cleaned.lastName = body.lastName;
      if (body.email !== undefined) cleaned.email = body.email;
      if (body.points !== undefined) cleaned.points = body.points;
      if ((body as any).bulkBuyAllowed !== undefined) cleaned.bulkBuyAllowed = (body as any).bulkBuyAllowed;
      if ((body as any).role !== undefined) cleaned.role = (body as any).role;

      const res = await apiRequest("PUT", `/api/admin/employees/${id}`, cleaned);
      return res.json();
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["/api/admin/employees"] });
      toast({ title: "Employee updated" });
    },
    onError: (e: any) =>
      toast({
        title: "Failed to update employee",
        description: e.message,
        variant: "destructive",
      }),
  });

  const startEditEmp = (emp: Employee) => {
    setEditingEmployeeId(emp.id);
    setEditEmpDraft({
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email || "",
      points: emp.points,
      bulkBuyAllowed: Boolean((emp as any).bulkBuyAllowed),
      // ✅ NEW
      role: ((emp as any).role as EmployeeRole) || "user",
    } as any);
  };

  const saveEditEmp = () => {
    if (!editingEmployeeId) return;

    // ✅ Guard role on client too
    const role = (editEmpDraft as any).role as EmployeeRole | undefined;
    if (role && !["user", "admin", "procurement"].includes(role)) {
      toast({
        title: "Invalid role",
        description: "Role must be user/admin/procurement",
        variant: "destructive",
      });
      return;
    }

    updateEmployeeMutation.mutate({ id: editingEmployeeId, ...editEmpDraft });
    setEditingEmployeeId(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Employee Management</CardTitle>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Points</TableHead>
                <TableHead>Role</TableHead> {/* ✅ NEW */}
                <TableHead>Bulk Buy</TableHead>
                <TableHead>Login Attempts</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[300px]">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {employees.map((emp) => {
                const isEditing = editingEmployeeId === emp.id;
                const empRole = ((emp as any).role as EmployeeRole) || "user";

                return (
                  <TableRow key={emp.id}>
                    <TableCell>
                      {isEditing ? (
                        <div className="flex gap-2">
                          <Input
                            value={editEmpDraft.firstName || ""}
                            onChange={(e) => setEditEmpDraft((d) => ({ ...d, firstName: e.target.value }))}
                            placeholder="First name"
                          />
                          <Input
                            value={editEmpDraft.lastName || ""}
                            onChange={(e) => setEditEmpDraft((d) => ({ ...d, lastName: e.target.value }))}
                            placeholder="Last name"
                          />
                        </div>
                      ) : (
                        `${emp.firstName} ${emp.lastName}`
                      )}
                    </TableCell>

                    <TableCell>
                      {isEditing ? (
                        <Input
                          value={editEmpDraft.email || ""}
                          onChange={(e) => setEditEmpDraft((d) => ({ ...d, email: e.target.value }))}
                          placeholder="employee@company.com"
                          type="email"
                        />
                      ) : (
                        emp.email || "—"
                      )}
                    </TableCell>

                    <TableCell>
                      {isEditing ? (
                        <Input
                          type="number"
                          value={String(editEmpDraft.points ?? 0)}
                          onChange={(e) =>
                            setEditEmpDraft((d) => ({
                              ...d,
                              points: Number(e.target.value) || 0,
                            }))
                          }
                        />
                      ) : (
                        emp.points
                      )}
                    </TableCell>

                    {/* ✅ NEW: Role editor */}
                    <TableCell>
                      {isEditing ? (
                        <select
                          className="w-full border rounded-md p-2 text-sm bg-background"
                          value={String((editEmpDraft as any).role || "user")}
                          onChange={(e) =>
                            setEditEmpDraft((d) => ({ ...(d as any), role: e.target.value as EmployeeRole }))
                          }
                        >
                          <option value="user">User</option>
                          <option value="procurement">Procurement</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        <Badge variant={roleBadgeVariant(empRole)}>{ROLE_LABEL[empRole]}</Badge>
                      )}
                    </TableCell>

                    {/* Bulk Buy flag */}
                    <TableCell>
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={Boolean((editEmpDraft as any).bulkBuyAllowed)}
                            onChange={(e) => setEditEmpDraft((d) => ({ ...(d as any), bulkBuyAllowed: e.target.checked }))}
                          />
                          <span className="text-sm">Allowed</span>
                        </div>
                      ) : (
                        <Badge variant={(emp as any).bulkBuyAllowed ? "default" : "secondary"}>
                          {(emp as any).bulkBuyAllowed ? "Allowed" : "No"}
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell>{emp.loginAttempts}</TableCell>

                    <TableCell>
                      <Badge variant={emp.isLocked ? "destructive" : "default"}>
                        {emp.isLocked ? "Locked" : "Active"}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      {isEditing ? (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveEditEmp} disabled={updateEmployeeMutation.isPending}>
                            <Save className="h-4 w-4 mr-1" />
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setEditingEmployeeId(null)}
                            disabled={updateEmployeeMutation.isPending}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => startEditEmp(emp)}>
                            Edit
                          </Button>

                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => unlockEmployeeMutation.mutate(emp.id)}
                            disabled={!emp.isLocked || unlockEmployeeMutation.isPending}
                          >
                            <Unlock className="h-4 w-4 mr-1" />
                            Unblock
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
