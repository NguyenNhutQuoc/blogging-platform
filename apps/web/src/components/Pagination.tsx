import { Button } from "@repo/ui";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  baseUrl: string;
}

export function Pagination({ currentPage, totalPages, baseUrl }: PaginationProps) {
  if (totalPages <= 1) return null;

  const prev = currentPage > 1 ? `${baseUrl}?page=${currentPage - 1}` : null;
  const next = currentPage < totalPages ? `${baseUrl}?page=${currentPage + 1}` : null;

  return (
    <div className="flex items-center justify-center gap-4">
      {prev ? (
        <a href={prev}>
          <Button variant="outline" size="sm">← Previous</Button>
        </a>
      ) : (
        <Button variant="outline" size="sm" disabled>← Previous</Button>
      )}

      <span className="text-sm text-muted-foreground">
        Page {currentPage} of {totalPages}
      </span>

      {next ? (
        <a href={next}>
          <Button variant="outline" size="sm">Next →</Button>
        </a>
      ) : (
        <Button variant="outline" size="sm" disabled>Next →</Button>
      )}
    </div>
  );
}
