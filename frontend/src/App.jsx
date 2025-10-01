import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Search, Users, CheckCircle, XCircle, Clock, Wifi, WifiOff, User, LogOut, Home, BarChart3, UserPlus, AlertCircle, Filter, Download, Camera, RotateCcw, ChevronDown, X as XIcon, Check, Trash2, History, Settings as SettingsIcon, SlidersHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Fuse from 'fuse.js';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// ============================================
// MOCK DATA
// ============================================

const MOCK_GUESTS = Array.from({ length: 50 }, (_, i) => ({
  id: i + 1,
  firstName: ['John', 'Jane', 'Bob', 'Alice', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry'][i % 10],
  lastName: ['Doe', 'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez'][i % 10],
  email: `guest${i + 1}@email.com`,
  phone: `+1234567${String(i).padStart(3, '0')}`,
  ticketType: i % 3 === 0 ? 'VIP' : 'General',
  plusOnesAllowed: i % 4,
  confirmationCode: '',
  checkInTime: '',
  plusOnesCheckedIn: 0,
  status: 'Not Checked-In',
  notes: '',
  lastModified: '',
  checkedInBy: ''
}));

const MOCK_USHERS = [
  { id: 1, username: 'usher1', password: 'password123', fullName: 'Alice Cooper', role: 'Usher', active: true },
  { id: 2, username: 'admin1', password: 'admin123', fullName: 'Admin User', role: 'Admin', active: true }
];
// ============================================
// UTILITY FUNCTIONS
// ============================================

const generateConfirmationCode = (usherName, guestName, timestamp) => {
  return `${usherName}-${guestName}-${timestamp}`.toLowerCase().replace(/\s/g, '');
};
const exportToCSV = (guests, filename = 'guests.csv') => {
  const headers = ['ID', 'First Name', 'Last Name', 'Email', 'Phone', 'Ticket Type', 'Plus-Ones', 'Status', 'Check-In Time', 'Checked In By'];
  const rows = guests.map(g => [
    g.id,
    g.firstName,
    g.lastName,
    g.email,
    g.phone,
    g.ticketType,
    `${g.plusOnesCheckedIn}/${g.plusOnesAllowed}`,
    g.status,
    g.checkInTime ? new Date(g.checkInTime).toLocaleString() : '',
    g.checkedInBy || ''
  ]);
  
  const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

// ============================================
// CUSTOM HOOKS
// ============================================

function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  
  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  return online;
}

function useGuestSearch(guests, searchTerm, filters) {
  return useMemo(() => {
    let filtered = guests;
    
    // Apply filters
    if (filters.ticketType && filters.ticketType !== 'all') {
      filtered = filtered.filter(g => g.ticketType === filters.ticketType);
    }
    if (filters.status && filters.status !== 'all') {
      if (filters.status === 'checked-in') {
        filtered = filtered.filter(g => g.status === 'Checked-In');
      } else if (filters.status === 'not-checked-in') {
        filtered = filtered.filter(g => g.status === 'Not Checked-In');
      }
    }
    if (filters.hasPlusOnes) {
      filtered = filtered.filter(g => g.plusOnesAllowed > 0);
    }
    
    // Apply search
    if (!searchTerm.trim()) return filtered;
    
    const fuse = new Fuse(filtered, {
      keys: ['firstName', 'lastName', 'email', 'phone', 'confirmationCode'],
      threshold: 0.3,
      includeScore: true
    });
    
    return fuse.search(searchTerm).map(result => result.item);
  }, [guests, searchTerm, filters]);
}

function useToast() {
  const [toasts, setToasts] = useState([]);
  
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);
  
  return { toasts, addToast };
}

// ============================================
// MAIN APP COMPONENT
// ============================================

