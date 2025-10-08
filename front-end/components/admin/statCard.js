import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function StatCard({ title, value, icon: Icon, loading }) {
    if (loading) {
        return (
            <Card className="h-32 animate-pulse rounded-2xl border border-white/10 bg-slate-900/30" />
        );
    }

    return (
        <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-900/40 to-slate-800/30 p-5 text-slate-100 shadow-lg shadow-black/20">
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-400/10 blur-3xl" />
            <div className="absolute -bottom-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-slate-500/10 blur-3xl" />
            <CardContent className="relative z-10 p-0">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-wide text-slate-300/80">{title}</p>
                        <p className="mt-3 text-3xl font-semibold text-white">{value ?? "—"}</p>
                    </div>
                    {Icon && (
                        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/10">
                            <Icon className="h-5 w-5 text-emerald-300" />
                        </span>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}