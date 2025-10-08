import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, MoreHorizontal, PlusCircle } from "lucide-react";
import * as z from "zod";

import RouteGuard from "@/components/RouteGuard";
import AdminLayout from "@/components/layout/AdminLayout";
import { apiGetUshers, apiCreateUsher, apiUpdateUsher, apiDeactivateUsher } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const userFormSchema = z.object({
    username: z.string().min(3, "Username must be at least 3 characters."),
    fullName: z.string().min(1, "Full name is required."),
    password: z.string().optional(),
    role: z.enum(["usher", "admin"]),
});

const normalizeUsher = (usher) => {
    if (!usher) return null;

    const rawRole = (usher.role ?? "").toString();
    const normalizedRole = rawRole.toLowerCase();

    return {
        id: usher.id ?? usher.usher_id ?? usher.usherId ?? null,
        username: usher.username ?? "",
        fullName: usher.fullName ?? usher.full_name ?? "",
        role: normalizedRole || "usher",
        roleLabel: normalizedRole ? normalizedRole.charAt(0).toUpperCase() + normalizedRole.slice(1) : "Usher",
        isActive: typeof usher.isActive === "boolean" ? usher.isActive : Boolean(usher.active),
        createdAt: usher.createdAt ?? usher.created_at ?? null,
        lastLogin: usher.lastLogin ?? usher.last_login ?? null,
    };
};

const extractUsers = (payload) => {
    if (!payload) return [];

    if (Array.isArray(payload)) {
        return payload.map(normalizeUsher).filter(Boolean);
    }

    if (Array.isArray(payload.ushers)) {
        return payload.ushers.map(normalizeUsher).filter(Boolean);
    }

    return [];
};

const formatRoleForApi = (role) => (role === "admin" ? "Admin" : "Usher");

const formatDateTime = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

