import "./globals.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/lib/auth-context";
import { FocusProvider } from "@/lib/focus-context";
import { QueryProvider } from "@/lib/query-provider";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { NetworkStatusProvider } from "@/components/network-status-provider";
import { TabResiliencyEngine } from "@/components/tab-resiliency-engine";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import dynamic from "next/dynamic";

import PushNotificationPromptModal from "@/components/PushNotificationPromptModal";

const CommandBar = dynamic(() => import("@/components/command-bar"), {
    ssr: false,
});

export const metadata: Metadata = {
    title: "Usthad Academy - Executive Command",
    description: "Cyber-Enhanced CEO Command Center for Usthad Academy",
    manifest: "/manifest.json?v=2",
    appleWebApp: {
        statusBarStyle: "black-translucent",
        title: "UA Command",
    },
    icons: {
        apple: "/logo.png",
    },
};

export const viewport: Viewport = {
    themeColor: "#030712",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <meta name="mobile-web-app-capable" content="yes" />
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
              try {
                const storedTheme = localStorage.getItem("ceo-dashboard-theme");
                if (storedTheme === "dark") {
                  document.documentElement.setAttribute("data-theme", "dark");
                } else {
                  document.documentElement.removeAttribute("data-theme");
                }
              } catch (e) {}
            `,
                    }}
                />
            </head>
            <body 
                className="font-sans min-h-screen w-full max-w-full overflow-x-hidden bg-background text-foreground antialiased selection:bg-primary/30 selection:text-primary-foreground"
            >
                <ErrorBoundary>
                    <NetworkStatusProvider>
                        <ThemeProvider>
                            <FocusProvider>
                                <QueryProvider>
                                    <AuthProvider>
                                        <TabResiliencyEngine>
                                            {children}
                                            <MobileBottomNav />
                                            {process.env.NEXT_PUBLIC_ENABLE_V2_FEATURES === "true" && <CommandBar />}
                                            <PushNotificationPromptModal />
                                        </TabResiliencyEngine>
                                        <Toaster
                                            position="top-right"
                                            theme="dark"
                                            toastOptions={{
                                                className:
                                                    "border-primary/20 bg-card/80 backdrop-blur-md text-foreground",
                                            }}
                                        />
                                    </AuthProvider>
                                </QueryProvider>
                            </FocusProvider>
                        </ThemeProvider>
                    </NetworkStatusProvider>
                </ErrorBoundary>
            </body>
        </html>
    );
}
