-- =====================================================
-- FIX STAFF CLEAR REQUESTS FUNCTIONALITY
-- This creates a function that allows staff to delete their own non-pending requests
-- =====================================================

-- Drop existing policy that prevents staff from deleting their own requests
DROP POLICY IF EXISTS "CEO can delete requests" ON requests;

-- Create a new policy that allows staff to delete their own non-pending requests
-- and CEO can delete any requests
CREATE POLICY "Users can delete own non-pending requests and CEO can delete all"
  ON requests FOR DELETE
  TO authenticated
  USING (
    -- Staff can delete their own requests if they are not pending
    (auth.uid() = submitted_by AND status != 'pending') OR
    -- CEO can delete any request
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ceo')
  );

-- Alternative approach: Create a specific function for staff to clear their requests
CREATE OR REPLACE FUNCTION clear_staff_requests(staff_id UUID)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete all non-pending requests for this staff member
    DELETE FROM requests 
    WHERE submitted_by = staff_id 
    AND status != 'pending';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION clear_staff_requests(UUID) TO authenticated;

-- Create a safer version that checks the caller is the staff member
CREATE OR REPLACE FUNCTION clear_my_requests()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete all non-pending requests for the current user
    DELETE FROM requests 
    WHERE submitted_by = auth.uid() 
    AND status != 'pending';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION clear_my_requests() TO authenticated;
