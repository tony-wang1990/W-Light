export enum OrderPriority {
  P0 = 'P0', // Critical: 2h SLA
  P1 = 'P1', // High: 8h SLA
  P2 = 'P2', // Medium: 24h SLA
  P3 = 'P3', // Low: 168h (7 days) SLA
}

export const SLA_HOURS: Record<OrderPriority, number> = {
  [OrderPriority.P0]: 2,
  [OrderPriority.P1]: 8,
  [OrderPriority.P2]: 24,
  [OrderPriority.P3]: 168,
};
