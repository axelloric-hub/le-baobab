CREATE OR REPLACE VIEW v_store_statistics AS
SELECT s.id AS store_id, s.name,
       (SELECT count(*) FROM marketplace_product p WHERE p.store_id = s.id AND p.status = 'published') AS published_products,
       (SELECT count(DISTINCT oi.order_id) FROM marketplace_order_item oi JOIN marketplace_order o ON o.id = oi.order_id
         WHERE oi.store_id = s.id AND o.status IN ('paid', 'partially_refunded', 'refunded')) AS paid_orders,
       (SELECT COALESCE(sum(oi.quantity), 0) FROM marketplace_order_item oi JOIN marketplace_order o ON o.id = oi.order_id
         WHERE oi.store_id = s.id AND o.status IN ('paid', 'partially_refunded', 'refunded')) AS units_sold,
       (SELECT seller_net FROM baobab_store_revenue(s.id)) AS net_revenue_minor
  FROM marketplace_store s;
