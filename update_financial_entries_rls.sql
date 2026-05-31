-- ============================================
-- UPDATE FINANCIAL ENTRIES RLS POLICIES FOR FINANCE MANAGER
-- ============================================

-- 1. Drop old restrictive policies
DROP POLICY IF EXISTS "CEO can view all financial entries" ON financial_entries;
DROP POLICY IF EXISTS "CEO can update financial entries" ON financial_entries;

-- 2. Create comprehensive view policy for CEO and Finance Manager
CREATE POLICY "CEO and Finance Manager can view all financial entries" ON financial_entries FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND (role = 'ceo' OR (is_manager = true AND department = 'Finance'))
        )
    );

-- 3. Create comprehensive update policy for CEO and Finance Manager
CREATE POLICY "CEO and Finance Manager can update financial entries" ON financial_entries FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND (role = 'ceo' OR (is_manager = true AND department = 'Finance'))
        )
    );

-- 4. Create comprehensive insert policy for accounts staff and Finance Manager
DROP POLICY IF EXISTS "Users can insert own financial entries" ON financial_entries;
CREATE POLICY "Users and Finance Manager can insert financial entries" ON financial_entries FOR INSERT
    WITH CHECK (
        auth.uid() = user_id OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND (role = 'ceo' OR (is_manager = true AND department = 'Finance'))
        )
    );
