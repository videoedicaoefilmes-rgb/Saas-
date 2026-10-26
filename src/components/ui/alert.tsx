import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const styles = {
  info: { box: "bg-info-soft border-blue-200 text-blue-900", Icon: Info },
  success: { box: "bg-primary-soft border-green-200 text-green-900", Icon: CheckCircle2 },
  warning: { box: "bg-warning-soft border-amber-200 text-amber-900", Icon: AlertTriangle },
  error: { box: "bg-danger-soft border-red-200 text-red-900", Icon: XCircle },
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: keyof typeof styles;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const { box, Icon } = styles[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex gap-3 rounded-lg border px-4 py-3 text-sm", box, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="flex flex-col gap-0.5">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div>{children}</div>}
      </div>
    </div>
  );
}
