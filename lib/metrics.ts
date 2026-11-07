import { prisma } from "./db";

export interface DashboardMetrics {
  totalCarts: number;
  abandonedCarts: number;
  eligibleContacts: number;
  suppressedContacts: number;
  recoverySends: number;
  recoveredOrders: number;
  attributedRevenue: number;
  recoveryConversionRate: number;
  funnel: {
    totalCarts: number;
    abandonedCarts: number;
    eligibleContacts: number;
    sentMessages: number;
    clickedMessages: number;
    recoveredOrders: number;
  };
  campaignPerformance: Array<{
    id: string;
    name: string;
    channel: string;
    sends: number;
    delivered: number;
    clicked: number;
    recoveredOrders: number;
    revenue: number;
    conversionRate: number;
  }>;
  channelPerformance: Array<{
    channel: string;
    sends: number;
    delivered: number;
    clicked: number;
    recoveredOrders: number;
    revenue: number;
    conversionRate: number;
  }>;
  recentExceptions: Array<{
    id: string;
    issueType: string;
    severity: string;
    relatedEntityType: string;
    relatedEntityId: string;
    expectedDecision: string;
    observedState: string;
    createdAt: Date;
  }>;
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const [
    totalCarts,
    abandonedCarts,
    messageInstances,
    sendAttempts,
    orders,
    attributions,
    campaigns,
    templates,
    issues,
  ] = await Promise.all([
    prisma.cart.count(),
    prisma.cart.count({
      where: {
        status: { in: ["ABANDONED", "RECOVERED"] },
      },
    }),
    prisma.messageInstance.findMany({
      select: {
        id: true,
        cartId: true,
        templateId: true,
        eligibilityStatus: true,
      },
    }),
    prisma.sendAttempt.findMany({
      select: {
        id: true,
        messageInstanceId: true,
        status: true,
        sentAt: true,
      },
    }),
    prisma.order.findMany({
      where: { status: "COMPLETED" },
      select: {
        id: true,
        cartId: true,
        total: true,
      },
    }),
    prisma.attribution.findMany({
      select: {
        id: true,
        orderId: true,
        sendAttemptId: true,
        attributedRevenue: true,
        isAnomaly: true,
      },
    }),
    prisma.campaign.findMany(),
    prisma.messageTemplate.findMany(),
    prisma.groundTruthIssue.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Eligibility aggregation
  let eligibleContacts = 0;
  let suppressedContacts = 0;
  for (const m of messageInstances) {
    if (m.eligibilityStatus === "ELIGIBLE") {
      eligibleContacts++;
    } else {
      suppressedContacts++;
    }
  }

  // Sends & clicks
  const recoverySends = sendAttempts.length;
  let clickedMessages = 0;
  for (const s of sendAttempts) {
    if (s.status === "CLICKED") clickedMessages++;
  }

  // Attributed revenue & unique recovered orders
  const recoveredOrdersSet = new Set<string>();
  let attributedRevenue = 0;

  for (const attr of attributions) {
    // Normal attributions only for standard metrics
    if (!attr.isAnomaly) {
      recoveredOrdersSet.add(attr.orderId);
      attributedRevenue += attr.attributedRevenue;
    }
  }

  const recoveredOrders = recoveredOrdersSet.size;
  const recoveryConversionRate =
    recoverySends > 0
      ? Math.round((recoveredOrders / recoverySends) * 1000) / 10
      : 0;

  attributedRevenue = Math.round(attributedRevenue * 100) / 100;

  // Funnel
  const funnel = {
    totalCarts,
    abandonedCarts,
    eligibleContacts,
    sentMessages: recoverySends,
    clickedMessages,
    recoveredOrders,
  };

  // Maps for Campaign and Channel performance
  const templateToCampaignMap = new Map(templates.map((t) => [t.id, t.campaignId]));
  const instanceToTemplateMap = new Map(messageInstances.map((m) => [m.id, m.templateId]));
  const sendToCampaignMap = new Map<string, string>();
  for (const s of sendAttempts) {
    const tmplId = instanceToTemplateMap.get(s.messageInstanceId);
    if (tmplId) {
      const campId = templateToCampaignMap.get(tmplId);
      if (campId) sendToCampaignMap.set(s.id, campId);
    }
  }

  const campaignStats = new Map<
    string,
    { sends: number; delivered: number; clicked: number; orders: Set<string>; revenue: number }
  >();

  for (const cmp of campaigns) {
    campaignStats.set(cmp.id, {
      sends: 0,
      delivered: 0,
      clicked: 0,
      orders: new Set(),
      revenue: 0,
    });
  }

  for (const send of sendAttempts) {
    const campId = sendToCampaignMap.get(send.id);
    if (!campId || !campaignStats.has(campId)) continue;
    const stat = campaignStats.get(campId)!;
    stat.sends++;
    if (["DELIVERED", "OPENED", "CLICKED"].includes(send.status)) stat.delivered++;
    if (send.status === "CLICKED") stat.clicked++;
  }

  for (const attr of attributions) {
    if (attr.isAnomaly) continue;
    const campId = sendToCampaignMap.get(attr.sendAttemptId);
    if (campId && campaignStats.has(campId)) {
      const stat = campaignStats.get(campId)!;
      stat.orders.add(attr.orderId);
      stat.revenue += attr.attributedRevenue;
    }
  }

  const campaignPerformance = campaigns.map((cmp) => {
    const stat = campaignStats.get(cmp.id)!;
    const ordersCount = stat.orders.size;
    const convRate = stat.sends > 0 ? Math.round((ordersCount / stat.sends) * 1000) / 10 : 0;
    return {
      id: cmp.id,
      name: cmp.name,
      channel: cmp.channel,
      sends: stat.sends,
      delivered: stat.delivered,
      clicked: stat.clicked,
      recoveredOrders: ordersCount,
      revenue: Math.round(stat.revenue * 100) / 100,
      conversionRate: convRate,
    };
  });

  // Channel Breakdown
  const channelMap: Record<
    string,
    { sends: number; delivered: number; clicked: number; orders: Set<string>; revenue: number }
  > = {
    EMAIL: { sends: 0, delivered: 0, clicked: 0, orders: new Set(), revenue: 0 },
    SMS: { sends: 0, delivered: 0, clicked: 0, orders: new Set(), revenue: 0 },
  };

  for (const cmp of campaignPerformance) {
    const ch = channelMap[cmp.channel] || channelMap["EMAIL"];
    ch.sends += cmp.sends;
    ch.delivered += cmp.delivered;
    ch.clicked += cmp.clicked;
    ch.revenue += cmp.revenue;
  }

  for (const attr of attributions) {
    if (attr.isAnomaly) continue;
    const campId = sendToCampaignMap.get(attr.sendAttemptId);
    const cmp = campaigns.find((c) => c.id === campId);
    if (cmp && channelMap[cmp.channel]) {
      channelMap[cmp.channel].orders.add(attr.orderId);
    }
  }

  const channelPerformance = Object.entries(channelMap).map(([channel, stat]) => {
    const ordersCount = stat.orders.size;
    const convRate = stat.sends > 0 ? Math.round((ordersCount / stat.sends) * 1000) / 10 : 0;
    return {
      channel,
      sends: stat.sends,
      delivered: stat.delivered,
      clicked: stat.clicked,
      recoveredOrders: ordersCount,
      revenue: Math.round(stat.revenue * 100) / 100,
      conversionRate: convRate,
    };
  });

  return {
    totalCarts,
    abandonedCarts,
    eligibleContacts,
    suppressedContacts,
    recoverySends,
    recoveredOrders,
    attributedRevenue,
    recoveryConversionRate,
    funnel,
    campaignPerformance,
    channelPerformance,
    recentExceptions: issues.map((i) => ({
      id: i.id,
      issueType: i.issueType,
      severity: i.severity,
      relatedEntityType: i.relatedEntityId,
      relatedEntityId: i.relatedEntityId,
      expectedDecision: i.expectedDecision,
      observedState: i.observedState,
      createdAt: i.createdAt,
    })),
  };
}