export default function GuestListApp() {
  const [view, setView] = useState('login');
  const [user, setUser] = useState(null);
  const [guests, setGuests] = useState(MOCK_GUESTS);
  const [syncQueue, setSyncQueue] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const online = useOnlineStatus();
  const { toasts, addToast } = useToast();
  
  const handleLogin = useCallback((username, password) => {
    const foundUser = MOCK_USHERS.find(u => u.username === username && u.password === password);
    if (foundUser) {
      setUser(foundUser);
      setView(foundUser.role === 'Admin' ? 'admin' : 'usher');
      addToast(`Welcome, ${foundUser.fullName}!`, 'success');
      return true;
    }
    return false;
  }, [addToast]);
  
  const handleLogout = useCallback(() => {
    setUser(null);
    setView('login');
    addToast('Logged out successfully', 'info');
  }, [addToast]);
  
  const handleCheckIn = useCallback((guest, plusOnes, notes, isUndo = false) => {
    const timestamp = new Date().toISOString();
    const confirmationCode = isUndo ? '' : generateConfirmationCode(user.username, guest.firstName + guest.lastName, Date.now());
    
    const updatedGuest = {
      ...guest,
      status: isUndo ? 'Not Checked-In' : 'Checked-In',
      checkInTime: isUndo ? '' : timestamp,
      plusOnesCheckedIn: isUndo ? 0 : plusOnes,
      notes: isUndo ? '' : (notes || guest.notes),
      confirmationCode: isUndo ? '' : confirmationCode,
      checkedInBy: isUndo ? '' : user.fullName,
      lastModified: timestamp
    };
    
    setGuests(prev => prev.map(g => g.id === guest.id ? updatedGuest : g));
    
    // Add to audit log
    setAuditLog(prev => [{
      id: Date.now(),
      timestamp,
      guestId: guest.id,
      guestName: `${guest.firstName} ${guest.lastName}`,
      action: isUndo ? 'Undo Check-In' : 'Check-In',
      usherName: user.fullName,
      plusOnesCount: plusOnes,
      notes: notes || '',
      confirmationCode
    }, ...prev]);
    
    // Add to sync queue if offline
    if (!online) {
      setSyncQueue(prev => [...prev, { action: 'checkIn', guest: updatedGuest, timestamp }]);
    }
    
    addToast(
      isUndo ? `${guest.firstName} ${guest.lastName} check-in undone` : `${guest.firstName} ${guest.lastName} checked in successfully`,
      'success'
    );
    
    return updatedGuest;
  }, [user, online, addToast]);
  
  const handleBulkCheckIn = useCallback((selectedGuests) => {
    selectedGuests.forEach(guest => {
      if (guest.status !== 'Checked-In') {
        handleCheckIn(guest, 0, '');
      }
    });
    addToast(`${selectedGuests.length} guests checked in`, 'success');
  }, [handleCheckIn, addToast]);
  
  // Simulate sync when coming back online
  useEffect(() => {
    if (online && syncQueue.length > 0) {
      addToast(`Syncing ${syncQueue.length} changes...`, 'info');
      setTimeout(() => {
        setSyncQueue([]);
        addToast('All changes synced successfully', 'success');
      }, 1500);
    }
  }, [online, syncQueue.length, addToast]);
  
  if (view === 'login') {
    return <LoginView onLogin={handleLogin} />;
  }
  
  if (view === 'usher') {
    return (
      <UsherView
        user={user}
        guests={guests}
        onCheckIn={handleCheckIn}
        onLogout={handleLogout}
        online={online}
        pendingSync={syncQueue.length}
        addToast={addToast}
      />
    );
  }
  
  if (view === 'admin') {
    return (
      <AdminView
        user={user}
        guests={guests}
        auditLog={auditLog}
        onCheckIn={handleCheckIn}
        onBulkCheckIn={handleBulkCheckIn}
        onLogout={handleLogout}
        online={online}
        pendingSync={syncQueue.length}
        addToast={addToast}
      />
    );
  }
  
  return (
    <>
      <ToastContainer toasts={toasts} />
    </>
  );
}

// ============================================
// LOGIN VIEW
// ============================================

