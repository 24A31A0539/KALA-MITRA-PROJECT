/**
 * KALA-MITRA Artisan Capacity Model
 * Structured data representation for workshop and product level capacity,
 * designed for future Nearby Artisan Discovery and Google OR-Tools Collective Capacity Cluster Optimization.
 */

export const AvailabilityStatus = {
  AVAILABLE: 'available',
  LIMITED: 'limited',
  UNAVAILABLE: 'unavailable'
};

export const AvailabilityStatusLabels = {
  [AvailabilityStatus.AVAILABLE]: {
    label: 'Available',
    color: 'green',
    description: 'Can accept new bulk opportunities'
  },
  [AvailabilityStatus.LIMITED]: {
    label: 'Limited Availability',
    color: 'amber',
    description: 'Can accept some additional production'
  },
  [AvailabilityStatus.UNAVAILABLE]: {
    label: 'Unavailable',
    color: 'gray',
    description: 'Currently at full capacity'
  }
};

export const ProductionPeriod = {
  MONTHLY: 'monthly',
  WEEKLY: 'weekly'
};

export const ProductionPeriodLabels = {
  [ProductionPeriod.MONTHLY]: 'Per Month',
  [ProductionPeriod.WEEKLY]: 'Per Week'
};

export class ArtisanCapacity {
  constructor({
    id = null,
    artisanId = 'art_default',
    availableStock = 120,
    productionCapacity = 300,
    productionPeriod = ProductionPeriod.MONTHLY,
    productionTimeDays = 7,
    locationName = 'East Godavari, Andhra Pradesh',
    latitude = 16.9891,
    longitude = 81.7840,
    availabilityStatus = AvailabilityStatus.AVAILABLE,
    updatedAt = new Date().toISOString()
  } = {}) {
    this.id = id || `cap_${Date.now().toString().slice(-6)}`;
    this.artisanId = artisanId;
    this.availableStock = Math.max(0, parseInt(availableStock, 10) || 0);
    this.productionCapacity = Math.max(1, parseInt(productionCapacity, 10) || 1);
    this.productionPeriod = Object.values(ProductionPeriod).includes(productionPeriod)
      ? productionPeriod
      : ProductionPeriod.MONTHLY;
    this.productionTimeDays = Math.max(1, parseInt(productionTimeDays, 10) || 1);
    this.locationName = (locationName || 'India').trim();
    this.latitude = latitude !== null && !isNaN(Number(latitude)) ? Number(latitude) : null;
    this.longitude = longitude !== null && !isNaN(Number(longitude)) ? Number(longitude) : null;
    this.availabilityStatus = Object.values(AvailabilityStatus).includes(availabilityStatus)
      ? availabilityStatus
      : AvailabilityStatus.AVAILABLE;
    this.updatedAt = updatedAt;
  }

  get periodLabel() {
    return this.productionPeriod === ProductionPeriod.WEEKLY ? 'week' : 'month';
  }

  get formattedCapacity() {
    return `${this.productionCapacity} units / ${this.periodLabel}`;
  }

  get statusLabel() {
    return AvailabilityStatusLabels[this.availabilityStatus] || { label: 'Available', color: 'green' };
  }

  clone() {
    return new ArtisanCapacity(JSON.parse(JSON.stringify(this)));
  }

  toJSON() {
    return {
      id: this.id,
      artisanId: this.artisanId,
      availableStock: this.availableStock,
      productionCapacity: this.productionCapacity,
      productionPeriod: this.productionPeriod,
      productionTimeDays: this.productionTimeDays,
      locationName: this.locationName,
      latitude: this.latitude,
      longitude: this.longitude,
      availabilityStatus: this.availabilityStatus,
      updatedAt: this.updatedAt
    };
  }

  static fromJSON(json) {
    return new ArtisanCapacity(json);
  }
}
