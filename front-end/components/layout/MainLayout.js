import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { ChevronDown, LogOut, Menu, UserCircle } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function MainLayout({ children }) {
    const { user, logout } = useAuth();
    const router = useRouter();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const desktopProfileRef = useRef(null);
    const mobileProfileRef = useRef(null);

    useEffect(() => {
        const handleRouteChange = () => {
            setIsMobileMenuOpen(false);
            setIsProfileMenuOpen(false);
        };
        router.events.on("routeChangeComplete", handleRouteChange);
        router.events.on("hashChangeComplete", handleRouteChange);

        return () => {
            router.events.off("routeChangeComplete", handleRouteChange);
            router.events.off("hashChangeComplete", handleRouteChange);
        };
    }, [router.events]);

    useEffect(() => {
        if (!isMobileMenuOpen) {
            setIsProfileMenuOpen(false);
        }
    }, [isMobileMenuOpen]);

    useEffect(() => {
        if (!isProfileMenuOpen) return;

        const handlePointerDown = (event) => {
            const desktopContains = desktopProfileRef.current?.contains(event.target);
            const mobileContains = mobileProfileRef.current?.contains(event.target);

            if (!desktopContains && !mobileContains) {
                setIsProfileMenuOpen(false);
            }
        };

        document.addEventListener("pointerdown", handlePointerDown);
        return () => document.removeEventListener("pointerdown", handlePointerDown);
    }, [isProfileMenuOpen]);

    const navItems = [
        { href: "/usher", label: "Check-In" },
        { href: "/guests", label: "Guest List" },
    ];

    const displayName = user?.fullName || user?.username || "Guest";

    const renderNavLink = (item) => {
        const isActive = router.pathname.startsWith(item.href);
        return (
            <Link
                key={item.href}
                href={item.href}
                onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsProfileMenuOpen(false);
                }}
                className={cn(
                    "flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium",
                    "text-slate-300 transition-all duration-200",
                    "hover:bg-slate-800/80 hover:text-white",
                    isActive && "bg-slate-800 text-white"
                )}
            >
                <span>{item.label}</span>
                <span
                    className={cn(
                        "h-2 w-2 rounded-full transition-colors",
                        isActive ? "bg-emerald-400" : "bg-slate-700"
                    )}
                />
            </Link>
        );
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 font-fancy ">
            <header className="sticky top-0 z-40 border-b border-white/5 bg-slate-950/45 backdrop-blur">
                <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-1 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center justify-between gap-4">
                        <Link href="/" className="flex items-center gap-3 text-lg font-semibold font-fancy">
                            <div className="flex flex-col">
                                <span className=" font-semibold">Guest-List Pro</span>
                            </div>
                        </Link>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="md:hidden"
                            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                            aria-label="Toggle menu"
                        >
                            <Menu className="h-5 w-5" />
                        </Button>
                    </div>
                    <div className="hidden flex-1 md:flex md:items-center md:justify-end md:gap-4">
                        <nav className="flex items-center gap-2">
                            {navItems.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        "rounded-xl px-2.5 py-3.5 text-sm font-medium transition-all",
                                        "text-slate-300 hover:bg-slate-800 hover:text-white",
                                        router.pathname.startsWith(item.href) && "bg-slate-800 text-white",
                                        "font-fancy"
                                    )}
                                >
                                    {item.label}
                                </Link>
                            ))}
                        </nav>
                        <div className="relative" ref={desktopProfileRef}>
                            <Card
                                role="button"
                                tabIndex={0}
                                aria-expanded={isProfileMenuOpen}
                                onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault();
                                        setIsProfileMenuOpen((prev) => !prev);
                                    }
                                    if (event.key === "Escape") {
                                        setIsProfileMenuOpen(false);
                                    }
                                }}
                                className={cn(
                                    "flex flex-row items-center gap-3 rounded-2xl border-0 bg-slate-950 px-4 py-3 text-sm text-slate-200",
                                    "cursor-pointer transition hover:border-emerald-500/40 hover:bg-slate-900",
                                    "font-fancy"
                                )}
                            >
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800">
                                    <UserCircle className="h-5 w-5 text-slate-200" />
                                </div>
                                <div className="flex flex-col text-left">
                                    <span className="font-semibold text-white font-fancy">{displayName}</span>
                                    <span className="text-xs text-slate-400">Tap to manage</span>
                                </div>
                                <ChevronDown
                                    className={cn(
                                        "ml-1 h-4 w-4 text-slate-400 transition-transform",
                                        isProfileMenuOpen ? "rotate-180" : "rotate-0"
                                    )}
                                />
                            </Card>
                            {isProfileMenuOpen && (
                                <div className="absolute right-0 top-full z-40 mt-2 w-48 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 shadow-lg backdrop-blur">
                                    <Button
                                        variant="ghost"
                                        className="flex w-full items-center justify-start gap-2 rounded-none px-4 py-3 text-sm text-slate-100 hover:bg-slate-800 font-fancy"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            setIsProfileMenuOpen(false);
                                            logout();
                                        }}
                                    >
                                        <LogOut className="h-4 w-4" />
                                        Logout
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                {isMobileMenuOpen && (
                    <div className="border-t border-white/5 bg-slate-950/95 px-4 pb-6 md:hidden">
                        <div className="flex flex-col gap-4">
                            <nav className="flex flex-col gap-2">{navItems.map(renderNavLink)}</nav>
                            <div ref={mobileProfileRef}>
                                <Card
                                    role="button"
                                    tabIndex={0}
                                    aria-expanded={isProfileMenuOpen}
                                    onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                            event.preventDefault();
                                            setIsProfileMenuOpen((prev) => !prev);
                                        }
                                        if (event.key === "Escape") {
                                            setIsProfileMenuOpen(false);
                                        }
                                    }}
                                    className={cn(
                                        "space-y-4 rounded-3xl border-white/10 bg-slate-900/80 p-4 text-sm text-slate-200",
                                        "cursor-pointer transition hover:border-emerald-500/40 hover:bg-slate-900",
                                        "font-fancy"
                                    )}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800">
                                            <UserCircle className="h-6 w-6 text-slate-200" />
                                        </div>
                                        <div className="flex flex-1 flex-col text-sm">{displayName}</div>
                                        <ChevronDown
                                            className={cn(
                                                "h-5 w-5 text-slate-400 transition-transform",
                                                isProfileMenuOpen ? "rotate-180" : "rotate-0"
                                            )}
                                        />
                                    </div>
                                    {isProfileMenuOpen && (
                                        <Button
                                            variant="outline"
                                            className="w-full justify-center border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setIsProfileMenuOpen(false);
                                                setIsMobileMenuOpen(false);
                                                logout();
                                            }}
                                        >
                                            <LogOut className="mr-2 h-4 w-4" />
                                            Logout
                                        </Button>
                                    )}
                                </Card>
                            </div>
                        </div>
                    </div>
                )}
            </header>
            <main className="pb-16 pt-6">
                <div className="mx-auto w-full max-w-6xl px-1">
                    <div className="rounded-3xl border-0 bg-slate-950 shadow-[0_18px_48px_-22px_rgb(15_23_42/0.85)] backdrop-blur">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
}