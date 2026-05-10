import Link from "next/link";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="px-6 py-3 bg-page-bg flex items-center gap-1.5 text-xs text-t3">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={index} className="flex items-center gap-1.5">
            {index > 0 && <span className="text-t3 select-none">/</span>}
            {isLast || !item.href ? (
              <span className={cn("font-medium", isLast ? "text-t2" : "text-t3")}>
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="text-t3 hover:text-t2 transition-colors"
              >
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
