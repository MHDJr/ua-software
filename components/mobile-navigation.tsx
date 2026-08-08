"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
    Home,
    FileText,
    MessageSquare,
    User,
    BarChart3,
    Wallet,
} from "lucide-react";

interface MobileNavigationProps {
    currentPage?: string;
}

export default function MobileNavigation({ currentPage }: MobileNavigationProps) {
    const router = useRouter();
    const { profile } = useAuth();
    const [mobileNavTab, setMobileNavTab] = useState(currentPage || "home");

    // Update active tab when currentPage prop changes
    useEffect(() => {
        if (currentPage) {
            setMobileNavTab(currentPage);
        }
    }, [currentPage]);

    const handleScrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };


    const navItems = [
        { 
            id: "home", 
            label: "Home", 
            icon: Home, 
            action: () => {
                if (window.location.pathname === '/staff') {
                    handleScrollToTop();
                } else {
                    router.push('/staff');
                }
            }
        },
        ...(profile?.role === "ceo" || (profile?.is_manager && (profile?.department === "Sales" || profile?.manager_permissions?.sales_permission === "edit" || profile?.manager_permissions?.can_update_staff_sales))
            ? [{ id: "sales", label: "Sales Ops", icon: BarChart3, href: "/sales" }]
            : profile?.department === "Finance" || profile?.role === "accounts"
            ? [{ id: "accounts", label: "Accounts", icon: Wallet, href: "/accounts" }]
            : []),
        { id: "profile", label: "Profile", icon: User, action: () => {
            if (typeof window !== "undefined") {
                window.dispatchEvent(new Event('open-profile-dialog'));
            }
        } },
    ];

    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50">
            <div className="bg-white/80 backdrop-blur-xl border-t border-white/20 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] px-4 pb-safe">
                <div className="flex items-center justify-around py-2">
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => {
                                setMobileNavTab(item.id);
                                if (item.href) {
                                    router.push(item.href);
                                } else if (item.action) {
                                    item.action();
                                }
                            }}
                            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-all min-h-[56px] justify-center ${
                                mobileNavTab === item.id
                                    ? "text-[#2C2171]"
                                    : "text-slate-400"
                            }`}
                        >
                            <item.icon className={`w-5 h-5 transition-all ${
                                mobileNavTab === item.id ? "scale-110" : ""
                            }`} style={{
                                color: mobileNavTab === item.id ? "#2C2171" : undefined
                            }} />
                            <span className="text-[9px] font-black uppercase tracking-wider">
                                {item.label}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </nav>
    );
}
