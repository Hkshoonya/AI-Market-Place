import { cn } from "@/lib/utils";
import { CATEGORY_MAP, type ModelCategory } from "@/lib/constants/categories";
import { Badge } from "@/components/ui/badge";

interface CategoryBadgeProps {
  category: ModelCategory;
  size?: "sm" | "md";
  showIcon?: boolean;
}

export function CategoryBadge({
  category,
  size = "sm",
  showIcon = true,
}: CategoryBadgeProps) {
  const config = CATEGORY_MAP[category];
  if (!config) return null;

  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 border-transparent font-medium",
        size === "sm" ? "px-1.5 py-0 text-[11px]" : "px-2 py-0.5 text-xs"
      )}
      style={{
        backgroundColor: `${config.color}15`,
        color: config.color,
      }}
    >
      {showIcon && (
        <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      )}
      {config.shortLabel}
    </Badge>
  );
}
