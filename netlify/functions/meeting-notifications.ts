import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

/**
 * Netlify Scheduled Function - Meeting Notifications
 * Runs every minute via Netlify Scheduled Functions
 */
export async function handler(event: any, context: any): Promise<any> {
    // Only allow POST requests
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error("Missing Supabase environment variables");
        return { statusCode: 500, body: "Server configuration error" };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Set up VAPID keys for web push
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

    if (vapidPublicKey && vapidPrivateKey) {
        webpush.setVapidDetails(
            "mailto:admin@usthad.academy",
            vapidPublicKey,
            vapidPrivateKey,
        );
    }

    try {
        const now = new Date();
        const soon = new Date(now.getTime() + 5 * 60000); // 5 minutes from now

        // Fetch meetings starting between now and 5 mins from now
        const { data: meetings, error } = await supabase
            .from("meetings")
            .select("*")
            .gt("start_time", now.toISOString())
            .lte("start_time", soon.toISOString())
            .eq("notification_sent", false);

        if (error) {
            console.error("Error fetching meetings:", error);
            return { statusCode: 500, body: "Database error" };
        }

        if (!meetings || meetings.length === 0) {
            return { statusCode: 200, body: "No upcoming meetings found" };
        }

        console.log(`Found ${meetings.length} upcoming meetings`);

        for (const meeting of meetings) {
            // Get participants
            if (!meeting.participants || meeting.participants.length === 0) {
                console.log(`Meeting ${meeting.id} has no participants`);
                continue;
            }

            // Get users with push subscriptions
            const { data: users } = await supabase
                .from("profiles")
                .select("id, subscription")
                .in("id", meeting.participants)
                .not("subscription", "is", null);

            if (!users || users.length === 0) {
                console.log(
                    `No users with subscriptions for meeting ${meeting.id}`,
                );
                continue;
            }

            const payload = JSON.stringify({
                title: `📅 Meeting Reminder: ${meeting.title}`,
                body: `Starting at ${new Date(meeting.start_time).toLocaleTimeString()}`,
                icon: "/images/calendar-icon.png",
                data: { url: "/dashboard" },
                requireInteraction: true,
            });

            let sentCount = 0;
            for (const user of users) {
                if (user.subscription) {
                    try {
                        await webpush.sendNotification(
                            user.subscription,
                            payload,
                        );
                        sentCount++;
                    } catch (e: any) {
                        console.error(
                            `Error sending notification to user ${user.id}:`,
                            e.message,
                        );
                    }
                }
            }

            console.log(
                `Sent ${sentCount} notifications for meeting ${meeting.id}`,
            );

            // Mark notification as sent
            await supabase
                .from("meetings")
                .update({ notification_sent: true })
                .eq("id", meeting.id);
        }

        return {
            statusCode: 200,
            body: `Processed ${meetings.length} meetings successfully`,
        };
    } catch (err) {
        console.error("Error in meeting notifications:", err);
        return { statusCode: 500, body: "Internal server error" };
    }
}
