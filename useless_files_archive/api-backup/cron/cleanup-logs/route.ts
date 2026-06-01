import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic'; // Prevent caching

export async function GET(request: Request) {
    // Optional: Add simple authorization using a secret token in the URL or headers
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    // If a secret is configured, enforce it
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        console.log("Starting defensive storage cleanup routine...");

        // 1. Truncate Activity Feed (Keep only last 180 days)
        // We use a raw SQL function if possible, but since we are using the JS client, 
        // we can filter and delete, OR use a specialized RPC function.
        // For robustness without an RPC, we query IDs first, then delete (or just rely on the DB trigger if we had one).
        // A cleaner way via Supabase JS without RPC is calling .delete() with a date filter.
        
        const hundredEightyDaysAgo = new Date();
        hundredEightyDaysAgo.setDate(hundredEightyDaysAgo.getDate() - 180);
        const cutoffDate = hundredEightyDaysAgo.toISOString();

        const { error: activityError, count: activityCount } = await supabaseAdmin
            .from('activity_feed')
            .delete({ count: 'exact' })
            .lt('created_at', cutoffDate);

        if (activityError) {
            console.error("Failed to clean activity_feed:", activityError);
            throw activityError;
        }

        // 2. Truncate Tutor Notifications (Keep only last 180 days)
        const { error: tutorError, count: tutorCount } = await supabaseAdmin
            .from('tutor_notifications')
            .delete({ count: 'exact' })
            .lt('created_at', cutoffDate);

        if (tutorError) {
            console.error("Failed to clean tutor_notifications:", tutorError);
            throw tutorError;
        }

        return NextResponse.json({
            success: true,
            message: "Storage optimization completed successfully.",
            records_removed: {
                activity_feed: activityCount || 0,
                tutor_notifications: tutorCount || 0
            }
        });

    } catch (error: any) {
        console.error("Storage cleanup failed:", error);
        return NextResponse.json({ 
            success: false, 
            error: error.message || "An unexpected error occurred during cleanup" 
        }, { status: 500 });
    }
}
