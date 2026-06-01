// Debug script to test financial data fetching
// Run this in browser console on CEO Financial Intelligence page

async function debugFinancialData() {
    console.log('=== DEBUGGING FINANCIAL DATA ===');
    
    // Check if supabase is available
    if (typeof window === 'undefined' || !window.supabase) {
        console.error('Supabase not available');
        return;
    }
    
    try {
        // Test 1: Check if user is authenticated
        const { data: { user }, error: authError } = await window.supabase.auth.getUser();
        console.log('User:', user);
        console.log('Auth Error:', authError);
        
        if (!user) {
            console.error('❌ User not authenticated');
            return;
        }
        
        // Test 2: Check if financial_entries table exists
        console.log('\n=== TESTING TABLE ACCESS ===');
        const { data: tableData, error: tableError } = await window.supabase
            .from('financial_entries')
            .select('count')
            .limit(1);
            
        console.log('Table access test:', { tableData, tableError });
        
        if (tableError) {
            console.error('❌ Cannot access financial_entries table:', tableError);
            console.log('This means the SQL setup has NOT been run in Supabase');
            return;
        }
        
        // Test 3: Try to fetch actual financial data
        console.log('\n=== FETCHING FINANCIAL DATA ===');
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const { data: entries, error: fetchError } = await window.supabase
            .from('financial_entries')
            .select('*')
            .gte('entry_date', thirtyDaysAgo.toISOString().split('T')[0])
            .order('entry_date', { ascending: false });
            
        console.log('Financial entries:', entries);
        console.log('Fetch error:', fetchError);
        
        // Test 4: Check if there's any sample data
        console.log('\n=== CHECKING SAMPLE DATA ===');
        const { data: allEntries, error: allError } = await window.supabase
            .from('financial_entries')
            .select('*')
            .limit(5);
            
        console.log('All entries (sample):', allEntries);
        console.log('All entries error:', allError);
        
        // Test 5: Try to insert sample data if table is empty
        if (!entries || entries.length === 0) {
            console.log('\n=== INSERTING SAMPLE DATA ===');
            const today = new Date().toISOString().split('T')[0];
            
            const { data: insertData, error: insertError } = await window.supabase
                .from('financial_entries')
                .insert({
                    user_id: user.id,
                    entry_date: today,
                    uloomx_income: 125000,
                    usthad_income: 83000,
                    total_expenses: 42000,
                    submitted_by: user.id,
                    status: 'approved'
                })
                .select()
                .single();
                
            console.log('Sample insert result:', { insertData, insertError });
        }
        
    } catch (error) {
        console.error('Debug error:', error);
    }
}

// Make function available globally
window.debugFinancialData = debugFinancialData;

console.log('🔧 Debug function loaded! Run: debugFinancialData()');
