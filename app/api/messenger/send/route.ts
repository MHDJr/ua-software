import { NextResponse } from "next/server";

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

        const oneSignalPayload = {
            app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "25c17e4d-dd90-4551-a1bb-1fbf9be673bf",
            target_channel: "push",
            include_aliases: {
                external_id: [recipientId]
            },
            headings: { "en": "UA Command Link" },
            contents: { "en": "Assigned new task by CEO. Check dashboard monitor." },
            chrome_web_icon: "https://dashboard.usthadacademy.com/logo.png"
        };

        const response = await fetch("https://api.onesignal.com/notifications", {
            method: "POST",
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Authorization": `Key ${process.env.ONESIGNAL_REST_API_KEY}`
            },
            body: JSON.stringify(oneSignalPayload)
        });

        const responseData = await response.json();

        // Terminal Verification Logging
        console.log("📡 OneSignal Payload Dispatch Log:", responseData);

        if (!response.ok) {
            return NextResponse.json(
                { error: "OneSignal API error", details: responseData },
                { status: response.status }
            );
        }

        return NextResponse.json({ success: true, data: responseData });
    } catch (error: any) {
        console.error("❌ Exception inside messenger send api endpoint:", error);
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
