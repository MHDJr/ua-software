import { supabaseAdmin } from "./supabase-admin";
import webpush from "web-push";

// Initialize web-push details if keys are present
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (vapidPublicKey && vapidPrivateKey) {
    try {
        webpush.setVapidDetails(
            "mailto:support@usthadacademy.com",
            vapidPublicKey,
            vapidPrivateKey
        );
    } catch (err) {
        console.error("[NotificationEngine] Failed to initialize web-push VAPID details:", err);
    }
} else {
    console.warn("[NotificationEngine] VAPID keys are missing. Web Push notifications will be disabled.");
}

/**
 * Dispatches push notifications to all registered channels for the user:
 * 1. OneSignal (external_id based targeting)
 * 2. Standard Native Web Push (direct client subscription targeting)
 */
export async function sendPushNotification(userId: string | null | undefined, title: string, body: string) {
    if (!userId) {
        console.warn("[NotificationEngine] Skipping push notification: userId is empty.");
        return;
    }

    console.log(`[NotificationEngine] Dispatching notifications to user ${userId}: "${title}" - "${body}"`);

    // 1. Dispatch OneSignal Push Notification
    try {
        const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "25c17e4d-dd90-4551-a1bb-1fbf9be673bf";
        const restKey = process.env.ONESIGNAL_REST_API_KEY;

        const oneSignalPayload = {
            app_id: appId,
            target_channel: "push",
            include_aliases: {
                external_id: [userId]
            },
            headings: { en: title },
            contents: { en: body },
            chrome_web_icon: "https://dashboard.usthadacademy.com/logo.png"
        };

        const response = await fetch("https://api.onesignal.com/notifications", {
            method: "POST",
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Authorization": `Key ${restKey || ""}`
            },
            body: JSON.stringify(oneSignalPayload)
        });

        const oneSignalData = await response.json();
        console.log("📡 [NotificationEngine] OneSignal dispatch response:", oneSignalData);
    } catch (pushErr) {
        console.error("❌ [NotificationEngine] Failed to dispatch OneSignal push notification:", pushErr);
    }

    // 2. Dispatch Standard Native Web Push
    try {
        if (!supabaseAdmin) {
            console.warn("⚠️ [NotificationEngine] supabaseAdmin is not initialized. Skipping native Web Push.");
            return;
        }

        if (!vapidPublicKey || !vapidPrivateKey) {
            console.warn("⚠️ [NotificationEngine] Missing VAPID keys. Skipping native Web Push.");
            return;
        }

        // Retrieve active native push tokens for user
        const { data: tokens, error: fetchError } = await supabaseAdmin
            .from("staff_push_tokens")
            .select("id, subscription")
            .eq("user_id", userId);

        if (fetchError) {
            console.error("❌ [NotificationEngine] Error fetching native push tokens:", fetchError.message);
            return;
        }

        if (tokens && tokens.length > 0) {
            console.log(`📡 [NotificationEngine] Dispatching Web Push to ${tokens.length} active devices.`);
            const payload = JSON.stringify({ title, body });

            const sendPromises = tokens.map(async (tokenRow: any) => {
                try {
                    await webpush.sendNotification(tokenRow.subscription, payload);
                } catch (err: any) {
                    console.error(`❌ [NotificationEngine] Failed dispatching native push to token ID ${tokenRow.id}:`, err);
                    
                    // If subscription is expired or invalid (410 Gone / 404 Not Found), purge it
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        console.log(`🧹 [NotificationEngine] Purging stale native push token: ${tokenRow.id}`);
                        await supabaseAdmin
                            .from("staff_push_tokens")
                            .delete()
                            .eq("id", tokenRow.id);
                    }
                }
            });

            await Promise.all(sendPromises);
        } else {
            console.log("[NotificationEngine] No registered native Web Push tokens found for user.");
        }
    } catch (webPushErr) {
        console.error("❌ [NotificationEngine] Failed to dispatch standard Web Push notifications:", webPushErr);
    }
}
