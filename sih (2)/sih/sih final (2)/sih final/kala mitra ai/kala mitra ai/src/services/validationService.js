/**
 * KALA-MITRA Validation Service
 * Validates Phone numbers (Indian standard), Emails, OTP codes, and Profile inputs.
 */

export const ValidationService = {
  /**
   * Normalize and validate Indian Phone Numbers.
   * Accepts 10 digits starting with 6, 7, 8, or 9.
   * Handles optional country code (+91 or 91), dashes, spaces, and parentheses.
   * @param {string} rawPhone
   * @returns {{ isValid: boolean, formatted: string, raw: string, error?: string }}
   */
  validatePhoneNumber(rawPhone) {
    if (!rawPhone || typeof rawPhone !== 'string') {
      return { isValid: false, formatted: '', raw: '', error: 'Please enter your mobile number.' };
    }

    // Strip non-digits
    const cleanDigits = rawPhone.replace(/\D/g, '');

    let normalizedDigits = cleanDigits;
    // Strip leading 91 or 0 if present and total length is 12 or 11
    if (cleanDigits.length === 12 && cleanDigits.startsWith('91')) {
      normalizedDigits = cleanDigits.substring(2);
    } else if (cleanDigits.length === 11 && cleanDigits.startsWith('0')) {
      normalizedDigits = cleanDigits.substring(1);
    }

    if (normalizedDigits.length === 0) {
      return { isValid: false, formatted: '', raw: '', error: 'Please enter your mobile number.' };
    }

    if (normalizedDigits.length !== 10) {
      return { isValid: false, formatted: '', raw: normalizedDigits, error: 'Mobile number must be exactly 10 digits.' };
    }

    // Check standard Indian telecom starting digit (6, 7, 8, 9)
    if (!/^[6-9]\d{9}$/.test(normalizedDigits)) {
      return { isValid: false, formatted: '', raw: normalizedDigits, error: 'Please enter a valid 10-digit Indian mobile number.' };
    }

    const formatted = `+91 ${normalizedDigits.substring(0, 5)} ${normalizedDigits.substring(5)}`;
    return { isValid: true, formatted, raw: normalizedDigits };
  },

  /**
   * Validate Email format
   * @param {string} email
   * @returns {{ isValid: boolean, email: string, error?: string }}
   */
  validateEmail(email) {
    if (!email || typeof email !== 'string' || !email.trim()) {
      return { isValid: false, email: '', error: 'Please enter your email address.' };
    }

    const trimmed = email.trim().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    
    if (!emailRegex.test(trimmed)) {
      return { isValid: false, email: trimmed, error: 'Please enter a valid email address.' };
    }

    return { isValid: true, email: trimmed };
  },

  /**
   * Validate 6-digit OTP
   * @param {string} otp
   * @returns {{ isValid: boolean, error?: string }}
   */
  validateOtp(otp) {
    if (!otp || typeof otp !== 'string') {
      return { isValid: false, error: 'Please enter the 6-digit verification code.' };
    }

    const clean = otp.trim();
    if (clean.length < 6) {
      return { isValid: false, error: 'Please enter all 6 digits of the code.' };
    }

    if (!/^\d{6}$/.test(clean)) {
      return { isValid: false, error: 'The code must contain only numbers.' };
    }

    return { isValid: true };
  },

  /**
   * Validate Profile Setup fields
   * @param {object} data
   * @param {'Artisan' | 'Buyer'} role
   * @returns {{ isValid: boolean, error?: string }}
   */
  validateProfile(data, role) {
    if (!data.name || !data.name.trim()) {
      return { 
        isValid: false, 
        error: 'Please enter your full name.' 
      };
    }

    if (role === 'Artisan') {
      if (!data.craftType || !data.craftType.trim()) {
        return { isValid: false, error: 'Please select or enter your craft type.' };
      }
    }

    if (!data.location || !data.location.trim()) {
      return { isValid: false, error: 'Please enter your location (District & State).' };
    }

    if (!data.preferredLanguage) {
      return { isValid: false, error: 'Please select your preferred language.' };
    }

    return { isValid: true };
  },

  /**
   * Validate Artisan Product fields
   * @param {object} data
   * @returns {{ isValid: boolean, error?: string, errors?: Record<string, string> }}
   */
  validateProduct(data) {
    const errors = {};

    // 1. Product Name
    if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
      errors.name = 'Product name is required.';
    } else if (data.name.trim().length < 2) {
      errors.name = 'Product name must be at least 2 characters.';
    }

    // 2. Category
    if (!data.category || typeof data.category !== 'string' || !data.category.trim()) {
      errors.category = 'Please select a category.';
    } else if (data.category === 'Other' && (!data.customCategory || !data.customCategory.trim())) {
      errors.category = 'Please enter your custom category name.';
    }

    // 3. Material
    if (!data.material || typeof data.material !== 'string' || !data.material.trim()) {
      errors.material = 'Please specify the craft material (e.g. Natural Bamboo, Clay, Cotton).';
    }

    // 4. Description
    if (!data.description || typeof data.description !== 'string' || !data.description.trim()) {
      errors.description = 'Please provide a product description.';
    } else if (data.description.trim().length < 8) {
      errors.description = 'Description should be at least 8 characters to help buyers understand your craft.';
    }

    // 5. Price
    const priceNum = Number(data.price);
    if (isNaN(priceNum) || data.price === '' || priceNum <= 0) {
      errors.price = 'Price must be a valid amount greater than ₹0.';
    }

    // 6. Available Quantity
    const qtyNum = Number(data.availableQuantity);
    if (isNaN(qtyNum) || data.availableQuantity === '' || qtyNum < 0 || !Number.isInteger(qtyNum)) {
      errors.availableQuantity = 'Available quantity must be 0 or a positive whole number.';
    }

    // 7. Production Capacity
    const capacityNum = Number(data.productionCapacity);
    if (isNaN(capacityNum) || data.productionCapacity === '' || capacityNum <= 0) {
      errors.productionCapacity = 'Production capacity must be greater than 0 units per month.';
    }

    // 8. Production Time (Days)
    const timeNum = Number(data.productionTimeDays);
    if (isNaN(timeNum) || data.productionTimeDays === '' || timeNum <= 0) {
      errors.productionTimeDays = 'Production time must be at least 1 day.';
    }

    // 9. Location
    if (!data.location || typeof data.location !== 'string' || !data.location.trim()) {
      errors.location = 'Craft origin/location is required (e.g. District, State).';
    }

    const firstError = Object.values(errors)[0];
    return {
      isValid: Object.keys(errors).length === 0,
      error: firstError,
      errors
    };
  },

  /**
   * Validate Artisan Capacity fields
   * @param {object} data
   * @returns {{ isValid: boolean, error?: string, errors?: Record<string, string> }}
   */
  validateCapacity(data) {
    const errors = {};

    // 1. Available Stock (Ready Units)
    if (data.availableStock === undefined || data.availableStock === null || data.availableStock === '') {
      errors.availableStock = 'Please enter your current ready/available stock.';
    } else {
      const stockNum = Number(data.availableStock);
      if (isNaN(stockNum) || !Number.isInteger(stockNum) || stockNum < 0) {
        errors.availableStock = 'Available stock must be 0 or a positive whole number.';
      }
    }

    // 2. Production Capacity
    if (data.productionCapacity === undefined || data.productionCapacity === null || data.productionCapacity === '') {
      errors.productionCapacity = 'Please enter how many units you can make.';
    } else {
      const capNum = Number(data.productionCapacity);
      if (isNaN(capNum) || !Number.isInteger(capNum) || capNum <= 0) {
        errors.productionCapacity = 'Production capacity must be a positive number greater than 0.';
      }
    }

    // 3. Production Period
    if (!data.productionPeriod || !['monthly', 'weekly'].includes(data.productionPeriod)) {
      errors.productionPeriod = 'Please select a production period (Weekly or Monthly).';
    }

    // 4. Production Time (Days)
    if (data.productionTimeDays === undefined || data.productionTimeDays === null || data.productionTimeDays === '') {
      errors.productionTimeDays = 'Please enter your standard production time in days.';
    } else {
      const timeNum = Number(data.productionTimeDays);
      if (isNaN(timeNum) || !Number.isInteger(timeNum) || timeNum <= 0) {
        errors.productionTimeDays = 'Production time must be at least 1 day.';
      } else if (timeNum > 365) {
        errors.productionTimeDays = 'Production time cannot exceed 365 days.';
      }
    }

    // 5. Location
    if (!data.locationName || typeof data.locationName !== 'string' || !data.locationName.trim()) {
      errors.locationName = 'Please enter your workshop location (City, State).';
    }

    // 6. Availability Status
    if (!data.availabilityStatus || !['available', 'limited', 'unavailable'].includes(data.availabilityStatus)) {
      errors.availabilityStatus = 'Please select your current availability status.';
    }

    const firstError = Object.values(errors)[0];
    return {
      isValid: Object.keys(errors).length === 0,
      error: firstError,
      errors
    };
  }
};

