/**
 * KALA-MITRA Order Data Model
 * Statuses: 'received' | 'confirmed' | 'productionStarted' | 'inProgress' | 'readyForDispatch' | 'delivered'
 */

export const OrderStatus = {
  RECEIVED: 'received',
  CONFIRMED: 'confirmed',
  PRODUCTION_STARTED: 'productionStarted',
  IN_PROGRESS: 'inProgress',
  READY_FOR_DISPATCH: 'readyForDispatch',
  DELIVERED: 'delivered'
};

export const OrderStatusLabels = {
  [OrderStatus.RECEIVED]: { label: 'Order Received', color: 'blue' },
  [OrderStatus.CONFIRMED]: { label: 'Confirmed', color: 'teal' },
  [OrderStatus.PRODUCTION_STARTED]: { label: 'Production Started', color: 'amber' },
  [OrderStatus.IN_PROGRESS]: { label: 'Production in Progress', color: 'amber' },
  [OrderStatus.READY_FOR_DISPATCH]: { label: 'Ready for Dispatch', color: 'purple' },
  [OrderStatus.DELIVERED]: { label: 'Delivered', color: 'green' }
};

export class Order {
  constructor({
    id = null,
    productId = null,
    productName = '',
    buyerId = null,
    buyerName = '',
    quantity = 1,
    unitPrice = 0,
    totalAmount = 0,
    status = OrderStatus.IN_PROGRESS,
    expectedDelivery = '25 Sep',
    createdAt = new Date().toISOString()
  } = {}) {
    this.id = id || `ord_${Date.now()}`;
    this.productId = productId;
    this.productName = productName;
    this.buyerId = buyerId;
    this.buyerName = buyerName;
    this.quantity = quantity;
    this.unitPrice = unitPrice;
    this.totalAmount = totalAmount || quantity * unitPrice;
    this.status = status;
    this.expectedDelivery = expectedDelivery;
    this.createdAt = createdAt;
  }
}
