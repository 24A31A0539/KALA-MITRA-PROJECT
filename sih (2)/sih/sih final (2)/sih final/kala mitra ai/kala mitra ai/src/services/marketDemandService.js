/**
 * KALA-MITRA - AI Market Demand & Craft Recommendation Service
 * Provides market demand analytics, regional buyer trends, high-demand crafts,
 * and dynamic personalized AI craft recommendations based on artisan skills and capacity.
 * 
 * Note: Uses realistic market intelligence dataset based on Indian craft trade indicators.
 * Ready for real-time backend / REST API integration.
 */

export class MarketDemandService {
  constructor() {
    this.dataSourceDisclaimer = "KALA-MITRA Market Intelligence Engine (Simulated Dataset based on Regional Craft Trends • Ready for Live API)";
  }

  /**
   * Get high-level market demand metrics summary
   */
  getMarketDemandSummary() {
    return {
      activeBuyerSearches: "14,850+",
      monthlyGrowthRate: "+32%",
      topDemandCategory: "Bamboo Crafts & Eco Decor",
      topBuyerHub: "Bengaluru & Hyderabad",
      totalBulkDemands: 48,
      lastUpdated: "Today, Live Market Sync"
    };
  }

  /**
   * Get list of trending / high-demand crafts
   * @param {string} categoryFilter
   */
  getTrendingCrafts(categoryFilter = 'All') {
    const crafts = [
      {
        id: 'trend-1',
        name: 'Handwoven Bamboo Serving Trays & Baskets',
        category: 'Bamboo Crafts',
        icon: '🎋',
        demandLevel: 'Very High',
        demandBadgeClass: 'demand-pill--very-high',
        demandCount: '620 units requested this month',
        trendGrowth: '+38% MoM',
        avgPriceRange: '₹420 – ₹650',
        popularLocations: ['Bengaluru', 'Hyderabad', 'Visakhapatnam'],
        buyerTypes: ['Resorts & Hotels', 'Eco-Retailers', 'Corporate Gifting'],
        description: 'Lightweight, durable natural bamboo trays with woven rattan handles. Rapidly growing in boutique hospitality and modern eco-homes.'
      },
      {
        id: 'trend-2',
        name: 'Terracotta Self-Watering Herb Planters',
        category: 'Pottery',
        icon: '🏺',
        demandLevel: 'High',
        demandBadgeClass: 'demand-pill--high',
        demandCount: '480 units requested this month',
        trendGrowth: '+28% MoM',
        avgPriceRange: '₹350 – ₹520',
        popularLocations: ['Hyderabad', 'Chennai', 'Bengaluru'],
        buyerTypes: ['Urban Garden Centers', 'Home Decor Retailers'],
        description: 'Traditional porous clay planters optimized for indoor herbs and apartment balconies. High urban buyer interest.'
      },
      {
        id: 'trend-3',
        name: 'Mangalagiri Cotton Table Runners & Mats',
        category: 'Handloom & Weaving',
        icon: '🧵',
        demandLevel: 'High',
        demandBadgeClass: 'demand-pill--high',
        demandCount: '390 units requested this month',
        trendGrowth: '+31% MoM',
        avgPriceRange: '₹580 – ₹950',
        popularLocations: ['Mumbai', 'Delhi NCR', 'Bengaluru'],
        buyerTypes: ['Boutique Exports', 'Interior Designers'],
        description: 'Authentic hand-blocked cotton textiles with zari borders for dining and home accent decor.'
      },
      {
        id: 'trend-4',
        name: 'Sculpted Solid Wood Serving Bowls',
        category: 'Wood Crafts',
        icon: '🪵',
        demandLevel: 'Surging',
        demandBadgeClass: 'demand-pill--surging',
        demandCount: '510 units requested this month',
        trendGrowth: '+45% MoM',
        avgPriceRange: '₹750 – ₹1,400',
        popularLocations: ['Bengaluru', 'Goa', 'Hyderabad'],
        buyerTypes: ['Fine Dining Restaurants', 'Export Houses'],
        description: 'Food-safe neem and teak wood bowls crafted with smooth organic curves. High demand from premium hospitality.'
      },
      {
        id: 'trend-5',
        name: 'Hand-Painted Kalamkari Canvas Art Wall Hanging',
        category: 'Traditional Art',
        icon: '🎨',
        demandLevel: 'Medium-High',
        demandBadgeClass: 'demand-pill--medium',
        demandCount: '280 units requested this month',
        trendGrowth: '+22% MoM',
        avgPriceRange: '₹1,200 – ₹2,800',
        popularLocations: ['Hyderabad', 'Chennai', 'Delhi NCR'],
        buyerTypes: ['Corporate Offices', 'Art Collectors'],
        description: 'Natural dye hand-painted motif wall scrolls illustrating traditional mythological and floral themes.'
      },
      {
        id: 'trend-6',
        name: 'Bell Metal Dhokra Figurine Oil Lamps',
        category: 'Metal Crafts',
        icon: '🔔',
        demandLevel: 'High',
        demandBadgeClass: 'demand-pill--high',
        demandCount: '340 units requested this month',
        trendGrowth: '+25% MoM',
        avgPriceRange: '₹850 – ₹1,850',
        popularLocations: ['Kolkata', 'Bhubaneswar', 'Bengaluru'],
        buyerTypes: ['Cultural Heritage Stores', 'Festival Buyers'],
        description: 'Lost-wax cast brass and bronze oil lamps crafted by tribal artisan collectives.'
      }
    ];

    if (!categoryFilter || categoryFilter === 'All') {
      return crafts;
    }
    return crafts.filter(c => c.category.toLowerCase().includes(categoryFilter.toLowerCase()) || categoryFilter.toLowerCase().includes(c.category.toLowerCase()));
  }

