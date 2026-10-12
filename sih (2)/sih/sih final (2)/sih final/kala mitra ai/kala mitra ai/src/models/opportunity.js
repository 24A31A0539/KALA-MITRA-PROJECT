/**
 * KALA-MITRA Opportunity & Market Insight Models
 */

export class Opportunity {
  constructor({
    id = null,
    title = '',
    craftType = 'Bamboo Handicrafts',
    buyerName = 'GreenLeaf Hotels',
    buyerType = 'Hospitality & Luxury Resorts',
    requiredQuantity = 500,
    artisanSuggestedCapacity = 120,
    targetPricePerUnit = 450,
    location = 'Hyderabad, Telangana',
    deadline = '15 Oct 2026',
    isClusterOpportunity = true,
    participatingArtisansCount = 3,
    status = 'open'
  } = {}) {
    this.id = id || `opp_${Date.now()}`;
    this.title = title;
    this.craftType = craftType;
    this.buyerName = buyerName;
    this.buyerType = buyerType;
    this.requiredQuantity = requiredQuantity;
    this.artisanSuggestedCapacity = artisanSuggestedCapacity;
    this.targetPricePerUnit = targetPricePerUnit;
    this.location = location;
    this.deadline = deadline;
    this.isClusterOpportunity = isClusterOpportunity;
    this.participatingArtisansCount = participatingArtisansCount;
    this.status = status;
  }
}

export class MarketOpportunityInsight {
  constructor({
    craftName = 'Bamboo baskets',
    highlightText = 'Bamboo baskets are currently receiving increased buyer interest.',
    demandLevel = 'High',
    typicalPriceRange = '₹400–₹550',
    relevantBuyerRequests = 12,
    topBuyerRegions = 'Telangana, Karnataka, Maharashtra'
  } = {}) {
    this.craftName = craftName;
    this.highlightText = highlightText;
    this.demandLevel = demandLevel;
    this.typicalPriceRange = typicalPriceRange;
    this.relevantBuyerRequests = relevantBuyerRequests;
    this.topBuyerRegions = topBuyerRegions;
  }
}
