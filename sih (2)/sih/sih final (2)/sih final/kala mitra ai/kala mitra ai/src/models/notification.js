/**
 * KALA-MITRA Notification Model
 * Types: 'order' | 'opportunity' | 'cluster' | 'system'
 */

export class Notification {
  constructor({
    id = null,
    title = '',
    message = '',
    type = 'system',
    timestamp = '10m ago',
    isRead = false,
    actionUrl = null
  } = {}) {
    this.id = id || `notif_${Date.now()}`;
    this.title = title;
    this.message = message;
    this.type = type;
    this.timestamp = timestamp;
    this.isRead = isRead;
    this.actionUrl = actionUrl;
  }
}
