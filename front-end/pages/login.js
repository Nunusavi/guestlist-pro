import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/router';
import { toast } from 'sonner';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useAuth } from '@/context/AuthContext';
import { apiLogin } from '@/lib/api';
import { Check, Loader2 } from 'lucide-react';
import { Playfair_Display } from 'next/font/google';

const heroFont = Playfair_Display({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
    variable: '--font-hero-display',
});

const formSchema = z.object({
    username: z.string().min(1, { message: "Username is required." }),
    password: z.string().min(1, { message: "Password is required." }),
});

const highlights = [
    "Real-time guest analytics",
    "Fast QR and badge scanning",
    "Seamless team coordination",
];

export default function LoginPage() {
    const { login, isAuthenticated, user, loading } = useAuth();
    const router = useRouter();

    const form = useForm({
        resolver: zodResolver(formSchema),
        defaultValues: {
            username: "",
            password: "",
        },
    });

    // Redirect if already logged in
    useEffect(() => {
        if (!loading && isAuthenticated && user) {
            const role = user.role?.toLowerCase();
            const destination = role === 'admin' ? '/admin' : '/usher';

            if (router.pathname !== destination) {
                router.replace(destination);
            }
        }
    }, [isAuthenticated, user, loading, router]);

    async function onSubmit(values) {
        try {
            const data = await apiLogin(values.username, values.password);
            login(data.user, data.token, data.refreshToken);
            toast.success("Success", {
                description: "You have been logged in successfully.",
            });
        } catch (error) {
            toast.error("Login Failed", {
                description: error.message || "Invalid credentials. Please try again.",
            });
        }
    }

    if (loading || isAuthenticated) {
        return (
            <div className="flex min-h-screen w-full items-center justify-center bg-slate-950">
                <Loader2 className="h-12 w-12 animate-spin text-slate-300" />
            </div>
        );
    }

    return (
        <main className="grid min-h-screen grid-cols-1 bg-slate-950 text-slate-100 lg:grid-cols-[1.05fr_0.95fr]">
            <section className={`${heroFont.className} relative hidden overflow-hidden border-r border-white/10 lg:flex lg:flex-col lg:justify-between`}>
                <div className="absolute inset-0">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),transparent_55%),radial-gradient(circle_at_bottom,_rgba(59,130,246,0.1),transparent_60%)]" />
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 opacity-90" />
                    <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xl" />
                </div>

                <div className="relative flex flex-1 flex-col justify-center gap-12 px-16 pb-24 pt-28">
                    <div className="space-y-6">
                        <div className='relative'>
                            <span className="animate-pulse w-1/3 absolute -inset-1 rounded-full bg-gradient-to-r from-emerald-400/30 via-sky-400/20 to-white/10 blur-md"></span>
                            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-lg font-semibold uppercase tracking-[0.35em] text-white/70">
                                GuestList Pro
                            </span>
                        </div>
                        <div className="space-y-4">
                            <h1 className="text-4xl font-semibold leading-tight text-white lg:text-5xl">
                                Elevate arrivals with precision and grace.
                            </h1>
                            <p className="max-w-lg text-sm leading-relaxed text-white/70">
                                Empower front-of-house teams with a real-time command center for check-ins, guest insights, and seamless collaboration across every entrance.
                            </p>
                        </div>
                    </div>

                    <div className="grid gap-4 text-sm text-white/80">
                        {highlights.map((item) => (
                            <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-200">
                                    <Check className="h-4 w-4" />
                                </span>
                                <span>{item}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="relative border-t border-white/10 px-16 py-10 text-sm text-white/50">
                    <a href="">Developed by <a href='https://natemes.com'>Nate</a></a>
                </div>
            </section>

            <section className="flex flex-col items-center gap-7 justify-center py-10 lg:px-6">
                <span className="relative block lg:hidden">
                    <span className="animate-pulse absolute -inset-1 rounded-full bg-gradient-to-r from-emerald-400/30 via-sky-400/20 to-white/10 blur-md"></span>
                    <span className={`${heroFont.className} z-10 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-gradient-to-r from-emerald-400/20 via-sky-400/10 to-white/5 px-6 py-2 text-2xl font-extrabold uppercase tracking-[0.35em] text-white shadow-lg shadow-emerald-400/10`}>
                        <Check className="h-8 w-8 p-1 border rounded-4xl text-emerald-400" />
                        Guest List
                    </span>
                </span>
                <div className="absolute top-0 left-0 h-50 w-50 rounded-full bg-emerald-400/20 blur-3xl" />
                <Card className="relative w-full max-w-11/12 sm:max-w-screen overflow-hidden border-0 bg-slate-900/20 text-white ">
                    <CardHeader className="relative z-10 text-center">
                        <CardTitle className="text-3xl animate-pulse shadow-2xl  font-extrabold ">Welcome</CardTitle>
                        <CardDescription className="text-base text-slate-600">
                            <span className="font-bold text-emerald-400">Sign in!</span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="relative z-10">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 group">
                                <FormField
                                    control={form.control}
                                    name="username"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-sm font-medium text-slate-100">Username</FormLabel>
                                            <FormControl>
                                                    <Input
                                                        autoComplete="username"
                                                        placeholder="Enter your username"
                                                        {...field}
                                                        className="h-11 rounded-xl border-slate-200 focus:"
                                                    />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="password"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-sm font-medium text-slate-100">Password</FormLabel>
                                            <FormControl>
                                                    <Input
                                                        type="password"
                                                        autoComplete="current-password"
                                                        placeholder="********"
                                                        {...field}
                                                        className="h-11 rounded-xl border-slate-200 focus:outline-none focus:border-transparent transition-all"
                                                    />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button
                                    type="submit"
                                    className="h-11 w-full rounded-full bg-slate-900 text-white hover:bg-slate-800"
                                    disabled={form.formState.isSubmitting}
                                >
                                    {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Sign in
                                </Button>
                            </form>
                        </Form>
                        <div className="mt-8 grid gap-4 rounded-2xl bg-white/10 p-4 text-xs border-0 text-slate-500">
                            <div className="flex items-center justify-between">
                                <span className="font-medium text-slate-100">Need support?</span>
                                <span className='text-slate-100'>Contact your site admin</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <div className="absolute -bottom-0 right-0 h-40 w-40 rounded-full bg-sky-400/20 blur-2xl" />
            </section>
        </main>
    );
}