import { Braces, Database, Gauge, Layers3 } from "lucide-react";

interface ModelCatalogCoverageProps {
  trackedArtifacts: number;
  canonicalProfiles: number;
  rankedProfiles: number;
  technicalProfiles: number;
}

export function ModelCatalogCoverage({
  trackedArtifacts,
  canonicalProfiles,
  rankedProfiles,
  technicalProfiles,
}: ModelCatalogCoverageProps) {
  const metrics = [
    {
      label: "Tracked artifacts",
      value: trackedArtifacts,
      detail: "Versions, endpoints, and packaging records",
      icon: Database,
    },
    {
      label: "Canonical profiles",
      value: canonicalProfiles,
      detail: "Safe family aliases combined for browsing",
      icon: Layers3,
    },
    {
      label: "Ranked profiles",
      value: rankedProfiles,
      detail: "Enough public signals for a current rank",
      icon: Gauge,
    },
    {
      label: "Technical profiles",
      value: technicalProfiles,
      detail: "Description plus at least one verified spec",
      icon: Braces,
    },
  ];

  return (
    <section className="relative mt-5 overflow-hidden rounded-2xl border border-border/50 bg-card/70 p-4 sm:p-5">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(0,212,170,0.09),transparent_38%),radial-gradient(circle_at_92%_12%,rgba(56,189,248,0.1),transparent_28%)]" />
      <div className="relative">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#00d4aa]">
              Catalog coverage
            </p>
            <h2 className="mt-1 text-base font-semibold">Why the counts are different</h2>
          </div>
          <p className="max-w-2xl text-xs leading-5 text-muted-foreground lg:text-right">
            A tracked record is not automatically a distinct rankable model. Dated versions,
            API aliases, quantizations, and runtime packages stay searchable while the default
            directory combines safe duplicates and ranks only evidence-backed profiles.
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-xl border border-border/40 bg-background/45 p-3.5">
              <div className="flex items-center justify-between gap-3">
                <metric.icon className="h-4 w-4 text-sky-400" />
                <span className="text-xl font-bold tabular-nums">
                  {metric.value.toLocaleString()}
                </span>
              </div>
              <p className="mt-3 text-xs font-semibold">{metric.label}</p>
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{metric.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