  /**
   * Get popular buyer locations breakdown
   */
  getBuyerLocations() {
    return [
      {
        city: 'Bengaluru',
        state: 'Karnataka',
        activeRequests: 18,
        dominantCategory: 'Bamboo & Sustainable Living',
        demandScale: 'Very High (42% of total south demand)',
        icon: '🏢'
      },
      {
        city: 'Hyderabad',
        state: 'Telangana',
        activeRequests: 14,
        dominantCategory: 'Terracotta & Corporate Gifting',
        demandScale: 'High (28% of total south demand)',
        icon: '🏛️'
      },
      {
        city: 'Visakhapatnam',
        state: 'Andhra Pradesh',
        activeRequests: 9,
        dominantCategory: 'Cane Furniture & Handloom',
        demandScale: 'Growing (+35% MoM)',
        icon: '🌊'
      },
      {
        city: 'Delhi NCR & Mumbai',
        state: 'North / West Hubs',
        activeRequests: 12,
        dominantCategory: 'Heritage Textiles & Wood Carvings',
        demandScale: 'High Value Premium Orders',
        icon: '🌆'
      }
    ];
  }

  /**
   * Get market demand trend themes
   */
  getDemandTrends() {
    return [
      {
        title: '🌿 Eco-Friendly Hospitality Decor',
        growth: '+42% YoY',
        tag: 'Top Trend',
        summary: 'Hotels and resorts are replacing plastic with natural bamboo trays, woven lamps, and terracotta room accents.'
      },
      {
        title: '🎁 Sustainable Corporate Gifting',
        growth: '+35% Search Velocity',
        tag: 'High Demand',
        summary: 'IT & Enterprise companies in Bengaluru/Hyderabad prefer handmade craft gift boxes over commercial items.'
      },
      {
        title: '🏠 Minimalist Artisanal Home Accents',
        growth: '+28% Order Vol',
        tag: 'Rising Trend',
        summary: 'Urban buyers favor earth-toned pottery and handloom table runners with clean modern aesthetics.'
      }
    ];
  }

