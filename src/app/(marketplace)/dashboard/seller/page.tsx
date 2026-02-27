"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutDashboard } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { SellerStatsCards } from "@/components/marketplace/seller-stats-cards";
import { SellerListingsTable } from "@/components/marketplace/seller-listings-table";
import { SellerOrdersTable } from "@/components/marketplace/seller-orders-table";

export default function SellerDashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login?redirect=/dashboard/seller");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      fetch("/api/marketplace/seller/stats")
        .then((r) => r.json())
        .then(setStats)
        .catch(console.error);
    }
  }, [user]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 rounded bg-secondary" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1,2,3,4].map(i => <div key={i} className="h-24 rounded-xl bg-secondary" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <LayoutDashboard className="h-6 w-6 text-neon" />
        <h1 className="text-2xl font-bold">Seller Dashboard</h1>
      </div>

      {stats && <SellerStatsCards stats={stats} />}

      <div className="mt-8 space-y-8">
        <div>
          <h2 className="mb-4 text-lg font-semibold">Your Listings</h2>
          <SellerListingsTable />
        </div>
        <div>
          <h2 className="mb-4 text-lg font-semibold">Incoming Orders</h2>
          <SellerOrdersTable />
        </div>
      </div>
    </div>
  );
}