function LoginView({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!username || !password) {
      setError('Please enter username and password');
      return;
    }
    
    setLoading(true);
    setTimeout(() => {
      const success = onLogin(username, password);
      if (!success) {
        setError('Invalid username or password');
        setPassword('');
      }
      setLoading(false);
    }, 500);
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-slate-800 rounded-2xl shadow-2xl p-8 border border-slate-700">
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
              className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full mb-4"
            >
              <Users className="w-8 h-8 text-white" />
            </motion.div>
            <h1 className="text-3xl font-bold text-white mb-2">GuestList Pro</h1>
            <p className="text-slate-400">Sign in to continue</p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Enter your username"
                autoComplete="username"
                disabled={loading}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={loading}
              />
            </div>
            
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
                >
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-400">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          
          <div className="mt-6 pt-6 border-t border-slate-700">
            <p className="text-sm text-slate-400 text-center">Demo: usher1/password123 or admin1/admin123</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================
// USHER VIEW
// ============================================

function UsherView({ user, guests, onCheckIn, onLogout, online, pendingSync, addToast }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({ ticketType: 'all', status: 'all', hasPlusOnes: false });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState(null);
  const [expressMode, setExpressMode] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [undoGuest, setUndoGuest] = useState(null);
  const [undoTimer, setUndoTimer] = useState(0);
  
  const filteredGuests = useGuestSearch(guests, searchTerm, filters);
  
  const stats = useMemo(() => ({
    total: guests.length,
    checkedIn: guests.filter(g => g.status === 'Checked-In').length,
    plusOnesTotal: guests.reduce((sum, g) => sum + g.plusOnesAllowed, 0),
    plusOnesCheckedIn: guests.reduce((sum, g) => sum + g.plusOnesCheckedIn, 0)
  }), [guests]);
  
  const recentCheckIns = useMemo(() =>
    guests
      .filter(g => g.status === 'Checked-In' && g.checkInTime)
      .sort((a, b) => new Date(b.checkInTime) - new Date(a.checkInTime))
      .slice(0, 5),
    [guests]
  );
  
  // Undo countdown
  useEffect(() => {
    if (!undoGuest || undoTimer <= 0) {
      if (undoTimer <= 0) setUndoGuest(null);
      return;
    }
    const timer = setTimeout(() => setUndoTimer(t => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [undoTimer, undoGuest]);
  
  const handleCheckInClick = useCallback((guest) => {
    if (expressMode && guest.plusOnesAllowed === 0) {
      // Express mode: instant check-in for guests with no plus-ones
      const updated = onCheckIn(guest, 0, '');
      setUndoGuest(updated);
      setUndoTimer(30);
    } else {
      setSelectedGuest(guest);
    }
  }, [expressMode, onCheckIn]);
  
  const handleConfirmCheckIn = useCallback((guest, plusOnes, notes) => {
    const updated = onCheckIn(guest, plusOnes, notes);
    setSelectedGuest(null);
    setUndoGuest(updated);
    setUndoTimer(30);
  }, [onCheckIn]);
  
  const handleUndo = useCallback(() => {
    if (undoGuest) {
      onCheckIn(undoGuest, 0, '', true);
      setUndoGuest(null);
      setUndoTimer(0);
    }
  }, [undoGuest, onCheckIn]);
  
  const handleBarcodeScanned = useCallback((code) => {
    const guest = guests.find(g => 
      g.confirmationCode === code || 
      g.email === code || 
      g.id.toString() === code
    );
    
    if (guest) {
      if (guest.status === 'Checked-In') {
        addToast(`${guest.firstName} ${guest.lastName} is already checked in`, 'warning');
      } else {
        handleCheckInClick(guest);
      }
    } else {
      addToast('Guest not found', 'error');
    }
    setShowScanner(false);
  }, [guests, handleCheckInClick, addToast]);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <Header user={user} online={online} pendingSync={pendingSync} onLogout={onLogout} />
      
      <main className="max-w-4xl mx-auto px-4 py-6 pb-32">
        {/* Quick Stats */}
        <QuickStats stats={stats} />
        
        {/* Controls */}
        <div className="mt-6 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, email, phone, code..."
              className="w-full pl-12 pr-32 py-4 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 rounded-lg transition-colors ${showFilters ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
              >
                <Filter className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowScanner(true)}
                className="p-2 bg-slate-700 text-slate-300 hover:bg-slate-600 rounded-lg transition-colors"
              >
                <Camera className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          {/* Filter Panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-semibold">Filters</h3>
                  <button
                    onClick={() => setFilters({ ticketType: 'all', status: 'all', hasPlusOnes: false })}
                    className="text-sm text-blue-400 hover:text-blue-300"
                  >
                    Reset
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Ticket Type</label>
                    <select
                      value={filters.ticketType}
                      onChange={(e) => setFilters(prev => ({ ...prev, ticketType: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All</option>
                      <option value="VIP">VIP</option>
                      <option value="General">General</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Status</label>
                    <select
                      value={filters.status}
                      onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All</option>
                      <option value="checked-in">Checked In</option>
                      <option value="not-checked-in">Not Checked In</option>
                    </select>
                  </div>
                </div>
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.hasPlusOnes}
                    onChange={(e) => setFilters(prev => ({ ...prev, hasPlusOnes: e.target.checked }))}
                    className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-slate-300">Has Plus-Ones Only</span>
                </label>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Express Mode Toggle */}
          <div className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-xl p-4">
            <div>
              <h3 className="text-white font-semibold">Express Mode</h3>
              <p className="text-sm text-slate-400">Skip modal for guests with 0 plus-ones</p>
            </div>
            <button
              onClick={() => setExpressMode(!expressMode)}
              className={`relative w-14 h-8 rounded-full transition-colors ${expressMode ? 'bg-blue-500' : 'bg-slate-600'}`}
            >
              <motion.div
                layout
                className="absolute top-1 left-1 w-6 h-6 bg-white rounded-full"
                animate={{ x: expressMode ? 24 : 0 }}
              />
            </button>
          </div>
        </div>
        
        {/* Guest List */}
        <div className="mt-6 space-y-3">
          {searchTerm || filters.ticketType !== 'all' || filters.status !== 'all' || filters.hasPlusOnes ? (
            <>
              <div className="flex items-center justify-between px-2">
                <h3 className="text-white font-semibold">
                  Results ({filteredGuests.length})
                </h3>
                {filteredGuests.length > 0 && (
                  <span className="text-sm text-slate-400">
                    {expressMode && 'Express mode active'}
                  </span>
                )}
              </div>
              
              {filteredGuests.length === 0 ? (
                <div className="bg-slate-800 rounded-xl p-12 text-center border border-slate-700">
                  <Search className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400 text-lg">No guests found</p>
                  <p className="text-slate-500 text-sm mt-2">Try adjusting your search or filters</p>
                </div>
              ) : (
                <AnimatePresence>
                  {filteredGuests.map(guest => (
                    <GuestCard
                      key={guest.id}
                      guest={guest}
                      onCheckIn={handleCheckInClick}
                      expressMode={expressMode}
                    />
                  ))}
                </AnimatePresence>
              )}
            </>
          ) : (
            <>
              <h3 className="text-white font-semibold px-2">Recent Check-Ins</h3>
              {recentCheckIns.length === 0 ? (
                <div className="bg-slate-800 rounded-xl p-12 text-center border border-slate-700">
                  <Clock className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400 text-lg">No check-ins yet</p>
                  <p className="text-slate-500 text-sm mt-2">Start by searching for a guest above</p>
                </div>
              ) : (
                recentCheckIns.map(guest => (
                  <motion.div
                    key={guest.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-slate-800 rounded-xl p-4 border border-slate-700"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-400" />
                        <div>
                          <p className="text-white font-medium">{guest.firstName} {guest.lastName}</p>
                          <p className="text-sm text-slate-400">
                            {new Date(guest.checkInTime).toLocaleTimeString()}
                            {guest.plusOnesCheckedIn > 0 && ` • +${guest.plusOnesCheckedIn}`}
                          </p>
                        </div>
                      </div>
                      <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-medium">
                        {guest.ticketType}
                      </span>
                    </div>
                  </motion.div>
                ))
              )}
            </>
          )}
        </div>
      </main>
      
      {/* Undo Banner */}
      <AnimatePresence>
        {undoGuest && undoTimer > 0 && (
          <UndoBanner
            guest={undoGuest}
            timer={undoTimer}
            onUndo={handleUndo}
          />
        )}
      </AnimatePresence>
      
      {/* Check-In Modal */}
      <AnimatePresence>
        {selectedGuest && (
          <CheckInModal
            guest={selectedGuest}
            onConfirm={handleConfirmCheckIn}
            onCancel={() => setSelectedGuest(null)}
          />
        )}
      </AnimatePresence>
      
      {/* Barcode Scanner Modal */}
      <AnimatePresence>
        {showScanner && (
          <BarcodeScanner
            onScan={handleBarcodeScanned}
            onClose={() => setShowScanner(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// ADMIN VIEW
// ============================================

function AdminView({ user, guests, auditLog, onCheckIn, onBulkCheckIn, onLogout, online, pendingSync, addToast }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGuests, setSelectedGuests] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [showExportModal, setShowExportModal] = useState(false);
  
  const stats = useMemo(() => ({
    total: guests.length,
    checkedIn: guests.filter(g => g.status === 'Checked-In').length,
    notArrived: guests.filter(g => g.status === 'Not Checked-In').length,
    plusOnesTotal: guests.reduce((sum, g) => sum + g.plusOnesAllowed, 0),
    plusOnesCheckedIn: guests.reduce((sum, g) => sum + g.plusOnesCheckedIn, 0),
    vipTotal: guests.filter(g => g.ticketType === 'VIP').length,
    vipCheckedIn: guests.filter(g => g.ticketType === 'VIP' && g.status === 'Checked-In').length
  }), [guests]);
  
  const chartData = useMemo(() => {
    const hourlyData = {};
    guests.filter(g => g.checkInTime).forEach(g => {
      const hour = new Date(g.checkInTime).getHours();
      hourlyData[hour] = (hourlyData[hour] || 0) + 1;
    });
    
    return Object.keys(hourlyData).sort().map(hour => ({
      hour: `${hour}:00`,
      checkIns: hourlyData[hour]
    }));
  }, [guests]);
  
  const ticketTypeData = [
    { name: 'VIP', value: stats.vipTotal, checkedIn: stats.vipCheckedIn },
    { name: 'General', value: stats.total - stats.vipTotal, checkedIn: stats.checkedIn - stats.vipCheckedIn }
  ];
  
  const filteredGuests = useMemo(() => {
    let filtered = guests;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(g =>
        g.firstName.toLowerCase().includes(term) ||
        g.lastName.toLowerCase().includes(term) ||
        g.email.toLowerCase().includes(term)
      );
    }
    
    if (filterStatus !== 'all') {
      filtered = filtered.filter(g =>
        filterStatus === 'checked-in' ? g.status === 'Checked-In' : g.status === 'Not Checked-In'
      );
    }
    
    // Sort
    filtered = [...filtered].sort((a, b) => {
      if (sortBy === 'name') return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      if (sortBy === 'checkInTime') return new Date(b.checkInTime || 0) - new Date(a.checkInTime || 0);
      return 0;
    });
    
    return filtered;
  }, [guests, searchTerm, filterStatus, sortBy]);
  
  const handleSelectAll = useCallback(() => {
    if (selectedGuests.length === filteredGuests.length) {
      setSelectedGuests([]);
    } else {
      setSelectedGuests(filteredGuests.map(g => g.id));
    }
  }, [selectedGuests, filteredGuests]);
  
  const handleBulkAction = useCallback(() => {
    const guestsToCheckIn = guests.filter(g => selectedGuests.includes(g.id) && g.status !== 'Checked-In');
    onBulkCheckIn(guestsToCheckIn);
    setSelectedGuests([]);
  }, [selectedGuests, guests, onBulkCheckIn]);
  
  const handleExport = useCallback((format) => {
    if (format === 'csv') {
      exportToCSV(filteredGuests, `guests-export-${new Date().toISOString().split('T')[0]}.csv`);
      addToast('Export successful', 'success');
    }
    setShowExportModal(false);
  }, [filteredGuests, addToast]);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Header user={user} online={online} pendingSync={pendingSync} onLogout={onLogout} isAdmin />
      
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {['dashboard', 'guests', 'audit'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === tab
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              {tab === 'dashboard' && <Home className="w-4 h-4 inline mr-2" />}
              {tab === 'guests' && <Users className="w-4 h-4 inline mr-2" />}
              {tab === 'audit' && <History className="w-4 h-4 inline mr-2" />}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
        
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <DashboardTab
              key="dashboard"
              stats={stats}
              guests={guests}
              chartData={chartData}
              ticketTypeData={ticketTypeData}
            />
          )}
          
          {activeTab === 'guests' && (
            <GuestsTab
              key="guests"
              guests={filteredGuests}
              selectedGuests={selectedGuests}
              onSelectGuest={(id) => setSelectedGuests(prev =>
                prev.includes(id) ? prev.filter(gid => gid !== id) : [...prev, id]
              )}
              onSelectAll={handleSelectAll}
              onBulkAction={handleBulkAction}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              filterStatus={filterStatus}
              onFilterChange={setFilterStatus}
              sortBy={sortBy}
              onSortChange={setSortBy}
              onExport={() => setShowExportModal(true)}
            />
          )}
          
          {activeTab === 'audit' && (
            <AuditTab key="audit" auditLog={auditLog} />
          )}
        </AnimatePresence>
      </main>
      
      {/* Export Modal */}
      <AnimatePresence>
        {showExportModal && (
          <ExportModal
            onExport={handleExport}
            onClose={() => setShowExportModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// SHARED COMPONENTS
// ============================================

function Header({ user, online, pendingSync, onLogout, isAdmin = false }) {
  return (
    <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isAdmin ? 'bg-gradient-to-br from-purple-500 to-pink-500' : 'bg-gradient-to-br from-blue-500 to-cyan-500'
            }`}>
              {isAdmin ? <BarChart3 className="w-5 h-5 text-white" /> : <User className="w-5 h-5 text-white" />}
            </div>
            <div>
              <h2 className="text-white font-semibold">{user.fullName}</h2>
              <p className="text-xs text-slate-400">{user.role}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {online ? (
                <>
                  <Wifi className="w-5 h-5 text-green-400" />
                  <span className="text-sm text-green-400 hidden sm:inline">Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-5 h-5 text-orange-400" />
                  <span className="text-sm text-orange-400 hidden sm:inline">Offline</span>
                </>
              )}
              {pendingSync > 0 && (
                <span className="px-2 py-1 bg-orange-500 text-white rounded-full text-xs font-medium">
                  {pendingSync}
                </span>
              )}
            </div>
            
            <button
              onClick={onLogout}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

function QuickStats({ stats }) {
  const percentage = ((stats.checkedIn / stats.total) * 100).toFixed(1);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-800 rounded-xl p-6 border border-slate-700"
    >
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-3xl font-bold text-white">{stats.checkedIn}</div>
          <div className="text-sm text-slate-400">Checked In</div>
        </div>
        <div>
          <div className="text-3xl font-bold text-slate-400">{stats.total}</div>
          <div className="text-sm text-slate-400">Total Guests</div>
        </div>
      </div>
      <div className="relative w-full h-3 bg-slate-700 rounded-full overflow-hidden mb-2">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-green-500"
        />
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-400">Progress: {percentage}%</span>
        <span className="text-slate-400">
          Plus-Ones: {stats.plusOnesCheckedIn}/{stats.plusOnesTotal}
        </span>
      </div>
    </motion.div>
  );
}

function GuestCard({ guest, onCheckIn, expressMode }) {
  const isCheckedIn = guest.status === 'Checked-In';
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-slate-800 rounded-xl p-4 border border-slate-700 hover:border-slate-600 transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white">
            {guest.firstName} {guest.lastName}
          </h3>
          <p className="text-sm text-slate-400">{guest.email}</p>
          {guest.phone && <p className="text-xs text-slate-500">{guest.phone}</p>}
        </div>
        
        {isCheckedIn ? (
          <div className="flex items-center gap-2 px-3 py-1 bg-green-500/20 text-green-400 rounded-full">
            <CheckCircle className="w-4 h-4" />
            <span className="text-xs font-medium">Checked In</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-700 text-slate-400 rounded-full">
            <XCircle className="w-4 h-4" />
            <span className="text-xs font-medium">Not Checked In</span>
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-4 mb-4 text-sm">
        <span className={`px-3 py-1 rounded-full font-medium ${
          guest.ticketType === 'VIP'
            ? 'bg-purple-500/20 text-purple-400'
            : 'bg-blue-500/20 text-blue-400'
        }`}>
          {guest.ticketType}
        </span>
        {guest.plusOnesAllowed > 0 && (
          <span className="text-slate-400">
            Plus-Ones: {guest.plusOnesCheckedIn}/{guest.plusOnesAllowed}
          </span>
        )}
      </div>
      
      {isCheckedIn ? (
        <div className="space-y-2 text-sm">
          {guest.checkInTime && (
            <p className="text-slate-400 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {new Date(guest.checkInTime).toLocaleString()}
            </p>
          )}
          {guest.checkedInBy && (
            <p className="text-slate-400 flex items-center gap-2">
              <User className="w-4 h-4" />
              by {guest.checkedInBy}
            </p>
          )}
          {guest.notes && (
            <p className="text-slate-400 italic mt-2">"{guest.notes}"</p>
          )}
        </div>
      ) : (
        <button
          onClick={() => onCheckIn(guest)}
          className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold rounded-lg transition-all text-lg shadow-lg"
        >
          {expressMode && guest.plusOnesAllowed === 0 ? 'Express Check-In' : 'Check In'}
        </button>
      )}
    </motion.div>
  );
}

function CheckInModal({ guest, onConfirm, onCancel }) {
  const [plusOnes, setPlusOnes] = useState(0);
  const [notes, setNotes] = useState('');
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-800 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl"
      >
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-2xl font-bold text-white mb-2">Check In Guest</h2>
          <p className="text-lg text-slate-300">{guest.firstName} {guest.lastName}</p>
          <p className="text-sm text-slate-400">{guest.email}</p>
        </div>
        
        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Ticket Type</label>
            <div className={`px-4 py-2 rounded-lg inline-block font-medium ${
              guest.ticketType === 'VIP'
                ? 'bg-purple-500/20 text-purple-400'
                : 'bg-blue-500/20 text-blue-400'
            }`}>
              {guest.ticketType}
            </div>
          </div>
          
          {guest.plusOnesAllowed > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-3">
                Plus-Ones Attending
              </label>
              <div className="flex gap-2">
                {[...Array(guest.plusOnesAllowed + 1)].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPlusOnes(i)}
                    className={`flex-1 py-4 rounded-lg font-bold text-xl transition-all ${
                      plusOnes === i
                        ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white scale-105 shadow-lg'
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                    }`}
                  >
                    {i}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Maximum {guest.plusOnesAllowed} plus-one{guest.plusOnesAllowed > 1 ? 's' : ''} allowed
              </p>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Arrived in red car, has allergy..."
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows="3"
            />
          </div>
        </div>
        
        <div className="p-6 border-t border-slate-700 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(guest, plusOnes, notes)}
            className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg"
          >
            <CheckCircle className="w-5 h-5" />
            Confirm
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============================================
// DASHBOARD TAB
// ============================================

function DashboardTab({ stats, guests, chartData, ticketTypeData }) {
  const recentCheckIns = guests
    .filter(g => g.status === 'Checked-In' && g.checkInTime)
    .sort((a, b) => new Date(b.checkInTime) - new Date(a.checkInTime))
    .slice(0, 10);
  
  const notCheckedIn = guests.filter(g => g.status === 'Not Checked-In');
  const percentage = ((stats.checkedIn / stats.total) * 100).toFixed(1);
  
  const COLORS = ['#8b5cf6', '#3b82f6'];
  
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
          value={stats.total}
          icon={<Users className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          label="Checked In"
          value={stats.checkedIn}
          subtitle={`${percentage}%`}
          icon={<CheckCircle className="w-5 h-5" />}
          color="green"
        />
        <StatCard
          label="Not Arrived"
          value={stats.notArrived}
          icon={<XCircle className="w-5 h-5" />}
          color="orange"
        />
        <StatCard
          label="Plus-Ones"
          value={`${stats.plusOnesCheckedIn}/${stats.plusOnesTotal}`}
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
            transition={{ duration: 1, ease: 'easeOut' }}
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-green-500"
          />
          <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-sm">
            {stats.checkedIn} / {stats.total} ({percentage}%)
          </div>
        </div>
      </div>
      
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Check-Ins Over Time */}
        {chartData.length > 0 && (
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h3 className="text-white font-semibold mb-4">Check-Ins Over Time</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="hour" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                  labelStyle={{ color: '#e2e8f0' }}
                />
                <Line type="monotone" dataKey="checkIns" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        
        {/* Ticket Type Breakdown */}
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
                fill="#8884d8"
                dataKey="value"
              >
                {ticketTypeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2">
            {ticketTypeData.map((item, i) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                  <span className="text-slate-300">{item.name}</span>
                </div>
                <span className="text-slate-400">{item.checkedIn}/{item.value} checked in</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Recent Activity & Awaiting */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Check-Ins */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 className="text-white font-semibold mb-4">Recent Check-Ins</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {recentCheckIns.length === 0 ? (
              <p className="text-slate-400 text-center py-8">No check-ins yet</p>
            ) : (
              recentCheckIns.map(guest => (
                <div key={guest.id} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                    <div>
                      <p className="text-white font-medium text-sm">
                        {guest.firstName} {guest.lastName}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(guest.checkInTime).toLocaleTimeString()}
                        {guest.plusOnesCheckedIn > 0 && ` • +${guest.plusOnesCheckedIn}`}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs ${
                    guest.ticketType === 'VIP'
                      ? 'bg-purple-500/20 text-purple-400'
                      : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {guest.ticketType}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* Awaiting Arrival */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 className="text-white font-semibold mb-4">
            Awaiting Arrival ({notCheckedIn.length})
          </h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {notCheckedIn.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-2" />
                <p className="text-green-400 font-medium">All guests checked in!</p>
              </div>
            ) : (
              notCheckedIn.slice(0, 15).map(guest => (
                <div key={guest.id} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-slate-500 flex-shrink-0" />
                    <div>
                      <p className="text-white font-medium text-sm">
                        {guest.firstName} {guest.lastName}
                      </p>
                      <p className="text-xs text-slate-400">{guest.email}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs ${
                    guest.ticketType === 'VIP'
                      ? 'bg-purple-500/20 text-purple-400'
                      : 'bg-slate-600 text-slate-300'
                  }`}>
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
    blue: 'from-blue-500 to-cyan-500',
    green: 'from-green-500 to-emerald-500',
    orange: 'from-orange-500 to-amber-500',
    purple: 'from-purple-500 to-pink-500'
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
      {subtitle && <div className="text-sm text-slate-400 mt-1">{subtitle}</div>}
    </motion.div>
  );
}

// ============================================
// GUESTS TAB
// ============================================

function GuestsTab({
  guests,
  selectedGuests,
  onSelectGuest,
  onSelectAll,
  onBulkAction,
  searchTerm,
  onSearchChange,
  filterStatus,
  onFilterChange,
  sortBy,
  onSortChange,
  onExport
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4"
    >
      {/* Controls */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-4">
        <div className="flex gap-4 flex-wrap">
          {/* Search */}
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
          
          {/* Filter */}
          <select
            value={filterStatus}
            onChange={(e) => onFilterChange(e.target.value)}
            className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All ({guests.length})</option>
            <option value="checked-in">Checked In</option>
            <option value="not-checked-in">Not Checked In</option>
          </select>
          
          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="name">Sort by Name</option>
            <option value="checkInTime">Sort by Check-In Time</option>
          </select>
          
          {/* Export */}
          <button
            onClick={onExport}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
        
        {/* Bulk Actions */}
        <AnimatePresence>
          {selectedGuests.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center justify-between p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg"
            >
              <span className="text-blue-400 font-medium">
                {selectedGuests.length} guest{selectedGuests.length > 1 ? 's' : ''} selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={onBulkAction}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  Check In All
                </button>
                <button
                  onClick={() => onSelectGuest(null)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
                >
                  Clear
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700/50 border-b border-slate-700">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedGuests.length === guests.length && guests.length > 0}
                    onChange={onSelectAll}
                    className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Guest
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Ticket
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Plus-Ones
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Check-In Time
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {guests.map(guest => (
                <tr key={guest.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedGuests.includes(guest.id)}
                      onChange={() => onSelectGuest(guest.id)}
                      className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-2 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-white font-medium">
                      {guest.firstName} {guest.lastName}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-slate-400">{guest.email}</div>
                    {guest.phone && <div className="text-xs text-slate-500">{guest.phone}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      guest.ticketType === 'VIP'
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {guest.ticketType}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-slate-300">{guest.plusOnesCheckedIn}/{guest.plusOnesAllowed}</span>
                  </td>
                  <td className="px-4 py-3">
                    {guest.status === 'Checked-In' ? (
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
                      {guest.checkInTime ? new Date(guest.checkInTime).toLocaleString() : '-'}
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

// ============================================
// AUDIT TAB
// ============================================

function AuditTab({ auditLog }) {
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
            auditLog.map(log => (
              <div key={log.id} className="p-4 bg-slate-700/50 rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {log.action === 'Check-In' ? (
                      <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                    ) : (
                      <RotateCcw className="w-5 h-5 text-orange-400 flex-shrink-0" />
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
                      <span className="text-slate-500">Plus-Ones:</span> {log.plusOnesCount}
                    </p>
                  )}
                  {log.notes && (
                    <p className="text-slate-400">
                      <span className="text-slate-500">Notes:</span> {log.notes}
                    </p>
                  )}
                  {log.confirmationCode && (
                    <p className="text-slate-400">
                      <span className="text-slate-500">Code:</span> <code className="text-blue-400">{log.confirmationCode}</code>
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

// ============================================
// EXPORT MODAL
// ============================================

function ExportModal({ onExport, onClose }) {
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
            onClick={() => onExport('csv')}
            className="w-full p-4 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <Download className="w-5 h-5 text-blue-400" />
              <div>
                <p className="text-white font-medium">Export as CSV</p>
                <p className="text-sm text-slate-400">Compatible with Excel, Google Sheets</p>
              </div>
            </div>
          </button>
          
          <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-slate-400">
                <p className="font-medium text-slate-300 mb-1">Export includes:</p>
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

// ============================================
// TOAST NOTIFICATION
// ============================================

function ToastContainer({ toasts }) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      <AnimatePresence>
        {toasts.map(toast => (
          <Toast key={toast.id} message={toast.message} type={toast.type} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function Toast({ message, type }) {
  const colors = {
    success: 'from-green-500 to-emerald-500',
    error: 'from-red-500 to-rose-500',
    warning: 'from-orange-500 to-amber-500',
    info: 'from-blue-500 to-cyan-500'
  };
  
  const icons = {
    success: <CheckCircle className="w-5 h-5" />,
    error: <XCircle className="w-5 h-5" />,
    warning: <AlertCircle className="w-5 h-5" />,
    info: <AlertCircle className="w-5 h-5" />
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      className={`bg-gradient-to-r ${colors[type]} text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 min-w-[300px]`}
    >
      {icons[type]}
      <p className="font-medium">{message}</p>
    </motion.div>
  );
}

function UndoBanner({ guest, timer, onUndo }) {
  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl px-6 py-4 flex items-center gap-4 z-50 max-w-md"
    >
      <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-white font-medium">
          {guest.firstName} {guest.lastName} checked in
        </p>
        <p className="text-sm text-slate-400">Tap to undo ({timer}s)</p>
      </div>
      <button
        onClick={onUndo}
        className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
      >
        <RotateCcw className="w-4 h-4" />
        Undo
      </button>
    </motion.div>
  );
}

function BarcodeScanner({ onScan, onClose }) {
  const [manualCode, setManualCode] = useState('');
  const inputRef = useRef(null);
  
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScan(manualCode.trim());
      setManualCode('');
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
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
          <h2 className="text-2xl font-bold text-white">Scan Barcode</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <XIcon className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        <div className="mb-6">
          <div className="bg-slate-900 rounded-xl p-12 flex items-center justify-center border-2 border-dashed border-slate-600">
            <Camera className="w-24 h-24 text-slate-600" />
          </div>
          <p className="text-sm text-slate-400 text-center mt-4">
            Camera scanning not available in demo
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Enter Code Manually
            </label>
            <input
              ref={inputRef}
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Type or scan barcode..."
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold rounded-lg transition-all"
          >
            Submit Code
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}