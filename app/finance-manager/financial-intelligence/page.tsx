"use client";

/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
    Wallet,
    TrendingUp,
    Landmark,
    ReceiptText,
    ArrowUpRight,
    ArrowDownRight,
    Calendar,
    CheckCircle2,
    Clock,
    Activity,
    BarChart3,
    DollarSign,
    Building,
    Target,
    AlertTriangle,
    Sparkles,
    Zap,
    Home,
    FileText,
    Loader2,
    LayoutDashboard,
    LogOut,
    CheckCircle,
    Loader
} from "lucide-react";
import { jsPDF } from "jspdf";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { MobileFAB } from "@/components/mobile-fab";
import { CEOSidebar } from "@/components/ceo-sidebar";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// Types
interface DailyMetrics {
    uloomxIncome: number;
    usthadIncome: number;
    combinedExpense: number;
    netProfit: number;
}

interface MonthlyMetrics {
    uloomxTotal: number;
    usthadTotal: number;
    totalExpense: number;
    balance: number;
}

interface Transmission {
    id: string;
    date: string;
    uloomxIncome: number;
    usthadIncome: number;
    expenses: number;
    revenue: number;
    status: "approved" | "pending";
}

interface ChartData {
    date: string;
    uloomx: number;
    usthad: number;
    total: number;
    netBalance: number;
}

// Format currency helper (Indian Rupees)
const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
};

const formatCurrencyPDF = (amount: number) => {
    return formatCurrency(amount).replace("₹", "Rs. ");
};

// Generate chart data from real financial entries
const generateChartData = (entries: any[]): ChartData[] => {
    const data: ChartData[] = [];
    const today = new Date();
    
    for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        // Find entries for this date
        const dayEntries = entries.filter(entry => 
            new Date(entry.entry_date).toISOString().split('T')[0] === dateStr
        );
        
        // Sum up values for this date
        const uloomx = dayEntries.reduce((sum, entry) => sum + (parseFloat(entry.uloomx_income) || 0), 0);
        const usthad = dayEntries.reduce((sum, entry) => sum + (parseFloat(entry.usthad_income) || 0), 0);
        const total = uloomx + usthad;
        const expenses = dayEntries.reduce((sum, entry) => sum + (parseFloat(entry.total_expenses) || 0), 0);
        const netBalance = total - expenses;
        
        data.push({
            date: dateStr,
            uloomx,
            usthad,
            total,
            netBalance,
        });
    }
    
    return data;
};

