"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, Plus, Star, CheckCircle2, Clock, XCircle, Wifi, Building2, Pencil, Trash2, Loader2, X, Mail, Users, FileText, BarChart3, Calendar, Eye, Activity, ArrowLeft, ChevronRight, TrendingUp } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn, isValidAvatarUrl } from "@/lib/utils";
import { supabase, Profile, Task, Request } from "@/lib/supabase";
import { jsPDF } from "jspdf";
import AddStaffDialog from "./AddStaffDialog";
import { PendingApprovals, PendingRequest } from "./PendingApprovals";
import { StatCards } from "./StatCards";
import { toast } from "sonner";
import { deleteFile } from "@/lib/storage";
import { useTabResiliency } from "./tab-resiliency-engine";
import { useAuth } from "@/lib/auth-context";
import { useStaff, useTasks, useRequests } from "@/hooks/use-dashboard-data";
import { useQueryClient } from "@tanstack/react-query";

// Brand colors
const BRAND_COLORS = {
    indigo: "#31267D",
    orange: "#F14D24",
};

// Types
type StaffStatus = "Present" | "Remote" | "Late" | "Absent";

interface StaffMember {
    id: string;
    name: string;
    role: string;
    department: string;
    status: StaffStatus;
    tasksCompleted: number;
    tasksTotal: number;
    rating: number;
    avatar: string;
    email: string;
    phone: string;
    username: string;
    fullName: string;
    rank: number;
}

// Status badge styles
const statusStyles: Record<StaffStatus, { bg: string; text: string; icon: React.ElementType }> = {
    Present: { bg: "bg-emerald-50", text: "text-emerald-600", icon: CheckCircle2 },
    Late: { bg: "bg-orange-50", text: "text-orange-600", icon: Clock },
    Absent: { bg: "bg-red-50", text: "text-red-600", icon: XCircle },
    Remote: { bg: "bg-blue-50", text: "text-blue-600", icon: Wifi },
};

// Map profile status to staff status
const mapProfileStatus = (status: string): StaffStatus => {
    switch (status) {
        case "online":
            return "Present";
        case "busy":
            return "Late";
        case "away":
            return "Remote";
        case "offline":
        default:
            return "Absent";
    }
};

// Calculate rating based on task completion
const calculateRating = (completed: number, total: number): number => {
    if (total === 0) return 4.0;
    const ratio = completed / total;
    if (ratio >= 0.9) return 4.8 + Math.random() * 0.2;
    if (ratio >= 0.75) return 4.4 + Math.random() * 0.3;
    if (ratio >= 0.5) return 4.0 + Math.random() * 0.3;
    return 3.5 + Math.random() * 0.4;
};

