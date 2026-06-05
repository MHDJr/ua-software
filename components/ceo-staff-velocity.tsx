"use client";

import React, { useState, useEffect } from "react";
import {
    Users,
    TrendingUp,
    Target,
    RefreshCw,
    Trophy,
    Award,
    FileText,
    Download,
    AlertCircle,
    Calendar,
    CheckCircle2,
    Clock,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn, isValidAvatarUrl } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { jsPDF } from "jspdf";

// Brand colors
const BRAND = {
    navy: "#2F1E73",
    orange: "#FA4615",
    lightNavy: "#3F348C",
    softOrange: "#FEF2EE",
    bg: "#F4F7FE",
};

// Official colored Brand Logo SVG in base64
const BRAND_LOGO_BASE64 = "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4NCjwhLS0gR2VuZXJhdG9yOiBBZG9iZSBJbGx1c3RyYXRvciAyNS4wLjAsIFNWRyBFeHBvcnQgUGx1Zy1JbiAuIFNWRyBWZXJzaW9uOiA2LjAwIEJ1aWxkIDApICAtLT4NCjxzdmcgdmVyc2lvbj0iMS4xIiBpZD0iTGF5ZXJfMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgeD0iMHB4IiB5PSIwcHgiDQoJIHZpZXdCb3g9IjAgMCA3NzkuMSA3NzkuMSIgc3R5bGU9ImVuYWJsZS1iYWNrZ3JvdW5kOm5ldyAwIDAgNzc5LjEgNzc5LjE7IiB4bWw6c3BhY2U9InByZXNlcnZlIj4NCjxzdHlsZSB0eXBlPSJ0ZXh0L2NzcyI+DQoJLnN0MHtmaWxsOiNFRjRBMjQ7fQ0KCS5zdDF7ZmlsbDojMkYxRTczO30NCjwvc3R5bGU+DQo8ZyBpZD0iQXJ0d29yayI+DQoJPHBhdGggY2xhc3M9InN0MCIgZD0iTTcwNS44LDM2NS44VjQzOGMwLDExMy44LTYwLjksMjE0LTE1MS42LDI2OS43Yy00OS41LDMwLjUtMTA2LjUsNDYuNi0xNjQuNiw0Ni41bDAsMA0KCQljLTU4LjEsMC4xLTExNS4xLTE2LjEtMTY0LjYtNDYuNUMxMzQuMiw2NTIsNzMuMyw1NTEuOCw3My4zLDQzOHYtNzIuMmMwLTgzLjQsMzIuOC0xNTkuNiw4Ni4xLTIxNi4zYzcuNC03LjksMjAuNC0wLjQsMTcuNiwxMC4xDQoJCWMtNS4xLDE4LjgtNy43LDM4LjItNy43LDU3LjdWNDM4YzAsMzEsNi41LDYxLjYsMTkuMiw4OS45YzM0LjUsNzYuOCwxMTEuNywxMzAuNCwyMDEuMSwxMzAuNHMxNjYuNy01My42LDIwMS4xLTEzMC40DQoJCWMxMi43LTI4LjMsMTkuMi01OC45LDE5LjItODkuOVYyMTcuM2MwLTE5LjUtMi42LTM4LjktNy43LTU3LjdjLTIuOS0xMC41LDEwLjEtMTgsMTcuNS0xMC4xQzY3MywyMDYuMSw3MDUuOCwyODIuMyw3MDUuOCwzNjUuOHoiDQoJCS8+DQoJPHBhdGggY2xhc3M9InN0MSIgZD0iTTU1Mi4yLDk3LjFjLTM3LTQ2LjctOTguNi03Mi4zLTE2Mi43LTcyLjNzLTEyNS45LDI1LjMtMTYyLjksNzJjLTI3LjMsMzQuNC0zOC44LDgyLjUtMzguOCwxMjkuN3YyMjAuOA0KCQljMCw0LjcsMC4yLDkuMywwLjUsMTRjMC42LDguOCwxMi44LDEwLjgsMTYuMiwyLjdjMzAuMy03MS41LDEwMy4yLTEzNi4xLDE4NS0xMzYuMWM4Mi4zLDAsMTUxLjQsNjEuNSwxODQsMTM1LjkNCgkJYzMuOCw4LjYsMTYuNyw2LjMsMTcuMy0zYzAuMy00LjQsMC40LTguOSwwLjQtMTMuNFYyMjYuNkM1OTEuMywxNzkuNCw1NzkuNSwxMzEuNSw1NTIuMiw5Ny4xeiBNMzg5LjUsMjgwLjQNCgkJYy00Mi40LDAtNzYuOC0zNC40LTc2LjgtNzYuOXMzNC40LTc2LjgsNzYuOS03Ni44czc2LjgsMzQuNCw3Ni44LDc2LjljMCwwLDAsMCwwLDBDNDY2LjQsMjQ2LDQzMiwyODAuNCwzODkuNSwyODAuNA0KCQlDMzg5LjYsMjgwLjQsMzg5LjYsMjgwLjQsMzg5LjUsMjgwLjR6Ii8+DQo8L2c+DQo8L3N2Zz4NCg==";

