import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { toast } from "sonner";
import { Camera, Loader2, Minus, Plus, Search, Sparkles, UserCheck, Undo2, Users, X, Check, AlertCircle, RefreshCw } from 'lucide-react';

import RouteGuard from '@/components/RouteGuard';
import MainLayout from '@/components/layout/MainLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import useDebounce from '@/hooks/useDebounce';
import { apiSearchGuests, apiCheckInGuest, apiUndoCheckIn } from '@/lib/api';

const ScannerComponent = dynamic(
    () => import('@yudiel/react-qr-scanner').then((mod) => mod.Scanner),
    { ssr: false }
);

const extractCode = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
        if (typeof value[0] === 'string') return value[0];
        return value[0]?.rawValue ?? value[0]?.text ?? '';
    }
    if (typeof value === 'object') {
        return value.rawValue ?? value.text ?? '';
    }
    return '';
};

const formatCameraError = (error, fallback = 'Unable to access the camera.') => {
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
        return 'Camera access requires a secure connection (HTTPS). Please use https:// or localhost.';
    }

    if (!error) return fallback;

    const name = (error.name || '').toLowerCase();
    const message = (error.message || '').toLowerCase();

    if (name === 'notallowederror' || message.includes('permission') || message.includes('denied')) {
        return 'Camera access denied. Please enable camera permissions in your browser settings and refresh the page.';
    }

    if (name === 'notfounderror' || message.includes('not found') || message.includes('no device')) {
        return 'No camera found. Please connect a camera to your device and try again.';
    }

    if (name === 'notreadableerror' || message.includes('not readable') || message.includes('in use')) {
        return 'Your camera appears to be in use by another application. Close other apps using the camera and retry.';
    }

    if (name === 'overconstrainederror' || message.includes('overconstrained') || message.includes('constraint')) {
        return 'Current camera settings are not supported. Try selecting another camera or remove custom constraints.';
    }

    if (name === 'securityerror' || message.includes('secure') || message.includes('https')) {
        return 'Camera access requires a secure connection (HTTPS). Please use https:// or localhost.';
    }

    if (name === 'aborterror') {
        return 'Camera initialisation was interrupted. Please try again.';
    }

    return error.message || fallback;
};

// FIXED: Normalize API response to match frontend expectations
const normalizeGuest = (guest) => {
    if (!guest) return null;

    const primaryId = guest.id
        ?? guest.guest_id
        ?? guest.guestId
        ?? guest.confirmation_code
        ?? guest.confirmationCode
        ?? null;

    const numericIdCandidate = typeof primaryId === 'number'
        ? primaryId
        : typeof primaryId === 'string' && primaryId.trim() !== ''
            ? Number.parseInt(primaryId, 10)
            : null;
    const numericId = Number.isNaN(numericIdCandidate) ? null : numericIdCandidate;

    const displayIdSource = guest.confirmation_code
        ?? guest.confirmationCode
        ?? guest.code
        ?? guest.guest_code
        ?? guest.guestCode
        ?? guest.badge_id
        ?? guest.badgeId
        ?? guest.ticket_id
        ?? guest.ticketId
        ?? primaryId
        ?? numericId;

    return {
        id: primaryId != null ? String(primaryId) : null,
        numericId,
        displayId: displayIdSource != null ? String(displayIdSource) : '',
        firstName: guest.first_name || guest.firstName || '',
        lastName: guest.last_name || guest.lastName || '',
        email: guest.email || '',
        phone: guest.phone || '',
        ticketType: guest.ticket_type || guest.ticketType || 'General',
        plusOnesAllowed: typeof guest.plus_ones_allowed === 'number'
            ? guest.plus_ones_allowed
            : typeof guest.plusOnesAllowed === 'number'
                ? guest.plusOnesAllowed
                : 0,
        plusOnesCheckedIn: typeof guest.plus_ones_checked_in === 'number'
            ? guest.plus_ones_checked_in
            : typeof guest.plusOnesCheckedIn === 'number'
                ? guest.plusOnesCheckedIn
                : 0,
        confirmationCode: guest.confirmation_code || guest.confirmationCode || '',
        status: guest.status === 'Checked In' || guest.status === 'checked_in' ? 'checked_in' : 'pending',
        checkInTime: guest.check_in_time || guest.checkInTime || null,
        checkedInBy: guest.checked_in_by || guest.checkedInBy || null,
        notes: guest.notes || '',
    };
};

const getGuestKey = (guest) => {
    if (!guest) return '';
    if (guest.id != null) return String(guest.id);
    if (guest.numericId != null) return String(guest.numericId);
    if (guest.displayId) return String(guest.displayId);
    return '';
};

