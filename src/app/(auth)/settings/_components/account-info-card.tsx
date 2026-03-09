"use client";

import { Shield, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface AccountInfoCardProps {
  email: string | undefined;
  provider: string;
  isAdmin: boolean;
}

export function AccountInfoCard({ email, provider, isAdmin }: AccountInfoCardProps) {
  return (
    <Card className="border-border/50 bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <User className="h-5 w-5 text-neon" />
          Account Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium text-muted-foreground">Email Address</label>
          <p className="mt-1 text-sm">{email}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">Auth Provider</label>
          <p className="mt-1 text-sm capitalize">{provider}</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2 rounded-lg border border-neon/20 bg-neon/5 px-3 py-2">
            <Shield className="h-4 w-4 text-neon" />
            <span className="text-sm font-medium text-neon">Admin Account</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