// Metric Card Component - Premium Design
const MetricCard = ({
    title,
    value,
    icon: Icon,
    imageUrl,
    trend,
    trendValue,
    color = "#ff4d00",
}: {
    title: string;
    value: string;
    icon?: React.ElementType;
    imageUrl?: string;
    trend?: "up" | "down";
    trendValue?: string;
    color?: string;
}) => {
    // Get proper icon color and background based on card type
    const getIconStyles = () => {
        switch (color) {
            case "#ff4d00": // Orange - Income cards
                return {
                    bg: "linear-gradient(135deg, #ff4d00 0%, #ff6b35 100%)",
                    iconColor: "#ffffff",
                    shadow: "0 8px 24px rgba(255, 77, 0, 0.35)"
                };
            case "#ef4444": // Red - Expense card
                return {
                    bg: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                    iconColor: "#ffffff",
                    shadow: "0 8px 24px rgba(239, 68, 68, 0.35)"
                };
            case "#10b981": // Green - Profit card
                return {
                    bg: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    iconColor: "#ffffff",
                    shadow: "0 8px 24px rgba(16, 185, 129, 0.35)"
                };
            default:
                return {
                    bg: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`,
                    iconColor: "#ffffff",
                    shadow: `0 8px 24px ${color}40`
                };
        }
    };

    const styles = getIconStyles();

    return (
        <div className="bg-white rounded-[20px] md:rounded-[24px] border border-gray-100 shadow-sm p-4 md:p-6 hover:shadow-lg transition-all duration-300 group">
            <div className="flex items-start justify-between mb-3 md:mb-4">
                <div className={`rounded-xl md:rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-105 overflow-hidden flex-shrink-0 ${
                    imageUrl?.includes('uloomx') ? 'w-12 h-12 md:w-16 md:h-16' : 'w-10 h-10 md:w-14 md:h-14'
                }`}
                     style={{ 
                         background: imageUrl ? 'transparent' : styles.bg,
                         boxShadow: imageUrl ? 'none' : styles.shadow
                     }}>
                    {imageUrl ? (
                        <img 
                            src={imageUrl} 
                            alt={title} 
                            className={`object-contain ${imageUrl?.includes('uloomx') ? 'w-[110%] h-[110%]' : 'w-full h-full'}`}
                        />
                    ) : Icon ? (
                        <Icon className="w-4 h-4 md:w-6 md:h-6" style={{ color: styles.iconColor }} />
                    ) : null}
                </div>
                {trend && trendValue && (
                    <div className={`flex items-center gap-0.5 md:gap-1 text-xs md:text-sm font-bold px-2 md:px-3 py-1 md:py-1.5 rounded-full flex-shrink-0 ${
                        trend === "up" 
                            ? "bg-green-50 text-green-600 border border-green-200" 
                            : "bg-red-50 text-red-500 border border-red-200"
                    }`}>
                        {trend === "up" ? <ArrowUpRight className="w-3 h-3 md:w-4 md:h-4" /> : <ArrowDownRight className="w-3 h-3 md:w-4 md:h-4" />}
                        {trendValue}
                    </div>
                )}
            </div>
            <p className="text-xs md:text-sm text-[#64748b] font-medium mb-1 md:mb-2 truncate">{title}</p>
            <p className="text-xl md:text-3xl font-black text-[#1e293b] truncate">{value}</p>
        </div>
    );
};

// Stacked Area Chart Component with Interactive Tooltips
const StackedAreaChart = ({ data }: { data: ChartData[] }) => {
    const height = 280;
    const width = 900;
    const padding = { top: 40, right: 40, bottom: 60, left: 80 };
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [svgWidth, setSvgWidth] = useState(width);
    const containerRef = React.useRef<HTMLDivElement>(null);

    // Update SVG width on resize for mobile responsiveness
    React.useEffect(() => {
        let isMounted = true;

        const updateWidth = () => {
            if (!isMounted) return;
            if (containerRef.current) {
                const containerWidth = containerRef.current.clientWidth;
                setSvgWidth(Math.min(width, containerWidth));
            }
        };

        updateWidth();

        const handleResize = () => {
            // Debounce resize events
            clearTimeout((handleResize as any)._timeoutId);
            (handleResize as any)._timeoutId = setTimeout(updateWidth, 100);
        };

        window.addEventListener('resize', handleResize);

        return () => {
            isMounted = false;
            window.removeEventListener('resize', handleResize);
            clearTimeout((handleResize as any)._timeoutId);
        };
    }, []);

    // Handle empty data case
    if (!data || data.length === 0) {
        return (
            <div className="relative w-full h-[280px] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <BarChart3 className="w-8 h-8 text-gray-300" />
                    </div>
                    <p className="text-gray-500 font-medium">No financial data available</p>
                    <p className="text-gray-400 text-sm mt-2">Submit financial entries to see trends</p>
                </div>
            </div>
        );
    }

    const maxValue = Math.max(...data.map(d => d.uloomx + d.usthad));

    const createStackedPaths = () => {
        // Usthad layer (bottom - lighter orange)
        const usthadPoints = data.map((point, index) => {
            const x = padding.left + (index / (data.length - 1)) * (width - padding.left - padding.right);
            const y = height - padding.bottom - (point.usthad / maxValue) * (height - padding.top - padding.bottom);
            return { x, y, value: point.usthad };
        });

        // UloomX layer (top - deep orange)
        const uloomxPoints = data.map((point, index) => {
            const x = padding.left + (index / (data.length - 1)) * (width - padding.left - padding.right);
            const stackedValue = point.usthad + point.uloomx;
            const y = height - padding.bottom - (stackedValue / maxValue) * (height - padding.top - padding.bottom);
            return { x, y, value: point.uloomx, baseY: usthadPoints[index].y };
        });

        // Usthad area path
        const usthadAreaPath = `M ${usthadPoints.map(p => `${p.x},${p.y}`).join(' L ')} 
                               L ${usthadPoints[usthadPoints.length - 1].x},${height - padding.bottom} 
                               L ${usthadPoints[0].x},${height - padding.bottom} Z`;

        // UloomX area path
        const uloomxAreaPath = `M ${uloomxPoints.map(p => `${p.x},${p.y}`).join(' L ')} 
                               L ${uloomxPoints[uloomxPoints.length - 1].x},${uloomxPoints[uloomxPoints.length - 1].baseY} 
                               L ${uloomxPoints[0].x},${uloomxPoints[0].baseY} Z`;

        return { usthadAreaPath, uloomxAreaPath, usthadPoints, uloomxPoints };
    };

    const { usthadAreaPath, uloomxAreaPath, uloomxPoints } = createStackedPaths();

    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        if (data.length === 0) return;
        
        const svgRect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - svgRect.left;
        const scaleFactor = svgRect.width / width;
        const chartWidth = (width - padding.left - padding.right) * scaleFactor;
        const scaledPaddingLeft = padding.left * scaleFactor;
        const index = Math.round(((x - scaledPaddingLeft) / chartWidth) * (data.length - 1));
        
        if (index >= 0 && index < data.length) {
            setHoveredIndex(index);
        }
    };

    const handleMouseLeave = () => {
        setHoveredIndex(null);
    };

    return (
        <div ref={containerRef} className="relative w-full overflow-hidden">
            <svg 
                width="100%" 
                height={height} 
                viewBox={`0 0 ${width} ${height}`} 
                preserveAspectRatio="xMidYMid meet"
                className="w-full cursor-crosshair"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
            >
                {/* Grid lines */}
                {[0, 1, 2, 3, 4, 5].map(i => {
                    const y = padding.top + (i * (height - padding.top - padding.bottom)) / 5;
                    const value = maxValue - (i * maxValue) / 5;
                    return (
                        <g key={i}>
                            <line
                                x1={padding.left}
                                y1={y}
                                x2={width - padding.right}
                                y2={y}
                                stroke="#f1f5f9"
                                strokeWidth="1"
                                strokeDasharray="4 4"
                            />
                            <text
                                x={padding.left - 10}
                                y={y + 4}
                                textAnchor="end"
                                className="text-xs fill-[#94a3b8]"
                            >
                                {formatCurrency(value).replace('₹', '')}
                            </text>
                        </g>
                    );
                })}

                {/* Usthad layer (Light Orange) */}
                <path
                    d={usthadAreaPath}
                    fill="url(#gradientUsthad)"
                    opacity="0.8"
                />

                {/* UloomX layer (Deep Orange) */}
                <path
                    d={uloomxAreaPath}
                    fill="url(#gradientUloomx)"
                    opacity="0.9"
                />

                {/* Border lines */}
                <path
                    d={`M ${uloomxPoints.map(p => `${p.x},${p.y}`).join(' L ')}`}
                    fill="none"
                    stroke="#ff4d00"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* Gradient definitions */}
                <defs>
                    <linearGradient id="gradientUloomx" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#ff4d00" stopOpacity="0.9" />
                        <stop offset="100%" stopColor="#ff4d00" stopOpacity="0.6" />
                    </linearGradient>
                    <linearGradient id="gradientUsthad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#ffb088" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#ffb088" stopOpacity="0.4" />
                    </linearGradient>
                </defs>

                {/* X-axis labels */}
                {data.filter((_, index) => index % 5 === 0).map((point, index) => {
                    const x = padding.left + (data.indexOf(point) / (data.length - 1)) * (width - padding.left - padding.right);
                    const date = new Date(point.date);
                    return (
                        <text
                            key={index}
                            x={x}
                            y={height - 25}
                            textAnchor="middle"
                            className="text-xs fill-[#64748b]"
                        >
                            {date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </text>
                    );
                })}

                {/* Hover indicator */}
                {hoveredIndex !== null && (
                    <>
                        <line
                            x1={uloomxPoints[hoveredIndex].x}
                            y1={padding.top}
                            x2={uloomxPoints[hoveredIndex].x}
                            y2={height - padding.bottom}
                            stroke="#ff4d00"
                            strokeWidth="2"
                            strokeDasharray="4 4"
                            opacity="0.5"
                        />
                        <circle
                            cx={uloomxPoints[hoveredIndex].x}
                            cy={uloomxPoints[hoveredIndex].y}
                            r="6"
                            fill="#ff4d00"
                            stroke="white"
                            strokeWidth="3"
                        />
                    </>
                )}
            </svg>

            {/* Tooltip */}
            {hoveredIndex !== null && (
                <div 
                    className="absolute bg-white rounded-xl shadow-xl border border-gray-100 p-4 pointer-events-none z-10"
                    style={{
                        left: `${(uloomxPoints[hoveredIndex].x / width) * 100}%`,
                        top: `${(uloomxPoints[hoveredIndex].y / height) * 100 - 25}%`,
                        transform: 'translateX(-50%)',
                        minWidth: '200px'
                    }}
                >
                    <p className="text-xs text-[#64748b] font-medium mb-1">
                        {new Date(data[hoveredIndex].date).toLocaleDateString('en-IN', { 
                            weekday: 'short', 
                            day: 'numeric', 
                            month: 'short' 
                        })}
                    </p>
                    <div className="space-y-1">
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-[#ffb088] flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-[#ffb088]"></span>
                                Usthad Academy
                            </span>
                            <span className="text-sm font-bold text-[#1e293b]">
                                {formatCurrency(data[hoveredIndex].usthad)}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-[#ff4d00] flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-[#ff4d00]"></span>
                                UloomX
                            </span>
                            <span className="text-sm font-bold text-[#1e293b]">
                                {formatCurrency(data[hoveredIndex].uloomx)}
                            </span>
                        </div>
                        <div className="pt-2 mt-2 border-t border-gray-100">
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-[#64748b]">Net Balance</span>
                                <span className="text-lg font-black text-[#ff4d00]">
                                    {formatCurrency(data[hoveredIndex].netBalance)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Donut Chart Component for Strategic Revenue Split
const DonutChart = ({ 
    uloomxValue, 
    usthadValue 
}: { 
    uloomxValue: number; 
    usthadValue: number;
}) => {
    const total = uloomxValue + usthadValue;
    const uloomxPercentage = total > 0 ? (uloomxValue / total) * 100 : 0;
    const usthadPercentage = total > 0 ? (usthadValue / total) * 100 : 0;
    
    // Responsive size based on container width
    const [chartSize, setChartSize] = React.useState(180);
    const containerRef = React.useRef<HTMLDivElement>(null);
    
    React.useEffect(() => {
        let isMounted = true;
        let resizeTimeout: NodeJS.Timeout;
        
        const updateSize = () => {
            if (!isMounted) return;
            if (containerRef.current) {
                const containerWidth = containerRef.current.clientWidth;
                // Use smaller size on mobile, larger on desktop
                const newSize = Math.min(180, containerWidth - 32);
                setChartSize(Math.max(140, newSize));
            }
        };
        
        updateSize();
        
        const handleResize = () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(updateSize, 100);
        };
        
        window.addEventListener('resize', handleResize);
        
        return () => {
            isMounted = false;
            window.removeEventListener('resize', handleResize);
            clearTimeout(resizeTimeout);
        };
    }, []);
    
    const size = chartSize;
    const strokeWidth = Math.max(18, size * 0.13);
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    
    const uloomxOffset = circumference - (uloomxPercentage / 100) * circumference;
    const usthadOffset = circumference - (usthadPercentage / 100) * circumference;
    
    return (
        <div ref={containerRef} className="relative flex flex-col items-center w-full">
            <div className="relative" style={{ width: size, height: size }}>
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
                    {/* Background circle */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke="#f1f5f9"
                        strokeWidth={strokeWidth}
                    />
                    
                    {/* UloomX segment (Deep Orange) */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke="#ff4d00"
                        strokeWidth={strokeWidth}
                        strokeDasharray={circumference}
                        strokeDashoffset={uloomxOffset}
                        strokeLinecap="round"
                        className="transition-all duration-500"
                    />
                    
                    {/* Usthad segment (Light Orange) */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke="#ffb088"
                        strokeWidth={strokeWidth}
                        strokeDasharray={circumference}
                        strokeDashoffset={usthadOffset}
                        strokeLinecap="round"
                        className="transition-all duration-500"
                        style={{
                            transform: `rotate(${(uloomxPercentage / 100) * 360}deg)`,
                            transformOrigin: 'center'
                        }}
                    />
                </svg>
                
                {/* Center text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-[10px] md:text-xs text-[#64748b] font-medium">Total Revenue</p>
                    <p className="text-sm md:text-lg font-black text-[#1e293b]">{formatCurrency(total)}</p>
                </div>
            </div>
            
            {/* Legend */}
            <div className="mt-4 space-y-2 w-full px-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-[#ff4d00]"></span>
                        <span className="text-xs md:text-sm text-[#64748b]">UloomX</span>
                    </div>
                    <span className="text-xs md:text-sm font-bold text-[#1e293b]">{uloomxPercentage.toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-[#ffb088]"></span>
                        <span className="text-xs md:text-sm text-[#64748b]">Usthad Academy</span>
                    </div>
                    <span className="text-xs md:text-sm font-bold text-[#1e293b]">{usthadPercentage.toFixed(1)}%</span>
                </div>
            </div>
        </div>
    );
};

// Counter animation hook with cleanup
const useCounterAnimation = (targetValue: number, duration: number = 2000) => {
    const [currentValue, setCurrentValue] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        let isMounted = true;
        let animationFrameId: number;

        if (targetValue === 0) {
            setCurrentValue(0);
            return;
        }

        setIsAnimating(true);
        const startTime = Date.now();
        const startValue = currentValue;

        const animate = () => {
            if (!isMounted) return;
            
            const now = Date.now();
            const progress = Math.min((now - startTime) / duration, 1);
            
            // Easing function for smooth animation
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            const newValue = startValue + (targetValue - startValue) * easeOutQuart;
            
            setCurrentValue(newValue);

            if (progress < 1) {
                animationFrameId = requestAnimationFrame(animate);
            } else {
                setIsAnimating(false);
            }
        };

        animationFrameId = requestAnimationFrame(animate);

        return () => {
            isMounted = false;
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetValue, duration]);

    return { currentValue, isAnimating };
};

export default function FinanceManagerFinancialIntelligence() {
    const { profile, loading, user, signOut } = useAuth();
    const router = useRouter();
    const [logoPng, setLogoPng] = useState<string | null>(null);
    const [isDownloadingFinanceReport, setIsDownloadingFinanceReport] = useState(false);

    useEffect(() => {
        if (!loading && (!user || !profile || (!profile.is_manager && profile.role !== "ceo" && profile.role !== "accounts"))) {
            router.push("/");
        }
    }, [user, profile, loading, router]);

    useEffect(() => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = 500;
            canvas.height = 500;
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.fillStyle = "rgba(0,0,0,0)";
                ctx.fillRect(0, 0, 500, 500);
                ctx.drawImage(img, 0, 0, 500, 500);
                try {
                    const dataUrl = canvas.toDataURL("image/png");
                    setLogoPng(dataUrl);
                } catch (e) {
                    console.error("Failed to convert logo to data URL", e);
                }
            }
        };
        img.src = "/images/usthadacademylogo2.svg";
    }, []);

    const downloadMonthlyFinanceReport = async () => {
        setIsDownloadingFinanceReport(true);
        toast.loading("Compiling Monthly Financial Audit Report...");
        
        try {
            const currentMonthYYYYMM = new Date().toISOString().slice(0, 7); // YYYY-MM
            const { data: entries, error: fetchError } = await supabase
                .from("financial_entries")
                .select("*")
                .gte("entry_date", `${currentMonthYYYYMM}-01`)
                .order("entry_date", { ascending: false });

            if (fetchError) throw fetchError;

            const doc = new jsPDF({
                orientation: "portrait",
                unit: "mm",
                format: "a4"
            });

            const primaryColor = "#31267D"; // Usthad Navy
            const secondaryColor = "#F14D24"; // Usthad Orange
            const darkGray = "#1F2937";
            const lightGray = "#4B5563";

            // Helper to draw confidentiality footer
            const drawFooterConfidential = (d: jsPDF) => {
                d.setFont("helvetica", "italic");
                d.setFontSize(7.5);
                d.setTextColor(156, 163, 175);
                const footerMsg = "CONFIDENTIAL - USTHAD ACADEMY COMMAND CENTER OS OFFICIAL FINANCIAL AUDIT REPORT.";
                d.text(footerMsg, 105 - d.getTextWidth(footerMsg) / 2, 287);
            };

            // Helper to draw standard header banner
            const drawHeaderBanner = (d: jsPDF, pageNum: number) => {
                // Top banner background
                d.setFillColor(49, 38, 125); 
                d.rect(0, 0, 210, 35, "F");

                // Brand Logo inside white box
                d.setFillColor(255, 255, 255);
                d.rect(14, 8, 18, 18, "F");
                
                if (logoPng) {
                    try {
                        d.addImage(logoPng, 'PNG', 15.5, 9.5, 15, 15);
                    } catch (err) {
                        d.setFillColor(241, 77, 36);
                        d.rect(16, 10, 14, 14, "F");
                        d.setTextColor(255, 255, 255);
                        d.setFont("helvetica", "bold");
                        d.setFontSize(10);
                        d.text("UA", 19, 19);
                    }
                } else {
                    d.setFillColor(241, 77, 36);
                    d.rect(16, 10, 14, 14, "F");
                    d.setTextColor(255, 255, 255);
                    d.setFont("helvetica", "bold");
                    d.setFontSize(10);
                    d.text("UA", 19, 19);
                }

                // Header Title
                d.setTextColor(255, 255, 255);
                d.setFont("helvetica", "bold");
                d.setFontSize(15);
                d.text("USTHAD ACADEMY", 38, 16);
                d.setFont("helvetica", "normal");
                d.setFontSize(8);
                d.text("COMMAND CENTER OS • MONTHLY FINANCIAL AUDIT REPORT", 38, 22);

                // Date Generated
                const dateStr = new Date().toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric"
                });
                d.setFontSize(8);
                d.setTextColor(255, 255, 255);
                d.text(`Report Date: ${dateStr}`, 155, 29);
                
                if (pageNum > 1) {
                    d.text(`Page ${pageNum}`, 190, 15);
                }
                
                // Orange separation line
                d.setFillColor(241, 77, 36); // #F14D24
                d.rect(15, 42, 180, 0.5, "F");
            };

            // ==========================================
            // PAGE 1: COVER PAGE & STATS OVERVIEW
            // ==========================================
            // Top accent banner
            doc.setFillColor(241, 77, 36);
            doc.rect(0, 0, 210, 15, "F");

            // Brand Logo in center
            if (logoPng) {
                try {
                    doc.addImage(logoPng, 'PNG', 92.5, 35, 25, 25);
                } catch (e) {}
            }

            doc.setTextColor(49, 38, 125);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(22);
            doc.text("USTHAD ACADEMY", 105, 72, { align: "center" });

            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(lightGray);
            doc.text("COMMAND CENTER OS • FINANCIAL INTELLIGENCE SYSTEM", 105, 78, { align: "center" });

            doc.setFillColor(241, 77, 36); // Orange
            doc.rect(75, 84, 60, 1.2, "F");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(16);
            doc.setTextColor(darkGray);
            doc.text("MONTHLY FINANCIAL AUDIT BRIEFING", 105, 96, { align: "center" });

            const reportMonthName = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }).toUpperCase();
            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.setTextColor(241, 77, 36);
            doc.text(`AUDIT REPORT PERIOD: ${reportMonthName}`, 105, 103, { align: "center" });

            // Stats grid
            let yPos = 120;
            doc.setTextColor(49, 38, 125);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.text("ACADEMY FISCAL PERFORMANCE PORTFOLIO", 20, yPos);
            doc.setFillColor(49, 38, 125);
            doc.rect(20, yPos + 1.8, 45, 0.8, "F");

            yPos += 8;

            const uloomxTotal = entries?.reduce((sum, e) => sum + (parseFloat(e.uloomx_income) || 0), 0) || 0;
            const usthadTotal = entries?.reduce((sum, e) => sum + (parseFloat(e.usthad_income) || 0), 0) || 0;
            const totalExpense = entries?.reduce((sum, e) => sum + (parseFloat(e.total_expenses) || 0), 0) || 0;
            const balance = uloomxTotal + usthadTotal - totalExpense;

            // 4 boxes in a grid
            doc.setFillColor(249, 250, 251);
            doc.roundedRect(20, yPos, 80, 22, 2, 2, "F");
            doc.roundedRect(110, yPos, 80, 22, 2, 2, "F");
            doc.roundedRect(20, yPos + 28, 80, 22, 2, 2, "F");
            doc.roundedRect(110, yPos + 28, 80, 22, 2, 2, "F");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(lightGray);
            doc.text("MONTHLY USTHAD ACADEMY INCOME", 24, yPos + 6);
            doc.text("MONTHLY ULOOMX INCOME", 114, yPos + 6);
            doc.text("MONTHLY CUMULATIVE EXPENSES", 24, yPos + 34);
            doc.text("CURRENT MONTHLY BALANCE", 114, yPos + 34);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(12.5);
            doc.setTextColor(darkGray);
            doc.text(formatCurrencyPDF(usthadTotal), 24, yPos + 15);
            doc.setTextColor(241, 77, 36); 
            doc.text(formatCurrencyPDF(uloomxTotal), 114, yPos + 15);
            doc.setTextColor(239, 68, 68); 
            doc.text(formatCurrencyPDF(totalExpense), 24, yPos + 43);
            doc.setTextColor(16, 185, 129); 
            doc.text(formatCurrencyPDF(balance), 114, yPos + 43);

            // Targets vs Achievements
            yPos += 64;
            doc.setTextColor(49, 38, 125);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.text("FISCAL TARGET CONGRUENCY METRICS", 20, yPos);
            doc.setFillColor(49, 38, 125);
            doc.rect(20, yPos + 1.8, 45, 0.8, "F");

            yPos += 8;

            const targetsList = [
                { name: "Usthad Academy Revenue Target", val: targets.usthadTarget, actual: usthadTotal, color: "#31267D" },
                { name: "UloomX Revenue Target", val: targets.uloomxTarget, actual: uloomxTotal, color: "#F14D24" },
                { name: "Operational Expense limit", val: targets.expenseTarget, actual: totalExpense, color: "#EF4444" }
            ];

            targetsList.forEach((t) => {
                const percentage = t.val > 0 ? (t.actual / t.val) * 100 : 100;

                doc.setFont("helvetica", "bold");
                doc.setFontSize(8.5);
                doc.setTextColor(darkGray);
                doc.text(t.name.toUpperCase(), 24, yPos + 4);

                doc.setFont("helvetica", "normal");
                doc.setFontSize(8);
                doc.setTextColor(lightGray);
                doc.text(`Target: ${formatCurrencyPDF(t.val)} | Actual: ${formatCurrencyPDF(t.actual)}`, 24, yPos + 9);

                doc.setFont("helvetica", "bold");
                doc.setFontSize(8);
                doc.setTextColor(t.color);
                doc.text(`${percentage.toFixed(1)}% Achieved`, 186, yPos + 9, { align: "right" });

                doc.setDrawColor(243, 244, 246);
                doc.setLineWidth(0.15);
                doc.line(20, yPos + 12, 190, yPos + 12);
                yPos += 15;
            });

            drawFooterConfidential(doc);

            // ==========================================
            // PAGE 2: DETAILED TRANSACTION LEDGER
            // ==========================================
            doc.addPage();
            let pageNum = doc.getNumberOfPages();
            drawHeaderBanner(doc, pageNum);

            let tableYPos = 48;

            doc.setTextColor(49, 38, 125);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.text("DAILY FINANCIAL TRANSMISSION LEDGER", 15, tableYPos);
            
            doc.setFillColor(241, 77, 36);
            doc.rect(15, tableYPos + 2, 45, 1, "F");

            tableYPos += 8;

            // Table Header
            doc.setFillColor(49, 38, 125);
            doc.roundedRect(15, tableYPos, 180, 8, 1, 1, "F");
            
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(255, 255, 255);
            doc.text("ENTRY DATE", 18, tableYPos + 5.5);
            doc.text("USTHAD ACADEMY REVENUE", 45, tableYPos + 5.5);
            doc.text("ULOOMX REVENUE", 90, tableYPos + 5.5);
            doc.text("TOTAL EXPENSES", 132, tableYPos + 5.5);
            doc.text("NET BALANCE", 170, tableYPos + 5.5);

            tableYPos += 8;

            if (!entries || entries.length === 0) {
                doc.setFont("helvetica", "italic");
                doc.setFontSize(8.5);
                doc.setTextColor(100, 116, 139);
                doc.setFillColor(249, 250, 251);
                doc.rect(15, tableYPos, 180, 10, "F");
                doc.text("No financial transactions recorded for this period.", 18, tableYPos + 6.5);
                tableYPos += 12;
            } else {
                entries.forEach((e: any, index: number) => {
                    const entryDate = new Date(e.entry_date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric"
                    });

                    const usthadIncVal = parseFloat(e.usthad_income) || 0;
                    const uloomxIncVal = parseFloat(e.uloomx_income) || 0;
                    const expVal = parseFloat(e.total_expenses) || 0;
                    const netVal = usthadIncVal + uloomxIncVal - expVal;

                    const rowHeight = 8;

                    // Page overflow safety check
                    if (tableYPos + rowHeight > 270) {
                        doc.addPage();
                        pageNum = doc.getNumberOfPages();
                        drawHeaderBanner(doc, pageNum);
                        tableYPos = 42;

                        // Redraw headers
                        doc.setFillColor(49, 38, 125);
                        doc.roundedRect(15, tableYPos, 180, 8, 1, 1, "F");
                        doc.setFont("helvetica", "bold");
                        doc.setFontSize(7.5);
                        doc.setTextColor(255, 255, 255);
                        doc.text("ENTRY DATE", 18, tableYPos + 5.5);
                        doc.text("USTHAD ACADEMY REVENUE", 45, tableYPos + 5.5);
                        doc.text("ULOOMX REVENUE", 90, tableYPos + 5.5);
                        doc.text("TOTAL EXPENSES", 132, tableYPos + 5.5);
                        doc.text("NET BALANCE", 170, tableYPos + 5.5);
                        tableYPos += 8;
                    }

                    // Stripe styling
                    if (index % 2 === 1) {
                        doc.setFillColor(249, 250, 251);
                        doc.rect(15, tableYPos, 180, rowHeight, "F");
                    }

                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(7.5);
                    doc.setTextColor(31, 41, 55);

                    // Entry Date
                    doc.text(entryDate, 18, tableYPos + 5);

                    // Usthad Academy Revenue
                    doc.text(formatCurrencyPDF(usthadIncVal), 45, tableYPos + 5);

                    // UloomX Revenue
                    doc.text(formatCurrencyPDF(uloomxIncVal), 90, tableYPos + 5);

                    // Total Expenses
                    doc.setTextColor(239, 68, 68); 
                    doc.text(formatCurrencyPDF(expVal), 132, tableYPos + 5);

                    // Net Balance
                    doc.setFont("helvetica", "bold");
                    if (netVal >= 0) {
                        doc.setTextColor(16, 185, 129); 
                    } else {
                        doc.setTextColor(239, 68, 68); 
                    }
                    doc.text(formatCurrencyPDF(netVal), 170, tableYPos + 5);

                    // Divider line
                    doc.setDrawColor(243, 244, 246);
                    doc.setLineWidth(0.1);
                    doc.line(15, tableYPos + rowHeight, 195, tableYPos + rowHeight);

                    tableYPos += rowHeight;
                });
            }

            // Signatory Block page-break check
            if (tableYPos > 235) {
                doc.addPage();
                pageNum = doc.getNumberOfPages();
                drawHeaderBanner(doc, pageNum);
                tableYPos = 45;
            }

            tableYPos += 18;
            doc.setDrawColor(209, 213, 219);
            doc.setLineWidth(0.2);
            doc.line(15, tableYPos, 80, tableYPos);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5);
            doc.setTextColor(31, 41, 55);
            doc.text("SALEEM (EXECUTIVE DIRECTOR / CEO)", 15, tableYPos + 5);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(75, 85, 99);
            doc.text("Executive Financial Authority Signature", 15, tableYPos + 9);

            drawFooterConfidential(doc);

            // Save PDF
            doc.save(`Usthad_Academy_Financial_Report_${reportMonthName.replace(/\s+/g, '_')}.pdf`);
            
            toast.dismiss();
            toast.success("Financial Audit Report generated successfully!");
        } catch (e: any) {
            console.error("Finance PDF export fail:", e);
            toast.dismiss();
            toast.error("Failed to generate financial report.");
        } finally {
            setIsDownloadingFinanceReport(false);
        }
    };
    const [dailyMetrics, setDailyMetrics] = useState<DailyMetrics>({
        uloomxIncome: 0,
        usthadIncome: 0,
        combinedExpense: 0,
        netProfit: 0,
    });

    const [monthlyMetrics, setMonthlyMetrics] = useState<MonthlyMetrics>({
        uloomxTotal: 0,
        usthadTotal: 0,
        totalExpense: 0,
        balance: 0,
    });

    // Academy targets set by CEO
    const [targets, setTargets] = useState({
        usthadTarget: 2500000,
        uloomxTarget: 3000000,
        expenseTarget: 1500000,
    });
    const [isTargetsModalOpen, setIsTargetsModalOpen] = useState(false);

    // Load academy targets with self-healing local storage fallback
    const loadTargets = async () => {
        const currentMonth = new Date();
        currentMonth.setDate(1);
        const monthStr = currentMonth.toISOString().split('T')[0];
        
        if (!monthStr) return;
        
        let localSaved: { usthadTarget: number; uloomxTarget: number; expenseTarget: number } | null = null;
        try {
            const localStr = localStorage.getItem('ua_financial_targets');
            if (localStr) {
                const parsed = JSON.parse(localStr);
                if (parsed.month === monthStr) {
                    localSaved = {
                        usthadTarget: Number(parsed.usthadTarget) || 2500000,
                        uloomxTarget: Number(parsed.uloomxTarget) || 3000000,
                        expenseTarget: Number(parsed.expenseTarget) || 1500000
                    };
                }
            }
        } catch (e) {
            console.error("Local load targets error:", e);
        }
        
        try {
            const { data, error } = await supabase
                .from('academy_financial_targets')
                .select('*')
                .eq('target_month', monthStr)
                .maybeSingle();
                
            if (data && !error) {
                const dbTargets = {
                    usthadTarget: Number(data.usthad_target) || 2500000,
                    uloomxTarget: Number(data.uloomx_target) || 3000000,
                    expenseTarget: Number(data.expense_target) || 1500000
                };
                setTargets(dbTargets);
                localStorage.setItem('ua_financial_targets', JSON.stringify({ ...dbTargets, month: monthStr }));
                return;
            }
        } catch (err) {
            console.warn("Academy financial targets DB load fallback:", err);
        }
        
        if (localSaved) {
            setTargets(localSaved);
        } else {
            setTargets({
                usthadTarget: 2500000,
                uloomxTarget: 3000000,
                expenseTarget: 1500000
            });
        }
    };

    useEffect(() => {
        if (!profile) return;
        loadTargets();
    }, [profile]);

    const handleSaveTargets = async (usthadVal: number, uloomxVal: number, expenseVal: number) => {
        const currentMonth = new Date();
        currentMonth.setDate(1);
        const monthStr = currentMonth.toISOString().split('T')[0];
        
        const targetData = {
            target_month: monthStr,
            usthad_target: usthadVal,
            uloomx_target: uloomxVal,
            expense_target: expenseVal,
            updated_at: new Date().toISOString()
        };
        
        const localObj = {
            usthadTarget: usthadVal,
            uloomxTarget: uloomxVal,
            expenseTarget: expenseVal,
            month: monthStr
        };
        localStorage.setItem('ua_financial_targets', JSON.stringify(localObj));
        setTargets({ usthadTarget: usthadVal, uloomxTarget: uloomxVal, expenseTarget: expenseVal });
        
        try {
            const { error } = await supabase
                .from('academy_financial_targets')
                .upsert(targetData, { onConflict: 'target_month' });
                
            if (error) {
                console.warn("Database targets save warning:", error.message);
                toast.success("Targets updated successfully (saved locally)!");
            } else {
                toast.success("Targets updated and synchronized successfully!");
            }
        } catch (err) {
            console.warn("Database targets save catch error:", err);
            toast.success("Targets updated successfully (saved locally)!");
        }
    };

    // Animated values for daily metrics
    const animatedUloomxIncome = useCounterAnimation(dailyMetrics.uloomxIncome, 2000);
    const animatedUsthadIncome = useCounterAnimation(dailyMetrics.usthadIncome, 1800);
    const animatedCombinedExpense = useCounterAnimation(dailyMetrics.combinedExpense, 2200);
    const animatedNetProfit = useCounterAnimation(dailyMetrics.netProfit, 2500);

    // Animated values for monthly metrics
    const animatedMonthlyUloomx = useCounterAnimation(monthlyMetrics.uloomxTotal, 2800);
    const animatedMonthlyUsthad = useCounterAnimation(monthlyMetrics.usthadTotal, 3000);
    const animatedMonthlyExpense = useCounterAnimation(monthlyMetrics.totalExpense, 2600);

    const [currentDateTime, setCurrentDateTime] = useState<string>("");
    const [chartData, setChartData] = useState<ChartData[]>([]);

    // Fetch financial data using TanStack Query
    const { data: financialEntries = [], isLoading: financialLoading } = useQuery({
        queryKey: ['financial-entries', profile?.id],
        queryFn: async () => {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const { data, error } = await supabase
                .from('financial_entries')
                .select('*')
                .gte('entry_date', thirtyDaysAgo.toISOString().split('T')[0])
                .order('entry_date', { ascending: false });
            
            if (error) throw error;
            return data || [];
        },
        enabled: !!profile,
        refetchOnWindowFocus: true,
        retry: 3,
        staleTime: 60000,
    });

    // Helper to calculate exact percentage comparison against yesterday
    const getTrendProps = (todayVal: number, yesterdayVal: number, isExpense: boolean = false) => {
        if (yesterdayVal === 0) {
            if (todayVal === 0) return { trend: undefined, trendValue: undefined };
            return { 
                trend: isExpense ? ("down" as const) : ("up" as const), 
                trendValue: "+100.0%" 
            };
        }
        const diff = todayVal - yesterdayVal;
        const percentage = (diff / yesterdayVal) * 100;
        const prefix = percentage >= 0 ? "+" : "";
        const trendValue = `${prefix}${percentage.toFixed(1)}%`;
        
        return {
            trend: isExpense 
                ? (percentage <= 0 ? ("up" as const) : ("down" as const)) // For expense: decrease is positive signal (green, up), increase is negative (red, down)
                : (percentage >= 0 ? ("up" as const) : ("down" as const)),
            trendValue
        };
    };

    const [yesterdayMetrics, setYesterdayMetrics] = useState({
        uloomxIncome: 0,
        usthadIncome: 0,
        combinedExpense: 0,
        netProfit: 0
    });

    useEffect(() => {
        if (!financialEntries || financialEntries.length === 0) return;

        // Calculate daily metrics (today's data)
        const today = new Date().toISOString().split('T')[0];
        const todayEntries = financialEntries.filter(entry => entry.entry_date === today);
        
        const todayUloomx = todayEntries.reduce((sum, entry) => sum + (parseFloat(entry.uloomx_income) || 0), 0);
        const todayUsthad = todayEntries.reduce((sum, entry) => sum + (parseFloat(entry.usthad_income) || 0), 0);
        const todayExpenses = todayEntries.reduce((sum, entry) => sum + (parseFloat(entry.total_expenses) || 0), 0);
        
        setDailyMetrics({
            uloomxIncome: todayUloomx,
            usthadIncome: todayUsthad,
            combinedExpense: todayExpenses,
            netProfit: todayUloomx + todayUsthad - todayExpenses,
        });

        // Calculate yesterday's metrics dynamically by checking yesterday's calendar day
        const yesterdayDate = new Date();
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterdayStr = yesterdayDate.toISOString().split('T')[0];
        const yesterdayEntries = financialEntries.filter(entry => entry.entry_date === yesterdayStr);

        const yesterdayUloomx = yesterdayEntries.reduce((sum, entry) => sum + (parseFloat(entry.uloomx_income) || 0), 0);
        const yesterdayUsthad = yesterdayEntries.reduce((sum, entry) => sum + (parseFloat(entry.usthad_income) || 0), 0);
        const yesterdayExpenses = yesterdayEntries.reduce((sum, entry) => sum + (parseFloat(entry.total_expenses) || 0), 0);

        setYesterdayMetrics({
            uloomxIncome: yesterdayUloomx,
            usthadIncome: yesterdayUsthad,
            combinedExpense: yesterdayExpenses,
            netProfit: yesterdayUloomx + yesterdayUsthad - yesterdayExpenses
        });
        
        // Calculate monthly metrics (current month)
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        const monthEntries = financialEntries.filter(entry => entry.entry_date.startsWith(currentMonth));
        
        const monthUloomx = monthEntries.reduce((sum, entry) => sum + (parseFloat(entry.uloomx_income) || 0), 0);
        const monthUsthad = monthEntries.reduce((sum, entry) => sum + (parseFloat(entry.usthad_income) || 0), 0);
        const monthExpenses = monthEntries.reduce((sum, entry) => sum + (parseFloat(entry.total_expenses) || 0), 0);
        
        setMonthlyMetrics({
            uloomxTotal: monthUloomx,
            usthadTotal: monthUsthad,
            totalExpense: monthExpenses,
            balance: monthUloomx + monthUsthad - monthExpenses,
        });
        
        // Generate chart data
        setChartData(generateChartData(financialEntries));
    }, [financialEntries]);

    // Update date/time
    useEffect(() => {
        const updateDateTime = () => {
            const now = new Date();
            setCurrentDateTime(now.toLocaleString('en-IN', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }));
        };
        updateDateTime();
        const interval = setInterval(updateDateTime, 60000);
        return () => clearInterval(interval);
    }, []);

    // Debug current state values commented out for clean build logs
    /*
    console.log('Current state:', { 
        loading,
        financialLoading, 
        dailyMetrics, 
        monthlyMetrics, 
        chartDataLength: chartData.length,
        financialEntriesLength: financialEntries.length 
    });
    */

    // Anomaly detection calculations using CEO dynamic targets
    const balanceTarget = targets.uloomxTarget + targets.usthadTarget - targets.expenseTarget;
    const expenseRatio = (monthlyMetrics.totalExpense / (Math.max(1, monthlyMetrics.uloomxTotal + monthlyMetrics.usthadTotal))) * 100;
    const targetAchievement = (monthlyMetrics.balance / (Math.max(1, balanceTarget))) * 100;

    const handleGoHome = () => {
        router.push("/ceo");
    };

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            {/* Simple Manager Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
                <div className="max-w-[1700px] mx-auto px-4 md:px-8 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-[#2F1E73] rounded-xl flex items-center justify-center shadow-lg shadow-[#2F1E73]/20">
                                <div className="text-white text-[9px] font-black tracking-widest">UA</div>
                            </div>
                            <div>
                                <h1 className="text-xs font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                                    Financial Intelligence
                                    <Badge className="bg-[#2F1E73] text-white border-none text-[7px] h-3.5 px-1.5">MANAGER</Badge>
                                </h1>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => router.push("/finance-manager")}
                                className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all text-[10px] font-bold uppercase tracking-wider"
                            >
                                <LayoutDashboard className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Back to Dashboard</span>
                            </button>
                            <button
                                onClick={() => signOut()}
                                className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <div className="p-4 md:p-8 pb-24 md:pb-8">
                <div className="max-w-7xl mx-auto">
                {/* Premium Glass-Morphism Header */}
                <div className="mb-6 md:mb-8 bg-white/80 backdrop-blur-xl border border-slate-200 rounded-[20px] md:rounded-[24px] shadow-lg p-4 md:p-6 lg:p-8">
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 md:gap-6">
                        {/* Left Side: Brand Section */}
                        <div className="flex items-center gap-3 md:gap-5 w-full lg:w-auto">
                            {/* Gradient Icon Box */}
                            <div 
                                className="w-14 h-14 md:w-20 md:h-20 rounded-xl md:rounded-2xl flex items-center justify-center shadow-xl flex-shrink-0"
                                style={{
                                    background: 'linear-gradient(135deg, #2F1E73 0%, #3F348C 100%)',
                                    boxShadow: '0 12px 40px rgba(47, 30, 115, 0.25)'
                                }}
                            >
                                <BarChart3 className="w-7 h-7 md:w-10 md:h-10 text-white" />
                            </div>
                                                 {/* Title and Quote */}
                            <div className="min-w-0 flex-1">
                                <h1 className="text-xl md:text-3xl lg:text-4xl font-black text-[#1e293b] uppercase tracking-tight leading-tight truncate">
                                    FINANCIAL COMMAND
                                </h1>
                                <p className="text-xs md:text-sm italic text-[#64748b] mt-0.5 md:mt-1 line-clamp-2">
                                    &quot;Strategic visibility into Usthad Academy &amp; UloomX revenue.&quot;
                                </p>
                            </div>
                        </div>

                        {/* Right Side: Status and Time */}
                        <div className="flex flex-wrap items-center gap-2 md:gap-4 w-full lg:w-auto justify-start lg:justify-end">
                             {/* Update Daily Finance Button */}
                             <button
                                onClick={() => router.push("/finance-manager/daily-finance")}
                                className="h-9 md:h-10 px-4 rounded-xl text-white font-bold text-xs md:text-sm flex items-center justify-center gap-2 active:scale-95 transition-all duration-200 flex-shrink-0"
                                style={{
                                    background: "linear-gradient(135deg, #ff4d00 0%, #ff8c00 100%)",
                                    boxShadow: "0 4px 15px rgba(255, 77, 0, 0.25)"
                                }}
                            >
                                <Wallet className="w-4 h-4 text-white" />
                                <span>Update Daily Finance</span>
                            </button>
 
                             {/* Download Finance Report Button */}
                            <button
                                onClick={downloadMonthlyFinanceReport}
                                disabled={isDownloadingFinanceReport}
                                className="h-9 md:h-10 px-4 rounded-xl text-white font-bold text-xs md:text-sm flex items-center justify-center gap-2 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                                style={{
                                    background: "linear-gradient(135deg, #2F1E73 0%, #F15A24 100%)",
                                    boxShadow: "0 4px 15px rgba(47, 30, 115, 0.25)"
                                }}
                            >
                                {isDownloadingFinanceReport ? (
                                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                                ) : (
                                    <FileText className="w-4 h-4 text-white" />
                                )}
                                <span>Download Finance Report</span>
                            </button>
 
                            {/* Live System Status */}
                            <div className="flex items-center gap-1.5 md:gap-2 px-2.5 md:px-4 py-1.5 md:py-2.5 rounded-full bg-green-50 border border-green-200 flex-shrink-0">
                                <div className="relative">
                                    <div className="w-2 h-2 md:w-2.5 md:h-2.5 bg-green-500 rounded-full"></div>
                                    <div className="absolute inset-0 w-2 h-2 md:w-2.5 md:h-2.5 bg-green-500 rounded-full animate-ping"></div>
                                </div>
                                <span className="text-xs md:text-sm font-bold text-green-700 tracking-wide hidden sm:inline">
                                    LIVE SYSTEM ACTIVE
                                </span>
                                <span className="text-xs font-bold text-green-700 tracking-wide sm:hidden">
                                    LIVE
                                </span>
                            </div>
                            
                            {/* Date/Time Stamp */}
                            <div className="px-2.5 md:px-4 py-1.5 md:py-2.5 rounded-full bg-slate-100 border border-slate-200 flex-shrink-0 flex items-center">
                                <span className="text-xs md:text-sm font-medium text-[#64748b] truncate">
                                    {currentDateTime}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Loading State */}
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="text-center">
                            <div className="w-12 h-12 border-4 border-[#ff4d00]/20 border-t-[#ff4d00] rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-[#64748b] font-medium">Loading financial data...</p>
                        </div>
                    </div>
                ) : (
                    <>
                {/* Tier 1: Real-Time Daily Transmission */}
                <div className="mb-8">
                    <h2 className="text-lg md:text-xl font-semibold text-[#1e293b] mb-4">Real-Time Daily Transmission</h2>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                        <MetricCard
                            title="Today's UloomX Income"
                            value={formatCurrency(animatedUloomxIncome.currentValue)}
                            imageUrl="/images/uloomx.png"
                            trend={getTrendProps(dailyMetrics.uloomxIncome, yesterdayMetrics.uloomxIncome).trend}
                            trendValue={getTrendProps(dailyMetrics.uloomxIncome, yesterdayMetrics.uloomxIncome).trendValue}
                            color="#ff4d00"
                        />
                        <MetricCard
                            title="Today's Usthad Income"
                            value={formatCurrency(animatedUsthadIncome.currentValue)}
                            imageUrl="/images/usthadacademylogo2.svg"
                            trend={getTrendProps(dailyMetrics.usthadIncome, yesterdayMetrics.usthadIncome).trend}
                            trendValue={getTrendProps(dailyMetrics.usthadIncome, yesterdayMetrics.usthadIncome).trendValue}
                            color="#ff4d00"
                        />
                        <MetricCard
                            title="Today's Combined Expense"
                            value={formatCurrency(animatedCombinedExpense.currentValue)}
                            icon={Wallet}
                            trend={getTrendProps(dailyMetrics.combinedExpense, yesterdayMetrics.combinedExpense, true).trend}
                            trendValue={getTrendProps(dailyMetrics.combinedExpense, yesterdayMetrics.combinedExpense, true).trendValue}
                            color="#ef4444"
                        />
                        <MetricCard
                            title="Today's Net Profit"
                            value={formatCurrency(animatedNetProfit.currentValue)}
                            icon={TrendingUp}
                            trend={getTrendProps(dailyMetrics.netProfit, yesterdayMetrics.netProfit).trend}
                            trendValue={getTrendProps(dailyMetrics.netProfit, yesterdayMetrics.netProfit).trendValue}
                            color="#10b981"
                        />
                    </div>
                </div>

                {/* Tier 2: Monthly Cumulative Overview */}
                <div className="mb-8">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 select-none">
                        <h2 className="text-lg md:text-xl font-semibold text-[#1e293b]">Monthly Cumulative Overview</h2>
                        {profile?.role === 'ceo' && (
                            <button
                                onClick={() => setIsTargetsModalOpen(true)}
                                className="flex items-center gap-2 px-4 py-2.5 text-xs md:text-sm font-bold text-white rounded-xl shadow-md active:scale-95 transition-all duration-200"
                                style={{
                                    background: "linear-gradient(135deg, #ff4d00 0%, #dc2626 100%)",
                                    boxShadow: "0 4px 15px rgba(255, 77, 0, 0.25)"
                                }}
                            >
                                <Target className="w-4 h-4 text-white" />
                                <span>Set Monthly Targets</span>
                            </button>
                        )}
                    </div>
                    <div className="bg-white rounded-[20px] md:rounded-[24px] border border-gray-100 shadow-lg p-4 md:p-6 lg:p-10">
                        <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">
                            {/* Left Side: Statistical Blocks */}
                            <div className="flex-1">
                                <h3 className="text-lg md:text-xl font-bold text-[#1e293b] mb-4 md:mb-8">Monthly Fiscal Performance</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
                                    {/* Usthad Academy Card */}
                                    <div className="p-4 md:p-6 rounded-[16px] md:rounded-[20px] bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 hover:shadow-md transition-all flex flex-col justify-between">
                                        <div>
                                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-white border border-slate-100 shadow-sm flex items-center justify-center mb-2 md:mb-3 overflow-hidden p-0.5">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src="/images/usthadacademylogo2.svg" alt="Usthad Academy" className="w-full h-full object-contain" />
                                            </div>
                                            <p className="text-xs md:text-sm text-[#64748b] mb-1">Monthly Usthad Total</p>
                                            <p className="text-xl md:text-2xl font-black text-[#1e293b]">{formatCurrency(animatedMonthlyUsthad.currentValue)}</p>
                                        </div>
                                        <div className="mt-4 pt-3 border-t border-gray-200/50 flex flex-col gap-1.5 w-full">
                                            <div className="flex justify-between items-center text-[10px] md:text-xs font-bold">
                                                <span className="text-[#64748b]">Target: {formatCurrency(targets.usthadTarget)}</span>
                                                <span className="text-[#ff6b35]">
                                                    {((monthlyMetrics.usthadTotal / (targets.usthadTarget || 1)) * 100).toFixed(1)}%
                                                </span>
                                            </div>
                                            <div className="w-full bg-slate-200 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                                                <div 
                                                    className="h-1.5 rounded-full transition-all duration-500" 
                                                    style={{ 
                                                        width: `${Math.min(100, (monthlyMetrics.usthadTotal / (targets.usthadTarget || 1)) * 100)}%`,
                                                        background: 'linear-gradient(90deg, #ffb088 0%, #ff8c52 100%)'
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* UloomX Card */}
                                    <div className="p-4 md:p-6 rounded-[16px] md:rounded-[20px] bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 hover:shadow-md transition-all flex flex-col justify-between">
                                        <div>
                                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-white border border-slate-100 shadow-sm flex items-center justify-center mb-2 md:mb-3 overflow-hidden p-0.5">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src="/images/uloomx.png" alt="UloomX" className="w-full h-full object-contain scale-110" />
                                            </div>
                                            <p className="text-xs md:text-sm text-[#64748b] mb-1">Monthly UloomX Total</p>
                                            <p className="text-xl md:text-2xl font-black text-[#1e293b]">{formatCurrency(animatedMonthlyUloomx.currentValue)}</p>
                                        </div>
                                        <div className="mt-4 pt-3 border-t border-gray-200/50 flex flex-col gap-1.5 w-full">
                                            <div className="flex justify-between items-center text-[10px] md:text-xs font-bold">
                                                <span className="text-[#64748b]">Target: {formatCurrency(targets.uloomxTarget)}</span>
                                                <span className="text-[#ff4d00]">
                                                    {((monthlyMetrics.uloomxTotal / (targets.uloomxTarget || 1)) * 100).toFixed(1)}%
                                                </span>
                                            </div>
                                            <div className="w-full bg-slate-200 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                                                <div 
                                                    className="h-1.5 rounded-full transition-all duration-500" 
                                                    style={{ 
                                                        width: `${Math.min(100, (monthlyMetrics.uloomxTotal / (targets.uloomxTarget || 1)) * 100)}%`,
                                                        background: 'linear-gradient(90deg, #ff4d00 0%, #ff6b35 100%)'
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Combined Expense Card */}
                                    <div className="p-4 md:p-6 rounded-[16px] md:rounded-[20px] bg-gradient-to-br from-red-50 to-red-100 border border-red-200 hover:shadow-md transition-all flex flex-col justify-between">
                                        <div>
                                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-red-100 flex items-center justify-center mb-2 md:mb-3">
                                                <Wallet className="w-4 h-4 md:w-5 md:h-5 text-red-500" />
                                            </div>
                                            <p className="text-xs md:text-sm text-[#64748b] mb-1">Monthly Total Expense</p>
                                            <p className="text-xl md:text-2xl font-black text-[#1e293b]">{formatCurrency(animatedMonthlyExpense.currentValue)}</p>
                                        </div>
                                        <div className="mt-4 pt-3 border-t border-red-200/50 flex flex-col gap-1.5 w-full">
                                            <div className="flex justify-between items-center text-[10px] md:text-xs font-bold">
                                                <span className="text-red-700">Limit: {formatCurrency(targets.expenseTarget)}</span>
                                                <span className="text-red-600">
                                                    {((monthlyMetrics.totalExpense / (targets.expenseTarget || 1)) * 100).toFixed(1)}%
                                                </span>
                                            </div>
                                            <div className="w-full bg-red-200/60 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                                                <div 
                                                    className="h-1.5 rounded-full transition-all duration-500" 
                                                    style={{ 
                                                        width: `${Math.min(100, (monthlyMetrics.totalExpense / (targets.expenseTarget || 1)) * 100)}%`,
                                                        background: 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)'
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Side: Current Monthly Balance */}
                            <div className="lg:w-[420px]">
                                <div className="h-full p-4 md:p-8 rounded-[16px] md:rounded-[20px] border-2 flex flex-col justify-between" 
                                     style={{ 
                                         borderColor: "#ff4d00", 
                                         background: "linear-gradient(135deg, rgba(255,77,0,0.08) 0%, rgba(255,107,53,0.03) 100%)" 
                                     }}>
                                    <div>
                                        <p className="text-xs md:text-sm text-[#64748b] font-medium mb-1 md:mb-2">Current Monthly Balance</p>
                                        <p className="text-2xl md:text-4xl font-black" style={{ color: "#ff4d00" }}>
                                            {formatCurrency(monthlyMetrics.balance)}
                                        </p>
                                        <div className="mt-4 flex items-center gap-2 text-xs md:text-sm text-green-600 bg-green-50 px-3 py-2 rounded-full w-fit border border-green-200">
                                            <ArrowUpRight className="w-3 h-3 md:w-4 md:h-4" />
                                            <span className="font-semibold">Healthy financial trajectory</span>
                                        </div>
                                    </div>

                                    {/* Current Monthly Balance Target Progress */}
                                    <div className="mt-6 pt-4 border-t border-[#ff4d00]/20 flex flex-col gap-1.5 w-full">
                                        <div className="flex justify-between items-center text-[10px] md:text-xs font-bold">
                                            <span className="text-[#64748b]">Net Target: {formatCurrency(balanceTarget)}</span>
                                            <span style={{ color: "#ff4d00" }}>
                                                {targetAchievement.toFixed(1)}%
                                            </span>
                                        </div>
                                        <div className="w-full bg-[#ff4d00]/10 rounded-full h-1.5 overflow-hidden">
                                            <div 
                                                className="h-1.5 rounded-full transition-all duration-500" 
                                                style={{ 
                                                    width: `${Math.min(100, targetAchievement)}%`,
                                                    backgroundColor: "#ff4d00"
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tier 3: Growth Analytics & Insight Engine */}
                <div>
                    <h2 className="text-lg md:text-xl font-semibold text-[#1e293b] mb-4">Growth Analytics & Insight Engine</h2>
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6">
                        {/* Stacked Area Chart */}
                        <div className="lg:col-span-3 bg-white rounded-[20px] md:rounded-[24px] border border-gray-100 shadow-lg p-4 md:p-8">
                            <h3 className="text-base md:text-lg font-bold text-[#1e293b] mb-4 md:mb-6">30-Day Revenue Streams</h3>
                            <StackedAreaChart data={chartData} />
                            <div className="mt-6 flex items-center justify-center gap-8 text-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded-full bg-[#ff4d00]"></div>
                                    <span className="text-[#64748b] font-medium">UloomX Revenue</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded-full bg-[#ffb088]"></div>
                                    <span className="text-[#64748b] font-medium">Usthad Academy Revenue</span>
                                </div>
                            </div>
                        </div>

                        {/* Insight Engine - Strategic Revenue Split */}
                        <div className="lg:col-span-2 space-y-4 md:space-y-6">
                            {/* Donut Chart Card */}
                            <div className="bg-white rounded-[20px] md:rounded-[24px] border border-gray-100 shadow-lg p-4 md:p-8">
                                <h3 className="text-base md:text-lg font-bold text-[#1e293b] mb-4 md:mb-6">Strategic Revenue Split</h3>
                                <DonutChart 
                                    uloomxValue={monthlyMetrics.uloomxTotal} 
                                    usthadValue={monthlyMetrics.usthadTotal} 
                                />
                            </div>

                            {/* Anomaly Detection Cards */}
                            <div className="space-y-4">
                                {/* Expense Alert */}
                                <div className={`p-4 md:p-5 rounded-[16px] md:rounded-[20px] border transition-all ${
                                    monthlyMetrics.totalExpense > targets.expenseTarget 
                                        ? 'bg-amber-50 border-amber-200' 
                                        : 'bg-green-50 border-green-200'
                                }`}>
                                    <div className="flex items-start gap-3">
                                        <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                            monthlyMetrics.totalExpense > targets.expenseTarget 
                                                ? 'bg-amber-100' 
                                                : 'bg-green-100'
                                        }`}>
                                            {monthlyMetrics.totalExpense > targets.expenseTarget ? (
                                                <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-amber-600" />
                                            ) : (
                                                <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <p className={`text-xs md:text-sm font-bold ${
                                                monthlyMetrics.totalExpense > targets.expenseTarget ? 'text-amber-700' : 'text-green-700'
                                            }`}>
                                                {monthlyMetrics.totalExpense > targets.expenseTarget ? 'Expense Target Exceeded' : 'Expense Normal'}
                                            </p>
                                            <p className="text-xs text-[#64748b] mt-1">
                                                {monthlyMetrics.totalExpense > targets.expenseTarget 
                                                    ? `Spent ${formatCurrency(monthlyMetrics.totalExpense)} - above budget cap of ${formatCurrency(targets.expenseTarget)}`
                                                    : `Spent ${formatCurrency(monthlyMetrics.totalExpense)} - within target limit of ${formatCurrency(targets.expenseTarget)}`
                                                }
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Revenue Milestone */}
                                <div className={`p-4 md:p-5 rounded-[16px] md:rounded-[20px] border transition-all ${
                                    targetAchievement >= 100 
                                        ? 'bg-green-50 border-green-200' 
                                        : targetAchievement >= 75 
                                            ? 'bg-blue-50 border-blue-200'
                                            : 'bg-orange-50 border-orange-200'
                                }`}>
                                    <div className="flex items-start gap-3">
                                        <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                            targetAchievement >= 100 
                                                ? 'bg-green-100' 
                                                : targetAchievement >= 75 
                                                    ? 'bg-blue-100'
                                                    : 'bg-orange-100'
                                        }`}>
                                            {targetAchievement >= 100 ? (
                                                <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
                                            ) : targetAchievement >= 75 ? (
                                                <Target className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
                                            ) : (
                                                <Zap className="w-4 h-4 md:w-5 md:h-5 text-orange-600" />
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <p className={`text-xs md:text-sm font-bold ${
                                                targetAchievement >= 100 
                                                    ? 'text-green-700' 
                                                    : targetAchievement >= 75 
                                                        ? 'text-blue-700'
                                                        : 'text-orange-700'
                                            }`}>
                                                {targetAchievement >= 100 
                                                    ? 'Revenue Milestone Achieved!' 
                                                    : targetAchievement >= 75 
                                                        ? 'On Track to Target'
                                                        : 'Target Alert: Needs Focus'
                                                }
                                            </p>
                                            <p className="text-xs text-[#64748b] mt-1">
                                                Monthly net target {targetAchievement.toFixed(1)}% achieved
                                                {targetAchievement < 100 && ` - ₹${formatCurrency(balanceTarget - monthlyMetrics.balance).replace('₹', '')} more needed`}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tier 4: Financial Transmission Log History */}
                <div className="mt-8">
                    <div className="bg-white rounded-[20px] md:rounded-[24px] border border-gray-100 shadow-lg overflow-hidden select-none">
                        <div className="p-4 md:p-6 border-b border-gray-50 flex items-center justify-between">
                            <h3 className="text-base md:text-lg font-bold text-[#1e293b]">Financial Transmission Log History (Last 30 Days)</h3>
                            <span className="text-xs text-[#64748b] bg-slate-100 px-3 py-1 rounded-full font-bold">
                                {financialEntries.length} Records Found
                            </span>
                        </div>
                        
                        {financialEntries.length === 0 ? (
                            <div className="p-12 text-center">
                                <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <ReceiptText className="w-8 h-8 text-gray-300" />
                                </div>
                                <p className="text-gray-500 font-medium">No ledger entries recorded</p>
                                <p className="text-gray-400 text-sm mt-1">Financial logs will appear once submitted by accounts personnel.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/50 border-b border-gray-100">
                                            <th className="p-4 md:p-5 text-xs font-bold uppercase tracking-wider text-[#64748b]">Date</th>
                                            <th className="p-4 md:p-5 text-xs font-bold uppercase tracking-wider text-[#64748b]">UloomX Income</th>
                                            <th className="p-4 md:p-5 text-xs font-bold uppercase tracking-wider text-[#64748b]">Usthad Income</th>
                                            <th className="p-4 md:p-5 text-xs font-bold uppercase tracking-wider text-[#64748b]">Combined Expense</th>
                                            <th className="p-4 md:p-5 text-xs font-bold uppercase tracking-wider text-[#64748b]">Net Profit</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {financialEntries.map((entry: any) => {
                                            const uloomxVal = parseFloat(entry.uloomx_income) || 0;
                                            const usthadVal = parseFloat(entry.usthad_income) || 0;
                                            const expenseVal = parseFloat(entry.total_expenses) || 0;
                                            const netVal = uloomxVal + usthadVal - expenseVal;
                                            
                                            return (
                                                <tr key={entry.id} className="hover:bg-slate-50/60 transition-colors">
                                                    <td className="p-4 md:p-5 text-xs md:text-sm font-semibold text-[#1e293b] whitespace-nowrap">
                                                        {new Date(entry.entry_date).toLocaleDateString('en-IN', {
                                                            day: 'numeric',
                                                            month: 'short',
                                                            year: 'numeric'
                                                        })}
                                                    </td>
                                                    <td className="p-4 md:p-5 text-xs md:text-sm font-bold text-[#ff4d00] whitespace-nowrap">
                                                        {formatCurrency(uloomxVal)}
                                                    </td>
                                                    <td className="p-4 md:p-5 text-xs md:text-sm font-bold text-[#ffb088] whitespace-nowrap">
                                                        {formatCurrency(usthadVal)}
                                                    </td>
                                                    <td className="p-4 md:p-5 text-xs md:text-sm font-bold text-red-500 whitespace-nowrap">
                                                        {formatCurrency(expenseVal)}
                                                    </td>
                                                    <td className={`p-4 md:p-5 text-xs md:text-sm font-black whitespace-nowrap ${netVal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        {formatCurrency(netVal)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </>
        )}
        </div>
    </div>
            
            {/* Mobile Bottom Navigation */}
            <MobileBottomNav
                activeView="financial-intelligence"
                onViewChange={(view) => {
                    if (view === "command-center") {
                        router.push("/ceo");
                    } else if (view === "financial-intelligence") {
                        // Already on this page
                        return;
                    } else if (view === "sales-intelligence") {
                        router.push("/ceo/sales");
                    } else if (view === "staff-management") {
                        router.push("/ceo");
                    } else if (view === "inbox") {
                        router.push("/ceo");
                    } else {
                        router.push("/ceo");
                    }
                }}
            />
            
            {/* Mobile FAB */}
            <MobileFAB variant="default" />

            {/* Set Academy Targets Modal */}
            <SetAcademyTargetsModal
                isOpen={isTargetsModalOpen}
                onClose={() => setIsTargetsModalOpen(false)}
                currentTargets={targets}
                onSave={handleSaveTargets}
            />
        </div>
    );
}

// =====================================================
// DIALOG / MODAL FOR SETTING ACADEMY FINANCIAL TARGETS
// =====================================================
interface SetAcademyTargetsModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentTargets: {
        usthadTarget: number;
        uloomxTarget: number;
        expenseTarget: number;
    };
    onSave: (usthad: number, uloomx: number, expense: number) => Promise<void>;
}

