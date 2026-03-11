import Link from "next/link";
// REMOVED: import { ArrowLeft, Home, Search } from "lucide-react";
import { Home, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-neon/10">
        <span className="text-4xl font-bold text-neon">404</span>
      </div>
      <h1 className="text-2xl font-bold">Page Not Found</h1>
      <p className="mt-2 text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/">
            <Home className="mr-1.5 h-4 w-4" />
            Home
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/models">
            <Search className="mr-1.5 h-4 w-4" />
            Browse Models
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/leaderboards">
            Leaderboards
          </Link>
        </Button>
      </div>
    </div>
  );
}
