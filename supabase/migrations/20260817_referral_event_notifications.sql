-- Referral ledger event notifications and qualification updates.
CREATE OR REPLACE FUNCTION public.handle_referral_ledger_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_title TEXT;
  v_content TEXT;
  v_link TEXT := '/dashboard/customer/referrals';
BEGIN
  IF NEW.source_type = 'USER_PURCHASE_REFERRAL' AND NEW.amount > 0 THEN
    v_title := 'Referral purchase reward earned';
    v_content := 'You earned ₦' || to_char(NEW.amount, 'FM999G999G990D00') || ' from a referred customer purchase.';
  ELSIF NEW.source_type = 'VENDOR_SALES_REFERRAL' AND NEW.amount > 0 THEN
    v_title := 'Vendor referral reward earned';
    v_content := 'You earned ₦' || to_char(NEW.amount, 'FM999G999G990D00') || ' from a referred vendor sale.';
  ELSIF NEW.source_type = 'REFERRAL_REVERSAL' AND NEW.amount < 0 THEN
    v_title := 'Referral earning reversed';
    v_content := 'A referral earning was reversed because the underlying transaction was refunded or cancelled.';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, content, link, is_read)
  VALUES (NEW.beneficiary_user_id, 'referral', v_title, v_content, v_link, false);

  IF NEW.referral_id IS NOT NULL AND NEW.source_type IN ('USER_PURCHASE_REFERRAL', 'VENDOR_SALES_REFERRAL') AND NEW.amount > 0 THEN
    UPDATE public.referral_relationships
    SET status = CASE WHEN status IN ('registered', 'activated') THEN 'qualified' ELSE status END,
        qualified_at = COALESCE(qualified_at, now())
    WHERE id = NEW.referral_id;
    UPDATE public.referral_links
    SET qualified_count = qualified_count + 1,
        last_activity_at = now()
    WHERE id = (SELECT referral_link_id FROM public.referral_relationships WHERE id = NEW.referral_id);
    INSERT INTO public.referral_events (referral_id, event_type, actor_user_id, source_order_id, event_key, metadata)
    VALUES (NEW.referral_id, 'earning_generated', NEW.beneficiary_user_id, NEW.source_transaction_id, 'earning_event:' || NEW.source_key, jsonb_build_object('source_type', NEW.source_type, 'amount', NEW.amount))
    ON CONFLICT (event_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS referral_ledger_event_notification ON public.referral_ledger;
CREATE TRIGGER referral_ledger_event_notification
AFTER INSERT ON public.referral_ledger
FOR EACH ROW EXECUTE FUNCTION public.handle_referral_ledger_event();

REVOKE EXECUTE ON FUNCTION public.handle_referral_ledger_event() FROM anon, authenticated;
NOTIFY pgrst, 'reload schema';
