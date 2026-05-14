-- Enable Realtime for the tables used in live analytics
BEGIN;
  -- Add tables to the supabase_realtime publication
  ALTER PUBLICATION supabase_realtime ADD TABLE orders;
  ALTER PUBLICATION supabase_realtime ADD TABLE financial_ledger;
COMMIT;
