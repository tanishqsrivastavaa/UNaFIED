import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export default function Kbd({ children, className }: { children: ReactNode; className?: string }) {
    return <kbd className={cn("kbd", className)}>{children}</kbd>;
}