function SetAcademyTargetsModal({
    isOpen,
    onClose,
    currentTargets,
    onSave
}: SetAcademyTargetsModalProps) {
    const [usthadVal, setUsthadVal] = useState(currentTargets.usthadTarget.toString());
    const [uloomxVal, setUloomxVal] = useState(currentTargets.uloomxTarget.toString());
    const [expenseVal, setExpenseVal] = useState(currentTargets.expenseTarget.toString());
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setUsthadVal(currentTargets.usthadTarget.toString());
        setUloomxVal(currentTargets.uloomxTarget.toString());
        setExpenseVal(currentTargets.expenseTarget.toString());
    }, [currentTargets, isOpen]);

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const u = parseFloat(usthadVal);
        const x = parseFloat(uloomxVal);
        const ex = parseFloat(expenseVal);
        
        if (isNaN(u) || u < 0 || isNaN(x) || x < 0 || isNaN(ex) || ex < 0) {
            toast.error("Please enter valid positive target values.");
            return;
        }

        setIsSaving(true);
        try {
            await onSave(u, x, ex);
            onClose();
        } catch (error) {
            console.error("Targets save error:", error);
            toast.error("Failed to save financial targets.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-6 text-slate-900 dark:text-white">
                <DialogHeader className="mb-4">
                    <DialogTitle className="flex items-center gap-3">
                        <div 
                            className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-md flex-shrink-0"
                            style={{
                                background: 'linear-gradient(135deg, #ff4d00 0%, #dc2626 100%)'
                            }}
                        >
                            <Target className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <div className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                Academy Targets
                            </div>
                            <div className="text-xs font-semibold text-[#64748b] dark:text-zinc-400">
                                Set monthly global goals
                            </div>
                        </div>
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleFormSubmit} className="space-y-5">
                    {/* Usthad Academy Target Control */}
                    <div className="space-y-2.5 p-3.5 bg-slate-50/50 dark:bg-zinc-800/30 rounded-2xl border border-slate-100 dark:border-zinc-800/50">
                        <div className="flex justify-between items-center select-none">
                            <Label htmlFor="target-usthad" className="text-xs font-black uppercase text-slate-500 dark:text-zinc-400">
                                Usthad Academy Target
                            </Label>
                            <span className="text-xs font-black text-[#ff4d00]">
                                {formatCurrency(parseFloat(usthadVal) || 0)}
                            </span>
                        </div>
                        
                        {/* Interactive Range Slider */}
                        <input
                            type="range"
                            min="0"
                            max="10000000"
                            step="50000"
                            value={usthadVal || "0"}
                            onChange={(e) => setUsthadVal(e.target.value)}
                            className="w-full h-1.5 bg-slate-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-[#ff4d00] focus:outline-none"
                        />
                        
                        {/* Precision Input Field */}
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-black text-slate-400 select-none">₹</span>
                            <Input
                                id="target-usthad"
                                type="number"
                                value={usthadVal}
                                onChange={(e) => setUsthadVal(e.target.value)}
                                placeholder="Enter custom amount"
                                className="h-8 rounded-lg text-xs font-semibold border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-950 dark:text-white placeholder:text-slate-400 focus-visible:ring-orange-500"
                                required
                            />
                        </div>
                    </div>

                    {/* UloomX Target Control */}
                    <div className="space-y-2.5 p-3.5 bg-slate-50/50 dark:bg-zinc-800/30 rounded-2xl border border-slate-100 dark:border-zinc-800/50">
                        <div className="flex justify-between items-center select-none">
                            <Label htmlFor="target-uloomx" className="text-xs font-black uppercase text-slate-500 dark:text-zinc-400">
                                UloomX Target
                            </Label>
                            <span className="text-xs font-black text-[#ff4d00]">
                                {formatCurrency(parseFloat(uloomxVal) || 0)}
                            </span>
                        </div>
                        
                        {/* Interactive Range Slider */}
                        <input
                            type="range"
                            min="0"
                            max="10000000"
                            step="50000"
                            value={uloomxVal || "0"}
                            onChange={(e) => setUloomxVal(e.target.value)}
                            className="w-full h-1.5 bg-slate-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-[#ff4d00] focus:outline-none"
                        />
                        
                        {/* Precision Input Field */}
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-black text-slate-400 select-none">₹</span>
                            <Input
                                id="target-uloomx"
                                type="number"
                                value={uloomxVal}
                                onChange={(e) => setUloomxVal(e.target.value)}
                                placeholder="Enter custom amount"
                                className="h-8 rounded-lg text-xs font-semibold border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-950 dark:text-white placeholder:text-slate-400 focus-visible:ring-orange-500"
                                required
                            />
                        </div>
                    </div>

                    {/* Combined Expenses Target Control */}
                    <div className="space-y-2.5 p-3.5 bg-slate-50/50 dark:bg-zinc-800/30 rounded-2xl border border-slate-100 dark:border-zinc-800/50">
                        <div className="flex justify-between items-center select-none">
                            <Label htmlFor="target-expense" className="text-xs font-black uppercase text-slate-500 dark:text-zinc-400">
                                Combined Expense Limit
                            </Label>
                            <span className="text-xs font-black text-red-500 dark:text-red-400">
                                {formatCurrency(parseFloat(expenseVal) || 0)}
                            </span>
                        </div>
                        
                        {/* Interactive Range Slider */}
                        <input
                            type="range"
                            min="0"
                            max="5000000"
                            step="25000"
                            value={expenseVal || "0"}
                            onChange={(e) => setExpenseVal(e.target.value)}
                            className="w-full h-1.5 bg-slate-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-red-500 focus:outline-none"
                        />
                        
                        {/* Precision Input Field */}
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-black text-slate-400 select-none">₹</span>
                            <Input
                                id="target-expense"
                                type="number"
                                value={expenseVal}
                                onChange={(e) => setExpenseVal(e.target.value)}
                                placeholder="Enter custom amount"
                                className="h-8 rounded-lg text-xs font-semibold border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-950 dark:text-white placeholder:text-slate-400 focus-visible:ring-red-500"
                                required
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 pt-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={isSaving}
                            className="flex-1 h-11 rounded-xl font-bold border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSaving}
                            className="flex-1 h-11 rounded-xl font-bold text-white bg-[#ff4d00] hover:bg-[#ff4d00]/90 transition-all shadow-md"
                        >
                            {isSaving ? "Saving..." : "Save Targets"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
