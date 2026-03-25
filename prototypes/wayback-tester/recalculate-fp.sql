-- Recalculate FP rate with tuned strategy selection
-- Rule: report if readability changed with diffSize > 2, OR text_only changed with noise < 0.3 AND diffSize >= 2

.mode column
.headers on

-- Strategy comparison table
SELECT '=== STRATEGY COMPARISON ===' as '';
SELECT 
  strategy,
  COUNT(*) as total_pairs,
  SUM(has_change) as changes_detected,
  SUM(CASE WHEN has_change=1 AND noise_estimate >= 0.9 THEN 1 ELSE 0 END) as "FPs (noise>=90%)",
  SUM(CASE WHEN has_change=1 AND noise_estimate < 0.2 THEN 1 ELSE 0 END) as "Real (noise<20%)",
  ROUND(AVG(CASE WHEN has_change=1 THEN noise_estimate ELSE NULL END) * 100, 1) || '%' as "Avg noise (changed)",
  ROUND(100.0 * SUM(CASE WHEN has_change=1 AND noise_estimate >= 0.9 THEN 1 ELSE 0 END) / NULLIF(SUM(has_change), 0), 1) || '%' as "FP rate"
FROM diff_pairs
GROUP BY strategy
ORDER BY strategy;

-- Old approach: report if ANY strategy detects a change
SELECT '' as '';
SELECT '=== OLD APPROACH: Any strategy triggers ===' as '';
SELECT 
  COUNT(DISTINCT url || ts_old || ts_new) as total_unique_pairs,
  (SELECT COUNT(DISTINCT url || ts_old || ts_new) FROM diff_pairs WHERE has_change=1) as changes_reported,
  (SELECT COUNT(DISTINCT dp.url || dp.ts_old || dp.ts_new) 
   FROM diff_pairs dp 
   WHERE dp.has_change=1 
   AND dp.noise_estimate >= 0.9
   AND NOT EXISTS (
     SELECT 1 FROM diff_pairs dp2 
     WHERE dp2.url=dp.url AND dp2.ts_old=dp.ts_old AND dp2.ts_new=dp.ts_new 
     AND dp2.has_change=1 AND dp2.noise_estimate < 0.9
   )
  ) as pure_fps
FROM diff_pairs;

-- New approach: tuned strategy selection
SELECT '' as '';
SELECT '=== NEW APPROACH: Tuned strategy selection ===' as '';
WITH pairs AS (
  SELECT 
    r.url, r.ts_old, r.ts_new,
    r.has_change as r_chg, r.noise_estimate as r_noise, r.diff_size as r_diff,
    t.has_change as t_chg, t.noise_estimate as t_noise, t.diff_size as t_diff,
    h.has_change as h_chg, h.noise_estimate as h_noise
  FROM diff_pairs r
  JOIN diff_pairs t ON r.url=t.url AND r.ts_old=t.ts_old AND r.ts_new=t.ts_new AND t.strategy='text_only'
  JOIN diff_pairs h ON r.url=h.url AND r.ts_old=h.ts_old AND r.ts_new=h.ts_new AND h.strategy='raw_html'
  WHERE r.strategy='readability'
)
SELECT
  COUNT(*) as total_pairs,
  SUM(CASE WHEN (r_chg=1 AND r_diff > 2) OR (t_chg=1 AND t_noise < 0.3 AND t_diff >= 2) THEN 1 ELSE 0 END) as changes_reported,
  SUM(CASE WHEN 
    ((r_chg=1 AND r_diff > 2) OR (t_chg=1 AND t_noise < 0.3 AND t_diff >= 2))
    AND (r_chg=1 AND r_noise >= 0.9 AND (t_chg=0 OR t_noise >= 0.9))
  THEN 1 ELSE 0 END) as false_positives,
  ROUND(100.0 * SUM(CASE WHEN 
    ((r_chg=1 AND r_diff > 2) OR (t_chg=1 AND t_noise < 0.3 AND t_diff >= 2))
    AND (r_chg=1 AND r_noise >= 0.9 AND (t_chg=0 OR t_noise >= 0.9))
  THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN (r_chg=1 AND r_diff > 2) OR (t_chg=1 AND t_noise < 0.3 AND t_diff >= 2) THEN 1 ELSE 0 END), 0), 1) || '%' as "FP rate",
  SUM(CASE WHEN 
    NOT ((r_chg=1 AND r_diff > 2) OR (t_chg=1 AND t_noise < 0.3 AND t_diff >= 2))
    AND (r_chg=1 AND r_noise < 0.5)
  THEN 1 ELSE 0 END) as missed_small_real,
  SUM(CASE WHEN h_chg=1 AND r_chg=0 AND t_chg=0 THEN 1 ELSE 0 END) as suppressed_raw_only
FROM pairs;