function UserManagementPage() {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);

    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [deletingUser, setDeletingUser] = useState(null);
    const [filters, setFilters] = useState({ role: "all", status: "all" });
    const [selectedUser, setSelectedUser] = useState(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    const filteredUsers = useMemo(() => {
        return users.filter((user) => {
            const matchesRole = filters.role === "all" || user.role === filters.role;
            const matchesStatus = filters.status === "all"
                ? true
                : filters.status === "active"
                    ? user.isActive
                    : !user.isActive;
            return matchesRole && matchesStatus;
        });
    }, [users, filters]);

    const totalActive = useMemo(() => users.filter((user) => user.isActive).length, [users]);

    const form = useForm({
        resolver: zodResolver(userFormSchema),
        defaultValues: { username: "", fullName: "", password: "", role: "usher" },
    });

    const fetchUsers = () => {
        setLoading(true);
        apiGetUshers()
            .then((response) => {
                setUsers(extractUsers(response));
            })
            .catch((err) => toast.error("Failed to load users", { description: err.message }))
            .finally(() => setLoading(false));
    };

    useEffect(fetchUsers, []);

    const handleFilterChange = (key, value) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
    };

    const openDetails = (user) => {
        setSelectedUser(user);
        setIsDetailsOpen(true);
    };

    const closeDetails = () => {
        setIsDetailsOpen(false);
        setSelectedUser(null);
    };

    const openCreateForm = () => {
        form.reset({ username: "", fullName: "", password: "", role: "usher" });
        setEditingUser(null);
        setIsFormOpen(true);
    };

    const openEditForm = (user) => {
        form.reset({
            username: user.username ?? "",
            fullName: user.fullName ?? "",
            password: "",
            role: user.role ?? "usher",
        });
        setEditingUser(user);
        setIsFormOpen(true);
    };

    const openDeleteConfirm = (user) => {
        setDeletingUser(user);
        setIsAlertOpen(true);
    };

    const onSubmit = async (values) => {
        const trimmedValues = {
            username: values.username?.trim() ?? "",
            fullName: values.fullName?.trim() ?? "",
            role: values.role,
            password: values.password?.trim() ?? "",
        };

        if (!editingUser && !trimmedValues.password) {
            toast.error("Password is required when creating a user.");
            return;
        }

        const apiPayload = editingUser
            ? {
                fullName: trimmedValues.fullName,
                role: formatRoleForApi(trimmedValues.role),
                ...(trimmedValues.password ? { password: trimmedValues.password } : {}),
            }
            : {
                username: trimmedValues.username,
                fullName: trimmedValues.fullName,
                password: trimmedValues.password,
                role: formatRoleForApi(trimmedValues.role),
            };

        const apiCall = editingUser
            ? apiUpdateUsher(editingUser.id, apiPayload)
            : apiCreateUsher(apiPayload);

        const promise = apiCall.then(() => {
            setIsFormOpen(false);
            fetchUsers();
        });

        toast.promise(promise, {
            loading: `${editingUser ? 'Updating' : 'Creating'} user...`,
            success: `User ${editingUser ? 'updated' : 'created'} successfully!`,
            error: (err) => `Failed to ${editingUser ? 'update' : 'create'} user: ${err.message}`
        });
    };

    const handleDelete = async () => {
        if (!deletingUser) return;
        const promise = apiDeactivateUsher(deletingUser.id).then(() => {
            setIsAlertOpen(false);
            setDeletingUser(null);
            fetchUsers();
        });

        toast.promise(promise, {
            loading: 'Deactivating user...',
            success: 'User deactivated successfully!',
            error: (err) => `Failed to deactivate user: ${err.message}`
        });
    };

    return (
        <div className="space-y-8">
            <header className="flex flex-col justify-between gap-4 rounded-3xl border border-white/10 bg-slate-900/60 p-6 md:flex-row md:items-center">
                <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Team Access</p>
                    <h1 className="mt-2 text-3xl font-semibold text-white">User Management</h1>
                    <p className="mt-2 text-sm text-slate-300/90">
                        Control usher and admin access, keep credentials up to date, and stay compliant with venue policies.
                    </p>
                </div>
                <Button onClick={openCreateForm} className="w-full gap-2 rounded-full bg-emerald-500/90 text-emerald-950 hover:bg-emerald-500 md:w-auto">
                    <PlusCircle className="h-4 w-4" />
                    Add team member
                </Button>
            </header>

            <div className="rounded-3xl border border-white/10 bg-slate-950/60 shadow-xl">
                <div className="flex flex-col gap-3 border-b border-white/10 px-6 py-4 text-sm text-slate-300/80 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        {loading
                            ? "Syncing roster…"
                            : `Showing ${filteredUsers.length} of ${users.length} team members (${totalActive} active)`}
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Select
                            value={filters.role}
                            onValueChange={(value) => handleFilterChange("role", value)}
                        >
                            <SelectTrigger className="w-full rounded-full border-white/20 bg-white/5 text-slate-100 sm:w-[180px]">
                                <SelectValue placeholder="Filter by role" />
                            </SelectTrigger>
                            <SelectContent className="border-slate-800 bg-slate-900 text-slate-100">
                                <SelectItem value="all">All roles</SelectItem>
                                <SelectItem value="admin">Admins</SelectItem>
                                <SelectItem value="usher">Ushers</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select
                            value={filters.status}
                            onValueChange={(value) => handleFilterChange("status", value)}
                        >
                            <SelectTrigger className="w-full rounded-full border-white/20 bg-white/5 text-slate-100 sm:w-[180px]">
                                <SelectValue placeholder="Filter by status" />
                            </SelectTrigger>
                            <SelectContent className="border-slate-800 bg-slate-900 text-slate-100">
                                <SelectItem value="all">All statuses</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="hidden md:block">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-b border-white/10">
                                <TableHead className="text-slate-300/80">Username</TableHead>
                                <TableHead className="text-slate-300/80">Full Name</TableHead>
                                <TableHead className="text-slate-300/80">Role</TableHead>
                                <TableHead className="text-slate-300/80">Status</TableHead>
                                <TableHead className="text-right text-slate-300/80"><span className="sr-only">Actions</span></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array(4).fill(0).map((_, i) => (
                                    <TableRow key={i} className="border-b border-white/5">
                                        <TableCell colSpan={5}>
                                            <Skeleton className="h-9 w-full rounded-xl bg-slate-900/70" />
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : filteredUsers.length > 0 ? (
                                filteredUsers.map((user) => (
                                    <TableRow
                                        key={user.id ?? user.username}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => openDetails(user)}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter" || event.key === " ") {
                                                event.preventDefault();
                                                openDetails(user);
                                            }
                                        }}
                                        className="cursor-pointer border-b border-white/5 transition-colors hover:bg-slate-900/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
                                    >
                                        <TableCell className="font-medium text-white">{user.username}</TableCell>
                                        <TableCell className="text-slate-200/90">{user.fullName}</TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
                                                    user.role !== "admin" && "border-sky-500/40 bg-sky-500/10 text-sky-200"
                                                )}
                                            >
                                                {user.roleLabel}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    "border-white/20 bg-white/5 text-slate-200",
                                                    user.isActive
                                                        ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                                                        : "border-rose-500/40 bg-rose-500/10 text-rose-200"
                                                )}
                                            >
                                                {user.isActive ? "Active" : "Inactive"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        className="h-8 w-8 rounded-full p-0 text-slate-300 hover:bg-slate-900/80"
                                                        onClick={(event) => event.stopPropagation()}
                                                    >
                                                        <span className="sr-only">Open menu</span>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="min-w-[160px] border-slate-800 bg-slate-900 text-slate-100">
                                                    <DropdownMenuItem
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            openEditForm(user);
                                                        }}
                                                        className="focus:bg-slate-800"
                                                    >
                                                        Edit details
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            openDeleteConfirm(user);
                                                        }}
                                                        disabled={currentUser?.usherId && user.id === currentUser.usherId}
                                                        className="text-rose-400 focus:bg-slate-800 focus:text-rose-300 disabled:opacity-40"
                                                    >
                                                        Deactivate
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="py-12 text-center text-sm text-slate-400">
                                        Every usher and admin will appear here once added.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
                <div className="space-y-3 p-4 md:hidden">
                    {loading ? (
                        Array(4).fill(0).map((_, i) => (
                            <Skeleton key={i} className="h-28 w-full rounded-2xl bg-slate-900/70" />
                        ))
                    ) : filteredUsers.length > 0 ? (
                        filteredUsers.map((user) => (
                            <button
                                key={user.id ?? user.username}
                                onClick={() => openDetails(user)}
                                className="w-full rounded-2xl border border-white/15 bg-slate-900/60 p-4 text-left text-slate-100 shadow-sm transition hover:border-emerald-400/40 hover:bg-slate-900/40"
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h3 className="text-base font-semibold">{user.fullName}</h3>
                                        <p className="mt-1 text-xs text-slate-400">@{user.username}</p>
                                        <p className="text-xs text-slate-400">Role • {user.roleLabel}</p>
                                    </div>
                                    <Badge
                                        variant="outline"
                                        className={cn(
                                            "border-white/20 bg-white/5 text-slate-200",
                                            user.isActive
                                                ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                                                : "border-rose-500/40 bg-rose-500/10 text-rose-200"
                                        )}
                                    >
                                        {user.isActive ? "Active" : "Inactive"}
                                    </Badge>
                                </div>
                                <div className="mt-4 flex items-center justify-between text-xs text-slate-300/80">
                                    <span>Created {formatDateTime(user.createdAt)}</span>
                                    <span>Last login {formatDateTime(user.lastLogin)}</span>
                                </div>
                            </button>
                        ))
                    ) : (
                        <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/40 p-6 text-center text-sm text-slate-400">
                            Every usher and admin will appear here once added.
                        </div>
                    )}
                </div>
            </div>

            <Dialog open={isDetailsOpen} onOpenChange={(open) => (open ? setIsDetailsOpen(true) : closeDetails())}>
                <DialogContent className="max-w-xl border border-white/10 bg-slate-950/90 text-slate-100">
                    {selectedUser ? (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center justify-between gap-3 text-2xl font-semibold text-white">
                                    <span>{selectedUser.fullName}</span>
                                    <Badge
                                        variant="outline"
                                        className={cn(
                                            "border-white/20 bg-white/5 text-slate-200",
                                            selectedUser.isActive
                                                ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                                                : "border-rose-500/40 bg-rose-500/10 text-rose-200"
                                        )}
                                    >
                                        {selectedUser.isActive ? "Active" : "Inactive"}
                                    </Badge>
                                </DialogTitle>
                                <DialogDescription className="text-sm text-slate-300/80">
                                    @{selectedUser.username} • {selectedUser.roleLabel}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-6">
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                        <p className="text-xs uppercase tracking-wide text-slate-400">Role</p>
                                        <p className="mt-2 text-base font-semibold text-white">{selectedUser.roleLabel}</p>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                        <p className="text-xs uppercase tracking-wide text-slate-400">Account status</p>
                                        <p className="mt-2 text-base font-semibold text-white">{selectedUser.isActive ? "Active" : "Inactive"}</p>
                                        <p className="text-xs text-slate-400">System access {selectedUser.isActive ? "enabled" : "disabled"}</p>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-sm font-semibold text-white">Account activity</h3>
                                    <Separator className="my-3 border-white/10" />
                                    <dl className="grid grid-cols-1 gap-4 text-sm text-slate-300/90 sm:grid-cols-2">
                                        <div>
                                            <dt className="text-xs uppercase tracking-wide text-slate-400">User ID</dt>
                                            <dd className="mt-1 text-white/90">{selectedUser.id ?? "—"}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs uppercase tracking-wide text-slate-400">Joined</dt>
                                            <dd className="mt-1 text-white/90">{formatDateTime(selectedUser.createdAt)}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs uppercase tracking-wide text-slate-400">Username</dt>
                                            <dd className="mt-1 text-white/90">@{selectedUser.username}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs uppercase tracking-wide text-slate-400">Last login</dt>
                                            <dd className="mt-1 text-white/90">{formatDateTime(selectedUser.lastLogin)}</dd>
                                        </div>
                                    </dl>
                                </div>
                            </div>

                            <DialogFooter className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
                                <Button
                                    variant="outline"
                                    className="rounded-full border-white/20 bg-white/5 text-slate-100 hover:bg-white/10"
                                    onClick={() => {
                                        const user = selectedUser;
                                        closeDetails();
                                        if (user) {
                                            openEditForm(user);
                                        }
                                    }}
                                >
                                    Edit details
                                </Button>
                                <Button
                                    className="rounded-full bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                                    onClick={closeDetails}
                                >
                                    Close
                                </Button>
                            </DialogFooter>
                        </>
                    ) : (
                        <div className="space-y-4">
                            <Skeleton className="h-6 w-1/2 rounded-lg bg-slate-900/60" />
                            <Skeleton className="h-40 w-full rounded-2xl bg-slate-900/60" />
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Form Dialog for Create/Edit */}
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="sm:max-w-[420px] border-slate-700 bg-slate-900 text-slate-100">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold text-white">
                            {editingUser ? "Edit usher account" : "Create new team member"}
                        </DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                            <FormField
                                name="username"
                                control={form.control}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-sm text-slate-300">Username</FormLabel>
                                        <FormControl>
                                            <Input {...field} className="border-slate-700 bg-slate-900/70 text-white" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                name="fullName"
                                control={form.control}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-sm text-slate-300">Full name</FormLabel>
                                        <FormControl>
                                            <Input {...field} className="border-slate-700 bg-slate-900/70 text-white" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                name="password"
                                control={form.control}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-sm text-slate-300">
                                            Password {editingUser && <span className="text-slate-500">(leave blank to keep current)</span>}
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                type="password"
                                                autoComplete={editingUser ? "new-password" : "off"}
                                                {...field}
                                                className="border-slate-700 bg-slate-900/70 text-white"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                name="role"
                                control={form.control}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-sm text-slate-300">Role</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="border-slate-700 bg-slate-900/70 text-white">
                                                    <SelectValue placeholder="Select a role" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="border-slate-800 bg-slate-900 text-slate-100">
                                                <SelectItem value="usher">Usher</SelectItem>
                                                <SelectItem value="admin">Admin</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button
                                type="submit"
                                disabled={form.formState.isSubmitting}
                                className="w-full rounded-full bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                            >
                                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {editingUser ? "Save changes" : "Create account"}
                            </Button>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* Alert Dialog for Deactivation */}
            <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                <AlertDialogContent className="border border-rose-500/30 bg-slate-950/90 text-slate-100">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-lg font-semibold text-white">Deactivate user?</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm text-slate-300/80">
                            This will disable access for <span className="font-semibold text-white">{deletingUser?.username}</span>. You can reactivate the account at any time from this dashboard.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="border border-rose-500/30 bg-rose-500/90 text-rose-50 hover:bg-rose-500">
                            Deactivate user
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

export default function ProtectedUserManagementPage() {
    return (
        <RouteGuard requiredRole="admin">
            <AdminLayout>
                <UserManagementPage />
            </AdminLayout>
        </RouteGuard>
    );
}