// Draw custom header banner with Brand Logo on generated PDF reports
const drawHeaderBanner = (doc: jsPDF, pageNum: number, logoPng: string | null) => {
    const primaryColor = [47, 30, 115];   // #2F1E73
    const secondaryColor = [250, 70, 21]; // #FA4615

    // Top banner background
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 210, 35, "F");

    // Brand Logo inside white box
    doc.setFillColor(255, 255, 255);
    doc.rect(14, 8, 18, 18, "F");
    
    if (logoPng) {
        try {
            doc.addImage(logoPng, 'PNG', 15.5, 9.5, 15, 15);
        } catch (err) {
            console.error("Error drawing brand logo:", err);
            // Fallback UA block
            doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
            doc.rect(16, 10, 14, 14, "F");
            doc.setTextColor(255, 255, 255);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.text("UA", 19, 19);
        }
    } else {
        // Fallback vector drawing UA text if image is not loaded yet
        doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
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
    doc.setFontSize(9);
    doc.text("EXECUTIVE SALES INTELLIGENCE SYSTEM", 38, 23);

    // Date Generated
    const dateStr = new Date().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric"
    });
    doc.setFontSize(8);
    doc.setTextColor(200, 200, 200);
    doc.text(`Generated: ${dateStr}`, 155, 29);
    
    if (pageNum > 1) {
        doc.text(`Page ${pageNum}`, 190, 15);
    }
};

interface StaffMember {
    id: string;
    full_name: string;
    email: string;
    role: string;
    department?: string;
    designation?: string;
    avatar_url?: string;
}

interface StaffVelocityData {
    staff: StaffMember;
    target_value: number;
    current_progress: number;
    achievement_percentage: number;
}

