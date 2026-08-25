"use client";

import { useDeferredValue, useState } from "react";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  KeyRound,
  PlugZap,
  RefreshCw,
  Rocket,
  Search,
  Shield,
  ShieldCheck,
  ShoppingBag,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDate, formatNumber, formatRelativeDate } from "@/lib/format";
import { SWR_TIERS } from "@/lib/swr/config";
import { jsonFetcher } from "@/lib/swr/fetcher";

type ActivationStage = "new" | "engaged" | "activated" | "customer";

interface AdminUserRow {
  id: string;
  username: string | null;
  display_name: string | null;
  email: string | null;
  is_admin: boolean;
  is_approved: boolean;
  is_banned: boolean;
  is_seller: boolean;
  seller_verified: boolean;
  total_sales: number;
  joined_at: string | null;
  last_login: string | null;
  auth: {
    confirmed: boolean;
    provider: string | null;
    lastSignInAt: string | null;
    bannedUntil: string | null;
    authCreatedAt: string;
  } | null;
  activation: {
    stage: ActivationStage;
    bookmarks: number;
    watchlists: number;
    apiKeys: number;
    providerConnections: number;
    runtimes: number;
    deployments: number;
    requests: number;
    paidPlan: string | null;
    lastActivityAt: string | null;
  };
}

interface AdminUsersData {
  users: AdminUserRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  summary: {
    registered: number;
    confirmed: number;
    active30d: number;
    admins: number;
    sellers: number;
    banned: number;
    authCoverageComplete: boolean;
    pageStages: Record<ActivationStage, number>;
  };
  warnings: string[];
}

const PAGE_SIZE = 20;

const ROLE_FILTERS = [
  { key: "all", label: "All" },
  { key: "admin", label: "Admins" },
  { key: "seller", label: "Sellers" },
  { key: "verified_seller", label: "Verified" },
  { key: "banned", label: "Banned" },
] as const;

const STAGE_META: Record<
  ActivationStage,
  { label: string; className: string }
> = {
  new: {
    label: "New",
    className: "border-border/60 bg-secondary/40 text-muted-foreground",
  },
  engaged: {
    label: "Engaged",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  },
  activated: {
    label: "Activated",
    className: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
  },
  customer: {
    label: "Customer",
    className: "border-gain/30 bg-gain/10 text-gain",
  },
};

function percentage(value: number, total: number) {
  if (total <= 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function displayName(user: AdminUserRow) {
  return user.display_name || user.username || user.email || "Unnamed user";
}

function journeyDetail(user: AdminUserRow) {
  const { activation } = user;
  if (activation.paidPlan) return `${activation.paidPlan} data plan`;

  const activeProducts = [
    activation.providerConnections > 0
      ? `${activation.providerConnections} connection`
      : null,
    activation.deployments > 0
      ? `${activation.deployments} deployment`
      : null,
    activation.requests > 0
      ? `${formatNumber(activation.requests)} requests`
      : null,
    activation.apiKeys > 0 ? `${activation.apiKeys} API key` : null,
    activation.watchlists + activation.bookmarks > 0
      ? `${activation.watchlists + activation.bookmarks} saved`
      : null,
    activation.runtimes > 0 ? `${activation.runtimes} runtime` : null,
  ].filter(Boolean);

  return activeProducts.length > 0
    ? activeProducts.slice(0, 2).join(" + ")
    : "No product action yet";
}

interface UserActionsProps {
  user: AdminUserRow;
  pending: boolean;
  onToggleAdmin: (user: AdminUserRow) => void;
  onToggleSeller: (user: AdminUserRow) => void;
  onToggleBan: (user: AdminUserRow) => void;
}

function UserActions({
  user,
  pending,
  onToggleAdmin,
  onToggleSeller,
  onToggleBan,
}: UserActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <ConfirmDialog
        trigger={
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            className="h-8 gap-1.5 px-2 text-xs"
          >
            {user.is_admin ? (
              <ShieldCheck className="h-3.5 w-3.5 text-neon" />
            ) : (
              <Shield className="h-3.5 w-3.5" />
            )}
            {user.is_admin ? "Remove admin" : "Make admin"}
          </Button>
        }
        title={user.is_admin ? "Remove admin role" : "Grant admin role"}
        description={
          user.is_admin
            ? `Remove administrator access from ${displayName(user)}?`
            : `Give ${displayName(user)} full administrator access?`
        }
        confirmLabel={user.is_admin ? "Remove admin" : "Make admin"}
        variant={user.is_admin ? "destructive" : "default"}
        onConfirm={() => onToggleAdmin(user)}
      />

      {user.is_seller ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          className="h-8 gap-1.5 px-2 text-xs"
          onClick={() => onToggleSeller(user)}
        >
          <ShoppingBag className="h-3.5 w-3.5" />
          {user.seller_verified ? "Unverify" : "Verify seller"}
        </Button>
      ) : null}

      <ConfirmDialog
        trigger={
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            className={`h-8 gap-1.5 px-2 text-xs ${
              user.is_banned ? "text-gain" : "text-loss"
            }`}
          >
            <Ban className="h-3.5 w-3.5" />
            {user.is_banned ? "Restore" : "Suspend"}
          </Button>
        }
        title={user.is_banned ? "Restore user" : "Suspend user"}
        description={
          user.is_banned
            ? `${displayName(user)} will be able to sign in and use the platform again.`
            : `${displayName(user)} will lose sign-in access until an administrator restores the account.`
        }
        confirmLabel={user.is_banned ? "Restore account" : "Suspend account"}
        variant={user.is_banned ? "default" : "destructive"}
        onConfirm={() => onToggleBan(user)}
      />
    </div>
  );
}

