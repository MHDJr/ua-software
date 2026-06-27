import PDFDocument from "pdfkit";
import path from "path";

// Helper to query report data directly using the Supabase Admin client
export async function fetchReportData(
    supabaseAdmin: any,
    type: string,
    year: number,
    month: number
): Promise<any[]> {
    const startOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endOfMonth = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    let dbData: any[] = [];

    if (type === "finance") {
        try {
            const { data, error } = await supabaseAdmin
                .from("financial_entries")
                .select("entry_date, uloomx_income, usthad_income, total_expenses, revenue, status, notes, profile:profiles!submitted_by(full_name)")
                .gte("entry_date", startOfMonth)
                .lte("entry_date", endOfMonth)
                .order("entry_date", { ascending: true });
            if (error) throw error;
            dbData = data || [];
        } catch (e) {
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
                .select("tracking_date, total_leads, conversions, evaluations_taken, lost_leads, lead_quality_rating, profile:profiles!profile_id(full_name)")
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
                .select("created_at, title, description, dates, total_days, status, purpose, profile:profiles!submitted_by(full_name)")
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
                .select("created_at, title, description, priority, status, due_date, profile:profiles!assigned_to(full_name)")
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

    return dbData;
}

// Helper to generate a styled PDF document using PDFKit based on operational metrics
export function buildPDF(type: string, year: number, month: number, data: any[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        try {
            const regularFontPath = path.join(process.cwd(), "public", "fonts", "Roboto-Regular.ttf");
            const boldFontPath = path.join(process.cwd(), "public", "fonts", "Roboto-Bold.ttf");
            const italicFontPath = path.join(process.cwd(), "public", "fonts", "Roboto-Italic.ttf");

            // Pass a custom default font file to prevent PDFKit constructor from searching for Helvetica.afm
            const doc = new PDFDocument({ 
                margin: 40, 
                size: "A4",
                font: regularFontPath
            });
            const chunks: any[] = [];
            
            doc.on("data", chunk => chunks.push(chunk));
            doc.on("end", () => resolve(Buffer.concat(chunks)));
            doc.on("error", err => reject(err));
            
            // Register standard fonts explicitly to prevent ENOENT Helvetica.afm errors on serverless deploys (like Vercel)
            try {
                doc.registerFont("Helvetica", regularFontPath);
                doc.registerFont("Helvetica-Bold", boldFontPath);
                doc.registerFont("Helvetica-Oblique", italicFontPath);
            } catch (fontErr) {
                console.error("[PDFGenerator] Failed to register custom TTF fonts:", fontErr);
            }

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

            // Helper to draw headers on the current page
            const drawHeaders = (y: number) => {
                doc.rect(40, y, 515, 22).fill("#31267D");
                doc.fontSize(8.5).font("Helvetica-Bold").fillColor("#FFFFFF");
                if (type === "finance") {
                    doc.text("Date", 45, y + 6, { width: 70 });
                    doc.text("UloomX Rev", 115, y + 6, { width: 85, align: "right" });
                    doc.text("Usthad Rev", 200, y + 6, { width: 85, align: "right" });
                    doc.text("Expenses", 285, y + 6, { width: 85, align: "right" });
                    doc.text("Net Rev", 370, y + 6, { width: 85, align: "right" });
                    doc.text("Status", 455, y + 6, { width: 95, align: "center" });
                } else if (type === "sales") {
                    doc.text("Date", 45, y + 6, { width: 70 });
                    doc.text("Sales Rep", 120, y + 6, { width: 110 });
                    doc.text("Total Leads", 235, y + 6, { width: 80, align: "center" });
                    doc.text("Conversions", 315, y + 6, { width: 80, align: "center" });
                    doc.text("Lost Leads", 395, y + 6, { width: 80, align: "center" });
                    doc.text("Quality", 475, y + 6, { width: 75, align: "center" });
                } else if (type === "leave") {
                    doc.text("Sub. Date", 45, y + 6, { width: 70 });
                    doc.text("Staff", 120, y + 6, { width: 100 });
                    doc.text("Leave Dates", 225, y + 6, { width: 135 });
                    doc.text("Days", 365, y + 6, { width: 40, align: "center" });
                    doc.text("Purpose", 410, y + 6, { width: 105 });
                    doc.text("Status", 475, y + 6, { width: 75, align: "center" });
                } else if (type === "tasks") {
                    doc.text("Created Date", 45, y + 6, { width: 70 });
                    doc.text("Assigned To", 120, y + 6, { width: 110 });
                    doc.text("Title", 235, y + 6, { width: 175 });
                    doc.text("Priority", 415, y + 6, { width: 50, align: "center" });
                    doc.text("Status", 465, y + 6, { width: 85, align: "center" });
                }
            };

            // Helper to draw standard header banner
            const drawHeaderBanner = () => {
                doc.rect(0, 0, 595, 90).fill("#31267D");
                doc.fillColor("#FFFFFF")
                   .fontSize(20)
                   .font("Helvetica-Bold")
                   .text("USTHAD ACADEMY", 40, 25, { characterSpacing: 1.5 });
                
                doc.fontSize(10)
                   .font("Helvetica")
                   .fillColor("#C7D2FE")
                   .text(`${type.toUpperCase()} OPERATIONS LEDGER SUMMARY - ${String(month).padStart(2, "0")}/${year}`, 40, 52);

                const generatedAt = new Date().toLocaleString("en-US", { timeZone: "UTC" }) + " UTC";
                doc.fillColor("#94A3B8")
                   .fontSize(8)
                   .text(`Generated: ${generatedAt}  |  Total Records: ${data.length}`, 40, 102, { align: "right" });

                doc.fillColor("#0F172A")
                   .fontSize(13)
                   .font("Helvetica-Bold")
                   .text(`Monthly ${type.charAt(0).toUpperCase() + type.slice(1)} Operational Briefing`, 40, 115);

                doc.moveTo(40, 132).lineTo(555, 132).strokeColor("#E2E8F0").lineWidth(1).stroke();
            };

            // Initial banner and summary cards on Page 1
            drawHeaderBanner();

            // Summary Cards Dimensions
            const cardWidth = 158;
            const cardHeight = 45;
            const startX = 40;
            const gap = 20;

            const drawCard = (x: number, y: number, w: number, h: number, title: string, value: string, color: string) => {
                doc.rect(x, y, w, h).fillAndStroke("#F8FAFC", "#E2E8F0");
                doc.rect(x, y, 4, h).fill(color);
                doc.fillColor("#64748B").fontSize(7.5).font("Helvetica-Bold").text(title.toUpperCase(), x + 12, y + 12);
                doc.fillColor("#0F172A").fontSize(14).font("Helvetica-Bold").text(value, x + 12, y + 24);
            };

            drawCard(startX, 145, cardWidth, cardHeight, card1Title, card1Value, "#31267D");
            drawCard(startX + cardWidth + gap, 145, cardWidth, cardHeight, card2Title, card2Value, "#10B981");
            drawCard(startX + (cardWidth + gap) * 2, 145, cardWidth, cardHeight, card3Title, card3Value, "#E86123");

            let yPos = 210;
            drawHeaders(yPos);
            yPos += 22;

            // Iterate data rows
            if (data.length === 0) {
                doc.rect(40, yPos, 515, 30).strokeColor("#E2E8F0").lineWidth(0.5).stroke();
                doc.fillColor("#64748B")
                   .fontSize(9.5)
                   .font("Helvetica-Oblique")
                   .text(`No operational records found for the period ${String(month).padStart(2, "0")}/${year}.`, 50, yPos + 10);
            } else {
                doc.fontSize(8.5).font("Helvetica");
                
                data.forEach((item, index) => {
                    const rowHeight = 22;
                    if (yPos + rowHeight > 730) {
                        doc.addPage();
                        doc.rect(0, 0, 595, 45).fill("#31267D");
                        doc.fillColor("#FFFFFF").fontSize(11).font("Helvetica-Bold").text(`USTHAD ACADEMY - ${type.toUpperCase()} REPORT`, 40, 17);
                        doc.fontSize(8).fillColor("#C7D2FE").text(`Period: ${String(month).padStart(2, "0")}/${year} | Page Continuation`, 400, 18, { align: "right" });
                        
                        yPos = 65;
                        drawHeaders(yPos);
                        yPos += 22;
                    }

                    const isAlt = index % 2 === 1;
                    if (isAlt) {
                        doc.rect(40, yPos, 515, rowHeight).fill("#F8FAFC");
                    }
                    doc.rect(40, yPos, 515, rowHeight).strokeColor("#E2E8F0").lineWidth(0.5).stroke();
                    doc.fillColor("#334155");

                    if (type === "finance") {
                        const uloomx = parseFloat(item.uloomx_income) || 0;
                        const usthad = parseFloat(item.usthad_income) || 0;
                        const exp = parseFloat(item.total_expenses) || 0;
                        const net = parseFloat(item.revenue) || (uloomx + usthad - exp);
                        const status = item.status || "pending";

                        doc.moveTo(115, yPos).lineTo(115, yPos + rowHeight).strokeColor("#E2E8F0").lineWidth(0.5).stroke();
                        doc.moveTo(200, yPos).lineTo(200, yPos + rowHeight).strokeColor("#E2E8F0").lineWidth(0.5).stroke();
                        doc.moveTo(285, yPos).lineTo(285, yPos + rowHeight).strokeColor("#E2E8F0").lineWidth(0.5).stroke();
                        doc.moveTo(370, yPos).lineTo(370, yPos + rowHeight).strokeColor("#E2E8F0").lineWidth(0.5).stroke();
                        doc.moveTo(455, yPos).lineTo(455, yPos + rowHeight).strokeColor("#E2E8F0").lineWidth(0.5).stroke();

                        doc.text(item.entry_date, 45, yPos + 6, { width: 70 });
                        doc.text(`$${uloomx.toFixed(2)}`, 115, yPos + 6, { width: 80, align: "right" });
                        doc.text(`$${usthad.toFixed(2)}`, 200, yPos + 6, { width: 80, align: "right" });
                        doc.text(`$${exp.toFixed(2)}`, 285, yPos + 6, { width: 80, align: "right" });

                        doc.fillColor(net >= 0 ? "#10B981" : "#EF4444");
                        doc.font("Helvetica-Bold").text(`$${net.toFixed(2)}`, 370, yPos + 6, { width: 80, align: "right" });
                        doc.font("Helvetica").fillColor("#334155");

                        const statusColor = status === "approved" || status === "completed" ? "#10B981" : status === "rejected" ? "#EF4444" : "#F59E0B";
                        doc.fillColor(statusColor);
                        doc.text(status.toUpperCase(), 455, yPos + 6, { width: 95, align: "center" });
                    }
                    else if (type === "sales") {
                        const name = item.profile?.full_name || "Sales Rep";
                        const leads = parseInt(item.total_leads) || 0;
                        const conv = parseInt(item.conversions) || 0;
                        const lost = parseInt(item.lost_leads) || 0;
                        const qual = parseInt(item.lead_quality_rating) || 0;

                        doc.moveTo(115, yPos).lineTo(115, yPos + rowHeight).strokeColor("#E2E8F0").lineWidth(0.5).stroke();
                        doc.moveTo(230, yPos).lineTo(230, yPos + rowHeight).strokeColor("#E2E8F0").lineWidth(0.5).stroke();
                        doc.moveTo(310, yPos).lineTo(310, yPos + rowHeight).strokeColor("#E2E8F0").lineWidth(0.5).stroke();
                        doc.moveTo(390, yPos).lineTo(390, yPos + rowHeight).strokeColor("#E2E8F0").lineWidth(0.5).stroke();
                        doc.moveTo(470, yPos).lineTo(470, yPos + rowHeight).strokeColor("#E2E8F0").lineWidth(0.5).stroke();

                        doc.text(item.tracking_date, 45, yPos + 6, { width: 70 });
                        doc.text(name, 120, yPos + 6, { width: 105, ellipsis: true });
                        doc.text(String(leads), 235, yPos + 6, { width: 70, align: "center" });
                        doc.text(String(conv), 315, yPos + 6, { width: 70, align: "center" });
                        doc.text(String(lost), 395, yPos + 6, { width: 70, align: "center" });
                        doc.text(`${qual}/10`, 470, yPos + 6, { width: 80, align: "center" });
                    }
                    else if (type === "leave") {
                        const dateStr = new Date(item.created_at).toISOString().split("T")[0];
                        const name = item.profile?.full_name || "Staff";
                        const leaveDates = item.dates || "N/A";
                        const days = item.total_days || 0;
                        const purpose = item.purpose || "N/A";
                        const status = item.status || "pending";

                        doc.moveTo(115, yPos).lineTo(115, yPos + rowHeight).strokeColor("#E2E8F0").lineWidth(0.5).stroke();
                        doc.moveTo(220, yPos).lineTo(220, yPos + rowHeight).strokeColor("#E2E8F0").lineWidth(0.5).stroke();
                        doc.moveTo(360, yPos).lineTo(360, yPos + rowHeight).strokeColor("#E2E8F0").lineWidth(0.5).stroke();
                        doc.moveTo(405, yPos).lineTo(405, yPos + rowHeight).strokeColor("#E2E8F0").lineWidth(0.5).stroke();
                        doc.moveTo(470, yPos).lineTo(470, yPos + rowHeight).strokeColor("#E2E8F0").lineWidth(0.5).stroke();

                        doc.text(dateStr, 45, yPos + 6, { width: 70 });
                        doc.text(name, 120, yPos + 6, { width: 95, ellipsis: true });
                        doc.text(leaveDates, 225, yPos + 6, { width: 130, ellipsis: true });
                        doc.text(String(days), 360, yPos + 6, { width: 45, align: "center" });
                        doc.text(purpose, 410, yPos + 6, { width: 55, ellipsis: true });

                        const statusColor = status === "approved" || status === "APPROVED" ? "#10B981" : status === "rejected" || status === "REJECTED" ? "#EF4444" : "#F59E0B";
                        doc.fillColor(statusColor).font("Helvetica-Bold");
                        doc.text(status.toUpperCase(), 470, yPos + 6, { width: 80, align: "center" });
                        doc.font("Helvetica");
                    }
                    else if (type === "tasks") {
                        const dateStr = new Date(item.created_at).toISOString().split("T")[0];
                        const name = item.profile?.full_name || "Staff";
                        const title = item.title || "Untitled Task";
                        const priority = item.priority || "medium";
                        const status = item.status || "pending";

                        doc.moveTo(115, yPos).lineTo(115, yPos + rowHeight).strokeColor("#E2E8F0").lineWidth(0.5).stroke();
                        doc.moveTo(230, yPos).lineTo(230, yPos + rowHeight).strokeColor("#E2E8F0").lineWidth(0.5).stroke();
                        doc.moveTo(410, yPos).lineTo(410, yPos + rowHeight).strokeColor("#E2E8F0").lineWidth(0.5).stroke();
                        doc.moveTo(460, yPos).lineTo(460, yPos + rowHeight).strokeColor("#E2E8F0").lineWidth(0.5).stroke();

                        doc.text(dateStr, 45, yPos + 6, { width: 70 });
                        doc.text(name, 120, yPos + 6, { width: 105, ellipsis: true });
                        doc.text(title, 235, yPos + 6, { width: 170, ellipsis: true });

                        const priorityColor = priority === "high" || priority === "HIGH" ? "#EF4444" : priority === "low" || priority === "LOW" ? "#94A3B8" : "#F59E0B";
                        doc.fillColor(priorityColor).font("Helvetica-Bold").text(priority.toUpperCase(), 410, yPos + 6, { width: 50, align: "center" });
                        doc.font("Helvetica").fillColor("#334155");

                        const statusColor = status === "completed" || status === "COMPLETED" ? "#10B981" : "#F59E0B";
                        doc.fillColor(statusColor).font("Helvetica-Bold").text(status.toUpperCase(), 460, yPos + 6, { width: 90, align: "center" });
                        doc.font("Helvetica");
                    }

                    yPos += rowHeight;
                });

                // Draw Summary Totals Row at the bottom
                const rowHeight = 22;
                if (yPos + rowHeight > 730) {
                    doc.addPage();
                    doc.rect(0, 0, 595, 45).fill("#31267D");
                    doc.fillColor("#FFFFFF").fontSize(11).font("Helvetica-Bold").text(`USTHAD ACADEMY - ${type.toUpperCase()} REPORT`, 40, 17);
                    yPos = 65;
                }

                doc.rect(40, yPos, 515, rowHeight).fill("#F1F5F9");
                doc.rect(40, yPos, 515, rowHeight).strokeColor("#94A3B8").lineWidth(1).stroke();
                doc.fillColor("#0F172A").font("Helvetica-Bold").fontSize(8.5);

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

                    doc.text("Total Summary", 45, yPos + 6, { width: 70 });
                    doc.text(`$${totalUloomx.toFixed(2)}`, 115, yPos + 6, { width: 80, align: "right" });
                    doc.text(`$${totalUsthad.toFixed(2)}`, 200, yPos + 6, { width: 80, align: "right" });
                    doc.text(`$${totalExp.toFixed(2)}`, 285, yPos + 6, { width: 80, align: "right" });
                    
                    doc.fillColor(totalNet >= 0 ? "#10B981" : "#EF4444");
                    doc.text(`$${totalNet.toFixed(2)}`, 370, yPos + 6, { width: 80, align: "right" });
                }
                else if (type === "sales") {
                    let totalLeads = 0, totalConversions = 0, totalLost = 0, sumQuality = 0;
                    data.forEach(item => {
                        totalLeads += parseInt(item.total_leads) || 0;
                        totalConversions += parseInt(item.conversions) || 0;
                        totalLost += parseInt(item.lost_leads) || 0;
                        sumQuality += parseInt(item.lead_quality_rating) || 0;
                    });
                    const avgQ = data.length > 0 ? (sumQuality / data.length).toFixed(1) : "0";

                    doc.text("Total Summary", 45, yPos + 6, { width: 70 });
                    doc.text(String(totalLeads), 235, yPos + 6, { width: 70, align: "center" });
                    doc.text(String(totalConversions), 315, yPos + 6, { width: 70, align: "center" });
                    doc.text(String(totalLost), 395, yPos + 6, { width: 70, align: "center" });
                    doc.text(`${avgQ}/10 Avg`, 470, yPos + 6, { width: 80, align: "center" });
                }
                else {
                    doc.text("Summary of Records", 45, yPos + 6);
                    doc.text(`Total Count: ${data.length} Items Listed`, 350, yPos + 6, { width: 200, align: "right" });
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
