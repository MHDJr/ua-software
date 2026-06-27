import { NextResponse } from "next/server";
import { sendPushNotification } from "@/lib/notifications";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { recipientId, messageText, senderName } = body;

        if (!recipientId) {
            return NextResponse.json(
                { error: "recipientId is required" },
                { status: 400 }
            );
        }

        // Dispatch push notifications using the unified engine (dynamic title and body)
        await sendPushNotification(
            recipientId,
            senderName || "UA Command Link",
            messageText || "Assigned new task. Check dashboard monitor."
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("❌ Exception inside messenger send api endpoint:", error);
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