function UsherDashboard() {
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedGuest, setSelectedGuest] = useState(null);
    const [plusOnes, setPlusOnes] = useState(0);

    const [searchMode, setSearchMode] = useState('manual');
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [scanError, setScanError] = useState(null);

    const [cameraPermission, setCameraPermission] = useState('unknown'); // unknown | granted | denied
    const [isCameraInitializing, setIsCameraInitializing] = useState(false);
    const [isCameraReady, setIsCameraReady] = useState(false);
    const [availableCameras, setAvailableCameras] = useState([]);
    const [preferredCameraId, setPreferredCameraId] = useState(null);
    const [activeCameraId, setActiveCameraId] = useState('auto');

    const [isScanProcessing, setIsScanProcessing] = useState(false);
    const [scanCooldown, setScanCooldown] = useState(0);

    const [showConfirmModal, setShowConfirmModal] = useState(false);

    // BATCH 3: Undo card positioning
    const [lastCheckIn, setLastCheckIn] = useState(null);
    const [undoTimeLeft, setUndoTimeLeft] = useState(30);

    // BATCH 3: Network error state
    const [networkError, setNetworkError] = useState(null);
    const [isRetrying, setIsRetrying] = useState(false);

    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const searchInputRef = useRef(null);
    const lastScanRef = useRef({ code: '', timestamp: 0 });
    const resultsListRef = useRef(null);

    useEffect(() => {
        searchInputRef.current?.focus();
    }, []);

    useEffect(() => {
        if (selectedGuest && resultsListRef.current) {
            const selectedElement = resultsListRef.current.querySelector(`[data-guest-id="${getGuestKey(selectedGuest)}"]`);
            if (selectedElement) {
                selectedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }, [selectedGuest]);

    const handleSelectGuest = useCallback((guest, { fromScan = false } = {}) => {
        if (!guest) return;

        const normalized = normalizeGuest(guest);

        if (normalized.status === 'checked_in') {
            toast.info(`${normalized.firstName} is already checked in.`, {
                description: normalized.checkedInBy && normalized.checkInTime
                    ? `Checked in by ${normalized.checkedInBy} at ${new Date(normalized.checkInTime).toLocaleTimeString()}`
                    : 'This guest has already been checked in.'
            });
            return;
        }

        setSelectedGuest(normalized);
        setPlusOnes(0);
        setIsScannerOpen(false);
        setScanError(null);
        setIsCameraReady(false);
        setIsCameraInitializing(false);
        setSearchTerm('');
        setNetworkError(null);

        if (!fromScan) {
            toast.success(`Ready to check in ${normalized.firstName} ${normalized.lastName}`);
        }
    }, []);

    const performSearch = useCallback(async (query, { viaScan = false } = {}) => {
        if (!query) {
            setResults([]);
            setIsSearching(false);
            return [];
        }

        setIsSearching(true);
        setScanError(null);
        setNetworkError(null);

        try {
            const data = await apiSearchGuests(query);
            const guests = (data.guests || []).map(normalizeGuest);
            setResults(guests);

            if (viaScan) {
                if (guests.length === 0) {
                    toast.error('No guests matched this QR code.');
                } else if (guests.length === 1) {
                    toast.success(`Found: ${guests[0].firstName} ${guests[0].lastName}`);
                    handleSelectGuest(guests[0], { fromScan: true });
                } else {
                    toast.success(`Found ${guests.length} matches for that code.`);
                }
            }

            return guests;
        } catch (error) {
            const description = error.message || 'Please try again.';

            // BATCH 3: Better error handling
            const isNetworkError = error.message?.toLowerCase().includes('network') ||
                error.message?.toLowerCase().includes('fetch') ||
                error.message?.toLowerCase().includes('connection');

            if (isNetworkError) {
                setNetworkError({ message: description, query, viaScan });
            }

            toast.error(viaScan ? 'QR lookup failed' : 'Search failed', { description });
            setResults([]);
            if (viaScan) {
                setScanError(description);
            }
            return [];
        } finally {
            setIsSearching(false);
        }
    }, [handleSelectGuest]);

    // BATCH 3: Retry search function
    const retrySearch = useCallback(async () => {
        if (!networkError) return;
        setIsRetrying(true);
        await performSearch(networkError.query, { viaScan: networkError.viaScan });
        setIsRetrying(false);
    }, [networkError, performSearch]);

    const refreshAvailableCameras = useCallback(async () => {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
            setAvailableCameras([]);
            setPreferredCameraId(null);
            return [];
        }

        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter((device) => device.kind === 'videoinput');
            setAvailableCameras(videoDevices);

            if (videoDevices.length === 0) {
                setPreferredCameraId(null);
                setActiveCameraId('auto');
                return [];
            }

            const environmentDevice = videoDevices.find((device) => {
                const label = device.label?.toLowerCase() ?? '';
                return label.includes('back') || label.includes('rear') || label.includes('environment');
            }) ?? videoDevices[0];

            setPreferredCameraId((prev) => {
                if (prev && videoDevices.some((device) => device.deviceId === prev)) {
                    return prev;
                }
                return environmentDevice?.deviceId ?? prev ?? null;
            });

            setActiveCameraId((prev) => {
                if (prev === 'auto') return prev;
                if (videoDevices.some((device) => device.deviceId === prev)) {
                    return prev;
                }
                return environmentDevice?.deviceId ?? 'auto';
            });

            return videoDevices;
        } catch (error) {
            console.error('Failed to enumerate cameras:', error);
            return [];
        }
    }, []);

    const ensureCameraAccess = useCallback(async (deviceOverride = null) => {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
            const message = 'Camera access is not supported in this environment. Please use a modern browser.';
            setScanError(message);
            toast.error('Camera unavailable', { description: message });
            return false;
        }

        if (isCameraInitializing) {
            return false;
        }

        setIsCameraInitializing(true);
        setScanError(null);

        const desiredDeviceId = (() => {
            if (deviceOverride === 'auto') return null;
            if (typeof deviceOverride === 'string' && deviceOverride) return deviceOverride;
            if (activeCameraId && activeCameraId !== 'auto') return activeCameraId;
            if (preferredCameraId) return preferredCameraId;
            return null;
        })();

        const videoConstraints = desiredDeviceId
            ? { deviceId: { exact: desiredDeviceId } }
            : { facingMode: { ideal: 'environment' } };

        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: videoConstraints,
            });

            setCameraPermission('granted');
            setIsCameraReady(true);

            if (deviceOverride && deviceOverride !== 'auto') {
                setActiveCameraId(deviceOverride);
            }

            await refreshAvailableCameras();

            return true;
        } catch (error) {
            console.error('Camera initialization failed:', error);
            const message = formatCameraError(error, 'Unable to start the camera.');
            setScanError(message);
            toast.error('Camera access failed', { description: message });

            if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') {
                setCameraPermission('denied');
            }

            setIsCameraReady(false);
            return false;
        } finally {
            setIsCameraInitializing(false);
            if (stream) {
                stream.getTracks().forEach((track) => track.stop());
            }
        }
    }, [activeCameraId, preferredCameraId, isCameraInitializing, refreshAvailableCameras]);

    useEffect(() => {
        refreshAvailableCameras();
    }, [refreshAvailableCameras]);

    useEffect(() => {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices) return undefined;

        const handleDeviceChange = () => {
            refreshAvailableCameras();
        };

        if (navigator.mediaDevices.addEventListener) {
            navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
            return () => navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
        }

        const originalHandler = navigator.mediaDevices.ondevicechange;
        navigator.mediaDevices.ondevicechange = handleDeviceChange;

        return () => {
            if (navigator.mediaDevices.ondevicechange === handleDeviceChange) {
                navigator.mediaDevices.ondevicechange = originalHandler ?? null;
            }
        };
    }, [refreshAvailableCameras]);

    const handleCameraChange = useCallback((value) => {
        setActiveCameraId(value);
        setIsCameraReady(false);
        ensureCameraAccess(value);
    }, [ensureCameraAccess, setIsCameraReady]);

    const handleScan = useCallback(async (detectedCodes) => {
        const code = extractCode(detectedCodes);

        if (!code) {
            setScanError('Invalid QR code format');
            return;
        }

        const now = Date.now();
        const timeSinceLastScan = now - lastScanRef.current.timestamp;

        if (lastScanRef.current.code === code && timeSinceLastScan < 3000) {
            const remainingCooldown = Math.ceil((3000 - timeSinceLastScan) / 1000);
            toast.info(`Please wait ${remainingCooldown}s before scanning again`);
            return;
        }

        lastScanRef.current = {
            code,
            timestamp: now
        };

        setIsScanProcessing(true);
        setScanError(null);

        let countdown = 3;
        setScanCooldown(countdown);
        const cooldownInterval = setInterval(() => {
            countdown -= 1;
            setScanCooldown(countdown);
            if (countdown <= 0) {
                clearInterval(cooldownInterval);
            }
        }, 1000);

        try {
            const guests = await performSearch(code, { viaScan: true });

            if (guests.length === 1) {
                setTimeout(() => {
                    setIsScannerOpen(false);
                    setSearchMode('manual');
                    setIsScanProcessing(false);
                    setIsCameraReady(false);
                    setIsCameraInitializing(false);
                }, 800);
            } else {
                setIsScanProcessing(false);
            }
        } catch (error) {
            console.error('Scan processing error:', error);
            setIsScanProcessing(false);
            setScanError(error.message || 'Failed to process scan');
        }
    }, [performSearch]);

    const handleScannerError = useCallback((error) => {
        console.error('QR Scanner error:', error);
        const errorMessage = formatCameraError(error, 'Scanner error occurred.');

        if (error?.name === 'NotAllowedError' || errorMessage.includes('denied')) {
            setCameraPermission('denied');
        }

        setIsCameraReady(false);
        setScanError(errorMessage);
        toast.error('Scanner Error', { description: errorMessage });
    }, [setCameraPermission, setIsCameraReady]);

    useEffect(() => {
        if (selectedGuest) return;

        if (debouncedSearchTerm) {
            performSearch(debouncedSearchTerm);
        } else {
            setResults([]);
            setIsSearching(false);
            setNetworkError(null);
        }
    }, [debouncedSearchTerm, performSearch, selectedGuest]);

    useEffect(() => {
        if (!lastCheckIn) return;
        setUndoTimeLeft(30);
        const timer = setInterval(() => {
            setUndoTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    setLastCheckIn(null);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [lastCheckIn]);

    useEffect(() => {
        return () => {
            setScanCooldown(0);
        };
    }, []);

    const handlePrepareCheckIn = useCallback(() => {
        if (!selectedGuest) return;
        setShowConfirmModal(true);
    }, [selectedGuest]);

    // FIXED: Ensure guest ID is passed correctly
    const handleConfirmCheckIn = async () => {
        const rawGuestId = selectedGuest?.id ?? selectedGuest?.displayId ?? null;
        const guestId = rawGuestId != null ? String(rawGuestId).trim() : '';

        if (!selectedGuest || !guestId) {
            toast.error('Invalid guest ID', { description: 'Please select a guest again.' });
            setShowConfirmModal(false);
            return;
        }

        setShowConfirmModal(false);

        const remainingSpots = Math.max(0, (selectedGuest.plusOnesAllowed ?? 0) - (selectedGuest.plusOnesCheckedIn ?? 0));
        const normalizedPlusOnes = Math.min(Math.max(plusOnes, 0), remainingSpots);

        // FIXED: Make sure we're passing the correct guest ID
        console.log('Checking in guest:', guestId, 'with plus ones:', normalizedPlusOnes);

        const promise = apiCheckInGuest(guestId, normalizedPlusOnes);

        toast.promise(promise, {
            loading: 'Checking in guest...',
            success: (data) => {
                setLastCheckIn({
                    guestName: `${selectedGuest.firstName} ${selectedGuest.lastName}`,
                    confirmationCode: data.confirmationCode || selectedGuest.confirmationCode || guestId
                });
                setSelectedGuest(null);
                setPlusOnes(0);
                setResults([]);
                setSearchTerm('');
                setIsScannerOpen(false);
                return `${selectedGuest.firstName} and ${normalizedPlusOnes} guest(s) checked in successfully!`;
            },
            error: (err) => {
                console.error('Check-in error:', err);
                return `Check-in failed: ${err.message}`;
            },
        });
    };

    const handleUndoCheckIn = async () => {
        if (!lastCheckIn) return;
        const promise = apiUndoCheckIn(lastCheckIn.confirmationCode);
        toast.promise(promise, {
            loading: 'Undoing check-in...',
            success: (data) => {
                setLastCheckIn(null);
                return data.message;
            },
            error: (err) => `Undo failed: ${err.message}`,
        });
    };

    const resetState = useCallback(() => {
        setSearchTerm('');
        setResults([]);
        setSelectedGuest(null);
        setPlusOnes(0);
        setIsScannerOpen(false);
        setScanError(null);
        setIsCameraReady(false);
        setIsCameraInitializing(false);
        setCameraPermission('unknown');
        setActiveCameraId('auto');
        setIsScanProcessing(false);
        setScanCooldown(0);
        setSearchMode('manual');
        setShowConfirmModal(false);
        setNetworkError(null);
        lastScanRef.current = { code: '', timestamp: 0 };
        searchInputRef.current?.focus();
    }, []);

    const toggleScanner = useCallback(() => {
        if (isScannerOpen) {
            setIsScannerOpen(false);
            setSearchMode('manual');
            setScanError(null);
            setIsCameraReady(false);
            setIsCameraInitializing(false);
            setScanCooldown(0);
            return;
        }

        if (isScanProcessing || selectedGuest || isCameraInitializing) {
            return;
        }

        ensureCameraAccess()
            .then((granted) => {
                if (!granted) return;
                setIsScannerOpen(true);
                setSearchMode('scan');
                setSearchTerm('');
                setResults([]);
                setScanError(null);
            })
            .catch((error) => {
                console.error('Failed to initialise camera before opening scanner:', error);
            });
    }, [ensureCameraAccess, isCameraInitializing, isScanProcessing, isScannerOpen, selectedGuest]);

    const allowedPlusOnes = selectedGuest?.plusOnesAllowed ?? 0;
    const alreadyChecked = selectedGuest?.plusOnesCheckedIn ?? 0;
    const remainingPlusOnes = Math.max(0, allowedPlusOnes - alreadyChecked);

    const handlePlusOnesChange = (value) => {
        if (!selectedGuest) return;
        const numeric = Number(value);
        if (Number.isNaN(numeric)) {
            setPlusOnes(0);
            return;
        }
        const clamped = Math.min(Math.max(numeric, 0), remainingPlusOnes);
        setPlusOnes(clamped);
    };

    const adjustPlusOnes = useCallback((delta) => {
        if (!selectedGuest) return;
        setPlusOnes((prev) => {
            const next = prev + delta;
            return Math.min(Math.max(next, 0), remainingPlusOnes);
        });
    }, [remainingPlusOnes, selectedGuest]);

    const videoConstraints = useMemo(() => {
        if (activeCameraId && activeCameraId !== 'auto') {
            return { deviceId: { exact: activeCameraId } };
        }
        if (preferredCameraId) {
            return { deviceId: { exact: preferredCameraId } };
        }
        return { facingMode: 'environment' };
    }, [activeCameraId, preferredCameraId]);

    const scannerKey = useMemo(() => {
        if (activeCameraId && activeCameraId !== 'auto') {
            return `scanner-${activeCameraId}`;
        }
        if (preferredCameraId) {
            return `scanner-${preferredCameraId}`;
        }
        return 'scanner-auto';
    }, [activeCameraId, preferredCameraId]);

    const preferredCameraLabel = useMemo(() => {
        if (!preferredCameraId) return null;
        const device = availableCameras.find((camera) => camera.deviceId === preferredCameraId);
        return device?.label ?? null;
    }, [availableCameras, preferredCameraId]);

    const permissionHint = useMemo(() => {
        if (cameraPermission === 'denied') {
            return 'Camera access is blocked. Update your browser permissions to allow camera usage, then reload the page.';
        }
        return 'We need permission to use your camera. When prompted by your browser, choose Allow to start scanning.';
    }, [cameraPermission]);

    const activeCameraLabel = useMemo(() => {
        if (activeCameraId === 'auto') {
            return preferredCameraLabel ? `Auto (${preferredCameraLabel})` : 'Auto (best available)';
        }
        const device = availableCameras.find((camera) => camera.deviceId === activeCameraId);
        return device?.label ?? 'Selected camera';
    }, [activeCameraId, availableCameras, preferredCameraLabel]);

    // BATCH 3: Enhanced keyboard shortcuts with number keys
    useEffect(() => {
        const handleKeyboard = (e) => {
            // Cmd/Ctrl + K - Focus search
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                if (!selectedGuest && !isScannerOpen) {
                    searchInputRef.current?.focus();
                }
            }

            // Cmd/Ctrl + S - Toggle scanner
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                if (!selectedGuest && !isScanProcessing) {
                    toggleScanner();
                }
            }

            // Enter - Confirm check-in
            if (e.key === 'Enter' && selectedGuest && !showConfirmModal) {
                e.preventDefault();
                handlePrepareCheckIn();
            }

            // Escape - Reset/Cancel
            if (e.key === 'Escape') {
                if (showConfirmModal) {
                    setShowConfirmModal(false);
                } else if (selectedGuest) {
                    resetState();
                }
            }

            // BATCH 3: Number keys 0-9 for quick plus-ones adjustment
            if (selectedGuest && !showConfirmModal && e.key >= '0' && e.key <= '9') {
                const num = parseInt(e.key, 10);
                if (num <= remainingPlusOnes) {
                    setPlusOnes(num);
                    toast.success(`Plus-ones set to ${num}`);
                }
            }

            // BATCH 3: Arrow keys for plus-ones
            if (selectedGuest && !showConfirmModal) {
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    adjustPlusOnes(1);
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    adjustPlusOnes(-1);
                }
            }
        };

        window.addEventListener('keydown', handleKeyboard);
        return () => window.removeEventListener('keydown', handleKeyboard);
    }, [
        selectedGuest,
        isScannerOpen,
        isScanProcessing,
        showConfirmModal,
        remainingPlusOnes,
        toggleScanner,
        handlePrepareCheckIn,
        resetState,
        adjustPlusOnes
    ]);

    return (
        <section className="space-y-8 text-slate-100">
            <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-900/90 p-6 shadow-2xl">
                <div className="absolute -top-24 left-10 h-48 w-48 rounded-full bg-emerald-500/15 blur-3xl" />
                <div className="absolute -bottom-32 right-0 h-56 w-56 rounded-full bg-sky-500/10 blur-3xl" />
                <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h1 className="mt-2 text-3xl font-semibold text-white">Guest Check-In</h1>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                        <Button
                            onClick={toggleScanner}
                            variant="outline"
                            disabled={isScanProcessing || !!selectedGuest || isCameraInitializing}
                            className={`w-full rounded-full border-white/20 bg-white/10 text-slate-100 backdrop-blur transition hover:bg-white/20 sm:w-auto ${searchMode === 'scan'
                                ? 'border-emerald-400/60 text-emerald-200 hover:bg-emerald-500/10'
                                : ''
                                } ${(isScanProcessing || selectedGuest || isCameraInitializing)
                                    ? 'cursor-not-allowed opacity-50'
                                    : ''
                                }`}
                        >
                            {isCameraInitializing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Preparing camera...
                                </>
                            ) : isScanProcessing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Processing scan...
                                </>
                            ) : (
                                <>
                                    <Camera className="mr-2 h-4 w-4" />
                                    {searchMode === 'scan' ? 'Close Scanner' : 'Open Scanner'}
                                </>
                            )}
                            {scanCooldown > 0 && !isScanProcessing && (
                                <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/30 text-xs font-bold text-amber-200">
                                    {scanCooldown}
                                </span>
                            )}
                        </Button>

                        {selectedGuest && (
                            <p className="text-xs text-slate-400 sm:hidden">
                                Complete check-in or start new to use scanner
                            </p>
                        )}
                    </div>
                </div>
            </header>

            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <Card className="border border-white/10 bg-slate-950/70 shadow-2xl backdrop-blur">
                    <CardHeader className="pb-4">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-3">
                                <div className="rounded-full bg-white/10 p-2 text-emerald-300">
                                    <Sparkles className="h-4 w-4" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg font-semibold text-white">
                                        {searchMode === 'scan' ? 'QR Scanner' : 'Manual Search'}
                                    </CardTitle>
                                    <p className="text-sm text-slate-400">
                                        {searchMode === 'scan'
                                            ? 'Point camera at QR code to scan'
                                            : 'Search by name, email, phone, or code'}
                                    </p>
                                </div>
                            </div>
                            <Badge
                                variant="outline"
                                className={searchMode === 'scan'
                                    ? 'border-emerald-400/50 bg-emerald-500/10 text-emerald-200'
                                    : 'border-sky-400/50 bg-sky-500/10 text-sky-200'}
                            >
                                {searchMode === 'scan' ? 'Scan Mode' : 'Search Mode'}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-4">
                            {searchMode === 'manual' && (
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                                    <Input
                                        ref={searchInputRef}
                                        type="text"
                                        placeholder="Search by name, email, confirmation code, or phone"
                                        className="h-12 w-full rounded-full border-white/10 bg-white/10 pl-12 text-base text-slate-100 placeholder:text-slate-500"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        disabled={!!selectedGuest}
                                    />
                                    {isSearching && (
                                        <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-emerald-300" />
                                    )}
                                </div>
                            )}

                            {searchMode === 'scan' && (
                                <div className="overflow-hidden rounded-3xl border border-emerald-400/40 bg-emerald-500/10">
                                    <div className="relative h-64 w-full">
                                        {isCameraReady ? (
                                            <ScannerComponent
                                                key={scannerKey}
                                                onScan={handleScan}
                                                onError={handleScannerError}
                                                constraints={videoConstraints}
                                                paused={!isScannerOpen || isScanProcessing}
                                                scanDelay={300}
                                                allowMultiple
                                                styles={{
                                                    container: {
                                                        width: '100%',
                                                        height: '100%',
                                                        position: 'relative',
                                                        borderRadius: 'inherit',
                                                        overflow: 'hidden',
                                                    },
                                                    video: {
                                                        width: '100%',
                                                        height: '100%',
                                                        objectFit: 'cover',
                                                    },
                                                }}
                                            />
                                        ) : (
                                            <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-slate-950/80 px-6 text-center">
                                                {isCameraInitializing ? (
                                                    <>
                                                        <Loader2 className="h-12 w-12 animate-spin text-emerald-400" />
                                                        <p className="text-sm font-medium text-emerald-200">Preparing camera...</p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Camera className="h-10 w-10 text-emerald-300" />
                                                        <p className="text-sm font-medium text-emerald-200">{permissionHint}</p>
                                                        <Button
                                                            onClick={() => ensureCameraAccess(activeCameraId)}
                                                            disabled={isCameraInitializing}
                                                            size="sm"
                                                            variant="outline"
                                                            className="mt-2 rounded-full border-emerald-400/60 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20"
                                                        >
                                                            <RefreshCw className="mr-2 h-3 w-3" />
                                                            Retry Camera
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                        <div className="pointer-events-none absolute inset-0 border border-emerald-300/50 mix-blend-screen" />

                                        {isScanProcessing && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
                                                <div className="text-center">
                                                    <Loader2 className="mx-auto h-12 w-12 animate-spin text-emerald-400" />
                                                    <p className="mt-3 text-sm font-medium text-emerald-200">Processing scan...</p>
                                                </div>
                                            </div>
                                        )}

                                        {scanCooldown > 0 && !isScanProcessing && (
                                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-amber-400/60 bg-amber-500/20 px-4 py-2 backdrop-blur-sm">
                                                <div className="flex items-center gap-2 text-sm font-medium text-amber-200">
                                                    <div className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                                                    <span>Wait {scanCooldown}s before next scan</span>
                                                </div>
                                            </div>
                                        )}

                                        {isScanProcessing && (
                                            <div className="pointer-events-none absolute inset-0 animate-pulse bg-emerald-500/20" />
                                        )}
                                    </div>
                                    <div className="space-y-3 px-4 pb-4 pt-3">
                                        <p className="text-xs text-emerald-200/80">
                                            Align the QR code within the frame. We&apos;ll search automatically on detection.
                                        </p>
                                        {scanCooldown > 0 && (
                                            <p className="text-xs text-amber-300/90">
                                                ⏱️ Cooldown active to prevent duplicate scans
                                            </p>
                                        )}
                                        {availableCameras.length > 1 && (
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-200/70">Camera Source</p>
                                                <Select value={activeCameraId} onValueChange={handleCameraChange}>
                                                    <SelectTrigger className="h-9 rounded-full border-emerald-400/50 bg-emerald-500/10 text-xs text-emerald-100">
                                                        <SelectValue placeholder="Select camera" />
                                                    </SelectTrigger>
                                                    <SelectContent className="border border-emerald-500/40 bg-slate-900 text-emerald-100">
                                                        <SelectItem value="auto">
                                                            {preferredCameraLabel ? `Auto (${preferredCameraLabel})` : 'Auto (best available)'}
                                                        </SelectItem>
                                                        {availableCameras
                                                            .filter((device) => device.deviceId)
                                                            .map((device, index) => (
                                                                <SelectItem key={device.deviceId} value={device.deviceId}>
                                                                    {device.label || `Camera ${index + 1}`}
                                                                </SelectItem>
                                                            ))}
                                                    </SelectContent>
                                                </Select>
                                                {activeCameraLabel && (
                                                    <p className="text-[11px] text-emerald-200/60">Active: {activeCameraLabel}</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* BATCH 3: Enhanced error display with retry */}
                            {scanError && (
                                <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3">
                                    <div className="flex items-start gap-3">
                                        <AlertCircle className="h-5 w-5 flex-shrink-0 text-rose-400" />
                                        <p className="flex-1 text-xs text-rose-200">{scanError}</p>
                                    </div>
                                </div>
                            )}

                            {networkError && (
                                <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
                                    <div className="flex items-start gap-3">
                                        <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-400" />
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-amber-200">Connection Issue</p>
                                            <p className="mt-1 text-xs text-amber-300/90">{networkError.message}</p>
                                            <Button
                                                onClick={retrySearch}
                                                disabled={isRetrying}
                                                size="sm"
                                                variant="outline"
                                                className="mt-3 rounded-full border-amber-400/60 bg-amber-400/10 text-amber-100 hover:bg-amber-400/20"
                                            >
                                                {isRetrying ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                                        Retrying...
                                                    </>
                                                ) : (
                                                    <>
                                                        <RefreshCw className="mr-2 h-3 w-3" />
                                                        Retry Search
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
                                <span>{results.length ? 'Matches' : 'Waiting for results'}</span>
                                <span>{results.length} found</span>
                            </div>
                            <div ref={resultsListRef} className="max-h-[460px] space-y-2 overflow-y-auto scr pr-1 [&::-webkit-scrollbar]:w-2
  [&::-webkit-scrollbar-track]:rounded-full
  [&::-webkit-scrollbar-track]:bg-slate-900
  [&::-webkit-scrollbar-thumb]:rounded-full
  [&::-webkit-scrollbar-thumb]:bg-gray-300
  dark:[&::-webkit-scrollbar-track]:bg-neutral-700
  dark:[&::-webkit-scrollbar-thumb]:bg-neutral-500">
                                {isSearching ? (
                                    Array(3).fill(0).map((_, index) => (
                                        <div key={index} className="h-20 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
                                    ))
                                ) : results.length > 0 ? (
                                    results.map((guest, index) => {
                                        const guestKey = getGuestKey(guest) || guest.confirmationCode || guest.email || `guest-${index}`;
                                        const checkedIn = guest.status === 'checked_in';
                                        const isActive = getGuestKey(selectedGuest) === getGuestKey(guest);

                                        return (
                                            <button
                                                type="button"
                                                key={guestKey}
                                                data-guest-id={guestKey}
                                                onClick={() => handleSelectGuest(guest)}
                                                className={`w-full rounded-2xl border px-4 pb-3 pt-4 text-left transition ${isActive
                                                    ? 'border-emerald-400/60 bg-emerald-500/10 shadow-[0_0_30px_rgba(16,185,129,0.15)]'
                                                    : 'border-white/10 bg-slate-900/60 hover:border-emerald-400/40 hover:bg-slate-900/40'
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between gap-4">
                                                    <div>
                                                        <p className="text-sm font-semibold text-white">
                                                            {guest.firstName} {guest.lastName}
                                                        </p>
                                                        <p className="text-xs text-slate-400">{guest.email || 'No email on file'}</p>
                                                        {guest.phone && (
                                                            <p className="text-xs text-slate-500">{guest.phone}</p>
                                                        )}
                                                    </div>
                                                    <Badge
                                                        variant="outline"
                                                        className={checkedIn
                                                            ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-200'
                                                            : 'border-white/20 bg-white/10 text-slate-200'}
                                                    >
                                                        {checkedIn ? 'Checked in' : 'Awaiting'}
                                                    </Badge>
                                                </div>
                                                <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                                                    <span>ID {guest.displayId || guest.confirmationCode || guest.id || guestKey || '—'}</span>
                                                    <span>Plus-ones {guest.plusOnesCheckedIn}/{guest.plusOnesAllowed}</span>
                                                </div>
                                            </button>
                                        );
                                    })
                                ) : (
                                    <Card className="border border-dashed border-white/10 bg-white/5 p-8 text-center text-sm text-slate-400">
                                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
                                            <Search className="h-8 w-8 text-slate-500" />
                                        </div>
                                        <p className="font-medium text-slate-300">
                                            {searchMode === 'scan'
                                                ? 'Ready to Scan'
                                                : 'Start Your Search'}
                                        </p>
                                        <p className="mt-1 text-xs">
                                            {searchMode === 'scan'
                                                ? 'Point camera at a QR code to begin scanning'
                                                : 'Type a name, email, phone number, or confirmation code'}
                                        </p>
                                    </Card>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="flex h-full flex-col border border-white/10 bg-slate-950/70 shadow-2xl backdrop-blur">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-lg font-semibold text-white">Check-in workflow</CardTitle>
                        <p className="mt-1 text-sm text-slate-400">Follow the steps to finalize arrivals and keep totals accurate.</p>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col gap-5">
                        <div className="space-y-5">
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                                <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    <Badge variant="outline" className="border-white/20 bg-white/10 text-slate-200">Step 1</Badge>
                                    Choose a guest
                                </div>
                                {selectedGuest ? (
                                    <div className="mt-4 space-y-3 text-sm text-slate-300/90">
                                        <div className="flex items-baseline justify-between gap-3">
                                            <p className="text-lg font-semibold text-white">
                                                {selectedGuest.firstName} {selectedGuest.lastName}
                                            </p>
                                            <Badge variant="outline" className="border-sky-400/50 bg-sky-500/10 text-sky-200">
                                                {selectedGuest.ticketType}
                                            </Badge>
                                        </div>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                                                <p className="text-xs uppercase tracking-wide text-slate-400">Email</p>
                                                <p className="mt-1 text-white/90">{selectedGuest.email || '—'}</p>
                                            </div>
                                            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                                                <p className="text-xs uppercase tracking-wide text-slate-400">Phone</p>
                                                <p className="mt-1 text-white/90">{selectedGuest.phone || '—'}</p>
                                            </div>
                                        </div>
                                        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm">
                                            <p className="text-xs uppercase tracking-wide text-slate-400">Guest ID</p>
                                            <p className="mt-1 font-mono text-white/90">{selectedGuest.displayId || selectedGuest.confirmationCode || getGuestKey(selectedGuest) || '—'}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-slate-900/50 p-6 text-center text-sm text-slate-400">
                                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
                                            <Users className="h-6 w-6 text-slate-500" />
                                        </div>
                                        <p>Scan a badge or select a guest from the results to begin.</p>
                                    </div>
                                )}
                            </div>

                            <div className={`rounded-2xl border border-white/10 p-5 ${selectedGuest ? 'bg-white/5' : 'bg-slate-900/40'}`}>
                                <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    <Badge variant="outline" className="border-white/20 bg-white/10 text-slate-200">Step 2</Badge>
                                    Confirm plus-ones
                                </div>
                                {selectedGuest ? (
                                    <div className="mt-4 space-y-3">
                                        <div className="flex items-center gap-3 text-xs text-slate-400">
                                            <Badge variant="outline" className="border-emerald-400/50 bg-emerald-500/10 text-emerald-200">
                                                Plus-ones {alreadyChecked}/{allowedPlusOnes}
                                            </Badge>
                                            <span>
                                                {remainingPlusOnes > 0 ? `${remainingPlusOnes} remaining` : 'Limit reached'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Button
                                                type="button"
                                                size="icon"
                                                variant="outline"
                                                onClick={() => adjustPlusOnes(-1)}
                                                disabled={plusOnes <= 0}
                                                className="h-11 w-11 rounded-full border-white/20 bg-white/10 text-white hover:bg-white/20"
                                            >
                                                <Minus className="h-4 w-4" />
                                            </Button>
                                            <Input
                                                id="plusOnes"
                                                type="number"
                                                min="0"
                                                max={remainingPlusOnes}
                                                value={plusOnes}
                                                onChange={(e) => handlePlusOnesChange(e.target.value)}
                                                className="h-11 w-28 rounded-2xl border-white/10 bg-slate-900/60 text-center text-lg text-white"
                                            />
                                            <Button
                                                type="button"
                                                size="icon"
                                                variant="outline"
                                                onClick={() => adjustPlusOnes(1)}
                                                disabled={plusOnes >= remainingPlusOnes}
                                                className="h-11 w-11 rounded-full border-white/20 bg-white/10 text-white hover:bg-white/20"
                                            >
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <p className="text-xs text-slate-400">
                                            {remainingPlusOnes > 0
                                                ? `You can add up to ${remainingPlusOnes} more guest${remainingPlusOnes === 1 ? '' : 's'}. Use number keys 0-9 or arrow keys.`
                                                : 'All plus-one spots have been used.'}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-slate-900/50 p-6 text-center text-sm text-slate-400">
                                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
                                            <UserCheck className="h-6 w-6 text-slate-500" />
                                        </div>
                                        <p>Select a guest to unlock plus-one controls.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mt-auto space-y-4">
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <Button
                                    onClick={handlePrepareCheckIn}
                                    size="lg"
                                    disabled={!selectedGuest}
                                    className="flex-1 rounded-full py-2.5 bg-emerald-500 text-emerald-950 hover:bg-emerald-400 disabled:opacity-40"
                                >
                                    <UserCheck className="mr-2 h-5 w-5" />
                                    Confirm check-in
                                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-600/90 px-2 py-1 text-xs text-emerald-100">
                                        <Users className="h-3.5 w-3.5" />
                                        {selectedGuest ? 1 + Number(plusOnes) : 0}
                                    </span>
                                </Button>
                                <Button
                                    onClick={resetState}
                                    size="lg"
                                    variant="outline"
                                    className="rounded-full border-white/20 bg-white/5 text-slate-200 hover:bg-white/15"
                                >
                                    Start new check-in
                                </Button>
                            </div>
                            {selectedGuest && (
                                <p className="text-xs text-slate-500">
                                    Tip: Press <kbd className="rounded bg-white/10 px-1.5 py-0.5">Enter</kbd> to check in,
                                    <kbd className="ml-1 rounded bg-white/10 px-1.5 py-0.5">0-9</kbd> for plus-ones, or
                                    <kbd className="ml-1 rounded bg-white/10 px-1.5 py-0.5">Esc</kbd> to cancel
                                </p>
                            )}
                            {!selectedGuest && (
                                <p className="text-xs text-slate-500">
                                    Tip: Keep the scanner open to capture the next guest instantly.
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* BATCH 2: Check-in Confirmation Modal */}
            <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
                <DialogContent className="border border-white/10 bg-slate-950 text-slate-100 sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-semibold text-white">
                            Confirm Check-In
                        </DialogTitle>
                        <DialogDescription className="text-slate-400">
                            Please verify the details before completing check-in.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedGuest && (
                        <div className="space-y-4 py-4">
                            <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-lg font-semibold text-white">
                                            {selectedGuest.firstName} {selectedGuest.lastName}
                                        </p>
                                        <p className="mt-1 text-sm text-slate-400">{selectedGuest.email}</p>
                                        {selectedGuest.phone && (
                                            <p className="text-sm text-slate-400">{selectedGuest.phone}</p>
                                        )}
                                    </div>
                                    <Badge variant="outline" className="border-sky-400/50 bg-sky-500/10 text-sky-200">
                                        {selectedGuest.ticketType}
                                    </Badge>
                                </div>
                            </div>

                            <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-slate-400">Primary Guest</span>
                                    <span className="font-semibold text-white">1</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-slate-400">Plus-Ones</span>
                                    <span className="font-semibold text-white">{plusOnes}</span>
                                </div>
                                <div className="border-t border-white/10 pt-3">
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold text-white">Total Party Size</span>
                                        <span className="flex items-center gap-2 text-xl font-bold text-emerald-400">
                                            <Users className="h-5 w-5" />
                                            {1 + Number(plusOnes)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3 text-center">
                                <p className="text-xs uppercase tracking-wide text-slate-400">Guest ID</p>
                                <p className="mt-1 font-mono text-sm font-semibold text-white">
                                    {selectedGuest.displayId || selectedGuest.confirmationCode || getGuestKey(selectedGuest) || '—'}
                                </p>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-3 sm:gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowConfirmModal(false)}
                            className="flex-1 rounded-full border-white/20 bg-white/5 text-slate-200 hover:bg-white/15"
                        >
                            <X className="mr-2 h-4 w-4" />
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={handleConfirmCheckIn}
                            className="flex-1 rounded-full bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                        >
                            <Check className="mr-2 h-4 w-4" />
                            Confirm Check-In
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* BATCH 3: Fixed Bottom-Right Undo Card */}
            {lastCheckIn && (
                <div className="fixed bottom-6 right-6 z-50 animate-slide-in-up">
                    <Card className={`border bg-emerald-500/10 text-emerald-100 shadow-2xl backdrop-blur-xl ${undoTimeLeft <= 10 ? 'animate-pulse border-amber-400/60' : 'border-emerald-400/60'
                        }`}>
                        <CardContent className="flex items-center gap-4 p-4">
                            <div className="flex-1">
                                <p className="text-sm font-semibold">✓ Checked in {lastCheckIn.guestName}</p>
                                <p className={`text-xs ${undoTimeLeft <= 10 ? 'text-amber-200' : 'text-emerald-200/80'
                                    }`}>
                                    {undoTimeLeft <= 10 ? '⚠️ ' : ''}Undo available for {undoTimeLeft}s
                                </p>
                            </div>
                            <Button
                                onClick={handleUndoCheckIn}
                                size="sm"
                                variant="outline"
                                className="rounded-full border-emerald-400/60 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/20"
                            >
                                <Undo2 className="mr-2 h-4 w-4" /> Undo
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}
        </section>
    );
}

export default function ProtectedUsherDashboard() {
    return (
        <RouteGuard requiredRole="usher">
            <MainLayout>
                <UsherDashboard />
            </MainLayout>
        </RouteGuard>
    );
}