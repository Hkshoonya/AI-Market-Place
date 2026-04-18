import { Badge } from "@/components/ui/badge";
import {
  getModelUpgradeHighlight,
  getModelUpgradeHighlightKind,
  type UpgradeHighlightSource,
} from "@/lib/models/upgrade-highlights";

export function ModelUpgradeNote({
  model,
  compact = false,
}: {
  model: UpgradeHighlightSource;
  compact?: boolean;
}) {
  const highlight = getModelUpgradeHighlight(model);
  const kind = getModelUpgradeHighlightKind(model);

  if (!highlight || !kind) return null;

  const badgeLabel = kind === "upgrade" ? "What changed" : "Lifecycle";
  const badgeClasses =
    kind === "upgrade"
      ? "border-neon/30 bg-neon/10 text-neon"
      : "border-amber-500/30 bg-amber-500/10 text-amber-200";

  return (
    <div
      className={
        compact
          ? "mt-1.5 flex items-start gap-2"
          : "mt-4 rounded-xl border border-border/50 bg-card/60 p-4"
      }
    >
      <Badge variant="outline" className={`shrink-0 text-[10px] ${badgeClasses}`}>
        {badgeLabel}
      </Badge>
      <p
        className={
          compact
            ? "min-w-0 text-[11px] leading-5 text-muted-foreground line-clamp-2"
            : "text-sm leading-6 text-muted-foreground"
        }
      >
        {highlight}
      </p>
    </div>
  );
}
