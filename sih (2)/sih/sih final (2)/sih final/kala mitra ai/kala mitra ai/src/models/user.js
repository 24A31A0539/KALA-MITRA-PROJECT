/**
 * KALA-MITRA User Model
 */

export class User {
  constructor({
    id = null,
    role = 'Artisan', // 'Artisan' | 'Buyer'
    phone = null,
    email = null,
    name = '',
    craftType = '',
    businessType = '',
    location = '',
    preferredLanguage = 'English', // 'English' | 'Telugu' | 'Hindi'
    isVerified = false,
    isProfileComplete = false,
    createdAt = new Date().toISOString()
  } = {}) {
    this.id = id || `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.role = role;
    this.phone = phone;
    this.email = email;
    this.name = name;
    this.craftType = craftType;
    this.businessType = businessType;
    this.location = location;
    this.preferredLanguage = preferredLanguage;
    this.isVerified = Boolean(isVerified);
    this.isProfileComplete = Boolean(isProfileComplete);
    this.createdAt = createdAt;
  }

  toJSON() {
    return {
      id: this.id,
      role: this.role,
      phone: this.phone,
      email: this.email,
      name: this.name,
      craftType: this.craftType,
      businessType: this.businessType,
      location: this.location,
      preferredLanguage: this.preferredLanguage,
      isVerified: this.isVerified,
      isProfileComplete: this.isProfileComplete,
      createdAt: this.createdAt
    };
  }

  static fromJSON(json) {
    if (!json) return null;
    return new User(json);
  }
}
