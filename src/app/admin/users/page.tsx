"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trash2, ShieldCheck, ShieldOff } from "lucide-react";

interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  role: string;
  created_at: string;
  prediction_count?: number;
}

interface Invitation {
  id: string;
  email: string;
  status: string;
  created_at: string;
}

export default function AdminUsersPage() {
  const [email, setEmail] = useState("");
  const [bulkEmails, setBulkEmails] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    loadData();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  async function loadData() {
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    // Get prediction counts per user
    const { data: predCounts } = await supabase
      .from("predictions")
      .select("user_id")
      .range(0, 9999);

    const countMap: Record<string, number> = {};
    for (const p of predCounts ?? []) {
      countMap[p.user_id] = (countMap[p.user_id] ?? 0) + 1;
    }

    if (profilesData) {
      setUsers(
        profilesData.map((u) => ({
          ...u,
          prediction_count: countMap[u.id] ?? 0,
        }))
      );
    }

    const { data: invitesData } = await supabase
      .from("invitations")
      .select("*")
      .order("created_at", { ascending: false });
    if (invitesData) setInvitations(invitesData);
  }

  async function handleDeleteUser(userId: string, displayName: string) {
    if (!confirm(`Are you sure you want to delete "${displayName}"? This will remove all their predictions and cannot be undone.`)) return;
    setActionLoading(userId);
    setMessage("");
    const res = await fetch("/api/admin/manage-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", targetUserId: userId }),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage(`User "${displayName}" deleted`);
      loadData();
    } else {
      setMessage(`Failed: ${data.error}`);
    }
    setActionLoading(null);
  }

  async function handleToggleRole(userId: string, currentRole: string) {
    const newRole = currentRole === "admin" ? "user" : "admin";
    setActionLoading(userId);
    setMessage("");
    const res = await fetch("/api/admin/manage-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "change_role", targetUserId: userId, newRole }),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage(`Role changed to ${newRole}`);
      loadData();
    } else {
      setMessage(`Failed: ${data.error}`);
    }
    setActionLoading(null);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const emails = bulkEmails
      ? bulkEmails.split("\n").map((e) => e.trim()).filter(Boolean)
      : [email];

    const res = await fetch("/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emails }),
    });

    const data = await res.json();
    if (res.ok) {
      setMessage(`Invited ${emails.length} user(s) successfully`);
      setEmail("");
      setBulkEmails("");
      loadData();
    } else {
      setMessage(data.error || "Failed to send invitations");
    }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">User Management</h1>

      <Card>
        <CardHeader>
          <CardTitle>Invite Users</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="email"
                placeholder="Single email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="text-xs text-gray-500">Or paste multiple emails below (one per line):</p>
              <textarea
                className="w-full h-24 rounded-md border border-gray-200 px-3 py-2 text-sm"
                placeholder={"alice@company.com\nbob@company.com"}
                value={bulkEmails}
                onChange={(e) => setBulkEmails(e.target.value)}
              />
            </div>
            {message && (
              <p className={`text-sm ${message.includes("Failed") ? "text-red-500" : "text-green-600"}`}>
                {message}
              </p>
            )}
            <Button type="submit" disabled={loading || (!email && !bulkEmails)}>
              {loading ? "Sending..." : "Send Invitations"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active Users ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Predictions</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const isSelf = u.id === currentUserId;
                const isLoading = actionLoading === u.id;
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      {u.display_name}
                      {isSelf && <span className="text-xs text-gray-400 ml-1.5">(you)</span>}
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      {u.prediction_count === 0 ? (
                        <span className="text-red-500 text-xs font-medium">None</span>
                      ) : (
                        <span className="text-xs font-medium">{u.prediction_count}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 px-2"
                          disabled={isLoading || isSelf}
                          onClick={() => handleToggleRole(u.id, u.role)}
                          title={u.role === "admin" ? "Demote to user" : "Promote to admin"}
                        >
                          {u.role === "admin" ? (
                            <><ShieldOff className="h-3 w-3 mr-1" />Demote</>
                          ) : (
                            <><ShieldCheck className="h-3 w-3 mr-1" />Promote</>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 px-2 border-red-200 text-red-600 hover:bg-red-50"
                          disabled={isLoading || isSelf}
                          onClick={() => handleDeleteUser(u.id, u.display_name)}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invitations</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.filter((i) => i.status === "pending").map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>{inv.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{inv.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {new Date(inv.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