export default function AdminUsersPage() {
  const [searchInput, setSearchInput] = useState("");
  const deferredSearch = useDeferredValue(searchInput.trim());
  const [roleFilter, setRoleFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const query = new URLSearchParams({
    page: String(page),
    role: roleFilter,
  });
  if (deferredSearch) query.set("search", deferredSearch);

  const { data, error, isLoading, isValidating, mutate } = useSWR<AdminUsersData>(
    `/api/admin/users?${query.toString()}`,
    jsonFetcher<AdminUsersData>,
    { ...SWR_TIERS.MEDIUM, keepPreviousData: true }
  );

  const users = data?.users ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  async function updateUser(
    userId: string,
    path: string,
    body: Record<string, unknown>,
    successMessage: string
  ) {
    setPendingUserId(userId);
    try {
      const response = await fetch(path, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) throw new Error(result?.error ?? "Request failed");

      toast.success(successMessage);
      await mutate();
    } catch (requestError) {
      toast.error(
        requestError instanceof Error ? requestError.message : "Request failed"
      );
    } finally {
      setPendingUserId(null);
    }
  }

  function toggleAdmin(user: AdminUserRow) {
    void updateUser(
      user.id,
      "/api/admin/users",
      { userId: user.id, isAdmin: !user.is_admin },
      user.is_admin ? "Admin role removed" : "Admin role granted"
    );
  }

  function toggleSeller(user: AdminUserRow) {
    void updateUser(
      user.id,
      "/api/admin/users",
      { userId: user.id, sellerVerified: !user.seller_verified },
      user.seller_verified ? "Seller verification removed" : "Seller verified"
    );
  }

  function toggleBan(user: AdminUserRow) {
    void updateUser(
      user.id,
      "/api/admin/moderate",
      {
        action: user.is_banned ? "unban" : "ban",
        target_type: "user",
        target_id: user.id,
      },
      user.is_banned ? "Account restored" : "Account suspended"
    );
  }

  const summary = data?.summary;
  const productActiveOnPage = summary
    ? summary.pageStages.activated + summary.pageStages.customer
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-neon" />
            <h2 className="text-xl font-semibold">Users and activation</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Track the path from signup to product use and paid conversion.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={isValidating}
          onClick={() => void mutate()}
          className="w-fit gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isValidating ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading && !summary
          ? Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-28 animate-pulse rounded-xl border border-border/40 bg-secondary/40"
              />
            ))
          : [
              {
                label: "Registered",
                value: summary?.registered ?? 0,
                detail: `${summary?.admins ?? 0} admins, ${summary?.sellers ?? 0} sellers`,
                icon: Users,
              },
              {
                label: "Confirmed",
                value: summary?.confirmed ?? 0,
                detail: percentage(summary?.confirmed ?? 0, summary?.registered ?? 0),
                icon: UserCheck,
              },
              {
                label: "Active in 30 days",
                value: summary?.active30d ?? 0,
                detail: percentage(summary?.active30d ?? 0, summary?.registered ?? 0),
                icon: Clock3,
              },
              {
                label: "Product-active on page",
                value: productActiveOnPage,
                detail: `${summary?.pageStages.customer ?? 0} paying or trialing`,
                icon: Rocket,
              },
            ].map((item) => (
              <Card key={item.label} className="overflow-hidden border-border/50 bg-card">
                <CardContent className="relative p-5">
                  <div className="absolute -right-5 -top-5 h-20 w-20 rounded-full bg-neon/5" />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-2xl font-semibold tabular-nums">
                        {item.value.toLocaleString()}
                      </p>
                      <p className="mt-1 text-xs font-medium text-muted-foreground">
                        {item.label}
                      </p>
                    </div>
                    <div className="rounded-lg border border-neon/15 bg-neon/10 p-2 text-neon">
                      <item.icon className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    {item.detail}
                  </p>
                </CardContent>
              </Card>
            ))}
      </div>

      {summary ? (
        <Card className="border-border/50 bg-gradient-to-r from-card via-card to-neon/[0.035]">
          <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium">Current page journey</p>
              <p className="text-xs text-muted-foreground">
                Product signals are based on saved models, API keys, provider connections,
                runtimes, deployments, requests, and data plans.
              </p>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              {(
                ["new", "engaged", "activated", "customer"] as ActivationStage[]
              ).map((stage) => (
                <div
                  key={stage}
                  className="min-w-16 rounded-lg border border-border/50 bg-background/50 px-3 py-2"
                >
                  <p className="text-base font-semibold tabular-nums">
                    {summary.pageStages[stage]}
                  </p>
                  <p className="text-[10px] capitalize text-muted-foreground">
                    {stage}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {data?.warnings.length ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="text-sm font-medium">Some account signals are unavailable</p>
            <p className="mt-1 text-xs text-amber-200/70">
              {data.warnings.join(" ")}
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card/60 p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search users"
            placeholder="Search name, username, or email"
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value);
              setPage(1);
            }}
            className="border-border/60 bg-background pl-9"
          />
        </div>
        <div className="flex max-w-full gap-1 overflow-x-auto pb-1 lg:pb-0">
          {ROLE_FILTERS.map((filter) => (
            <Button
              key={filter.key}
              variant={roleFilter === filter.key ? "default" : "ghost"}
              size="sm"
              onClick={() => {
                setRoleFilter(filter.key);
                setPage(1);
              }}
              className={
                roleFilter === filter.key
                  ? "shrink-0 bg-neon text-background hover:bg-neon/90"
                  : "shrink-0 text-muted-foreground"
              }
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </div>

      {error ? (
        <Card className="border-loss/30 bg-loss/5">
          <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-loss" />
              <div>
                <p className="font-medium text-loss">User directory could not load</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {error instanceof Error ? error.message : "Unknown request error"}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => void mutate()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-border/50 md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px]">
                <thead>
                  <tr className="border-b border-border/50 bg-secondary/30">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                      Account
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                      Access
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                      Journey
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                      Activity
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && users.length === 0
                    ? Array.from({ length: 5 }).map((_, index) => (
                        <tr key={index} className="border-b border-border/30">
                          <td colSpan={5} className="px-4 py-4">
                            <div className="h-10 animate-pulse rounded bg-secondary" />
                          </td>
                        </tr>
                      ))
                    : users.map((user) => {
                        const stage = STAGE_META[user.activation.stage];
                        const lastSeen =
                          user.auth?.lastSignInAt ??
                          user.activation.lastActivityAt ??
                          user.last_login;
                        return (
                          <tr
                            key={user.id}
                            className="border-b border-border/30 transition-colors last:border-0 hover:bg-secondary/20"
                          >
                            <td className="px-4 py-4 align-top">
                              <p className="text-sm font-medium">{displayName(user)}</p>
                              <p className="mt-0.5 max-w-64 truncate text-xs text-muted-foreground">
                                {user.email || "No email in profile"}
                              </p>
                              <p className="mt-1 text-[11px] text-muted-foreground/70">
                                Joined {formatDate(user.joined_at)}
                              </p>
                            </td>
                            <td className="px-4 py-4 align-top">
                              <div className="flex max-w-52 flex-wrap gap-1">
                                {user.auth?.confirmed ? (
                                  <Badge variant="outline" className="border-gain/25 text-[10px] text-gain">
                                    <CheckCircle2 className="mr-1 h-3 w-3" /> Confirmed
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="border-amber-500/25 text-[10px] text-amber-500">
                                    Unconfirmed
                                  </Badge>
                                )}
                                {user.is_admin ? (
                                  <Badge variant="outline" className="border-neon/30 text-[10px] text-neon">
                                    Admin
                                  </Badge>
                                ) : null}
                                {user.is_seller ? (
                                  <Badge variant="outline" className="text-[10px]">
                                    Seller
                                  </Badge>
                                ) : null}
                                {user.seller_verified ? (
                                  <Badge variant="outline" className="border-gain/30 text-[10px] text-gain">
                                    Verified
                                  </Badge>
                                ) : null}
                                {user.is_banned ? (
                                  <Badge variant="outline" className="border-loss/30 text-[10px] text-loss">
                                    Suspended
                                  </Badge>
                                ) : null}
                              </div>
                              <p className="mt-2 text-[11px] capitalize text-muted-foreground">
                                {user.auth?.provider || "Unknown auth provider"}
                              </p>
                            </td>
                            <td className="px-4 py-4 align-top">
                              <Badge variant="outline" className={stage.className}>
                                {stage.label}
                              </Badge>
                              <p className="mt-2 max-w-48 text-xs text-muted-foreground">
                                {journeyDetail(user)}
                              </p>
                            </td>
                            <td className="px-4 py-4 align-top">
                              <p className="text-xs font-medium">
                                {formatRelativeDate(lastSeen)}
                              </p>
                              <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <KeyRound className="h-3 w-3" /> {user.activation.apiKeys}
                                </span>
                                <span className="flex items-center gap-1">
                                  <PlugZap className="h-3 w-3" /> {user.activation.providerConnections}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Rocket className="h-3 w-3" /> {user.activation.deployments}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 align-top">
                              <UserActions
                                user={user}
                                pending={pendingUserId === user.id}
                                onToggleAdmin={toggleAdmin}
                                onToggleSeller={toggleSeller}
                                onToggleBan={toggleBan}
                              />
                            </td>
                          </tr>
                        );
                      })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-3 md:hidden">
            {isLoading && users.length === 0
              ? Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-48 animate-pulse rounded-xl border border-border/50 bg-secondary/40"
                  />
                ))
              : users.map((user) => {
                  const stage = STAGE_META[user.activation.stage];
                  const lastSeen =
                    user.auth?.lastSignInAt ??
                    user.activation.lastActivityAt ??
                    user.last_login;
                  return (
                    <Card key={user.id} className="border-border/50 bg-card">
                      <CardContent className="space-y-4 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {displayName(user)}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {user.email || "No email in profile"}
                            </p>
                          </div>
                          <Badge variant="outline" className={stage.className}>
                            {stage.label}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-2 rounded-lg border border-border/40 bg-background/40 p-3 text-xs">
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                              Last seen
                            </p>
                            <p className="mt-1 font-medium">{formatRelativeDate(lastSeen)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                              Joined
                            </p>
                            <p className="mt-1 font-medium">{formatDate(user.joined_at)}</p>
                          </div>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground">{journeyDetail(user)}</p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {user.auth?.confirmed ? (
                              <Badge variant="outline" className="border-gain/25 text-[10px] text-gain">
                                Confirmed
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-amber-500/25 text-[10px] text-amber-500">
                                Unconfirmed
                              </Badge>
                            )}
                            {user.is_admin ? <Badge variant="outline">Admin</Badge> : null}
                            {user.is_seller ? <Badge variant="outline">Seller</Badge> : null}
                            {user.is_banned ? (
                              <Badge variant="outline" className="border-loss/30 text-loss">
                                Suspended
                              </Badge>
                            ) : null}
                          </div>
                        </div>

                        <div className="border-t border-border/40 pt-3">
                          <UserActions
                            user={user}
                            pending={pendingUserId === user.id}
                            onToggleAdmin={toggleAdmin}
                            onToggleSeller={toggleSeller}
                            onToggleBan={toggleBan}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
          </div>

          {!isLoading && users.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 py-16 text-center">
              <Users className="mx-auto h-10 w-10 text-muted-foreground/30" />
              <p className="mt-3 text-sm font-medium">No matching users</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Change the search or role filter to broaden the results.
              </p>
            </div>
          ) : null}
        </>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({totalCount.toLocaleString()} users)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((current) => current - 1)}
              disabled={page <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((current) => current + 1)}
              disabled={page >= totalPages}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      {summary?.banned ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Ban className="h-3.5 w-3.5 text-loss" />
          {summary.banned} suspended account{summary.banned === 1 ? "" : "s"}
        </p>
      ) : null}

      {!summary?.authCoverageComplete && summary ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <CircleDollarSign className="h-3.5 w-3.5" />
          Confirmation and activity totals cover the first 1,000 authentication records.
        </p>
      ) : null}
    </div>
  );
}
