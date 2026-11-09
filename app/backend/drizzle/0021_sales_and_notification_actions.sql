CREATE TABLE ibpa.sales (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 title varchar(255) NOT NULL, short_description text NOT NULL DEFAULT '', description text NOT NULL DEFAULT '',
 translations jsonb NOT NULL DEFAULT '{}', image_presentation jsonb,
 category varchar(80) NOT NULL DEFAULT 'service', price integer NOT NULL CHECK (price >= 50 AND price <= 99999999),
 currency varchar(3) NOT NULL DEFAULT 'usd' CHECK (currency = 'usd'),
 compare_at_price integer CHECK (compare_at_price > price AND compare_at_price <= 99999999),
 status varchar(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED')),
 starts_at timestamptz, expires_at timestamptz,
 quantity_limit integer CHECK (quantity_limit > 0), one_per_account boolean NOT NULL DEFAULT false,
 cta_label varchar(80), version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (expires_at IS NULL OR starts_at IS NULL OR expires_at > starts_at)
);
--> statement-breakpoint
CREATE INDEX sales_status_created_idx ON ibpa.sales(status, created_at DESC);
--> statement-breakpoint
CREATE TABLE ibpa.sale_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sale_id uuid NOT NULL REFERENCES ibpa.sales(id) ON DELETE RESTRICT,
 user_id uuid NOT NULL REFERENCES ibpa.users(id) ON DELETE RESTRICT,
 buyer_email varchar(255) NOT NULL, item_title varchar(255) NOT NULL,
 amount integer NOT NULL CHECK (amount >= 50), currency varchar(3) NOT NULL CHECK (currency = 'usd'),
 status varchar(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PAID','FAILED','CANCELED','REFUNDED')),
 request_key uuid NOT NULL, stripe_session_id text UNIQUE, stripe_payment_intent_id text UNIQUE,
 checkout_url text, return_path text NOT NULL, locale varchar(2) NOT NULL DEFAULT 'en',
 refunded_amount integer NOT NULL DEFAULT 0 CHECK (refunded_amount >= 0 AND refunded_amount <= amount),
 failure_code text, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 paid_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id, request_key)
);
--> statement-breakpoint
CREATE INDEX sale_orders_user_created_idx ON ibpa.sale_orders(user_id, created_at DESC);
--> statement-breakpoint
CREATE INDEX sale_orders_sale_status_idx ON ibpa.sale_orders(sale_id,status);
--> statement-breakpoint
CREATE UNIQUE INDEX sale_orders_pending_buyer_idx ON ibpa.sale_orders(sale_id,user_id) WHERE status = 'PENDING';
--> statement-breakpoint
ALTER TABLE ibpa.events ADD COLUMN linked_sale_id uuid REFERENCES ibpa.sales(id) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE ibpa.notifications ADD COLUMN action_type varchar(20) NOT NULL DEFAULT 'NONE'
 CHECK (action_type IN ('NONE','INTERNAL','EXTERNAL','SALE','EVENT'));
--> statement-breakpoint
ALTER TABLE ibpa.notifications ADD COLUMN linked_sale_id uuid REFERENCES ibpa.sales(id) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE ibpa.notifications ADD COLUMN linked_event_id uuid REFERENCES ibpa.events(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE ibpa.notifications ADD COLUMN category varchar(30) NOT NULL DEFAULT 'admin';
--> statement-breakpoint
ALTER TABLE ibpa.notifications ADD COLUMN translations jsonb NOT NULL DEFAULT '{}';
--> statement-breakpoint
-- Legacy CTA values are retained; only safe legacy actions are activated.
UPDATE ibpa.notifications SET action_type = CASE
 WHEN metadata->>'ctaUrl' ~ '^/dashboard([/?#]|$)' AND metadata->>'ctaUrl' !~ '[\\[:cntrl:]]' THEN 'INTERNAL'
 WHEN metadata->>'ctaUrl' ~ '^https?://' AND metadata->>'ctaUrl' !~ '[\\[:cntrl:]]' THEN 'EXTERNAL'
 ELSE 'NONE' END WHERE type = 'DASHBOARD';
--> statement-breakpoint
CREATE TABLE ibpa.notification_receipts (
 notification_id uuid NOT NULL REFERENCES ibpa.notifications(id) ON DELETE CASCADE,
 clerk_user_id varchar(255) NOT NULL, read_at timestamptz, toasted_at timestamptz,
 PRIMARY KEY(notification_id, clerk_user_id)
);
--> statement-breakpoint
-- A single server-side statement provides an interactive transaction even with
-- the existing Neon HTTP driver. All checkout reservations serialize on sale.
CREATE FUNCTION ibpa.reserve_sale(p_sale uuid, p_user uuid, p_email text, p_key uuid, p_path text, p_locale text)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE s ibpa.sales; o ibpa.sale_orders; used bigint;
BEGIN
 SELECT * INTO s FROM ibpa.sales WHERE id = p_sale FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'SALE_NOT_FOUND'; END IF;
 SELECT * INTO o FROM ibpa.sale_orders WHERE user_id = p_user AND request_key = p_key;
 IF FOUND THEN
  IF o.sale_id <> p_sale THEN RAISE EXCEPTION 'REQUEST_CONFLICT'; END IF;
  RETURN o.id;
 END IF;
 IF s.status <> 'PUBLISHED' OR (s.starts_at IS NOT NULL AND s.starts_at > now()) OR
    (s.expires_at IS NOT NULL AND s.expires_at <= now()) THEN RAISE EXCEPTION 'SALE_UNAVAILABLE'; END IF;
 SELECT * INTO o FROM ibpa.sale_orders WHERE sale_id=p_sale AND user_id=p_user AND status='PENDING';
 IF FOUND THEN RETURN o.id; END IF;
 IF s.one_per_account AND EXISTS(SELECT 1 FROM ibpa.sale_orders WHERE sale_id=p_sale AND user_id=p_user AND status IN ('PAID','REFUNDED')) THEN
  RAISE EXCEPTION 'ALREADY_PURCHASED';
 END IF;
 SELECT count(*) INTO used FROM ibpa.sale_orders WHERE sale_id=p_sale AND status IN ('PENDING','PAID','REFUNDED');
 IF s.quantity_limit IS NOT NULL AND used >= s.quantity_limit THEN RAISE EXCEPTION 'SOLD_OUT'; END IF;
 INSERT INTO ibpa.sale_orders(sale_id,user_id,buyer_email,item_title,amount,currency,request_key,return_path,locale,expires_at)
 VALUES(p_sale,p_user,p_email,s.title,s.price,s.currency,p_key,p_path,p_locale,date_trunc('second',now())+interval '1 hour') RETURNING * INTO o;
 RETURN o.id;
END $$;