export function StaffManagement() {
    const { userRole, profile } = useAuth();
    const queryClient = useQueryClient();
    const [logoPng, setLogoPng] = useState<string | null>(null);

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

    const [searchQuery, setSearchQuery] = useState("");
    const [hoveredRow, setHoveredRow] = useState<string | null>(null);
    const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
    const [exporting, setExporting] = useState<string | null>(null);
    const [selectedStaffForReport, setSelectedStaffForReport] = useState<StaffMember | null>(null);
    const [isReportOpen, setIsReportOpen] = useState(false);
    const [isMonthlyReportOpen, setIsMonthlyReportOpen] = useState(false);
    const [isReportsCenterOpen, setIsReportsCenterOpen] = useState(false);
    const [activeReportView, setActiveReportView] = useState<'selection' | 'operations' | 'leaves' | 'performance'>('selection');
    const [isDownloadingOperationsReport, setIsDownloadingOperationsReport] = useState(false);
    const [isDownloadingLeavesReport, setIsDownloadingLeavesReport] = useState(false);

    const downloadTaskReport = async (period: "weekly" | "monthly", targetStaffId?: string) => {
        const idTag = targetStaffId || "general";
        setExporting(idTag);
        toast.loading(`Compiling task logs for ${period} performance report...`);
        
        try {
            const url = new URL("/api/reports/tasks", window.location.origin);
            url.searchParams.set("period", period);
            if (targetStaffId) {
                url.searchParams.set("staffId", targetStaffId);
            }

            const response = await fetch(url.toString());
            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || "Server responded with an error status.");
            }

            const blob = await response.blob();
            const objectUrl = window.URL.createObjectURL(blob);
            
            const a = document.createElement("a");
            a.href = objectUrl;
            a.download = `usthad_academy_performance_report_${period}_${new Date().toISOString().slice(0, 10)}.pdf`;
            document.body.appendChild(a);
            a.click();
            
            document.body.removeChild(a);
            window.URL.revokeObjectURL(objectUrl);
            
            toast.dismiss();
            toast.success("Performance Audit Report downloaded successfully!");
        } catch (err: any) {
            console.error("Report export failed:", err);
            toast.dismiss();
            toast.error(err.message || "Failed to stream performance audit report.");
        } finally {
            setExporting(null);
        }
    };

    const getStaffName = (staffId: string) => {
        const staff = staffProfiles.find(p => p.id === staffId);
        return staff ? (staff.full_name || staff.username || "Unknown") : "Unassigned";
    };

    const getStaffDepartment = (staffId: string) => {
        const staff = staffProfiles.find(p => p.id === staffId);
        return staff ? (staff.department || "General") : "General";
    };

    const downloadMonthlyOperationsReport = async (preview = false) => {
        setIsDownloadingOperationsReport(true);
        toast.loading("Compiling Monthly Usthadacademy Operations Report...");
        
        try {
            const allTasks = [...activeTasks, ...completedTasks];
            
            // Filter tasks by department
            const salesTasks = allTasks.filter(t => {
                const dept = getStaffDepartment(t.assigned_to)?.toLowerCase() || "";
                return dept === "sales";
            });

            const adminTasks = allTasks.filter(t => {
                const dept = getStaffDepartment(t.assigned_to)?.toLowerCase() || "";
                return dept === "administration" || dept === "admin" || dept === "general" || !dept;
            });

            const financeTasks = allTasks.filter(t => {
                const dept = getStaffDepartment(t.assigned_to)?.toLowerCase() || "";
                return dept === "finance" || dept === "accounts";
            });

            const marketingTasks = allTasks.filter(t => {
                const dept = getStaffDepartment(t.assigned_to)?.toLowerCase() || "";
                return dept === "marketing";
            });

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
                const footerMsg = "CONFIDENTIAL - USTHAD ACADEMY COMMAND CENTER OS OFFICIAL OPERATIONS REPORT.";
                d.text(footerMsg, 105 - d.getTextWidth(footerMsg) / 2, 287);
            };

            // Helper to draw standard header banner
            const drawHeaderBanner = (d: jsPDF, subtitle: string, pageNum: number) => {
                // Top banner background
                d.setFillColor(49, 38, 125); // #31267D
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
                d.text("COMMAND CENTER OS • MONTHLY OPERATIONS REPORT", 38, 22);

                // Date Generated
                const dateStr = new Date().toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric"
                });
                d.setFontSize(8);
                d.setTextColor(200, 200, 200);
                d.text(`Report Date: ${dateStr}`, 155, 29);
                
                if (pageNum > 1) {
                    d.text(`Page ${pageNum}`, 190, 15);
                }
                
                // Red orange separation line
                d.setFillColor(241, 77, 36); // #F14D24
                d.rect(15, 42, 180, 0.5, "F");
            };

            // Helper to draw a department page table
            const drawDepartmentPage = (d: jsPDF, departmentName: string, tasksList: any[]) => {
                d.addPage();
                const pageN = d.getNumberOfPages();
                drawHeaderBanner(d, departmentName, pageN);
                
                let yPos = 48;
                
                // Page Header Title
                d.setTextColor(49, 38, 125);
                d.setFont("helvetica", "bold");
                d.setFontSize(12);
                d.text(`${departmentName.toUpperCase()} DEPARTMENT DIRECTIVES`, 15, yPos);
                
                d.setFillColor(241, 77, 36);
                d.rect(15, yPos + 2, 45, 1, "F");
                
                yPos += 8;

                // Table Header
                d.setFillColor(49, 38, 125);
                d.roundedRect(15, yPos, 180, 8, 1, 1, "F");
                
                d.setFont("helvetica", "bold");
                d.setFontSize(7.5);
                d.setTextColor(255, 255, 255);
                d.text("TASK DIRECTIVE / TITLE", 18, yPos + 5.5);
                d.text("ASSIGNED TO", 76, yPos + 5.5);
                d.text("ASSIGNED BY", 110, yPos + 5.5);
                d.text("LAUNCHED", 140, yPos + 5.5);
                d.text("COMPLETED", 162, yPos + 5.5);
                d.text("STATUS", 182, yPos + 5.5);
                
                yPos += 8;

                if (tasksList.length === 0) {
                    d.setFont("helvetica", "italic");
                    d.setFontSize(8.5);
                    d.setTextColor(100, 116, 139);
                    d.setFillColor(249, 250, 251);
                    d.rect(15, yPos, 180, 10, "F");
                    d.text(`No active or completed task directives recorded for the ${departmentName} department.`, 18, yPos + 6.5);
                } else {
                    tasksList.forEach((task: any, idx: number) => {
                        // Overflow check
                        if (yPos > 265) {
                            d.addPage();
                            const subPageN = d.getNumberOfPages();
                            drawHeaderBanner(d, departmentName, subPageN);
                            yPos = 42;

                            // Redraw Table Header
                            d.setFillColor(49, 38, 125);
                            d.roundedRect(15, yPos, 180, 8, 1, 1, "F");
                            d.setFont("helvetica", "bold");
                            d.setFontSize(7.5);
                            d.setTextColor(255, 255, 255);
                            d.text("TASK DIRECTIVE / TITLE", 18, yPos + 5.5);
                            d.text("ASSIGNED TO", 76, yPos + 5.5);
                            d.text("ASSIGNED BY", 110, yPos + 5.5);
                            d.text("LAUNCHED", 140, yPos + 5.5);
                            d.text("COMPLETED", 162, yPos + 5.5);
                            d.text("STATUS", 182, yPos + 5.5);
                            yPos += 8;
                        }

                        // Zebra striping
                        if (idx % 2 === 1) {
                            d.setFillColor(249, 250, 251);
                            d.rect(15, yPos, 180, 8, "F");
                        }

                        const rawTitle = task.title || "Untitled Directive";
                        const title = rawTitle.length > 32 ? rawTitle.slice(0, 29) + "..." : rawTitle;
                        const assignedTo = getStaffName(task.assigned_to);
                        const assignedBy = getCreatorName(task.created_by);
                        const launchDate = new Date(task.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
                        
                        const isCompleted = (task.status || "").toUpperCase() === "COMPLETED";
                        const completedDate = isCompleted && (task.updated_at || task.updatedAt)
                            ? new Date(task.updated_at || task.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })
                            : "—";
                        
                        const statusVal = (task.status || "PENDING").toUpperCase().replace("_", " ");

                        d.setFont("helvetica", "normal");
                        d.setFontSize(7.5);
                        d.setTextColor(darkGray);
                        d.text(title, 18, yPos + 5.5);
                        d.text(assignedTo, 76, yPos + 5.5);
                        d.text(assignedBy, 110, yPos + 5.5);
                        d.text(launchDate, 140, yPos + 5.5);
                        d.text(completedDate, 162, yPos + 5.5);

                        // Colors for status
                        if (isCompleted) {
                            d.setTextColor(16, 185, 129); // emerald
                        } else if (statusVal === "PENDING") {
                            d.setTextColor(245, 158, 11); // amber
                        } else if (statusVal === "IN PROGRESS") {
                            d.setTextColor(59, 130, 246); // blue
                        } else {
                            d.setTextColor(139, 92, 246); // purple
                        }
                        d.setFont("helvetica", "bold");
                        d.text(statusVal, 182, yPos + 5.5);

                        // Row bottom divider line
                        d.setDrawColor(243, 244, 246);
                        d.setLineWidth(0.1);
                        d.line(15, yPos + 8, 195, yPos + 8);

                        yPos += 8;
                    });
                }
                
                drawFooterConfidential(d);
            };

            // ==========================================
            // PAGE 1: COVER PAGE & EXECUTIVE SUMMARY
            // ==========================================
            // Top accent banner
            doc.setFillColor(49, 38, 125); // Navy
            doc.rect(0, 0, 210, 15, "F");

            // Brand Logo in center
            if (logoPng) {
                try {
                    doc.addImage(logoPng, 'PNG', 92.5, 35, 25, 25);
                } catch (e) {
                    console.error("Cover page logo error:", e);
                }
            }

            doc.setTextColor(49, 38, 125);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(22);
            doc.text("USTHAD ACADEMY", 105, 72, { align: "center" });

            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(lightGray);
            doc.text("COMMAND CENTER OS • EXECUTIVE INTEL BANNER", 105, 78, { align: "center" });

            doc.setFillColor(241, 77, 36); // Orange
            doc.rect(75, 84, 60, 1.2, "F");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(16);
            doc.setTextColor(darkGray);
            doc.text("MONTHLY OPERATIONS & TASK DIRECTIVES", 105, 96, { align: "center" });

            const reportMonthName = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }).toUpperCase();
            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.setTextColor(241, 77, 36);
            doc.text(`AUDIT RECORD PERIOD: ${reportMonthName}`, 105, 103, { align: "center" });

            // Executive Summary Stats Grid
            let yPos = 120;
            doc.setTextColor(49, 38, 125);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.text("INSTITUTIONAL PERFORMANCE OVERVIEW", 20, yPos);
            doc.setFillColor(49, 38, 125);
            doc.rect(20, yPos + 1.8, 45, 0.8, "F");

            yPos += 8;
            // 4 boxes in a grid
            doc.setFillColor(249, 250, 251);
            doc.roundedRect(20, yPos, 80, 22, 2, 2, "F");
            doc.roundedRect(110, yPos, 80, 22, 2, 2, "F");
            doc.roundedRect(20, yPos + 28, 80, 22, 2, 2, "F");
            doc.roundedRect(110, yPos + 28, 80, 22, 2, 2, "F");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(lightGray);
            doc.text("ACTIVE DEPLOYED STAFF", 24, yPos + 6);
            doc.text("TOTAL DIRECTIVES ASSIGNED", 114, yPos + 6);
            doc.text("COMPLETED OBJECTIVES", 24, yPos + 34);
            doc.text("OPERATIONAL VELOCITY", 114, yPos + 34);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(12.5);
            doc.setTextColor(darkGray);
            doc.text(stats.total.toString(), 24, yPos + 15);
            doc.text(totalTasksAssigned.toString(), 114, yPos + 15);
            doc.setTextColor(16, 185, 129); // emerald
            doc.text(totalTasksCompleted.toString(), 24, yPos + 43);
            doc.setTextColor(49, 38, 125); // navy
            doc.text(`${operationalVelocity}%`, 114, yPos + 43);

            // Departmental Summaries (Cover Page)
            yPos += 64;
            doc.setTextColor(49, 38, 125);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.text("DEPARTMENTAL DIRECTIVES BREAKDOWN", 20, yPos);
            doc.setFillColor(49, 38, 125);
            doc.rect(20, yPos + 1.8, 45, 0.8, "F");

            yPos += 8;

            const deptsList = [
                { name: "Sales Department Tasks", tasks: salesTasks },
                { name: "Administration Department Tasks", tasks: adminTasks },
                { name: "Finance Department Tasks", tasks: financeTasks },
                { name: "Marketing Department Tasks", tasks: marketingTasks }
            ];

            deptsList.forEach((d) => {
                const total = d.tasks.length;
                const completed = d.tasks.filter((t: any) => (t.status || "").toUpperCase() === "COMPLETED").length;
                const rate = total > 0 ? Math.round((completed / total) * 100) : 100;

                doc.setFont("helvetica", "bold");
                doc.setFontSize(8.5);
                doc.setTextColor(darkGray);
                doc.text(d.name.toUpperCase(), 24, yPos + 4);

                doc.setFont("helvetica", "normal");
                doc.setFontSize(8);
                doc.setTextColor(lightGray);
                doc.text(`Task Count: ${total} Assigned | ${completed} Successfully Completed`, 24, yPos + 9);

                doc.setFont("helvetica", "bold");
                doc.setFontSize(9);
                doc.setTextColor(rate >= 80 ? "#10B981" : rate >= 50 ? "#F59E0B" : "#EF4444");
                doc.text(`${rate}% Yield`, 186, yPos + 6, { align: "right" });

                doc.setDrawColor(243, 244, 246);
                doc.setLineWidth(0.15);
                doc.line(20, yPos + 12, 190, yPos + 12);
                yPos += 15;
            });

            drawFooterConfidential(doc);

            // ==========================================
            // OTHER PAGES: DEPARTMENTAL TABLES
            // ==========================================
            drawDepartmentPage(doc, "Sales", salesTasks);
            drawDepartmentPage(doc, "Administration", adminTasks);
            drawDepartmentPage(doc, "Finance", financeTasks);
            drawDepartmentPage(doc, "Marketing", marketingTasks);

            // Save PDF
            if (preview) {
                window.open(doc.output('bloburl'), '_blank');
            } else {
                doc.save(`Usthad_Academy_Operations_Report_${reportMonthName.replace(/\s+/g, '_')}.pdf`);
            }
            
            toast.dismiss();
            toast.success(preview ? "Operations Report generated successfully!" : "Operations Report downloaded successfully!");
        } catch (e: any) {
            console.error("Operations PDF export fail:", e);
            toast.dismiss();
            toast.error("Failed to generate operations report.");
        } finally {
            setIsDownloadingOperationsReport(false);
        }
    };

    const downloadMonthlyLeavesReport = async (preview = false) => {
        setIsDownloadingLeavesReport(true);
        toast.loading("Compiling Monthly Leave Requests Report...");
        
        try {
            // Fetch all requests where type is 'leave' directly from Supabase
            const { data: allLeaves, error: fetchError } = await supabase
                .from("requests")
                .select("*, submitted_by:profiles!submitted_by(id, full_name, username, role, department)")
                .eq("type", "leave")
                .order("created_at", { ascending: false });

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
                const footerMsg = "CONFIDENTIAL - USTHAD ACADEMY COMMAND CENTER OS OFFICIAL LEAVE REQUESTS AUDIT REPORT.";
                d.text(footerMsg, 105 - d.getTextWidth(footerMsg) / 2, 287);
            };

            // Helper to draw standard header banner
            const drawHeaderBanner = (d: jsPDF, pageNum: number) => {
                // Top banner background
                d.setFillColor(241, 77, 36); // #F14D24 (Usthad Orange for Leaves Report)
                d.rect(0, 0, 210, 35, "F");

                // Brand Logo inside white box
                d.setFillColor(255, 255, 255);
                d.rect(14, 8, 18, 18, "F");
                
                if (logoPng) {
                    try {
                        d.addImage(logoPng, 'PNG', 15.5, 9.5, 15, 15);
                    } catch (err) {
                        d.setFillColor(49, 38, 125);
                        d.rect(16, 10, 14, 14, "F");
                        d.setTextColor(255, 255, 255);
                        d.setFont("helvetica", "bold");
                        d.setFontSize(10);
                        d.text("UA", 19, 19);
                    }
                } else {
                    d.setFillColor(49, 38, 125);
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
                d.text("COMMAND CENTER OS • MONTHLY LEAVE REQUESTS REPORT", 38, 22);

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
                
                // Navy separation line
                d.setFillColor(49, 38, 125); // #31267D
                d.rect(15, 42, 180, 0.5, "F");
            };

            const cleanLeaveReason = (desc: string) => {
                if (!desc) return "No reason provided";
                let cleaned = desc.replace(/^\[[^\]]+\]\s*(\d+\s*(days|day):?)?\s*(-|→)?\s*/i, "").trim();
                if (cleaned.includes("Reason:")) {
                    const parts = cleaned.split("Reason:");
                    cleaned = parts[parts.length - 1].trim();
                }
                return cleaned || desc;
            };

            // ==========================================
            // PAGE 1: COVER PAGE & LEAVES SUMMARY
            // ==========================================
            // Top accent banner
            doc.setFillColor(241, 77, 36); // Usthad Orange
            doc.rect(0, 0, 210, 15, "F");

            // Brand Logo in center
            if (logoPng) {
                try {
                    doc.addImage(logoPng, 'PNG', 92.5, 35, 25, 25);
                } catch (e) {
                    console.error("Cover page logo error:", e);
                }
            }

            doc.setTextColor(241, 77, 36);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(22);
            doc.text("USTHAD ACADEMY", 105, 72, { align: "center" });

            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(lightGray);
            doc.text("COMMAND CENTER OS • LEAVES INTELLIGENCE SUMMARY", 105, 78, { align: "center" });

            doc.setFillColor(49, 38, 125); // Navy
            doc.rect(75, 84, 60, 1.2, "F");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(16);
            doc.setTextColor(darkGray);
            doc.text("MONTHLY LEAVE REQUESTS & AUDIT RECORD", 105, 96, { align: "center" });

            const reportMonthName = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }).toUpperCase();
            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.setTextColor(49, 38, 125);
            doc.text(`AUDIT REPORT PERIOD: ${reportMonthName}`, 105, 103, { align: "center" });

            // Leave Summary Stats Grid
            let yPos = 120;
            doc.setTextColor(241, 77, 36);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.text("LEAVE ACTIVITY PORTFOLIO OVERVIEW", 20, yPos);
            doc.setFillColor(241, 77, 36);
            doc.rect(20, yPos + 1.8, 45, 0.8, "F");

            yPos += 8;

            const totalLeavesCount = allLeaves?.length || 0;
            const approvedLeavesCount = allLeaves?.filter((l: any) => l.status === "approved").length || 0;
            const rejectedLeavesCount = allLeaves?.filter((l: any) => l.status === "rejected" || l.status === "declined").length || 0;
            const pendingLeavesCount = allLeaves?.filter((l: any) => l.status === "pending" || !l.status).length || 0;

            // 4 boxes in a grid
            doc.setFillColor(249, 250, 251);
            doc.roundedRect(20, yPos, 80, 22, 2, 2, "F");
            doc.roundedRect(110, yPos, 80, 22, 2, 2, "F");
            doc.roundedRect(20, yPos + 28, 80, 22, 2, 2, "F");
            doc.roundedRect(110, yPos + 28, 80, 22, 2, 2, "F");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(lightGray);
            doc.text("TOTAL LEAVE REQUESTS SUBMITTED", 24, yPos + 6);
            doc.text("APPROVED LEAVE REQUESTS", 114, yPos + 6);
            doc.text("REJECTED / DECLINED REQUESTS", 24, yPos + 34);
            doc.text("PENDING CEO ACTION", 114, yPos + 34);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(12.5);
            doc.setTextColor(darkGray);
            doc.text(totalLeavesCount.toString(), 24, yPos + 15);
            doc.setTextColor(16, 185, 129); // emerald
            doc.text(approvedLeavesCount.toString(), 114, yPos + 15);
            doc.setTextColor(239, 68, 68); // red
            doc.text(rejectedLeavesCount.toString(), 24, yPos + 43);
            doc.setTextColor(245, 158, 11); // amber
            doc.text(pendingLeavesCount.toString(), 114, yPos + 43);

            // Departmental Leaves Breakdown
            yPos += 64;
            doc.setTextColor(241, 77, 36);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.text("DEPARTMENTAL LEAVES BREAKDOWN", 20, yPos);
            doc.setFillColor(241, 77, 36);
            doc.rect(20, yPos + 1.8, 45, 0.8, "F");

            yPos += 8;

            const deptsList = ["Sales", "Administration", "Finance", "Marketing"];
            deptsList.forEach((deptName) => {
                const deptLeaves = allLeaves?.filter((l: any) => {
                    const d = l.submitted_by?.department?.toLowerCase() || "";
                    if (deptName === "Administration") {
                        return d === "administration" || d === "admin" || d === "general" || !d;
                    }
                    return d === deptName.toLowerCase();
                }) || [];

                const total = deptLeaves.length;
                const approved = deptLeaves.filter((l: any) => l.status === "approved").length;

                doc.setFont("helvetica", "bold");
                doc.setFontSize(8.5);
                doc.setTextColor(darkGray);
                doc.text(`${deptName.toUpperCase()} DEPARTMENT`, 24, yPos + 4);

                doc.setFont("helvetica", "normal");
                doc.setFontSize(8);
                doc.setTextColor(lightGray);
                doc.text(`Total: ${total} Requested | ${approved} Approved By CEO`, 24, yPos + 9);

                doc.setDrawColor(243, 244, 246);
                doc.setLineWidth(0.15);
                doc.line(20, yPos + 12, 190, yPos + 12);
                yPos += 15;
            });

            drawFooterConfidential(doc);

            // ==========================================
            // PAGE 2: FULL LEAVE DIRECTIVES TABLE
            // ==========================================
            doc.addPage();
            let pageNum = doc.getNumberOfPages();
            drawHeaderBanner(doc, pageNum);

            let tableYPos = 48;

            doc.setTextColor(49, 38, 125);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.text("DETAILED LEAVE DIRECTIVES DIRECTORY", 15, tableYPos);
            
            doc.setFillColor(241, 77, 36);
            doc.rect(15, tableYPos + 2, 45, 1, "F");

            tableYPos += 8;

            // Table Header
            doc.setFillColor(49, 38, 125);
            doc.roundedRect(15, tableYPos, 180, 8, 1, 1, "F");
            
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(255, 255, 255);
            doc.text("DATE REQUESTED", 18, tableYPos + 5.5);
            doc.text("STAFF NAME & PROFILE", 48, tableYPos + 5.5);
            doc.text("LEAVE DIRECTIVE", 92, tableYPos + 5.5);
            doc.text("REASON / PURPOSE", 132, tableYPos + 5.5);
            doc.text("STATUS", 175, tableYPos + 5.5);

            tableYPos += 8;

            if (!allLeaves || allLeaves.length === 0) {
                doc.setFont("helvetica", "italic");
                doc.setFontSize(8.5);
                doc.setTextColor(100, 116, 139);
                doc.setFillColor(249, 250, 251);
                doc.rect(15, tableYPos, 180, 10, "F");
                doc.text("No leave or time-off request records submitted by personnel for this period.", 18, tableYPos + 6.5);
                tableYPos += 12;
            } else {
                allLeaves.forEach((req: any, index: number) => {
                    const reqDate = new Date(req.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric"
                    });

                    const staffName = req.submitted_by?.full_name || req.submitted_by?.username || "Unknown Staff";
                    const roleDept = `${req.submitted_by?.role || "Staff"} • ${req.submitted_by?.department || "General"}`;
                    const typeLabel = req.title || "Leave Request";
                    const reason = cleanLeaveReason(req.description || "");

                    // Wrap long text dynamically to prevent overlap or clipping
                    const nameLines = doc.splitTextToSize(staffName, 42);
                    const typeLines = doc.splitTextToSize(typeLabel, 38);
                    const reasonLines = doc.splitTextToSize(reason, 41);

                    // Dynamic row height calculated based on maximum number of text lines
                    const maxLines = Math.max(nameLines.length + 1, typeLines.length, reasonLines.length, 1);
                    const rowHeight = 6 + (maxLines * 3.5); // base padding + line spacing

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
                        doc.text("DATE REQUESTED", 18, tableYPos + 5.5);
                        doc.text("STAFF NAME & PROFILE", 48, tableYPos + 5.5);
                        doc.text("LEAVE DIRECTIVE", 92, tableYPos + 5.5);
                        doc.text("REASON / PURPOSE", 132, tableYPos + 5.5);
                        doc.text("STATUS", 175, tableYPos + 5.5);
                        tableYPos += 8;
                    }

                    // Stripe styling
                    if (index % 2 === 1) {
                        doc.setFillColor(249, 250, 251);
                        doc.rect(15, tableYPos, 180, rowHeight, "F");
                    }

                    const statusStr = (req.status || "PENDING").toUpperCase();

                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(7.5);
                    doc.setTextColor(31, 41, 55);

                    // Date Requested
                    doc.text(reqDate, 18, tableYPos + 5);

                    // Staff Name & Details
                    nameLines.forEach((line: string, lIdx: number) => {
                        doc.setFont("helvetica", "bold");
                        doc.text(line, 48, tableYPos + 5 + (lIdx * 3.5));
                    });
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(6.5);
                    doc.setTextColor(100, 116, 139);
                    doc.text(roleDept, 48, tableYPos + 5 + (nameLines.length * 3.5));
                    doc.setFontSize(7.5);
                    doc.setTextColor(31, 41, 55);

                    // Type & Timeline
                    typeLines.forEach((line: string, lIdx: number) => {
                        doc.text(line, 92, tableYPos + 5 + (lIdx * 3.5));
                    });

                    // Reason / Purpose
                    reasonLines.forEach((line: string, lIdx: number) => {
                        doc.text(line, 132, tableYPos + 5 + (lIdx * 3.5));
                    });

                    // Decision / Status
                    if (statusStr === "APPROVED") {
                        doc.setTextColor(16, 185, 129); // emerald
                        doc.setFont("helvetica", "bold");
                        doc.text("APPROVED BY CEO", 175, tableYPos + 5);
                    } else if (statusStr === "REJECTED" || statusStr === "DECLINED") {
                        doc.setTextColor(239, 68, 68); // red
                        doc.setFont("helvetica", "bold");
                        doc.text("REJECTED BY CEO", 175, tableYPos + 5);
                    } else {
                        doc.setTextColor(245, 158, 11); // orange/amber
                        doc.setFont("helvetica", "bold");
                        doc.text("PENDING DECISION", 175, tableYPos + 5);
                    }

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
            doc.text("Executive Directing Authority Approval Signature", 15, tableYPos + 9);

            drawFooterConfidential(doc);

            // Save PDF
            if (preview) {
                window.open(doc.output('bloburl'), '_blank');
            } else {
                doc.save(`Usthad_Academy_Leaves_Report_${reportMonthName.replace(/\s+/g, '_')}.pdf`);
            }
            
            toast.dismiss();
            toast.success(preview ? "Leave Requests Report generated successfully!" : "Leave Requests Report downloaded successfully!");
        } catch (e: any) {
            console.error("Leaves PDF export fail:", e);
            toast.dismiss();
            toast.error("Failed to generate leaves report.");
        } finally {
            setIsDownloadingLeavesReport(false);
        }
    };

    // TanStack Query Hooks
    const { data: staffProfiles = [], isLoading: isLoadingStaff } = useStaff();
    const { activeTasks = [], completedTasks = [], isLoading: isLoadingTasks } = useTasks();
    const { data: rawRequests = [], isLoading: isLoadingRequests } = useRequests();

    const getCreatorName = (createdById: string) => {
        const creator = staffProfiles.find(p => p.id === createdById);
        if (creator) {
            return creator.full_name || creator.username || "System";
        }
        if (profile?.id === createdById) {
            return profile.full_name || "CEO";
        }
        return "CEO / Administrator";
    };

    const staffTasks = useMemo(() => {
        if (!selectedStaffForReport) return [];
        const allTasks = [...activeTasks, ...completedTasks];
        return allTasks.filter(t => t.assigned_to === selectedStaffForReport.id);
    }, [selectedStaffForReport, activeTasks, completedTasks]);

    const reportStats = useMemo(() => {
        const total = staffTasks.length;
        const completed = staffTasks.filter(t => (t.status || "").toUpperCase() === "COMPLETED").length;
        const rate = total > 0 ? Math.round((completed / total) * 100) : 100;
        return { total, completed, rate };
    }, [staffTasks]);

    const downloadPdfReport = async (staff: StaffMember, preview = false) => {
        toast.loading(`Compiling PDF performance audit for ${staff.name}...`);
        try {
            // Fetch requests for this staff member directly from Supabase
            const { data: staffRequests, error: requestsError } = await supabase
                .from("requests")
                .select("*")
                .eq("submitted_by", staff.id)
                .order("created_at", { ascending: false });

            if (requestsError) {
                console.error("Failed to load requests for PDF:", requestsError);
            }

            // Filter down to leave requests
            const leaveRequests = (staffRequests || []).filter((req: any) => req.type === "leave");

            const doc = new jsPDF({
                orientation: "portrait",
                unit: "mm",
                format: "a4"
            });

            let pageNum = 1;

            // Brand colors
            const primaryColor = "#31267D"; // Usthad Navy
            const secondaryColor = "#F14D24"; // Usthad Orange
            const darkGray = "#1F2937";
            const lightGray = "#4B5563";

            // Draw custom header banner with Brand Logo on generated PDF reports
            const drawAuditHeader = (doc: jsPDF, pageN: number) => {
                const navyColor = [47, 30, 115]; // #2F1E73
                const orangeColor = [241, 77, 36]; // #F14D24

                // Top banner background
                doc.setFillColor(navyColor[0], navyColor[1], navyColor[2]);
                doc.rect(0, 0, 210, 35, "F");

                // Brand Logo inside white box
                doc.setFillColor(255, 255, 255);
                doc.rect(14, 8, 18, 18, "F");
                
                if (logoPng) {
                    try {
                        doc.addImage(logoPng, 'PNG', 15.5, 9.5, 15, 15);
                    } catch (err) {
                        console.error("Error drawing brand logo in header:", err);
                        // Fallback UA block
                        doc.setFillColor(orangeColor[0], orangeColor[1], orangeColor[2]);
                        doc.rect(16, 10, 14, 14, "F");
                        doc.setTextColor(255, 255, 255);
                        doc.setFont("helvetica", "bold");
                        doc.setFontSize(10);
                        doc.text("UA", 19, 19);
                    }
                } else {
                    // Fallback UA block if logoPng is not loaded yet
                    doc.setFillColor(orangeColor[0], orangeColor[1], orangeColor[2]);
                    doc.rect(16, 10, 14, 14, "F");
                    doc.setTextColor(255, 255, 255);
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(10);
                    doc.text("UA", 19, 19);
                }

                // Header Title
                doc.setTextColor(255, 255, 255);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(18);
                doc.text("USTHAD ACADEMY", 38, 17);
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8.5);
                doc.text("COMMAND CENTER OS • STAFF PERFORMANCE AUDIT", 38, 23);

                // Date Generated
                const dateStr = new Date().toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric"
                });
                doc.setFontSize(8);
                doc.setTextColor(200, 200, 200);
                doc.text(`Audit Date: ${dateStr}`, 155, 29);
                
                if (pageN > 1) {
                    doc.text(`Page ${pageN}`, 190, 15);
                }
            };

            // Helper to clean leave reason descriptions
            const cleanLeaveReason = (desc: string) => {
                if (!desc) return "No reason provided";
                let cleaned = desc.replace(/^\[[^\]]+\]\s*(\d+\s*(days|day):?)?\s*(-|→)?\s*/i, "").trim();
                if (cleaned.includes("Reason:")) {
                    const parts = cleaned.split("Reason:");
                    cleaned = parts[parts.length - 1].trim();
                }
                return cleaned || desc;
            };

            // Load staff profile image if available
            let avatarDataUrl: string | null = null;
            if (staff.avatar) {
                try {
                    avatarDataUrl = await new Promise<string | null>((resolve) => {
                        const img = new Image();
                        img.crossOrigin = "anonymous";
                        img.onload = () => {
                            const canvas = document.createElement("canvas");
                            canvas.width = 150;
                            canvas.height = 150;
                            const ctx = canvas.getContext("2d");
                            if (ctx) {
                                ctx.beginPath();
                                ctx.arc(75, 75, 75, 0, Math.PI * 2);
                                ctx.closePath();
                                ctx.clip();
                                ctx.drawImage(img, 0, 0, 150, 150);
                                resolve(canvas.toDataURL("image/jpeg", 0.85));
                            } else {
                                resolve(null);
                            }
                        };
                        img.onerror = () => resolve(null);
                        img.src = staff.avatar;
                    });
                } catch (e) {
                    console.error("Failed to load staff avatar:", e);
                }
            }

            // Draw header top bar on page 1
            drawAuditHeader(doc, 1);

            let yPos = 48;

            // Document Title
            doc.setTextColor(47, 30, 115); // #2F1E73
            doc.setFont("helvetica", "bold");
            doc.setFontSize(15);
            doc.text("STAFF PERFORMANCE AUDIT RECORD", 15, yPos);
            
            doc.setFillColor(241, 77, 36); // #F14D24
            doc.rect(15, yPos + 2, 40, 1.2, "F");

            // Profile Section
            yPos += 10;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.setTextColor(47, 30, 115);
            doc.text("PERSONNEL PROFILE", 15, yPos);

            yPos += 5;
            // Profile Info Cards (Left: Details, Right: Summary Stats)
            doc.setFillColor(249, 250, 251);
            doc.roundedRect(15, yPos, 100, 36, 3, 3, "F");
            
            const drawFallbackAvatar = () => {
                doc.setFillColor(47, 30, 115); // #2F1E73
                doc.circle(30, yPos + 18, 12, "F");
                
                const initials = staff.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
                doc.setTextColor(255, 255, 255);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(10);
                doc.text(initials, 30, yPos + 21.5, { align: "center" });
            };

            // Draw Profile Picture if loaded
            if (avatarDataUrl) {
                try {
                    doc.addImage(avatarDataUrl, 'JPEG', 18, yPos + 6, 24, 24);
                } catch (e) {
                    console.error("Error drawing avatar:", e);
                    drawFallbackAvatar();
                }
            } else {
                drawFallbackAvatar();
            }

            // Offset the profile details text by 46mm to leave space for the avatar on the left
            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.setTextColor(darkGray);
            doc.text(staff.name.toUpperCase(), 46, yPos + 8);
            
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(secondaryColor);
            doc.text(staff.role.toUpperCase(), 46, yPos + 14);
            
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(lightGray);
            doc.text(`Department: ${staff.department}`, 46, yPos + 21);
            doc.text(`Email: ${staff.email || 'N/A'}`, 46, yPos + 27);
            doc.text(`Phone: ${staff.phone || 'N/A'}`, 46, yPos + 32);

            // Summary Stats block (Right side)
            doc.setFillColor(243, 244, 246);
            doc.roundedRect(120, yPos, 75, 36, 3, 3, "F");

            const totalAssigned = staffTasks.length;
            const totalCompleted = staffTasks.filter(t => (t.status || "").toUpperCase() === "COMPLETED").length;
            const completionRate = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 100;

            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(47, 30, 115); // Primary Theme Color Navy
            doc.text("PERFORMANCE METRICS", 125, yPos + 8);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(darkGray);
            doc.text(`Assigned Tasks:`, 125, yPos + 15);
            doc.text(`Completed Tasks:`, 125, yPos + 21);
            doc.text(`Completion Rate:`, 125, yPos + 27);
            doc.text(`Quality Rating:`, 125, yPos + 32);

            doc.setFont("helvetica", "bold");
            doc.text(totalAssigned.toString(), 160, yPos + 15);
            doc.text(totalCompleted.toString(), 160, yPos + 21);
            doc.setTextColor(completionRate >= 80 ? "#10B981" : completionRate >= 50 ? "#F59E0B" : "#EF4444");
            doc.text(`${completionRate}%`, 160, yPos + 27);
            doc.setTextColor("#F59E0B"); // Gold for rating
            doc.text(`${staff.rating || '4.0'} / 5.0`, 160, yPos + 32);

            yPos += 46;

            // Tasks Title
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.setTextColor(47, 30, 115);
            doc.text("ASSIGNED OBJECTIVE DIRECTIVES & TASKS", 15, yPos);

            yPos += 6;

            // Minimalist Table Header
            doc.setFillColor(47, 30, 115); // Primary Theme Color Navy
            doc.roundedRect(15, yPos, 180, 8, 1, 1, "F");
            
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor("#FFFFFF");
            doc.text("TASK DESCRIPTION / TITLE", 18, yPos + 5.5);
            doc.text("ASSIGNED BY", 85, yPos + 5.5);
            doc.text("LAUNCH DATE", 120, yPos + 5.5);
            doc.text("COMPLETED DATE", 150, yPos + 5.5);
            doc.text("STATUS", 180, yPos + 5.5);

            yPos += 8;

            if (staffTasks.length === 0) {
                doc.setFont("helvetica", "italic");
                doc.setFontSize(9);
                doc.setTextColor(lightGray);
                doc.text("No active or archived task directives recorded for this personnel.", 18, yPos + 6);
                yPos += 12;
            } else {
                staffTasks.forEach((t: any, index: number) => {
                    // Page-break protection
                    if (yPos > 255) {
                        doc.addPage();
                        pageNum += 1;
                        drawAuditHeader(doc, pageNum);
                        yPos = 42;

                        // Redraw Table Header on new page
                        doc.setFillColor(47, 30, 115);
                        doc.roundedRect(15, yPos, 180, 8, 1, 1, "F");
                        doc.setFont("helvetica", "bold");
                        doc.setFontSize(8);
                        doc.setTextColor("#FFFFFF");
                        doc.text("TASK DESCRIPTION / TITLE", 18, yPos + 5.5);
                        doc.text("ASSIGNED BY", 85, yPos + 5.5);
                        doc.text("LAUNCH DATE", 120, yPos + 5.5);
                        doc.text("COMPLETED DATE", 150, yPos + 5.5);
                        doc.text("STATUS", 180, yPos + 5.5);
                        yPos += 8;
                    }

                    // Row background striping for readability
                    if (index % 2 === 1) {
                        doc.setFillColor(249, 250, 251);
                        doc.rect(15, yPos, 180, 8, "F");
                    }

                    // Parse variables
                    const rawTitle = t.title || "Untitled Task";
                    const title = rawTitle.length > 36 ? rawTitle.slice(0, 33) + "..." : rawTitle;
                    
                    const assignedBy = getCreatorName(t.created_by);
                    const launchDate = new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
                    
                    const isCompleted = (t.status || "").toUpperCase() === "COMPLETED";
                    const completedDate = isCompleted && (t.updated_at || t.updatedAt)
                        ? new Date(t.updated_at || t.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })
                        : "—";
                    
                    const statusVal = (t.status || "PENDING").toUpperCase().replace("_", " ");

                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(8);
                    doc.setTextColor(darkGray);
                    doc.text(title, 18, yPos + 5.5);
                    doc.text(assignedBy, 85, yPos + 5.5);
                    doc.text(launchDate, 120, yPos + 5.5);
                    doc.text(completedDate, 150, yPos + 5.5);

                    // Status colors matching theme
                    if (isCompleted) {
                        doc.setTextColor(16, 185, 129); // Emerald
                    } else if (statusVal === "PENDING") {
                        doc.setTextColor(245, 158, 11); // Amber/Orange
                    } else if (statusVal === "IN PROGRESS") {
                        doc.setTextColor(59, 130, 246); // Blue
                    } else {
                        doc.setTextColor(139, 92, 246); // Purple for In Review / other statuses
                    }
                    doc.setFont("helvetica", "bold");
                    doc.text(statusVal, 180, yPos + 5.5);

                    // Draw thin bottom line
                    doc.setDrawColor(243, 244, 246);
                    doc.setLineWidth(0.1);
                    doc.line(15, yPos + 8, 195, yPos + 8);

                    yPos += 8;
                });
            }

            // --- LEAVE & TIME-OFF REQUESTS HISTORY SECTION ---
            // Page-break check
            if (yPos > 180) {
                doc.addPage();
                pageNum += 1;
                drawAuditHeader(doc, pageNum);
                yPos = 45;
            } else {
                yPos += 12; // Gap from tasks table
            }

            // Section Title
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.setTextColor(47, 30, 115);
            doc.text("SUBMITTED LEAVE & TIME-OFF REQUESTS", 15, yPos);

            yPos += 6;

            // Table Header
            doc.setFillColor(47, 30, 115);
            doc.roundedRect(15, yPos, 180, 8, 1, 1, "F");
            
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor("#FFFFFF");
            doc.text("DATE REQUESTED", 18, yPos + 5.5);
            doc.text("LEAVE TYPE & TIMELINE", 50, yPos + 5.5);
            doc.text("REASON / PURPOSE FOR LEAVE", 100, yPos + 5.5);
            doc.text("STATUS / DECISION", 165, yPos + 5.5);

            yPos += 8;

            if (leaveRequests.length === 0) {
                doc.setFont("helvetica", "italic");
                doc.setFontSize(8.5);
                doc.setTextColor(100, 116, 139); // lightGray
                doc.setFillColor(249, 250, 251);
                doc.rect(15, yPos, 180, 10, "F");
                doc.text("No leave or time-off request records submitted by this personnel.", 18, yPos + 6.5);
                yPos += 12;
            } else {
                leaveRequests.forEach((req: any, index: number) => {
                    const reqDate = new Date(req.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric"
                    });

                    const typeLabel = req.title || "Leave Request";
                    const reason = cleanLeaveReason(req.description || "");

                    // Wrap long text dynamically to prevent overlap or clipping
                    const typeLines = doc.splitTextToSize(typeLabel, 46);
                    const reasonLines = doc.splitTextToSize(reason, 60);

                    // Dynamic row height calculated based on maximum number of text lines
                    const maxLines = Math.max(typeLines.length, reasonLines.length, 1);
                    const rowHeight = 6 + (maxLines * 3.5); // base padding + line spacing

                    // Page overflow safety check
                    if (yPos + rowHeight > 275) {
                        doc.addPage();
                        pageNum += 1;
                        drawAuditHeader(doc, pageNum);
                        yPos = 42;

                        // Redraw headers
                        doc.setFillColor(47, 30, 115);
                        doc.roundedRect(15, yPos, 180, 8, 1, 1, "F");
                        doc.setFont("helvetica", "bold");
                        doc.setFontSize(8);
                        doc.setTextColor("#FFFFFF");
                        doc.text("DATE REQUESTED", 18, yPos + 5.5);
                        doc.text("LEAVE TYPE & TIMELINE", 50, yPos + 5.5);
                        doc.text("REASON / PURPOSE FOR LEAVE", 100, yPos + 5.5);
                        doc.text("STATUS / DECISION", 165, yPos + 5.5);
                        yPos += 8;
                    }

                    // Stripe styling
                    if (index % 2 === 1) {
                        doc.setFillColor(249, 250, 251);
                        doc.rect(15, yPos, 180, rowHeight, "F");
                    }

                    const statusStr = (req.status || "PENDING").toUpperCase();

                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(8);
                    doc.setTextColor(31, 41, 55);

                    // Date Requested (Vertically Centered)
                    doc.text(reqDate, 18, yPos + 5 + (rowHeight - 8) / 2);

                    // Type & Timeline (Line Wrapped)
                    typeLines.forEach((line: string, lIdx: number) => {
                        doc.text(line, 50, yPos + 5 + (lIdx * 3.5));
                    });

                    // Reason / Purpose (Line Wrapped)
                    reasonLines.forEach((line: string, lIdx: number) => {
                        doc.text(line, 100, yPos + 5 + (lIdx * 3.5));
                    });

                    // Decision / Status Column (Vertically Centered)
                    if (statusStr === "APPROVED") {
                        doc.setTextColor(16, 185, 129); // emerald
                        doc.setFont("helvetica", "bold");
                        doc.text("APPROVED BY CEO", 165, yPos + 5 + (rowHeight - 8) / 2);
                    } else if (statusStr === "REJECTED" || statusStr === "DECLINED") {
                        doc.setTextColor(239, 68, 68); // red
                        doc.setFont("helvetica", "bold");
                        doc.text("REJECTED BY CEO", 165, yPos + 5 + (rowHeight - 8) / 2);
                    } else {
                        doc.setTextColor(245, 158, 11); // orange/amber
                        doc.setFont("helvetica", "bold");
                        doc.text("PENDING DECISION", 165, yPos + 5 + (rowHeight - 8) / 2);
                    }

                    // Divider line
                    doc.setDrawColor(243, 244, 246);
                    doc.setLineWidth(0.15);
                    doc.line(15, yPos + rowHeight, 195, yPos + rowHeight);

                    yPos += rowHeight;
                });
            }

            // Signatory Block page-break check
            if (yPos > 235) {
                doc.addPage();
                pageNum += 1;
                drawAuditHeader(doc, pageNum);
                yPos = 45;
            }

            yPos += 18;
            doc.setDrawColor(209, 213, 219);
            doc.setLineWidth(0.2);
            doc.line(15, yPos, 80, yPos);
            doc.line(130, yPos, 195, yPos);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5);
            doc.setTextColor(31, 41, 55);
            doc.text("SALEEM (EXECUTIVE DIRECTOR / CEO)", 15, yPos + 5);
            doc.text(`${staff.name.toUpperCase()} (PERSONNEL)`, 130, yPos + 5);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(75, 85, 99);
            doc.text("Executive Directing Authority", 15, yPos + 9);
            doc.text("Staff Member Signature", 130, yPos + 9);

            // Confidentiality / computer generated footer message
            doc.setFont("helvetica", "italic");
            doc.setFontSize(7.5);
            doc.setTextColor(156, 163, 175);
            const footerMsg = "CONFIDENTIAL - USTHAD ACADEMY COMMAND CENTER OS OFFICIAL PERSONNEL AUDIT RECORD.";
            doc.text(footerMsg, 105 - doc.getTextWidth(footerMsg) / 2, 285);

            // Download document
            if (preview) {
                window.open(doc.output('bloburl'), '_blank');
            } else {
                doc.save(`Performance_Report_${staff.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
            }
            toast.dismiss();
            toast.success(preview ? "Performance Audit PDF generated successfully!" : "Performance Audit PDF downloaded successfully!");
        } catch (err: any) {
            console.error("PDF download failure:", err);
            toast.dismiss();
            toast.error("Failed to generate PDF download.");
        }
    };



    const [staffToDelete, setStaffToDelete] = useState<StaffMember | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [confirmName, setConfirmName] = useState("");

    const [staffToEdit, setStaffToEdit] = useState<StaffMember | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [newFullName, setNewFullName] = useState("");
    const [isUpdatingFullName, setIsUpdatingFullName] = useState(false);

    const loading = isLoadingStaff || isLoadingTasks || isLoadingRequests;

    // Process staff data for UI
    const staffData = useMemo(() => {
        const allTasks = [...activeTasks, ...completedTasks];
        const taskMap = new Map();
        
        allTasks.forEach(t => {
            if (!taskMap.has(t.assigned_to)) {
                taskMap.set(t.assigned_to, { total: 0, completed: 0 });
            }
            const stats = taskMap.get(t.assigned_to);
            stats.total++;
            if (t.status === "completed") stats.completed++;
        });

        const mappedStaff = staffProfiles.map((profile: Profile) => {
            const stats = taskMap.get(profile.id) || { total: 0, completed: 0 };
            return {
                id: profile.id,
                name: profile.full_name || profile.username || "Unknown",
                fullName: profile.full_name || "",
                role: profile.designation || profile.role || "Staff",
                department: profile.department || "General",
                status: mapProfileStatus(profile.status),
                tasksCompleted: stats.completed,
                tasksTotal: stats.total || 0, 
                rating: Math.round(calculateRating(stats.completed, stats.total || 0) * 10) / 10,
                avatar: profile.avatar_url || "",
                email: profile.email || "",
                phone: profile.phone || "",
                username: profile.username || "",
            };
        });

        // Sort by performance rank
        const sorted = mappedStaff.sort((a, b) => {
            if (b.tasksCompleted !== a.tasksCompleted) {
                return b.tasksCompleted - a.tasksCompleted;
            }
            const aRate = a.tasksTotal > 0 ? a.tasksCompleted / a.tasksTotal : 0;
            const bRate = b.tasksTotal > 0 ? b.tasksCompleted / b.tasksTotal : 0;
            if (bRate !== aRate) {
                return bRate - aRate;
            }
            return b.rating - a.rating;
        });

        return sorted.map((staff, index) => ({
            ...staff,
            rank: index + 1
        }));
    }, [staffProfiles, activeTasks, completedTasks]);

    const employeeOfTheMonth = useMemo(() => {
        if (staffData.length === 0) return null;
        const activePersonnel = staffData.filter(s => s.tasksTotal > 0);
        if (activePersonnel.length === 0) {
            return staffData[0];
        }
        return activePersonnel[0];
    }, [staffData]);

    const totalTasksAssigned = useMemo(() => {
        return staffData.reduce((sum, s) => sum + s.tasksTotal, 0);
    }, [staffData]);

    const totalTasksCompleted = useMemo(() => {
        return staffData.reduce((sum, s) => sum + s.tasksCompleted, 0);
    }, [staffData]);

    const operationalVelocity = useMemo(() => {
        const total = totalTasksAssigned;
        const completed = totalTasksCompleted;
        return total > 0 ? Math.round((completed / total) * 100) : 100;
    }, [totalTasksAssigned, totalTasksCompleted]);

    const operationsReportStats = useMemo(() => {
        const totalSales = activeTasks.filter(t => (getStaffDepartment(t.assigned_to)?.toLowerCase() || "") === "sales").length +
                           completedTasks.filter(t => (getStaffDepartment(t.assigned_to)?.toLowerCase() || "") === "sales").length;
        const completedSales = completedTasks.filter(t => (getStaffDepartment(t.assigned_to)?.toLowerCase() || "") === "sales").length;

        const isAdmin = (t: Task) => {
            const dept = getStaffDepartment(t.assigned_to)?.toLowerCase() || "";
            return dept === "administration" || dept === "admin" || dept === "general" || !dept;
        };
        const totalAdmin = activeTasks.filter(isAdmin).length + completedTasks.filter(isAdmin).length;
        const completedAdmin = completedTasks.filter(isAdmin).length;

        const isFinance = (t: Task) => {
            const dept = getStaffDepartment(t.assigned_to)?.toLowerCase() || "";
            return dept === "finance" || dept === "accounts";
        };
        const totalFinance = activeTasks.filter(isFinance).length + completedTasks.filter(isFinance).length;
        const completedFinance = completedTasks.filter(isFinance).length;

        const totalMarketing = activeTasks.filter(t => (getStaffDepartment(t.assigned_to)?.toLowerCase() || "") === "marketing").length +
                               completedTasks.filter(t => (getStaffDepartment(t.assigned_to)?.toLowerCase() || "") === "marketing").length;
        const completedMarketing = completedTasks.filter(t => (getStaffDepartment(t.assigned_to)?.toLowerCase() || "") === "marketing").length;

        return {
            sales: { total: totalSales, completed: completedSales },
            admin: { total: totalAdmin, completed: completedAdmin },
            finance: { total: totalFinance, completed: completedFinance },
            marketing: { total: totalMarketing, completed: completedMarketing }
        };
    }, [activeTasks, completedTasks, staffProfiles]);

    const leavesReportStats = useMemo(() => {
        const filtered = rawRequests.filter(req => req.type === 'leave');
        const pending = filtered.length;
        return {
            total: filtered.length,
            pending,
            recentLeaves: filtered.slice(0, 5).map((req: any) => {
                const staffName = req.submitted_by?.full_name || req.submitted_by?.username || "Unknown Staff";
                return {
                    id: req.id,
                    staffName,
                    dates: req.dates || "N/A",
                    status: req.status || "pending",
                    purpose: req.purpose || req.description || "Personal Leave"
                };
            })
        };
    }, [rawRequests]);

    // Process pending requests for UI
    const pendingRequests = useMemo(() => {
        const filtered = rawRequests.filter(req => req.type !== 'idea');
        
        return filtered.map((req: any) => {
            const staffName = req.submitted_by?.full_name || req.submitted_by?.username || "Unknown Staff";
            const staffInitials = staffName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

            let requestType: PendingRequest["requestType"] = "leave";
            switch (req.type) {
                case "leave": requestType = "leave"; break;
                case "permission": requestType = "permission"; break;
                case "work_adjustment": requestType = "work_adjustment"; break;
                case "expense": requestType = "expense"; break;
                case "feedback": requestType = "feedback"; break;
                case "budget": requestType = "budget"; break;
                case "access_elevation": requestType = "access_elevation"; break;
                case "role_change": requestType = "role_change"; break;
                case "add_staff": requestType = "add_staff"; break;
            }

            let leaveType: PendingRequest["leaveType"];
            if (req.type === "leave") {
                const purpose = req.purpose?.toLowerCase() || req.title?.toLowerCase() || "";
                if (purpose.includes("medical")) leaveType = "medical";
                else if (purpose.includes("emergency")) leaveType = "emergency";
                else if (purpose.includes("early")) leaveType = "early";
                else leaveType = "casual";
            }

            return {
                id: req.id,
                staffId: req.submitted_by?.id,
                staffName,
                staffInitials,
                requestType,
                description: req.description || req.title || "No description provided",
                requestedAt: req.created_at,
                urgency: req.priority === "urgent" ? "urgent" : req.priority === "high" ? "high" : undefined,
                amount: req.amount,
                leaveType,
                dates: req.dates,
                totalDays: req.total_days,
            };
        });
    }, [rawRequests]);

    // Calculate overall stats
    const stats = useMemo(() => {
        return {
            present: staffData.filter((s) => s.status === "Present").length,
            remote: staffData.filter((s) => s.status === "Remote").length,
            late: staffData.filter((s) => s.status === "Late").length,
            absent: staffData.filter((s) => s.status === "Absent").length,
            total: staffData.length,
            pending: pendingRequests.length,
            approved: 0, // Placeholder
            rejected: 0, // Placeholder
        };
    }, [staffData, pendingRequests]);

    // Tab Resiliency Engine Integration
    useTabResiliency(
        () => {
            queryClient.invalidateQueries();
        },
        loading,
        () => {}
    );

    const deleteStaff = async () => {
        if (!staffToDelete) return;

        try {
            // 1. Delete avatar from storage if it exists
            if (staffToDelete.avatar && staffToDelete.avatar.includes('/storage/v1/object/public/')) {
                try {
                    await deleteFile('avatars', staffToDelete.avatar);
                } catch (e) {
                    console.warn("Failed to delete staff avatar from storage during termination:", e);
                }
            }

            const uid = staffToDelete.id;

            // 2. Call the database function to cascade delete the staff profile, auth user, and all relations
            const { data: rpcSuccess, error: rpcError } = await supabase.rpc('delete_profile_cascade', {
                profile_uuid: uid
            });

            if (rpcError) {
                throw new Error(rpcError.message || "Failed to purge staff records");
            }

            toast.success("OPERATIVE TERMINATED & DATA PURGED");
            setIsDeleteModalOpen(false);
            setStaffToDelete(null);
            setConfirmName("");
            
            // Force refresh all dashboard data
            queryClient.invalidateQueries();
            
        } catch (e: any) {
            console.error("Deletion error:", e);
            toast.error(e.message || "Failed to delete staff member permanently");
        }
    };

    const updateFullName = async () => {
        if (!staffToEdit) return;
        
        const cleanedFullName = newFullName.trim();
        if (!cleanedFullName) {
            toast.error("Full name cannot be empty");
            return;
        }

        setIsUpdatingFullName(true);
        try {
            const { error: updateError } = await supabase
                .from("profiles")
                .update({ full_name: cleanedFullName })
                .eq("id", staffToEdit.id);

            if (updateError) throw updateError;

            toast.success("Full name updated successfully");
            setIsEditModalOpen(false);
            setStaffToEdit(null);
            setNewFullName("");
            queryClient.invalidateQueries();
        } catch (e: any) {
            console.error("Update full name error:", e);
            toast.error(e.message || "Failed to update full name");
        } finally {
            setIsUpdatingFullName(false);
        }
    };

    useEffect(() => {
        const handleStaffCreated = () => queryClient.invalidateQueries({ queryKey: ["staff"] });
        window.addEventListener('staff-created', handleStaffCreated);
        return () => window.removeEventListener('staff-created', handleStaffCreated);
    }, [queryClient]);

    useEffect(() => {
        const handleFabAction = (event: CustomEvent) => {
            if (event.detail.action === "add-staff") setIsAddStaffOpen(true);
        };
        window.addEventListener("fab-action", handleFabAction as EventListener);
        return () => window.removeEventListener("fab-action", handleFabAction as EventListener);
    }, []);

    const filteredStaff = staffData.filter(
        (staff) =>
            staff.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            staff.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
            staff.department.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <div className="h-screen bg-[#F9FAFB] flex items-center justify-center">
                <div className="flex items-center gap-3">
                    <Loader2 className="w-6 h-6 animate-spin" style={{ color: BRAND_COLORS.indigo }} />
                    <span className="text-gray-500 font-medium">Synchronizing Personnel Data...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100vh-80px)] bg-[#F9FAFB] overflow-y-auto pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8">
            <div className="max-w-[1600px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight uppercase">
                            Staff Management
                        </h1>
                        <p className="text-xs md:text-sm text-gray-500 font-medium mt-1 tracking-wide">
                            <span className="text-[#31267D] font-bold">{stats.total}</span> ACTIVE PERSONNEL RECOGNIZED ACROSS ACADEMY DEPARTMENTS
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                        {(userRole === 'CEO' || userRole === 'MANAGER' || profile?.role === 'ceo' || profile?.role === 'manager' || profile?.is_manager) && (
                            <button
                                onClick={() => {
                                    setIsReportsCenterOpen(true);
                                    setActiveReportView('selection');
                                }}
                                className="bg-[#31267D] hover:bg-[#251B60] text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-[0_4px_20px_rgba(49,38,125,0.15)] hover:shadow-[0_4px_20px_rgba(49,38,125,0.25)] transition-all flex items-center justify-center gap-2 shrink-0 h-11"
                            >
                                <FileText className="w-4 h-4 text-white" />
                                Reports Center
                            </button>
                        )}
                        {(userRole === 'CEO' || userRole === 'MANAGER') && (
                            <Button
                                onClick={() => setIsAddStaffOpen(true)}
                                className="w-full sm:w-auto px-6 py-2.5 h-11 rounded-2xl text-white font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 shadow-xl shadow-orange-500/20 hover:shadow-orange-500/40 hover:scale-[1.02] active:scale-95 transition-all"
                                style={{ backgroundColor: BRAND_COLORS.orange }}
                            >
                                <Plus className="w-4 h-4 stroke-[3px]" />
                                Provision Personnel
                            </Button>
                        )}
                    </div>
                </div>

                <StatCards
                    activeStaff={stats.total}
                    pending={stats.pending}
                    approved={stats.approved}
                    rejected={stats.rejected}
                    className="mb-8"
                />

                <PendingApprovals
                    requests={pendingRequests}
                    className="mb-8"
                    isCeo={profile?.role === 'ceo' || userRole === 'CEO'}
                    onApprove={async (id) => {
                        const isCeo = profile?.role === 'ceo' || userRole === 'CEO';
                        if (!isCeo) {
                            toast.error("Access Denied: Only the CEO has permission to approve or reject staff requests.");
                            return;
                        }
                        try {
                            const { data: requestData, error: fetchError } = await supabase.from("requests").select("*").eq("id", id).single();
                            if (fetchError) throw fetchError;
                            if (requestData.type === "add_staff" && requestData.metadata) {
                                const { fullName, email, username, designation, password, systemRole, hasManagerAccess, department } = requestData.metadata;
                                const { data: authData, error: authError } = await supabase.auth.signUp({
                                    email, password, options: { data: { full_name: fullName, username: username } }
                                });
                                if (authError) throw authError;
                                if (!authData.user) throw new Error("Auth failed");
                                await supabase.from("profiles").insert({
                                    id: authData.user.id, email, full_name: fullName, username, designation,
                                    role: systemRole === "manager" || hasManagerAccess ? "manager" : systemRole,
                                    is_manager: systemRole === "manager" || hasManagerAccess,
                                    department: department || "Administration", status: "offline"
                                });
                            }
                            
                            const reviewerId = profile?.id || null;
                            const { error: updateError } = await supabase.from("requests").update({
                                status: "approved", 
                                reviewed_at: new Date().toISOString(),
                                reviewed_by: reviewerId
                            }).eq("id", id);
                            
                            if (updateError) throw updateError;
                            
                            queryClient.invalidateQueries();
                            toast.success("Request Approved");
                        } catch (err: any) {
                            console.error("Approval error:", err);
                            toast.error(err.message || "Approval failed");
                        }
                    }}
                    onDecline={async (id) => {
                        const isCeo = profile?.role === 'ceo' || userRole === 'CEO';
                        if (!isCeo) {
                            toast.error("Access Denied: Only the CEO has permission to approve or reject staff requests.");
                            return;
                        }
                        try {
                            const reviewerId = profile?.id || null;
                            const { error: updateError } = await supabase.from("requests").update({
                                status: "rejected", 
                                reviewed_at: new Date().toISOString(),
                                reviewed_by: reviewerId
                            }).eq("id", id);
                            
                            if (updateError) throw updateError;
                            
                            queryClient.invalidateQueries();
                            toast.success("Request Declined");
                        } catch (err: any) {
                            console.error("Decline error:", err);
                            toast.error(err.message || "Decline failed");
                        }
                    }}
                />

                <div className="bg-white/80 dark:bg-zinc-900/60 backdrop-blur-xl border border-white/40 dark:border-zinc-800/60 rounded-[24px] shadow-[0_12px_40px_rgba(0,0,0,0.03)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.5)] overflow-hidden">
                    <div className="px-6 py-6 border-b border-gray-100 dark:border-zinc-800/60 bg-white/30 dark:bg-zinc-900/30">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-2xl bg-[#31267D]/10 flex items-center justify-center">
                                    <Users className="w-5 h-5 text-[#31267D]" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-black uppercase tracking-widest text-gray-900">Personnel Directory</h2>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Active Deployment Monitoring</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 w-full lg:w-auto">
                                <div className="relative flex-1 lg:w-96">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <Input
                                        type="text"
                                        placeholder="Search personnel..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-11 pr-4 py-6 bg-white border-gray-200 rounded-2xl text-sm text-gray-900 focus:ring-4 focus:ring-[#31267D]/5 focus:border-[#31267D] transition-all shadow-sm placeholder:text-gray-400"
                                    />
                                </div>

                            </div>
                        </div>
                    </div>
                    
                    {/* Mobile Card View */}
                    <div className="lg:hidden bg-gray-50/50 p-4 space-y-4">
                        {filteredStaff.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <Search className="w-8 h-8 text-gray-300 mb-4" />
                                <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">No Results</p>
                            </div>
                        ) : (
                            filteredStaff.map((staff, index) => {
                                const style = statusStyles[staff.status];
                                const StatusIcon = style.icon;
                                return (
                                    <div key={staff.id} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center gap-4">
                                                <div className="relative shrink-0">
                                                    <Avatar className="w-12 h-12 border-2 border-gray-50 shadow-sm rounded-2xl">
                                                         <AvatarImage src={isValidAvatarUrl(staff.avatar) ? staff.avatar : undefined} />
                                                         <AvatarFallback className="text-white font-black" style={{ backgroundColor: BRAND_COLORS.indigo }}>
                                                             {staff.avatar && !isValidAvatarUrl(staff.avatar)
                                                                 ? staff.avatar
                                                                 : staff.name.split(" ").map(n => n[0]).join("").slice(0,2)}
                                                         </AvatarFallback>
                                                    </Avatar>
                                                    {staff.rank === 1 && (
                                                        <span className="absolute -top-2 -left-2 bg-[#F14D24] text-white text-[7px] font-black uppercase tracking-wider px-1 py-0.5 rounded-md border border-white shadow-sm">
                                                            Best
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        {staff.rank === 1 ? (
                                                            <span className="text-base" title="Best Employee">🥇</span>
                                                        ) : staff.rank === 2 ? (
                                                            <span className="text-base" title="2nd Place">🥈</span>
                                                        ) : staff.rank === 3 ? (
                                                            <span className="text-base" title="3rd Place">🥉</span>
                                                        ) : (
                                                            <span className="text-[9px] font-black text-gray-400">#{staff.rank}</span>
                                                        )}
                                                        <p className="font-black text-gray-900 text-sm truncate uppercase">{staff.name}</p>
                                                    </div>
                                                    <p className="text-[10px] font-black uppercase text-[#31267D] tracking-widest">{staff.role}</p>
                                                </div>
                                            </div>
                                            <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest", style.bg, style.text)}>
                                                <StatusIcon className="w-2.5 h-2.5 stroke-[3px]" />
                                                {staff.status}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 py-3 border-y border-gray-50 mb-4">
                                            <div>
                                                <p className="text-[7px] font-black text-gray-400 uppercase tracking-widest mb-1">Pulse</p>
                                                <span className="text-[10px] font-black text-gray-900">{staff.tasksCompleted}/{staff.tasksTotal} Tasks</span>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[7px] font-black text-gray-400 uppercase tracking-widest mb-1">Rating</p>
                                                <div className="flex items-center justify-end gap-1">
                                                    <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                                                    <span className="text-[10px] font-black">{staff.rating}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex gap-2">
                                                <a href={`mailto:${staff.email}`} className="p-2 rounded-xl bg-gray-50 text-gray-500"><Mail className="w-3.5 h-3.5" /></a>
                                                <a href={`tel:${staff.phone}`} className="p-2 rounded-xl bg-gray-50 text-gray-500"><Wifi className="w-3.5 h-3.5 rotate-90" /></a>
                                                {(userRole === 'CEO' || userRole === 'MANAGER' || profile?.role === 'ceo' || profile?.role === 'manager' || profile?.is_manager) && (
                                                    <button 
                                                        onClick={() => { setSelectedStaffForReport(staff); setIsReportOpen(true); }}
                                                        className="p-2 rounded-xl bg-gray-50 text-[#31267D] hover:text-blue-500 active:scale-95 transition-all"
                                                        title="View Staff Performance Audit"
                                                    >
                                                        <FileText className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                            {userRole === 'CEO' && (
                                                <div className="flex gap-1 items-center">
                                                    <Button variant="ghost" onClick={() => { setStaffToEdit(staff); setNewFullName(staff.fullName || staff.name || ""); setIsEditModalOpen(true); }} className="h-8 px-2 rounded-xl text-[#31267D] hover:bg-indigo-50 font-black uppercase text-[8px] gap-1">
                                                        <Pencil className="w-3.5 h-3.5" /> Edit
                                                    </Button>
                                                    <Button variant="ghost" onClick={() => { setStaffToDelete(staff); setIsDeleteModalOpen(true); }} className="h-8 px-2 rounded-xl text-red-600 hover:bg-red-50 font-black uppercase text-[8px] gap-1">
                                                        <Trash2 className="w-3.5 h-3.5" /> Terminate
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden lg:block overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50/50 border-b border-gray-100">
                                <tr>
                                    <th className="text-left py-5 px-8 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-20">Rank</th>
                                    <th className="text-left py-5 px-8 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Personnel Profile</th>
                                    <th className="text-left py-5 px-8 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Department</th>
                                    <th className="text-left py-5 px-8 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Pulse</th>
                                    <th className="text-left py-5 px-8 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Rating</th>
                                    <th className="text-right py-5 px-8 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredStaff.map((staff, index) => {
                                    const style = statusStyles[staff.status];
                                    const isHovered = hoveredRow === staff.id;
                                    return (
                                        <tr key={staff.id} className={cn("group transition-all duration-300", isHovered && "bg-[#31267D]/[0.02]")} onMouseEnter={() => setHoveredRow(staff.id)} onMouseLeave={() => setHoveredRow(null)}>
                                            <td className="py-5 px-8">
                                                <div className="flex items-center">
                                                    {staff.rank === 1 ? (
                                                        <span className="text-xl" title="Best Employee">🥇</span>
                                                    ) : staff.rank === 2 ? (
                                                        <span className="text-xl" title="2nd Place">🥈</span>
                                                    ) : staff.rank === 3 ? (
                                                        <span className="text-xl" title="3rd Place">🥉</span>
                                                    ) : (
                                                        <span className="text-xs font-black text-gray-400">#{staff.rank}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-5 px-8">
                                                <div className="flex items-center gap-4">
                                                    <div className="relative shrink-0">
                                                        <Avatar className="w-10 h-10 border-2 border-white shadow-sm rounded-xl">
                                                            <AvatarImage src={isValidAvatarUrl(staff.avatar) ? staff.avatar : undefined} />
                                                            <AvatarFallback className="text-white text-xs font-black" style={{ backgroundColor: BRAND_COLORS.indigo }}>
                                                                {staff.avatar && !isValidAvatarUrl(staff.avatar)
                                                                    ? staff.avatar
                                                                    : staff.name.split(" ").map(n => n[0]).join("")}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        {staff.rank === 1 && (
                                                            <span className="absolute -top-2 -left-2 bg-[#F14D24] text-white text-[6px] font-black uppercase tracking-wider px-1 py-0.5 rounded-md border border-white shadow-sm">
                                                                Best
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-gray-900 text-sm leading-tight uppercase tracking-tight">{staff.name}</p>
                                                        <p className="text-[10px] text-[#31267D] font-black uppercase tracking-widest mt-0.5">{staff.role}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-5 px-8">
                                                <div className="flex items-center gap-2.5 text-gray-600">
                                                    <Building2 className="w-3.5 h-3.5 text-gray-400" />
                                                    <span className="text-[11px] font-bold uppercase tracking-tight">{staff.department}</span>
                                                </div>
                                            </td>

                                            <td className="py-5 px-8">
                                                <div className="flex items-center gap-4">
                                                    <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden w-24">
                                                        <div className="h-full bg-[#31267D] transition-all duration-1000" style={{ width: `${(staff.tasksCompleted / (staff.tasksTotal || 1)) * 100}%` }} />
                                                    </div>
                                                    <span className="text-[10px] font-black text-gray-900">{staff.tasksCompleted}/{staff.tasksTotal}</span>
                                                </div>
                                            </td>
                                            <td className="py-5 px-8">
                                                <div className="flex items-center gap-1.5">
                                                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                                    <span className="text-sm font-black text-gray-900">{staff.rating}</span>
                                                </div>
                                            </td>
                                            <td className="py-5 px-8 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {(userRole === 'CEO' || userRole === 'MANAGER' || profile?.role === 'ceo' || profile?.role === 'manager' || profile?.is_manager) && (
                                                         <button 
                                                             onClick={() => { setSelectedStaffForReport(staff); setIsReportOpen(true); }}
                                                             className="p-2 rounded-xl transition-all duration-300 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-zinc-800 text-[#31267D] hover:text-blue-500"
                                                             title="View Staff Task Audit"
                                                         >
                                                             <FileText className="w-4 h-4" />
                                                         </button>
                                                     )}
                                                    {userRole === 'CEO' && (
                                                        <>
                                                            <button
                                                                onClick={() => { setStaffToEdit(staff); setNewFullName(staff.fullName || staff.name || ""); setIsEditModalOpen(true); }}
                                                                className="p-2 rounded-xl transition-all duration-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 text-gray-400 hover:text-[#31267D]"
                                                                title="Edit Full Name"
                                                            >
                                                                <Pencil className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => { setStaffToDelete(staff); setIsDeleteModalOpen(true); }}
                                                                className="p-2 rounded-xl transition-all duration-300 hover:bg-red-50 dark:hover:bg-red-950/20 text-gray-400 hover:text-red-600"
                                                                title="Terminate Personnel"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    )}

                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <AddStaffDialog open={isAddStaffOpen} onOpenChange={setIsAddStaffOpen} />
            <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
                <DialogContent className="max-w-md p-0 overflow-hidden rounded-3xl border-0">
                    <div className="bg-red-600 px-6 py-6 text-white text-center">
                        <Trash2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <h3 className="text-lg font-black uppercase tracking-widest">Terminate Personnel</h3>
                        <p className="text-[10px] font-bold uppercase tracking-tighter opacity-80 mt-1">Irreversible Deployment Extraction</p>
                    </div>
                    <div className="p-8 bg-white space-y-6">
                        <p className="text-sm text-gray-600 font-medium text-center">Are you certain you want to remove <span className="font-black text-gray-900">@{staffToDelete?.name}</span> from active academy records?</p>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Security Confirmation</label>
                            <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder="Type personnel name to confirm" className="py-6 rounded-2xl border-gray-100 focus:ring-red-500/10 focus:border-red-500" />
                        </div>
                        <div className="flex gap-3">
                            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-6 rounded-2xl font-black uppercase tracking-widest text-[10px] border-gray-100">Abort</Button>
                            <Button variant="destructive" disabled={confirmName !== staffToDelete?.name} onClick={deleteStaff} className="flex-1 py-6 rounded-2xl font-black uppercase tracking-widest text-[10px] bg-red-600 shadow-lg shadow-red-500/20">Confirm</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                <DialogContent className="max-w-md p-0 overflow-hidden rounded-3xl border-0">
                    <div className="bg-[#31267D] px-6 py-6 text-white text-center">
                        <Pencil className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <h3 className="text-lg font-black uppercase tracking-widest text-orange-500">Edit Full Name</h3>
                        <p className="text-[10px] font-bold uppercase tracking-tighter opacity-80 mt-1">Personnel Directory Record Update</p>
                    </div>
                    <div className="p-8 bg-white space-y-6">
                        <p className="text-sm text-gray-600 font-medium text-center">Update the directory full name for <span className="font-black text-gray-900">{staffToEdit?.name}</span>.</p>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">New Full Name</label>
                            <Input 
                                value={newFullName} 
                                onChange={(e) => setNewFullName(e.target.value)} 
                                placeholder="Enter full name" 
                                className="py-6 rounded-2xl border-gray-100 focus:ring-[#31267D]/10 focus:border-[#31267D]" 
                            />
                            <p className="text-[9px] text-gray-400 font-medium leading-normal">
                                Enter the user&apos;s complete legal or preferred name.
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <Button variant="outline" onClick={() => setIsEditModalOpen(false)} className="flex-1 py-6 rounded-2xl font-black uppercase tracking-widest text-[10px] border-gray-100">Cancel</Button>
                            <Button 
                                disabled={isUpdatingFullName || !newFullName.trim()} 
                                onClick={updateFullName} 
                                className="flex-1 py-6 rounded-2xl font-black uppercase tracking-widest text-[10px] bg-[#F14D24] hover:bg-[#F14D24]/90 text-white shadow-lg shadow-orange-500/20"
                            >
                                {isUpdatingFullName ? (
                                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                                ) : (
                                    "Save Changes"
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Staff Report Dialog */}
            <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
                <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-[28px] border-0 bg-white shadow-2xl flex flex-col max-h-[85vh]">
                    {/* Header */}
                    <div className="bg-[#31267D] text-white p-6 relative flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
                                <FileText className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black uppercase tracking-wider">Performance Audit Report</h3>
                                <p className="text-[10px] uppercase font-bold text-[#F14D24] tracking-widest mt-0.5">Usthad Academy Command Center OS</p>
                            </div>
                        </div>
                        <button onClick={() => setIsReportOpen(false)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 active:scale-95 transition-all">
                            <X className="w-4 h-4 text-white" />
                        </button>
                    </div>

                    {selectedStaffForReport && (
                        <div className="p-6 md:p-8 flex-1 overflow-y-auto space-y-6">
                            {/* Profile Details and Stats */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
                                {/* Profile Info */}
                                <div className="md:col-span-7 bg-[#F9FAFB] p-6 rounded-3xl border border-gray-100 flex flex-col md:flex-row gap-5 items-center md:items-start text-center md:text-left">
                                    <Avatar className="w-20 h-20 border-4 border-white shadow-md rounded-2xl shrink-0">
                                        <AvatarImage src={isValidAvatarUrl(selectedStaffForReport.avatar) ? selectedStaffForReport.avatar : undefined} />
                                        <AvatarFallback className="text-white font-black text-2xl" style={{ backgroundColor: BRAND_COLORS.indigo }}>
                                            {selectedStaffForReport.avatar && !isValidAvatarUrl(selectedStaffForReport.avatar)
                                                ? selectedStaffForReport.avatar
                                                : selectedStaffForReport.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="space-y-1 min-w-0">
                                        <h4 className="text-lg font-black text-gray-900 uppercase tracking-tight truncate">{selectedStaffForReport.name}</h4>
                                        <p className="text-xs font-bold text-[#F14D24] uppercase tracking-wider">{selectedStaffForReport.role}</p>
                                        <div className="text-xs text-gray-500 font-medium space-y-1 pt-2">
                                            <p className="flex items-center gap-2 justify-center md:justify-start">
                                                <Building2 className="w-3.5 h-3.5 text-gray-400" />
                                                <span>{selectedStaffForReport.department} Department</span>
                                            </p>
                                            <p className="flex items-center gap-2 justify-center md:justify-start truncate">
                                                <Mail className="w-3.5 h-3.5 text-gray-400" />
                                                <span>{selectedStaffForReport.email || 'No email provided'}</span>
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Stats Grid */}
                                <div className="md:col-span-5 bg-white border border-gray-100 p-6 rounded-3xl shadow-sm grid grid-cols-2 gap-4">
                                    <div className="bg-[#31267D]/[0.02] p-4 rounded-2xl border border-[#31267D]/5 text-center flex flex-col justify-center">
                                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Assigned Tasks</span>
                                        <span className="text-3xl font-black text-[#31267D] mt-1">{reportStats.total}</span>
                                    </div>
                                    <div className="bg-emerald-500/[0.02] p-4 rounded-2xl border border-emerald-500/5 text-center flex flex-col justify-center">
                                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Completed</span>
                                        <span className="text-3xl font-black text-emerald-600 mt-1">{reportStats.completed}</span>
                                    </div>
                                    <div className="bg-[#F14D24]/[0.02] p-4 rounded-2xl border border-[#F14D24]/5 text-center flex flex-col justify-center col-span-2">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Completion Rate</span>
                                            <span className="text-xs font-black text-[#F14D24]">{reportStats.rate}%</span>
                                        </div>
                                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${reportStats.rate}%`, backgroundColor: BRAND_COLORS.orange }} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Detailed Tasks Table */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-black uppercase tracking-wider text-gray-400">Assigned Tasks Log</h4>
                                <div className="border border-gray-100 rounded-2xl overflow-hidden max-h-[300px] overflow-y-auto">
                                    {staffTasks.length === 0 ? (
                                        <div className="p-8 text-center bg-gray-50/50">
                                            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">No active or completed tasks assigned</p>
                                        </div>
                                    ) : (
                                        <table className="w-full text-left border-collapse">
                                            <thead className="bg-gray-50 sticky top-0 z-10">
                                                <tr>
                                                    <th className="p-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Task Details</th>
                                                    <th className="p-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Assigned By</th>
                                                    <th className="p-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Launch Date</th>
                                                    <th className="p-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Completed Date</th>
                                                    <th className="p-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {staffTasks.map((t) => {
                                                    const isCompleted = (t.status || "").toUpperCase() === "COMPLETED";
                                                    const launchDate = new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                                                    const completedDate = isCompleted && (t.updated_at || t.updatedAt)
                                                        ? new Date(t.updated_at || t.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                                                        : "—";
                                                    const statusText = (t.status || "PENDING").toUpperCase().replace("_", " ");

                                                    return (
                                                        <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                                                            <td className="p-4">
                                                                <p className="font-bold text-gray-900 text-xs">{t.title || "Untitled Task"}</p>
                                                            </td>
                                                            <td className="p-4">
                                                                <span className="text-[10px] font-bold text-gray-600 uppercase tracking-tight">{getCreatorName(t.created_by)}</span>
                                                            </td>
                                                            <td className="p-4 text-[10px] text-gray-500 font-medium">{launchDate}</td>
                                                            <td className="p-4 text-[10px] text-gray-500 font-medium">{completedDate}</td>
                                                            <td className="p-4 text-right">
                                                                <span className={cn(
                                                                    "inline-flex items-center px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-wider",
                                                                    isCompleted ? "bg-emerald-50 text-emerald-600" :
                                                                    statusText === "PENDING" ? "bg-amber-50 text-amber-600" :
                                                                    statusText === "IN PROGRESS" ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
                                                                )}>
                                                                    {statusText}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Footer Actions */}
                    <div className="bg-gray-50 px-8 py-5 flex items-center justify-end gap-3 border-t border-gray-100 rounded-b-[28px] shrink-0">
                        <Button variant="outline" onClick={() => setIsReportOpen(false)} className="px-6 py-5 rounded-2xl font-black uppercase tracking-wider text-[10px] border-gray-200">
                            Close
                        </Button>
                        {selectedStaffForReport && (
                            <>
                                <Button 
                                    onClick={() => downloadPdfReport(selectedStaffForReport, true)}
                                    className="px-6 py-5 rounded-2xl text-[#31267D] font-black uppercase tracking-wider text-[10px] bg-[#31267D]/10 hover:bg-[#31267D]/20 border border-[#31267D]/20 flex items-center gap-2"
                                >
                                    <Eye className="w-4 h-4" />
                                    View Report
                                </Button>
                                <Button 
                                    onClick={() => downloadPdfReport(selectedStaffForReport, false)}
                                    className="px-6 py-5 rounded-2xl text-white font-black uppercase tracking-wider text-[10px] bg-[#31267D] hover:bg-[#251B60] shadow-lg shadow-indigo-500/10 flex items-center gap-2"
                                >
                                    <FileText className="w-4 h-4 stroke-[2.5px]" />
                                    Download PDF Report
                                </Button>
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Reports Center Dialog */}
            <Dialog open={isReportsCenterOpen} onOpenChange={setIsReportsCenterOpen}>
                <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-[28px] border-0 bg-white shadow-2xl flex flex-col max-h-[85vh]">
                    {/* Header */}
                    <div className="bg-zinc-950 text-white p-6 relative flex items-center justify-between shrink-0 font-sans">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
                                <FileText className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="text-base font-black uppercase tracking-widest">Academy Reports Center</h3>
                                <p className="text-[9px] uppercase font-bold text-zinc-400 tracking-widest mt-0.5">Usthad Academy OS • Reports Directory</p>
                            </div>
                        </div>
                        <button onClick={() => setIsReportsCenterOpen(false)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 active:scale-95 transition-all">
                            <X className="w-4 h-4 text-white" />
                        </button>
                    </div>

                    {activeReportView === 'selection' ? (
                        /* Selection View: Report Cards */
                        <div className="p-8 flex-1 overflow-y-auto space-y-6 bg-zinc-50/50">
                            <div>
                                <h4 className="text-sm font-black text-zinc-800 uppercase tracking-wider mb-2">Available Reports</h4>
                                <p className="text-xs text-zinc-500 font-medium">Select a report card below to open its preview, summary statistics, and PDF export controls.</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Operations Card */}
                                <div 
                                    onClick={() => setActiveReportView('operations')}
                                    className="bg-white border border-zinc-100 hover:border-indigo-500/30 p-6 rounded-3xl shadow-sm hover:shadow-md cursor-pointer transition-all duration-300 flex flex-col justify-between group h-64"
                                >
                                    <div>
                                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                            <Activity className="w-6 h-6 text-[#31267D]" />
                                        </div>
                                        <h5 className="font-black text-zinc-900 uppercase tracking-tight text-base mb-1.5">Operations Report</h5>
                                        <p className="text-xs text-zinc-500 leading-relaxed font-medium">Departmental task ledger, execution speeds, and operational yield audits.</p>
                                    </div>
                                    <div className="flex items-center justify-between text-[#31267D] font-bold text-xs uppercase mt-4">
                                        <span>Open Preview</span>
                                        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </div>

                                {/* Leaves Card */}
                                <div 
                                    onClick={() => setActiveReportView('leaves')}
                                    className="bg-white border border-zinc-100 hover:border-orange-500/30 p-6 rounded-3xl shadow-sm hover:shadow-md cursor-pointer transition-all duration-300 flex flex-col justify-between group h-64"
                                >
                                    <div>
                                        <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                            <Calendar className="w-6 h-6 text-[#F14D24]" />
                                        </div>
                                        <h5 className="font-black text-zinc-900 uppercase tracking-tight text-base mb-1.5">Leaves & Absences</h5>
                                        <p className="text-xs text-zinc-500 leading-relaxed font-medium">Absence requests, medical leave logs, approvals, and personnel availability lists.</p>
                                    </div>
                                    <div className="flex items-center justify-between text-[#F14D24] font-bold text-xs uppercase mt-4">
                                        <span>Open Preview</span>
                                        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </div>

                                {/* Performance Card */}
                                <div 
                                    onClick={() => setActiveReportView('performance')}
                                    className="bg-white border border-zinc-100 hover:border-emerald-500/30 p-6 rounded-3xl shadow-sm hover:shadow-md cursor-pointer transition-all duration-300 flex flex-col justify-between group h-64"
                                >
                                    <div>
                                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                            <BarChart3 className="w-6 h-6 text-emerald-600" />
                                        </div>
                                        <h5 className="font-black text-zinc-900 uppercase tracking-tight text-base mb-1.5">Performance Report</h5>
                                        <p className="text-xs text-zinc-500 leading-relaxed font-medium">Executive briefing showcasing Employee of the Month and department yields.</p>
                                    </div>
                                    <div className="flex items-center justify-between text-emerald-600 font-bold text-xs uppercase mt-4">
                                        <span>Open Preview</span>
                                        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : activeReportView === 'operations' ? (
                        /* Operations Sub-view */
                        <>
                            <div className="p-6 md:p-8 flex-1 overflow-y-auto space-y-6 bg-zinc-50/50">
                                <div className="flex items-center justify-between">
                                    <button 
                                        onClick={() => setActiveReportView('selection')}
                                        className="text-zinc-500 hover:text-zinc-800 flex items-center gap-1.5 text-xs font-bold uppercase transition-all"
                                    >
                                        <ArrowLeft className="w-4 h-4" />
                                        Back to selection
                                    </button>
                                    <span className="text-[10px] bg-indigo-50 border border-indigo-200 text-[#31267D] px-3 py-1 rounded-full font-black uppercase tracking-wider">
                                        Operations Analytics
                                    </span>
                                </div>

                                <div className="bg-white border border-zinc-100 p-6 rounded-3xl shadow-sm space-y-4">
                                    <h4 className="font-black text-zinc-900 uppercase tracking-tight text-lg">Monthly Operations Briefing</h4>
                                    <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                                        This report details task assignments, workflow milestones, and execution efficiency indicators across all functional departments of Usthad Academy.
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="bg-white border border-zinc-100 p-5 rounded-2xl shadow-sm text-center">
                                        <span className="text-[9px] font-black uppercase text-zinc-400 tracking-wider block">Sales Directives</span>
                                        <span className="text-2xl font-black text-zinc-900 mt-1 block">{operationsReportStats.sales.total}</span>
                                        <span className="text-[10px] text-emerald-600 font-bold mt-1 block">{operationsReportStats.sales.completed} Completed</span>
                                    </div>
                                    <div className="bg-white border border-zinc-100 p-5 rounded-2xl shadow-sm text-center">
                                        <span className="text-[9px] font-black uppercase text-zinc-400 tracking-wider block">Admin Tasks</span>
                                        <span className="text-2xl font-black text-zinc-900 mt-1 block">{operationsReportStats.admin.total}</span>
                                        <span className="text-[10px] text-emerald-600 font-bold mt-1 block">{operationsReportStats.admin.completed} Completed</span>
                                    </div>
                                    <div className="bg-white border border-zinc-100 p-5 rounded-2xl shadow-sm text-center">
                                        <span className="text-[9px] font-black uppercase text-zinc-400 tracking-wider block">Finance Audits</span>
                                        <span className="text-2xl font-black text-zinc-900 mt-1 block">{operationsReportStats.finance.total}</span>
                                        <span className="text-[10px] text-emerald-600 font-bold mt-1 block">{operationsReportStats.finance.completed} Completed</span>
                                    </div>
                                    <div className="bg-white border border-zinc-100 p-5 rounded-2xl shadow-sm text-center">
                                        <span className="text-[9px] font-black uppercase text-zinc-400 tracking-wider block">Marketing Campaigns</span>
                                        <span className="text-2xl font-black text-zinc-900 mt-1 block">{operationsReportStats.marketing.total}</span>
                                        <span className="text-[10px] text-emerald-600 font-bold mt-1 block">{operationsReportStats.marketing.completed} Completed</span>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Actions Footer */}
                            <div className="bg-zinc-50 px-8 py-5 flex items-center justify-end gap-3 border-t border-zinc-100 rounded-b-[28px] shrink-0">
                                <button
                                    onClick={() => downloadMonthlyOperationsReport(true)}
                                    disabled={isDownloadingOperationsReport}
                                    className="px-6 py-3.5 rounded-2xl text-[#31267D] font-black uppercase tracking-wider text-[10px] bg-[#31267D]/10 hover:bg-[#31267D]/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isDownloadingOperationsReport ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Eye className="w-4 h-4" />
                                    )}
                                    View Operations PDF
                                </button>
                                <button
                                    onClick={() => downloadMonthlyOperationsReport(false)}
                                    disabled={isDownloadingOperationsReport}
                                    className="px-6 py-3.5 rounded-2xl text-white font-black uppercase tracking-wider text-[10px] bg-[#31267D] hover:bg-[#251B60] shadow-lg shadow-indigo-500/10 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isDownloadingOperationsReport ? (
                                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                                    ) : (
                                        <FileText className="w-4 h-4 text-white" />
                                    )}
                                    Download Operations PDF
                                </button>
                                <Button variant="outline" onClick={() => setIsReportsCenterOpen(false)} className="px-6 py-5 rounded-2xl font-black uppercase tracking-wider text-[10px] border-zinc-200">
                                    Close
                                </Button>
                            </div>
                        </>
                    ) : activeReportView === 'leaves' ? (
                        /* Leaves Sub-view */
                        <>
                            <div className="p-6 md:p-8 flex-1 overflow-y-auto space-y-6 bg-zinc-50/50">
                                <div className="flex items-center justify-between">
                                    <button 
                                        onClick={() => setActiveReportView('selection')}
                                        className="text-zinc-500 hover:text-zinc-800 flex items-center gap-1.5 text-xs font-bold uppercase transition-all"
                                    >
                                        <ArrowLeft className="w-4 h-4" />
                                        Back to selection
                                    </button>
                                    <span className="text-[10px] bg-orange-50 border border-orange-200 text-[#F14D24] px-3 py-1 rounded-full font-black uppercase tracking-wider">
                                        Leaves Ledger
                                    </span>
                                </div>

                                <div className="bg-white border border-zinc-100 p-6 rounded-3xl shadow-sm space-y-4">
                                    <h4 className="font-black text-zinc-900 uppercase tracking-tight text-lg">Leave Registry Summary</h4>
                                    <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                                        A list of pending, approved, and processed absence request rosters to audit personnel availability for operational continuity.
                                    </p>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div className="bg-white border border-zinc-100 p-5 rounded-2xl shadow-sm text-center">
                                        <span className="text-[9px] font-black uppercase text-zinc-400 tracking-wider block">Total Leaves Filed</span>
                                        <span className="text-2xl font-black text-zinc-900 mt-1 block">{leavesReportStats.total}</span>
                                    </div>
                                    <div className="bg-white border border-zinc-100 p-5 rounded-2xl shadow-sm text-center">
                                        <span className="text-[9px] font-black uppercase text-zinc-400 tracking-wider block">Pending Review</span>
                                        <span className="text-2xl font-black text-amber-500 mt-1 block">{leavesReportStats.pending}</span>
                                    </div>
                                    <div className="bg-white border border-zinc-100 p-5 rounded-2xl shadow-sm text-center flex flex-col justify-center items-center">
                                        <span className="text-[9px] font-black uppercase text-zinc-400 tracking-wider block">Operational Status</span>
                                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-wider mt-2 py-0.5 px-3 bg-emerald-50 border border-emerald-500/10 rounded-full inline-block">
                                            Stable
                                        </span>
                                    </div>
                                </div>

                                {leavesReportStats.recentLeaves.length > 0 && (
                                    <div className="space-y-3">
                                        <h5 className="text-xs font-black uppercase tracking-wider text-zinc-400">Pending Leave Logs</h5>
                                        <div className="border border-zinc-100 bg-white rounded-2xl overflow-hidden shadow-sm">
                                            <table className="w-full text-left border-collapse">
                                                <thead className="bg-zinc-50 border-b border-zinc-100">
                                                    <tr>
                                                        <th className="p-3 text-[9px] font-black text-zinc-400 uppercase tracking-widest">Staff Member</th>
                                                        <th className="p-3 text-[9px] font-black text-zinc-400 uppercase tracking-widest">Leave Dates</th>
                                                        <th className="p-3 text-[9px] font-black text-zinc-400 uppercase tracking-widest">Purpose</th>
                                                        <th className="p-3 text-[9px] font-black text-zinc-400 uppercase tracking-widest text-right">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-zinc-100 text-zinc-900 text-xs">
                                                    {leavesReportStats.recentLeaves.map((l: any) => (
                                                        <tr key={l.id} className="hover:bg-zinc-50/50">
                                                            <td className="p-3 font-bold uppercase tracking-tight text-zinc-800">{l.staffName}</td>
                                                            <td className="p-3 text-zinc-500 font-medium">{l.dates}</td>
                                                            <td className="p-3 text-zinc-500 font-medium truncate max-w-[180px]">{l.purpose}</td>
                                                            <td className="p-3 text-right">
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-500/10">
                                                                    {l.status}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            {/* Actions Footer */}
                            <div className="bg-zinc-50 px-8 py-5 flex items-center justify-end gap-3 border-t border-zinc-100 rounded-b-[28px] shrink-0">
                                <button
                                    onClick={() => downloadMonthlyLeavesReport(true)}
                                    disabled={isDownloadingLeavesReport}
                                    className="px-6 py-3.5 rounded-2xl text-[#F14D24] font-black uppercase tracking-wider text-[10px] bg-[#F14D24]/10 hover:bg-[#F14D24]/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isDownloadingLeavesReport ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Eye className="w-4 h-4" />
                                    )}
                                    View Leaves PDF
                                </button>
                                <button
                                    onClick={() => downloadMonthlyLeavesReport(false)}
                                    disabled={isDownloadingLeavesReport}
                                    className="px-6 py-3.5 rounded-2xl text-white font-black uppercase tracking-wider text-[10px] bg-[#F14D24] hover:bg-[#d63f19] shadow-lg shadow-orange-500/10 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isDownloadingLeavesReport ? (
                                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                                    ) : (
                                        <Calendar className="w-4 h-4 text-white" />
                                    )}
                                    Download Leaves PDF
                                </button>
                                <Button variant="outline" onClick={() => setIsReportsCenterOpen(false)} className="px-6 py-5 rounded-2xl font-black uppercase tracking-wider text-[10px] border-zinc-200">
                                    Close
                                </Button>
                            </div>
                        </>
                    ) : (
                        /* Performance Sub-view (re-integrating existing HTML dashboard) */
                        <>
                            <div className="p-6 md:p-8 flex-1 overflow-y-auto space-y-6 bg-zinc-50/50">
                                <div className="flex items-center justify-between">
                                    <button 
                                        onClick={() => setActiveReportView('selection')}
                                        className="text-zinc-500 hover:text-zinc-800 flex items-center gap-1.5 text-xs font-bold uppercase transition-all"
                                    >
                                        <ArrowLeft className="w-4 h-4" />
                                        Back to selection
                                    </button>
                                    <span className="text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-600 px-3 py-1 rounded-full font-black uppercase tracking-wider">
                                        Executive Briefing
                                    </span>
                                </div>

                                {/* Employee of the Month Highlight Banner */}
                                {employeeOfTheMonth && (
                                    <div className="relative overflow-hidden bg-gradient-to-r from-zinc-900 to-zinc-800 rounded-3xl p-6 text-white border border-zinc-700 shadow-lg flex flex-col md:flex-row items-center justify-between gap-6">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-12 translate-x-12 pointer-events-none" />
                                        <div className="flex items-center gap-5 flex-col md:flex-row text-center md:text-left">
                                            <div className="relative shrink-0">
                                                <Avatar className="w-20 h-20 border-4 border-zinc-700 shadow-xl rounded-2xl">
                                                    <AvatarImage src={isValidAvatarUrl(employeeOfTheMonth.avatar) ? employeeOfTheMonth.avatar : undefined} />
                                                    <AvatarFallback className="text-zinc-900 font-black text-2xl bg-white">
                                                        {employeeOfTheMonth.avatar && !isValidAvatarUrl(employeeOfTheMonth.avatar)
                                                            ? employeeOfTheMonth.avatar
                                                            : employeeOfTheMonth.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="absolute -bottom-2 -right-2 bg-[#F14D24] text-white p-1.5 rounded-xl shadow-md border border-zinc-800">
                                                    <Star className="w-4 h-4 fill-white stroke-[2.5px]" />
                                                </div>
                                            </div>
                                            <div className="space-y-1 min-w-0">
                                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase bg-[#F14D24] text-white tracking-widest mb-1.5 shadow-md">
                                                    Employee of the Month
                                                </div>
                                                <h4 className="text-xl font-black uppercase tracking-tight truncate">{employeeOfTheMonth.name}</h4>
                                                <p className="text-xs font-bold text-zinc-300 uppercase tracking-widest">{employeeOfTheMonth.role} • {employeeOfTheMonth.department}</p>
                                            </div>
                                        </div>
                                        <div className="text-center md:text-right shrink-0 bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-md min-w-[180px]">
                                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Operations Velocity</p>
                                            <p className="text-3xl font-black text-white">{employeeOfTheMonth.tasksCompleted} <span className="text-xs font-normal text-zinc-400">Tasks Done</span></p>
                                            <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mt-1">
                                                {employeeOfTheMonth.tasksTotal > 0 ? Math.round((employeeOfTheMonth.tasksCompleted / employeeOfTheMonth.tasksTotal) * 100) : 100}% Yield Rate
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Institutional Metrics Grid */}
                                <div className="space-y-3">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-zinc-400">Institutional Performance</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                        <div className="bg-white border border-zinc-100 p-5 rounded-2xl shadow-sm text-center flex flex-col justify-center">
                                            <span className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">Active Staff</span>
                                            <span className="text-2xl font-black text-zinc-900 mt-1">{stats.total}</span>
                                        </div>
                                        <div className="bg-white border border-zinc-100 p-5 rounded-2xl shadow-sm text-center flex flex-col justify-center">
                                            <span className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">Assigned Directives</span>
                                            <span className="text-2xl font-black text-zinc-900 mt-1">{totalTasksAssigned}</span>
                                        </div>
                                        <div className="bg-white border border-zinc-100 p-5 rounded-2xl shadow-sm text-center flex flex-col justify-center">
                                            <span className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">Completed Tasks</span>
                                            <span className="text-2xl font-black text-emerald-600 mt-1">{totalTasksCompleted}</span>
                                        </div>
                                        <div className="bg-white border border-zinc-100 p-5 rounded-2xl shadow-sm text-center flex flex-col justify-center">
                                            <span className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">Critical Delays</span>
                                            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-wider mt-2.5 py-0.5 px-2 bg-emerald-50 border border-emerald-500/10 rounded-full inline-block mx-auto">
                                                0 • Stable
                                            </span>
                                        </div>
                                        <div className="bg-white border border-zinc-100 p-5 rounded-2xl shadow-sm text-center flex flex-col justify-center col-span-2 md:col-span-1">
                                            <span className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">Velocity</span>
                                            <span className="text-2xl font-black text-[#31267D] mt-1">{operationalVelocity}%</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Full Breakdown Table */}
                                <div className="space-y-3">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-zinc-400">Personnel Yield Audit</h4>
                                    <div className="border border-zinc-100 bg-white rounded-2xl overflow-hidden shadow-sm max-h-[300px] overflow-y-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="bg-zinc-50 border-b border-zinc-100 sticky top-0 z-10">
                                                <tr>
                                                    <th className="p-4 text-[9px] font-black text-zinc-400 uppercase tracking-widest">Personnel Profile</th>
                                                    <th className="p-4 text-[9px] font-black text-zinc-400 uppercase tracking-widest text-center">Assigned</th>
                                                    <th className="p-4 text-[9px] font-black text-zinc-400 uppercase tracking-widest text-center">Completed</th>
                                                    <th className="p-4 text-[9px] font-black text-zinc-400 uppercase tracking-widest text-center">Pending</th>
                                                    <th className="p-4 text-[9px] font-black text-zinc-400 uppercase tracking-widest text-right">Yield Velocity</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-zinc-100 text-zinc-900">
                                                {staffData.map((s) => {
                                                    const pending = s.tasksTotal - s.tasksCompleted;
                                                    const yieldRate = s.tasksTotal > 0 ? Math.round((s.tasksCompleted / s.tasksTotal) * 100) : 100;
                                                    return (
                                                        <tr key={s.id} className="hover:bg-zinc-50/50 transition-colors">
                                                            <td className="p-4">
                                                                <div className="flex items-center gap-3">
                                                                    <Avatar className="w-8 h-8 border border-zinc-100 shadow-sm rounded-lg">
                                                                        <AvatarImage src={isValidAvatarUrl(s.avatar) ? s.avatar : undefined} />
                                                                        <AvatarFallback className="text-white font-black text-[10px]" style={{ backgroundColor: BRAND_COLORS.indigo }}>
                                                                            {s.avatar && !isValidAvatarUrl(s.avatar)
                                                                                ? s.avatar
                                                                                : s.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                                                                        </AvatarFallback>
                                                                    </Avatar>
                                                                    <div className="min-w-0">
                                                                        <p className="font-bold text-xs text-zinc-950 uppercase tracking-tight truncate">{s.name}</p>
                                                                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">{s.role}</p>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="p-4 text-xs font-bold text-zinc-600 text-center">{s.tasksTotal}</td>
                                                            <td className="p-4 text-xs font-bold text-emerald-600 text-center">{s.tasksCompleted}</td>
                                                            <td className="p-4 text-xs font-bold text-zinc-500 text-center">{pending}</td>
                                                            <td className="p-4 text-right">
                                                                <span className={cn(
                                                                    "inline-flex items-center px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-wider",
                                                                    yieldRate >= 80 ? "bg-emerald-50 text-emerald-600 border border-emerald-500/10" :
                                                                    yieldRate >= 50 ? "bg-amber-50 text-amber-600 border border-amber-500/10" :
                                                                    "bg-red-50 text-red-600 border border-red-500/10"
                                                                )}>
                                                                    {yieldRate}% Yield
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Actions Footer */}
                            <div className="bg-zinc-50 px-8 py-5 flex items-center justify-end gap-3 border-t border-zinc-100 rounded-b-[28px] shrink-0 font-sans">
                                <button
                                    onClick={() => downloadTaskReport("monthly")}
                                    disabled={exporting === "general"}
                                    className="px-6 py-3.5 rounded-2xl text-white font-black uppercase tracking-wider text-[10px] bg-[#31267D] hover:bg-[#251B60] shadow-lg shadow-indigo-500/10 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {exporting === "general" ? (
                                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                                    ) : (
                                        <FileText className="w-4 h-4 text-white" />
                                    )}
                                    Download Performance PDF
                                </button>
                                <Button variant="outline" onClick={() => setIsReportsCenterOpen(false)} className="px-6 py-5 rounded-2xl font-black uppercase tracking-wider text-[10px] border-zinc-200">
                                    Close
                                </Button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default StaffManagement;
