import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users, UserCheck, Clock, PlusCircle, UserPlus, UserMinus, Ticket, BarChart3 } from "lucide-react";

import RouteGuard from "@/components/RouteGuard";
import AdminLayout from "@/components/layout/AdminLayout";
import StatCard from "@/components/admin/statCard";
import { Separator } from "@/components/ui/separator";
import { apiGetStats } from "@/lib/api";

function AdminDashboard({ stats, loading }) {
    const overview = stats?.overview ?? {};
    const recent = stats?.recent ?? {};
    const ticketMix = Array.isArray(stats?.byTicketType) ? stats.byTicketType : [];
    const busiestHours = Array.isArray(stats?.busiestHours) ? stats.busiestHours : [];
    const generatedAt = stats?.generatedAt ?? null;
    const totalAttendance = typeof overview.totalAttendees === "number"
        ? overview.totalAttendees
        : (overview.checkedIn ?? 0) + (overview.totalPlusOnes ?? 0);

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

    const formattedGeneratedAt = (() => {
        if (!generatedAt) return "—";
        const date = new Date(generatedAt);
        if (Number.isNaN(date.getTime())) return "—";
        return date.toLocaleString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    })();

    return (
        <section className="space-y-10">
            <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-slate-800/40 p-8">
                <div className="absolute -left-10 top-0 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />
                <div className="absolute -right-16 bottom-0 h-36 w-36 rounded-full bg-sky-400/10 blur-3xl" />
                <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/70">Live Event Pulse</p>
                        <h1 className="mt-3 text-4xl font-semibold text-white">Operational Overview</h1>
                        <p className="mt-4 max-w-xl text-sm text-slate-200/80">
                            Monitor attendance in real time, track team performance, and make sure every guest receives a smooth welcome.
                        </p>
                    </div>
                    <div className="grid gap-2 text-right text-sm text-slate-300/80">
                        <span>Last sync {formattedGeneratedAt !== "—" ? formattedGeneratedAt : "awaiting data"}</span>
                        <span className="font-semibold text-emerald-300">Systems nominal</span>
                    </div>
                </div>
            </header>

            <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
                <StatCard
                    title="Total Guests"
                    value={formatNumber(overview.totalGuests)}
                    icon={Users}
                    loading={loading}
                />
                <StatCard
                    title="Guests Checked In"
                    value={
                        overview.totalGuests
                            ? `${formatNumber(overview.checkedIn)} (${formatPercentage(overview.checkInPercentage)})`
                            : formatNumber(overview.checkedIn)
                    }
                    icon={UserCheck}
                    loading={loading}
                />
                <StatCard
                    title="Awaiting Arrival"
                    value={formatNumber(overview.notCheckedIn)}
                    icon={UserMinus}
                    loading={loading}
                />
                <StatCard
                    title="Check-ins (Last Hour)"
                    value={formatNumber(recent.lastHour)}
                    icon={Clock}
                    loading={loading}
                />
                <StatCard
                    title="Total Plus-Ones"
                    value={formatNumber(overview.totalPlusOnes)}
                    icon={PlusCircle}
                    loading={loading}
                />
                <StatCard
                    title="Total Attendees"
                    value={formatNumber(totalAttendance)}
                    icon={UserPlus}
                    loading={loading}
                />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
                <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-lg font-semibold text-white">Ticket Mix</h2>
                        <Ticket className="h-5 w-5 text-emerald-300/80" />
                    </div>
                    <p className="mt-2 text-xs uppercase tracking-wide text-slate-400">Share of checked-in attendance</p>
                    <div className="mt-4 space-y-3">
                        {!loading && ticketMix.length === 0 && (
                            <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-center text-sm text-slate-300/80">
                                No check-ins recorded yet.
                            </div>
                        )}
                        {loading ? (
                            Array(3).fill(0).map((_, index) => (
                                <div key={index} className="h-16 animate-pulse rounded-2xl bg-white/10" />
                            ))
                        ) : (
                            ticketMix.map((segment) => {
                                const share = totalAttendance > 0
                                    ? Math.round((segment.total / totalAttendance) * 100)
                                    : 0;
                                return (
                                    <div
                                        key={segment.ticketType}
                                        className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4"
                                    >
                                        <div>
                                            <p className="text-sm font-semibold text-white">{segment.ticketType}</p>
                                            <p className="text-xs text-slate-300/80">
                                                Guests {formatNumber(segment.count)} • Plus-ones {formatNumber(segment.plusOnes)}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-semibold text-white">{formatNumber(segment.total)}</p>
                                            <p className="text-xs text-slate-400">{share}% of headcount</p>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
                <div className="space-y-6">
                    <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="text-lg font-semibold text-white">Flow Snapshot</h2>
                            <BarChart3 className="h-5 w-5 text-sky-300/80" />
                        </div>
                        <div className="mt-5 grid gap-4">
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <p className="text-xs uppercase tracking-wide text-slate-400">Awaiting check-in</p>
                                <p className="mt-2 text-2xl font-semibold text-white">{formatNumber(overview.notCheckedIn)}</p>
                                <p className="text-xs text-slate-300/80">Guests who have not yet arrived</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <p className="text-xs uppercase tracking-wide text-slate-400">Plus-ones registered</p>
                                <p className="mt-2 text-2xl font-semibold text-white">{formatNumber(overview.totalPlusOnes)}</p>
                                <p className="text-xs text-slate-300/80">Included in total attendees</p>
                            </div>
                        </div>
                        <Separator className="my-6 border-white/10" />
                        <div>
                            <h3 className="text-sm font-semibold text-white">Busiest Hours</h3>
                            <p className="text-xs uppercase tracking-wide text-slate-400">All-time peaks</p>
                            <ul className="mt-3 space-y-3 text-sm text-slate-300/90">
                                {!loading && busiestHours.length === 0 && (
                                    <li className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-center text-xs text-slate-300/80">
                                        No data recorded yet.
                                    </li>
                                )}
                                {loading ? (
                                    Array(3).fill(0).map((_, index) => (
                                        <li key={index} className="h-12 animate-pulse rounded-2xl bg-white/10" />
                                    ))
                                ) : (
                                    busiestHours.map((hour) => (
                                        <li
                                            key={`${hour.hourOfDay}-${hour.hourLabel}`}
                                            className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4"
                                        >
                                            <span className="font-medium text-white">{hour.hourLabel}</span>
                                            <span className="text-sm text-slate-300/80">{formatNumber(hour.count)} check-ins</span>
                                        </li>
                                    ))
                                )}
                            </ul>
                        </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 text-sm text-slate-300/90">
                        <h2 className="text-lg font-semibold text-white">Operations Log</h2>
                        <p className="mt-3">
                            {formattedGeneratedAt !== "—"
                                ? `Dashboard refreshed at ${formattedGeneratedAt}.`
                                : "Awaiting first data sync from the event database."}
                        </p>
                        <p className="mt-2 text-xs uppercase tracking-[0.28em] text-slate-500">Data source • GuestList Core</p>
                    </div>
                </div>
            </div>
        </section>
    );
}

export default function ProtectedAdminDashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiGetStats()
            .then(setStats)
            .catch((err) => toast.error("Failed to load stats", { description: err.message }))
            .finally(() => setLoading(false));
    }, []);

    return (
        <RouteGuard requiredRole="admin">
            <AdminLayout stats={stats} statsLoading={loading}>
                <AdminDashboard stats={stats} loading={loading} />
            </AdminLayout>
        </RouteGuard>
    );
}