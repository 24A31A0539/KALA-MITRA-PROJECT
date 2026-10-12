/**
 * KALA-MITRA Product Repository
 * Repository pattern isolating demo/local data layer from UI widgets.
 * Designed for seamless plug-in to future Python FastAPI + PostgreSQL backend endpoints:
 * - GET    /api/v1/artisan/products
 * - GET    /api/v1/artisan/products/{id}
 * - POST   /api/v1/artisan/products
 * - PUT    /api/v1/artisan/products/{id}
 * - DELETE /api/v1/artisan/products/{id}
 * - POST   /api/v1/ai/catalog-vision (Future YOLOv8 + SAM extraction)
 */

import { Product, ProductStatus } from '../models/product.js';
import {
  getBuyerProductsForCraft,
  mapCraftToBuyerCategory,
  getProductImage,
  isProductRelatedToCraft,
  addArtisanProductToBuyerMarketplace,
  updateArtisanProductInBuyerMarketplace,
  removeArtisanProductFromBuyerMarketplace,
  syncAllArtisanProductsToBuyerMarketplace
} from '../services/marketplaceService.js';

const STORAGE_KEY = 'kala_mitra_artisan_products';
const ACTIVE_CRAFT_KEY = 'kala_mitra_artisan_active_craft';

function getMaterialForCraft(craftType, title) {
  const c = ((craftType || '') + ' ' + (title || '')).toLowerCase();
  if (c.includes('bamboo') || c.includes('cane')) return 'Natural Seasoned Bamboo & Split Cane';
  if (c.includes('pottery') || c.includes('terracotta') || c.includes('clay') || c.includes('stone') || c.includes('diya')) return 'Natural River Clay & Mineral Pigments';
  if (c.includes('silk') || c.includes('banarasi') || c.includes('kanjivaram') || c.includes('saree')) return '100% Pure Heritage Silk & Zari';
  if (c.includes('handloom') || c.includes('cotton') || c.includes('weaving') || c.includes('textile') || c.includes('dhoti') || c.includes('runner') || c.includes('fabric')) return 'Organic Handspun Cotton & Natural Dye';
  if (c.includes('toy') || c.includes('doll') || c.includes('etikoppaka') || c.includes('kondapalli')) return 'Soft Ankudu Wood & Non-Toxic Natural Vegetable Lacquer';
  if (c.includes('wood') || c.includes('carving') || c.includes('panel')) return 'Seasoned Reclaimed Teak & Sheesham Wood';
  if (c.includes('embroidery') || c.includes('mirror') || c.includes('cushion')) return 'Pure Cotton Linen Base with Mirror & Zari Threading';
  if (c.includes('bag') || c.includes('jute') || c.includes('tote')) return 'High-Density Golden Jute & Organic Canvas';
  if (c.includes('jewel') || c.includes('brass') || c.includes('dokra') || c.includes('bead')) return 'Lost-Wax Cast Dokra Brass & Terracotta Beads';
  if (c.includes('kalamkari') || c.includes('paint') || c.includes('art') || c.includes('scroll')) return 'Natural Botanical Pigments on Handloom Cotton Canvas';
  return 'Authentic Traditional Handcrafted Materials';
}

function getIconForCraft(craftType) {
  const c = (craftType || '').toLowerCase();
  if (c.includes('bamboo') || c.includes('cane')) return '🎋';
  if (c.includes('pottery') || c.includes('terracotta') || c.includes('clay')) return '🏺';
  if (c.includes('handloom') || c.includes('weaving') || c.includes('textile') || c.includes('silk')) return '🧵';
  if (c.includes('wood')) return '🪵';
  if (c.includes('toy') || c.includes('doll') || c.includes('etikoppaka')) return '🧸';
  if (c.includes('embroidery')) return '🪡';
  if (c.includes('bag')) return '👜';
  if (c.includes('jewel') || c.includes('metal')) return '💍';
  if (c.includes('folk') || c.includes('art') || c.includes('paint') || c.includes('kalamkari')) return '🎨';
  return '✨';
}