export function CEOStaffVelocity() {
    const { profile } = useAuth();
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

    const [staffData, setStaffData] = useState<StaffVelocityData[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Modal state for individual staff performance report
    const [selectedStaff, setSelectedStaff] = useState<StaffVelocityData | null>(null);
    const [isStaffReportOpen, setIsStaffReportOpen] = useState(false);
    const [staffLogs, setStaffLogs] = useState<any[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [timeframe, setTimeframe] = useState<"daily" | "weekly" | "monthly">("monthly");

    useEffect(() => {
        loadStaffVelocity();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timeframe]);

    const loadStaffVelocity = async () => {
        setLoading(true);
        try {
            // Get all staff members
            const { data: staffMembers, error: staffError } = await supabase
                .from('profiles')
                .select('id, full_name, email, role, department, designation, avatar_url');

            if (staffError) {
                console.error('Error fetching staff:', staffError);
                setLoading(false);
                return;
            }

            // Calculate firstDay and lastDay dynamically based on selected timeframe
            const today = new Date();
            let firstDay = "";
            let lastDay = "";

            if (timeframe === "daily") {
                firstDay = today.toISOString().split('T')[0];
                lastDay = firstDay;
            } else if (timeframe === "weekly") {
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(today.getDate() - 6);
                firstDay = sevenDaysAgo.toISOString().split('T')[0];
                lastDay = today.toISOString().split('T')[0];
            } else { // monthly
                firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
                lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
            }

            const { data: dailyReports, error: dailyReportsError } = await supabase
                .from('daily_reports')
                .select('profile_id, conversions')
                .gte('report_date', firstDay)
                .lte('report_date', lastDay);

            if (dailyReportsError) {
                console.error('Error fetching daily reports:', dailyReportsError);
            }

            // Calculate actual conversions from daily reports for the current month
            const actualConversionsMap: { [key: string]: number } = {};
            if (dailyReports) {
                dailyReports.forEach(report => {
                    const profileId = report.profile_id;
                    const convs = Number(report.conversions) || 0;
                    actualConversionsMap[profileId] = (actualConversionsMap[profileId] || 0) + convs;
                });
            }

            // Combine staff data with their targets
            const velocityData: StaffVelocityData[] = staffMembers?.map(staff => {
                const conversions = actualConversionsMap[staff.id] || 0;
                return {
                    staff: {
                        ...staff,
                        department: (staff.department || staff.role) as any
                    },
                    target_value: 0,
                    current_progress: conversions,
                    achievement_percentage: 0
                };
            }) || [];

            setStaffData(velocityData);
        } catch (error) {
            console.error('Error loading staff velocity:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadStaffVelocity();
        setRefreshing(false);
    };

    const getProgressColor = (percentage: number) => {
        if (percentage >= 80) return "from-emerald-500 to-emerald-600";
        if (percentage >= 50) return "from-orange-400 to-orange-500";
        if (percentage >= 25) return "from-amber-400 to-amber-500";
        return "from-indigo-500 to-indigo-600";
    };

    // Filter and sort staff data - only sales staff and sales department, sorted by conversions descending
    const salesStaffData = staffData
        .filter(staff => 
            staff.staff.role === 'sales' || 
            staff.staff.department?.toLowerCase() === 'sales'
        )
        .sort((a, b) => b.current_progress - a.current_progress);

    // Find best sales performer (highest total conversions)
    const bestSalesPerformer = salesStaffData.reduce((best, current) => 
        current.current_progress > best.current_progress ? current : best, 
        salesStaffData[0]
    );

    const getProgressWidth = (percentage: number) => {
        return Math.min(percentage, 100);
    };

    const formatProgressText = (staff: StaffVelocityData) => {
        return `${staff.current_progress} / ${staff.target_value} conversions`;
    };

    // individual Staff Performance Report Modal Trigger
    const handleGenerateStaffReport = async (staff: StaffVelocityData) => {
        setSelectedStaff(staff);
        setIsStaffReportOpen(true);
        setLoadingLogs(true);
        try {
            const currentMonth = new Date();
            const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).toISOString().split('T')[0];
            const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).toISOString().split('T')[0];

            const { data, error } = await supabase
                .from('daily_reports')
                .select('*')
                .eq('profile_id', staff.staff.id)
                .gte('report_date', firstDay)
                .lte('report_date', lastDay)
                .order('report_date', { ascending: false });

            if (!error && data) {
                setStaffLogs(data);
            } else {
                setStaffLogs([]);
            }
        } catch (e) {
            console.error("Error loading logs for report:", e);
            setStaffLogs([]);
        } finally {
            setLoadingLogs(false);
        }
    };

    // jsPDF - Generate Professional Single Staff Report PDF
    const downloadSingleStaffPDF = () => {
        if (!selectedStaff) return;
        
        try {
            const doc = new jsPDF({
                orientation: "portrait",
                unit: "mm",
                format: "a4"
            });

            const primaryColor = [47, 30, 115];   // #2F1E73
            const secondaryColor = [250, 70, 21]; // #FA4615
            const textColor = [30, 41, 59];      // #1E293B
            const lightGray = [241, 245, 249];    // #F1F5F9
            let pageNum = 1;

            // --- PAGE 1: COVER & OVERVIEW ---
            
            // Draw Header Banner on page 1
            drawHeaderBanner(doc, 1, logoPng);

            // Document Title
            doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(22);
            doc.text("SALES PERFORMANCE REPORT", 14, 50);
            
            doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
            doc.rect(14, 53, 40, 2, "F");

            // Profile Details Card
            doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
            doc.rect(14, 60, 182, 45, "F");

            doc.setTextColor(textColor[0], textColor[1], textColor[2]);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.text("AGENT PROFILE", 20, 68);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.text(`Name:`, 20, 76);
            doc.setFont("helvetica", "bold");
            doc.text(`${selectedStaff.staff.full_name || selectedStaff.staff.email}`, 45, 76);

            doc.setFont("helvetica", "normal");
            doc.text(`Email:`, 20, 82);
            doc.text(`${selectedStaff.staff.email}`, 45, 82);

            doc.text(`Designation:`, 20, 88);
            doc.text(`${(selectedStaff.staff.designation || 'Sales Representative').toUpperCase()}`, 45, 88);

            doc.text(`Department:`, 20, 94);
            doc.text(`${(selectedStaff.staff.department || 'Sales').toUpperCase()}`, 45, 94);

            // Right Column inside profile card
            doc.setFont("helvetica", "normal");
            doc.text(`Performance Period:`, 110, 76);
            doc.setFont("helvetica", "bold");
            doc.text(`${new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }).toUpperCase()}`, 148, 76);

            doc.setFont("helvetica", "normal");
            doc.text(`Total Conversions:`, 110, 82);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
            doc.text(`${selectedStaff.current_progress} Achieved`, 148, 82);

            // Sales Summary Block
            doc.setTextColor(textColor[0], textColor[1], textColor[2]);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.text("SALES PERFORMANCE SUMMARY", 14, 120);

            doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
            doc.rect(14, 126, 182, 16, "F");

            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(textColor[0], textColor[1], textColor[2]);
            doc.text("Total achieved conversions for this month:", 20, 136);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]); // Orange
            doc.text(`${selectedStaff.current_progress} Conversions`, 140, 136);

            // Daily Ledger Log Section
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.setTextColor(textColor[0], textColor[1], textColor[2]);
            doc.text("DAILY REPORT LOG HISTORY (CURRENT MONTH)", 14, 155);

            // Drawing Table Headers
            const headers = ["Date", "Total Leads", "Evaluations Taken", "Conversions", "Conversion Rate", "Quality Score"];
            const colWidths = [35, 25, 38, 28, 32, 24]; // Total = 182
            const startX = 14;
            let currentY = 162;

            doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
            doc.rect(startX, currentY, 182, 8, "F");

            doc.setTextColor(255, 255, 255);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            let xOffset = startX;
            headers.forEach((h, idx) => {
                const alignOffset = idx > 0 ? colWidths[idx] / 2 : 5; // Left align date, center align others
                doc.text(h, xOffset + (idx > 0 ? alignOffset : 2), currentY + 5.5, { align: idx > 0 ? "center" : "left" });
                xOffset += colWidths[idx];
            });

            currentY += 8;

            // Drawing Table Rows
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.5);

            if (staffLogs.length === 0) {
                doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
                doc.rect(startX, currentY, 182, 12, "F");
                doc.setTextColor(120, 120, 120);
                doc.text("No daily sales log records submitted by this agent during the current active month.", 105, currentY + 7.5, { align: "center" });
            } else {
                staffLogs.forEach((rep, rIdx) => {
                    // Alternate row background colors
                    if (rIdx % 2 === 0) {
                        doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
                    } else {
                        doc.setFillColor(255, 255, 255);
                    }
                    doc.rect(startX, currentY, 182, 8, "F");

                    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
                    const formattedDate = new Date(rep.report_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                    
                    // Draw row cells
                    xOffset = startX;
                    // Date (Left)
                    doc.text(formattedDate, xOffset + 2, currentY + 5.5);
                    xOffset += colWidths[0];
                    
                    // Leads (Center)
                    doc.text((rep.total_leads || 0).toString(), xOffset + colWidths[1]/2, currentY + 5.5, { align: "center" });
                    xOffset += colWidths[1];

                    // Evals (Center)
                    doc.text((rep.evaluations_taken || 0).toString(), xOffset + colWidths[2]/2, currentY + 5.5, { align: "center" });
                    xOffset += colWidths[2];

                    // Convs (Center)
                    doc.text((rep.conversions || 0).toString(), xOffset + colWidths[3]/2, currentY + 5.5, { align: "center" });
                    xOffset += colWidths[3];

                    // Conversion rate % (Center)
                    const rate = rep.total_leads > 0 ? Math.round((rep.conversions / rep.total_leads) * 100) : 0;
                    doc.text(`${rate}%`, xOffset + colWidths[4]/2, currentY + 5.5, { align: "center" });
                    xOffset += colWidths[4];

                    // Quality score (Center)
                    doc.text(`${rep.lead_quality_rating || 0}/10`, xOffset + colWidths[5]/2, currentY + 5.5, { align: "center" });

                    currentY += 8;

                    // Handle page overflow if logs are too long
                    if (currentY > 260 && rIdx < staffLogs.length - 1) {
                        doc.addPage();
                        pageNum += 1;
                        drawHeaderBanner(doc, pageNum, logoPng);
                        
                        currentY = 45; // Start below header banner
                        
                        // Redraw table headers on new page
                        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
                        doc.rect(startX, currentY, 182, 8, "F");
                        doc.setTextColor(255, 255, 255);
                        doc.setFont("helvetica", "bold");
                        xOffset = startX;
                        headers.forEach((h, idx) => {
                            const alignOffset = idx > 0 ? colWidths[idx] / 2 : 5;
                            doc.text(h, xOffset + (idx > 0 ? alignOffset : 2), currentY + 5.5, { align: idx > 0 ? "center" : "left" });
                            xOffset += colWidths[idx];
                        });
                        currentY += 8;
                        doc.setFont("helvetica", "normal");
                    }
                });
            }

            // Signatures and footer
            currentY = Math.min(265, currentY + 15);
            
            // CEO Signature line
            doc.setDrawColor(200, 200, 200);
            doc.line(14, currentY, 70, currentY);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5);
            doc.setTextColor(textColor[0], textColor[1], textColor[2]);
            doc.text("SALEEM (CEO)", 14, currentY + 5);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(120, 120, 120);
            doc.text("Executive Approver", 14, currentY + 9);

            // Agent Signature line
            doc.line(140, currentY, 196, currentY);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(textColor[0], textColor[1], textColor[2]);
            doc.text(`${(selectedStaff.staff.full_name || selectedStaff.staff.email).toUpperCase()}`, 140, currentY + 5);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(120, 120, 120);
            doc.text("Sales Agent Signature", 140, currentY + 9);

            // Document Footer
            doc.setFontSize(7.5);
            doc.setTextColor(180, 180, 180);
            doc.text("CONFIDENTIAL - FOR INTERNAL USTHAD ACADEMY EXECUTIVE USE ONLY", 105, 287, { align: "center" });

            doc.save(`Sales_Performance_${selectedStaff.staff.full_name || selectedStaff.staff.email}_${new Date().toISOString().split('T')[0]}.pdf`);
            toast.success("Sales Performance Report downloaded successfully!");
        } catch (err) {
            console.error("PDF download exception:", err);
            toast.error("Failed to generate PDF document.");
        }
    };

    // jsPDF - Generate Professional Combined Sales Report PDF (All staff)
    const generateCombinedReportPDF = () => {
        try {
            const doc = new jsPDF({
                orientation: "portrait",
                unit: "mm",
                format: "a4"
            });

            const primaryColor = [47, 30, 115];   // #2F1E73
            const secondaryColor = [250, 70, 21]; // #FA4615
            const textColor = [30, 41, 59];      // #1E293B
            const lightGray = [241, 245, 249];    // #F1F5F9

            // Draw Header Banner on page 1
            drawHeaderBanner(doc, 1, logoPng);

            // Document Title
            doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(20);
            doc.text("ALL SALES STAFF PERFORMANCE LEDGER", 14, 50);
            
            doc.setFillColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
            doc.rect(14, 53, 40, 2, "F");

            // Period Details
            doc.setTextColor(textColor[0], textColor[1], textColor[2]);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.text("PERFORMANCE PERIOD:", 14, 63);
            doc.setFont("helvetica", "normal");
            doc.text(`${new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }).toUpperCase()}`, 60, 63);

            // Table Headers
            const headers = ["Rank", "Staff Name", "Designation", "Total Conversions"];
            const colWidthsCalculated = [15, 60, 67, 40]; // Total = 182
            const startX = 14;
            let currentY = 70;
            let pageNum = 1;

            // Draw headers box
            doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
            doc.rect(startX, currentY, 182, 8, "F");

            doc.setTextColor(255, 255, 255);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            let xOffset = startX;
            headers.forEach((h, idx) => {
                const alignOffset = idx === 3 ? colWidthsCalculated[idx] / 2 : (idx === 0 ? colWidthsCalculated[idx] / 2 : 2);
                doc.text(h, xOffset + alignOffset, currentY + 5.5, { align: idx === 3 || idx === 0 ? "center" : "left" });
                xOffset += colWidthsCalculated[idx];
            });

            currentY += 8;

            // Draw Rows
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.5);

            if (salesStaffData.length === 0) {
                doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
                doc.rect(startX, currentY, 182, 12, "F");
                doc.setTextColor(120, 120, 120);
                doc.text("No sales staff records available for the current month target period.", 105, currentY + 7.5, { align: "center" });
                currentY += 12;
            } else {
                salesStaffData.forEach((staff, rIdx) => {
                    // Check page overflow
                    if (currentY > 255 && rIdx < salesStaffData.length - 1) {
                        doc.addPage();
                        pageNum += 1;
                        drawHeaderBanner(doc, pageNum, logoPng);
                        
                        currentY = 45; // Start below header banner
                        
                        // Redraw table headers on new page
                        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
                        doc.rect(startX, currentY, 182, 8, "F");
                        doc.setTextColor(255, 255, 255);
                        doc.setFont("helvetica", "bold");
                        doc.setFontSize(9);
                        let xOffset = startX;
                        headers.forEach((h, idx) => {
                            const alignOffset = idx === 3 ? colWidthsCalculated[idx] / 2 : (idx === 0 ? colWidthsCalculated[idx] / 2 : 2);
                            doc.text(h, xOffset + alignOffset, currentY + 5.5, { align: idx === 3 || idx === 0 ? "center" : "left" });
                            xOffset += colWidthsCalculated[idx];
                        });
                        currentY += 8;
                        doc.setFont("helvetica", "normal");
                        doc.setFontSize(8.5);
                    }

                    // Alternate row background colors
                    if (rIdx % 2 === 0) {
                        doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
                    } else {
                        doc.setFillColor(255, 255, 255);
                    }
                    doc.rect(startX, currentY, 182, 8, "F");

                    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
                    
                    // Draw cells
                    xOffset = startX;
                    // Rank (Center)
                    doc.text((rIdx + 1).toString(), xOffset + colWidthsCalculated[0] / 2, currentY + 5.5, { align: "center" });
                    xOffset += colWidthsCalculated[0];
                    
                    // Name (Left)
                    doc.text(staff.staff.full_name || staff.staff.email, xOffset + 2, currentY + 5.5);
                    xOffset += colWidthsCalculated[1];

                    // Designation (Left)
                    doc.text((staff.staff.designation || 'Sales Representative').toUpperCase(), xOffset + 2, currentY + 5.5);
                    xOffset += colWidthsCalculated[2];

                    // Conversions Achieved (Center)
                    doc.setFont("helvetica", "bold");
                    doc.text(staff.current_progress.toString(), xOffset + colWidthsCalculated[3] / 2, currentY + 5.5, { align: "center" });
                    doc.setFont("helvetica", "normal");

                    currentY += 8;
                });
            }

            // Check if summary card overflows the page
            if (currentY > 225) {
                doc.addPage();
                pageNum += 1;
                drawHeaderBanner(doc, pageNum, logoPng);
                currentY = 45;
            }

            // Ledger Summary Stats Card
            currentY += 10;
            doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
            doc.rect(14, currentY, 182, 32, "F");

            doc.setTextColor(textColor[0], textColor[1], textColor[2]);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.text("EXECUTIVE SUMMARY STATS", 20, currentY + 8);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(9.5);
            doc.text(`Total Sales Force:`, 20, currentY + 18);
            doc.setFont("helvetica", "bold");
            doc.text(`${salesStaffData.length} Active Agents`, 65, currentY + 18);

            const totalAchieved = salesStaffData.reduce((sum, s) => sum + s.current_progress, 0);
            const avgConversions = salesStaffData.length > 0 ? (totalAchieved / salesStaffData.length) : 0;

            doc.setFont("helvetica", "normal");
            doc.text(`Total Combined Progress:`, 20, currentY + 25);
            doc.setFont("helvetica", "bold");
            doc.text(`${totalAchieved} Conversions`, 65, currentY + 25);

            doc.setFont("helvetica", "normal");
            doc.text(`Average Conversions per Agent:`, 110, currentY + 18);
            doc.setFont("helvetica", "bold");
            doc.text(`${avgConversions.toFixed(1)} Conversions`, 165, currentY + 18);

            const topPerformerName = salesStaffData.length > 0 ? (salesStaffData[0].staff.full_name || salesStaffData[0].staff.email) : "N/A";
            doc.setFont("helvetica", "normal");
            doc.text(`Leading Agent Rank 1:`, 110, currentY + 25);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(250, 70, 21); // Orange
            doc.text(topPerformerName, 165, currentY + 25);

            // Check if signatory overflows the page
            if (currentY > 235) {
                doc.addPage();
                pageNum += 1;
                drawHeaderBanner(doc, pageNum, logoPng);
                currentY = 45;
            }

            // Signatory
            currentY += 40;
            doc.setFillColor(textColor[0], textColor[1], textColor[2]);
            doc.setDrawColor(200, 200, 200);
            doc.line(14, currentY, 80, currentY);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(textColor[0], textColor[1], textColor[2]);
            doc.text("SALEEM (CEO)", 14, currentY + 6);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(120, 120, 120);
                        doc.text("Executive Director of Usthad Academy", 14, currentY + 10);

            // Footer copyright
            doc.setFontSize(7.5);
            doc.setTextColor(180, 180, 180);
            doc.text("CONFIDENTIAL - USTHAD ACADEMY INTERNAL ADMINISTRATION RECORD", 105, 287, { align: "center" });

            doc.save(`USTHAD_ACADEMY_COMBINED_SALES_REPORT_${new Date().toISOString().split('T')[0]}.pdf`);
            toast.success("Combined Sales Ledger PDF downloaded successfully!");
        } catch (err) {
            console.error("Combined PDF download exception:", err);
            toast.error("Failed to generate combined PDF report.");
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg">
                            <TrendingUp className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Staff Velocity</h2>
                            <p className="text-sm text-gray-500">Monthly performance overview</p>
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="animate-pulse">
                            <div className="h-24 bg-gray-100 rounded-xl"></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg">
                        <TrendingUp className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Staff Velocity</h2>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">
                            {timeframe === "daily" ? "Daily" : timeframe === "weekly" ? "Weekly" : "Monthly"} performance overview
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 self-end sm:self-auto">
                    {/* Timeframe Filter Selector */}
                    <div className="bg-slate-100 p-0.5 rounded-xl flex items-center border border-slate-200/50">
                        {(["daily", "weekly", "monthly"] as const).map((t) => (
                            <button
                                key={t}
                                onClick={() => setTimeframe(t)}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all",
                                    timeframe === t 
                                        ? "bg-white text-[#31267D] shadow-sm font-black" 
                                        : "text-slate-500 hover:text-slate-900"
                                )}
                            >
                                {t}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={generateCombinedReportPDF}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#2F1E73] hover:bg-[#2F1E73]/90 text-white text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                    >
                        <FileText className="w-4 h-4 text-white" />
                        Combined Report
                    </button>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50 text-xs font-bold text-gray-600 cursor-pointer"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Best Performer Section */}
            {bestSalesPerformer && (
                <div className="mb-8">
                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-6">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg">
                                <Trophy className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-emerald-800">Top Sales Performer</h3>
                                <p className="text-sm text-emerald-600">Most conversions this month</p>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-base font-bold text-gray-900">
                                    {bestSalesPerformer.staff.full_name || bestSalesPerformer.staff.email}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-bold text-emerald-600">
                                    {bestSalesPerformer.current_progress}
                                </p>
                                <p className="text-xs text-emerald-600">conversions achieved</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

                        {salesStaffData.length === 0 ? (
                <div className="text-center py-12">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No sales staff data available</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                    {salesStaffData.map((staffMember) => (
                        <div
                            key={staffMember.staff.id}
                            className="relative bg-gradient-to-br from-white/90 to-white/60 rounded-2xl border border-white/20 p-3 sm:p-4 hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between"
                            style={{
                                backdropFilter: 'blur(20px)',
                                WebkitBackdropFilter: 'blur(20px)',
                                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.6) 100%)',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                boxShadow: '0 8px 32px rgba(31, 38, 135, 0.05)',
                            }}
                        >
                            {/* Staff Info */}
                            <div>
                                <div className="flex items-center justify-between mb-2 sm:mb-3">
                                    <div className="flex items-center gap-2.5">
                                        <Avatar className="w-8 h-8 sm:w-10 sm:h-10 border border-slate-100 shadow-sm flex-shrink-0">
                                            <AvatarImage src={isValidAvatarUrl(staffMember.staff.avatar_url) ? staffMember.staff.avatar_url : undefined} alt={staffMember.staff.full_name || staffMember.staff.email} />
                                            <AvatarFallback 
                                                className="text-white text-xs sm:text-sm font-black flex items-center justify-center w-full h-full"
                                                style={{ backgroundColor: BRAND.navy }}
                                            >
                                                {staffMember.staff.avatar_url && !isValidAvatarUrl(staffMember.staff.avatar_url)
                                                    ? staffMember.staff.avatar_url
                                                    : (staffMember.staff.full_name?.[0] || staffMember.staff.email?.[0] || 'U')}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-xs sm:text-sm font-bold text-gray-900 truncate max-w-[100px] sm:max-w-[140px]">
                                                {staffMember.staff.full_name || staffMember.staff.email}
                                            </div>
                                            <div className="text-[9px] sm:text-[10px] text-gray-500 font-semibold tracking-wider uppercase truncate max-w-[100px] sm:max-w-[140px]">
                                                {staffMember.staff.designation || 'Sales Representative'}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Conversion Stat Block */}
                                <div className="mt-4 p-3 rounded-2xl bg-slate-50/50 dark:bg-zinc-900/50 border border-slate-100/50 dark:border-zinc-800/50 flex items-center justify-between shadow-inner">
                                    <div className="flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                                        <span className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider">Conversions</span>
                                    </div>
                                    <span className="text-sm sm:text-base font-black text-[#2F1E73] dark:text-[#8d7df0]">{staffMember.current_progress}</span>
                                </div>
                            </div>

                            {/* Performance Report Button */}
                            <div className="mt-4 pt-3 border-t border-gray-100">
                                <button
                                    onClick={() => handleGenerateStaffReport(staffMember)}
                                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-indigo-100 hover:border-indigo-200 hover:bg-indigo-50/50 text-[10px] sm:text-xs font-black uppercase tracking-wider text-[#2F1E73] transition-all active:scale-95 cursor-pointer"
                                >
                                    <Award className="w-3.5 h-3.5 text-[#2F1E73]" />
                                    Performance Report
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Individual Performance Report Details Dialog */}
            <Dialog open={isStaffReportOpen} onOpenChange={setIsStaffReportOpen}>
                <DialogContent className="max-w-2xl bg-white dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl overflow-y-auto max-h-[85vh]">
                    {selectedStaff && (
                        <>
                            <DialogHeader className="mb-4 pb-4 border-b border-gray-100 dark:border-zinc-800 flex flex-row items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-zinc-900 flex items-center justify-center">
                                        <Award className="w-6 h-6 text-[#2F1E73]" />
                                    </div>
                                    <DialogTitle className="text-lg font-black text-slate-900 dark:text-zinc-100 uppercase tracking-wide">
                                        Monthly Performance Report
                                    </DialogTitle>
                                </div>
                            </DialogHeader>

                            {/* Report Details Card */}
                            <div className="space-y-6">
                                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 grid grid-cols-2 gap-4">
                                    <div className="flex items-start gap-3">
                                        <Avatar className="w-12 h-12 border border-slate-200 dark:border-zinc-800 shadow-sm flex-shrink-0 mt-1">
                                            <AvatarImage src={isValidAvatarUrl(selectedStaff.staff.avatar_url) ? selectedStaff.staff.avatar_url : undefined} alt={selectedStaff.staff.full_name || selectedStaff.staff.email} />
                                            <AvatarFallback 
                                                className="text-white text-sm font-black flex items-center justify-center w-full h-full"
                                                style={{ backgroundColor: BRAND.navy }}
                                            >
                                                {selectedStaff.staff.avatar_url && !isValidAvatarUrl(selectedStaff.staff.avatar_url)
                                                    ? selectedStaff.staff.avatar_url
                                                    : (selectedStaff.staff.full_name?.[0] || selectedStaff.staff.email?.[0] || 'U')}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Agent Details</p>
                                            <h4 className="text-base font-black text-slate-900 dark:text-white mt-1">
                                                {selectedStaff.staff.full_name || selectedStaff.staff.email}
                                            </h4>
                                            <p className="text-xs text-gray-500 mt-0.5">{selectedStaff.staff.email}</p>
                                            <Badge className="mt-2 text-[9px] font-black tracking-wider uppercase" style={{ backgroundColor: BRAND.navy }}>
                                                {selectedStaff.staff.designation || 'SALES REPRESENTATIVE'}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Monthly Progress</p>
                                        <h4 className="text-2xl font-black text-[#2F1E73] dark:text-[#8d7df0] mt-1">
                                            {selectedStaff.current_progress}
                                        </h4>
                                        <p className="text-xs text-gray-500 mt-0.5">Total Conversions</p>
                                    </div>
                                </div>

                                {/* Logs History Table */}
                                <div>
                                    <h4 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
                                        <Calendar className="w-4 h-4 text-orange-500" />
                                        Logged Days History (Current Month)
                                    </h4>
                                    
                                    <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-zinc-800">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-slate-50 dark:bg-zinc-900 text-gray-500 uppercase tracking-wider font-semibold">
                                                <tr>
                                                    <th className="py-2.5 px-3">Date</th>
                                                    <th className="py-2.5 px-3 text-center">Leads</th>
                                                    <th className="py-2.5 px-3 text-center">Evals</th>
                                                    <th className="py-2.5 px-3 text-center">Convs</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-zinc-850">
                                                {loadingLogs ? (
                                                    <tr>
                                                        <td colSpan={4} className="py-8 text-center text-gray-400">
                                                            <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1.5" />
                                                            Loading logs...
                                                        </td>
                                                    </tr>
                                                ) : staffLogs.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={4} className="py-8 text-center text-gray-400">
                                                            No logs submitted this month
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    staffLogs.map((log) => (
                                                        <tr key={log.id} className="hover:bg-slate-50/50">
                                                            <td className="py-2 px-3 font-semibold">
                                                                {new Date(log.report_date).toLocaleDateString('en-IN', {
                                                                    day: 'numeric',
                                                                    month: 'short'
                                                                })}
                                                            </td>
                                                            <td className="py-2 px-3 text-center text-gray-600">{log.total_leads}</td>
                                                            <td className="py-2 px-3 text-center text-gray-600">{log.evaluations_taken}</td>
                                                            <td className="py-2 px-3 text-center font-bold text-slate-800">{log.conversions}</td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Download Trigger */}
                                <div className="flex gap-3 justify-end pt-4 border-t border-gray-100 dark:border-zinc-800">
                                    <button
                                        onClick={() => setIsStaffReportOpen(false)}
                                        className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 transition-colors border border-gray-100 hover:bg-slate-50 rounded-xl"
                                    >
                                        Close
                                    </button>
                                    <button
                                        onClick={downloadSingleStaffPDF}
                                        disabled={loadingLogs}
                                        className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-[#FA4615] hover:bg-[#FA4615]/90 rounded-xl transition-all shadow-lg hover:shadow-orange-500/20 active:scale-95 disabled:opacity-50 cursor-pointer"
                                    >
                                        <Download className="w-4 h-4" />
                                        Download PDF Report
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default CEOStaffVelocity;
