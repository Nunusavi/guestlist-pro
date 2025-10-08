import Link from "next/link";
import { useRouter } from "next/router";
import { LogOut, ShieldCheck, LayoutDashboard, Users, List } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const navItems = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/users", label: "User Management", icon: Users },
    { href: "/guests", label: "Guest List", icon: List },
];

export default function AdminLayout({ children, stats, statsLoading = false }) {
    const { user, logout } = useAuth();
    const router = useRouter();

    const isActive = (href) => router.pathname === href;

    const overview = stats?.overview ?? {};
    const recent = stats?.recent ?? {};
    const generatedAt = stats?.generatedAt ?? null;
    const hasStats = Boolean(stats);

    const formatNumber = (value) => {
        if (value === null || value === undefined) return "—";
        if (typeof value !== "number") return value;
        return value.toLocaleString();
    };

    const formatPercentage = (value) => {
        if (value === null || value === undefined || Number.isNaN(Number(value))) return "0%";
        const numeric = Number(value);
        return `${numeric.toFixed(0)}%`;
    };

    const computedCheckInRate = (() => {
        if (overview.checkInPercentage !== undefined) {
            return formatPercentage(overview.checkInPercentage);
        }
        if (typeof overview.checkedIn === "number" && typeof overview.totalGuests === "number" && overview.totalGuests > 0) {
            return formatPercentage((overview.checkedIn / overview.totalGuests) * 100);
        }
        return "0%";
    })();

    const formattedGeneratedAt = (() => {
        if (!generatedAt) return null;
        const date = new Date(generatedAt);
        if (Number.isNaN(date.getTime())) return null;
        return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    })();

    return (
        <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-50 ">
            <header className="sticky top-0 z-40 border-b border-slate-800/70 bg-slate-950/80 backdrop-blur">
                <div className="flex flex-row h-16 items-center justify-around px-4 sm:px-8">
                    <div>
                        <p className="text-sm text-shadow-purple-400 font-bold uppercase tracking-[0.35em] text-slate-400">Admin Console</p>
                    </div>
                    <Card className="hidden items-center gap-4 rounded-10 border-0 bg-slate-950 px-4 py-2 text-sm text-slate-200 shadow-sm md:flex md:flex-row">
                        <div className="flex flex-col">
                            <span className="font-medium">{user?.fullName || user?.username}</span>
                        </div>
                        <Button variant="outline" size="sm" onClick={logout} className="border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800">
                            <LogOut className="mr-2 h-4 w-4" /> Logout
                        </Button>
                    </Card>
                </div>
            </header>
            <div className="flex flex-1 flex-col gap-6 px-4 pb-10 pt-6 sm:px-8 lg:flex-row lg:gap-10">
                <aside className="lg:w-72">
                    <Card className="overflow-hidden border-slate-800 bg-slate-900/60 shadow-xl shadow-black/30">
                        <CardContent className="space-y-6 p-6">
                            <div className="flex items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-900/80 p-4">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-slate-200">
                                    <ShieldCheck className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-400">Signed in as</p>
                                    <p className="text-base font-semibold text-white">{user?.fullName || user?.username}</p>
                                </div>
                            </div>

                            <nav className="space-y-2">
                                {navItems.map((item) => (
                                    <Link key={item.href} href={item.href}>
                                        <div
                                            className={cn(
                                                "group flex items-center gap-3 rounded-xl border border-transparent px-4 py-3 text-sm font-medium transition-all",
                                                "text-slate-300 hover:border-slate-700 hover:bg-slate-900/70 hover:text-white",
                                                isActive(item.href) && "border-slate-700 bg-slate-900/80 text-white shadow-inner"
                                            )}
                                        >
                                            <item.icon className="h-4 w-4 text-slate-500 transition-colors group-hover:text-slate-200" />
                                            <span>{item.label}</span>
                                        </div>
                                    </Link>
                                ))}
                            </nav>

                            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                                <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
                                {statsLoading ? (
                                    <div className="mt-4 space-y-2">
                                        <div className="h-4 animate-pulse rounded bg-slate-800" />
                                        <div className="h-4 animate-pulse rounded bg-slate-800" />
                                        <div className="h-4 animate-pulse rounded bg-slate-800" />
                                    </div>
                                ) : hasStats ? (
                                    <div className="mt-3 space-y-3 text-sm">
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-slate-400">Total guests</span>
                                            <Badge variant="outline" className="border-emerald-500/60 bg-emerald-500/10 text-emerald-200">
                                                {formatNumber(overview.totalGuests)}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-slate-400">Checked in</span>
                                            <Badge variant="outline" className="border-sky-500/40 bg-sky-500/10 text-sky-200">
                                                {formatNumber(overview.checkedIn)} · {computedCheckInRate}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-slate-400">Last hour</span>
                                            <Badge variant="outline" className="border-amber-500/50 bg-amber-500/10 text-amber-200">
                                                {formatNumber(recent.lastHour ?? 0)}
                                            </Badge>
                                        </div>
                                        {formattedGeneratedAt && (
                                            <p className="text-xs text-slate-500/80">Updated {formattedGeneratedAt}</p>
                                        )}
                                    </div>
                                ) : (
                                    <p className="mt-3 text-xs text-slate-500">Statistics will appear once data loads.</p>
                                )}
                            </div>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={logout}
                                className="w-full border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800 md:hidden"
                            >
                                <LogOut className="mr-2 h-4 w-4" /> Logout
                            </Button>
                        </CardContent>
                    </Card>
                </aside>
                <main className="flex-1">
                    <div className="h-full rounded-3xl border border-slate-800 bg-white/5 p-6 shadow-2xl shadow-black/30 backdrop-blur">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}