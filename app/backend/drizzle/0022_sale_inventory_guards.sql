-- The trigger runs after PostgreSQL acquires the sale tuple lock. Its volatile
-- query uses a fresh snapshot, including reservations committed while waiting.
CREATE FUNCTION ibpa.check_sale_limit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.quantity_limit IS NOT NULL AND NEW.quantity_limit <
   (SELECT count(*) FROM ibpa.sale_orders WHERE sale_id=NEW.id AND status IN ('PENDING','PAID','REFUNDED')) THEN
  RAISE EXCEPTION 'SALE_CONFLICT';
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER sales_inventory_limit BEFORE UPDATE OF quantity_limit ON ibpa.sales
 FOR EACH ROW EXECUTE FUNCTION ibpa.check_sale_limit();
--> statement-breakpoint
-- Fulfillment is atomic with the payment transition. Replayed webhooks cannot
-- create duplicate registrations. Full refunds revoke sale-created access only.
CREATE FUNCTION ibpa.fulfill_sale_events() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status='PAID' AND OLD.status <> 'PAID' THEN
  INSERT INTO ibpa.event_registrations(event_id,user_id,email,status,source,registered_at)
  SELECT id,NEW.user_id,NEW.buyer_email,'REGISTERED','sale:'||NEW.id::text,coalesce(NEW.paid_at,now())
   FROM ibpa.events WHERE linked_sale_id=NEW.sale_id AND publish_to_dashboard=true
  ON CONFLICT(event_id,user_id) DO UPDATE SET status='REGISTERED',source=excluded.source,
    registered_at=excluded.registered_at,cancelled_at=NULL,updated_at=now()
    WHERE ibpa.event_registrations.status='CANCELLED';
 ELSIF NEW.status='REFUNDED' AND OLD.status <> 'REFUNDED' THEN
  UPDATE ibpa.event_registrations SET status='CANCELLED',cancelled_at=now(),updated_at=now()
   WHERE user_id=NEW.user_id
    AND source IN (SELECT 'sale:'||id::text FROM ibpa.sale_orders WHERE user_id=NEW.user_id AND sale_id=NEW.sale_id)
    AND NOT EXISTS(SELECT 1 FROM ibpa.sale_orders WHERE user_id=NEW.user_id AND sale_id=NEW.sale_id AND status='PAID');
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER sale_orders_fulfillment AFTER UPDATE OF status ON ibpa.sale_orders
 FOR EACH ROW EXECUTE FUNCTION ibpa.fulfill_sale_events();
