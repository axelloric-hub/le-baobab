CREATE OR REPLACE VIEW v_campaign_statistics AS
SELECT c.id AS campaign_id, c.name, c.status, c.account_id,
       COALESCE(sum(s.impressions), 0) AS impressions, COALESCE(sum(s.clicks), 0) AS clicks, COALESCE(sum(s.conversions), 0) AS conversions,
       COALESCE(sum(s.spend_micro), 0) / 1000000.0 AS spend_minor,
       CASE WHEN COALESCE(sum(s.impressions), 0) = 0 THEN 0 ELSE round(100.0 * sum(s.clicks) / sum(s.impressions), 2) END AS ctr_percent,
       c.total_budget_minor - COALESCE(sum(s.spend_micro), 0) / 1000000.0 AS remaining_budget_minor
  FROM advertising_campaign c
  LEFT JOIN advertising_adset a ON a.campaign_id = c.id
  LEFT JOIN advertising_ad ad ON ad.ad_set_id = a.id
  LEFT JOIN advertising_settlement s ON s.ad_id = ad.id
 GROUP BY c.id;
