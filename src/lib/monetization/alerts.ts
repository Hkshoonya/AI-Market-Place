export function buildRevenueAlerts(snapshot: {
  activeAffiliateLinks: number;
  overdueLeads: number;
  expiringGrants: number;
}) {
  return [
    { slug: "revenue-affiliate-setup", active: snapshot.activeAffiliateLinks === 0,
      title: "No earning referral links are active", action: "Add an approved provider referral URL in /admin/monetization" },
    { slug: "revenue-overdue-leads", active: snapshot.overdueLeads > 0,
      title: `${snapshot.overdueLeads} commercial enquiries awaiting a reply for over 48 hours`, action: "Review the sales inbox in /admin/monetization and record the response status" },
    { slug: "revenue-expiring-grants", active: snapshot.expiringGrants > 0,
      title: `${snapshot.expiringGrants} paid-tier pilot grants expire within 7 days`, action: "Contact the customer before renewing; do not extend access without an agreed plan" },
  ];
}
