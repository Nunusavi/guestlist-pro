import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Search, Users, CheckCircle, XCircle, Clock, Wifi, WifiOff, User, LogOut, Camera, Filter, RotateCcw, X as XIcon, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useGuests, useGuestStats } from '../hooks/useGuests';
import { useToast } from '../components/Toast';

export default function UsherPage() {
  const { user, logout } = useAuth();
  const { addToast } = useToast();
  const { guests, loading, fetchGuests, searchGuests, checkIn, undoCheckIn: undoCheckInApi } = useGuests();
  const { stats, refetch: refetchStats } = useGuestStats();
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({ ticketType: 'all', status: 'all', hasPlusOnes: false });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState(null);
  const [expressMode, setExpressMode] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [undoGuest, setUndoGuest] = useState(null);
  const [undoTimer, setUndoTimer] = useState(0);
  const [online] = useState(navigator.onLine);
  
  // Load guests on mount
  useEffect(() => {
    fetchGuests();
  }, [fetchGuests]);

  // Apply local filters to guests
  const filteredGuests = useMemo(() => {
    let filtered = guests;

    if (filters.ticketType !== 'all') {
      filtered = filtered.filter(g => g.ticketType === filters.ticketType);
    }
    if (filters.status !== 'all') {
      if (filters.status === 'checked-in') {
        filtered = filtered.filter(g => g.status === 'Checked-In');
      } else {
        filtered = filtered.filter(g => g.status === 'Not Checked-In');
      }
    }
    if (filters.hasPlusOnes) {
      filtered = filtered.filter(g => g.plusOnesAllowed > 0);
    }

    return filtered;
  }, [guests, filters]);

  // Recent check-ins
  const recentCheckIns = useMemo(() =>
    guests
      .filter(g => g.status === 'Checked-In' && g.checkInTime)
      .sort((a, b) => new Date(b.checkInTime) - new Date(a.checkInTime))
      .slice(0, 5),
    [guests]
  );
  
  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.trim()) {
        searchGuests(searchTerm);
      } else {
        fetchGuests();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, searchGuests, fetchGuests]);

  // Undo countdown
  useEffect(() => {
    if (!undoGuest || undoTimer <= 0) {
      if (undoTimer <= 0) setUndoGuest(null);
      return;
    }
    const timer = setTimeout(() => setUndoTimer(t => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [undoTimer, undoGuest]);

  const handleCheckIn = useCallback(async (guest, plusOnes = 0, notes = '') => {
    const result = await checkIn(guest.id, plusOnes, notes);
    
    if (result.success) {
      addToast(`${guest.firstName} ${guest.lastName} checked in successfully`, 'success');
      setUndoGuest(result.guest);
      setUndoTimer(30);
      setSelectedGuest(null);
      refetchStats(); // Update stats
    } else {
      addToast(result.error || 'Check-in failed', 'error');
    }
  }, [checkIn, addToast, refetchStats]);

  const handleUndo = useCallback(async () => {
    if (undoGuest) {
      const result = await undoCheckInApi(undoGuest.id);
      
      if (result.success) {
        addToast(`${undoGuest.firstName} ${undoGuest.lastName} check-in undone`, 'info');
        setUndoGuest(null);
        setUndoTimer(0);
        refetchStats();
      } else {
        addToast(result.error || 'Undo failed', 'error');
      }
    }
  }, [undoGuest, undoCheckInApi, addToast, refetchStats]);

  const handleCheckInClick = useCallback((guest) => {
    if (guest.status === 'Checked-In') {
      addToast('Guest is already checked in', 'warning');
      return;
    }
    
    if (expressMode && guest.plusOnesAllowed === 0) {
      handleCheckIn(guest, 0, '');
    } else {
      setSelectedGuest(guest);
    }
  }, [expressMode, handleCheckIn, addToast]);

  const handleLogout = useCallback(async () => {
    await logout();
    addToast('Logged out successfully', 'info');
  }, [logout, addToast]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-white font-semibold">{user?.fullName || 'Usher'}</h2>
                <p className="text-xs text-slate-400">{user?.role || 'Usher'}</p>
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
              </div>

              <button onClick={handleLogout} className="p-2 hover:bg-slate-700 rounded-lg transition-colors" title="Logout">
                <LogOut className="w-5 h-5 text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 pb-32">
        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-6"
        >
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <div className="text-3xl font-bold text-white">{stats?.checkedIn || 0}</div>
              <div className="text-sm text-slate-400">Checked In</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-slate-400">{stats?.total || 0}</div>
              <div className="text-sm text-slate-400">Total Guests</div>
            </div>
          </div>
          <div className="relative w-full h-3 bg-slate-700 rounded-full overflow-hidden mb-2">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${stats?.percentage || 0}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-green-500"
            />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Progress: {stats?.percentage?.toFixed(1) || 0}%</span>
            <span className="text-slate-400">Plus-Ones: {stats?.plusOnesCheckedIn || 0}/{stats?.plusOnesTotal || 0}</span>
          </div>
        </motion.div>

        {/* Controls */}
        <div className="space-y-4 mb-6">
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
                    className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-blue-500"
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
                className="absolute top-1 left-1 w-6 h-6 bg-white rounded-full"
                animate={{ x: expressMode ? 24 : 0 }}
              />
            </button>
          </div>
        </div>

        {/* Guest List */}
        <div className="space-y-3">
          {searchTerm || filters.ticketType !== 'all' || filters.status !== 'all' || filters.hasPlusOnes ? (
            <>
              <div className="flex items-center justify-between px-2">
                <h3 className="text-white font-semibold">Results ({filteredGuests.length})</h3>
              </div>

              {filteredGuests.length === 0 ? (
                <div className="bg-slate-800 rounded-xl p-12 text-center border border-slate-700">
                  <Search className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400 text-lg">No guests found</p>
                  <p className="text-slate-500 text-sm mt-2">Try adjusting your search or filters</p>
                </div>
              ) : (
                filteredGuests.map(guest => (
                  <GuestCard key={guest.id} guest={guest} onCheckIn={handleCheckInClick} />
                ))
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
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl px-6 py-4 flex items-center gap-4 z-50 max-w-md"
          >
            <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-white font-medium">{undoGuest.firstName} {undoGuest.lastName} checked in</p>
              <p className="text-sm text-slate-400">Tap to undo ({undoTimer}s)</p>
            </div>
            <button
              onClick={handleUndo}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Undo
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Check-In Modal */}
      <AnimatePresence>
        {selectedGuest && (
          <CheckInModal
            guest={selectedGuest}
            onConfirm={handleCheckIn}
            onCancel={() => setSelectedGuest(null)}
          />
        )}
      </AnimatePresence>

      {/* Scanner Modal */}
      <AnimatePresence>
        {showScanner && (
          <ScannerModal onClose={() => setShowScanner(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function GuestCard({ guest, onCheckIn }) {
  const isCheckedIn = guest.status === 'Checked-In';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-800 rounded-xl p-4 border border-slate-700 hover:border-slate-600 transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white">{guest.firstName} {guest.lastName}</h3>
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
          guest.ticketType === 'VIP' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
        }`}>
          {guest.ticketType}
        </span>
        {guest.plusOnesAllowed > 0 && (
          <span className="text-slate-400">Plus-Ones: {guest.plusOnesCheckedIn}/{guest.plusOnesAllowed}</span>
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
        </div>
      ) : (
        <button
          onClick={() => onCheckIn(guest)}
          className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold rounded-lg transition-all text-lg shadow-lg"
        >
          Check In
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
              guest.ticketType === 'VIP' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
            }`}>
              {guest.ticketType}
            </div>
          </div>

          {guest.plusOnesAllowed > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-3">Plus-Ones Attending</label>
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
              <p className="text-xs text-slate-500 mt-2">Maximum {guest.plusOnesAllowed} plus-one{guest.plusOnesAllowed > 1 ? 's' : ''} allowed</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Notes (Optional)</label>
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

function ScannerModal({ onClose }) {
  const [manualCode, setManualCode] = useState('');

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
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
            <XIcon className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="mb-6">
          <div className="bg-slate-900 rounded-xl p-12 flex items-center justify-center border-2 border-dashed border-slate-600">
            <Camera className="w-24 h-24 text-slate-600" />
          </div>
          <p className="text-sm text-slate-400 text-center mt-4">Camera scanning not available in demo</p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Enter Code Manually</label>
            <input
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