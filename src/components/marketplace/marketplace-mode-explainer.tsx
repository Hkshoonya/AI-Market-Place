import { ArrowLeftRight, BadgeDollarSign, ShieldCheck, Wallet } from "lucide-react";
import { getMarketplaceFeeHeadline, getSettlementModeOptions } from "@/lib/marketplace/settlement";

const ICONS = {
  direct: Wallet,
  assisted_escrow: ShieldCheck,
  tracking: ArrowLeftRight,
  fee: BadgeDollarSign,
} as const;

export function MarketplaceModeExplainer() {
  const [direct, assisted] = getSettlementModeOptions();

  const cards = [
    {
      key: direct.key,
      title: direct.title,
      description: direct.description,
      eyebrow: direct.feeLabel,
      icon: ICONS.direct,
    },
    {
      key: assisted.key,
      title: assisted.title,
      description: assisted.description,
      eyebrow: assisted.feeLabel,
      icon: ICONS.assisted_escrow,
    },
    {
      key: "tracking",
      title: "What We Track",
      description:
        "Direct and assisted deals can still stay visible on-platform so buyers, sellers, and admins can follow communication, fulfillment context, and investigations when needed.",
      eyebrow: "Recorded context",
      icon: ICONS.tracking,
    },
    {
      key: "fee",
      title: getMarketplaceFeeHeadline(),
      description:
        "Use your own wallet and settle directly, or let AI Market Cap assist with escrow. Public pricing stays simple while internal policy can change later without rewiring the buyer flow.",
      eyebrow: "Launch posture",
      icon: ICONS.fee,
    },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <section
            key={card.key}
            className="flex h-full flex-col rounded-2xl border border-border/50 bg-card/90 p-5"
          >
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <Icon className="h-3.5 w-3.5 text-neon" />
              {card.eyebrow}
            </div>
            <h2 className="mt-4 text-lg font-semibold">{card.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {card.description}
            </p>
          </section>
        );
      })}
    </div>
  );
}
