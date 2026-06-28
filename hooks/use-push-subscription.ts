"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

// Convert VAPID public key string into a Uint8Array
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

// User-Agent parser helpers
function parseUserAgent() {
    if (typeof window === "undefined") {
        return { browser: "Unknown", platform: "Unknown", deviceType: "Desktop" };
    }
    const ua = navigator.userAgent;
    let browser = "Other";
    let platform = "Other";
    let deviceType = "Desktop";

    if (ua.includes("Firefox")) browser = "Firefox";
    else if (ua.includes("SamsungBrowser")) browser = "Samsung Internet";
    else if (ua.includes("Edg")) browser = "Edge";
    else if (ua.includes("Chrome") && !ua.includes("Chromium")) browser = "Chrome";
    else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";

    if (/Android/i.test(ua)) platform = "Android";
    else if (/iPhone|iPad|iPod/i.test(ua)) platform = "iOS";
    else if (/Windows/i.test(ua)) platform = "Windows";
    else if (/Macintosh/i.test(ua)) platform = "macOS";
    else if (/Linux/i.test(ua)) platform = "Linux";

    if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) {
        deviceType = "Mobile";
    }

    return { browser, platform, deviceType };
}

export function usePushSubscription() {
    const { user, profile } = useAuth();
    const [isSupported, setIsSupported] = useState(false);
    const [permission, setPermission] = useState<NotificationPermission>("default");
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [loading, setLoading] = useState(true);
    const [currentSubscription, setCurrentSubscription] = useState<PushSubscription | null>(null);

    // Sync state with browser and database
    const syncState = useCallback(async () => {
        if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
            setIsSupported(false);
            setLoading(false);
            return;
        }

        setIsSupported(true);
        setPermission(Notification.permission);

        try {
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.getSubscription();
            
            setCurrentSubscription(sub);
            setIsSubscribed(!!sub);

            // If subscribed locally, ensure it exists in the database
            if (sub && user) {
                const subJson = sub.toJSON();
                const endpoint = sub.endpoint;
                const p256dh = subJson.keys?.p256dh || "";
                const auth = subJson.keys?.auth || "";
                const { browser, platform, deviceType } = parseUserAgent();

                // Check if this specific subscription is already in our DB
                const { data: existing } = await supabase
                    .from("push_subscriptions")
                    .select("id")
                    .eq("endpoint", endpoint)
                    .maybeSingle();

                if (!existing) {
                    await supabase
                        .from("push_subscriptions")
                        .insert({
                            user_id: user.id,
                            endpoint,
                            p256dh,
                            auth,
                            device_type: deviceType,
                            browser,
                            platform,
                        });
                    console.log("[PushSubscription] Synced local subscription to database.");
                }
            }
        } catch (err) {
            console.error("[PushSubscription] Error syncing state:", err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    // Initialize check
    useEffect(() => {
        syncState();
    }, [syncState]);

    // Request permission & subscribe
    const subscribeUser = async () => {
        if (!isSupported) {
            throw new Error("Push notifications not supported in this browser.");
        }

        setLoading(true);
        try {
            const permissionResult = await Notification.requestPermission();
            setPermission(permissionResult);

            if (permissionResult !== "granted") {
                throw new Error("Permission denied for push notifications.");
            }

            const reg = await navigator.serviceWorker.ready;
            const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            
            if (!vapidPublicKey) {
                throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY environment variable is not defined.");
            }

            const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
            
            // Subscribe locally with PushManager
            const sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey,
            });

            const subJson = sub.toJSON();
            const { browser, platform, deviceType } = parseUserAgent();

            // Insert into Supabase
            if (user) {
                const { error: insertError } = await supabase
                    .from("push_subscriptions")
                    .insert({
                        user_id: user.id,
                        endpoint: sub.endpoint,
                        p256dh: subJson.keys?.p256dh || "",
                        auth: subJson.keys?.auth || "",
                        device_type: deviceType,
                        browser,
                        platform,
                    });

                if (insertError) {
                    console.error("[PushSubscription] DB register error:", insertError.message);
                } else {
                    console.log("[PushSubscription] Database registered successfully.");
                }
            }

            setCurrentSubscription(sub);
            setIsSubscribed(true);
            return sub;
        } catch (err) {
            console.error("[PushSubscription] Subscription failed:", err);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    // Unsubscribe
    const unsubscribeUser = async () => {
        if (!currentSubscription) return;

        setLoading(true);
        try {
            const endpoint = currentSubscription.endpoint;

            // 1. Unsubscribe locally
            await currentSubscription.unsubscribe();

            // 2. Remove from database
            if (user) {
                const { error } = await supabase
                    .from("push_subscriptions")
                    .delete()
                    .eq("user_id", user.id)
                    .eq("endpoint", endpoint);

                if (error) {
                    console.error("[PushSubscription] Failed to delete token from DB:", error.message);
                }
            }

            setCurrentSubscription(null);
            setIsSubscribed(false);
            console.log("[PushSubscription] User unsubscribed successfully.");
        } catch (err) {
            console.error("[PushSubscription] Unsubscription failed:", err);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return {
        isSupported,
        permission,
        isSubscribed,
        loading,
        subscribeUser,
        unsubscribeUser,
        currentSubscription,
        syncState
    };
}
