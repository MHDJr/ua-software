import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import PDFDocument from "pdfkit";

export const dynamic = "force-dynamic";

// Helper to generate a styled PDF document using PDFKit based on operational metrics
function buildPDF(type: string, year: number, month: number, data: any[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 40, size: "A4" });
            const chunks: any[] = [];
            
            doc.on("data", chunk => chunks.push(chunk));
            doc.on("end", () => resolve(Buffer.concat(chunks)));
            doc.on("error", err => reject(err));
            
            // 1. Calculate values for summary cards
            let card1Title = "", card1Value = "";
            let card2Title = "", card2Value = "";
            let card3Title = "", card3Value = "";

            if (type === "finance") {
                let totalUloomx = 0, totalUsthad = 0, totalExp = 0, totalNet = 0;
                data.forEach(item => {
                    const uloomx = parseFloat(item.uloomx_income) || 0;
                    const usthad = parseFloat(item.usthad_income) || 0;
                    const exp = parseFloat(item.total_expenses) || 0;
                    totalUloomx += uloomx;
                    totalUsthad += usthad;
                    totalExp += exp;
                    totalNet += parseFloat(item.revenue) || (uloomx + usthad - exp);
                });
                card1Title = "Total Net Revenue";
                card1Value = `$${totalNet.toFixed(2)}`;
                card2Title = "Total Income";
                card2Value = `$${(totalUloomx + totalUsthad).toFixed(2)}`;
                card3Title = "Total Expenses";
                card3Value = `$${totalExp.toFixed(2)}`;
            } else if (type === "sales") {
                let totalLeads = 0, totalConversions = 0, sumQuality = 0;
                data.forEach(item => {
                    totalLeads += parseInt(item.total_leads) || 0;
                    totalConversions += parseInt(item.conversions) || 0;
                    sumQuality += parseInt(item.lead_quality_rating) || 0;
                });
                const avgQ = data.length > 0 ? (sumQuality / data.length).toFixed(1) : "0";
                card1Title = "Total Sales Leads";
                card1Value = String(totalLeads);
                card2Title = "Conversions";
                card2Value = String(totalConversions);
                card3Title = "Avg Lead Quality";
                card3Value = `${avgQ}/10`;
            } else if (type === "leave") {
                const total = data.length;
                const approved = data.filter(item => item.status === "approved" || item.status === "APPROVED").length;
                const pending = data.filter(item => item.status === "pending" || item.status === "PENDING").length;
                card1Title = "Total Leave Requests";
                card1Value = String(total);
                card2Title = "Approved Leaves";
                card2Value = String(approved);
                card3Title = "Pending Leaves";
                card3Value = String(pending);
            } else if (type === "tasks") {
                const total = data.length;
                const completed = data.filter(item => item.status === "completed" || item.status === "COMPLETED").length;
                const pending = total - completed;
                card1Title = "Total Tasks";
                card1Value = String(total);
                card2Title = "Completed Tasks";
                card2Value = String(completed);
                card3Title = "Pending Tasks";
                card3Value = String(pending);
            }

            // 2. Header Banner
            doc.rect(0, 0, 595, 90).fill("#31267D");
            doc.fillColor("#FFFFFF")
               .fontSize(20)
               .font("Helvetica-Bold")
               .text("USTHAD ACADEMY", 40, 25, { characterSpacing: 1.5 });
            
            doc.fontSize(10)
               .font("Helvetica")
               .fillColor("#C7D2FE")
               .text(`${type.toUpperCase()} OPERATIONS LEDGER SUMMARY - ${String(month).padStart(2, "0")}/${year}`, 40, 52);

            // 3. Metadata Header Info
            const generatedAt = new Date().toLocaleString("en-US", { timeZone: "UTC" }) + " UTC";
            doc.fillColor("#94A3B8")
               .fontSize(8)
               .text(`Generated: ${generatedAt}  |  Total Records: ${data.length}`, 40, 102, { align: "right" });

            // 4. Title
            doc.fillColor("#0F172A")
               .fontSize(13)
               .font("Helvetica-Bold")
               .text(`Monthly ${type.charAt(0).toUpperCase() + type.slice(1)} Operational Briefing`, 40, 115);

            doc.moveTo(40, 132).lineTo(555, 132).strokeColor("#E2E8F0").lineWidth(1).stroke();

            // 5. Render Summary Cards
            const drawCard = (x: number, y: number, w: number, h: number, title: string, value: string, color: string) => {
                // Background Card
                doc.rect(x, y, w, h).fillAndStroke("#F8FAFC", "#E2E8F0");
                // Left border colored strip
                doc.rect(x, y, 4, h).fill(color);
                
                doc.fillColor("#64748B")
                   .fontSize(7.5)
                   .font("Helvetica-Bold")
                   .text(title.toUpperCase(), x + 12, y + 12);
                
                doc.fillColor("#0F172A")
                   .fontSize(14)
                   .font("Helvetica-Bold")
                   .text(value, x + 12, y + 24);
            };

            const cardWidth = 158;
            const cardHeight = 45;
            const startX = 40;
            const gap = 20;

            drawCard(startX, 145, cardWidth, cardHeight, card1Title, card1Value, "#31267D");
            drawCard(startX + cardWidth + gap, 145, cardWidth, cardHeight, card2Title, card2Value, "#10B981");
            drawCard(startX + (cardWidth + gap) * 2, 145, cardWidth, cardHeight, card3Title, card3Value, "#E86123");

            let yPos = 210;

            // 6. Draw Table Grid
            if (data.length === 0) {
                doc.fillColor("#64748B")
                   .fontSize(11)
                   .font("Helvetica-Oblique")
                   .text(`No operational data records found for this period (${String(month).padStart(2, "0")}/${year}).`, 40, yPos);
            } else {
                if (type === "finance") {
                    // Headers
                    doc.fontSize(9).font("Helvetica-Bold").fillColor("#475569");
                    doc.text("Date", 40, yPos);
                    doc.text("UloomX Rev", 110, yPos, { width: 80, align: "right" });
                    doc.text("Usthad Rev", 200, yPos, { width: 80, align: "right" });
                    doc.text("Expenses", 290, yPos, { width: 80, align: "right" });
                    doc.text("Net Rev", 380, yPos, { width: 80, align: "right" });
                    doc.text("Status", 480, yPos, { width: 75, align: "right" });

                    yPos += 15;
                    doc.moveTo(40, yPos).lineTo(555, yPos).strokeColor("#CBD5E1").lineWidth(1).stroke();
                    yPos += 8;

                    doc.font("Helvetica").fontSize(9).fillColor("#334155");
                    let totalUloomx = 0;
                    let totalUsthad = 0;
                    let totalExp = 0;
                    let totalNet = 0;

                    data.forEach(item => {
                        if (yPos > 720) {
                            doc.addPage();
                            yPos = 40;
                        }
                        const uloomx = parseFloat(item.uloomx_income) || 0;
                        const usthad = parseFloat(item.usthad_income) || 0;
                        const exp = parseFloat(item.total_expenses) || 0;
                        const net = parseFloat(item.revenue) || (uloomx + usthad - exp);

                        totalUloomx += uloomx;
                        totalUsthad += usthad;
                        totalExp += exp;
                        totalNet += net;

                        doc.text(item.entry_date, 40, yPos);
                        doc.text(`$${uloomx.toFixed(2)}`, 110, yPos, { width: 80, align: "right" });
                        doc.text(`$${usthad.toFixed(2)}`, 200, yPos, { width: 80, align: "right" });
                        doc.text(`$${exp.toFixed(2)}`, 290, yPos, { width: 80, align: "right" });
                        
                        doc.fillColor(net >= 0 ? "#10B981" : "#EF4444");
                        doc.text(`$${net.toFixed(2)}`, 380, yPos, { width: 80, align: "right" });
                        doc.fillColor("#334155");

                        doc.text(item.status || "pending", 480, yPos, { width: 75, align: "right" });
                        
                        yPos += 20;
                    });

                    // Totals Row
                    yPos += 10;
                    doc.moveTo(40, yPos).lineTo(555, yPos).strokeColor("#94A3B8").lineWidth(1.5).stroke();
                    yPos += 8;
                    doc.font("Helvetica-Bold").fontSize(9);
                    doc.text("Total Summary", 40, yPos);
                    doc.text(`$${totalUloomx.toFixed(2)}`, 110, yPos, { width: 80, align: "right" });
                    doc.text(`$${totalUsthad.toFixed(2)}`, 200, yPos, { width: 80, align: "right" });
                    doc.text(`$${totalExp.toFixed(2)}`, 290, yPos, { width: 80, align: "right" });
                    
                    doc.fillColor(totalNet >= 0 ? "#10B981" : "#EF4444");
                    doc.text(`$${totalNet.toFixed(2)}`, 380, yPos, { width: 80, align: "right" });
                } 
                else if (type === "sales") {
                    // Headers
                    doc.fontSize(9).font("Helvetica-Bold").fillColor("#475569");
                    doc.text("Date", 40, yPos);
                    doc.text("Sales Rep", 110, yPos);
                    doc.text("Total Leads", 220, yPos, { width: 70, align: "center" });
                    doc.text("Conversions", 300, yPos, { width: 80, align: "center" });
                    doc.text("Lost", 390, yPos, { width: 70, align: "center" });
                    doc.text("Lead Quality", 470, yPos, { width: 85, align: "right" });

                    yPos += 15;
                    doc.moveTo(40, yPos).lineTo(555, yPos).strokeColor("#CBD5E1").lineWidth(1).stroke();
                    yPos += 8;

                    doc.font("Helvetica").fontSize(9).fillColor("#334155");
                    let totalLeads = 0;
                    let totalConversions = 0;
                    let totalLost = 0;
                    let sumQuality = 0;

                    data.forEach(item => {
                        if (yPos > 720) {
                            doc.addPage();
                            yPos = 40;
                        }
                        const name = item.profile?.full_name || "Sales Rep";
                        const leads = parseInt(item.total_leads) || 0;
                        const conv = parseInt(item.conversions) || 0;
                        const lost = parseInt(item.lost_leads) || 0;
                        const qual = parseInt(item.lead_quality_rating) || 0;

                        totalLeads += leads;
                        totalConversions += conv;
                        totalLost += lost;
                        sumQuality += qual;

                        doc.text(item.tracking_date, 40, yPos);
                        doc.text(name, 110, yPos, { width: 100, ellipsis: true });
                        doc.text(String(leads), 220, yPos, { width: 70, align: "center" });
                        doc.text(String(conv), 300, yPos, { width: 80, align: "center" });
                        doc.text(String(lost), 390, yPos, { width: 70, align: "center" });
                        doc.text(`${qual}/10`, 470, yPos, { width: 85, align: "right" });

                        yPos += 20;
                    });

                    // Totals Row
                    yPos += 10;
                    doc.moveTo(40, yPos).lineTo(555, yPos).strokeColor("#94A3B8").lineWidth(1.5).stroke();
                    yPos += 8;
                    doc.font("Helvetica-Bold").fontSize(9);
                    doc.text("Total Summary", 40, yPos);
                    doc.text(String(totalLeads), 220, yPos, { width: 70, align: "center" });
                    doc.text(String(totalConversions), 300, yPos, { width: 80, align: "center" });
                    doc.text(String(totalLost), 390, yPos, { width: 70, align: "center" });
                    const avgQ = data.length > 0 ? (sumQuality / data.length).toFixed(1) : "0";
                    doc.text(`${avgQ}/10 Avg`, 470, yPos, { width: 85, align: "right" });
                }
                else if (type === "leave") {
                    // Headers
                    doc.fontSize(9).font("Helvetica-Bold").fillColor("#475569");
                    doc.text("Submission Date", 40, yPos);
                    doc.text("Staff Profile", 130, yPos);
                    doc.text("Leave Dates", 240, yPos, { width: 120 });
                    doc.text("Days", 370, yPos, { width: 40, align: "center" });
                    doc.text("Purpose", 420, yPos, { width: 70 });
                    doc.text("Status", 500, yPos, { width: 55, align: "right" });

                    yPos += 15;
                    doc.moveTo(40, yPos).lineTo(555, yPos).strokeColor("#CBD5E1").lineWidth(1).stroke();
                    yPos += 8;

                    doc.font("Helvetica").fontSize(9).fillColor("#334155");

                    data.forEach(item => {
                        if (yPos > 720) {
                            doc.addPage();
                            yPos = 40;
                        }
                        const dateStr = new Date(item.created_at).toISOString().split("T")[0];
                        const name = item.profile?.full_name || "Staff";
                        const leaveDates = item.dates || "N/A";
                        const days = item.total_days || 0;
                        const purpose = item.purpose || "N/A";
                        const status = item.status || "pending";

                        doc.text(dateStr, 40, yPos);
                        doc.text(name, 130, yPos, { width: 100, ellipsis: true });
                        doc.text(leaveDates, 240, yPos, { width: 120 });
                        doc.text(String(days), 370, yPos, { width: 40, align: "center" });
                        doc.text(purpose, 420, yPos, { width: 70, ellipsis: true });

                        if (status === "approved" || status === "APPROVED") doc.fillColor("#10B981");
                        else if (status === "rejected" || status === "REJECTED") doc.fillColor("#EF4444");
                        else doc.fillColor("#F59E0B");

                        doc.text(status, 500, yPos, { width: 55, align: "right" });
                        doc.fillColor("#334155");

                        yPos += 20;
                    });
                }
                else if (type === "tasks") {
                    // Headers
                    doc.fontSize(9).font("Helvetica-Bold").fillColor("#475569");
                    doc.text("Created Date", 40, yPos);
                    doc.text("Assigned To", 130, yPos);
                    doc.text("Title", 240, yPos, { width: 150 });
                    doc.text("Priority", 400, yPos, { width: 70, align: "center" });
                    doc.text("Status", 480, yPos, { width: 75, align: "right" });

                    yPos += 15;
                    doc.moveTo(40, yPos).lineTo(555, yPos).strokeColor("#CBD5E1").lineWidth(1).stroke();
                    yPos += 8;

                    doc.font("Helvetica").fontSize(9).fillColor("#334155");

                    data.forEach(item => {
                        if (yPos > 720) {
                            doc.addPage();
                            yPos = 40;
                        }
                        const dateStr = new Date(item.created_at).toISOString().split("T")[0];
                        const name = item.profile?.full_name || "Staff";
                        const title = item.title || "Untitled Task";
                        const priority = item.priority || "medium";
                        const status = item.status || "pending";

                        doc.text(dateStr, 40, yPos);
                        doc.text(name, 130, yPos, { width: 100, ellipsis: true });
                        doc.text(title, 240, yPos, { width: 150, ellipsis: true });

                        doc.text(priority, 400, yPos, { width: 70, align: "center" });

                        if (status === "completed" || status === "COMPLETED") doc.fillColor("#10B981");
                        else doc.fillColor("#F59E0B");

                        doc.text(status, 480, yPos, { width: 75, align: "right" });
                        doc.fillColor("#334155");

                        yPos += 20;
                    });
                }
            }

            // 7. Footer
            doc.fontSize(8)
               .fillColor("#94A3B8")
               .text("CONFIDENTIAL - FOR INTERNAL EXECUTIVE REVIEW ONLY  |  USTHAD ACADEMY OPS ENGINE", 40, 800, { align: "center" });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

