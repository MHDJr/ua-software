import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { jsPDF } from "jspdf";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const period = searchParams.get("period") || "weekly";
        const staffId = searchParams.get("staffId");

        // Parse date range
        const days = period === "monthly" ? 30 : 7;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        const cutoffIso = cutoffDate.toISOString();

        // Initialize Supabase admin client
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Build task query with strict columns selective load
        let query = supabase
            .from("tasks")
            .select(`
                title, 
                status, 
                progress, 
                created_at, 
                updated_at,
                assigned_to,
                assigned_to_user:profiles!assigned_to(full_name, department),
                creator:profiles!created_by(full_name)
            `)
            .gte("created_at", cutoffIso)
            .order("created_at", { ascending: false });

        if (staffId) {
            query = query.eq("assigned_to", staffId);
        }

        const { data: tasks, error: tasksError } = await query;
        if (tasksError) throw tasksError;

        // Group rows by staff member
        const groupedData: Record<string, { name: string; department: string; tasks: any[] }> = {};

        // Fetch all active profiles (except CEO)
        let profileQuery = supabase
            .from("profiles")
            .select("id, full_name, department")
            .neq("role", "ceo");
        
        if (staffId) {
            profileQuery = profileQuery.eq("id", staffId);
        }

        const { data: profiles, error: profilesError } = await profileQuery;
        if (profilesError) throw profilesError;

        // Initialize groupedData for every active staff member to ensure a complete audit
        profiles?.forEach((profile: any) => {
            if (profile.full_name !== "[DELETED]") {
                groupedData[profile.id] = {
                    name: profile.full_name || "Unknown",
                    department: profile.department || "General",
                    tasks: []
                };
            }
        });

        // Group the tasks
        tasks?.forEach((t: any) => {
            const staffKey = t.assigned_to;
            if (staffKey && groupedData[staffKey]) {
                groupedData[staffKey].tasks.push(t);
            } else if (staffKey && !staffId) {
                // If somehow it's assigned to a profile not in our profiles fetch (e.g. deleted but has tasks or CEO)
                const staffName = t.assigned_to_user?.full_name || "Unassigned";
                const staffDept = t.assigned_to_user?.department || "General";
                if (!groupedData[staffKey]) {
                    groupedData[staffKey] = {
                        name: staffName,
                        department: staffDept,
                        tasks: []
                    };
                }
                groupedData[staffKey].tasks.push(t);
            }
        });

        // Compute metrics
        const totalAssigned = tasks?.length || 0;
        const totalArchived = tasks?.filter((t: any) => (t.status || "").toUpperCase() === "COMPLETED").length || 0;
        const totalInReview = tasks?.filter((t: any) => {
            const s = (t.status || "").toUpperCase();
            return s === "UNDER_REVIEW" || s === "IN_REVIEW";
        }).length || 0;
        const yieldPercentage = totalAssigned > 0 ? Math.round((totalArchived / totalAssigned) * 100) : 0;

        // Generate A4 PDF using jsPDF
        // jsPDF coordinates are in mm (A4: 210 x 297)
        const doc = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4"
        });

        // Margins: top/bottom 20mm, left/right 15mm
        let yPos = 20;

        // Colors
        const primaryColor = "#31267D"; // Usthad Navy
        const darkGray = "#333333";
        const lightGray = "#777777";

        // Header Title
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.setTextColor(primaryColor);
        doc.text("USTHAD ACADEMY", 15, yPos);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(lightGray);
        doc.text("COMMAND CENTER OS • EXECUTIVE PERFORMANCE AUDIT", 15, yPos + 5);

        // Date and Period
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(darkGray);
        const reportTitle = `${period.toUpperCase()} TASK REPORT`;
        doc.text(reportTitle, 195 - doc.getTextWidth(reportTitle), yPos);

        const dateStr = `Generated: ${new Date().toLocaleDateString()}`;
        doc.setFont("helvetica", "normal");
        doc.text(dateStr, 195 - doc.getTextWidth(dateStr), yPos + 5);

        // Divider
        yPos += 10;
        doc.setDrawColor(229, 231, 235);
        doc.setLineWidth(0.5);
        doc.line(15, yPos, 195, yPos);

        // Macro-Metrics Cards block
        yPos += 8;
        doc.setDrawColor(primaryColor);
        doc.setFillColor(243, 244, 246);
        doc.roundedRect(15, yPos, 180, 18, 2, 2, "F");

        // Metrics Labels & Values
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(primaryColor);
        doc.text("ASSIGNED", 25, yPos + 7);
        doc.text("ARCHIVED (COMPLETED)", 65, yPos + 7);
        doc.text("IN REVIEW", 115, yPos + 7);
        doc.text("YIELD RATE", 155, yPos + 7);

        doc.setFontSize(12);
        doc.setTextColor(darkGray);
        doc.text(totalAssigned.toString(), 25, yPos + 13);
        doc.text(totalArchived.toString(), 65, yPos + 13);
        doc.text(totalInReview.toString(), 115, yPos + 13);
        doc.text(`${yieldPercentage}%`, 155, yPos + 13);

        yPos += 26;

        // Group rows cleanly by staff personnel
        const staffKeys = Object.keys(groupedData);
        if (staffKeys.length === 0) {
            doc.setFont("helvetica", "italic");
            doc.setFontSize(11);
            doc.setTextColor(lightGray);
            doc.text("No task records identified in this deployment period.", 15, yPos);
        } else {
            staffKeys.forEach((staffKey) => {
                const group = groupedData[staffKey];
                
                // Page-break protection: if remaining height is small, create new page
                if (yPos > 240) {
                    doc.addPage();
                    yPos = 20;
                }

                // Staff section header
                doc.setFont("helvetica", "bold");
                doc.setFontSize(11);
                doc.setTextColor(primaryColor);
                doc.text(`${group.name.toUpperCase()} (${group.department.toUpperCase()})`, 15, yPos);
                
                yPos += 3;

                // Minimalist table header
                doc.setFillColor(249, 250, 251);
                doc.rect(15, yPos, 180, 7, "F");
                
                doc.setDrawColor(229, 231, 235);
                doc.setLineWidth(0.2);
                doc.line(15, yPos, 195, yPos);
                doc.line(15, yPos + 7, 195, yPos + 7);

                doc.setFont("helvetica", "bold");
                doc.setFontSize(8);
                doc.setTextColor(lightGray);
                
                // Alignments matching: [Objective Directives | Assigned By | Launch Date | Archive Date | Status]
                doc.text("OBJECTIVE DIRECTIVES", 18, yPos + 5);
                doc.text("ASSIGNED BY", 90, yPos + 5);
                doc.text("LAUNCH DATE", 125, yPos + 5);
                doc.text("ARCHIVE DATE", 155, yPos + 5);
                doc.text("STATUS", 180, yPos + 5);

                yPos += 7;

                // Minimalist table rows
                if (group.tasks.length === 0) {
                    doc.setFont("helvetica", "italic");
                    doc.setFontSize(8);
                    doc.setTextColor(lightGray);
                    doc.text("No active or archived tasks recorded in this period.", 18, yPos + 5);
                    yPos += 8;
                } else {
                    group.tasks.forEach((t: any) => {
                        // Page-break protection inside table rows
                        if (yPos > 265) {
                            doc.addPage();
                            yPos = 20;
                            // Redraw header
                            doc.setFillColor(249, 250, 251);
                            doc.rect(15, yPos, 180, 7, "F");
                            doc.line(15, yPos, 195, yPos);
                            doc.line(15, yPos + 7, 195, yPos + 7);
                            doc.setFont("helvetica", "bold");
                            doc.setFontSize(8);
                            doc.setTextColor(lightGray);
                            doc.text("OBJECTIVE DIRECTIVES", 18, yPos + 5);
                            doc.text("ASSIGNED BY", 90, yPos + 5);
                            doc.text("LAUNCH DATE", 125, yPos + 5);
                            doc.text("ARCHIVE DATE", 155, yPos + 5);
                            doc.text("STATUS", 180, yPos + 5);
                            yPos += 7;
                        }

                        // Parse values
                        const title = t.title.length > 38 ? t.title.slice(0, 35) + "..." : t.title;
                        const assignedBy = t.creator?.full_name || "CEO";
                        const launchDate = new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
                        
                        const isCompleted = (t.status || "").toUpperCase() === "COMPLETED";
                        const archiveDate = isCompleted && t.updated_at
                            ? new Date(t.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                            : "—";
                        
                        const statusVal = (t.status || "PENDING").toUpperCase().replace("_", " ");

                        doc.setFont("helvetica", "normal");
                        doc.setFontSize(8);
                        doc.setTextColor(darkGray);
                        
                        doc.text(title, 18, yPos + 5);
                        doc.text(assignedBy, 90, yPos + 5);
                        doc.text(launchDate, 125, yPos + 5);
                        doc.text(archiveDate, 155, yPos + 5);
                        
                        // Status styling
                        if (isCompleted) {
                            doc.setTextColor(16, 185, 129); // Emerald green
                        } else if (statusVal === "PENDING") {
                            doc.setTextColor(245, 158, 11); // Orange
                        } else {
                            doc.setTextColor(59, 130, 246); // Blue
                        }
                        doc.setFont("helvetica", "bold");
                        doc.text(statusVal, 180, yPos + 5);

                        // Row bottom border
                        doc.setDrawColor(243, 244, 246);
                        doc.line(15, yPos + 8, 195, yPos + 8);

                        yPos += 8;
                    });
                }
                yPos += 10; // Extra spacing between personnel directories
            });
        }

        // Return PDF Array Buffer
        const pdfArray = doc.output("arraybuffer");
        return new Response(pdfArray, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": "attachment; filename=usthad_academy_performance_report.pdf",
                "Cache-Control": "s-maxage=3600, stale-while-revalidate"
            }
        });

    } catch (err: any) {
        console.error("PDF generation endpoint failure:", err);
        return NextResponse.json(
            { error: err.message || "Failed to generate task report buffer." },
            { status: 500 }
        );
    }
}

/**
 * RECOMMENDED SQL INDICES FOR MAXIMUM PERFORMANCE (Under 2ms query latency):
 * 
 * -- 1. Index on created_at for historical date range partitioning
 * CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
 * 
 * -- 2. Index on assigned_to and status for filtering grouped directives
 * CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to_status ON tasks(assigned_to, status);
 * 
 * -- 3. Index on created_by fkey
 * CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
 */
