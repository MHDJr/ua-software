import { NextRequest, NextResponse } from "next/server";
import { BIReportService } from "@/lib/bi-report-service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    return handleRequest(req);
}

export async function GET(req: NextRequest) {
    return handleRequest(req);
}

async function handleRequest(req: NextRequest) {
    try {
        // 1. Authorization security check
        const authHeader = req.headers.get("authorization");
        const cronSecret = process.env.CRON_SECRET || "";

        if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
            console.warn("[Cron API] Unauthorized trigger attempt.");
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 2. Read query parameters
        const { searchParams } = new URL(req.url);
        const stageStr = searchParams.get("stage");
        const force = searchParams.get("force") === "true"; // Allows running on any day for debugging/manual crons
        
        if (!stageStr || !["1", "2", "3", "4"].includes(stageStr)) {
            return NextResponse.json({ error: "Invalid stage parameter requested. Must be 1, 2, 3, or 4." }, { status: 400 });
        }

        const stage = parseInt(stageStr);

        // 3. Timezone checks (IST - Asia/Kolkata)
        const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
        const currentDay = nowIST.getDate();

        if (currentDay !== 1 && !force) {
            console.log(`[Cron API] Skipping: Current day in IST is ${currentDay}, not the 1st day of the month.`);
            return NextResponse.json({ 
                success: true, 
                message: `Skipping execution: current day is ${currentDay} (IST). Cron jobs are configured to run daily but filter for the 1st of the month in Asia/Kolkata.` 
            });
        }

        // 4. Calculate target month/year (the concluded previous month)
        // If we are on the 1st of June, we report on May.
        const targetDate = new Date(nowIST);
        targetDate.setDate(0); // Sets to the last day of the previous month
        const targetYear = targetDate.getFullYear();
        const targetMonth = targetDate.getMonth() + 1; // 1-indexed (1-12)

        console.log(`[Cron API] Executing Stage ${stage} for target period: ${targetMonth}/${targetYear}...`);

        let result;
        switch (stage) {
            case 1:
                result = await BIReportService.runStage1(targetYear, targetMonth, "SYSTEM_CRON");
                break;
            case 2:
                result = await BIReportService.runStage2(targetYear, targetMonth);
                break;
            case 3:
                result = await BIReportService.runStage3(targetYear, targetMonth);
                break;
            case 4:
                result = await BIReportService.runStage4(targetYear, targetMonth);
                break;
            default:
                return NextResponse.json({ error: "Invalid stage." }, { status: 400 });
        }

        return NextResponse.json({
            success: result.success,
            stage: result.stage,
            message: result.message,
            timestamp: new Date().toISOString()
        });

    } catch (err: any) {
        console.error("[Cron API Exception]", err);
        return NextResponse.json({ 
            success: false, 
            error: err.message || "Internal server error" 
        }, { status: 500 });
    }
}
