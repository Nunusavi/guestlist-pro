import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  Search,
  Users,
  CheckCircle,
  XCircle,
  Wifi,
  WifiOff,
  LogOut,
  Home,
  BarChart3,
  History,
  UserPlus,
  Download,
  AlertCircle,
  Trash2,
  Edit,
  X as XIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useAuth } from "../contexts/AuthContext";
import { useGuests } from "../hooks/useGuests";
import {
  useAdminStats,
  useAuditLog,
  useUserManagement,
  useExport,
} from "../hooks/useAdmin";
import { useToast } from "../components/Toast";

export default function AdminPage() {
  const _motionRef = motion; // ensure import is recognized as used
  const { user, logout } = useAuth();
  const { addToast } = useToast();
  const { guests, loading: guestsLoading, fetchGuests } = useGuests();
  const { stats, loading: statsLoading } = useAdminStats(true, 10000); // Auto-refresh every 10s
  const { auditLog, loading: auditLoading, fetchAuditLog } = useAuditLog();
  const {
    ushers,
    loading: ushersLoading,
    createUsher,
    updateUsher,
    deleteUsher,
  } = useUserManagement();
  const { exportGuests: exportGuestsApi, loading: exportLoading } = useExport();

  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGuests, setSelectedGuests] = useState([]);
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [showExportModal, setShowExportModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [online] = useState(navigator.onLine);

  // Load initial data
  useEffect(() => {
    fetchGuests();
    fetchAuditLog({ page: 1, limit: 50 });
  }, [fetchGuests, fetchAuditLog]);

  // Filter + search + sort guests
  const filteredGuests = useMemo(() => {
    let filtered = guests || [];

    // Status filter
    if (filterStatus !== "all") {
      filtered = filtered.filter((g) =>
        filterStatus === "checked-in"
          ? g.status === "Checked-In"
          : g.status === "Not Checked-In"
      );
    }

    // Basic text search across name + email
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      filtered = filtered.filter(
        (g) =>
          `${g.firstName} ${g.lastName}`.toLowerCase().includes(q) ||
          (g.email || "").toLowerCase().includes(q)
      );
    }

    // Sorting
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === "name")
        return `${a.firstName} ${a.lastName}`.localeCompare(
          `${b.firstName} ${b.lastName}`
        );
      if (sortBy === "checkInTime")
        return new Date(b.checkInTime || 0) - new Date(a.checkInTime || 0);
      return 0;
    });

    return sorted;
  }, [guests, filterStatus, sortBy, searchTerm]);

  const handleLogout = useCallback(async () => {
    await logout();
    addToast("Logged out successfully", "info");
  }, [logout, addToast]);

  const handleExport = useCallback(async () => {
    const result = await exportGuestsApi({
      status: filterStatus !== "all" ? filterStatus : undefined,
    });

    if (result.success) {
      addToast("Export successful", "success");
      setShowExportModal(false);
    } else {
      addToast(result.error || "Export failed", "error");
    }
  }, [exportGuestsApi, filterStatus, addToast]);

  const handleCreateUser = useCallback(() => {
    setEditingUser(null);
    setShowUserModal(true);
  }, []);

  const handleEditUser = useCallback((usher) => {
    setEditingUser(usher);
    setShowUserModal(true);
  }, []);

  const handleDeleteUser = useCallback(
    async (usherId) => {
      if (!confirm("Are you sure you want to delete this user?")) return;

      const result = await deleteUsher(usherId);

      if (result.success) {
        addToast("User deleted successfully", "success");
      } else {
        addToast(result.error || "Failed to delete user", "error");
      }
    },
    [deleteUsher, addToast]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-white font-semibold">
                  {user?.fullName || "Admin"}
                </h2>
                <p className="text-xs text-slate-400">
                  {user?.role || "Admin"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {online ? (
                  <>
                    <Wifi className="w-5 h-5 text-green-400" />
                    <span className="text-sm text-green-400 hidden sm:inline">
                      Online
                    </span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-5 h-5 text-orange-400" />
                    <span className="text-sm text-orange-400 hidden sm:inline">
                      Offline
                    </span>
                  </>
                )}
              </div>

              <button
                onClick={handleLogout}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5 text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {["dashboard", "guests", "audit", "users"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                activeTab === tab
                  ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700"
              }`}
            >
              {tab === "dashboard" && <Home className="w-4 h-4 inline mr-2" />}
              {tab === "guests" && <Users className="w-4 h-4 inline mr-2" />}
              {tab === "audit" && <History className="w-4 h-4 inline mr-2" />}
              {tab === "users" && <UserPlus className="w-4 h-4 inline mr-2" />}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === "dashboard" && (
            <DashboardTab
              key="dashboard"
              stats={stats}
              guests={guests}
              loading={statsLoading || guestsLoading}
            />
          )}
          {activeTab === "guests" && (
            <GuestsTab
              key="guests"
              guests={filteredGuests}
              selectedGuests={selectedGuests}
              onSelectGuest={(id) =>
                setSelectedGuests((prev) =>
                  prev.includes(id)
                    ? prev.filter((gid) => gid !== id)
                    : [...prev, id]
                )
              }
              onSelectAll={() =>
                setSelectedGuests(
                  selectedGuests.length === filteredGuests.length
                    ? []
                    : filteredGuests.map((g) => g.id)
                )
              }
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              filterStatus={filterStatus}
              onFilterChange={setFilterStatus}
              sortBy={sortBy}
              onSortChange={setSortBy}
              onExport={() => setShowExportModal(true)}
              onClearSelection={() => setSelectedGuests([])}
              loading={guestsLoading}
            />
          )}
          {activeTab === "audit" && (
            <AuditTab key="audit" auditLog={auditLog} loading={auditLoading} />
          )}
          {activeTab === "users" && (
            <UsersTab
              key="users"
              ushers={ushers}
              currentUser={user}
              onCreateUser={handleCreateUser}
              onEditUser={handleEditUser}
              onDeleteUser={handleDeleteUser}
              loading={ushersLoading}
            />
          )}
        </AnimatePresence>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {showExportModal && (
          <ExportModal
            onClose={() => setShowExportModal(false)}
            onExport={handleExport}
            loading={exportLoading}
          />
        )}
        {showUserModal && (
          <UserModal
            user={editingUser}
            onClose={() => setShowUserModal(false)}
            onCreate={createUsher}
            onUpdate={updateUsher}
            addToast={addToast}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function DashboardTab({ stats, guests = [], loading }) {
  // Build recent check-ins list
  const recentCheckIns = (guests || [])
    .filter((g) => g.status === "Checked-In" && g.checkInTime)
    .sort((a, b) => new Date(b.checkInTime) - new Date(a.checkInTime))
    .slice(0, 10);

  const notCheckedIn = (guests || []).filter(
    (g) => g.status === "Not Checked-In"
  );

  // Derive percentage from stats, falling back to calculation if not provided
  const totalGuests = stats?.totalGuests || stats?.total || 0;
  const checkedInCount = stats?.checkedInCount || stats?.checkedIn || 0;
  const percentage =
    totalGuests > 0 ? ((checkedInCount / totalGuests) * 100).toFixed(1) : 0;

  // Compute time-series chart (hour buckets)
  const chartData = useMemo(() => {
    const map = new Map();
    (guests || []).forEach((g) => {
      if (g.status === "Checked-In" && g.checkInTime) {
        const date = new Date(g.checkInTime);
        // Hour label e.g. 14:00
        const hour = `${date.getHours().toString().padStart(2, "0")}:00`;
        map.set(hour, (map.get(hour) || 0) + 1);
      }
    });
    // Sort hours chronologically
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([hour, count]) => ({ hour, checkIns: count }));
  }, [guests]);

  // Compute ticket type distribution
  const ticketTypeData = useMemo(() => {
    const aggregate = {};
    (guests || []).forEach((g) => {
      const type = g.ticketType || "General";
      if (!aggregate[type])
        aggregate[type] = { name: type, value: 0, checkedIn: 0 };
      aggregate[type].value += 1;
      if (g.status === "Checked-In") aggregate[type].checkedIn += 1;
    });
    return Object.values(aggregate);
  }, [guests]);

  const COLORS = [
    "#8b5cf6",
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#6366f1",
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Guests"
          value={stats?.totalGuests || 0}
          icon={<Users className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          label="Checked In"
          value={stats?.checkedInCount || 0}
          subtitle={`${percentage}%`}
          icon={<CheckCircle className="w-5 h-5" />}
          color="green"
        />
        <StatCard
          label="Not Arrived"
          value={(stats?.totalGuests || 0) - (stats?.checkedInCount || 0)}
          icon={<XCircle className="w-5 h-5" />}
          color="orange"
        />
        <StatCard
          label="Plus-Ones"
          value={`${stats?.plusOnesCheckedIn || 0}/${
            stats?.plusOnesAllowed || 0
          }`}
          icon={<UserPlus className="w-5 h-5" />}
          color="purple"
        />
      </div>

      {/* Progress Bar */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h3 className="text-white font-semibold mb-4">Check-In Progress</h3>
        <div className="relative w-full h-8 bg-slate-700 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-green-500"
          />
          <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-sm">
            {checkedInCount} / {totalGuests} ({percentage}%)
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {chartData.length > 0 && (
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h3 className="text-white font-semibold mb-4">
              Check-Ins Over Time
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="hour" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="checkIns"
                  stroke="#3b82f6"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 className="text-white font-semibold mb-4">Ticket Types</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={ticketTypeData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                dataKey="value"
              >
                {ticketTypeData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2">
            {ticketTypeData.map((item, i) => (
              <div
                key={item.name}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <span className="text-slate-300">{item.name}</span>
                </div>
                <span className="text-slate-400">
                  {item.checkedIn}/{item.value} checked in
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activity Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 className="text-white font-semibold mb-4">Recent Check-Ins</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {recentCheckIns.length === 0 ? (
              <p className="text-slate-400 text-center py-8">
                No check-ins yet
              </p>
            ) : (
              recentCheckIns.map((guest) => (
                <div
                  key={guest.id}
                  className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                    <div>
                      <p className="text-white font-medium text-sm">
                        {guest.firstName} {guest.lastName}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(guest.checkInTime).toLocaleTimeString()}
                        {guest.plusOnesCheckedIn > 0 &&
                          ` • +${guest.plusOnesCheckedIn}`}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      guest.ticketType === "VIP"
                        ? "bg-purple-500/20 text-purple-400"
                        : "bg-blue-500/20 text-blue-400"
                    }`}
                  >
                    {guest.ticketType}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 className="text-white font-semibold mb-4">
            Awaiting Arrival ({notCheckedIn.length})
          </h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {notCheckedIn.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-2" />
                <p className="text-green-400 font-medium">
                  All guests checked in!
                </p>
              </div>
            ) : (
              notCheckedIn.slice(0, 15).map((guest) => (
                <div
                  key={guest.id}
                  className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <XCircle className="w-5 h-5 text-slate-500 flex-shrink-0" />
                    <div>
                      <p className="text-white font-medium text-sm">
                        {guest.firstName} {guest.lastName}
                      </p>
                      <p className="text-xs text-slate-400">{guest.email}</p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      guest.ticketType === "VIP"
                        ? "bg-purple-500/20 text-purple-400"
                        : "bg-slate-600 text-slate-300"
                    }`}
                  >
                    {guest.ticketType}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function StatCard({ label, value, subtitle, icon, color }) {
  const colors = {
    blue: "from-blue-500 to-cyan-500",
    green: "from-green-500 to-emerald-500",
    orange: "from-orange-500 to-amber-500",
    purple: "from-purple-500 to-pink-500",
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-slate-800 rounded-xl p-6 border border-slate-700 hover:border-slate-600 transition-all"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-slate-400 font-medium">{label}</span>
        <div className={`p-2 rounded-lg bg-gradient-to-br ${colors[color]}`}>
          {icon}
        </div>
      </div>
      <div className="text-3xl font-bold text-white">{value}</div>
      {subtitle && (
        <div className="text-sm text-slate-400 mt-1">{subtitle}</div>
      )}
    </motion.div>
  );
}

function GuestsTab({
  guests,
  selectedGuests,
  onSelectGuest,
  onSelectAll,
  searchTerm,
  onSearchChange,
  filterStatus,
  onFilterChange,
  sortBy,
  onSortChange,
  onExport,
  onClearSelection,
  loading,
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading guests...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4"
    >
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-4">
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search guests..."
              className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => onFilterChange(e.target.value)}
            className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All ({guests.length})</option>
            <option value="checked-in">Checked In</option>
            <option value="not-checked-in">Not Checked In</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="name">Sort by Name</option>
            <option value="checkInTime">Sort by Check-In Time</option>
          </select>

          <button
            onClick={onExport}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>

        <AnimatePresence>
          {selectedGuests.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center justify-between p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg"
            >
              <span className="text-blue-400 font-medium">
                {selectedGuests.length} guest
                {selectedGuests.length > 1 ? "s" : ""} selected
              </span>
              <button
                onClick={onClearSelection}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
              >
                Clear
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700/50 border-b border-slate-700">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={
                      selectedGuests.length === guests.length &&
                      guests.length > 0
                    }
                    onChange={onSelectAll}
                    className="w-4 h-4 rounded bg-slate-700 border-slate-600"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                  Guest
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                  Contact
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                  Ticket
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                  Plus-Ones
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                  Check-In Time
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {guests.map((guest) => (
                <tr
                  key={guest.id}
                  className="hover:bg-slate-700/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedGuests.includes(guest.id)}
                      onChange={() => onSelectGuest(guest.id)}
                      className="w-4 h-4 rounded bg-slate-700 border-slate-600"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-white font-medium">
                      {guest.firstName} {guest.lastName}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-slate-400">{guest.email}</div>
                    {guest.phone && (
                      <div className="text-xs text-slate-500">
                        {guest.phone}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        guest.ticketType === "VIP"
                          ? "bg-purple-500/20 text-purple-400"
                          : "bg-blue-500/20 text-blue-400"
                      }`}
                    >
                      {guest.ticketType}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-slate-300">
                      {guest.plusOnesCheckedIn}/{guest.plusOnesAllowed}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {guest.status === "Checked-In" ? (
                      <span className="flex items-center gap-1 text-green-400 text-sm">
                        <CheckCircle className="w-4 h-4" />
                        Checked In
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-slate-400 text-sm">
                        <XCircle className="w-4 h-4" />
                        Not Checked In
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-slate-400">
                      {guest.checkInTime
                        ? new Date(guest.checkInTime).toLocaleString()
                        : "-"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {guests.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No guests found</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function AuditTab({ auditLog, loading }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading audit log...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4"
    >
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h3 className="text-white font-semibold mb-4">Audit Log</h3>
        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {auditLog.length === 0 ? (
            <div className="text-center py-12">
              <History className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No activity yet</p>
            </div>
          ) : (
            auditLog.map((log) => (
              <div key={log.id} className="p-4 bg-slate-700/50 rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {log.action === "Check-In" ? (
                      <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-orange-400 flex-shrink-0" />
                    )}
                    <div>
                      <p className="text-white font-medium">{log.guestName}</p>
                      <p className="text-sm text-slate-400">{log.action}</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-500">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>

                <div className="ml-8 space-y-1 text-sm">
                  <p className="text-slate-400">
                    <span className="text-slate-500">By:</span> {log.usherName}
                  </p>
                  {log.plusOnesCount > 0 && (
                    <p className="text-slate-400">
                      <span className="text-slate-500">Plus-Ones:</span>{" "}
                      {log.plusOnesCount}
                    </p>
                  )}
                  {log.notes && (
                    <p className="text-slate-400">
                      <span className="text-slate-500">Notes:</span> {log.notes}
                    </p>
                  )}
                  {log.confirmationCode && (
                    <p className="text-slate-400">
                      <span className="text-slate-500">Code:</span>{" "}
                      <code className="text-blue-400">
                        {log.confirmationCode}
                      </code>
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
}

function UsersTab({
  ushers,
  currentUser,
  onCreateUser,
  onEditUser,
  onDeleteUser,
  loading,
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4"
    >
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">User Management</h2>
        <button
          onClick={onCreateUser}
          className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-lg transition-all flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Create User
        </button>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700/50 border-b border-slate-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                  Username
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                  Full Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                  Role
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                  Created
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {ushers.map((usher) => (
                <tr
                  key={usher.id}
                  className="hover:bg-slate-700/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="text-white font-medium">
                      {usher.username}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-slate-300">{usher.fullName}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        usher.role === "Admin"
                          ? "bg-purple-500/20 text-purple-400"
                          : "bg-blue-500/20 text-blue-400"
                      }`}
                    >
                      {usher.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        usher.active
                          ? "bg-green-500/20 text-green-400"
                          : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {usher.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-slate-400">
                      {usher.createdAt}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onEditUser(usher)}
                        className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4 text-blue-400" />
                      </button>
                      <button
                        onClick={() => onDeleteUser(usher.id)}
                        disabled={usher.id === currentUser.id}
                        className="p-2 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title={
                          usher.id === currentUser.id
                            ? "Can't delete yourself"
                            : "Delete"
                        }
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

function ExportModal({ onClose, onExport, loading }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-800 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Export Data</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <XIcon className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="space-y-3">
          <button
            onClick={onExport}
            disabled={loading}
            className="w-full p-4 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-400"></div>
              ) : (
                <Download className="w-5 h-5 text-blue-400" />
              )}
              <div>
                <p className="text-white font-medium">
                  {loading ? "Exporting..." : "Export as CSV"}
                </p>
                <p className="text-sm text-slate-400">
                  Compatible with Excel, Google Sheets
                </p>
              </div>
            </div>
          </button>

          <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-slate-400">
                <p className="font-medium text-slate-300 mb-1">
                  Export includes:
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li>All guest information</li>
                  <li>Check-in status and times</li>
                  <li>Plus-ones data</li>
                  <li>Notes and confirmation codes</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function UserModal({ user, onClose, onCreate, onUpdate, addToast }) {
  const [formData, setFormData] = React.useState({
    username: user?.username || "",
    fullName: user?.fullName || "",
    password: "",
    role: user?.role || "Usher",
  });
  const [loading, setLoading] = React.useState(false);
  const [errors, setErrors] = React.useState({});

  const validate = () => {
    const newErrors = {};

    if (!formData.username || formData.username.length < 3) {
      newErrors.username = "Username must be at least 3 characters";
    }

    if (!formData.fullName) {
      newErrors.fullName = "Full name is required";
    }

    if (!user && !formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password && formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) return;

    setLoading(true);

    try {
      let result;

      if (user) {
        // Update existing user
        const updateData = {
          fullName: formData.fullName,
          role: formData.role,
        };
        if (formData.password) {
          updateData.password = formData.password;
        }
        result = await onUpdate(user.id, updateData);
      } else {
        // Create new user
        result = await onCreate(formData);
      }

      if (result.success) {
        addToast(
          `User ${user ? "updated" : "created"} successfully`,
          "success"
        );
        onClose();
      } else {
        addToast(result.error || "Operation failed", "error");
      }
    } catch (err) {
      addToast(err.message || "An error occurred", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-800 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">
            {user ? "Edit User" : "Create User"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <XIcon className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Username
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) =>
                setFormData({ ...formData, username: e.target.value })
              }
              disabled={!!user}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Enter username"
            />
            {errors.username && (
              <p className="text-red-400 text-sm mt-1">{errors.username}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) =>
                setFormData({ ...formData, fullName: e.target.value })
              }
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter full name"
            />
            {errors.fullName && (
              <p className="text-red-400 text-sm mt-1">{errors.fullName}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Password {user && "(leave blank to keep unchanged)"}
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={user ? "Enter new password" : "Enter password"}
            />
            {errors.password && (
              <p className="text-red-400 text-sm mt-1">{errors.password}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Role
            </label>
            <select
              value={formData.role}
              onChange={(e) =>
                setFormData({ ...formData, role: e.target.value })
              }
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Usher">Usher</option>
              <option value="Admin">Admin</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Processing...</span>
                </>
              ) : user ? (
                "Update"
              ) : (
                "Create"
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
