import { cn } from "@/lib/utils";

interface DeploymentMeaningLegendProps {
  className?: string;
  intro?: string | null;
}

export function DeploymentMeaningLegend({
  className,
  intro = null,
}: DeploymentMeaningLegendProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {intro ? <p className="text-sm text-muted-foreground">{intro}</p> : null}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-border/50 bg-card/60 p-4 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">Hosted for you</p>
          <p className="mt-1">
            You can start without renting or managing your own server.
          </p>
        </div>
        <div className="rounded-xl border border-border/50 bg-card/60 p-4 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">Cloud server you control</p>
          <p className="mt-1">
            You rent the machine and manage setup, uptime, and GPU cost yourself.
          </p>
        </div>
        <div className="rounded-xl border border-border/50 bg-card/60 p-4 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">On your computer</p>
          <p className="mt-1">
            It runs locally, but larger open models may still need a real desktop GPU. When we can
            estimate it, model deploy surfaces show rough GPU memory guidance too.
          </p>
        </div>
      </div>
    </div>
  );
}
