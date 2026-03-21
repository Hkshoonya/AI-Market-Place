import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type OrderManifest = Record<string, unknown>;

interface OrderDeliverySummaryCardProps {
  status: string;
  deliveryData: Record<string, unknown> | null | undefined;
  manifest: OrderManifest | null;
}

type PillTone = "emerald" | "yellow" | "red" | "blue";

const PILL_CLASSES: Record<PillTone, string> = {
  emerald: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
  yellow: "border-yellow-400/30 bg-yellow-500/10 text-yellow-300",
  red: "border-red-400/30 bg-red-500/15 text-red-300",
  blue: "border-blue-400/30 bg-blue-500/10 text-blue-300",
};

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function firstString(
  object: Record<string, unknown> | null | undefined,
  keys: string[]
) {
  for (const key of keys) {
    const value = stringValue(object?.[key]);
    if (value) return value;
  }
  return null;
}

function titleCase(input: string) {
  return input
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function deliveryState(status: string, deliveryData: Record<string, unknown> | null | undefined) {
  if (status === "cancelled" || status === "rejected") {
    return {
      label: titleCase(status),
      tone: "red" as const,
      description: "This order is no longer moving through delivery.",
    };
  }

  const hasDeliveryData = Boolean(deliveryData && Object.keys(deliveryData).length > 0);
  if (status === "completed") {
    return {
      label: hasDeliveryData ? "Delivered" : "Completed",
      tone: "emerald" as const,
      description: hasDeliveryData
        ? "Delivery artifacts or handoff data are attached to this order."
        : "The order has been marked complete.",
    };
  }

  if (status === "approved") {
    return {
      label: "Ready for Delivery",
      tone: "blue" as const,
      description: "Payment is approved and seller fulfillment can proceed.",
    };
  }

  return {
    label: "Awaiting Approval",
    tone: "yellow" as const,
    description: "The order is waiting for review or the next fulfillment step.",
  };
}

function contractState(manifest: OrderManifest | null) {
  if (!manifest) {
    return {
      label: "Legacy Fulfillment",
      tone: "yellow" as const,
      description:
        "This purchase predates immutable fulfillment snapshots, so the original seller terms stay attached through the order record and message thread.",
    };
  }

  const fulfillmentType = stringValue(manifest.fulfillment_type);
  return {
    label: fulfillmentType ? `${titleCase(fulfillmentType)} Contract` : "Snapshot Locked",
    tone: "blue" as const,
    description: "This order keeps the exact machine-readable contract captured at purchase time.",
  };
}

function accessState(manifest: OrderManifest | null) {
  const access = objectValue(manifest?.access);
  const mode = stringValue(access?.mode);
  const endpoint = stringValue(access?.endpoint);

  if (mode || endpoint) {
    return {
      label: mode ? titleCase(mode) : "Access Attached",
      tone: "emerald" as const,
      description: endpoint
        ? `Primary endpoint or access target: ${endpoint}`
        : "Access details are defined in the purchased contract.",
    };
  }

  return {
    label: "Manual Handoff",
    tone: "yellow" as const,
    description: "Access or artifacts will be coordinated manually through the order thread.",
  };
}

function legacyAccessState(deliveryData: Record<string, unknown> | null | undefined) {
  const handoffMode = firstString(deliveryData, ["handoff_mode", "delivery_mode"]);
  const contactChannel = firstString(deliveryData, [
    "contact_channel",
    "coordination_channel",
    "manual_contact",
  ]);
  const nextStep = firstString(deliveryData, ["next_step", "handoff_note", "delivery_note"]);

  if (handoffMode || contactChannel || nextStep) {
    const label =
      handoffMode && handoffMode !== "manual_handoff"
        ? titleCase(handoffMode)
        : "Seller Coordinated";
    const parts = [contactChannel, nextStep].filter(Boolean);

    return {
      label,
      tone: "yellow" as const,
      description:
        parts.length > 0
          ? parts.join(" - ")
          : "The seller will coordinate access and delivery through the order thread.",
    };
  }

  return accessState(null);
}

function supportState(
  manifest: OrderManifest | null,
  deliveryData: Record<string, unknown> | null | undefined
) {
  const support = objectValue(manifest?.support);
  const rights = objectValue(manifest?.rights);
  const supportLevel =
    stringValue(support?.level) ?? firstString(deliveryData, ["support_level", "support_tier"]);
  const rightsScope =
    stringValue(rights?.scope) ?? firstString(deliveryData, ["rights_scope", "license_scope"]);

  if (supportLevel || rightsScope) {
    return {
      label: supportLevel ? titleCase(supportLevel) : "Rights Defined",
      tone: "blue" as const,
      description: rightsScope
        ? `Rights scope: ${rightsScope}`
        : "Support and rights details are defined in the purchased contract.",
    };
  }

  return {
    label: manifest ? "Standard Terms" : "Legacy Terms",
    tone: "yellow" as const,
    description: manifest
      ? "No extended support or rights metadata was attached to this order."
      : "Support, access, and rights follow the seller terms captured with the original order.",
  };
}

export function OrderDeliverySummaryCard({
  status,
  deliveryData,
  manifest,
}: OrderDeliverySummaryCardProps) {
  const sections = [
    {
      title: "Delivery State",
      ...deliveryState(status, deliveryData),
    },
    {
      title: "Contract",
      ...contractState(manifest),
    },
    {
      title: "Access Path",
      ...(manifest ? accessState(manifest) : legacyAccessState(deliveryData)),
    },
    {
      title: "Support & Rights",
      ...supportState(manifest, deliveryData),
    },
  ];

  return (
    <Card className="mb-6 border-border/50 bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Fulfillment Snapshot</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {sections.map((section) => (
          <div key={section.title} className="rounded-2xl border border-border/40 bg-background/40 p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {section.title}
            </div>
            <Badge variant="outline" className={`mt-3 ${PILL_CLASSES[section.tone]}`}>
              {section.label}
            </Badge>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">{section.description}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