  /**
   * Generate personalized AI craft recommendation for an artisan
   * @param {object} artisanProfile Current logged-in user profile
   * @param {object} capacityData Artisan workshop capacity data from capacityRepository
   * @returns {object} Recommendation object
   */
  getPersonalizedRecommendation(artisanProfile = {}, capacityData = {}) {
    const userCraft = (artisanProfile.craftType || artisanProfile.craft || 'Bamboo Handicrafts').toLowerCase();
    const userLocation = artisanProfile.location || 'East Godavari, Andhra Pradesh';
    const availableStock = capacityData.availableStock || 120;
    const monthlyProd = capacityData.monthlyProduction || 300;
    const leadTime = capacityData.leadTimeDays || 7;

    // Default: Bamboo Crafts recommendation (matching default artisan Lakshmi Devi)
    let recommendation = {
      productTitle: 'Eco-Friendly Handwoven Bamboo Serving Tray',
      category: 'Bamboo Crafts',
      material: 'Natural Bamboo & Cane',
      suggestedPrice: 480,
      priceRange: '₹450 – ₹620 per unit',
      suggestedBatchQuantity: Math.min(Math.max(availableStock, 80), 150),
      estimatedRevenue: `₹${(Math.min(Math.max(availableStock, 80), 150) * 480).toLocaleString('en-IN')}`,
      leadTimeDays: leadTime,
      skillMatchScore: 96,
      skillMatchLabel: '96% Skill & Capacity Match',
      tags: ['Bamboo', 'Handmade', 'Eco-friendly', 'Serving Tray', 'Hospitality'],
      location: userLocation,
      aiRationale: `Based on your workshop's current ${availableStock} units available capacity and 7-day turnaround speed, this bamboo serving tray aligns directly with surging buyer demand in Bengaluru (+38% MoM) and active hospitality bulk requests.`,
      description: 'Handcrafted natural bamboo serving tray reinforced with woven cane edges and smooth lacquer finish. Perfect for resort dining, cafe presentation, and home entertaining.',
      connectedBuyerDemands: [
        {
          id: 'req-bamboo-101',
          buyerName: 'GreenLeaf Hotels & Resorts',
          buyerType: 'Hospitality Chain',
          location: 'Bengaluru, Karnataka',
          quantityRequested: 500,
          workshopShare: 120,
          targetPrice: '₹480 / unit',
          urgency: '14 days timeline',
          status: 'Open for Artisan Cluster'
        },
        {
          id: 'req-bamboo-102',
          buyerName: 'Heritage Craft Emporium',
          buyerType: 'Retail Boutique',
          location: 'Hyderabad, Telangana',
          quantityRequested: 150,
          workshopShare: 100,
          targetPrice: '₹520 / unit',
          urgency: 'Immediate Stock',
          status: 'Direct Buyer Request'
        },
        {
          id: 'req-bamboo-103',
          buyerName: 'Vayu Eco-Living Store',
          buyerType: 'E-commerce Brand',
          location: 'Visakhapatnam, AP',
          quantityRequested: 80,
          workshopShare: 80,
          targetPrice: '₹500 / unit',
          urgency: 'Monthly Recurring',
          status: 'Recurring Order'
        }
      ]
    };

    // If artisan profile matches Pottery
    if (userCraft.includes('pottery') || userCraft.includes('clay') || userCraft.includes('terracotta')) {
      recommendation = {
        productTitle: 'Handcrafted Terracotta Self-Watering Herb Planter',
        category: 'Pottery',
        material: 'Natural Terracotta Clay',
        suggestedPrice: 420,
        priceRange: '₹380 – ₹520 per unit',
        suggestedBatchQuantity: Math.min(Math.max(availableStock, 75), 120),
        estimatedRevenue: `₹${(Math.min(Math.max(availableStock, 75), 120) * 420).toLocaleString('en-IN')}`,
        leadTimeDays: Math.max(leadTime, 10),
        skillMatchScore: 94,
        skillMatchLabel: '94% Skill & Capacity Match',
        tags: ['Pottery', 'Terracotta', 'Herb Planter', 'Eco-friendly', 'Indoor Garden'],
        location: userLocation,
        aiRationale: `Urban buyer demand for indoor terracotta planters in Hyderabad and Chennai has grown +28% this month. Your clay molding expertise matches these specifications.`,
        description: 'Breathable terracotta clay planter with porous inner wall water reservoir. Designed for urban home kitchens, desk gardens, and eco-retail.',
        connectedBuyerDemands: [
          {
            id: 'req-pottery-201',
            buyerName: 'Urban Greens Nursery Network',
            buyerType: 'Garden Center Chain',
            location: 'Hyderabad, Telangana',
            quantityRequested: 300,
            workshopShare: 100,
            targetPrice: '₹420 / unit',
            urgency: '10 days timeline',
            status: 'Open Requirement'
          }
        ]
      };
    } else if (userCraft.includes('handloom') || userCraft.includes('weave') || userCraft.includes('textile')) {
      recommendation = {
        productTitle: 'Hand-Blocked Mangalagiri Cotton Table Runner',
        category: 'Handloom & Weaving',
        material: 'Pure Handloom Cotton & Zari',
        suggestedPrice: 750,
        priceRange: '₹680 – ₹920 per unit',
        suggestedBatchQuantity: Math.min(Math.max(availableStock, 50), 100),
        estimatedRevenue: `₹${(Math.min(Math.max(availableStock, 50), 100) * 750).toLocaleString('en-IN')}`,
        leadTimeDays: Math.max(leadTime, 12),
        skillMatchScore: 95,
        skillMatchLabel: '95% Skill & Capacity Match',
        tags: ['Handloom', 'Cotton', 'Table Runner', 'Mangalagiri', 'Traditional Textile'],
        location: userLocation,
        aiRationale: `Luxury textile buyers in Mumbai and Bengaluru are placing high-margin orders (+31% MoM) for authentic hand-blocked table runners. Fits your loom turnaround speed.`,
        description: 'Authentic 100% handloom cotton table runner with woven metallic zari border and traditional floral block prints.',
        connectedBuyerDemands: [
          {
            id: 'req-textile-301',
            buyerName: 'Craftsvilla Boutique Decor',
            buyerType: 'Export House',
            location: 'Mumbai, Maharashtra',
            quantityRequested: 250,
            workshopShare: 80,
            targetPrice: '₹750 / unit',
            urgency: '20 days timeline',
            status: 'Export Opportunity'
          }
        ]
      };
    }

    return recommendation;
  }
}

export const marketDemandService = new MarketDemandService();