export async function GET(request: NextRequest) {
    try {
        // 1. Access Security Verification
        const authHeader = request.headers.get("authorization");
        const cronSecret = process.env.CRON_SECRET;

        if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        // 2. Read URL Parameters
        const url = new URL(request.url);
        const type = url.searchParams.get("type") || "sales";
        const yearStr = url.searchParams.get("year");
        const monthStr = url.searchParams.get("month");

        const currentDate = new Date();
        const year = yearStr ? parseInt(yearStr) : currentDate.getFullYear();
        const month = monthStr ? parseInt(monthStr) : currentDate.getMonth() + 1;

        if (!["finance", "sales", "leave", "tasks"].includes(type)) {
            return NextResponse.json(
                { error: "Invalid report type requested." },
                { status: 400 }
            );
        }

        // Calculate date boundaries
        const startOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endOfMonth = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

        // 3. Connect Supabase Admin
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceRoleKey) {
            console.error("[ReportsDownload] Server configuration error: Missing database credentials.");
            return NextResponse.json(
                { error: "Server Configuration Error: Missing database credentials." },
                { status: 500 }
            );
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            },
        });

        // 4. Query data based on type, using fallbacks if user joins fail
        let dbData: any[] = [];

        if (type === "finance") {
            try {
                const { data, error } = await supabaseAdmin
                    .from("financial_entries")
                    .select("entry_date, uloomx_income, usthad_income, total_expenses, revenue, status, notes, profile:submitted_by(full_name)")
                    .gte("entry_date", startOfMonth)
                    .lte("entry_date", endOfMonth)
                    .order("entry_date", { ascending: true });
                if (error) throw error;
                dbData = data || [];
            } catch (e) {
                // Fallback in case relation structure is different
                const { data } = await supabaseAdmin
                    .from("financial_entries")
                    .select("entry_date, uloomx_income, usthad_income, total_expenses, revenue, status, notes")
                    .gte("entry_date", startOfMonth)
                    .lte("entry_date", endOfMonth)
                    .order("entry_date", { ascending: true });
                dbData = data || [];
            }
        } 
        else if (type === "sales") {
            try {
                const { data, error } = await supabaseAdmin
                    .from("daily_sales_tracking")
                    .select("tracking_date, total_leads, conversions, evaluations_taken, lost_leads, lead_quality_rating, profile:profile_id(full_name)")
                    .gte("tracking_date", startOfMonth)
                    .lte("tracking_date", endOfMonth)
                    .order("tracking_date", { ascending: true });
                if (error) throw error;
                dbData = data || [];
            } catch (e) {
                const { data } = await supabaseAdmin
                    .from("daily_sales_tracking")
                    .select("tracking_date, total_leads, conversions, evaluations_taken, lost_leads, lead_quality_rating")
                    .gte("tracking_date", startOfMonth)
                    .lte("tracking_date", endOfMonth)
                    .order("tracking_date", { ascending: true });
                dbData = data || [];
            }
        } 
        else if (type === "leave") {
            try {
                const { data, error } = await supabaseAdmin
                    .from("requests")
                    .select("created_at, title, description, dates, total_days, status, purpose, profile:submitted_by(full_name)")
                    .eq("type", "leave")
                    .gte("created_at", `${startOfMonth}T00:00:00Z`)
                    .lte("created_at", `${endOfMonth}T23:59:59Z`)
                    .order("created_at", { ascending: true });
                if (error) throw error;
                dbData = data || [];
            } catch (e) {
                const { data } = await supabaseAdmin
                    .from("requests")
                    .select("created_at, title, description, dates, total_days, status, purpose")
                    .eq("type", "leave")
                    .gte("created_at", `${startOfMonth}T00:00:00Z`)
                    .lte("created_at", `${endOfMonth}T23:59:59Z`)
                    .order("created_at", { ascending: true });
                dbData = data || [];
            }
        } 
        else if (type === "tasks") {
            try {
                const { data, error } = await supabaseAdmin
                    .from("tasks")
                    .select("created_at, title, description, priority, status, due_date, profile:assigned_to(full_name)")
                    .gte("created_at", `${startOfMonth}T00:00:00Z`)
                    .lte("created_at", `${endOfMonth}T23:59:59Z`)
                    .order("created_at", { ascending: true });
                if (error) throw error;
                dbData = data || [];
            } catch (e) {
                const { data } = await supabaseAdmin
                    .from("tasks")
                    .select("created_at, title, description, priority, status, due_date")
                    .gte("created_at", `${startOfMonth}T00:00:00Z`)
                    .lte("created_at", `${endOfMonth}T23:59:59Z`)
                    .order("created_at", { ascending: true });
                dbData = data || [];
            }
        }

        // 5. Generate PDF Binary
        const pdfBuffer = await buildPDF(type, year, month, dbData);

        // 6. Return response with Content-Type header
        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${type}_monthly_report_${year}_${month}.pdf"`,
                "Content-Length": pdfBuffer.length.toString(),
            },
        });

    } catch (err: any) {
        console.error("[ReportsDownload] Unhandled exception:", err);
        return NextResponse.json(
            { error: err.message || "Internal server error" },
            { status: 500 }
        );
    }
}
