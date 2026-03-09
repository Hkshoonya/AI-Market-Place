import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface UpdateEntry {
  title: string;
  description: string | null;
  update_type: string;
  published_at: string;
}

export interface ChangelogTabProps {
  updates: UpdateEntry[];
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
              <div key={i} className="flex gap-4">
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
