/**
 * Marketplace Module
 * Handles the Indian Crafts Marketplace UI and interactions
 */

import { CRAFT_CATEGORIES, SAMPLE_PRODUCTS, getProductImage, deduplicateSampleProducts } from './marketplaceService.js';

export class MarketplaceModule {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.selectedCategory = null;
    this.searchQuery = '';
    this.selectedProduct = null;
    this.quoteQty = 100;
    this.cart = this.loadCart();
    this.init();
  }

  init() {
    document.addEventListener('marketplace-add-to-cart', event => {
      this.addToCart(event.detail?.productId);
    });

    const refreshMarketplace = () => {
      this.render();
      this.renderProducts();
    };
    document.addEventListener('artisan-product-added-to-marketplace', refreshMarketplace);
    document.addEventListener('artisan-product-updated-in-marketplace', refreshMarketplace);
    document.addEventListener('artisan-product-removed-from-marketplace', refreshMarketplace);
    document.addEventListener('artisan-product-created', refreshMarketplace);

    this.render();
    this.setupEventListeners();
  }

  render() {
    const html = `
      <div class="marketplace-page">
        <div class="marketplace-container">
          <header class="marketplace-header">
            <div>
              <div class="eyebrow">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="9" cy="21" r="1"></circle>
                  <circle cx="20" cy="21" r="1"></circle>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                </svg>
                <span>Verified Artisan Wholesale Marketplace</span>
              </div>

              <h1>Handcrafted Indian Crafts</h1>

              <p>
                Source directly across 17 certified craft categories from master GI
                artisans and collective clusters with escrow protection.
              </p>
            </div>

            <button class="secondary-btn marketplace-cart-btn" id="btn-open-cart" type="button" aria-label="Open shopping cart">
              🛒 Cart <span id="marketplace-cart-count">0</span>
            </button>

            <button class="primary-btn marketplace-cta" id="btn-post-requirement">
              <span>Post Bulk Requirement</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>
          </header>

          <section class="categories-section">
            <div class="section-head">
              <h2>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
                Explore 17 Certified Craft Categories
              </h2>

              ${this.selectedCategory ? `
                <button class="clear-btn" id="btn-clear-filter">
                  Reset Filter
                </button>
              ` : ''}
            </div>

            <div class="category-grid">
              <button class="category-card ${!this.selectedCategory ? 'active' : ''}" id="btn-all-items" data-category-id="all">
                <div class="category-image all">
                  <span>✨</span>
                  <small>All Items</small>
                </div>
                <div class="category-body">
                  <strong>All 17 Crafts</strong>
                  <span>Full Wholesale Catalog</span>
                </div>
              </button>

              ${CRAFT_CATEGORIES.map(category => `
                <button class="category-card ${this.selectedCategory?.id === category.id ? 'active' : ''}" 
                        data-category-id="${category.id}" 
                        data-category-name="${category.name}">
                  <div class="category-image">
                    <img src="${category.image}" alt="${category.name}" />
                    <span class="badge">${category.count} items</span>
                    <span class="icon">${category.icon}</span>
                  </div>

                  <div class="category-body">
                    <strong>${category.name}</strong>
                    <span>Verified GI Craft</span>
                  </div>
                </button>
              `).join('')}
            </div>
          </section>

          <div class="toolbar">
            <div class="search-wrap">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input type="text" id="marketplace-search" placeholder="Search by craft name, artisan, material..." value="${this.searchQuery ? this.searchQuery.replace(/"/g, '&quot;') : ''}" />
            </div>

            <div class="toolbar-meta">
              ${this.selectedCategory ? `
                <span class="filter-pill">
                  ${this.selectedCategory.icon} ${this.selectedCategory.name}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" id="btn-close-filter" style="cursor: pointer;">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </span>
              ` : ''}
              ${this.searchQuery ? `
                <span class="filter-pill" style="background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe;">
                  🔍 "${this.searchQuery}"
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" id="btn-close-search-filter" style="cursor: pointer; margin-left: 4px;">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </span>
              ` : ''}
              <span>
                Showing <strong id="product-count">10</strong> items
              </span>
            </div>
          </div>

          <section class="product-grid" id="marketplace-product-grid">
            <!-- Products will be rendered here -->
          </section>

          ${this.selectedProduct ? this.renderQuoteModal() : ''}
        </div>
      </div>
    `;
    
    this.container.innerHTML = html;
    this.updateCartCount();
  }

  updateCartCount() {
    const totalItems = this.cart.reduce((total, item) => total + item.quantity, 0);
    const count = this.container?.querySelector('#marketplace-cart-count');
    if (count) count.textContent = totalItems;

    const headerBadge = document.getElementById('buyer-header-cart-badge');
    if (headerBadge) {
      headerBadge.textContent = totalItems;
      headerBadge.style.display = totalItems > 0 ? 'inline-flex' : 'inline-flex';
    }
  }

  loadCart() {
    try {
      const savedCart = JSON.parse(localStorage.getItem('kala-mitra-cart') || '[]');
      return Array.isArray(savedCart) ? savedCart : [];
    } catch (error) {
      return [];
    }
  }

  saveCart() {
    localStorage.setItem('kala-mitra-cart', JSON.stringify(this.cart));
  }

  showToastMessage(message, productTitle = '') {
    let popup = document.getElementById('cart-add-popup');
    if (!popup) {
      popup = document.createElement('div');
      popup.id = 'cart-add-popup';
      popup.className = 'cart-add-popup';
      document.body.appendChild(popup);
    }

    popup.innerHTML = `
      <div class="cart-popup-content">
        <div class="cart-popup-icon">✅</div>
        <div class="cart-popup-text">
          <strong>${message}</strong>
          ${productTitle ? `<small>"${productTitle}"</small>` : ''}
        </div>
        <button type="button" class="cart-popup-view-btn" id="btn-popup-view-cart">View Cart 🛒</button>
        <button type="button" class="cart-popup-close-btn" id="btn-popup-close">✕</button>
      </div>
    `;

    popup.querySelector('#btn-popup-view-cart')?.addEventListener('click', () => {
      popup.classList.remove('show');
      this.renderCartModal();
    });

    popup.querySelector('#btn-popup-close')?.addEventListener('click', () => {
      popup.classList.remove('show');
    });

    void popup.offsetWidth;
    popup.classList.add('show');

    clearTimeout(this._popupTimeout);
    this._popupTimeout = setTimeout(() => {
      popup.classList.remove('show');
    }, 4000);
  }

  getMaxStock(product) {
    if (!product) return 20;
    if (product.maxSingleArtisanStock) return Number(product.maxSingleArtisanStock);
    if (product.available_stock) return Number(product.available_stock);
    if (product.availableQuantity) return Number(product.availableQuantity);
    if (product.available) return Number(product.available);

    const id = Number(product.id) || 0;
    const title = (product.title || product.name || '').toLowerCase();
    const craft = (product.craft_type || product.category || '').toLowerCase();

    if (id === 1 || title.includes('bamboo storage basket') || title.includes('handwoven bamboo basket')) return 20;
    if (id === 2 || title.includes('tea table')) return 15;
    if (id === 3 || title.includes('garden stool')) return 25;
    if (id === 4 || title.includes('shelf')) return 18;
    if (id === 5 || title.includes('lamp')) return 12;
    if (id === 6 || title.includes('hamper')) return 20;
    if (id === 7 || title.includes('silk saree')) return 15;
    if (id === 8 || title.includes('table runner')) return 25;
    if (id === 9 || title.includes('dhoti')) return 30;
    if (id === 10 || title.includes('shawl')) return 20;
    if (id === 11 || title.includes('bedspread')) return 12;
    if (id === 12 || title.includes('fabric')) return 40;
    if (id === 13 || title.includes('diya')) return 50;

    if (craft.includes('bamboo')) return 20;
    if (craft.includes('embroidery')) return 20;
    if (craft.includes('handloom') || craft.includes('textile') || craft.includes('weaving')) return 15;
    if (craft.includes('pottery') || craft.includes('terracotta')) return 25;
    if (craft.includes('wood') || craft.includes('toy') || craft.includes('doll')) return 18;
    if (craft.includes('metal')) return 15;
    if (craft.includes('jewel') || craft.includes('bead') || craft.includes('necklace') || craft.includes('bangle') || craft.includes('earring')) return 30;
    if (craft.includes('bag') || craft.includes('pouch') || craft.includes('accessory')) return 25;
    if (craft.includes('folk') || craft.includes('art') || craft.includes('decor') || craft.includes('mural')) return 15;
    if (craft.includes('leather')) return 15;
    if (craft.includes('stone')) return 12;
    if (craft.includes('jute')) return 30;

    return 20;
  }

  showStockLimitReachedModal(product, requestedUnits = 120, maxStock = 20) {
    document.getElementById('stock-limit-modal-overlay')?.remove();

    const currentLang = localStorage.getItem('kala-mitra-language') || 'English';

    const titleText = currentLang === 'Telugu' ? 'స్టాక్ పరిమితికి చేరుకుంది' : currentLang === 'Hindi' ? 'स्टॉक सीमा पूरी हुई' : 'Stock Limit Reached';
    const desc1Text = currentLang === 'Telugu' 
      ? `సింగిల్ ఆర్టిసన్ స్టాక్ నుండి ప్రస్తుతం <strong>${maxStock} యూనిట్లు</strong> మాత్రమే అందుబాటులో ఉన్నాయి.`
      : currentLang === 'Hindi'
      ? `एकल कारीगर स्टॉक से केवल <strong>${maxStock} इकाइयां</strong> ही वर्तमान में उपलब्ध हैं।`
      : `Only <strong>${maxStock} units</strong> are currently available from single artisan stock.`;
    const desc2Text = currentLang === 'Telugu'
      ? `మరిన్ని కావాలా? ఆర్టిసన్ క్లస్టర్‌ను సృష్టించండి మరియు బహుళ కళాకారులు మీ అవసరాన్ని పూర్తి చేయనివ్వండి.`
      : currentLang === 'Hindi'
      ? `अधिक चाहिए? कारीगर क्लस्टर बनाएं और कई कारीगरों को अपनी आवश्यकता पूरी करने दें।`
      : `Need more? Create an Artisan Cluster and let multiple artisans fulfill your requirement.`;

    const clusterBtnText = currentLang === 'Telugu'
      ? `✨ ఆర్టిసన్ క్లస్టర్‌ను సృష్టించండి (${requestedUnits} యూనిట్లు)`
      : currentLang === 'Hindi'
      ? `✨ कारीगर क्लस्टर बनाएं (${requestedUnits} इकाइयां)`
      : `✨ Create Artisan Cluster (${requestedUnits} units)`;

    const continueBtnText = currentLang === 'Telugu'
      ? `అందుబాటులో ఉన్న పరిమాణంతో కొనసాగించండి (${maxStock} యూనిట్లు)`
      : currentLang === 'Hindi'
      ? `उपलब्ध मात्रा के साथ जारी रखें (${maxStock} इकाइयां)`
      : `Continue with Available Quantity (${maxStock} units)`;

    const overlay = document.createElement('div');
    overlay.id = 'stock-limit-modal-overlay';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(15, 23, 42, 0.65); backdrop-filter: blur(4px);
      z-index: 12000; display: flex; align-items: center; justify-content: center;
      padding: 20px; animation: fadeIn 0.2s ease-out;
    `;

    overlay.innerHTML = `
      <div style="background: #ffffff; border: 2.5px solid #f59e0b; border-radius: 24px; width: 100%; max-width: 480px; padding: 32px 26px 26px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.3); text-align: center; position: relative;">
        <div style="background: #2563eb; width: 64px; height: 64px; border-radius: 14px; margin: 0 auto 18px; display: flex; align-items: center; justify-content: center; font-size: 2.2rem; box-shadow: 0 8px 16px rgba(37,99,235,0.3);">
          📦
        </div>
        <h3 style="font-size: 1.45rem; font-weight: 800; color: #78350f; margin: 0 0 12px; font-family: inherit;">
          ${titleText}
        </h3>
        <p style="color: #475569; font-size: 0.95rem; line-height: 1.5; margin: 0 0 12px; font-weight: 500;">
          ${desc1Text}
        </p>
        <p style="color: #475569; font-size: 0.95rem; line-height: 1.5; margin: 0 0 24px; font-weight: 500;">
          ${desc2Text}
        </p>
        <button type="button" id="stock-limit-cluster-act" style="width: 100%; padding: 14px 20px; background: #047857; color: #ffffff; border: none; border-radius: 12px; font-size: 0.95rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 12px rgba(4,120,87,0.25); transition: background 0.2s;">
          ${clusterBtnText}
        </button>
        <button type="button" id="stock-limit-continue-act" style="width: 100%; padding: 14px 20px; background: #f1f5f9; color: #334155; border: none; border-radius: 12px; font-size: 0.95rem; font-weight: 600; cursor: pointer; margin-top: 10px; transition: background 0.2s;">
          ${continueBtnText}
        </button>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#stock-limit-cluster-act')?.addEventListener('click', () => {
      overlay.remove();
      document.getElementById('marketplace-cart-modal')?.remove();
      
      if (typeof window.openArtisanClusterFeature === 'function') {
        window.openArtisanClusterFeature(product, requestedUnits, product.craft_type || product.category);
      } else {
        const clusterNavBtn = document.querySelector('[data-buyer-nav="orders"]');
        if (clusterNavBtn) clusterNavBtn.click();
      }

      if (typeof window.showToast === 'function') {
        window.showToast(`✨ Switched to Artisan Cluster Feature for ${requestedUnits} units of ${product.title || product.name || 'product'}!`);
      }
    });

    overlay.querySelector('#stock-limit-continue-act')?.addEventListener('click', () => {
      overlay.remove();
      const cartItem = this.cart.find(i => i.product.id === product.id);
      if (cartItem) {
        cartItem.quantity = maxStock;
        this.saveCart();
        this.updateCartCount();
        this.renderProducts();
        this.renderCartModal();
      }
      if (typeof window.showToast === 'function') {
        window.showToast(`Quantity set to available single artisan stock limit (${maxStock} units).`);
      }
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  isInCart(productId) {
    if (!productId) return false;
    return this.cart.some(item => String(item.product.id) === String(productId) || Number(item.product.id) === Number(productId));
  }

  addToCart(productId, openModal = false, qty = 1) {
    const product = SAMPLE_PRODUCTS.find(item => String(item.id) === String(productId) || Number(item.id) === Number(productId));
    if (!product) return;
    const maxStock = this.getMaxStock(product);
    const existing = this.cart.find(item => String(item.product.id) === String(productId) || Number(item.product.id) === Number(productId));
    const currentQty = existing ? existing.quantity : 0;
    const targetQty = currentQty + qty;

    if (targetQty > maxStock) {
      const requestedUnits = Math.max(targetQty, 120);
      this.showStockLimitReachedModal(product, requestedUnits, maxStock);
      return;
    }

    if (existing) {
      existing.quantity = targetQty;
    } else {
      this.cart.push({ product, quantity: targetQty });
    }
    this.saveCart();
    this.updateCartCount();
    this.renderProducts();
    this.showToastMessage('Product is successfully added to cart!', product.title);
    if (openModal) {
      this.renderCartModal();
    }
  }

  updateQuantity(productId, delta) {
    const index = this.cart.findIndex(item => String(item.product.id) === String(productId) || Number(item.product.id) === Number(productId));
    if (index === -1) return;

    if (delta > 0) {
      const maxStock = this.getMaxStock(this.cart[index].product);
      if (this.cart[index].quantity + delta > maxStock) {
        const requestedUnits = Math.max(this.cart[index].quantity + delta, 120);
        this.showStockLimitReachedModal(this.cart[index].product, requestedUnits, maxStock);
        return;
      }
    }

    this.cart[index].quantity += delta;
    if (this.cart[index].quantity <= 0) {
      const name = this.cart[index].product.title;
      this.cart.splice(index, 1);
      this.showToastMessage(`Removed "${name}" from cart.`);
    }
    this.saveCart();
    this.updateCartCount();
    this.renderProducts();
    this.renderCartModal();
  }

  removeFromCart(productId) {
    const index = this.cart.findIndex(item => String(item.product.id) === String(productId) || Number(item.product.id) === Number(productId));
    if (index === -1) return;
    const name = this.cart[index].product.title;
    this.cart.splice(index, 1);
    this.saveCart();
    this.updateCartCount();
    this.renderProducts();
    this.showToastMessage(`Removed "${name}" from cart.`);
    this.renderCartModal();
  }

  renderCartModal() {
    document.getElementById('marketplace-cart-modal')?.remove();
    this.container?.querySelector('#marketplace-cart-modal')?.remove();

    const totalItems = this.cart.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = this.cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

    const modal = document.createElement('div');
    modal.id = 'marketplace-cart-modal';
    modal.className = 'marketplace-cart-modal';
    modal.innerHTML = `
      <div class="marketplace-cart-sheet" role="dialog" aria-modal="true" aria-label="Shopping Cart">
        <div class="modal-head">
          <div>
            <h3>🛒 Shopping Cart</h3>
            <span class="cart-subtitle">${totalItems} ${totalItems === 1 ? 'item' : 'items'} in your cart</span>
          </div>
          <button type="button" class="cart-close-btn" data-cart-close aria-label="Close cart">✕</button>
        </div>

        <div class="marketplace-cart-body">
          ${this.cart.length === 0 ? `
            <div class="cart-empty-state">
              <div class="cart-empty-icon">🛒</div>
              <h4>Your cart is empty</h4>
              <p>Discover authentic Indian crafts and add products to your cart.</p>
              <button type="button" class="primary-btn" data-cart-close style="margin-top: 14px;">Explore Products</button>
            </div>
          ` : `
            <div class="marketplace-cart-items">
              ${this.cart.map(item => `
                <div class="marketplace-cart-item-card" data-cart-item-id="${item.product.id}">
                  <img src="${getProductImage(item.product.id)}" alt="${item.product.title}" class="cart-item-img" />
                  
                  <div class="cart-item-details">
                    <span class="cart-item-category">${item.product.craft_type}</span>
                    <h4 class="cart-item-title">${item.product.title}</h4>
                    <span class="cart-item-location">📍 ${item.product.location_city || 'Artisan Hub'}</span>
                    <div class="cart-item-unit-price">Price: <strong>₹${item.product.price.toLocaleString('en-IN')}</strong> / unit</div>
                  </div>

                  <div class="cart-item-actions-col">
                    <div class="cart-item-qty-control">
                      <button type="button" class="qty-btn qty-minus" data-cart-qty-dec="${item.product.id}" aria-label="Decrease quantity">-</button>
                      <span class="qty-display">${item.quantity}</span>
                      <button type="button" class="qty-btn qty-plus" data-cart-qty-inc="${item.product.id}" aria-label="Increase quantity">+</button>
                    </div>

                    <div class="cart-item-line-total">
                      ₹${(item.quantity * item.product.price).toLocaleString('en-IN')}
                    </div>

                    <button type="button" class="cart-remove-item-btn" data-cart-remove="${item.product.id}">
                      🗑️ Remove
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>

            <div class="cart-summary-section">
              <div class="summary-line">
                <span>Subtotal (${totalItems} items):</span>
                <strong>₹${subtotal.toLocaleString('en-IN')}</strong>
              </div>
              <div class="summary-line">
                <span>Direct Artisan Delivery:</span>
                <span class="free-shipping-tag">FREE</span>
              </div>
              <div class="summary-line total-bill-line">
                <span>Total Bill Amount:</span>
                <strong class="total-bill-val">₹${subtotal.toLocaleString('en-IN')}</strong>
              </div>
            </div>

            <div class="cart-checkout-actions">
              <button type="button" class="primary-btn proceed-to-buy-btn" data-cart-proceed-buy>
                ⚡ Proceed to Buy (${totalItems} ${totalItems === 1 ? 'item' : 'items'}) — ₹${subtotal.toLocaleString('en-IN')}
              </button>
              <button type="button" class="secondary-btn quote-cart-btn" data-cart-quote-all>
                📋 Request Wholesale Quote
              </button>
            </div>
          `}
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelectorAll('[data-cart-close]').forEach(btn => {
      btn.addEventListener('click', () => modal.remove());
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    modal.querySelectorAll('[data-cart-qty-dec]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.cartQtyDec);
        this.updateQuantity(id, -1);
      });
    });

    modal.querySelectorAll('[data-cart-qty-inc]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.cartQtyInc);
        this.updateQuantity(id, 1);
      });
    });

    modal.querySelectorAll('[data-cart-remove]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.cartRemove);
        this.removeFromCart(id);
      });
    });

    modal.querySelector('[data-cart-proceed-buy]')?.addEventListener('click', () => {
      modal.remove();
      if (!this.cart.length) return;
      const firstItem = this.cart[0];
      const combinedTitle = this.cart.length > 1 
        ? `${firstItem.product.title} + ${this.cart.length - 1} other item(s)`
        : firstItem.product.title;
      
      const orderPayload = {
        id: `cart-order-${Date.now()}`,
        title: combinedTitle,
        price: subtotal,
        available: 100,
        cartItems: [...this.cart]
      };

      if (typeof window.openRazorpayPayment === 'function') {
        window.openRazorpayPayment(orderPayload, 1);
      } else {
        document.dispatchEvent(new CustomEvent('marketplace-buy-now', { 
          detail: { product: orderPayload, quantity: 1 } 
        }));
      }
    });

    modal.querySelector('[data-cart-quote-all]')?.addEventListener('click', () => {
      modal.remove();
      const firstItem = this.cart[0]?.product;
      if (firstItem) {
        this.selectedProduct = firstItem;
        this.renderModal();
      }
    });
  }

  renderQuoteModal() {
    if (!this.selectedProduct) return '';
    
    const totalValue = this.quoteQty * this.selectedProduct.price;
    const formattedValue = totalValue.toLocaleString('en-IN');
    
    return `
      <div class="modal-backdrop" id="modal-backdrop">
        <div class="quote-modal">
          <div class="modal-head">
            <h3>Request Wholesale Quote</h3>
            <button id="btn-close-modal">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div class="modal-box">
            <strong>${this.selectedProduct.title}</strong>
            <span>
              Base Rate: ₹${this.selectedProduct.price}/unit • Fast Fulfillment
              Available
            </span>
          </div>

          <form id="quote-form" class="quote-form">
            <label>
              Required Quantity (Units)
              <input type="number" id="quote-qty-input" min="10" max="5000" value="${this.quoteQty}" />
            </label>

            <label>
              Target Delivery Location
              <input type="text" id="quote-location" value="Hyderabad, Telangana" />
            </label>

            <div class="quote-summary">
              <span>Estimated Contract Value:</span>
              <strong id="contract-value">₹${formattedValue}</strong>
            </div>

            <div class="modal-actions">
              <button type="button" class="secondary-btn" id="btn-cancel-quote">
                Cancel
              </button>
              <button type="submit" class="primary-btn">
                Submit Quote Request
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  setupEventListeners() {
    // Category selection
    this.container.addEventListener('click', (e) => {
      const categoryCard = e.target.closest('.category-card');
      if (categoryCard) {
        const categoryId = categoryCard.dataset.categoryId;
        if (categoryId === 'all') {
          this.selectedCategory = null;
        } else {
          const categoryName = categoryCard.dataset.categoryName;
          this.selectedCategory = CRAFT_CATEGORIES.find(c => c.id == categoryId);
        }
        this.render();
        this.setupEventListeners();
        this.renderProducts();
      }
    });

    // Clear filter
    const clearBtn = this.container.querySelector('#btn-clear-filter');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.selectedCategory = null;
        this.render();
        this.setupEventListeners();
        this.renderProducts();
      });
    }

    // Search
    const searchInput = this.container.querySelector('#marketplace-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        const homeSearch = document.getElementById('buyer-home-search');
        if (homeSearch && homeSearch.value !== e.target.value) {
          homeSearch.value = e.target.value;
        }
        this.renderProducts();
      });
    }

    // Close filter from pill
    const closeFilterBtn = this.container.querySelector('#btn-close-filter');
    if (closeFilterBtn) {
      closeFilterBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectedCategory = null;
        this.render();
        this.setupEventListeners();
        this.renderProducts();
      });
    }

    // Close search filter pill
    const closeSearchFilterBtn = this.container.querySelector('#btn-close-search-filter');
    if (closeSearchFilterBtn) {
      closeSearchFilterBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.setSearchQuery('');
        const homeSearch = document.getElementById('buyer-home-search');
        if (homeSearch) homeSearch.value = '';
      });
    }

    // Product actions
    this.container.addEventListener('click', (e) => {
      const cartBtn = e.target.closest('button[data-cart-product-id]');
      if (cartBtn) {
        this.addToCart(cartBtn.dataset.cartProductId);
        return;
      }
      const quoteBtn = e.target.closest('button[data-product-id]');
      if (quoteBtn) {
        const productId = quoteBtn.dataset.productId;
        this.selectedProduct = SAMPLE_PRODUCTS.find(p => String(p.id) === String(productId) || Number(p.id) === Number(productId));
        this.quoteQty = 100;
        this.renderModal();
        return;
      }
      const productCard = e.target.closest('[data-marketplace-product-id]');
      if (productCard) {
        const pId = productCard.dataset.marketplaceProductId;
        document.dispatchEvent(new CustomEvent('marketplace-product-open', { detail: { productId: pId } }));
      }
    });

    // Modal actions
    this.setupModalListeners();

    this.container.querySelector('#btn-open-cart')?.addEventListener('click', () => this.renderCartModal());
    
    // Post requirement button
    const postBtn = this.container.querySelector('#btn-post-requirement');
    if (postBtn) {
      postBtn.addEventListener('click', () => {
        alert('Post your bulk requirement and find matching artisans!');
      });
    }

    // Initial product render
    this.renderProducts();
  }

  setupModalListeners() {
    const backdrop = this.container.querySelector('#modal-backdrop');
    if (!backdrop) return;

    const closeBtn = backdrop.querySelector('#btn-close-modal');
    const cancelBtn = backdrop.querySelector('#btn-cancel-quote');
    const form = backdrop.querySelector('#form-quote');
    const qtyInput = backdrop.querySelector('#quote-qty-input');
    const form2 = backdrop.querySelector('#quote-form');

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.selectedProduct = null;
        this.render();
        this.setupEventListeners();
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.selectedProduct = null;
        this.render();
        this.setupEventListeners();
      });
    }

    if (backdrop) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          this.selectedProduct = null;
          this.render();
          this.setupEventListeners();
        }
      });
    }

    if (qtyInput) {
      qtyInput.addEventListener('change', () => {
        this.quoteQty = parseInt(qtyInput.value) || 100;
        const contractValue = this.container.querySelector('#contract-value');
        if (contractValue) {
          const total = this.quoteQty * this.selectedProduct.price;
          contractValue.textContent = `₹${total.toLocaleString('en-IN')}`;
        }
      });
    }

    if (form2) {
      form2.addEventListener('submit', (e) => {
        e.preventDefault();
        const location = this.container.querySelector('#quote-location').value;
        alert(
          `Quote request for ${this.quoteQty} units sent successfully for ${this.selectedProduct?.title}.\n\nDelivery Location: ${location}`
        );
        this.selectedProduct = null;
        this.render();
        this.setupEventListeners();
      });
    }
  }

  renderModal() {
    this.render();
    this.setupEventListeners();
  }

  cleanSearchString(str) {
    if (!str) return '';
    return str
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?'"“”]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  setSearchQuery(query) {
    const raw = query || '';
    const cleaned = this.cleanSearchString(raw);
    this.searchQuery = cleaned;

    // If a category filter is active that does not match the search query, clear it so all matching products across categories are found
    if (this.selectedCategory && cleaned) {
      const catName = this.selectedCategory.name.toLowerCase();
      const catMatches = catName.includes(cleaned) || cleaned.includes(catName.split(' ')[0].toLowerCase());
      if (!catMatches) {
        this.selectedCategory = null;
      }
    }
    this.render();
    this.setupEventListeners();
    const searchInput = this.container?.querySelector('#marketplace-search');
    if (searchInput) {
      searchInput.value = raw;
    }
    this.renderProducts();
  }

  getFilteredProducts() {
    deduplicateSampleProducts();
    const rawQuery = (this.searchQuery || '').trim();
    const cleanQuery = this.cleanSearchString(rawQuery);

    let rawMatches = [];

    if (!cleanQuery) {
      rawMatches = SAMPLE_PRODUCTS.filter((product) => {
        return !this.selectedCategory || product.craft_type === this.selectedCategory.name;
      });
    } else {
      // Common term synonyms & category mapping
      const termSynonyms = {
        'basket': ['basket', 'baskets', 'bamboo', 'cane', 'box', 'hamper'],
        'baskets': ['basket', 'baskets', 'bamboo', 'cane', 'box', 'hamper'],
        'буట్ట': ['basket', 'bamboo', 'cane'],
        'బాస్కెట్': ['basket', 'bamboo', 'cane'],
        'टोकरी': ['basket', 'bamboo', 'cane'],
        'बास्केट': ['basket', 'bamboo', 'cane'],
        'saree': ['saree', 'sari', 'silk', 'handloom', 'banarasi', 'dress', 'textile'],
        'sarees': ['saree', 'sari', 'silk', 'handloom', 'banarasi', 'dress', 'textile'],
        'pot': ['pot', 'pots', 'pottery', 'terracotta', 'clay', 'jug', 'diya', 'planter'],
        'pots': ['pot', 'pots', 'pottery', 'terracotta', 'clay', 'jug', 'diya', 'planter'],
        'pottery': ['pot', 'pots', 'pottery', 'terracotta', 'clay'],
        'toy': ['toy', 'toys', 'wooden', 'doll', 'dolls'],
        'toys': ['toy', 'toys', 'wooden', 'doll', 'dolls'],
        'wood': ['wood', 'wooden', 'carving', 'carved', 'furniture', 'teak'],
        'wooden': ['wood', 'wooden', 'carving', 'carved', 'furniture', 'teak']
      };

      const stopWords = new Set([
        'show', 'me', 'find', 'i', 'want', 'looking', 'for', 'a', 'an', 'the', 'some',
        'products', 'product', 'items', 'item', 'crafts', 'craft', 'please', 'give', 'get',
        'gives', 'need', 'needs', 'any', 'all', 'like', 'with', 'in'
      ]);

      const words = cleanQuery.split(' ').filter(w => w.length > 0);
      const keyWords = words.filter(w => !stopWords.has(w));
      const searchWords = keyWords.length > 0 ? keyWords : words;

      rawMatches = SAMPLE_PRODUCTS.filter((product) => {
        const categoryMatch =
          !this.selectedCategory || product.craft_type === this.selectedCategory.name;

        const title = (product.title || '').toLowerCase();
        const craft = (product.craft_type || '').toLowerCase();
        const desc = (product.description || '').toLowerCase();
        const city = (product.location_city || '').toLowerCase();
        const fullText = `${title} ${craft} ${desc} ${city}`;

        // 1. Direct exact or substring match of full clean query
        if (fullText.includes(cleanQuery)) {
          return categoryMatch;
        }

        // 2. Tokenized & stemmed & synonym match
        const wordMatch = searchWords.some(word => {
          if (fullText.includes(word)) return true;

          // Singular check (e.g., "baskets" -> "basket")
          if (word.endsWith('s') && word.length > 2 && fullText.includes(word.slice(0, -1))) return true;

          // Plural check (e.g., "basket" -> "baskets")
          if (fullText.includes(word + 's')) return true;

          // Synonym match
          const syns = termSynonyms[word];
          if (syns && syns.some(syn => fullText.includes(syn))) return true;

          return false;
        });

        return categoryMatch && wordMatch;
      });
    }

    // Deduplicate results by ID and by title
    const seenIds = new Set();
    const seenTitles = new Set();
    const deduped = [];
    for (const p of rawMatches) {
      const idKey = String(p.id);
      const titleKey = (p.title || '').trim().toLowerCase();
      if (!seenIds.has(idKey) && !seenTitles.has(titleKey)) {
        seenIds.add(idKey);
        seenTitles.add(titleKey);
        deduped.push(p);
      }
    }

    return deduped;
  }

  renderProducts() {
    const grid = this.container.querySelector('#marketplace-product-grid');
    const countEl = this.container.querySelector('#product-count');
    const products = this.getFilteredProducts();

    if (countEl) {
      countEl.textContent = products.length;
    }

    if (!grid) return;

    if (products.length === 0) {
      grid.innerHTML = `
        <div class="marketplace-empty-search" style="grid-column: 1 / -1; text-align: center; padding: 48px 20px; background: #fff; border-radius: 16px; border: 1.5px dashed #d1c7bd;">
          <div style="font-size: 2.5rem; margin-bottom: 12px;">🔍</div>
          <h3 style="font-size: 1.2rem; color: #3b2314; margin: 0 0 8px;">No products found for "${this.searchQuery}"</h3>
          <p style="color: #7c6f64; margin: 0 0 20px; font-size: 0.95rem;">Try searching for "bamboo", "saree", "brass", "pottery", "wood", or browse all craft categories.</p>
          <button type="button" class="primary-btn" id="btn-empty-reset" style="display: inline-block;">View All Products</button>
        </div>
      `;
      grid.querySelector('#btn-empty-reset')?.addEventListener('click', () => {
        this.selectedCategory = null;
        this.setSearchQuery('');
        const homeSearch = document.getElementById('buyer-home-search');
        if (homeSearch) homeSearch.value = '';
      });
      return;
    }

    grid.innerHTML = products.map(product => {
      const inCart = this.isInCart(product.id);
      const currentLang = localStorage.getItem('kala-mitra-language') || 'English';
      let cartBtnText = inCart ? '🛒 Go to Cart' : '🛒 Add to Cart';
      if (currentLang === 'Telugu') {
        cartBtnText = inCart ? '🛒 కార్ట్‌కు వెళ్లండి' : '🛒 కార్ట్‌కు జోడించండి';
      } else if (currentLang === 'Hindi') {
        cartBtnText = inCart ? '🛒 कार्ट पर जाएं' : '🛒 कार्ट में जोड़ें';
      }

      const cartBtnStyle = inCart
        ? 'background: linear-gradient(135deg, #f59e0b, #d97706); color: #fff; font-weight: 700;'
        : 'background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #fff; font-weight: 700;';

      return `
        <article class="product-card" data-marketplace-product-id="${product.id}">
          <div class="product-image product-image--clickable">
            <img src="${product.imageUrl || getProductImage(product.id)}" alt="${product.title}" />
            <span class="chip">${product.craft_type}</span>
            ${product.is_artisan_added ? '<span class="chip" style="left: auto; right: 12px; background: linear-gradient(135deg, #10b981, #059669); color: #fff; font-weight: 700; box-shadow: 0 2px 6px rgba(4,120,87,0.3);">✨ Artisan Direct</span>' : `<span class="demand-chip">★ ${product.demand_score}/100 Demand</span>`}
          </div>

          <div class="product-content">
            <div class="meta-row">
              <span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                ${product.location_city}
              </span>
              <span>Cap: ${product.monthly_capacity}u/mo</span>
            </div>

            <h3 class="product-title--clickable">${product.title}</h3>
            <p>${product.description}</p>

            <div class="price-row">
              <div>
                <small>Wholesale Price</small>
                <strong>₹${product.price}</strong>
              </div>
              <div>
                <small>Lead Time</small>
                <strong>${product.lead_time_days} days</strong>
              </div>
            </div>
          </div>

          <div class="product-actions">
            <button class="primary-btn small razorpay-buy-btn" data-buy-now-id="${product.id}" type="button" style="background: linear-gradient(135deg, #9333ea, #7e22ce); color: #fff; font-weight: 700;">⚡ Buy Now</button>
            <button class="primary-btn small add-to-cart-btn ${inCart ? 'in-cart' : ''}" data-cart-product-id="${product.id}" type="button" style="${cartBtnStyle}">${cartBtnText}</button>
            <button class="secondary-btn small" data-product-id="${product.id}">
              Quote
            </button>
          </div>
        </article>
      `;
    }).join('');

    grid.querySelectorAll('button[data-buy-now-id]').forEach(button => {
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        const productId = button.dataset.buyNowId;
        const product = SAMPLE_PRODUCTS.find(p => String(p.id) === String(productId) || Number(p.id) === Number(productId));
        if (product && typeof window.openRazorpayPayment === 'function') {
          window.openRazorpayPayment(product, 1);
        } else if (product) {
          document.dispatchEvent(new CustomEvent('marketplace-buy-now', { detail: { product, quantity: 1 } }));
        }
      });
    });

    grid.querySelectorAll('button[data-cart-product-id]').forEach(button => {
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        const productId = button.dataset.cartProductId;
        if (this.isInCart(productId)) {
          this.renderCartModal();
        } else {
          this.addToCart(productId);
        }
      });
    });

    if (typeof window.translateBuyerExperience === 'function') {
      window.translateBuyerExperience();
    }
  }
}
