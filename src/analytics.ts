import { db, today, transaction } from "./db";

export type SearchChannel = "http" | "mcp";
export type ArticleSource = "search" | "home" | "feed" | "direct";

function dateDaysAgo(daysAgo: number) {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
}

export function recordSearch(channel: SearchChannel, contentIds: string[]) {
  const metricDate = today();
  const column = channel === "mcp" ? "mcp_search_count" : "http_search_count";
  const uniqueIds = [...new Set(contentIds.filter(Boolean))];
  transaction(() => {
    db.query(`INSERT INTO daily_metrics(metric_date,${column}) VALUES(?1,1)
      ON CONFLICT(metric_date) DO UPDATE SET ${column}=${column}+1`).run(metricDate);
    const statement = db.query(`INSERT INTO content_daily_metrics(metric_date,content_id,search_impression_count)
      VALUES(?1,?2,1) ON CONFLICT(metric_date,content_id)
      DO UPDATE SET search_impression_count=search_impression_count+1`);
    for (const contentId of uniqueIds) statement.run(metricDate, contentId);
  });
}

export function recordPageView() {
  db.query(`INSERT INTO daily_metrics(metric_date,page_view_count) VALUES(?1,1)
    ON CONFLICT(metric_date) DO UPDATE SET page_view_count=page_view_count+1`).run(today());
}

export function recordArticleView(contentId: string, source: ArticleSource) {
  const searchClick = source === "search" ? 1 : 0;
  const homeClick = source === "home" ? 1 : 0;
  db.query(`INSERT INTO content_daily_metrics(
      metric_date,content_id,article_view_count,search_click_count,home_click_count
    ) VALUES(?1,?2,1,?3,?4)
    ON CONFLICT(metric_date,content_id) DO UPDATE SET
      article_view_count=article_view_count+1,
      search_click_count=search_click_count+excluded.search_click_count,
      home_click_count=home_click_count+excluded.home_click_count`
  ).run(today(), contentId, searchClick, homeClick);
}

export function totalPageViews() {
  const row = db.query("SELECT COALESCE(SUM(page_view_count),0) AS count FROM daily_metrics").get() as { count?: number } | null;
  return Number(row?.count || 0);
}

export function dailyStats(rawDays: unknown) {
  const parsedDays = Number(rawDays || 30);
  const days = Number.isFinite(parsedDays) ? Math.min(365, Math.max(2, Math.floor(parsedDays))) : 30;
  const endDate = today();
  const startDate = dateDaysAgo(days - 1);
  const dates = Array.from({ length: days }, (_, index) => dateDaysAgo(days - 1 - index));

  const usageRows = db.query(`SELECT usage_date AS metric_date,
      SUM(post_count) AS submissions, COUNT(*) AS publishing_accounts
    FROM daily_usage WHERE usage_date BETWEEN ?1 AND ?2 GROUP BY usage_date`
  ).all(startDate, endDate) as any[];
  const firstPublisherRows = db.query(`SELECT du.usage_date AS metric_date, COUNT(*) AS first_time_publishers
    FROM daily_usage du
    WHERE du.usage_date BETWEEN ?1 AND ?2
      AND du.usage_date=(SELECT MIN(first.usage_date) FROM daily_usage first WHERE first.account_id=du.account_id)
    GROUP BY du.usage_date`
  ).all(startDate, endDate) as any[];
  const metricRows = db.query(`SELECT metric_date,http_search_count,mcp_search_count,page_view_count
    FROM daily_metrics WHERE metric_date BETWEEN ?1 AND ?2`
  ).all(startDate, endDate) as any[];

  const usageByDate = new Map(usageRows.map(row => [row.metric_date, row]));
  const firstByDate = new Map(firstPublisherRows.map(row => [row.metric_date, row]));
  const metricsByDate = new Map(metricRows.map(row => [row.metric_date, row]));
  const daily = dates.map(metricDate => {
    const usage = usageByDate.get(metricDate) || {};
    const first = firstByDate.get(metricDate) || {};
    const metrics = metricsByDate.get(metricDate) || {};
    return {
      date: metricDate,
      submissions: Number(usage.submissions || 0),
      publishing_accounts: Number(usage.publishing_accounts || 0),
      first_time_publishers: Number(first.first_time_publishers || 0),
      http_searches: Number(metrics.http_search_count || 0),
      mcp_searches: Number(metrics.mcp_search_count || 0),
      page_views: Number(metrics.page_view_count || 0)
    };
  });

  const retentionCutoff = dateDaysAgo(7);
  const retention = db.query(`WITH first_publish AS (
      SELECT account_id, MIN(usage_date) AS first_date FROM daily_usage GROUP BY account_id
    ) SELECT
      COUNT(*) AS eligible,
      COALESCE(SUM(CASE WHEN EXISTS (
        SELECT 1 FROM daily_usage next
        WHERE next.account_id=first_publish.account_id
          AND next.usage_date>first_publish.first_date
          AND next.usage_date<=date(first_publish.first_date,'+7 day')
      ) THEN 1 ELSE 0 END),0) AS returned
    FROM first_publish WHERE first_date<=?1`
  ).get(retentionCutoff) as any;
  const weeklyRows = db.query(`SELECT account_id,SUM(post_count) AS submissions
    FROM daily_usage WHERE usage_date BETWEEN ?1 AND ?2 GROUP BY account_id`
  ).all(dateDaysAgo(6), endDate) as any[];
  const weeklySubmissions = weeklyRows.reduce((sum, row) => sum + Number(row.submissions || 0), 0);
  const largestAuthorSubmissions = weeklyRows.reduce((largest, row) => Math.max(largest, Number(row.submissions || 0)), 0);
  const eligible = Number(retention?.eligible || 0);
  const returned = Number(retention?.returned || 0);

  const content = (db.query(`SELECT c.id AS content_id,c.title,
      SUM(m.search_impression_count) AS search_impressions,
      SUM(m.search_click_count) AS search_clicks,
      SUM(m.home_click_count) AS home_clicks,
      SUM(m.article_view_count) AS article_views
    FROM content_daily_metrics m JOIN contents c ON c.id=m.content_id
    WHERE m.metric_date BETWEEN ?1 AND ?2
    GROUP BY c.id,c.title
    ORDER BY search_impressions DESC,article_views DESC LIMIT 50`
  ).all(startDate, endDate) as any[]).map(row => {
    const impressions = Number(row.search_impressions || 0);
    const clicks = Number(row.search_clicks || 0);
    return {
      content_id: row.content_id,
      title: row.title,
      search_impressions: impressions,
      search_clicks: clicks,
      search_ctr: impressions ? Number((clicks / impressions).toFixed(4)) : null,
      home_clicks: Number(row.home_clicks || 0),
      article_views: Number(row.article_views || 0)
    };
  });

  return {
    timezone: "UTC",
    range: { start: startDate, end: endDate, days },
    daily,
    summary: {
      first_time_publishers: daily.reduce((sum, row) => sum + row.first_time_publishers, 0),
      seven_day_republish: { eligible, returned, rate: eligible ? Number((returned / eligible).toFixed(4)) : null },
      weekly_active_publishers: weeklyRows.length,
      weekly_submissions: weeklySubmissions,
      largest_author_share: weeklySubmissions ? Number((largestAuthorSubmissions / weeklySubmissions).toFixed(4)) : null
    },
    content
  };
}
