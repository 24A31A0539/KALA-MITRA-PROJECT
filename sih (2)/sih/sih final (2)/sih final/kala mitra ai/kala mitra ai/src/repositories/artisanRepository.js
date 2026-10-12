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
    const allOrd = await this.getAllOrders();
    this._demoSummary.activeOrders = allOrd.filter(o => (o.status || '').toLowerCase() !== 'delivered').length;
    this._demoSummary.activeProducts = counts.active;
    this._demoSummary.availableCapacity = cap.availableStock;
    this._demoSummary.productionCapacity = cap.productionCapacity;
    this._demoSummary.productionPeriod = cap.productionPeriod;
    this._demoSummary.productionTimeDays = cap.productionTimeDays;
    return this._demoSummary;
  }

  async getRecentOrders() {
    await new Promise(r => setTimeout(r, 100));
    const all = await this.getAllOrders(); const act = all.filter(o => (o.status || "").toLowerCase() !== "delivered"); return act.length > 0 ? act.slice(0, 4) : all.slice(0, 4);
  }

  async getAllOrders() {
    await new Promise(r => setTimeout(r, 40));
    let stored = [];
    try {
      const raw = localStorage.getItem('kala_mitra_active_orders');
      if (raw) stored = JSON.parse(raw);
    } catch(e) {}

    // Auto-migrate KM-ORD-10245 and KM-ORD-10231 to Delivered if they were in active
    let changed = false;
    if (Array.isArray(stored)) {
      stored.forEach(o => {
        const idUpper = String(o.id || '').toUpperCase();
        if ((idUpper === 'KM-ORD-10245' || idUpper === 'KM-ORD-10231') && (o.status || '').toLowerCase() !== 'delivered') {
          o.status = 'Delivered';
          o.delivered_date = o.delivered_date || '15 Sep 2026';
          o.progress = 100;
          changed = true;
        }
      });
    }

    if (!Array.isArray(stored) || stored.length === 0) {
      stored = [
        {
          id: 'KM-ORD-10245',
          product: 'Handwoven Bamboo Utility Basket',
          productName: 'Handwoven Bamboo Utility Basket',
          buyer: 'GreenLeaf Hotels',
          buyerName: 'GreenLeaf Hotels',
          quantity: 500,
          total_amount: 70500,
          totalAmount: 70500,
          status: 'Delivered',
          order_date: '04 Sep 2026',
          order_placed_time: '04 Sep, 10:30 AM',
          delivered_date: '15 Sep 2026',
          artisan: 'Lakshmi Bamboo Crafts',
          progress: 100
        },
        {
          id: 'KM-ORD-10231',
          product: 'Organic Kalamkari Tote Bags',
          productName: 'Organic Kalamkari Tote Bags',
          buyer: 'Vastra Boutique',
          buyerName: 'Vastra Boutique',
          quantity: 200,
          total_amount: 28000,
          totalAmount: 28000,
          status: 'Delivered',
          order_date: '01 Sep 2026',
          order_placed_time: '01 Sep, 03:15 PM',
          delivered_date: '12 Sep 2026',
          artisan: 'Vastra Handlooms',
          progress: 100
        },
        {
          id: 'ORD-9018',
          product: 'Handcrafted Cane Trays',
          productName: 'Handcrafted Cane Trays',
          buyer: 'Ananda Eco Resorts',
          buyerName: 'Ananda Eco Resorts',
          quantity: 80,
          total_amount: 30400,
          totalAmount: 30400,
          status: 'Delivered',
          order_date: '10 Sep 2026',
          order_placed_time: '10 Sep, 10:00 AM',
          delivered_date: '16 Sep 2026',
          artisan: 'East Godavari Cane Guild',
          progress: 100
        },
        {
          id: 'KM-ORD-10190',
          product: 'Terracotta Handcrafted Floral Vase',
          productName: 'Terracotta Handcrafted Floral Vase',
          buyer: 'Urban Oasis Decor',
          buyerName: 'Urban Oasis Decor',
          quantity: 2,
          total_amount: 1800,
          totalAmount: 1800,
          status: 'Delivered',
          order_date: '12 Aug 2026',
          order_placed_time: '12 Aug 2026, 02:15 PM',
          delivered_date: '20 Aug 2026',
          artisan: 'Ramesh Terracotta Guild',
          progress: 100
        },
        {
          id: 'KM-ORD-10144',
          product: 'Pochampally Ikat Handwoven Silk Stole',
          productName: 'Pochampally Ikat Handwoven Silk Stole',
          buyer: 'Heritage Fab Boutique',
          buyerName: 'Heritage Fab Boutique',
          quantity: 1,
          total_amount: 2450,
          totalAmount: 2450,
          status: 'Delivered',
          order_date: '02 Jul 2026',
          order_placed_time: '02 Jul 2026, 11:30 AM',
          delivered_date: '10 Jul 2026',
          artisan: 'Pochampally Weavers Society',
          progress: 100
        }
      ];
      changed = true;
    }

    if (changed) {
      try {
        localStorage.setItem('kala_mitra_active_orders', JSON.stringify(stored));
      } catch(e) {}
    }

    return stored;
  }
  async _orig_getAllOrders() {
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

