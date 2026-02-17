import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Trash, Plus, Users, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Campaign } from "./types";

interface CampaignWhitelistModalProps {
    campaign: Campaign;
    onClose: () => void;
}

type WhitelistEntry = {
    id: string;
    email: string;
    startDate: string | null;
    endDate: string | null;
    createdAt: string;
};

export function CampaignWhitelistModal({ campaign, onClose }: CampaignWhitelistModalProps) {
    const { toast } = useToast();
    const qc = useQueryClient();
    const [activeTab, setActiveTab] = useState<"list" | "add" | "bulk">("list");

    // Form states
    const [singleEmail, setSingleEmail] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [bulkEmails, setBulkEmails] = useState("");

    const { data: whitelist = [], isLoading } = useQuery<WhitelistEntry[]>({
        queryKey: [`/api/admin/campaigns/${campaign.id}/whitelist`],
    });

    const addWhitelistMutation = useMutation({
        mutationFn: async (data: any[]) => {
            const res = await apiRequest("POST", `/api/admin/campaigns/${campaign.id}/whitelist`, data);
            return res.json();
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: [`/api/admin/campaigns/${campaign.id}/whitelist`] });
            toast({ title: "Whitelist updated successfully" });
            if (activeTab === "add" || activeTab === "bulk") {
                setSingleEmail("");
                setBulkEmails("");
                // Keep dates as they might be reused
                setActiveTab("list");
            }
        },
        onError: (e: any) => {
            toast({
                title: "Update failed",
                description: e.message,
                variant: "destructive"
            });
        },
    });

    const deleteWhitelistMutation = useMutation({
        mutationFn: async (id: string) => {
            await apiRequest("DELETE", `/api/admin/campaigns/${campaign.id}/whitelist/${id}`);
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: [`/api/admin/campaigns/${campaign.id}/whitelist`] });
            toast({ title: "Removed from whitelist" });
        },
        onError: (e: any) => {
            toast({
                title: "Delete failed",
                description: e.message,
                variant: "destructive"
            });
        },
    });

    const handleAddSingle = (e: React.FormEvent) => {
        e.preventDefault();
        if (!singleEmail) return;

        addWhitelistMutation.mutate([{
            email: singleEmail,
            startDate: startDate ? new Date(startDate).toISOString() : null,
            endDate: endDate ? new Date(endDate).toISOString() : null,
        }]);
    };

    const handleAddBulk = () => {
        if (!bulkEmails.trim()) return;

        // Split by comma, newline, semicolon, or space
        const emails = bulkEmails
            .split(/[\n,;\s]+/)
            .map(e => e.trim())
            .filter(e => e && e.includes("@")); // Basic validation

        if (emails.length === 0) {
            toast({ title: "No valid emails found", variant: "destructive" });
            return;
        }

        const payload = emails.map(email => ({
            email,
            startDate: startDate ? new Date(startDate).toISOString() : null,
            endDate: endDate ? new Date(endDate).toISOString() : null,
        }));

        addWhitelistMutation.mutate(payload);
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return "Indefinite";
        return new Date(dateString).toLocaleDateString();
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col p-0">
                <div className="px-6 py-4 border-b">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Manage Access Whitelist - {campaign.name}
                        </DialogTitle>
                    </DialogHeader>
                </div>

                <div className="flex border-b bg-muted/40 px-6">
                    <button
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "list"
                                ? "border-primary text-primary"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                            }`}
                        onClick={() => setActiveTab("list")}
                    >
                        Current Whitelist ({whitelist.length})
                    </button>
                    <button
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "add"
                                ? "border-primary text-primary"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                            }`}
                        onClick={() => setActiveTab("add")}
                    >
                        Add Single User
                    </button>
                    <button
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "bulk"
                                ? "border-primary text-primary"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                            }`}
                        onClick={() => setActiveTab("bulk")}
                    >
                        Bulk Add
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === "list" && (
                        <div className="space-y-4">
                            {isLoading ? (
                                <p className="text-center text-muted-foreground py-8">Loading whitelist...</p>
                            ) : whitelist.length === 0 ? (
                                <div className="text-center py-10 border-2 border-dashed rounded-lg">
                                    <p className="text-muted-foreground">No users whitelisted for this campaign.</p>
                                    <p className="text-sm text-muted-foreground mt-1">If empty, logic handles access (usually open to all or closed depending on rules).</p>
                                    <Button variant="outline" className="mt-4" onClick={() => setActiveTab("add")}>
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Users
                                    </Button>
                                </div>
                            ) : (
                                <div className="rounded-md border">
                                    <div className="grid grid-cols-12 gap-2 p-3 bg-muted font-medium text-sm">
                                        <div className="col-span-5">Email</div>
                                        <div className="col-span-3">Start Date</div>
                                        <div className="col-span-3">End Date</div>
                                        <div className="col-span-1"></div>
                                    </div>
                                    <div className="divide-y">
                                        {whitelist.map((item) => (
                                            <div key={item.id} className="grid grid-cols-12 gap-2 p-3 items-center text-sm">
                                                <div className="col-span-5 truncate font-medium">{item.email}</div>
                                                <div className="col-span-3 text-muted-foreground">
                                                    {item.startDate ? formatDate(item.startDate) : <Badge variant="outline">Anytime</Badge>}
                                                </div>
                                                <div className="col-span-3 text-muted-foreground">
                                                    {item.endDate ? formatDate(item.endDate) : <Badge variant="outline">Anytime</Badge>}
                                                </div>
                                                <div className="col-span-1 flex justify-end">
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                        onClick={() => deleteWhitelistMutation.mutate(item.id)}
                                                        disabled={deleteWhitelistMutation.isPending}
                                                    >
                                                        <Trash className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "add" && (
                        <form onSubmit={handleAddSingle} className="max-w-md mx-auto space-y-6 py-4">
                            <div className="space-y-4">
                                <div>
                                    <Label>User Email</Label>
                                    <Input
                                        value={singleEmail}
                                        onChange={(e) => setSingleEmail(e.target.value)}
                                        placeholder="user@example.com"
                                        required
                                        type="email"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>Access Start Date (Optional)</Label>
                                        <Input
                                            type="datetime-local"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <Label>Access End Date (Optional)</Label>
                                        <Input
                                            type="datetime-local"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            <Button type="submit" className="w-full" disabled={addWhitelistMutation.isPending}>
                                {addWhitelistMutation.isPending ? "Adding..." : "Add to Whitelist"}
                            </Button>
                        </form>
                    )}

                    {activeTab === "bulk" && (
                        <div className="max-w-xl mx-auto space-y-6 py-4">
                            <div className="space-y-4">
                                <div>
                                    <Label>Common Access Period</Label>
                                    <div className="grid grid-cols-2 gap-4 mt-2">
                                        <div>
                                            <label className="text-xs text-muted-foreground">Start Date (Optional)</label>
                                            <Input
                                                type="datetime-local"
                                                value={startDate}
                                                onChange={(e) => setStartDate(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-muted-foreground">End Date (Optional)</label>
                                            <Input
                                                type="datetime-local"
                                                value={endDate}
                                                onChange={(e) => setEndDate(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <Label>Email List</Label>
                                    <p className="text-xs text-muted-foreground mb-2">Paste emails separated by commas, spaces, or new lines.</p>
                                    <Textarea
                                        value={bulkEmails}
                                        onChange={(e) => setBulkEmails(e.target.value)}
                                        placeholder={"user1@example.com\nuser2@example.com\nuser3@example.com"}
                                        rows={8}
                                    />
                                </div>
                            </div>

                            <Button onClick={handleAddBulk} className="w-full" disabled={addWhitelistMutation.isPending}>
                                {addWhitelistMutation.isPending ? "Processing..." : "Process Bulk Add"}
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
