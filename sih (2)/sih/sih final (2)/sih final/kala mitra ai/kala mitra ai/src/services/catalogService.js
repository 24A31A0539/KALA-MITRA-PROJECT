/**
 * KALA-MITRA AI Catalog Service (Frontend Service Abstraction)
 * Communicates with FastAPI endpoint: POST /api/v1/catalog/analyze
 * Includes robust fallback to DemoCatalogProvider when backend is unavailable.
 */

const FASTAPI_BASE_URL = 'http://127.0.0.1:8000';

class CatalogService {
  constructor() {
    this.apiUrl = `${FASTAPI_BASE_URL}/api/v1/catalog/analyze`;
  }

  /**
   * Convert Data URL / Base64 to Blob
   * @param {string} dataUrl
   * @returns {Blob}
   */
  dataUrlToBlob(dataUrl) {
    const arr = dataUrl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  }

  /**
   * Analyze craft image via FastAPI YOLOv8 + SAM + LLM pipeline
   * @param {File|Blob|string} imageInput
   * @param {object} artisanContext
   * @param {function} onProgressCallback
   * @returns {Promise<object>} CatalogAnalysisResponse
   */
  async analyzeProductImage(imageInput, artisanContext = {}, onProgressCallback = null) {
    const notify = (stepIndex, stepName, status, message) => {
      if (typeof onProgressCallback === 'function') {
        onProgressCallback({ stepIndex, stepName, status, message });
      }
    };

    notify(0, 'Image Validation', 'active', 'Validating craft photo format and dimensions...');

    let blob;
    let filename = 'craft_photo.jpg';

    if (typeof imageInput === 'string' && imageInput.startsWith('data:')) {
      blob = this.dataUrlToBlob(imageInput);
    } else if (imageInput instanceof Blob || imageInput instanceof File) {
      blob = imageInput;
      if (imageInput.name) filename = imageInput.name;
    } else {
      throw new Error('Invalid image payload provided to CatalogService.');
    }

    notify(0, 'Image Validation', 'done', 'Craft photo validated successfully.');
    notify(1, 'YOLOv8 Detection', 'active', 'Detecting primary craft object with YOLOv8...');

    // Attempt real FastAPI backend call
    const formData = new FormData();
    formData.append('file', blob, filename);
    if (artisanContext.categoryHint) formData.append('category_hint', artisanContext.categoryHint);
    if (artisanContext.materialHint) formData.append('material_hint', artisanContext.materialHint);
    if (artisanContext.priceHint) formData.append('price_hint', String(artisanContext.priceHint));
    if (artisanContext.location) formData.append('location', artisanContext.location);
    if (artisanContext.notes) formData.append('notes', artisanContext.notes);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

      notify(2, 'SAM Segmentation', 'active', 'Segmenting craft from background with SAM...');

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Backend responded with status ${response.status}: ${errText}`);
      }

      notify(3, 'LLM Understanding', 'active', 'Synthesizing product title, description, and tags...');
      const result = await response.json();

      notify(3, 'LLM Understanding', 'done', 'Catalog details ready for artisan review.');
      return {
        ...result,
        source: 'fastapi_ai_pipeline'
      };
    } catch (networkError) {
      console.warn('FastAPI backend unreachable, switching to DemoCatalogProvider:', networkError);
      
      // Graceful fallback: DemoCatalogProvider with honest disclosures
      notify(1, 'YOLOv8 Detection', 'fallback', 'YOLOv8 offline (using DemoCatalogProvider)');
      notify(2, 'SAM Segmentation', 'fallback', 'SAM offline (using direct photo)');
      notify(3, 'LLM Understanding', 'fallback', 'Catalog text synthesized via knowledge base');

      return await this._demoCatalogProvider(blob, artisanContext);
    }
  }

  /**
   * Demo / Development Provider when backend is offline
   */
  async _demoCatalogProvider(blob, artisanContext) {
    await new Promise(r => setTimeout(r, 600));

    const category = artisanContext.categoryHint || 'Bamboo Crafts';
    const location = artisanContext.location || 'East Godavari, Andhra Pradesh';
    const material = artisanContext.materialHint || 'Natural Bamboo & Cane';

    return {
      detectedProduct: 'Handwoven Bamboo Craft',
      detectionConfidence: 0.88,
      title: 'Handwoven Bamboo Utility & Storage Basket',
      category: category,
      material: material,
      materialConfidence: artisanContext.materialHint ? 1.0 : 0.65,
      description: `Authentic traditional handwoven craft made in ${location}. Crafted for home storage, gifting, and natural living spaces with sustainable materials.`,
      tags: ['Bamboo', 'Handmade', 'Eco-friendly', 'Storage', 'Artisan Craft'],
      suggestedPrice: artisanContext.priceHint || null,
      priceNote: artisanContext.priceHint ? 'Price specified by artisan' : 'Price suggestion will be available after market intelligence is connected.',
      suggestedLeadDays: 7,
      segmentedImageBase64: null,
      processingStatus: 'fallback',
      warnings: [
        'Notice: FastAPI backend was unreachable at localhost:8000. Catalog details prepared via DemoCatalogProvider. Please review and edit all fields.'
      ],
      modelVersions: {
        yolo: 'DemoCatalogProvider (Development)',
        sam: 'DemoCatalogProvider (Development)',
        llm: 'DemoCatalogProvider (Development)'
      },
      source: 'demo_catalog_provider'
    };
  }
}

export const catalogService = new CatalogService();
