/**
 * KALA-MITRA Product Model
 * Structured data representation for Artisan Craft Catalog,
 * designed for future AI Vision Cataloging (YOLOv8/SAM),
 * semantic vector embeddings (pgvector), and Collective Capacity Matching.
 */

export const ProductStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  DRAFT: 'draft'
};

export const ProductStatusLabels = {
  [ProductStatus.ACTIVE]: { label: 'Active', color: 'green', desc: 'Visible to buyers' },
  [ProductStatus.INACTIVE]: { label: 'Inactive', color: 'gray', desc: 'Temporarily paused' },
  [ProductStatus.DRAFT]: { label: 'Draft', color: 'amber', desc: 'Not yet published' }
};

export const ProductCategories = [
  'Bamboo Crafts',
  'Pottery',
  'Handloom & Weaving',
  'Textiles',
  'Wood Crafts',
  'Metal Crafts',
  'Jewelry',
  'Home Decor',
  'Traditional Art',
  'Other'
];

export class Product {
  constructor({
    id = null,
    artisanId = 'art_default',
    buyerProductId = null,
    name = '',
    category = 'Bamboo Crafts',
    customCategory = '',
    material = '',
    description = '',
    price = 0,
    availableQuantity = 0,
    productionCapacity = 50,
    productionPeriod = 'monthly',
    productionTimeDays = 7,
    location = 'India',
    availabilityStatus = 'available',
    tags = [],
    imageUrl = '',
    imageIcon = '🏺',
    status = ProductStatus.ACTIVE,
    aiGenerated = false,
    aiProcessedAt = null,
    aiModelVersion = null,
    catalogSource = 'manual',
    createdAt = new Date().toISOString(),
    updatedAt = new Date().toISOString()
  } = {}) {
    this.id = id || `PRD-${Date.now().toString().slice(-6)}`;
    this.artisanId = artisanId;
    this.buyerProductId = buyerProductId || null;
    this.name = name.trim();
    this.category = category;
    this.customCategory = customCategory.trim();
    this.material = material.trim();
    this.description = description.trim();
    this.price = Number(price) || 0;
    this.availableQuantity = Number(availableQuantity) || 0;
    this.productionCapacity = Number(productionCapacity) || 0;
    this.productionPeriod = productionPeriod || 'monthly';
    this.productionTimeDays = Number(productionTimeDays) || 1;
    this.location = location.trim();
    this.availabilityStatus = availabilityStatus || 'available';
    
    // Normalize tags to array of clean strings
    if (Array.isArray(tags)) {
      this.tags = tags.map(t => String(t).trim()).filter(Boolean);
    } else if (typeof tags === 'string') {
      this.tags = tags.split(',').map(t => t.trim()).filter(Boolean);
    } else {
      this.tags = [];
    }

    this.imageUrl = imageUrl || '';
    this.imageIcon = imageIcon || '🏺';
    this.status = Object.values(ProductStatus).includes(status) ? status : ProductStatus.ACTIVE;
    
    // AI Cataloging Metadata
    this.aiGenerated = Boolean(aiGenerated);
    this.aiProcessedAt = aiProcessedAt || (aiGenerated ? new Date().toISOString() : null);
    this.aiModelVersion = aiModelVersion || (aiGenerated ? 'yolov8n + sam + llm' : null);
    this.catalogSource = catalogSource || (aiGenerated ? 'ai_assisted' : 'manual');

    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  /**
   * Display category name (resolves 'Other' with customCategory)
   */
  get displayCategory() {
    if (this.category === 'Other' && this.customCategory) {
      return this.customCategory;
    }
    return this.category;
  }

  /**
   * Clone product instance
   */
  clone() {
    return new Product(JSON.parse(JSON.stringify(this)));
  }

  /**
   * Serialize for API or LocalStorage
   */
  toJSON() {
    return {
      id: this.id,
      artisanId: this.artisanId,
      buyerProductId: this.buyerProductId,
      name: this.name,
      category: this.category,
      customCategory: this.customCategory,
      material: this.material,
      description: this.description,
      price: this.price,
      availableQuantity: this.availableQuantity,
      productionCapacity: this.productionCapacity,
      productionPeriod: this.productionPeriod,
      productionTimeDays: this.productionTimeDays,
      location: this.location,
      availabilityStatus: this.availabilityStatus,
      tags: this.tags,
      imageUrl: this.imageUrl,
      imageIcon: this.imageIcon,
      status: this.status,
      aiGenerated: this.aiGenerated,
      aiProcessedAt: this.aiProcessedAt,
      aiModelVersion: this.aiModelVersion,
      catalogSource: this.catalogSource,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Rehydrate from JSON
   */
  static fromJSON(json) {
    return new Product(json);
  }
}
