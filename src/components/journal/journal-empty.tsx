import Link from "next/link";
import { NotebookPen } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function JournalEmpty() {
  return (
    <Card className="border-dashed">
      <CardHeader className="text-center">
        <NotebookPen className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden />
        <CardTitle>No calls logged yet</CardTitle>
        <CardDescription>
          Log a signal from any stock&apos;s detail page to start tracking it here.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center pb-8">
        <Link href="/stocks">
          <Button>Browse stocks</Button>
        </Link>
      </CardContent>
    </Card>
  );
}
