"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

// Utility to convert VAPID public key string properly into a Uint8Array for iOS compatibility
function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/");

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export function usePushSubscription() {
    const { user, profile } = useAuth();

    useEffect(() => {
        // Hard Gate: If the V2 flag is not explicitly 'true', completely kill execution
        if (process.env.NEXT_PUBLIC_ENABLE_V2_FEATURES !== "true") {
            return;
        }

        if (!user || !profile) return;

        // Auto-request notifications on mobile devices, or if testing with ENABLE_V2_FEATURES bypass
        const isBypass = typeof window !== "undefined" && window.localStorage.getItem("ENABLE_V2_FEATURES") === "true";
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || isBypass;
        if (!isMobile) return;

        const registerPush = async () => {
            try {
                if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
                    console.warn("Push notifications are not supported in this browser environment.");
                    return;
                }

                // Wait for service worker registration to be ready
                const reg = await navigator.serviceWorker.ready;
                
                // Request push permission from the browser
                const permission = await Notification.requestPermission();
                if (permission !== "granted") {
                    console.log("Notification permission not granted:", permission);
                    return;
                }

                const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
                if (!vapidPublicKey) {
                    console.error("NEXT_PUBLIC_VAPID_PUBLIC_KEY environment variable is not defined.");
                    return;
                }

                const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

                // Register subscription
                const subscription = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey,
                });

                console.log("[PushSubscription] Client subscribed to Web Push:", subscription);

                const subscriptionJson = subscription.toJSON();
                const deviceInfo = `${navigator.userAgent} (${isBypass ? 'Bypass/Mock' : 'Mobile'})`;

                // Check if this exact subscription is already registered
                const { data: existing } = await supabase
                    .from("staff_push_tokens")
                    .select("id")
                    .eq("user_id", user.id)
                    .eq("subscription", subscriptionJson)
                    .maybeSingle();

                if (!existing) {
                    const { error: insertError } = await supabase
                        .from("staff_push_tokens")
                        .insert({
                            user_id: user.id,
                            subscription: subscriptionJson,
                            device_info: deviceInfo,
                        });

                    if (insertError) {
                        console.error("Failed to register push token with Supabase:", insertError.message);
                    } else {
                        console.log("Registered push subscription successfully with Supabase.");
                    }
                } else {
                    console.log("Push subscription is already registered in database.");
                }
            } catch (err: any) {
                console.error("Error during push subscription capture:", err);
            }
        };

        registerPush();
    }, [user, profile]);
}
