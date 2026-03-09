"use client";

import { useState, useRef } from "react";
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  Search,
  Shield,
  ShieldCheck,
  ShoppingBag,
  Users,
} from "lucide-react";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { SWR_TIERS } from "@/lib/swr/config";
import { formatDate } from "@/lib/format";
import { sanitizeFilterValue } from "@/lib/utils/sanitize";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { Profile } from "@/types/database";

// Admin view extends Profile with optional fields not in base type
type AdminUserRow = Profile & { email?: string | null; is_banned?: boolean };

interface AdminUsersData {
  users: AdminUserRow[];
  totalCount: number;
}

const PAGE_SIZE = 20;

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const { data, isLoading: loading, mutate } = useSWR<AdminUsersData>(
    `supabase:admin-users:${page}:${roleFilter}:${search}`,
    async () => {
      const supabase = createClient();
      let query = supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, is_admin, is_seller, seller_verified, joined_at, total_sales, reputation_score, is_seller, seller_bio, seller_website, seller_rating, bio, created_at, updated_at", { count: "exact" });

      if (roleFilter === "admin") query = query.eq("is_admin", true);
      if (roleFilter === "seller") query = query.eq("is_seller", true);
      if (roleFilter === "banned") query = query.eq("is_banned", true);
      if (roleFilter === "verified_seller") query = query.eq("seller_verified", true);

      if (search) {
        const safeSearch = sanitizeFilterValue(search);
        if (safeSearch) {
          query = query.or(`display_name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%,username.ilike.%${safeSearch}%`);
        }
      }

      query = query.order("joined_at", { ascending: false });

      const from = (page - 1) * PAGE_SIZE;
      query = query.range(from, from + PAGE_SIZE - 1);

      const { data: queryData, count, error } = await query;
      if (error) throw error;
      return {
        users: (queryData as AdminUserRow[]) ?? [],
        totalCount: count ?? 0,
      };
    },
    { ...SWR_TIERS.MEDIUM }
  );

  const users = data?.users ?? [];
  const totalCount = data?.totalCount ?? 0;

  const toggleAdmin = async (id: string, currentValue: boolean) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({ is_admin: !currentValue })
        .eq("id", id);
      if (error) throw error;
      toast.success(currentValue ? "Admin role removed" : "Admin role granted");
      mutate();
    } catch {
      toast.error("Failed to update admin status");
    }
  };

  const toggleSellerVerified = async (id: string, currentValue: boolean) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({ seller_verified: !currentValue })
        .eq("id", id);
      if (error) throw error;
      toast.success(currentValue ? "Seller verification removed" : "Seller verified successfully");
      mutate();
    } catch {
      toast.error("Failed to update seller verification");
    }
  };

  const toggleBan = async (id: string, currentValue: boolean) => {
    try {
      const res = await fetch("/api/admin/moderate", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: currentValue ? "unban" : "ban",
          target_type: "user",
          target_id: id,
        }),
      });
      if (!res.ok) throw new Error("Request failed");
      toast.success(currentValue ? "User unbanned" : "User banned");
      mutate();
    } catch {
      toast.error(currentValue ? "Failed to unban user" : "Failed to ban user");
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Users className="h-5 w-5 text-neon" />
          Users ({totalCount})
        </h2>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search users"
            placeholder="Search users..."
            defaultValue={search}
            onChange={(e) => {
              const value = e.target.value;
              if (debounceRef.current) clearTimeout(debounceRef.current);
              debounceRef.current = setTimeout(() => {
                setSearch(value);
                setPage(1);
              }, 300);
            }}
            className="pl-9 bg-secondary"
          />
        </div>
        <div className="flex gap-1">
          {[
            { key: "all", label: "All" },
            { key: "admin", label: "Admins" },
            { key: "seller", label: "Sellers" },
            { key: "verified_seller", label: "Verified" },
            { key: "banned", label: "Banned" },
          ].map((f) => (
            <Button
              key={f.key}
              variant={roleFilter === f.key ? "default" : "outline"}
              size="sm"
              onClick={() => { setRoleFilter(f.key); setPage(1); }}
              className={roleFilter === f.key ? "bg-neon text-background hover:bg-neon/90" : ""}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border/50">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-secondary/30">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Email</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Roles</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Sales</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Joined</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/30">
                    <td colSpan={6} className="px-4 py-4">
                      <div className="h-5 animate-pulse rounded bg-secondary" />
                    </td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Users className="h-10 w-10 text-muted-foreground/30" />
                      <p className="text-sm font-medium text-muted-foreground">No users found</p>
                      <p className="text-xs text-muted-foreground/70">
                        {search ? "Try adjusting your search or filters" : "Users will appear here once they sign up"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <span className="text-sm font-medium">
                          {u.display_name || u.username || "—"}
                        </span>
                        {u.username && (
                          <span className="ml-2 text-xs text-muted-foreground">@{u.username}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {u.email || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {u.is_admin && (
                          <Badge variant="outline" className="text-[11px] border-neon/30 text-neon">
                            Admin
                          </Badge>
                        )}
                        {u.is_seller && (
                          <Badge variant="outline" className="text-[11px] border-amber-500/30 text-amber-500">
                            Seller
                          </Badge>
                        )}
                        {u.seller_verified && (
                          <Badge variant="outline" className="text-[11px] border-gain/30 text-gain">
                            Verified
                          </Badge>
                        )}
                        {u.is_banned && (
                          <Badge variant="outline" className="text-[11px] border-loss/30 text-loss">
                            Banned
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-sm tabular-nums">
                      {u.total_sales || 0}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(u.joined_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <ConfirmDialog
                          trigger={
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs gap-1"
                            >
                              {u.is_admin ? (
                                <ShieldCheck className="h-3 w-3 text-neon" />
                              ) : (
                                <Shield className="h-3 w-3" />
                              )}
                              {u.is_admin ? "Remove Admin" : "Make Admin"}
                            </Button>
                          }
                          title={u.is_admin ? "Remove Admin Role" : "Grant Admin Role"}
                          description={
                            u.is_admin
                              ? "Are you sure you want to remove admin privileges from this user?"
                              : "Are you sure you want to grant admin privileges to this user? They will have full access to the admin dashboard."
                          }
                          confirmLabel={u.is_admin ? "Remove Admin" : "Make Admin"}
                          variant={u.is_admin ? "destructive" : "default"}
                          onConfirm={() => toggleAdmin(u.id, u.is_admin)}
                        />
                        {u.is_seller && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1"
                            onClick={() => toggleSellerVerified(u.id, u.seller_verified)}
                          >
                            <ShoppingBag className="h-3 w-3" />
                            {u.seller_verified ? "Unverify" : "Verify"}
                          </Button>
                        )}
                        <ConfirmDialog
                          trigger={
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-7 px-2 text-xs gap-1 ${u.is_banned ? "text-gain" : "text-loss"}`}
                            >
                              <Ban className="h-3 w-3" />
                              {u.is_banned ? "Unban" : "Ban"}
                            </Button>
                          }
                          title={u.is_banned ? "Unban User" : "Ban User"}
                          description={
                            u.is_banned
                              ? "Are you sure you want to unban this user? They will regain access to the platform."
                              : "Are you sure you want to ban this user? They will lose access to the platform."
                          }
                          confirmLabel={u.is_banned ? "Unban" : "Ban"}
                          variant={u.is_banned ? "default" : "destructive"}
                          onConfirm={() => toggleBan(u.id, u.is_banned ?? false)}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({totalCount} total)
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page <= 1} aria-label="Previous page">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= totalPages} aria-label="Next page">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
