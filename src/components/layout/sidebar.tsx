"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  Clock,
  PlaneTakeoff,
  Bell,
  User,
  FileText,
  Users,
  HelpCircle,
  Settings,
  LogOut,
  ChevronRight,
  Menu,
  X
} from "lucide-react";
import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { logout } from "@/app/actions/auth";

interface SidebarProps {
  userRole: "employee" | "manager" | "admin";
  userName: string;
  userInitials: string;
}

const employeeNavItems = [
  {
    title: "Dashboard",
    href: "/employee/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "My Schedule",
    href: "/employee/schedule",
    icon: Calendar,
  },
  {
    title: "My Timecard",
    href: "/employee/timecard",
    icon: Clock,
  },
  {
    title: "Leave Request",
    href: "/employee/leave-request",
    icon: PlaneTakeoff,
  },
  {
    title: "Clock In/Out",
    href: "/employee/punch",
    icon: Clock,
  },
  {
    title: "Notifications",
    href: "/employee/notifications",
    icon: Bell,
  },
  {
    title: "Personal Info",
    href: "/employee/personal-info",
    icon: User,
  },
  {
    title: "Leave Balances",
    href: "/employee/leave-balances",
    icon: FileText,
  },
];

const adminNavItems = [
  {
    title: "Dashboard",
    href: "/admin/dashboard",
    icon: LayoutDashboard,
  },
];

const HELP_SUPPORT_URL = "https://onmanylevels.atlassian.net/servicedesk/customer/portal/235";

const helpNavItems: Array<{ title: string; href: string; icon: typeof HelpCircle; external?: boolean }> = [
  {
    title: "Help & Support",
    href: HELP_SUPPORT_URL,
    icon: HelpCircle,
    external: true,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export function Sidebar({ userRole, userName, userInitials }: SidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const navItems = userRole === "admin" ? adminNavItems : employeeNavItems;

  const handleLogout = () => {
    startTransition(() => {
      logout();
    });
  };

  const homeHref = userRole === "admin" ? "/admin/dashboard" : "/employee/dashboard";

  const NavContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo/Brand - Home Button */}
      <Link
        href={homeHref}
        onClick={() => setIsMobileOpen(false)}
        className="p-1 flex items-center justify-center hover:bg-gray-50 transition-colors cursor-pointer w-full"
      >
        <Image
          src="/albus-logo.png?v=1"
          alt="ALBUS Time and Attendance System"
          width={316}
          height={57}
          priority
          unoptimized
          style={{ width: '85%', height: 'auto' }}
        />
      </Link>

      <Separator />

      {/* User Section */}
      <div className={cn("p-4", isCollapsed && "px-2")}>
        <div className={cn("flex items-center gap-3", isCollapsed && "flex-col")}>
          <Avatar>
            <AvatarFallback className="bg-employee text-white">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{userName}</p>
              <Badge variant="secondary" className="mt-1 text-xs">
                {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
              </Badge>
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-employee text-white"
                  : "text-gray-700 hover:bg-gray-100",
                isCollapsed && "justify-center px-2"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!isCollapsed && <span>{item.title}</span>}
              {!isCollapsed && isActive && (
                <ChevronRight className="ml-auto h-4 w-4" />
              )}
            </Link>
          );
        })}

        <Separator className="my-4" />

        {/* Help Section */}
        {helpNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = !item.external && pathname === item.href;
          const className = cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
            isActive
              ? "bg-employee text-white"
              : "text-gray-700 hover:bg-gray-100",
            isCollapsed && "justify-center px-2"
          );

          if (item.external) {
            return (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsMobileOpen(false)}
                className={className}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!isCollapsed && <span>{item.title}</span>}
              </a>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsMobileOpen(false)}
              className={className}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!isCollapsed && <span>{item.title}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Logout Button */}
      <div className="p-4 border-t">
        <Button
          variant="ghost"
          onClick={handleLogout}
          disabled={isPending}
          className={cn(
            "w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10",
            isCollapsed && "justify-center px-2"
          )}
        >
          <LogOut className="h-5 w-5" />
          {!isCollapsed && <span className="ml-3">{isPending ? "Logging out..." : "Logout"}</span>}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <Button
        variant="outline"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        {isMobileOpen ? <X /> : <Menu />}
      </Button>

      {/* Mobile Sidebar Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-40 h-full w-64 bg-white border-r border-border transition-transform lg:hidden",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <NavContent />
      </aside>

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col h-screen bg-white border-r border-border transition-all duration-300 fixed left-0 top-0 z-30",
          isCollapsed ? "w-20" : "w-64"
        )}
      >
        <NavContent />

        {/* Collapse Toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-6 h-6 w-6 rounded-full border bg-white shadow-sm flex items-center justify-center hover:bg-gray-100"
        >
          <ChevronRight
            className={cn(
              "h-4 w-4 transition-transform",
              isCollapsed && "rotate-180"
            )}
          />
        </button>
      </aside>
    </>
  );
}
