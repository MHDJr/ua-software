"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, Plus, Star, CheckCircle2, Clock, XCircle, Wifi, Building2, Pencil, Trash2, Loader2, X, Mail, Users, FileText, BarChart3 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
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
    const [searchQuery, setSearchQuery] = useState("");
    const [hoveredRow, setHoveredRow] = useState<string | null>(null);
    const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
    const [exporting, setExporting] = useState<string | null>(null);
    const [selectedStaffForReport, setSelectedStaffForReport] = useState<StaffMember | null>(null);
    const [isReportOpen, setIsReportOpen] = useState(false);
    const [isMonthlyReportOpen, setIsMonthlyReportOpen] = useState(false);

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

    const downloadPdfReport = (staff: StaffMember) => {
        toast.loading(`Compiling PDF performance audit for ${staff.name}...`);
        try {
            const doc = new jsPDF({
                orientation: "portrait",
                unit: "mm",
                format: "a4"
            });

            let yPos = 20;

            // Brand colors
            const primaryColor = "#31267D"; // Usthad Navy
            const secondaryColor = "#F14D24"; // Usthad Orange
            const darkGray = "#1F2937";
            const lightGray = "#4B5563";
            const borderGray = "#E5E7EB";

            // Decorative background elements
            doc.setFillColor(49, 38, 125); // #31267D
            doc.rect(0, 0, 210, 12, "F"); // Navy Top bar

            yPos = 25;

            // Header Title
            doc.setFont("helvetica", "bold");
            doc.setFontSize(22);
            doc.setTextColor(primaryColor);
            doc.text("USTHAD ACADEMY", 15, yPos);
            
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(secondaryColor);
            doc.text("COMMAND CENTER OS • STAFF PERFORMANCE AUDIT", 15, yPos + 6);

            // Date and Period
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(darkGray);
            const reportTitle = "PERSONNEL RECORD REPORT";
            doc.text(reportTitle, 195 - doc.getTextWidth(reportTitle), yPos);

            const dateStr = `Audit Date: ${new Date().toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' })}`;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(lightGray);
            doc.text(dateStr, 195 - doc.getTextWidth(dateStr), yPos + 6);

            // Divider
            yPos += 12;
            doc.setDrawColor(229, 231, 235);
            doc.setLineWidth(0.5);
            doc.line(15, yPos, 195, yPos);

            // Profile Section
            yPos += 10;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.setTextColor(primaryColor);
            doc.text("PERSONNEL PROFILE", 15, yPos);

            yPos += 6;
            // Profile Info Cards (Left: Details, Right: Summary Stats)
            doc.setFillColor(249, 250, 251);
            doc.roundedRect(15, yPos, 100, 36, 3, 3, "F");
            
            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.setTextColor(darkGray);
            doc.text(staff.name.toUpperCase(), 20, yPos + 8);
            
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(secondaryColor);
            doc.text(staff.role.toUpperCase(), 20, yPos + 14);
            
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(lightGray);
            doc.text(`Department: ${staff.department}`, 20, yPos + 21);
            doc.text(`Email: ${staff.email || 'N/A'}`, 20, yPos + 27);
            doc.text(`Phone: ${staff.phone || 'N/A'}`, 20, yPos + 32);

            // Summary Stats block (Right side)
            doc.setFillColor(243, 244, 246);
            doc.roundedRect(120, yPos, 75, 36, 3, 3, "F");

            const totalAssigned = staffTasks.length;
            const totalCompleted = staffTasks.filter(t => (t.status || "").toUpperCase() === "COMPLETED").length;
            const completionRate = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 100;

            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(primaryColor);
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
            doc.setFontSize(13);
            doc.setTextColor(primaryColor);
            doc.text("ASSIGNED OBJECTIVE DIRECTIVES & TASKS", 15, yPos);

            yPos += 6;

            // Minimalist Table Header
            doc.setFillColor(49, 38, 125); // Primary Theme Color Navy
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
                    if (yPos > 260) {
                        doc.addPage();
                        yPos = 20;

                        // Draw header top bar on new page
                        doc.setFillColor(49, 38, 125);
                        doc.rect(0, 0, 210, 12, "F");
                        yPos = 22;

                        // Redraw Table Header on new page
                        doc.setFillColor(49, 38, 125);
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

            // Add verification / signature line at the bottom if enough space
            if (yPos > 240) {
                doc.addPage();
                yPos = 25;
                // Draw header top bar on new page
                doc.setFillColor(49, 38, 125);
                doc.rect(0, 0, 210, 12, "F");
            }

            yPos += 15;
            doc.setDrawColor(209, 213, 219);
            doc.setLineWidth(0.2);
            doc.line(15, yPos, 80, yPos);
            doc.line(130, yPos, 195, yPos);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(lightGray);
            doc.text("PREPARED BY (ADMINISTRATOR/CEO)", 15, yPos + 5);
            doc.text("PERSONNEL SIGN-OFF", 130, yPos + 5);

            doc.setFont("helvetica", "italic");
            doc.setFontSize(7);
            doc.setTextColor(lightGray);
            const footerMsg = "This is a computer-generated performance audit record from Usthad Academy Command Center OS.";
            doc.text(footerMsg, 105 - doc.getTextWidth(footerMsg) / 2, 285);

            // Download document
            doc.save(`Performance_Report_${staff.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
            toast.dismiss();
            toast.success("Performance Audit PDF downloaded successfully!");
        } catch (err: any) {
            console.error("PDF download failure:", err);
            toast.dismiss();
            toast.error("Failed to generate PDF download.");
        }
    };



    const [staffToDelete, setStaffToDelete] = useState<StaffMember | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [confirmName, setConfirmName] = useState("");

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
                role: profile.designation || profile.role || "Staff",
                department: profile.department || "General",
                status: mapProfileStatus(profile.status),
                tasksCompleted: stats.completed,
                tasksTotal: stats.total || 0, 
                rating: Math.round(calculateRating(stats.completed, stats.total || 0) * 10) / 10,
                avatar: profile.avatar_url || "",
                email: profile.email || "",
                phone: profile.phone || "",
            };
        });

        // Sort by performance rank
        return mappedStaff.sort((a, b) => {
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

            // 2. Cascade delete from database
            const { error: cascadeError } = await supabase.rpc('delete_profile_cascade', {
                profile_uuid: staffToDelete.id
            });

            if (cascadeError) {
                await supabase.from("tasks").update({ assigned_to: null }).eq("assigned_to", staffToDelete.id);
                const { error: deleteError } = await supabase.from("profiles").delete().eq("id", staffToDelete.id);
                if (deleteError) {
                    await supabase.from("profiles").update({ full_name: "[DELETED]", status: "offline" }).eq("id", staffToDelete.id);
                }
            }

            toast.success("Personnel terminated successfully");
            setIsDeleteModalOpen(false);
            setStaffToDelete(null);
            setConfirmName("");
            queryClient.invalidateQueries();
        } catch (e) {
            console.error("Deletion error:", e);
            toast.error("Failed to delete staff member");
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
                                onClick={() => setIsMonthlyReportOpen(true)}
                                className="bg-white border border-zinc-200 text-zinc-900 px-4 py-2 rounded-xl text-sm font-bold shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:bg-zinc-50 transition-all flex items-center justify-center gap-2 shrink-0 h-11"
                            >
                                <BarChart3 className="w-4 h-4 text-zinc-600" />
                                View Monthly Report
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
                    onApprove={async (id) => {
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
                                {profile?.role === "ceo" && (
                                    <button 
                                        onClick={() => downloadTaskReport("weekly")}
                                        disabled={exporting === "general"}
                                        className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3.5 rounded-2xl text-zinc-600 dark:text-zinc-400 hover:text-blue-500 active:scale-95 transition-all shadow-sm shrink-0 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider disabled:opacity-50"
                                        title="Download Tasks Performance Report"
                                    >
                                        {exporting === "general" ? (
                                            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                        ) : (
                                            <FileText className="w-4 h-4 text-[#31267D]" />
                                        )}
                                        <span className="hidden sm:inline">Export Audit</span>
                                    </button>
                                )}
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
                                                        <AvatarImage src={staff.avatar} />
                                                        <AvatarFallback className="text-white font-black" style={{ backgroundColor: BRAND_COLORS.indigo }}>
                                                            {staff.name.split(" ").map(n => n[0]).join("").slice(0,2)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    {index === 0 && (
                                                        <span className="absolute -top-2 -left-2 bg-[#F14D24] text-white text-[7px] font-black uppercase tracking-wider px-1 py-0.5 rounded-md border border-white shadow-sm">
                                                            Best
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        {index === 0 ? (
                                                            <span className="text-base" title="Best Employee">🥇</span>
                                                        ) : index === 1 ? (
                                                            <span className="text-base" title="2nd Place">🥈</span>
                                                        ) : index === 2 ? (
                                                            <span className="text-base" title="3rd Place">🥉</span>
                                                        ) : (
                                                            <span className="text-[9px] font-black text-gray-400">#{index + 1}</span>
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
                                                <Button variant="ghost" onClick={() => { setStaffToDelete(staff); setIsDeleteModalOpen(true); }} className="h-8 px-3 rounded-xl text-red-600 font-black uppercase text-[8px] gap-1.5">
                                                    <Trash2 className="w-3 h-3" /> Terminate
                                                </Button>
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
                                    <th className="text-left py-5 px-8 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Status</th>
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
                                                    {index === 0 ? (
                                                        <span className="text-xl" title="Best Employee">🥇</span>
                                                    ) : index === 1 ? (
                                                        <span className="text-xl" title="2nd Place">🥈</span>
                                                    ) : index === 2 ? (
                                                        <span className="text-xl" title="3rd Place">🥉</span>
                                                    ) : (
                                                        <span className="text-xs font-black text-gray-400">#{index + 1}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-5 px-8">
                                                <div className="flex items-center gap-4">
                                                    <div className="relative shrink-0">
                                                        <Avatar className="w-10 h-10 border-2 border-white shadow-sm rounded-xl">
                                                            <AvatarImage src={staff.avatar} />
                                                            <AvatarFallback className="text-white text-xs font-black" style={{ backgroundColor: BRAND_COLORS.indigo }}>
                                                                {staff.name.split(" ").map(n => n[0]).join("")}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        {index === 0 && (
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
                                                <span className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest", style.bg, style.text)}>
                                                    <style.icon className="w-3 h-3 stroke-[3px]" />
                                                    {staff.status}
                                                </span>
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
                                                        <button 
                                                            onClick={() => { setStaffToDelete(staff); setIsDeleteModalOpen(true); }} 
                                                            className="p-2 rounded-xl transition-all duration-300 hover:bg-red-50 dark:hover:bg-red-950/20 text-gray-400 hover:text-red-600"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
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

            {/* Staff Report Dialog */}
            <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
                <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-[28px] border-0 bg-white shadow-2xl flex flex-col max-h-[85vh]">
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
                                        <AvatarImage src={selectedStaffForReport.avatar} />
                                        <AvatarFallback className="text-white font-black text-2xl" style={{ backgroundColor: BRAND_COLORS.indigo }}>
                                            {selectedStaffForReport.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
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
                            <Button 
                                onClick={() => downloadPdfReport(selectedStaffForReport)}
                                className="px-6 py-5 rounded-2xl text-white font-black uppercase tracking-wider text-[10px] bg-[#31267D] hover:bg-[#251B60] shadow-lg shadow-indigo-500/10 flex items-center gap-2"
                            >
                                <FileText className="w-4 h-4 stroke-[2.5px]" />
                                Download PDF Report
                            </Button>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Monthly Report Dialog */}
            <Dialog open={isMonthlyReportOpen} onOpenChange={setIsMonthlyReportOpen}>
                <DialogContent className="max-w-3xl p-0 overflow-hidden rounded-[28px] border-0 bg-white shadow-2xl flex flex-col max-h-[85vh]">
                    {/* Header */}
                    <div className="bg-zinc-950 text-white p-6 relative flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
                                <BarChart3 className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="text-base font-black uppercase tracking-widest">Monthly Performance Report</h3>
                                <p className="text-[9px] uppercase font-bold text-zinc-400 tracking-widest mt-0.5">Usthad Academy OS • Executive Briefing</p>
                            </div>
                        </div>
                        <button onClick={() => setIsMonthlyReportOpen(false)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 active:scale-95 transition-all">
                            <X className="w-4 h-4 text-white" />
                        </button>
                    </div>

                    <div className="p-6 md:p-8 flex-1 overflow-y-auto space-y-8 bg-zinc-50/50">
                        {/* Employee of the Month Highlight Banner */}
                        {employeeOfTheMonth && (
                            <div className="relative overflow-hidden bg-gradient-to-r from-zinc-900 to-zinc-800 rounded-3xl p-6 text-white border border-zinc-700 shadow-lg flex flex-col md:flex-row items-center justify-between gap-6">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-12 translate-x-12 pointer-events-none" />
                                <div className="flex items-center gap-5 flex-col md:flex-row text-center md:text-left">
                                    <div className="relative shrink-0">
                                        <Avatar className="w-20 h-20 border-4 border-zinc-700 shadow-xl rounded-2xl">
                                            <AvatarImage src={employeeOfTheMonth.avatar} />
                                            <AvatarFallback className="text-zinc-900 font-black text-2xl bg-white">
                                                {employeeOfTheMonth.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
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
                                                                <AvatarImage src={s.avatar} />
                                                                <AvatarFallback className="text-white font-black text-[10px]" style={{ backgroundColor: BRAND_COLORS.indigo }}>
                                                                    {s.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
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

                    {/* Footer Actions */}
                    <div className="bg-zinc-50 px-8 py-5 flex items-center justify-end gap-3 border-t border-zinc-100 rounded-b-[28px] shrink-0">
                        <Button variant="outline" onClick={() => setIsMonthlyReportOpen(false)} className="px-6 py-5 rounded-2xl font-black uppercase tracking-wider text-[10px] border-zinc-200">
                            Close
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default StaffManagement;
