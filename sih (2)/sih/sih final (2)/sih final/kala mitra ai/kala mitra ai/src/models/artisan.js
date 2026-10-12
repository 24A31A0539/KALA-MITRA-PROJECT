/**
 * KALA-MITRA Artisan & Dashboard Models
 */

export class Artisan {
  constructor({
    id = null,
    userId = null,
    name = '',
    phone = '',
    email = '',
    craftType = 'Traditional Handicrafts',
    location = 'India',
    preferredLanguage = 'English',
    availableCapacity = 320,
    productionTimeDays = 14,
    profileImage = null,
    isVerified = true,
    createdAt = new Date().toISOString()
  } = {}) {
    this.id = id || `art_${Date.now()}`;
    this.userId = userId;
    this.name = name;
    this.phone = phone;
    this.email = email;
    this.craftType = craftType;
    this.location = location;
    this.preferredLanguage = preferredLanguage;
    this.availableCapacity = Number(availableCapacity);
    this.productionTimeDays = Number(productionTimeDays);
    this.profileImage = profileImage;
    this.isVerified = Boolean(isVerified);
    this.createdAt = createdAt;
  }
}

export class ArtisanDashboardSummary {
  constructor({
    activeProducts = 8,
    activeOrders = 3,
    availableCapacity = 320,
    newOpportunities = 5
  } = {}) {
    this.activeProducts = activeProducts;
    this.activeOrders = activeOrders;
    this.availableCapacity = availableCapacity;
    this.newOpportunities = newOpportunities;
  }
}