class ProductRepository {
  constructor() {
    this._products = [];
    this._activeCraft = null;
    this._initProducts();
  }

  /**
   * Clear all products and active craft from memory and storage
   */
  clearProducts() {
    this._products = [];
    this._activeCraft = null;
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(ACTIVE_CRAFT_KEY);
    } catch (e) {}
  }

  /**
   * Initialize products from localStorage or populate matching buyer craft products.
   * Strictly filters out any lingering products from other crafts.
   */
  _initProducts() {
    let currentCraft = null;
    try {
      this._activeCraft = localStorage.getItem(ACTIVE_CRAFT_KEY) || null;
      const sessionRaw = localStorage.getItem('kala_mitra_auth_session');
      if (sessionRaw) {
        const session = JSON.parse(sessionRaw);
        if (session && session.craftType) {
          currentCraft = session.craftType;
        }
      }
    } catch (e) {}

    const targetCraft = currentCraft || this._activeCraft || 'Bamboo Handicrafts';

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const loaded = parsed.map(item => Product.fromJSON(item));
          // Filter out ANY product not belonging to targetCraft
          const filtered = loaded.filter(p => isProductRelatedToCraft(p, targetCraft));
          
          // Deduplicate loaded products by ID and by normalized name
          const seenIds = new Set();
          const seenNames = new Set();
          const deduped = [];
          for (const prod of filtered) {
            const idKey = String(prod.id);
            const nameKey = prod.name.trim().toLowerCase();
            if (!seenIds.has(idKey) && !seenNames.has(nameKey)) {
              seenIds.add(idKey);
              seenNames.add(nameKey);
              deduped.push(prod);
            }
          }

          if (deduped.length > 0) {
            this._products = deduped;
            this._activeCraft = targetCraft;
            this._saveToStorage();
            syncAllArtisanProductsToBuyerMarketplace(this._products);
            return;
          }
        }
      }
    } catch (e) {
      console.warn('Could not read products from localStorage:', e);
    }

    // Populate fresh matching craft products taken from buyer side
    this.populateProductsFromBuyerCraft(targetCraft);
  }

  /**
   * Populate artisan products directly from buyer side (SAMPLE_PRODUCTS) for the selected craft.
   * Completely removes any previous products from another craft and ensures ZERO duplicate products!
   */
  populateProductsFromBuyerCraft(craftType, user = null) {
    const activeCraftName = craftType || 'Bamboo Handicrafts';
    const buyerItems = getBuyerProductsForCraft(activeCraftName);
    const artisanLoc = user?.location || 'East Godavari, Andhra Pradesh';
    const artisanId = user?.id || 'art_current';

    // 1. Only retain genuine custom products that belong to THIS selected craft
    const matchingCustomProducts = this._products.filter(p => {
      // Discard previous seeded products
      if (p.catalogSource === 'buyer_catalog_seed' || p.buyerProductId) {
        return false;
      }
      // Must be related to the new selected craft
      return isProductRelatedToCraft(p, activeCraftName);
    });

    // 2. Map buyer-side items for this craft without duplicates
    const seenBuyerTitles = new Set();
    const cleanBuyerItems = [];
    for (const bItem of buyerItems) {
      const bTitle = bItem.title.trim().toLowerCase();
      if (!seenBuyerTitles.has(bTitle)) {
        seenBuyerTitles.add(bTitle);
        cleanBuyerItems.push(bItem);
      }
    }

    const craftProducts = cleanBuyerItems.map((p) => {
      return new Product({
        id: `PRD-${p.id}`,
        artisanId: artisanId,
        buyerProductId: p.id,
        name: p.title,
        category: p.craft_type,
        material: getMaterialForCraft(p.craft_type, p.title),
        description: p.description,
        price: p.price,
        availableQuantity: Math.round((p.monthly_capacity || 200) * 0.25) || 50,
        productionCapacity: p.monthly_capacity || 100,
        productionPeriod: 'monthly',
        productionTimeDays: p.lead_time_days || 7,
        location: artisanLoc,
        tags: [p.craft_type.split('&')[0].trim(), 'Handmade', 'GI Certified', 'Sustainable'],
        imageUrl: p.imageUrl || getProductImage(p.id),
        imageIcon: getIconForCraft(p.craft_type),
        status: ProductStatus.ACTIVE,
        catalogSource: 'buyer_catalog_seed'
      });
    });

    // 3. Merge custom products and craft products with STRICT DEDUPLICATION
    const seenIds = new Set();
    const seenTitles = new Set();
    const finalProducts = [];

    // Prioritize custom products first
    for (const p of matchingCustomProducts) {
      const idKey = String(p.id);
      const titleKey = p.name.trim().toLowerCase();
      if (!seenIds.has(idKey) && !seenTitles.has(titleKey)) {
        seenIds.add(idKey);
        seenTitles.add(titleKey);
        finalProducts.push(p);
      }
    }

    // Then add buyer craft products
    for (const p of craftProducts) {
      const idKey = String(p.id);
      const titleKey = p.name.trim().toLowerCase();
      if (!seenIds.has(idKey) && !seenTitles.has(titleKey)) {
        seenIds.add(idKey);
        seenTitles.add(titleKey);
        finalProducts.push(p);
      }
    }

    this._products = finalProducts;
    this._activeCraft = activeCraftName;

    try {
      localStorage.setItem(ACTIVE_CRAFT_KEY, activeCraftName);
    } catch (e) {}

    this._saveToStorage();
    syncAllArtisanProductsToBuyerMarketplace(this._products, user);
  }

  /**
   * Synchronize artisan products with selected craft.
   * If any products from another craft or duplicates are detected, repopulates cleanly.
   */
  async syncProductsForArtisanCraft(craftType, user = null, force = false) {
    if (!craftType) return this._products;
    const normalized = craftType.trim();

    // Check if any product belongs to another craft
    const hasOtherCraftProducts = this._products.some(p => !isProductRelatedToCraft(p, normalized));
    const hasMatchingCraftProducts = this._products.some(p => isProductRelatedToCraft(p, normalized));

    // Check if there are any duplicate names currently in this._products
    const names = this._products.map(p => p.name.trim().toLowerCase());
    const hasDuplicates = new Set(names).size < names.length;

    if (force || hasOtherCraftProducts || !hasMatchingCraftProducts || hasDuplicates || !this._activeCraft || this._activeCraft.toLowerCase() !== normalized.toLowerCase()) {
      this.populateProductsFromBuyerCraft(normalized, user);
      return this._products;
    }

    return this._products;
  }

  _saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._products.map(p => p.toJSON())));
    } catch (e) {
      console.warn('Failed to persist products to localStorage:', e);
    }
  }

  /**
   * Get all products with optional filters, guaranteed free of duplicates
   * @param {object} filterOptions
   * @returns {Promise<Product[]>}
   */
  async getProducts({ status = null, category = null, searchQuery = '' } = {}) {
    // Simulate slight network delay
    await new Promise(resolve => setTimeout(resolve, 60));

    // Deduplicate in-memory to guarantee clean display
    const seenIds = new Set();
    const seenTitles = new Set();
    const deduped = [];
    for (const p of this._products) {
      const idKey = String(p.id);
      const titleKey = p.name.trim().toLowerCase();
      if (!seenIds.has(idKey) && !seenTitles.has(titleKey)) {
        seenIds.add(idKey);
        seenTitles.add(titleKey);
        deduped.push(p);
      }
    }
    this._products = deduped;

    let results = [...this._products];

    if (status && status !== 'all') {
      results = results.filter(p => p.status === status);
    }

    if (category && category !== 'all') {
      results = results.filter(p => p.category === category || p.displayCategory === category);
    }

    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      results = results.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.material.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q) ||
        p.tags.some(tag => tag.toLowerCase().includes(q))
      );
    }

    return results;
  }

  /**
   * Get single product by ID
   * @param {string} id
   * @returns {Promise<Product|null>}
   */
  async getProductById(id) {
    await new Promise(resolve => setTimeout(resolve, 50));
    const found = this._products.find(p => String(p.id) === String(id));
    return found ? found.clone() : null;
  }

  /**
   * Create new product and automatically propagate it to Buyer Marketplace without creating duplicates!
   * @param {object} productData
   * @returns {Promise<Product>}
   */
  async createProduct(productData) {
    await new Promise(resolve => setTimeout(resolve, 150));
    const newProduct = new Product({
      ...productData,
      id: `PRD-${Date.now().toString().slice(-6)}`,
      catalogSource: productData.catalogSource || 'manual',
      buyerProductId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Check if product with same title already exists in this._products to avoid duplication
    const titleKey = newProduct.name.trim().toLowerCase();
    const existingIndex = this._products.findIndex(p => p.name.trim().toLowerCase() === titleKey);
    if (existingIndex !== -1) {
      // Update existing in-place instead of creating duplicate
      this._products[existingIndex] = newProduct;
    } else {
      this._products.unshift(newProduct);
    }
    this._saveToStorage();

    // Automatically propagate to Buyer Wholesale Marketplace
    try {
      addArtisanProductToBuyerMarketplace(newProduct);
    } catch (err) {
      console.warn('Failed to add product to buyer marketplace:', err);
    }

    return newProduct.clone();
  }

  /**
   * Update existing product and update Buyer Marketplace
   * @param {string} id
   * @param {object} updates
   * @returns {Promise<Product>}
   */
  async updateProduct(id, updates) {
    await new Promise(resolve => setTimeout(resolve, 150));
    const index = this._products.findIndex(p => String(p.id) === String(id));
    if (index === -1) {
      throw new Error(`Product with ID "${id}" not found.`);
    }

    const current = this._products[index];
    const updated = new Product({
      ...current.toJSON(),
      ...updates,
      id: current.id,
      artisanId: current.artisanId,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString()
    });

    this._products[index] = updated;
    this._saveToStorage();

    // Propagate update to Buyer Marketplace
    try {
      updateArtisanProductInBuyerMarketplace(updated);
    } catch (err) {
      console.warn('Failed to update product in buyer marketplace:', err);
    }

    return updated.clone();
  }

  /**
   * Delete product by ID and remove from Buyer Marketplace
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async deleteProduct(id) {
    await new Promise(resolve => setTimeout(resolve, 120));
    const initialLen = this._products.length;
    this._products = this._products.filter(p => String(p.id) !== String(id));
    const success = this._products.length < initialLen;
    if (success) {
      this._saveToStorage();
      try {
        removeArtisanProductFromBuyerMarketplace(id);
      } catch (err) {
        console.warn('Failed to remove product from buyer marketplace:', err);
      }
    }
    return success;
  }

  /**
   * Reset to initial demo products
   */
  resetDemoData() {
    localStorage.removeItem(STORAGE_KEY);
    this._initProducts();
  }

  /**
   * Get counts
   */
  getCounts() {
    const seenIds = new Set();
    const seenNames = new Set();
    const deduped = [];
    for (const p of this._products) {
      const idKey = String(p.id);
      const nameKey = p.name.trim().toLowerCase();
      if (!seenIds.has(idKey) && !seenNames.has(nameKey)) {
        seenIds.add(idKey);
        seenNames.add(nameKey);
        deduped.push(p);
      }
    }
    this._products = deduped;

    const total = this._products.length;
    const active = this._products.filter(p => p.status === ProductStatus.ACTIVE).length;
    const inactive = this._products.filter(p => p.status === ProductStatus.INACTIVE).length;
    const draft = this._products.filter(p => p.status === ProductStatus.DRAFT).length;
    return { total, active, inactive, draft };
  }
}

export const productRepository = new ProductRepository();
