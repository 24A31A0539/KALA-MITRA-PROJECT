/**
 * KALA-MITRA Artisan Repository
 * Repository pattern isolating demo/mock data layer from UI widgets.
 * Designed for clean plug-in to future Python FastAPI + PostgreSQL backend endpoints:
 * - GET /api/v1/artisan/dashboard-summary
 * - GET /api/v1/artisan/orders
 * - GET /api/v1/artisan/opportunities
 * - GET /api/v1/artisan/market-insights
 * - PUT /api/v1/artisan/capacity
 */

import { ArtisanDashboardSummary } from '../models/artisan.js';
import { Order, OrderStatus } from '../models/order.js';
import { Opportunity, MarketOpportunityInsight } from '../models/opportunity.js';
import { Notification } from '../models/notification.js';
import { productRepository } from './productRepository.js';
import { capacityRepository } from './capacityRepository.js';

class ArtisanRepository {
  constructor() {
    this._capacity = 300;
    this._productionDays = 7;

    this._demoSummary = new ArtisanDashboardSummary({
      activeProducts: 4,
      activeOrders: 3,
      availableCapacity: this._capacity,
      newOpportunities: 5
    });


    this._demoOrders = [
      new Order({
        id: 'ORD-9021',
        productId: 'PRD-101',
        productName: 'Handmade Bamboo Basket',
        buyerName: 'GreenLeaf Hotels',
        quantity: 120,
        unitPrice: 450,
        totalAmount: 54000,
        status: OrderStatus.IN_PROGRESS,
        expectedDelivery: '25 Sep'
      }),
      new Order({
        id: 'ORD-9022',
        productId: 'PRD-104',
        productName: 'Terracotta Clay Planter Set',
        buyerName: 'Urban Oasis Decor',
        quantity: 45,
        unitPrice: 650,
        totalAmount: 29250,
        status: OrderStatus.PRODUCTION_STARTED,
        expectedDelivery: '28 Sep'
      }),
      new Order({
        id: 'ORD-9023',
        productId: 'PRD-107',
        productName: 'Kalamkari Handwoven Runner',
        buyerName: 'Heritage Fab Boutique',
        quantity: 30,
        unitPrice: 850,
        totalAmount: 25500,
        status: OrderStatus.READY_FOR_DISPATCH,
        expectedDelivery: '22 Sep'
      }),
      new Order({
        id: 'ORD-9018',
        productId: 'PRD-101',
        productName: 'Handcrafted Cane Trays',
        buyerName: 'Ananda Eco Resorts',
        quantity: 80,
        unitPrice: 380,
        totalAmount: 30400,
        status: OrderStatus.DELIVERED,
        expectedDelivery: '10 Sep'
      })
    ];

    this._demoOpportunities = [
      new Opportunity({
        id: 'OPP-501',
        title: 'Bulk Order: Handmade Bamboo Baskets',
        craftType: 'Bamboo Handicrafts',
        buyerName: 'GreenLeaf Hotels & Resorts',
        buyerType: 'Hospitality Chain',
        requiredQuantity: 500,
        artisanSuggestedCapacity: 120,
        targetPricePerUnit: 480,
        location: 'Hyderabad, Telangana',
        deadline: '15 Oct 2026',
        isClusterOpportunity: true,
        participatingArtisansCount: 3,
        status: 'open'
      }),
      new Opportunity({
        id: 'OPP-502',
        title: 'Diwali Corporate Gift: Earthen Diya Hampers',
        craftType: 'Terracotta Pottery',
        buyerName: 'TechCorp India',
        buyerType: 'Corporate Enterprise',
        requiredQuantity: 800,
        artisanSuggestedCapacity: 200,
        targetPricePerUnit: 350,
        location: 'Bengaluru, Karnataka',
        deadline: '28 Oct 2026',
        isClusterOpportunity: true,
        participatingArtisansCount: 4,
        status: 'open'
      }),
      new Opportunity({
        id: 'OPP-503',
        title: 'Boutique Collection: Handloom Cotton Stoles',
        craftType: 'Handloom Weaving',
        buyerName: 'Virasat Fashion House',
        buyerType: 'Retail Boutique',
        requiredQuantity: 150,
        artisanSuggestedCapacity: 50,
        targetPricePerUnit: 750,
        location: 'Mumbai, Maharashtra',
        deadline: '05 Nov 2026',
        isClusterOpportunity: false,
        participatingArtisansCount: 1,
        status: 'open'
      })
    ];

    this._demoMarketInsight = new MarketOpportunityInsight({
      craftName: 'Bamboo Baskets',
      highlightText: 'Bamboo baskets are currently receiving increased buyer interest.',
      demandLevel: 'High',
      typicalPriceRange: '₹400–₹550',
      relevantBuyerRequests: 12,
      topBuyerRegions: 'Telangana, Karnataka, Maharashtra'
    });

    this._demoNotifications = [
      new Notification({
        id: 'notif-1',
        title: 'New Bulk Opportunity Available',
        message: 'GreenLeaf Hotels requested 500 units of Bamboo Baskets. Tap to view cluster capacity.',
        type: 'opportunity',
        timestamp: '15m ago'
      }),
      new Notification({
        id: 'notif-2',
        title: 'Order Status Updated',
        message: 'Order #ORD-9021 moved to "Production in Progress". Delivery target: 25 Sep.',
        type: 'order',
        timestamp: '2h ago'
      }),
      new Notification({
        id: 'notif-3',
        title: 'Cluster Request Response Required',
        message: 'Master artisan in East Godavari cluster allocated 120 units to your workshop.',
        type: 'cluster',
        timestamp: 'Yesterday'
      }),
      new Notification({
        id: 'notif-4',
        title: 'High Demand Alert',
        message: 'Buyers in Hospitality sector searched for eco-friendly handicrafts in your region.',
        type: 'system',
        timestamp: '2 days ago'
      })
    ];
  }

  async getDashboardSummary() {
    await new Promise(r => setTimeout(r, 60));
    const counts = productRepository.getCounts();
    const cap = await capacityRepository.getCapacity();
    this._demoSummary.activeProducts = counts.active;
    this._demoSummary.availableCapacity = cap.availableStock;
    this._demoSummary.productionCapacity = cap.productionCapacity;
    this._demoSummary.productionPeriod = cap.productionPeriod;
    this._demoSummary.productionTimeDays = cap.productionTimeDays;
    return this._demoSummary;
  }

  async getRecentOrders() {
    await new Promise(r => setTimeout(r, 100));
    return this._demoOrders.slice(0, 3);
  }

  async getAllOrders() {
    await new Promise(r => setTimeout(r, 120));
    return this._demoOrders;
  }

  async getMarketInsight() {
    await new Promise(r => setTimeout(r, 80));
    return this._demoMarketInsight;
  }

  async getNewOpportunities() {
    await new Promise(r => setTimeout(r, 100));
    return this._demoOpportunities;
  }

  async getArtisanProducts() {
    return await productRepository.getProducts();
  }

  async getNotifications() {
    await new Promise(r => setTimeout(r, 80));
    return this._demoNotifications;
  }

  async updateCapacity(capacityData) {
    if (typeof capacityData === 'number' || typeof capacityData === 'string') {
      return await capacityRepository.updateCapacity({ availableStock: Number(capacityData) });
    }
    return await capacityRepository.updateCapacity(capacityData);
  }
}

export const artisanRepository = new ArtisanRepository();

