-- Add hostel and room number to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS hostel TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS room_number TEXT;

-- Update orders table to optionally store these if we want to track them separately in the future, 
-- but for now they go into the shipping_address string anyway.
