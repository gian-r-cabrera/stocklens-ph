import { JournalContent } from "@/components/journal/journal-content";
import { APP_PAGE_CLASS } from "@/lib/layout";

export default function JournalPage() {
  return (
    <div className={APP_PAGE_CLASS}>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Prediction Journal</h1>
        <p className="mt-1 text-muted-foreground">
          Track whether the Buy/Hold/Avoid signal actually worked on the calls you cared
          about.
        </p>
      </div>
      <JournalContent />
    </div>
  );
}
