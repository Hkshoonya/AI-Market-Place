"use client";

import Link from "next/link";
import useSWR from "swr";
import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SWR_TIERS } from "@/lib/swr/config";

interface DeploymentListSnapshot {
  deployments: Array<{
    id: string;
    status: "provisioning" | "ready" | "paused" | "failed";
    healthStatus?: "healthy" | "error" | "paused" | "idle";
  }>;
}

export function DeployAccountSummary() {
  const { user, loading } = useAuth();
  const { data } = useSWR<DeploymentListSnapshot>(
    user ? "/api/workspace/deployments" : null,
    { ...SWR_TIERS.MEDIUM }
  );

  if (loading || !user) {
    return null;
  }

  const deployments = data?.deployments ?? [];
  if (deployments.length === 0) {
    return null;
  }

  const readyCount = deployments.filter((deployment) => deployment.status === "ready").length;
  const pausedCount = deployments.filter((deployment) => deployment.status === "paused").length;
  const attentionCount = deployments.filter(
    (deployment) => deployment.status === "failed" || deployment.healthStatus === "error"
  ).length;

  return (
    <Card className="mt-6 border-cyan-500/30 bg-cyan-500/10">
      <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-cyan-100/80">
            Your saved deployments
          </p>
          <h2 className="mt-1 text-lg font-semibold text-white">
            You already have {deployments.length} managed deployment{deployments.length === 1 ? "" : "s"}
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-cyan-50/80">
            Open deployments to run quick tests, pause unused traffic, adjust budgets, or jump back into a specific model workflow.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge className="bg-emerald-500/10 text-emerald-200">{readyCount} ready</Badge>
            <Badge className="bg-amber-500/10 text-amber-100">{pausedCount} paused</Badge>
            <Badge className="bg-red-500/10 text-red-200">{attentionCount} need attention</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild className="bg-neon text-background hover:bg-neon/90">
            <Link href="/deployments">Go to Deployments</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/workspace">Open Workspace</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
