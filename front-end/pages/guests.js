import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";

import RouteGuard from "@/components/RouteGuard";
import { useAuth } from "@/context/AuthContext";
import AdminLayout from "@/components/layout/AdminLayout";
import MainLayout from "@/components/layout/MainLayout";
import { apiGetGuests } from "@/lib/api";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

// Normalization function inspired by your admin/users.js
const normalizeGuest = (guest) => {
    if (!guest) return null;
    const firstName = guest.firstName || guest.first_name || "";
    const lastName = guest.lastName || guest.last_name || "";
    const ticketType = guest.ticketType || guest.ticket_type || "General";
    const plusOnesAllowed = typeof guest.plusOnesAllowed === "number"
        ? guest.plusOnesAllowed
        : typeof guest.plus_ones_allowed === "number"
            ? guest.plus_ones_allowed
            : 0;
    const plusOnesCheckedIn = typeof guest.plusOnesCheckedIn === "number"
        ? guest.plusOnesCheckedIn
        : typeof guest.plus_ones_checked_in === "number"
            ? guest.plus_ones_checked_in
            : 0;
    const rawStatus = guest.status || "Not Checked In";
    const normalizedStatus = rawStatus.toString().trim().toLowerCase().replace(/\s+/g, "_");

    const formatDateTime = (value) => {
        if (!value) return "—";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return "—";
        }
        return date.toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const checkInTimeRaw = guest.checkInTime || guest.check_in_time || null;
    const createdAt = guest.createdAt || guest.created_at || null;
    const lastModified = guest.lastModified || guest.last_modified || null;

    return {
        id: guest.id,
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`.trim(),
        email: guest.email || "",
        phone: guest.phone || "",
        ticketType,
        plusOnesAllowed,
        plusOnesCheckedIn,
        plusOnesRemaining: Math.max(0, plusOnesAllowed - plusOnesCheckedIn),
        confirmationCode: guest.confirmationCode || guest.confirmation_code || null,
        status: normalizedStatus || "not_checked_in",
        statusLabel: rawStatus,
        checkInTime: checkInTimeRaw,
        checkInTimeDisplay: formatDateTime(checkInTimeRaw),
        checkedInBy: guest.checkedInBy || guest.checked_in_by || null,
        notes: guest.notes || "",
        createdAt,
        createdAtDisplay: formatDateTime(createdAt),
        lastModified,
        lastModifiedDisplay: formatDateTime(lastModified),
    };
};

function GuestListPage() {
    const [guests, setGuests] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, totalGuests: 0 });
    const [filters, setFilters] = useState({ status: "", ticketType: "" });
    const [loading, setLoading] = useState(true);
    const [selectedGuest, setSelectedGuest] = useState(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    const fetchGuests = (page, currentFilters) => {
        setLoading(true);
        const params = { page, limit: 20, ...currentFilters };
        apiGetGuests(params)
            .then((data) => {
                setGuests(data.guests.map(normalizeGuest));
                setPagination({
                    page: data.pagination.currentPage,
                    totalPages: data.pagination.totalPages,
                    totalGuests: data.pagination.totalItems,
                });
            })
            .catch((err) => toast.error("Failed to load guests", { description: err.message }))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchGuests(pagination.page, filters);
    }, [pagination.page, filters]);

    const handleFilterChange = (filterName, value) => {
        setFilters(prev => ({ ...prev, [filterName]: value === "all" ? "" : value }));
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pagination.totalPages) {
            setPagination(prev => ({ ...prev, page: newPage }));
        }
    };

    const ticketTypes = useMemo(() => ([
        { value: "all", label: "All tickets" },
        { value: "VIP", label: "VIP" },
        { value: "Premium", label: "Premium" },
        { value: "General", label: "General" },
    ]), []);

    const statuses = useMemo(() => ([
        { value: "all", label: "All statuses" },
        { value: "checked_in", label: "Checked In" },
        { value: "not_checked_in", label: "Not Checked In" },
    ]), []);

    const statusBadgeClass = (status) => (
        status === "checked_in"
            ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-200"
            : "border-white/20 bg-white/5 text-slate-200"
    );

    const openGuestDetails = (guest) => {
        setSelectedGuest(guest);
        setIsDetailsOpen(true);
    };

    const closeGuestDetails = () => {
        setIsDetailsOpen(false);
        setSelectedGuest(null);
    };

    return (
        <section className="space-y-8">
            <header className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-800/50 p-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Guest Registry</p>
                    <h1 className="mt-2 text-3xl font-semibold text-white">Guest Directory</h1>
                    <p className="mt-2 text-sm text-slate-300/90">
                        Browse arrivals, manage ticket tiers, and keep a pulse on who has checked in.
                    </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <Select
                        value={filters.status || "all"}
                        onValueChange={(value) => handleFilterChange("status", value)}
                    >
                        <SelectTrigger className="w-full rounded-full border-white/20 bg-white/10 text-slate-100 sm:w-[200px]">
                            <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent className="border-slate-800 bg-slate-900 text-slate-100">
                            {statuses.map((status) => (
                                <SelectItem key={status.value} value={status.value}>
                                    {status.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select
                        value={filters.ticketType || "all"}
                        onValueChange={(value) => handleFilterChange("ticketType", value)}
                    >
                        <SelectTrigger className="w-full rounded-full border-white/20 bg-white/10 text-slate-100 sm:w-[200px]">
                            <SelectValue placeholder="Filter by ticket type" />
                        </SelectTrigger>
                        <SelectContent className="border-slate-800 bg-slate-900 text-slate-100">
                            {ticketTypes.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                    {type.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </header>

            <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70 shadow-inner">
                <div className="border-b border-white/10 px-6 py-4 text-xs uppercase tracking-wide text-slate-300/70">
                    {loading ? "Syncing roster…" : `Showing ${pagination.totalGuests} guests`}
                </div>
                <div className="hidden md:block">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-b border-white/10">
                                <TableHead className="w-[22%] text-slate-300/80">Guest</TableHead>
                                <TableHead className="w-[20%] text-slate-300/80">Email</TableHead>
                                <TableHead className="w-[14%] text-slate-300/80">Phone</TableHead>
                                <TableHead className="w-[12%] text-slate-300/80">Ticket</TableHead>
                                <TableHead className="w-[14%] text-slate-300/80">Plus-Ones</TableHead>
                                <TableHead className="w-[10%] text-slate-300/80">Status</TableHead>
                                <TableHead className="text-right text-slate-300/80">Last Check-in</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array(6).fill(0).map((_, i) => (
                                    <TableRow key={i} className="border-b border-white/5">
                                        <TableCell colSpan={7}>
                                            <Skeleton className="h-12 w-full rounded-xl bg-slate-900/60" />
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : guests.length > 0 ? (
                                guests.map((guest) => (
                                    <TableRow
                                        key={guest.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => openGuestDetails(guest)}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter" || event.key === " ") {
                                                event.preventDefault();
                                                openGuestDetails(guest);
                                            }
                                        }}
                                        className="cursor-pointer border-b border-white/5 transition-colors hover:bg-slate-900/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
                                    >
                                        <TableCell className="font-medium text-white">
                                            <div className="flex flex-col">
                                                <span>{guest.fullName}</span>
                                                <span className="text-xs text-slate-400">ID: {guest.id}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-slate-300/90">{guest.email || "—"}</TableCell>
                                        <TableCell className="text-slate-300/80">{guest.phone || "—"}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="border-sky-400/40 bg-sky-500/10 text-sky-200">
                                                {guest.ticketType}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-slate-300/90">
                                            <span className="text-sm font-medium">
                                                {guest.plusOnesCheckedIn}/{guest.plusOnesAllowed}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={statusBadgeClass(guest.status)}>
                                                {guest.statusLabel}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right text-sm text-slate-300/80">
                                            {guest.checkInTimeDisplay}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={7} className="py-12 text-center text-sm text-slate-400">
                                        No guests match the current filters. Try adjusting your criteria.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                <div className="space-y-3 p-4 md:hidden">
                    {loading ? (
                        Array(4).fill(0).map((_, i) => (
                            <Skeleton key={i} className="h-28 w-full rounded-2xl bg-slate-900/60" />
                        ))
                    ) : guests.length > 0 ? (
                        guests.map((guest) => (
                            <button
                                key={guest.id}
                                onClick={() => openGuestDetails(guest)}
                                className="w-full rounded-2xl border border-white/15 bg-slate-900/60 p-4 text-left text-slate-100 shadow-sm transition hover:border-emerald-400/40 hover:bg-slate-900/40"
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h3 className="text-base font-semibold">{guest.fullName}</h3>
                                        <p className="mt-1 text-xs text-slate-400">{guest.email || "No email"}</p>
                                        <p className="text-xs text-slate-400">{guest.phone || "No phone"}</p>
                                    </div>
                                    <Badge variant="outline" className={statusBadgeClass(guest.status)}>
                                        {guest.statusLabel}
                                    </Badge>
                                </div>
                                <div className="mt-4 flex items-center justify-between text-xs text-slate-300/80">
                                    <span>{guest.ticketType} • Plus-ones {guest.plusOnesCheckedIn}/{guest.plusOnesAllowed}</span>
                                    <span>{guest.checkInTimeDisplay}</span>
                                </div>
                            </button>
                        ))
                    ) : (
                        <p className="py-6 text-center text-sm text-slate-400">
                            No guests match the current filters. Try adjusting your criteria.
                        </p>
                    )}
                </div>
            </div>

            <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-950/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-slate-300/80">
                    Page {pagination.page} of {pagination.totalPages || 1}
                </span>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(pagination.page - 1)}
                        disabled={pagination.page <= 1}
                        className="rounded-full border-white/20 bg-white/5 text-slate-100 hover:bg-white/10 disabled:opacity-40"
                    >
                        <ChevronLeft className="mr-1 h-4 w-4" /> Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(pagination.page + 1)}
                        disabled={pagination.page >= pagination.totalPages}
                        className="rounded-full border-white/20 bg-white/5 text-slate-100 hover:bg-white/10 disabled:opacity-40"
                    >
                        Next <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                </div>
            </div>

            <Dialog open={isDetailsOpen} onOpenChange={(open) => (open ? setIsDetailsOpen(true) : closeGuestDetails())}>
                <DialogContent className="max-w-xl border border-white/10 bg-slate-950/90 text-slate-100">
                    {selectedGuest ? (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center justify-between gap-3 text-2xl font-semibold text-white">
                                    <span>{selectedGuest.fullName}</span>
                                    <Badge variant="outline" className={statusBadgeClass(selectedGuest.status)}>
                                        {selectedGuest.statusLabel}
                                    </Badge>
                                </DialogTitle>
                                <DialogDescription className="text-sm text-slate-300/80">
                                    Guest ID: {selectedGuest.id}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-6">
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                        <p className="text-xs uppercase tracking-wide text-slate-400">Ticket Type</p>
                                        <p className="mt-2 text-base font-semibold text-white">{selectedGuest.ticketType}</p>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                        <p className="text-xs uppercase tracking-wide text-slate-400">Plus-Ones</p>
                                        <p className="mt-2 text-base font-semibold text-white">
                                            {selectedGuest.plusOnesCheckedIn}/{selectedGuest.plusOnesAllowed} checked in
                                        </p>
                                        <p className="text-xs text-slate-400">
                                            {selectedGuest.plusOnesRemaining} remaining
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <h3 className="text-sm font-semibold text-white">Contact details</h3>
                                        <Separator className="my-2 border-white/10" />
                                        <dl className="grid grid-cols-1 gap-3 text-sm text-slate-300/90 sm:grid-cols-2">
                                            <div>
                                                <dt className="text-xs uppercase tracking-wide text-slate-400">Email</dt>
                                                <dd className="mt-1 text-white/90">{selectedGuest.email || "—"}</dd>
                                            </div>
                                            <div>
                                                <dt className="text-xs uppercase tracking-wide text-slate-400">Phone</dt>
                                                <dd className="mt-1 text-white/90">{selectedGuest.phone || "—"}</dd>
                                            </div>
                                        </dl>
                                    </div>

                                    <div>
                                        <h3 className="text-sm font-semibold text-white">Check-in activity</h3>
                                        <Separator className="my-2 border-white/10" />
                                        <dl className="grid grid-cols-1 gap-3 text-sm text-slate-300/90 sm:grid-cols-2">
                                            <div>
                                                <dt className="text-xs uppercase tracking-wide text-slate-400">Last Check-in</dt>
                                                <dd className="mt-1 text-white/90">{selectedGuest.checkInTimeDisplay}</dd>
                                            </div>
                                            <div>
                                                <dt className="text-xs uppercase tracking-wide text-slate-400">Checked in by</dt>
                                                <dd className="mt-1 text-white/90">{selectedGuest.checkedInBy || "—"}</dd>
                                            </div>
                                            <div>
                                                <dt className="text-xs uppercase tracking-wide text-slate-400">Confirmation Code</dt>
                                                <dd className="mt-1 text-white/90">{selectedGuest.confirmationCode || "—"}</dd>
                                            </div>
                                            <div>
                                                <dt className="text-xs uppercase tracking-wide text-slate-400">Notes</dt>
                                                <dd className="mt-1 text-white/90">{selectedGuest.notes || "No notes"}</dd>
                                            </div>
                                        </dl>
                                    </div>

                                    <div>
                                        <h3 className="text-sm font-semibold text-white">Audit Trail</h3>
                                        <Separator className="my-2 border-white/10" />
                                        <dl className="grid grid-cols-1 gap-3 text-sm text-slate-300/90 sm:grid-cols-2">
                                            <div>
                                                <dt className="text-xs uppercase tracking-wide text-slate-400">Created</dt>
                                                <dd className="mt-1 text-white/90">{selectedGuest.createdAtDisplay}</dd>
                                            </div>
                                            <div>
                                                <dt className="text-xs uppercase tracking-wide text-slate-400">Last Updated</dt>
                                                <dd className="mt-1 text-white/90">{selectedGuest.lastModifiedDisplay}</dd>
                                            </div>
                                        </dl>
                                    </div>
                                </div>
                            </div>

                            <DialogFooter className="mt-6">
                                <Button onClick={closeGuestDetails} className="ml-auto rounded-full bg-emerald-500 text-emerald-950 hover:bg-emerald-400">
                                    Close details
                                </Button>
                            </DialogFooter>
                        </>
                    ) : (
                        <div className="flex flex-col items-center gap-4 py-10 text-sm text-slate-300">
                            <Info className="h-6 w-6" />
                            <p>Select a guest to view details.</p>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </section>
    );
}

export default function ProtectedGuestListPage() {
    const { user } = useAuth();
    // Conditionally render the layout based on user role
    const Layout = user?.role === 'admin' ? AdminLayout : MainLayout;

    return (
        <RouteGuard> {/* No requiredRole, so both roles can access */}
            <Layout>
                <GuestListPage />
            </Layout>
        </RouteGuard>
    );
}