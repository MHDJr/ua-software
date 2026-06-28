import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push";

// Define response headers with CORS support
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-push-trigger-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
    // 1. Handle preflight CORS request
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
            status: 405,
            headers: { "Content-Type": "application/json", ...corsHeaders }
        });
    }

    try {
        const authHeader = req.headers.get("Authorization") || "";
        const triggerSecretHeader = req.headers.get("x-push-trigger-secret") || "";

        const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
        const systemTriggerSecret = Deno.env.get("TRIGGER_SECRET") || "ua-secure-system-trigger-secret-token-2026";

        // Parse input payload early for security validation
        const body = await req.json();
        const { recipient_id, title, body: text, url, icon, image } = body;

        if (!recipient_id || !title || !text) {
            return new Response(JSON.stringify({ error: "Missing required fields: recipient_id, title, body" }), {
                status: 400,
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        }

        // Validate credentials
        const hasValidAuthToken = authHeader.replace("Bearer ", "") === serviceRoleKey;
        const hasValidTriggerSecret = triggerSecretHeader === systemTriggerSecret;
        
        let hasValidUserToken = false;
        if (authHeader && !hasValidAuthToken) {
            try {
                // Initialize client with user JWT to check identity
                const authClient = createClient(supabaseUrl, serviceRoleKey, {
                    auth: {
                        persistSession: false,
                        autoRefreshToken: false
                    }
                });
                
                const jwtToken = authHeader.replace("Bearer ", "");
                const { data: { user }, error: userError } = await authClient.auth.getUser(jwtToken);
                
                // Allow if user is verified and requesting push for themselves
                if (!userError && user && user.id === recipient_id) {
                    hasValidUserToken = true;
                }
            } catch (err: any) {
                console.warn("[PushNotificationEdge] User authentication verification failed:", err.message);
            }
        }

        if (!hasValidAuthToken && !hasValidTriggerSecret && !hasValidUserToken) {
            console.error("[PushNotificationEdge] Security Failure: Unauthorized attempt to send push notification.");
            return new Response(JSON.stringify({ error: "Unauthorized: Invalid credentials or trigger token." }), {
                status: 401,
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        }

        // 4. Initialize Supabase Admin Client
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            }
        });

        // 5. Fetch all active subscriptions for the user
        const { data: subscriptions, error: fetchError } = await supabaseAdmin
            .from("push_subscriptions")
            .select("id, endpoint, p256dh, auth")
            .eq("user_id", recipient_id);

        if (fetchError) {
            console.error(`[PushNotificationEdge] Database lookup error: ${fetchError.message}`);
            return new Response(JSON.stringify({ error: "Database error fetching subscriptions" }), {
                status: 500,
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        }

        if (!subscriptions || subscriptions.length === 0) {
            console.log(`[PushNotificationEdge] No active subscriptions registered for user ${recipient_id}`);
            return new Response(JSON.stringify({ success: true, message: "No active subscriptions found" }), {
                status: 200,
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        }

        // 6. Setup web-push VAPID details
        const vapidPublicKey = Deno.env.get("NEXT_PUBLIC_VAPID_PUBLIC_KEY") || Deno.env.get("VAPID_PUBLIC_KEY");
        const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

        if (!vapidPublicKey || !vapidPrivateKey) {
            console.error("[PushNotificationEdge] Server configuration error: VAPID keys are missing.");
            return new Response(JSON.stringify({ error: "Server Configuration Error: VAPID keys missing" }), {
                status: 500,
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        }

        webpush.setVapidDetails(
            "mailto:support@usthadacademy.com",
            vapidPublicKey,
            vapidPrivateKey
        );

        // 7. Prepare push payload
        const pushPayload = JSON.stringify({
            title,
            body: text,
            url: url || "/",
            icon: icon || "/logo.png",
            badge: "/logo.png",
            image: image || undefined,
            vibrate: [200, 100, 200],
            tag: url ? `nav-${url}` : undefined,
            requireInteraction: true
        });

        console.log(`[PushNotificationEdge] Sending push to ${subscriptions.length} devices of user ${recipient_id}`);

        const results = {
            attempted: subscriptions.length,
            successful: 0,
            failed: 0,
            pruned: 0,
            logs: [] as string[]
        };

        // 8. Iterate over subscriptions and dispatch notifications with retries and pruning logic
        const sendPromises = subscriptions.map(async (sub) => {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth
                }
            };

            let attempts = 0;
            const maxAttempts = 3;
            let success = false;
            let lastError: any = null;

            while (attempts < maxAttempts && !success) {
                attempts++;
                try {
                    await webpush.sendNotification(pushSubscription, pushPayload);
                    success = true;
                    results.successful++;
                    
                    // Update last active time for the subscription
                    await supabaseAdmin
                        .from("push_subscriptions")
                        .update({ last_used_at: new Date().toISOString() })
                        .eq("id", sub.id);
                    
                    results.logs.push(`Successfully sent push to subscription ID ${sub.id} on attempt ${attempts}`);
                } catch (err: any) {
                    lastError = err;
                    console.warn(`[PushNotificationEdge] Error on subscription ID ${sub.id} (attempt ${attempts}/${maxAttempts}):`, err.message);
                    
                    // If subscription has expired or is invalid (410 Gone / 404 Not Found), stop retrying and prune
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        results.logs.push(`Subscription ID ${sub.id} is stale/expired (HTTP ${err.statusCode}). Pruning.`);
                        await supabaseAdmin
                            .from("push_subscriptions")
                            .delete()
                            .eq("id", sub.id);
                        
                        results.pruned++;
                        results.failed++;
                        return;
                    }

                    // For temporary rate-limiting (429) or gateway errors (500, 502, 503), wait and retry
                    if (attempts < maxAttempts) {
                        const waitTime = Math.pow(2, attempts) * 300; // Exponential backoff (600ms, 1200ms)
                        await new Promise((resolve) => setTimeout(resolve, waitTime));
                    }
                }
            }

            if (!success) {
                results.failed++;
                results.logs.push(`Failed to send push to subscription ID ${sub.id} after ${maxAttempts} attempts. Error: ${lastError?.message || "Unknown error"}`);
            }
        });

        await Promise.all(sendPromises);

        return new Response(JSON.stringify({ success: true, results }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders }
        });

    } catch (err: any) {
        console.error("[PushNotificationEdge] Fatal Edge Function Error:", err);
        return new Response(JSON.stringify({ error: "Fatal Internal Server Error", details: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders }
        });
    }
});
