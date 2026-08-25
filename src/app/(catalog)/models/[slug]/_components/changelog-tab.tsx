import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";

export interface UpdateEntry {
  id?: string;
  title: string;
  description: string | null;
  update_type: string;
  published_at: string;
  source_url?: string | null;
}

export interface ChangelogTabProps {
  updates: UpdateEntry[];
}

function UpdateSourceLink({ url }: { url: string | null | undefined }) {
  if (!url) return null;

  let safeUrl: string;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    safeUrl = parsed.toString();
  } catch {
    return null;
  }

  return (
    <a
      href={safeUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="ml-3 inline-flex items-center gap-1 text-xs text-[#00d4aa] hover:underline"
    >
      View source
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

export function ChangelogTab({ updates }: ChangelogTabProps) {
  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-lg">Recent Updates</CardTitle>
      </CardHeader>
      <CardContent>
        {updates.length > 0 ? (
          <div className="space-y-6">
            {updates.map((update, i) => (
              <div
                key={update.id ?? `${update.published_at}:${update.title}`}
                className="flex gap-4"
              >
                <div className="flex flex-col items-center">
                  <div className="h-2.5 w-2.5 rounded-full bg-neon" />
                  {i < updates.length - 1 && <div className="flex-1 w-px bg-border/50 mt-1" />}
                </div>
                <div className="flex-1 pb-2">
                  <p className="text-xs text-muted-foreground">
                    {new Date(update.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                  <p className="text-sm font-semibold mt-0.5">{update.title}</p>
                  {update.description && (
                    <p className="text-xs text-muted-foreground mt-1">{update.description}</p>
                  )}
                  <Badge variant="outline" className="mt-2 text-[10px]">
                    {update.update_type.replace(/_/g, " ")}
                  </Badge>
                  <UpdateSourceLink url={update.source_url} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">No updates recorded yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
