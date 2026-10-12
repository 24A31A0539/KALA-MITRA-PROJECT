/**
 * KALA-MITRA Capacity Repository
 * Dedicated repository for Artisan Capacity Management.
 * Manages Available Ready Stock, Production Capacity, Production Period, Lead Time,
 * Location coordinates architecture, and Availability Status.
 * 
 * Future FastAPI integration:
 * - GET /api/v1/artisans/{artisanId}/capacity
 * - PUT /api/v1/artisans/{artisanId}/capacity
 * - GET /api/v1/products/{productId}/capacity
 * - PUT /api/v1/products/{productId}/capacity
 */

import { ArtisanCapacity, AvailabilityStatus, ProductionPeriod } from '../models/capacity.js';
import { productRepository } from './productRepository.js';

const STORAGE_KEY = 'kala_mitra_artisan_capacity';

class CapacityRepository {
  constructor() {
    this._defaultCapacity = new ArtisanCapacity({
      id: 'cap_artisan_primary',
      artisanId: 'art_ramesh_01',
      availableStock: 120,
      productionCapacity: 300,
      productionPeriod: ProductionPeriod.MONTHLY,
      productionTimeDays: 7,
      locationName: 'Rajahmundry, Andhra Pradesh',
      latitude: 16.9891,
      longitude: 81.7840,
      availabilityStatus: AvailabilityStatus.AVAILABLE,
      updatedAt: new Date().toISOString()
    });

    this._currentCapacity = this._loadFromStorage() || this._defaultCapacity;
  }

  _loadFromStorage() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        return ArtisanCapacity.fromJSON(parsed);
      }
    } catch (e) {
      console.warn('Failed to load artisan capacity from localStorage:', e);
    }
    return null;
  }

  _saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._currentCapacity.toJSON()));
    } catch (e) {
      console.warn('Failed to save artisan capacity to localStorage:', e);
    }
  }

  /**
   * Get current artisan capacity overview
   */
  async getCapacity(artisanId = 'art_ramesh_01') {
    await new Promise(r => setTimeout(r, 60)); // Simulating repository async call
    return this._currentCapacity.clone();
  }

  /**
   * Update artisan capacity overview
   */
  async updateCapacity(capacityData) {
    await new Promise(r => setTimeout(r, 120));

    const updated = new ArtisanCapacity({
      id: this._currentCapacity.id,
      artisanId: this._currentCapacity.artisanId,
      availableStock: capacityData.availableStock !== undefined ? capacityData.availableStock : this._currentCapacity.availableStock,
      productionCapacity: capacityData.productionCapacity !== undefined ? capacityData.productionCapacity : this._currentCapacity.productionCapacity,
      productionPeriod: capacityData.productionPeriod || this._currentCapacity.productionPeriod,
      productionTimeDays: capacityData.productionTimeDays !== undefined ? capacityData.productionTimeDays : this._currentCapacity.productionTimeDays,
      locationName: capacityData.locationName !== undefined ? capacityData.locationName : this._currentCapacity.locationName,
      latitude: capacityData.latitude !== undefined ? capacityData.latitude : this._currentCapacity.latitude,
      longitude: capacityData.longitude !== undefined ? capacityData.longitude : this._currentCapacity.longitude,
      availabilityStatus: capacityData.availabilityStatus || this._currentCapacity.availabilityStatus,
      updatedAt: new Date().toISOString()
    });

    this._currentCapacity = updated;
    this._saveToStorage();

    return {
      success: true,
      capacity: this._currentCapacity.clone(),
      message: 'Capacity updated successfully.'
    };
  }

  /**
   * Get capacity for a specific product
   */
  async getProductCapacity(productId) {
    const product = await productRepository.getProductById(productId);
    if (!product) return null;

    return {
      productId: product.id,
      productName: product.name,
      availableStock: product.availableQuantity || 0,
      productionCapacity: product.productionCapacity || 0,
      productionPeriod: product.productionPeriod || ProductionPeriod.MONTHLY,
      productionTimeDays: product.productionTimeDays || 7,
      availabilityStatus: product.availabilityStatus || AvailabilityStatus.AVAILABLE
    };
  }

  /**
   * Update capacity for a specific product and synchronize
   */
  async updateProductCapacity(productId, capacityData) {
    const product = await productRepository.getProductById(productId);
    if (!product) {
      return { success: false, message: 'Product not found' };
    }

    const updatedFields = {};
    if (capacityData.availableStock !== undefined) {
      updatedFields.availableQuantity = Number(capacityData.availableStock);
    }
    if (capacityData.productionCapacity !== undefined) {
      updatedFields.productionCapacity = Number(capacityData.productionCapacity);
    }
    if (capacityData.productionPeriod !== undefined) {
      updatedFields.productionPeriod = capacityData.productionPeriod;
    }
    if (capacityData.productionTimeDays !== undefined) {
      updatedFields.productionTimeDays = Number(capacityData.productionTimeDays);
    }
    if (capacityData.availabilityStatus !== undefined) {
      updatedFields.availabilityStatus = capacityData.availabilityStatus;
    }

    const updatedProduct = await productRepository.updateProduct(productId, updatedFields);
    return {
      success: true,
      product: updatedProduct,
      message: 'Product capacity updated successfully.'
    };
  }
}

export const capacityRepository = new CapacityRepository();
