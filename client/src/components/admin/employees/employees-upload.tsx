import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Download as DownloadIcon } from "lucide-react";
import { parseAnySpreadsheet, downloadSample } from "@/lib/csv-utils";

type UploadRow = {
  firstName: string;
  lastName: string;
  email: string;
  points: number;
  bulkBuyAllowed?: boolean | string | number | null;
};

function toBoolLoose(v: any): boolean | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  const s = String(v).trim().toLowerCase();
  if (!s) return undefined;
  if (["1", "true", "yes", "y"].includes(s)) return true;
  if (["0", "false", "no", "n"].includes(s)) return false;
  return undefined;
}

export function EmployeesUpload() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [csvFile, setCsvFile] = useState<File | null>(null);

  const bulkEmployeesMutation = useMutation({
    mutationFn: async (
      rows: Array<{ firstName: string; lastName: string; email: string; points: number; bulkBuyAllowed?: boolean }>
    ) => {
      const res = await apiRequest("POST", `/api/admin/employees/bulk`, rows);
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/employees"] });
      toast({
        title: "Upload complete",
        description: `Inserted: ${data.inserted}, Skipped: ${data.skipped}`,
      });
    },
    onError: (e: any) =>
      toast({
        title: "Bulk upload failed",
        description: e.message,
        variant: "destructive",
      }),
  });

  const handleUpload = async () => {
    if (!csvFile) {
      toast({ title: "Select a file", variant: "destructive" });
      return;
    }
    try {
      const parsed = (await parseAnySpreadsheet(csvFile)) as UploadRow[];

      // ✅ Now supports optional column: bulkBuyAllowed
      const rows = parsed
        .map((r) => {
          const bulkBuyAllowed = toBoolLoose((r as any).bulkBuyAllowed);
          return {
            firstName: (r.firstName ?? "").toString().trim(),
            lastName: (r.lastName ?? "").toString().trim(),
            email: (r.email ?? "").toString().trim(),
            points: Number((r as any).points),
            ...(bulkBuyAllowed === undefined ? {} : { bulkBuyAllowed }),
          };
        })
        .filter((r) => r.firstName && r.lastName && r.email && Number.isFinite(r.points) && isValidEmail(r.email));

      if (!rows.length) {
        toast({ title: "No valid rows", variant: "destructive" });
        return;
      }
      bulkEmployeesMutation.mutate(rows);
    } catch (err: any) {
      toast({
        title: "Parse failed",
        description: String(err?.message || err),
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Upload Employees (CSV / Excel)</CardTitle>
        <Button variant="outline" size="sm" onClick={() => downloadSample()}>
          <DownloadIcon className="h-4 w-4 mr-2" />
          Download sample
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          File must include headers:{" "}
          <code>firstName,lastName,email,points</code> (optional: <code>bulkBuyAllowed</code>)
        </p>
        <Input
          type="file"
          accept=".csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx"
          onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
        />
        <div className="flex gap-2">
          <Button onClick={handleUpload} disabled={bulkEmployeesMutation.isPending}>
            <Plus className="h-4 w-4 mr-2" />
            Upload
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
