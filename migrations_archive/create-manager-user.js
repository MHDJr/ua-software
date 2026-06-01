/**
 * Create Manager User Script
 * Run this script to create a temporary manager user
 * Credentials: manager@ua.academy / 1234
 * 
 * Usage: node create-manager-user.js
 * 
 * Make sure to set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function createManagerUser() {
    try {
        console.log('Creating manager user...');
        
        // Create auth user
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: 'manager@ua.academy',
            password: '1234',
            email_confirm: true,
            user_metadata: {
                full_name: 'Manager User',
                role: 'manager',
                is_manager: true
            }
        });

        if (authError) {
            if (authError.message.includes('already registered')) {
                console.log('Manager user already exists in auth system');
                // Try to get existing user
                const { data: existingUsers } = await supabase.auth.admin.listUsers();
                const existingUser = existingUsers.users.find(u => u.email === 'manager@ua.academy');
                
                if (existingUser) {
                    // Update profile
                    const { error: profileError } = await supabase
                        .from('profiles')
                        .upsert({
                            id: existingUser.id,
                            email: existingUser.email,
                            full_name: 'Manager User',
                            role: 'manager',
                            is_manager: true,
                            updated_at: new Date().toISOString()
                        }, {
                            onConflict: 'id'
                        });
                    
                    if (profileError) {
                        console.error('Error updating profile:', profileError);
                    } else {
                        console.log('Manager profile updated successfully');
                    }
                }
            } else {
                throw authError;
            }
        } else {
            console.log('Auth user created successfully:', authData.user.id);
            
            // Create/update profile
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    id: authData.user.id,
                    email: authData.user.email,
                    full_name: 'Manager User',
                    role: 'manager',
                    is_manager: true,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'id'
                });
            
            if (profileError) {
                console.error('Error creating profile:', profileError);
            } else {
                console.log('Manager profile created successfully');
            }
        }
        
        console.log('\n✅ Manager user setup complete!');
        console.log('Email: manager@ua.academy');
        console.log('Password: 1234');
        console.log('\n⚠️  WARNING: This is a temporary credential. Change it in production!');
        
    } catch (error) {
        console.error('Error creating manager user:', error);
        process.exit(1);
    }
}

createManagerUser();
