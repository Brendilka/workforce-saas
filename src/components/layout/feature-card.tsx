import Link from "next/link";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeatureCardProps {
  title: string;
  href: string;
  icon: LucideIcon;
  description?: string;
  variant?: "employee" | "manager" | "admin" | "default";
  disabled?: boolean;
}

export function FeatureCard({
  title,
  href,
  icon: Icon,
  description,
  variant = "employee",
  disabled = false,
}: FeatureCardProps) {
  const variantStyles = {
    employee: "bg-employee hover:bg-employee-hover",
    manager: "bg-manager hover:bg-manager-hover",
    admin: "bg-admin hover:bg-admin-hover",
    default: "bg-primary hover:bg-primary/90",
  };

  const baseClasses = cn(
    "flex flex-col items-center justify-center text-white rounded-2xl p-6 min-h-[150px] shadow-md transition-all duration-300",
    disabled
      ? "bg-gray-300 dark:bg-gray-700 cursor-not-allowed opacity-50"
      : cn(
          "hover:shadow-lg hover:-translate-y-1 hover:scale-[1.02] group",
          variantStyles[variant]
        )
  );

  const content = (
    <>
      <Icon
        className={cn(
          "h-10 w-10 mb-3 transition-transform",
          !disabled && "group-hover:scale-110"
        )}
      />
      <h3 className="text-base font-medium text-center leading-snug">
        {title}
      </h3>
      {description && (
        <p className="text-xs text-white/80 mt-1 text-center">{description}</p>
      )}
    </>
  );

  if (disabled) {
    return <div className={baseClasses}>{content}</div>;
  }

  return (
    <Link href={href} className={baseClasses}>
      {content}
    </Link>
  );
}
