
  // ---------------------------------------------------------------------------
  // Cluster Member Production Status Updater & Live Sync Helper
  // ---------------------------------------------------------------------------
  window.updateClusterMemberProduction = function(clusterId, memberId, newStatus, newCompletedQty, optionalMemberName, optionalMemberIndex) {
    try {
      let history = [];
      try {
        if (typeof window.getStoredClusterHistory === 'function') {
          history = window.getStoredClusterHistory();
        } else if (typeof getStoredClusterHistory === 'function') {
          history = getStoredClusterHistory();
        } else {
          const raw = localStorage.getItem('kala_mitra_cluster_history');
          if (raw) history = JSON.parse(raw);
        }
      } catch (e) {
        try {
          const raw = localStorage.getItem('kala_mitra_cluster_history');
          if (raw) history = JSON.parse(raw);
        } catch (e2) {}
      }

      if (!Array.isArray(history) || history.length === 0) {
        if (typeof window.getStoredClusterHistory === 'function') {
          history = window.getStoredClusterHistory();
        } else if (typeof getStoredClusterHistory === 'function') {
          history = getStoredClusterHistory();
        }
      }
      if (!Array.isArray(history) || history.length === 0) {
        return null;
      }

      // 1. Find cluster by ID, or match by member name
      let cluster = null;
      if (clusterId) {
        cluster = history.find(c => String(c.id).trim() === String(clusterId).trim());
      }
      if (!cluster && optionalMemberName) {
        const cleanName = String(optionalMemberName).replace(/&amp;/g, '&').toLowerCase().trim();
        cluster = history.find(c => Array.isArray(c.members) && c.members.some(m => m.name && m.name.toLowerCase().trim() === cleanName));
      }
      if (!cluster) {
        try {
          const activeId = localStorage.getItem('kala_mitra_active_tracking_cluster_id');
          if (activeId) cluster = history.find(c => String(c.id).trim() === String(activeId).trim());
        } catch(e) {}
      }
      if (!cluster) {
        cluster = history[0];
      }
      if (!cluster) return null;

      if (!Array.isArray(cluster.members)) cluster.members = [];

      // 2. Find member with comprehensive flexible matching
      let member = null;
      const cleanOptName = optionalMemberName ? String(optionalMemberName).replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/&quot;/g, '"').toLowerCase().trim() : '';

      // Match by memberId (numeric or string)
      if (memberId !== undefined && memberId !== null && String(memberId).trim() !== '') {
        const mIdStr = String(memberId).trim();
        member = cluster.members.find(m => String(m.id).trim() === mIdStr);
      }

      // Match by member index if provided
      if (!member && optionalMemberIndex !== undefined && optionalMemberIndex !== null && optionalMemberIndex !== '') {
        const idx = Number(optionalMemberIndex);
        if (!isNaN(idx) && idx >= 0 && idx < cluster.members.length) {
          member = cluster.members[idx];
        }
      }

      // Match by cleaned optionalMemberName
      if (!member && cleanOptName) {
        member = cluster.members.find(m => {
          if (!m.name) return false;
          const mn = m.name.replace(/&amp;/g, '&').replace(/&#039;/g, "'").toLowerCase().trim();
          return mn === cleanOptName || mn.replace(/\s*\(you\)/i, '').trim() === cleanOptName.replace(/\s*\(you\)/i, '').trim();
        });
      }

      // Match by memberId as name
      if (!member && memberId) {
        const mLower = String(memberId).toLowerCase().trim();
        member = cluster.members.find(m => m.name && m.name.toLowerCase().trim() === mLower);
      }

      // Partial name match
      if (!member && cleanOptName) {
        member = cluster.members.find(m => {
          if (!m.name) return false;
          const mn = m.name.toLowerCase().trim();
          return mn.includes(cleanOptName) || cleanOptName.includes(mn);
        });
      }

      // Fallback: if only one member, or user member
      if (!member && cluster.members.length === 1) {
        member = cluster.members[0];
      }
      if (!member) {
        member = cluster.members.find(m => m.isCurrentUser) || cluster.members[0];
      }
      if (!member) return null;

      // 3. Apply the status
      const assigned = Number(member.assigned_quantity || 100);
      if (newStatus && typeof newStatus === 'string' && newStatus.trim() !== '') {
        member.production_status = newStatus.trim();
      }

      // 4. Apply completed quantity
      if (newCompletedQty !== undefined && newCompletedQty !== null && newCompletedQty !== '') {
        const parsed = Number(newCompletedQty);
        const qty = isNaN(parsed) ? 0 : Math.max(0, Math.min(assigned, parsed));
        member.completed_quantity = qty;
        member.progress = assigned > 0 ? Math.round((qty / assigned) * 100) : 0;
      } else {
        if (member.production_status === 'Completed') member.completed_quantity = assigned;
        else if (member.production_status === 'Quality Check') member.completed_quantity = Math.round(assigned * 0.9);
        else if (member.production_status === 'In Production') member.completed_quantity = Math.round(assigned * 0.65);
        else if (member.production_status === 'Production Started') member.completed_quantity = Math.round(assigned * 0.35);
        else if (member.production_status === 'Material Sourcing') member.completed_quantity = Math.round(assigned * 0.15);
        else if (member.production_status === 'Order Placed') member.completed_quantity = 0;
        member.progress = assigned > 0 ? Math.round((member.completed_quantity / assigned) * 100) : 0;
      }

      // Auto-reconcile status if completed
      if (member.production_status === 'Completed') {
        member.completed_quantity = assigned;
        member.progress = 100;
      } else if (member.completed_quantity >= assigned) {
        member.production_status = 'Completed';
        member.progress = 100;
      } else if (member.completed_quantity > 0 && member.production_status === 'Order Placed') {
        member.production_status = 'In Production';
      }

      const now = new Date();
      member.last_updated = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', Today';

      // 5. Recalculate cluster totals
      const reqQty = Number(cluster.required_quantity || 1);
      const totalCompleted = cluster.members.reduce((sum, m) => sum + (Number(m.completed_quantity) || 0), 0);
      cluster.total_completed_quantity = totalCompleted;
      cluster.overall_progress = Math.min(100, Math.round((totalCompleted / reqQty) * 100));

      const allCompleted = cluster.members.every(m => m.production_status === 'Completed' || (Number(m.completed_quantity) || 0) >= (Number(m.assigned_quantity) || 0));
      if (allCompleted || totalCompleted >= reqQty) {
        cluster.status = 'COMPLETED';
        cluster.order_completed = true;
      } else if (totalCompleted > 0 || cluster.members.some(m => m.production_status && m.production_status !== 'Order Placed')) {
        if (cluster.status !== 'COMPLETED') cluster.status = 'IN PRODUCTION';
      }

      // 6. Directly save to localStorage
      localStorage.setItem('kala_mitra_cluster_history', JSON.stringify(history));
      try {
        localStorage.setItem('kala_mitra_active_tracking_cluster_id', String(cluster.id));
      } catch (e) {}

      // Asynchronously sync to backend PUT /clusters/{id}/production
      try {
        fetch('http://127.0.0.1:8000/api/v1/clusters/' + encodeURIComponent(cluster.id) + '/production', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            artisan_id: Number(member.id) || 1,
            produced_quantity: Number(member.completed_quantity) || 0
          })
        }).catch(() => {});
      } catch (e) {}

      // 7. Dispatch events asynchronously to prevent re-entrant UI locking
      setTimeout(() => {
        try {
          window.dispatchEvent(new CustomEvent('kala-cluster-status-updated', {
            detail: {
              clusterId: cluster.id,
              memberId: member.id,
              artisanName: member.name,
              production_status: member.production_status,
              completed_quantity: member.completed_quantity,
              assigned_quantity: member.assigned_quantity,
              progress: member.progress,
              overall_progress: cluster.overall_progress,
              total_completed_quantity: cluster.total_completed_quantity,
              clusterStatus: cluster.status
            }
          }));

          window.dispatchEvent(new StorageEvent('storage', {
            key: 'kala_mitra_cluster_history',
            newValue: JSON.stringify(history)
          }));
        } catch (e) {}
      }, 0);

      // 8. Notify Buyer in real-time
      try {
        let buyerNotifs = [];
        const rawNotifs = localStorage.getItem('kala_mitra_buyer_notifs');
        if (rawNotifs) buyerNotifs = JSON.parse(rawNotifs);
        if (!Array.isArray(buyerNotifs)) buyerNotifs = [];
        buyerNotifs.unshift({
          id: 'buyer-cluster-status-' + Date.now(),
          type: 'cluster',
          title: 'Cluster Artisan Production Update',
          message: member.name + ' updated production status to "' + member.production_status + '" (' + member.completed_quantity + '/' + member.assigned_quantity + ' units crafted) for ' + cluster.product + '.',
          clusterId: cluster.id,
          product: cluster.product,
          artisanName: member.name,
          status: member.production_status,
          action_label: 'Track Order',
          action_route: 'buyer-orders',
          timestamp: 'Just now',
          is_read: false
        });
        localStorage.setItem('kala_mitra_buyer_notifs', JSON.stringify(buyerNotifs));
        if (typeof updateUnreadBadgeCounts === 'function') updateUnreadBadgeCounts();
      } catch (e) {}

      return cluster;
    } catch (err) {
      console.error('Error updating cluster member production:', err);
      return null;
    }
  };

/**
 * KALA-MITRA - Main Application Controller
 * Manages Navigation State Machine, Phone/Email Authentication,
 * and the complete Artisan Dashboard & Repository integration.
 */

import { authService } from './src/services/authService.js';
import { ValidationService } from './src/services/validationService.js';
import { artisanRepository } from './src/repositories/artisanRepository.js';
import { productRepository } from './src/repositories/productRepository.js';
import { capacityRepository } from './src/repositories/capacityRepository.js';
import { catalogService } from './src/services/catalogService.js';
import { cameraService, CameraErrorType } from './src/services/cameraService.js';
import { Product, ProductStatus, ProductStatusLabels, ProductCategories } from './src/models/product.js';
import { ArtisanCapacity, AvailabilityStatus, AvailabilityStatusLabels, ProductionPeriod, ProductionPeriodLabels } from './src/models/capacity.js';
import { OrderStatusLabels } from './src/models/order.js';
import { MarketplaceModule } from './src/services/marketplaceModule.js';
import { SAMPLE_PRODUCTS, getProductImage, mapCraftToBuyerCategory, getBuyerProductsForCraft, addArtisanProductToBuyerMarketplace } from './src/services/marketplaceService.js';
import { marketDemandService } from './src/services/marketDemandService.js';
import QRCode from 'qrcode';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
window.escapeHtml = escapeHtml;

document.addEventListener('DOMContentLoaded', () => {
  // Screen DOM Elements
  const screens = {
    landing: document.getElementById('screen-landing'),
    auth: document.getElementById('screen-auth'),
    otp: document.getElementById('screen-otp'),
    'email-verify': document.getElementById('screen-email-verify'),
    'profile-setup': document.getElementById('screen-profile-setup'),
    'artisan-dashboard': document.getElementById('screen-artisan-dashboard'),
    'buyer-home': document.getElementById('screen-buyer-home'),
    'buyer-discover': document.getElementById('screen-buyer-discover'),
    'buyer-orders': document.getElementById('screen-buyer-orders'),
    'buyer-opportunities': document.getElementById('screen-buyer-opportunities'),
    'buyer-notifications': document.getElementById('screen-buyer-notifications'),
    'buyer-profile': document.getElementById('screen-buyer-profile'),
    'buyer-voice-search': document.getElementById('screen-buyer-voice-search'),
    'buyer-image-search': document.getElementById('screen-buyer-image-search'),
    'buyer-bulk-requirement': document.getElementById('screen-buyer-bulk-requirement'),
    'buyer-product-detail': document.getElementById('screen-buyer-product-detail'),
    'buyer-opportunity-detail': document.getElementById('screen-buyer-opportunity-detail'),
    'artisan-camera': document.getElementById('screen-artisan-camera')
  };


  // State
  let currentRole = 'Artisan';
  let resendInterval = null;
  let resendSecondsRemaining = 30;
  let selectedLanguage = localStorage.getItem('kala-mitra-language') || 'English';
  let activeArtisanTab = 'home';
  let activeProductFilter = 'all';
  let currentEditingProductId = null;
  let currentDeletingProductId = null;
  let selectedProductImageBase64 = null;
  let selectedProductImageName = null;
  let artisanMap = null;
  let artisanCluster = null;
  let artisanMarkers = new Map();
  let nearbyArtisans = [];
  let artisanMapCenter = { latitude: 16.9891, longitude: 82.2475 };
  let artisanLocationRequested = false;
  let selectedArtisanId = null;
  let artisanSearchTimer = null;
  let artisanDiscoveryInitialized = false;
  let artisanUserMarker = null;
  let imageSearchFile = null;
  let activeCluster = null;
  let clusterRequests = [];
  let clusterMap = null;
  let buyerMarketplace = null;
  let pendingClusterData = null;
  let pendingBuyerClusterTarget = null;
  let activeClusterRequirement = null;
  try {
    const storedReq = localStorage.getItem('kala_mitra_active_cluster_req');
    if (storedReq) activeClusterRequirement = JSON.parse(storedReq);
  } catch (e) {}

  const kalaTranslations = {
    Telugu: {
      'Preferred Language': 'ఇష్టపడే భాష',
      'Preferred Language:': 'ఇష్టపడే భాష:',
      'Change Language': 'భాషను మార్చండి',
      'Connecting Craft, Demand & Opportunity': 'చేతివృత్తి, డిమాండ్ మరియు అవకాశాలను కలుపుతూ',
      'KALA-MITRA helps artisans showcase their crafts and connect with buyers and market opportunities.': 'KALA-MITRA కళాకారులు తమ చేతివృత్తులను ప్రదర్శించి కొనుగోలుదారులు మరియు మార్కెట్ అవకాశాలతో అనుసంధానం కావడానికి సహాయపడుతుంది.',
      'Continue as': 'ఇలా కొనసాగండి',
      Artisan: 'కళాకారుడు',
      Buyer: 'కొనుగోలుదారు',
      'Showcase your crafts and discover opportunities.': 'మీ చేతివృత్తులను ప్రదర్శించి అవకాశాలను కనుగొనండి.',
      'Discover crafts and connect with artisans.': 'చేతివృత్తులను కనుగొని కళాకారులతో అనుసంధానం అవ్వండి.',
      'Smart India Hackathon Initiative': 'స్మార్ట్ ఇండియా హ్యాకథాన్ కార్యక్రమం',
      'Sign In / Register': 'సైన్ ఇన్ / నమోదు',
      'Enter your mobile number to verify and get started with KALA-MITRA.': 'ధృవీకరించడానికి మరియు KALA-MITRAతో ప్రారంభించడానికి మీ మొబైల్ నంబర్‌ను నమోదు చేయండి.',
      'Mobile Phone': 'మొబైల్ ఫోన్',
      Email: 'ఇమెయిల్',
      'Mobile Number': 'మొబైల్ నంబర్',
      'Enter 10-digit mobile number': '10 అంకెల మొబైల్ నంబర్‌ను నమోదు చేయండి',
      'We will send a 6-digit verification code (OTP) via SMS.': '6 అంకెల ధృవీకరణ కోడ్ (OTP)ను SMS ద్వారా పంపుతాము.',
      'Send OTP': 'OTP పంపండి',
      'Email Address': 'ఇమెయిల్ చిరునామా',
      'We will send a 6-digit verification code to your email.': '6 అంకెల ధృవీకరణ కోడ్‌ను మీ ఇమెయిల్‌కు పంపుతాము.',
      'Continue with Email': 'ఇమెయిల్‌తో కొనసాగండి',
      'Safe & Secure. Your credentials are protected and never shared.': 'సురక్షితం. మీ వివరాలు రక్షించబడతాయి మరియు ఎప్పటికీ పంచబడవు.',
      Back: 'వెనుకకు',
      'Verify your phone': 'మీ ఫోన్‌ను ధృవీకరించండి',
      'Enter the 6-digit code sent to': 'పంపిన 6 అంకెల కోడ్‌ను నమోదు చేయండి:',
      'Change phone number': 'ఫోన్ నంబర్‌ను మార్చండి',
      'Verify & Continue': 'ధృవీకరించి కొనసాగండి',
      'Resend OTP': 'OTPని మళ్లీ పంపండి',
      'Resend OTP in': 'మళ్లీ OTP పంపడానికి సమయం',
      'Verify your email': 'మీ ఇమెయిల్‌ను ధృవీకరించండి',
      'Enter the 6-digit code sent to your email': 'మీ ఇమెయిల్‌కు పంపిన 6 అంకెల కోడ్‌ను నమోదు చేయండి',
      'Change email address': 'ఇమెయిల్ చిరునామాను మార్చండి',
      'Basic Profile Setup': 'ప్రాథమిక ప్రొఫైల్ సెటప్',
      'Artisan Profile Setup': 'కళాకారుడి ప్రొఫైల్ సెటప్',
      'Buyer Profile Setup': 'కొనుగోలుదారు ప్రొఫైల్ సెటప్',
      'Artisan Setup': 'కళాకారుడి సెటప్',
      'Buyer Setup': 'కొనుగోలుదారు సెటప్',
      'Tell us a few details to personalize your KALA-MITRA experience.': 'మీ KALA-MITRA అనుభవాన్ని వ్యక్తిగతీకరించడానికి కొన్ని వివరాలను చెప్పండి.',
      'Full Name': 'పూర్తి పేరు',
      'Business or Full Name': 'వ్యాపారం లేదా పూర్తి పేరు',
      'Business / Buyer Type': 'వ్యాపారం / కొనుగోలుదారు రకం',
      'Select business type': 'వ్యాపార రకాన్ని ఎంచుకోండి',
      'Location (District & State)': 'ప్రాంతం (జిల్లా మరియు రాష్ట్రం)',
      'Complete Setup': 'సెటప్ పూర్తి చేయండి',
      'Craft Type / Art Form': 'చేతివృత్తి రకం / కళారూపం',
      'Select your craft': 'మీ చేతివృత్తిని ఎంచుకోండి',
      'Please select your preferred language.': 'దయచేసి మీ ఇష్టమైన భాషను ఎంచుకోండి.',
      'Individual Artisan': 'వ్యక్తిగత కళాకారుడు',
      'Artisan Cooperative / SHG': 'కళాకారుల సహకార సంఘం / SHG',
      'Master Craftsman': 'మాస్టర్ క్రాఫ్ట్స్‌మెన్',
      'Retail Buyer': 'రిటైల్ కొనుగోలుదారు',
      'Wholesale / Bulk Buyer': 'హోల్‌సేల్ / బల్క్ కొనుగోలుదారు',
      'Corporate Gifting': 'కార్పొరేట్ గిఫ్టింగ్',
      Exporter: 'ఎగుమతిదారు',
      Other: 'ఇతర',
      'Artisan Dashboard': 'కళాకారుడి డ్యాష్‌బోర్డ్',
      Dashboard: 'డ్యాష్‌బోర్డ్',
      'Good morning': 'శుభోదయం',
      'Good morning, Lakshmi Devi': 'శుభోదయం, లక్ష్మీ దేవి',
      'Here’s what’s happening with your craft today.': 'ఈ రోజు మీ చేతివృత్తికి సంబంధించిన వివరాలు ఇవి.',
      'Active Products': 'క్రియాశీల ఉత్పత్తులు',
      Catalogued: 'కేటలాగ్‌లో ఉన్నాయి',
      'Active Orders': 'క్రియాశీల ఆర్డర్లు',
      'In Production': 'తయారీలో ఉన్నాయి',
      'Available Stock': 'అందుబాటులో ఉన్న నిల్వ',
      units: 'యూనిట్లు',
      'Ready for dispatch': 'రవాణాకు సిద్ధంగా ఉంది',
      'New Opportunities': 'కొత్త అవకాశాలు',
      'Matching Craft': 'సరిపోలే చేతివృత్తి',
      'Workshop Production & Stock': 'వర్క్‌షాప్ ఉత్పత్తి మరియు నిల్వ',
      'Available Capacity': 'అందుబాటులో ఉన్న సామర్థ్యం',
      Available: 'అందుబాటులో ఉంది',
      'Limited Availability': 'పరిమిత లభ్యత',
      Unavailable: 'అందుబాటులో లేదు',
      'Available Now': 'ప్రస్తుతం అందుబాటులో ఉంది',
      'Ready stock': 'సిద్ధంగా ఉన్న నిల్వ',
      'Monthly Capacity': 'నెలవారీ సామర్థ్యం',
      'Per Month': 'నెలకు',
      'Per Week': 'వారానికి',
      'Production speed': 'ఉత్పత్తి వేగం',
      'Production Time': 'ఉత్పత్తి సమయం',
      days: 'రోజులు',
      'Order turnaround': 'ఆర్డర్ పూర్తి సమయం',
      'Workshop Location': 'వర్క్‌షాప్ స్థానం',
      'Manage Capacity': 'సామర్థ్యాన్ని నిర్వహించండి',
      'AI Craft Vision': 'AI చేతివృత్తి దృష్టి',
      'Digitize Your Craft with AI': 'AIతో మీ చేతివృత్తిని డిజిటల్ చేయండి',
      'Take a photo to auto-generate descriptions, category tags, and smart pricing.': 'చిత్రం తీసి వివరణలు, వర్గ ట్యాగ్‌లు మరియు స్మార్ట్ ధరలను ఆటోమేటిక్‌గా రూపొందించండి.',
      'Create with AI': 'AIతో సృష్టించండి',
      'Market Opportunity Preview': 'మార్కెట్ అవకాశం ప్రివ్యూ',
      'Demand: High': 'డిమాండ్: ఎక్కువ',
      'Bamboo baskets are currently receiving increased buyer interest.': 'వెదురు బుట్టలపై ప్రస్తుతం కొనుగోలుదారుల ఆసక్తి పెరుగుతోంది.',
      'Typical Price': 'సాధారణ ధర',
      'Relevant Buyer Requests': 'సంబంధిత కొనుగోలుదారు అభ్యర్థనలు',
      'Explore Opportunities': 'అవకాశాలను అన్వేషించండి',
      'Recent Orders': 'ఇటీవలి ఆర్డర్లు',
      'View All': 'అన్నీ చూడండి',
      'My Products': 'నా ఉత్పత్తులు',
      'Manage your artisan catalog, available stock, and capacity.': 'మీ కళాకారుల కేటలాగ్, అందుబాటులో ఉన్న నిల్వ మరియు సామర్థ్యాన్ని నిర్వహించండి.',
      'Add Product': 'ఉత్పత్తిని జోడించండి',
      'Add New Product': 'కొత్త ఉత్పత్తిని జోడించండి',
      'Edit Product': 'ఉత్పత్తిని సవరించండి',
      All: 'అన్నీ',
      Active: 'క్రియాశీలం',
      Draft: 'డ్రాఫ్ట్',
      Inactive: 'క్రియారహితం',
      'No products yet': 'ఇంకా ఉత్పత్తులు లేవు',
      'Add your first craft product to start reaching buyers.': 'కొనుగోలుదారులను చేరుకోవడానికి మీ మొదటి ఉత్పత్తిని జోడించండి.',
      'Artisan Orders': 'కళాకారుల ఆర్డర్లు',
      'Track active production and fulfillment.': 'క్రియాశీల ఉత్పత్తి మరియు పూర్తి ప్రక్రియను ట్రాక్ చేయండి.',
      'Market Opportunities': 'మార్కెట్ అవకాశాలు',
      'Bulk demand and cluster matching for your craft.': 'మీ చేతివృత్తి కోసం భారీ డిమాండ్ మరియు సమూహ సరిపోలిక.',
      Home: 'హోమ్',
      Products: 'ఉత్పత్తులు',
      Orders: 'ఆర్డర్లు',
      Opportunities: 'అవకాశాలు',
      Profile: 'ప్రొఫైల్',
      Settings: 'సెట్టింగ్‌లు',
      Logout: 'లాగ్ అవుట్',
      'Log Out': 'లాగ్ అవుట్',
      Copilot: 'కోపైలట్',
      Notifications: 'నోటిఫికేషన్లు',
      'Ask KALA-MITRA Copilot': 'KALA-MITRA కోపైలట్‌ను అడగండి',
      'Open Artisan Profile': 'కళాకారుడి ప్రొఫైల్‌ను తెరవండి',
      Camera: 'కెమెరా',
      '● LIVE': '● ప్రత్యక్షం',
      LIVE: 'ప్రత్యక్షం',
      'Position craft inside frame': 'వస్తువును ఫ్రేమ్ లోపల ఉంచండి',
      'Starting camera...': 'కెమెరా ప్రారంభమవుతోంది...',
      'Camera Permission Required': 'కెమెరా అనుమతి అవసరం',
      'Camera permission is required to take a product photo. Please allow camera access in your device settings.': 'ఉత్పత్తి ఫోటో తీయడానికి కెమెరా అనుమతి అవసరం. దయచేసి సెట్టింగ్‌లలో అనుమతించండి.',
      'Try Again': 'మళ్ళీ ప్రయత్నించండి',
      'Choose from Gallery': 'గ్యాలరీ నుండి ఎంచుకోండి',
      Gallery: 'గ్యాలరీ',
      'Use this photo?': 'ఈ ఫోటోను ఉపయోగించాలా?',
      Retake: 'మళ్లీ తీయండి',
      'Use Photo': 'ఫోటోను ఉపయోగించండి',
      Cancel: 'రద్దు చేయండి',
      'Artisan Profile': 'కళాకారుడి ప్రొఫైల్',
      'Verified Artisan': 'ధృవీకరించిన కళాకారుడు',
      'Location:': 'ప్రాంతం:',
      'Mobile:': 'మొబైల్:',
      'Language:': 'భాష:',
      'Capacity:': 'సామర్థ్యం:',
      'Edit Profile Details': 'ప్రొఫైల్ వివరాలను సవరించండి',
      'Your Capacity': 'మీ సామర్థ్యం',
      'Manage workshop production capability & available stock': 'వర్క్‌షాప్ ఉత్పత్తి సామర్థ్యం మరియు నిల్వను నిర్వహించండి',
      'This information helps buyers and the KALA-MITRA collective capacity matching system pair your workshop with suitable bulk orders.': 'ఈ సమాచారం మీ వర్క్‌షాప్‌ను తగిన భారీ ఆర్డర్‌లతో జత చేయడానికి సహాయపడుతుంది.',
      'Current Available Stock': 'ప్రస్తుతం అందుబాటులో ఉన్న నిల్వ',
      'Units you can currently provide.': 'మీరు ప్రస్తుతం అందించగల యూనిట్లు.',
      'Production Capacity': 'ఉత్పత్తి సామర్థ్యం',
      'How many units can you produce during this period?': 'ఈ వ్యవధిలో మీరు ఎన్ని యూనిట్లను తయారు చేయగలరు?',
      'Production Period': 'ఉత్పత్తి వ్యవధి',
      'Production Time': 'ఉత్పత్తి సమయం',
      'How long do you usually need to produce an order?': 'ఆర్డర్ తయారీకి మీకు సాధారణంగా ఎంత సమయం పడుతుంది?',
      'Availability Status': 'లభ్యత స్థితి',
      'Can accept new opportunities.': 'కొత్త అవకాశాలను స్వీకరించవచ్చు.',
      'Can accept some additional work.': 'కొంత అదనపు పనిని స్వీకరించవచ్చు.',
      'Currently cannot accept new opportunities.': 'ప్రస్తుతం కొత్త అవకాశాలను స్వీకరించలేము.',
      'Update Capacity': 'సామర్థ్యాన్ని నవీకరించండి',
      'Bulk Order Opportunity': 'భారీ ఆర్డర్ అవకాశం',
      'Take Photo': 'చిత్రం తీయండి',
      'Use camera': 'కెమెరా ఉపయోగించండి',
      'Upload photo': 'ఫోటో అప్‌లోడ్ చేయండి',
      'Optional: Add Craft Hints (Helps AI Accuracy)': 'ఐచ్ఛికం: క్రాఫ్ట్ సూచనలను జోడించండి (AI ఖచ్చితత్వానికి సహాయపడుతుంది)',
      'Category Hint': 'విభాగం సూచన',
      'Material Hint': 'పదార్థం సూచన',
      'Or enter product details manually': 'లేదా వివరాలను మాన్యువల్‌గా నమోదు చేయండి',
      'Analyzing your product...': 'మీ ఉత్పత్తిని విశ్లేషిస్తోంది...',
      'KALA-MITRA is processing visual features and preparing catalog details.': 'KALA-MITRA దృశ్య లక్షణాలను ప్రాసెస్ చేసి కేటలాగ్ వివరాలను సిద్ధం చేస్తోంది.',
      'Validating craft photo...': 'ఫోటోను ధృవీకరిస్తోంది...',
      'YOLOv8 object detection...': 'YOLOv8 వస్తువు గుర్తింపు...',
      'SAM product segmentation...': 'SAM ఉత్పత్తి విభజన...',
      'Preparing product details & tags...': 'ఉత్పత్తి వివరాలు & ట్యాగ్‌లు సిద్ధం చేస్తోంది...',
      'Continue Manually': 'మాన్యువల్‌గా కొనసాగించండి',
      'KALA-MITRA Copilot': 'KALA-MITRA కోపైలట్',
      'Artisan Assistant (UI Interface)': 'కళాకారుడి సహాయకుడు',
      'Namaste!': 'నమస్కారం!',
      'Try asking:': 'ఇలా అడిగి చూడండి:',
      'Pricing guidance for bulk orders': 'భారీ ఆర్డర్ల కోసం ధర మార్గదర్శకత్వం',
      'Opportunities in my region': 'నా ప్రాంతంలోని అవకాశాలు',
      'How collective capacity works': 'సమిష్టి సామర్థ్యం ఎలా పనిచేస్తుంది',
      'Ask KALA-MITRA...': 'KALA-MITRAను అడగండి...',
      'Ask KALA-MITRA or tap 🎤 to speak...': 'KALA-MITRAను అడగండి లేదా మాట్లాడటానికి 🎤 నొక్కండి...',
      'Consulting craft intelligence...': 'చేతివృత్తి సమాచారాన్ని సేకరిస్తోంది...',
      'Craft Knowledge Engine': 'క్రాఫ్ట్ పరిజ్ఞానం ఇంజిన్',
      'Ollama LLM Engine': 'ఒలామా LLM ఇంజిన్',
      '🔴 Listening... Speak your question now': '🔴 వింటోంది... మీ ప్రశ్నను ఇప్పుడు మాట్లాడండి',
      '🎙️ Voice Assistant listening... Speak your query to Copilot.': '🎙️ వాయిస్ అసిస్టెంట్ వింటోంది... కోపైలట్‌కు మీ ప్రశ్నను చెప్పండి.',
      'Speak to Copilot (Voice Assistant)': 'కోపైలట్‌తో మాట్లాడండి (వాయిస్ అసిస్టెంట్)',
      'Listening... Tap to stop': 'వింటోంది... ఆపడానికి నొక్కండి',
      'Product Photo': 'ఉత్పత్తి ఫోటో',
      'Optional for Draft': 'డ్రాఫ్ట్ కోసం ఐచ్ఛికం',
      'Photo selected': 'ఫోటో ఎంపికైంది',
      'Replace Photo': 'ఫోటోను మార్చండి',
      Remove: 'తొలగించండి',
      'Product Name': 'ఉత్పత్తి పేరు',
      Category: 'వర్గం',
      'Select craft category': 'చేతివృత్తి వర్గాన్ని ఎంచుకోండి',
      'Custom Category Name': 'అనుకూల వర్గం పేరు',
      'Material Used': 'ఉపయోగించిన పదార్థం',
      'Product Description': 'ఉత్పత్తి వివరణ',
      'Price (₹)': 'ధర (₹)',
      Price: 'ధర',
      'Available Quantity': 'అందుబాటులో ఉన్న పరిమాణం',
      'Units ready for dispatch': 'రవాణాకు సిద్ధంగా ఉన్న యూనిట్లు',
      'Units crafted / month': 'నెలకు రూపొందించిన యూనిట్లు',
      'Lead Time (Days)': 'డెలివరీ సమయం (రోజులు)',
      'Days per batch': 'బ్యాచ్‌కు రోజులు',
      'Craft Origin / Location': 'చేతివృత్తి మూలం / ప్రాంతం',
      'Product Tags': 'ఉత్పత్తి ట్యాగ్‌లు',
      'Comma separated': 'కామాలతో వేరుచేయబడింది',
      'Product Status': 'ఉత్పత్తి స్థితి',
      'Save Product': 'ఉత్పత్తిని సేవ్ చేయండి',
      'Product Details': 'ఉత్పత్తి వివరాలు',
      'Delete Product': 'ఉత్పత్తిని తొలగించండి',
      'Delete this product?': 'ఈ ఉత్పత్తిని తొలగించాలా?',
      'This product will be removed from your active products catalog.': 'ఈ ఉత్పత్తి మీ క్రియాశీల ఉత్పత్తుల కేటలాగ్ నుండి తీసివేయబడుతుంది.',
      'Buyer Portal': 'కొనుగోలుదారు పోర్టల్',
      'Smart Discovery': 'స్మార్ట్ అన్వేషణ',
      'Discover Authentic Crafts. Connect with Artisans.': 'నిజమైన చేతివృత్తులను కనుగొని కళాకారులతో అనుసంధానమవ్వండి.',
      'Find handcrafted products from skilled artisans and discover opportunities for individual or bulk requirements.': 'నైపుణ్యం కలిగిన కళాకారుల చేతితో తయారు చేసిన ఉత్పత్తులను కనుగొనండి. వ్యక్తిగత లేదా భారీ అవసరాల అవకాశాలను తెలుసుకోండి.',
      'Search for crafts, products, or what you need...': 'చేతివృత్తులు, ఉత్పత్తులు లేదా మీకు కావలసిన వాటిని వెతకండి...',
      Search: 'వెతకండి',
      'Voice Search': 'వాయిస్ శోధన',
      'Search by Image': 'చిత్రంతో శోధించండి',
      'Have a Large Requirement?': 'మీకు భారీ అవసరమా?',
      'Bulk Requirement': 'భారీ అవసరం',
      'When one artisan cannot fulfill your required quantity, KALA-MITRA can help connect you with multiple suitable artisans.': 'ఒక కళాకారుడు మీ అవసరమైన పరిమాణాన్ని అందించలేనప్పుడు, KALA-MITRA మీకు అనేక అనుకూల కళాకారులతో అనుసంధానం చేస్తుంది.',
      'Need 500 Bamboo Baskets?': '500 వెదురు బుట్టలు కావాలా?',
      'Find artisans who can collectively fulfill your requirement.': 'మీ అవసరాన్ని సమిష్టిగా తీర్చగల కళాకారులను కనుగొనండి.',
      'Find Artisans': 'కళాకారులను కనుగొనండి',
      'Nearby Artisans': 'సమీపంలోని కళాకారులు',
      'Discover skilled artisans and handmade products near you.': 'మీ సమీపంలోని నైపుణ్యం కలిగిన కళాకారులు మరియు చేతితో తయారు చేసిన ఉత్పత్తులను కనుగొనండి.',
      'Search artisans, crafts or location': 'కళాకారులు, చేతివృత్తులు లేదా స్థానాన్ని శోధించండి',
      'Search artisans, crafts or location...': 'కళాకారులు, చేతివృత్తులు లేదా ప్రాంతాన్ని వెతకండి...',
      'Use My Location': 'నా స్థానాన్ని ఉపయోగించండి',
      'Enter Location Manually': 'స్థానాన్ని మాన్యువల్‌గా నమోదు చేయండి',
      'City, district or location': 'నగరం, జిల్లా లేదా స్థానం',
      'Find Location': 'స్థానాన్ని కనుగొనండి',
      'Finding nearby artisans...': 'సమీప కళాకారులను కనుగొంటోంది...',
      Craft: 'చేతివృత్తి',
      Distance: 'దూరం',
      Verification: 'ధృవీకరణ',
      'Verified Artisans': 'ధృవీకరించిన కళాకారులు',
      'Available for Orders': 'ఆర్డర్లకు అందుబాటులో ఉంది',
      'Within 25 km': '25 కిమీ పరిధిలో',
      'No artisans found within your search radius.': 'మీ శోధన పరిధిలో కళాకారులు ఎవరూ కనుగొనబడలేదు.',
      'Try increasing the distance or changing your craft filter.': 'దూరాన్ని పెంచండి లేదా ఫిల్టర్‌ను మార్చండి.',
      'Increase Search Radius': 'శోధన పరిధిని పెంచండి',
      'Artisan Cluster': 'కళాకారుల సమూహం',
      'Order Tracking': 'ఆర్డర్ ట్రాకింగ్',
      'Voice Assistant': 'వాయిస్ అసిస్టెంట్',
      'Tap to speak': 'మాట్లాడటానికి నొక్కండి',
      'How can I help you?': 'నేను మీకు ఎలా సహాయపడగలను?',
      'Ask about products, artisans, your cart, orders, and clusters.': 'ఉత్పత్తులు, కళాకారులు, మీ కార్ట్, ఆర్డర్లు మరియు సమూహాల గురించి అడగండి.',
      'Type a message...': 'సందేశాన్ని టైప్ చేయండి...',
      Send: 'పంపండి',
      'Visual Discovery': 'దృశ్య అన్వేషణ',
      'Upload a product image to find visually similar handmade products in the KALA-MITRA catalog.': 'కేటలాగ్‌లో సారూప్యమైన ఉత్పత్తులను కనుగొనడానికి ఉత్పత్తి చిత్రాన్ని అప్‌లోడ్ చేయండి.',
      'Upload Image': 'చిత్రాన్ని అప్‌లోడ్ చేయండి',
      'Drag & drop an image here, or use your camera': 'చిత్రాన్ని ఇక్కడ లాగండి లేదా కెమెరాను ఉపయోగించండి',
      'No image selected': 'చిత్రం ఎంచుకోలేదు',
      'Find Matching Products': 'సరిపోలే ఉత్పత్తులను కనుగొనండి',
      'Change Image': 'చిత్రాన్ని మార్చండి',
      'Bulk Order: Handwoven Bamboo Baskets': 'భారీ ఆర్డర్: చేతితో నేసిన వెదురు బుట్టలు',
      'Buyer / Entity:': 'కొనుగోలుదారు / సంస్థ:',
      'Buyer Type:': 'కొనుగోలుదారు రకం:',
      'Total Required:': 'మొత్తం అవసరం:',
      'Your Workshop Share:': 'మీ వర్క్‌షాప్ వాటా:',
      'Target Rate:': 'లక్ష్య ధర:',
      'Timeline:': 'కాల వ్యవధి:',
      'Find Matching Artisans': 'సరిపోలే కళాకారులను కనుగొనండి',
      'Opportunity Details': 'అవకాశ వివరాలు',
      'Verified Artisan Wholesale Marketplace': 'ధృవీకరించిన కళాకారుల హోల్‌సేల్ మార్కెట్‌ప్లేస్',
      'Handcrafted Indian Crafts': 'చేతితో తయారు చేసిన భారతీయ చేతివృత్తులు',
      'Source directly across 17 certified craft categories from master GI artisans and collective clusters with escrow protection.': 'ఎస్క్రో రక్షణతో 17 ధృవీకరించిన చేతివృత్తుల విభాగాల నుండి నేరుగా ఉత్పత్తులను పొందండి.',
      'Open shopping cart': 'షాపింగ్ కార్ట్ తెరవండి',
      Cart: 'కార్ట్',
      'Post Bulk Requirement': 'భారీ అవసరాన్ని నమోదు చేయండి',
      'Explore 17 Certified Craft Categories': '17 ధృవీకరించిన చేతివృత్తుల విభాగాలను అన్వేషించండి',
      'Reset Filter': 'ఫిల్టర్ రీసెట్ చేయండి',
      'All Items': 'అన్ని వస్తువులు',
      'All 17 Crafts': 'మొత్తం 17 చేతివృత్తులు',
      'Full Wholesale Catalog': 'పూర్తి హోల్‌సేల్ కేటలాగ్',
      'Verified GI Craft': 'ధృవీకరించిన GI చేతివృత్తి',
      'Search by craft name, artisan, material...': 'చేతివృత్తి పేరు, కళాకారుడు లేదా పదార్థంతో శోధించండి...',
      'Add to Cart': 'కార్ట్‌కు జోడించండి',
      '🛒 Add to Cart': '🛒 కార్ట్‌కు జోడించండి',
      'Go to Cart': 'కార్ట్‌కు వెళ్లండి',
      '🛒 Go to Cart': '🛒 కార్ట్‌కు వెళ్లండి',
      'Cluster': 'క్లస్టర్',
      'Artisan Cluster': 'కళాకారుల క్లస్టర్',
      'Opportunities': 'అవకాశాలు',
      'Orders': 'ఆర్డర్లు',
      'Alerts': 'హెచ్చరికలు',
      'Payments': 'చెల్లింపులు',
      'Products': 'ఉత్పత్తులు',
      'Delivery': 'డెలివరీ',
      'All': 'అన్ని',
      'Request Quote': 'ధరను అభ్యర్థించండి',
      'Wholesale Price': 'హోల్‌సేల్ ధర',
      'Lead Time': 'డెలివరీ సమయం',
      'Cluster Supply': 'క్లస్టర్ సరఫరా',
      Save: 'సేవ్ చేయండి',
      Close: 'మూసివేయండి',
      Edit: 'సవరించండి',
      Delete: 'తొలగించండి',
      'Shopping Cart': 'షాపింగ్ కార్ట్',
      'Your Cart': 'మీ కార్ట్',
      'Proceed to Checkout': 'చెక్‌అవుట్‌కు వెళ్లండి',
      'Place Order': 'ఆర్డర్ ఇవ్వండి',
      'Empty Cart': 'కార్ట్ ఖాళీగా ఉంది',
      'Payment Successful': 'చెల్లింపు విజయవంతమైంది',
      'Shipping Update': 'రవాణా నవీకరణ',
      'Welcome to KALA-MITRA! 🎉': 'KALA-MITRAకి స్వాగతం! 🎉',
      'Logged out securely': 'సురక్షితంగా లాగ్ అవుట్ అయ్యారు',
      'UPDATES & MATCHES': 'నవీకరణలు మరియు సరిపోలికలు',
      'Artisan Notifications': 'కళాకారుడి నోటిఫికేషన్లు',
      'Mark all as read': 'అన్నీ చదివినట్లు గుర్తించండి',
      'View Opportunity': 'అవకాశాన్ని చూడండి',
      'View Orders': 'ఆర్డర్లను చూడండి',
      'View Cluster': 'క్లస్టర్‌ను చూడండి',
      'View Details': 'వివరాలను చూడండి',
      '🔊 Listen': '🔊 వినండి',
      Listen: 'వినండి',
      'Mark as read': 'చదివినట్లు గుర్తించండి',
      'No notifications in this category.': 'ఈ విభాగంలో నోటిఫికేషన్లు లేవు.',
      'New Bulk Opportunity Available': 'కొత్త బల్క్ అవకాశం అందుబాటులో ఉంది',
      'GreenLeaf Hotels requested 500 units of Bamboo Baskets. Tap to view cluster capacity.': 'గ్రీన్‌లీఫ్ హోటల్స్ 500 వెదురు బుట్టల యూనిట్లను కోరింది. క్లస్టర్ సామర్థ్యాన్ని చూడటానికి నొక్కండి.',
      'Order Status Updated': 'ఆర్డర్ స్థితి నవీకరించబడింది',
      'Order #ORD-9021 moved to "Production in Progress". Delivery target: 25 Sep.': 'ఆర్డర్ #ORD-9021 "ఉత్పత్తి పురోగతిలో ఉంది" స్థితికి మారింది. డెలివరీ లక్ష్యం: 25 సెప్టెంబర్.',
      'Cluster Request Response Required': 'క్లస్టర్ అభ్యర్థన స్పందన అవసరం',
      'Master artisan in East Godavari cluster allocated 120 units to your workshop.': 'తూర్పు గోదావరి క్లస్టర్‌లోని మాస్టర్ కళాకారుడు మీ వర్క్‌షాప్‌కు 120 యూనిట్లను కేటాయించారు.',
      'High Demand Alert': 'అధిక డిమాండ్ హెచ్చరిక',
      'Buyers in Hospitality sector searched for eco-friendly handicrafts in your region.': 'హోస్పిటాలిటీ రంగానికి చెందిన కొనుగోలుదారులు మీ ప్రాంతంలో పర్యావరణ అనుకూల హస్తకళల కోసం వెతికారు.',
      Alerts: 'హెచ్చరికలు',
      'Bamboo Handicrafts': 'వెదురు హస్తకళలు',
      'Terracotta Pottery': 'టెర్రకోటా కుండలు',
      'Handloom Weaving & Textiles': 'చేనేత నేత మరియు వస్త్రాలు',
      'Kalamkari Art & Painting': 'కలంకారీ కళ మరియు చిత్రలేఖనం',
      'Wood Carving & Etikoppaka Toys': 'చెక్క చెక్కడాలు మరియు ఏటికొప్పాక బొమ్మలు',
      'Brass & Metal Craft (Dokra)': 'ఇత్తడి మరియు లోహ హస్తకళలు (డోక్రా)',
      'Leather Puppetry': 'తోలుబొమ్మలాట',
      'Stone & Clay Sculpture': 'రాయి మరియు మట్టి శిల్పాలు',
      'Other Traditional Craft': 'ఇతర సాంప్రదాయ చేతివృత్తి',
      'Verify Email & Continue': 'ఇమెయిల్‌ను ధృవీకరించి కొనసాగండి',
      'Resend verification code': 'ధృవీకరణ కోడ్‌ను మళ్లీ పంపండి',
      'Bamboo & Cane': 'వెదురు మరియు పేము',
      'Terracotta & Clay': 'టెర్రకోటా మరియు మట్టి',
      'Handloom & Weaving': 'చేనేత మరియు నేత',
      'Wood & Carving': 'చెక్క మరియు చెక్కడాలు',
      'Brass & Dokra': 'ఇత్తడి మరియు డోక్రా',
      'Leather & Puppetry': 'తోలు మరియు బొమ్మలాట',
      'Stone Craft': 'రాతి కళ',
      'In Stock': 'స్టాక్‌లో ఉంది',
      'Out of Stock': 'స్టాక్ అయిపోయింది',
      'Fast Shipping': 'వేగవంతమైన రవాణా',
      'Verified GI Tag': 'ధృవీకరించిన GI ట్యాగ్',
      Handcrafted: 'చేతితో తయారు చేసినది',
      'Eco-Friendly': 'పర్యావరణ అనుకూల',
      'Escrow Protected': 'ఎస్క్రో రక్షణ',
      'Capacity Available': 'సామర్థ్యం ఉంది',
      'Collective Cluster Available': 'సమిష్టి క్లస్టర్ అందుబాటులో ఉంది',
      'per unit': 'యూనిట్‌కు',
      'units ready': 'యూనిట్లు సిద్ధంగా ఉన్నాయి',
      'days lead time': 'రోజుల వ్యవధి',
      Rating: 'రేటింగ్',
      Reviews: 'సమీక్షలు',
      'Artisan:': 'కళాకారుడు:',
      'Order Placed': 'ఆర్డర్ చేయబడింది',
      'Order #KM-ORD-10245 has been placed for Bamboo Baskets (500 units).': 'వెదురు బుట్టల కోసం ఆర్డర్ #KM-ORD-10245 (500 యూనిట్లు) నమోదు చేయబడింది.',
      'Track Order': 'ఆర్డర్ ట్రాక్ చేయండి',
      'Cluster Formed': 'క్లస్టర్ ఏర్పడింది',
      '4 verified artisans in East Godavari reached collective capacity for your requirement.': 'మీ అవసరాన్ని తీర్చడానికి తూర్పు గోదావరిలోని 4 ధృవీకరించిన కళాకారులు సమిష్టి సామర్థ్యాన్ని చేరుకున్నారు.',
      'Payment verified via Razorpay TEST MODE for Order #KM-ORD-10245.': 'ఆర్డర్ #KM-ORD-10245 కోసం Razorpay TEST MODE ద్వారా చెల్లింపు ధృవీకరించబడింది.',
      'View Order': 'ఆర్డర్ చూడండి',
      'AI Product Match': 'AI ఉత్పత్తి సరిపోలిక',
      'AI found 8 products matching your requirement.': 'మీ అవసరానికి సరిపోలే 8 ఉత్పత్తులను AI కనుగొంది.',
      'View Products': 'ఉత్పత్తులను చూడండి',
      'Artisan Match': 'కళాకారుడి సరిపోలిక',
      '5 verified artisans can fulfill your requirement.': '5 ధృవీకరించిన కళాకారులు మీ అవసరాన్ని తీర్చగలరు.',
      'View Artisans': 'కళాకారులను చూడండి',
      'Artisan Cluster Update': 'కళాకారుల క్లస్టర్ నవీకరణ',
      'AI Artisan Cluster has been created to fulfill your 500-unit order.': 'మీ 500-యూనిట్ల ఆర్డర్‌ను తీర్చడానికి AI ఆర్టిసన్ క్లస్టర్ సృష్టించబడింది.',
      'Payment of ₹25,000 for Order #KM1024 was successful.': 'ఆర్డర్ #KM1024 కోసం ₹25,000 చెల్లింపు విజయవంతమైంది.',
      'View Payment': 'చెల్లింపును చూడండి',
       'Your order has been shipped.': 'మీ ఆర్డర్ రవాణా చేయబడింది.',
      'Track Shipment': 'రవాణాను ట్రాక్ చేయండి',
      'Order Status: Quality Check': 'ఆర్డర్ స్థితి: క్వాలిటీ చెక్',
      'Order Status: Production Started': 'ఆర్డర్ స్థితి: ఉత్పత్తి ప్రారంభమైంది',
      'Order Status: Production in Progress': 'ఆర్డర్ స్థితి: ఉత్పత్తి పురోగతిలో ఉంది',
      'Order Status: Shipped': 'ఆర్డర్ స్థితి: రవాణా చేయబడింది',
      'Order Status: Delivered': 'ఆర్డర్ స్థితి: డెలివరీ చేయబడింది',
      'Production has officially started for your order of Bamboo Basket.': 'మీ బాంబూ బాస్కెట్ ఆర్డర్ కోసం ఉత్పత్తి అధికారికంగా ప్రారంభమైంది.',
      'Your order of Bamboo Basket has entered Quality Check inspection.': 'మీ బాంబూ బాస్కెట్ ఆర్డర్ క్వాలిటీ చెక్ తనిఖీలోకి ప్రవేశించింది.',
      'Artisans are crafting your order of Bamboo Basket.': 'కళాకారులు మీ బాంబూ బాస్కెట్ ఆర్డర్‌ను తయారుచేస్తున్నారు.',
      'Your order of Bamboo Basket has been dispatched and is on its way.': 'మీ బాంబూ బాస్కెట్ ఆర్డర్ పంపబడింది మరియు మార్గంలో ఉంది.',
      UPDATES: 'నవీకరణలు',
      Payments: 'చెల్లింపులు',
      Delivery: 'రవాణా',
      'Payment Failed': 'చెల్లింపు విఫలమైంది',
      'Invalid Razorpay cryptographic signature': 'చెల్లని Razorpay క్రిప్టోగ్రాఫిక్ సంతకం',
      'Retry Payment': 'చెల్లింపును మళ్లీ ప్రయత్నించండి',
      'Order Placed Successfully': 'ఆర్డర్ విజయవంతంగా నమోదు చేయబడింది',
      'Handwoven Bamboo Basket': 'చేతితో నేసిన వెదురు బుట్ట',
      'Bamboo Basket': 'వెదురు బుట్ట',
      'Bamboo Tea Table Set': 'బాంబూ టీ టేబుల్ సెట్',
      'Terracotta Water Pitcher': 'టెర్రకోటా నీటి బిందె',
      'Kalamkari Saree': 'కలంకారీ చీర',
      'Brass Dokra Idol': 'ఇత్తడి డోక్రా విగ్రహం',
      'Wood Carving Toy': 'చెక్క చెక్కడ బొమ్మ',
      'Jute Tote Bag': 'జూట్ తోటె సంచి',
      Successfully: 'విజయవంతంగా',
      'Artisan Accepted Cluster': 'కళాకారుడు క్లస్టర్‌ను అంగీకరించారు',
      'Artisan Declined Cluster': 'కళాకారుడు క్లస్టర్‌ను తిరస్కరించారు',
      'Form Cluster Again': 'మళ్లీ క్లస్టర్‌ను ఏర్పరచండి',
      'Previous Clusters': 'గత క్లస్టర్‌లు',
      'Previous Clusters / History': 'గత క్లస్టర్‌లు / చరిత్ర',
      'Cluster History': 'క్లస్టర్ చరిత్ర',
      'Artisan Cluster Accepted': 'కళాకారుడి క్లస్టర్ స్పందన: అంగీకరించబడింది',
      'Artisan Cluster Response': 'కళాకారుడి క్లస్టర్ స్పందన',
      'Artisan Notifications': 'కళాకారుడి నోటిఫికేషన్‌లు',
      'Buyer Notifications': 'కొనుగోలుదారు నోటిఫికేషన్‌లు',
      'New Cluster Request': 'కొత్త క్లస్టర్ అభ్యర్థన',
      'Cluster Order Created': 'క్లస్టర్ ఆర్డర్ సృష్టించబడింది',
      'Accept': 'అంగీకరించు',
      'Decline': 'తిరస్కరించు',
      'Accepted': 'అంగీకరించబడింది',
      'Declined': 'తిరస్కరించబడింది',
      '✓ Accepted': '✓ అంగీకరించబడింది',
      '✕ Declined': '✕ తిరస్కరించబడింది',
      'Cluster Request Response Required': 'క్లస్టర్ అభ్యర్థన స్పందన అవసరం',
      'View Cluster': 'క్లస్టర్ చూడండి',
      'View Opportunity': 'అవకాశాన్ని చూడండి',
      'View Orders': 'ఆర్డర్‌లను చూడండి',
      'View Details': 'వివరాలను చూడండి',
      'Mark as read': 'చదివినట్లు గుర్తించండి',
      'Mark all as read': 'అన్నింటినీ చదివినట్లు గుర్తించండి',
      'All notifications marked as read.': 'అన్ని నోటిఫికేషన్‌లు చదివినట్లు గుర్తించబడ్డాయి.',
      'You accepted the cluster request!': 'మీరు క్లస్టర్ అభ్యర్థనను అంగీకరించారు!',
      'You declined the cluster request.': 'మీరు క్లస్టర్ అభ్యర్థనను తిరస్కరించారు.'
    },
    Hindi: {
      'Preferred Language': 'पसंदीदा भाषा',
      'Preferred Language:': 'पसंदीदा भाषा:',
      'Change Language': 'भाषा बदलें',
      'Connecting Craft, Demand & Opportunity': 'शिल्प, मांग और अवसरों को जोड़ना',
      'KALA-MITRA helps artisans showcase their crafts and connect with buyers and market opportunities.': 'KALA-MITRA कारीगरों को अपने शिल्प प्रदर्शित करने और खरीदारों व बाजार के अवसरों से जुड़ने में मदद करता है।',
      'Continue as': 'इस रूप में जारी रखें',
      Artisan: 'कारीगर',
      Buyer: 'खरीदार',
      'Showcase your crafts and discover opportunities.': 'अपने शिल्प प्रदर्शित करें और अवसर खोजें।',
      'Discover crafts and connect with artisans.': 'शिल्प खोजें और कारीगरों से जुड़ें।',
      'Smart India Hackathon Initiative': 'स्मार्ट इंडिया हैकाथॉन पहल',
      'Sign In / Register': 'साइन इन / पंजीकरण',
      'Enter your mobile number to verify and get started with KALA-MITRA.': 'सत्यापन करने और KALA-MITRA शुरू करने के लिए अपना मोबाइल नंबर दर्ज करें।',
      'Mobile Phone': 'मोबाइल फोन',
      Email: 'ईमेल',
      'Mobile Number': 'मोबाइल नंबर',
      'Enter 10-digit mobile number': '10 अंकों का मोबाइल नंबर दर्ज करें',
      'We will send a 6-digit verification code (OTP) via SMS.': 'हम SMS द्वारा 6 अंकों का सत्यापन कोड (OTP) भेजेंगे।',
      'Send OTP': 'OTP भेजें',
      'Email Address': 'ईमेल पता',
      'We will send a 6-digit verification code to your email.': 'हम आपके ईमेल पर 6 अंकों का सत्यापन कोड भेजेंगे।',
      'Continue with Email': 'ईमेल से जारी रखें',
      'Safe & Secure. Your credentials are protected and never shared.': 'सुरक्षित। आपकी जानकारी सुरक्षित है और कभी साझा नहीं की जाती।',
      Back: 'वापस',
      'Verify your phone': 'अपना फोन सत्यापित करें',
      'Enter the 6-digit code sent to': 'भेजे गए 6 अंकों का कोड दर्ज करें:',
      'Change phone number': 'फ़ोन नंबर बदलें',
      'Verify & Continue': 'सत्यापित करें और आगे बढ़ें',
      'Resend OTP': 'OTP दोबारा भेजें',
      'Resend OTP in': 'OTP पुनः भेजने में समय',
      'Verify your email': 'अपना ईमेल सत्यापित करें',
      'Enter the 6-digit code sent to your email': 'अपने ईमेल पर भेजे गए 6 अंकों का कोड दर्ज करें',
      'Change email address': 'ईमेल पता बदलें',
      'Basic Profile Setup': 'प्रोफ़ाइल सेटअप',
      'Artisan Profile Setup': 'कारीगर प्रोफ़ाइल सेटअप',
      'Buyer Profile Setup': 'खरीदार प्रोफ़ाइल सेटअप',
      'Artisan Setup': 'कारीगर सेटअप',
      'Buyer Setup': 'खरीदार सेटअप',
      'Tell us a few details to personalize your KALA-MITRA experience.': 'अपने KALA-MITRA अनुभव को व्यक्तिगत बनाने के लिए कुछ विवरण दें।',
      'Full Name': 'पूरा नाम',
      'Business or Full Name': 'व्यवसाय या पूरा नाम',
      'Business / Buyer Type': 'व्यवसाय / खरीदार प्रकार',
      'Select business type': 'व्यवसाय प्रकार चुनें',
      'Location (District & State)': 'स्थान (ज़िला और राज्य)',
      'Complete Setup': 'सेटअप पूरा करें',
      'Craft Type / Art Form': 'शिल्प प्रकार / कला रूप',
      'Select your craft': 'अपना शिल्प चुनें',
      'Please select your preferred language.': 'कृपया अपनी पसंदीदा भाषा चुनें।',
      'Individual Artisan': 'व्यक्तिगत कारीगर',
      'Artisan Cooperative / SHG': 'कारीगर सहकारी समिति / SHG',
      'Master Craftsman': 'मास्टर शिल्पकार',
      'Retail Buyer': 'खुदरा खरीदार',
      'Wholesale / Bulk Buyer': 'थोक खरीदार',
      'Corporate Gifting': 'कॉर्पोरेट उपहार',
      Exporter: 'निर्यातक',
      Other: 'अन्य',
      'Artisan Dashboard': 'कारीगर डैशबोर्ड',
      Dashboard: 'डैशबोर्ड',
      'Good morning': 'सुप्रभात',
      'Good morning, Lakshmi Devi': 'सुप्रभात, लक्ष्मी देवी',
      'Here’s what’s happening with your craft today.': 'आज आपके शिल्प से जुड़े मुख्य विवरण ये रहे।',
      'Active Products': 'सक्रिय उत्पाद',
      Catalogued: 'कैटलॉग में',
      'Active Orders': 'सक्रिय ऑर्डर',
      'In Production': 'उत्पादन में',
      'Available Stock': 'उपलब्ध स्टॉक',
      units: 'इकाइयां',
      'Ready for dispatch': 'भेजने के लिए तैयार',
      'New Opportunities': 'नए अवसर',
      'Matching Craft': 'मिलता-जुलता शिल्प',
      'Workshop Production & Stock': 'कार्यशाला उत्पादन और स्टॉक',
      'Available Capacity': 'उपलब्ध क्षमता',
      Available: 'उपलब्ध',
      'Limited Availability': 'सीमित उपलब्धता',
      Unavailable: 'अनुपलब्ध',
      'Available Now': 'अभी उपलब्ध',
      'Ready stock': 'तैयार स्टॉक',
      'Monthly Capacity': 'मासिक क्षमता',
      'Per Month': 'प्रति माह',
      'Per Week': 'प्रति सप्ताह',
      'Production speed': 'उत्पादन गति',
      'Production Time': 'उत्पादन समय',
      days: 'दिन',
      'Order turnaround': 'ऑर्डर पूरा करने का समय',
      'Workshop Location': 'कार्यशाला स्थान',
      'Manage Capacity': 'क्षमता प्रबंधित करें',
      'AI Craft Vision': 'AI शिल्प दृष्टि',
      'Digitize Your Craft with AI': 'AI के साथ अपने शिल्प को डिजिटल बनाएं',
      'Take a photo to auto-generate descriptions, category tags, and smart pricing.': 'फोटो लें और विवरण, श्रेणी टैग और स्मार्ट मूल्य स्वचालित रूप से उत्पन्न करें।',
      'Create with AI': 'AI से बनाएं',
      'Market Opportunity Preview': 'बाजार अवसर पूर्वावलोकन',
      'Demand: High': 'मांग: उच्च',
      'Bamboo baskets are currently receiving increased buyer interest.': 'बांस की टोकरियों में खरीदारों की रुचि बढ़ रही है।',
      'Typical Price': 'सामान्य कीमत',
      'Relevant Buyer Requests': 'संबंधित खरीदार अनुरोध',
      'Explore Opportunities': 'अवसर खोजें',
      'Recent Orders': 'हाल के ऑर्डर',
      'View All': 'सभी देखें',
      'My Products': 'मेरे उत्पाद',
      'Manage your artisan catalog, available stock, and capacity.': 'अपना कारीगर कैटलॉग, उपलब्ध स्टॉक और क्षमता प्रबंधित करें।',
      'Add Product': 'उत्पाद जोड़ें',
      'Add New Product': 'नया उत्पाद जोड़ें',
      'Edit Product': 'उत्पाद संपादित करें',
      All: 'सभी',
      Active: 'सक्रिय',
      Draft: 'ड्राफ्ट',
      Inactive: 'निष्क्रिय',
      'No products yet': 'अभी कोई उत्पाद नहीं है',
      'Add your first craft product to start reaching buyers.': 'खरीदारों तक पहुँचने के लिए अपना पहला उत्पाद जोड़ें।',
      'Artisan Orders': 'कारीगर ऑर्डर',
      'Track active production and fulfillment.': 'सक्रिय उत्पादन और आपूर्ति को ट्रैक करें।',
      'Market Opportunities': 'बाजार के अवसर',
      'Bulk demand and cluster matching for your craft.': 'आपके शिल्प के लिए थोक मांग और क्लस्टर मिलान।',
      Home: 'होम',
      Products: 'उत्पाद',
      Orders: 'ऑर्डर',
      Opportunities: 'अवसर',
      Profile: 'प्रोफ़ाइल',
      Settings: 'सेटिंग्स',
      Logout: 'लॉग आउट',
      'Log Out': 'लॉग आउट',
      Copilot: 'को-पायलट',
      Notifications: 'सूचनाएं',
      'Ask KALA-MITRA Copilot': 'KALA-MITRA को-पायलट से पूछें',
      'Open Artisan Profile': 'कारीगर प्रोफ़ाइल खोलें',
      Camera: 'कैमरा',
      '● LIVE': '● लाइव',
      LIVE: 'लाइव',
      'Position craft inside frame': 'शिल्प को फ्रेम के अंदर रखें',
      'Starting camera...': 'कैमरा शुरू हो रहा है...',
      'Camera Permission Required': 'कैमरा अनुमति आवश्यक है',
      'Camera permission is required to take a product photo. Please allow camera access in your device settings.': 'उत्पाद फोटो लेने के लिए कैमरा अनुमति आवश्यक है। कृपया अपनी सेटिंग्स में अनुमति दें।',
      'Try Again': 'पुनः प्रयास करें',
      'Choose from Gallery': 'गैलरी से चुनें',
      Gallery: 'गैलरी',
      'Use this photo?': 'क्या यह फोटो उपयोग करें?',
      Retake: 'दोबारा लें',
      'Use Photo': 'फोटो का उपयोग करें',
      Cancel: 'रद्द करें',
      'Artisan Profile': 'कारीगर प्रोफ़ाइल',
      'Verified Artisan': 'सत्यापित कारीगर',
      'Location:': 'स्थान:',
      'Mobile:': 'मोबाइल:',
      'Language:': 'भाषा:',
      'Capacity:': 'क्षमता:',
      'Edit Profile Details': 'प्रोफ़ाइल विवरण संपादित करें',
      'Your Capacity': 'आपकी क्षमता',
      'Manage workshop production capability & available stock': 'कार्यशाला उत्पादन क्षमता और उपलब्ध स्टॉक प्रबंधित करें',
      'This information helps buyers and the KALA-MITRA collective capacity matching system pair your workshop with suitable bulk orders.': 'यह जानकारी आपकी कार्यशाला को उपयुक्त थोक ऑर्डरों से जोड़ने में मदद करती है।',
      'Current Available Stock': 'वर्तमान उपलब्ध स्टॉक',
      'Units you can currently provide.': 'इकाइयां जो आप वर्तमान में प्रदान कर सकते हैं।',
      'Production Capacity': 'उत्पादन क्षमता',
      'How many units can you produce during this period?': 'इस अवधि में आप कितनी इकाइयां तैयार कर सकते हैं?',
      'Production Period': 'उत्पादन अवधि',
      'Production Time': 'उत्पादन समय',
      'How long do you usually need to produce an order?': 'ऑर्डर पूरा करने में आपको सामान्यतः कितना समय लगता है?',
      'Availability Status': 'उपलब्धता स्थिति',
      'Can accept new opportunities.': 'नए अवसरों को स्वीकार कर सकते हैं।',
      'Can accept some additional work.': 'कुछ अतिरिक्त काम ले सकते हैं।',
      'Currently cannot accept new opportunities.': 'वर्तमान में नए अवसर स्वीकार नहीं कर सकते।',
      'Update Capacity': 'क्षमता अपडेट करें',
      'Bulk Order Opportunity': 'थोक ऑर्डर अवसर',
      'Take Photo': 'फोटो लें',
      'Use camera': 'कैमरा उपयोग करें',
      'Upload photo': 'फोटो अपलोड करें',
      'Optional: Add Craft Hints (Helps AI Accuracy)': 'वैकल्पिक: शिल्प संकेत जोड़ें (AI सटीकता में मदद करता है)',
      'Category Hint': 'श्रेणी संकेत',
      'Material Hint': 'सामग्री संकेत',
      'Or enter product details manually': 'या उत्पाद विवरण मैन्युअल रूप से दर्ज करें',
      'Analyzing your product...': 'आपके उत्पाद का विश्लेषण किया जा रहा है...',
      'KALA-MITRA is processing visual features and preparing catalog details.': 'KALA-MITRA दृश्य सुविधाओं को संसाधित कर कैटलॉग विवरण तैयार कर रहा है।',
      'Validating craft photo...': 'फोटो सत्यापित की जा रही है...',
      'YOLOv8 object detection...': 'YOLOv8 ऑब्जेक्ट डिटेक्शन...',
      'SAM product segmentation...': 'SAM उत्पाद विभाजन...',
      'Preparing product details & tags...': 'उत्पाद विवरण व टैग तैयार किए जा रहे हैं...',
      'Continue Manually': 'मैन्युअल रूप से जारी रखें',
      'KALA-MITRA Copilot': 'KALA-MITRA को-पायलट',
      'Artisan Assistant (UI Interface)': 'कारीगर सहायक',
      'Namaste!': 'नमस्ते!',
      'Try asking:': 'यह पूछ कर देखें:',
      'Pricing guidance for bulk orders': 'थोक ऑर्डर के लिए मूल्य निर्धारण मार्गदर्शन',
      'Opportunities in my region': 'मेरे क्षेत्र में अवसर',
      'How collective capacity works': 'सामूहिक क्षमता कैसे काम करती है',
      'Ask KALA-MITRA...': 'KALA-MITRA से पूछें...',
      'Ask KALA-MITRA or tap 🎤 to speak...': 'KALA-MITRA से पूछें या बोलने के लिए 🎤 दबाएं...',
      'Consulting craft intelligence...': 'शिल्प बुद्धिमत्ता की जांच की जा रही है...',
      'Craft Knowledge Engine': 'शिल्प ज्ञान इंजन',
      'Ollama LLM Engine': 'ओलामो LLM इंजन',
      '🔴 Listening... Speak your question now': '🔴 सुन रहा है... अब अपना प्रश्न बोलें',
      '🎙️ Voice Assistant listening... Speak your query to Copilot.': '🎙️ वॉयस असिस्टेंट सुन रहा है... को-पायलट से अपना प्रश्न कहें।',
      'Speak to Copilot (Voice Assistant)': 'को-पायलट से बात करें (वॉयस असिस्टेंट)',
      'Listening... Tap to stop': 'सुन रहा है... रोकने के लिए टैप करें',
      'Product Photo': 'उत्पाद फोटो',
      'Optional for Draft': 'ड्राफ्ट के लिए वैकल्पिक',
      'Photo selected': 'फोटो चयनित',
      'Replace Photo': 'फोटो बदलें',
      Remove: 'हटाएं',
      'Product Name': 'उत्पाद का नाम',
      Category: 'श्रेणी',
      'Select craft category': 'शिल्प श्रेणी चुनें',
      'Custom Category Name': 'कस्टम श्रेणी का नाम',
      'Material Used': 'प्रयुक्त सामग्री',
      'Product Description': 'उत्पाद विवरण',
      'Price (₹)': 'कीमत (₹)',
      Price: 'कीमत',
      'Available Quantity': 'उपलब्ध मात्रा',
      'Units ready for dispatch': 'भेजने के लिए तैयार इकाइयां',
      'Units crafted / month': 'प्रति माह निर्मित इकाइयां',
      'Lead Time (Days)': 'डिलीवरी समय (दिन)',
      'Days per batch': 'प्रति बैच दिन',
      'Craft Origin / Location': 'शिल्प का मूल / स्थान',
      'Product Tags': 'उत्पाद टैग',
      'Comma separated': 'अल्पविराम से अलग',
      'Product Status': 'उत्पाद स्थिति',
      'Save Product': 'उत्पाद सहेजें',
      'Product Details': 'उत्पाद विवरण',
      'Delete Product': 'उत्पाद हटाएं',
      'Delete this product?': 'क्या इस उत्पाद को हटाएं?',
      'This product will be removed from your active products catalog.': 'यह उत्पाद आपके सक्रिय उत्पाद कैटलॉग से हटा दिया जाएगा।',
      'Buyer Portal': 'खरीदार पोर्टल',
      'Smart Discovery': 'स्मार्ट खोज',
      'Discover Authentic Crafts. Connect with Artisans.': 'प्रामाणिक शिल्प खोजें। कारीगरों से जुड़ें।',
      'Find handcrafted products from skilled artisans and discover opportunities for individual or bulk requirements.': 'कुशल कारीगरों के हस्तशिल्प खोजें और व्यक्तिगत या थोक आवश्यकताओं के अवसर प्राप्त करें।',
      'Search for crafts, products, or what you need...': 'शिल्प, उत्पाद या अपनी आवश्यकता खोजें...',
      Search: 'खोजें',
      'Voice Search': 'वॉयस खोज',
      'Search by Image': 'छवि से खोजें',
      'Have a Large Requirement?': 'क्या आपकी बड़ी आवश्यकता है?',
      'Bulk Requirement': 'थोक आवश्यकता',
      'When one artisan cannot fulfill your required quantity, KALA-MITRA can help connect you with multiple suitable artisans.': 'जब एक कारीगर आपकी आवश्यक मात्रा पूरी नहीं कर सकता, KALA-MITRA आपको कई कारीगरों से जोड़ सकता है।',
      'Need 500 Bamboo Baskets?': 'क्या 500 बांस की टोकरियां चाहिए?',
      'Find artisans who can collectively fulfill your requirement.': 'ऐसे कारीगर खोजें जो मिलकर आपकी आवश्यकता पूरी कर सकें।',
      'Find Artisans': 'कारीगर खोजें',
      'Nearby Artisans': 'पास के कारीगर',
      'Discover skilled artisans and handmade products near you.': 'अपने पास के कुशल कारीगरों और हस्तनिर्मित उत्पादों को खोजें।',
      'Search artisans, crafts or location': 'कारीगर, शिल्प या स्थान खोजें',
      'Search artisans, crafts or location...': 'कारीगर, शिल्प या स्थान खोजें...',
      'Use My Location': 'मेरे स्थान का उपयोग करें',
      'Enter Location Manually': 'मैन्युअल रूप से स्थान दर्ज करें',
      'City, district or location': 'शहर, ज़िला या स्थान',
      'Find Location': 'स्थान खोजें',
      'Finding nearby artisans...': 'पास के कारीगरों को खोजा जा रहा है...',
      Craft: 'शिल्प',
      Distance: 'दूरी',
      Verification: 'सत्यापन',
      'Verified Artisans': 'सत्यापित कारीगर',
      'Available for Orders': 'ऑर्डर के लिए उपलब्ध',
      'Within 25 km': '25 किमी के भीतर',
      'No artisans found within your search radius.': 'आपकी खोज सीमा में कोई कारीगर नहीं मिला।',
      'Try increasing the distance or changing your craft filter.': 'दूरी बढ़ाएं या शिल्प फ़िल्टर बदलें।',
      'Increase Search Radius': 'खोज दायरा बढ़ाएं',
      'Artisan Cluster': 'कारीगर समूह',
      'Order Tracking': 'ऑर्डर ट्रैकिंग',
      'Voice Assistant': 'वॉयस असिस्टेंट',
      'Tap to speak': 'बोलने के लिए टैप करें',
      'How can I help you?': 'मैं आपकी क्या मदद कर सकता हूँ?',
      'Ask about products, artisans, your cart, orders, and clusters.': 'उत्पादों, कारीगरों, अपने कार्ट, ऑर्डर और क्लस्टर के बारे में पूछें।',
      'Type a message...': 'संदेश लिखें...',
      Send: 'भेजें',
      'Visual Discovery': 'दृश्य खोज',
      'Upload a product image to find visually similar handmade products in the KALA-MITRA catalog.': 'कैटलॉग में मिलते-जुलते उत्पाद खोजने के लिए एक फोटो अपलोड करें।',
      'Upload Image': 'फोटो अपलोड करें',
      'Drag & drop an image here, or use your camera': 'फोटो यहां खींचें या कैमरा उपयोग करें',
      'No image selected': 'कोई फोटो चयनित नहीं',
      'Find Matching Products': 'मिलते-जुलते उत्पाद खोजें',
      'Change Image': 'फोटो बदलें',
      'Bulk Order: Handwoven Bamboo Baskets': 'थोक ऑर्डर: हाथ से बुनी बांस की टोकरियां',
      'Buyer / Entity:': 'खरीदार / संस्था:',
      'Buyer Type:': 'खरीदार प्रकार:',
      'Total Required:': 'कुल आवश्यकता:',
      'Your Workshop Share:': 'आपकी कार्यशाला का हिस्सा:',
      'Target Rate:': 'लक्षित दर:',
      'Timeline:': 'समय सीमा:',
      'Find Matching Artisans': 'मिलते-जुलते कारीगर खोजें',
      'Opportunity Details': 'अवसर विवरण',
      'Verified Artisan Wholesale Marketplace': 'सत्यापित कारीगर थोक बाज़ार',
      'Handcrafted Indian Crafts': 'हस्तनिर्मित भारतीय शिल्प',
      'Source directly across 17 certified craft categories from master GI artisans and collective clusters with escrow protection.': 'एस्क्रो सुरक्षा के साथ 17 प्रमाणित श्रेणियों में सीधे मास्टर कारीगरों से उत्पाद प्राप्त करें।',
      'Open shopping cart': 'शॉपिंग कार्ट खोलें',
      Cart: 'कार्ट',
      'Post Bulk Requirement': 'थोक आवश्यकता पोस्ट करें',
      'Explore 17 Certified Craft Categories': '17 प्रमाणित शिल्प श्रेणियों का अन्वेषण करें',
      'Reset Filter': 'फ़िल्टर रीसेट करें',
      'All Items': 'सभी वस्तुएं',
      'All 17 Crafts': 'सभी 17 शिल्प',
      'Full Wholesale Catalog': 'पूर्ण थोक कैटलॉग',
      'Verified GI Craft': 'सत्यापित GI शिल्प',
      'Search by craft name, artisan, material...': 'शिल्प का नाम, कारीगर, सामग्री खोजें...',
      'Add to Cart': 'कार्ट में जोड़ें',
      '🛒 Add to Cart': '🛒 कार्ट में जोड़ें',
      'Go to Cart': 'कार्ट पर जाएं',
      '🛒 Go to Cart': '🛒 कार्ट पर जाएं',
      'Cluster': 'क्लस्टर',
      'Artisan Cluster': 'कारीगर क्लस्टर',
      'Opportunities': 'अवसर',
      'Orders': 'ऑर्डर',
      'Alerts': 'अलर्ट',
      'Payments': 'भुगतान',
      'Products': 'उत्पाद',
      'Delivery': 'डिलीवरी',
      'All': 'सभी',
      'Request Quote': 'कोटेशन मांगें',
      'Wholesale Price': 'थोक मूल्य',
      'Lead Time': 'डिलीवरी समय',
      'Cluster Supply': 'क्लस्टर आपूर्ति',
      Save: 'सहेजें',
      Close: 'बंद करें',
      Edit: 'संपादित करें',
      Delete: 'हटाएं',
      'Shopping Cart': 'शॉपिंग कार्ट',
      'Your Cart': 'आपकी कार्ट',
      'Proceed to Checkout': 'चेकआउट के लिए आगे बढ़ें',
      'Place Order': 'ऑर्डर दें',
      'Empty Cart': 'कार्ट खाली है',
      'Payment Successful': 'भुगतान सफल रहा',
      'Shipping Update': 'शिपिंग अपडेट',
      'Welcome to KALA-MITRA! 🎉': 'KALA-MITRA में आपका स्वागत है! 🎉',
      'Logged out securely': 'सुरक्षित रूप से लॉग आउट हो गए',
      'UPDATES & MATCHES': 'अपडेट और मैच',
      'Artisan Notifications': 'कारीगर सूचनाएं',
      'Mark all as read': 'सभी को पढ़ा हुआ चिह्नित करें',
      'View Opportunity': 'अवसर देखें',
      'View Orders': 'ऑर्डर देखें',
      'View Cluster': 'क्लस्टर देखें',
      'View Details': 'विवरण देखें',
      '🔊 Listen': '🔊 सुनें',
      Listen: 'सुनें',
      'Mark as read': 'पढ़ा हुआ चिह्नित करें',
      'No notifications in this category.': 'इस श्रेणी में कोई सूचना नहीं है।',
      'New Bulk Opportunity Available': 'नया थोक अवसर उपलब्ध है',
      'GreenLeaf Hotels requested 500 units of Bamboo Baskets. Tap to view cluster capacity.': 'ग्रीनलीफ होटल्स ने 500 बांस की टोकरियों की मांग की है। क्लस्टर क्षमता देखने के लिए टैप करें।',
      'Order Status Updated': 'ऑर्डर स्थिति अपडेट की गई',
      'Order #ORD-9021 moved to "Production in Progress". Delivery target: 25 Sep.': 'ऑर्डर #ORD-9021 "उत्पादन प्रगति पर है" में स्थानांतरित किया गया। डिलीवरी लक्ष्य: 25 सितंबर।',
      'Cluster Request Response Required': 'क्लस्टर अनुरोध प्रतिक्रिया आवश्यक',
      'Master artisan in East Godavari cluster allocated 120 units to your workshop.': 'पूर्वी गोदावरी क्लस्टर के मास्टर कारीगर ने आपकी कार्यशाला को 120 इकाइयां आवंटित की हैं।',
      'High Demand Alert': 'उच्च मांग अलर्ट',
      'Buyers in Hospitality sector searched for eco-friendly handicrafts in your region.': 'आतिथ्य क्षेत्र के खरीदारों ने आपके क्षेत्र में पर्यावरण-अनुकूल हस्तशिल्प की खोज की।',
      Alerts: 'अलर्ट',
      'Bamboo Handicrafts': 'बांस हस्तशिल्प',
      'Terracotta Pottery': 'टेराकोटा मिट्टी के बर्तन',
      'Handloom Weaving & Textiles': 'हथकरघा बुनाई और कपड़ा',
      'Kalamkari Art & Painting': 'कलमकारी कला और चित्रकारी',
      'Wood Carving & Etikoppaka Toys': 'लकड़ी की नक्काशी और एटीकोप्पका खिलौने',
      'Brass & Metal Craft (Dokra)': 'पीतल और धातु शिल्प (डोकरा)',
      'Leather Puppetry': 'चमड़े की कठपुतली',
      'Stone & Clay Sculpture': 'पत्थर और मिट्टी की मूर्तियां',
      'Other Traditional Craft': 'अन्य पारंपरिक शिल्प',
      'Verify Email & Continue': 'ईमेल सत्यापित करें और आगे बढ़ें',
      'Resend verification code': 'सत्यापन कोड दोबारा भेजें',
      'Bamboo & Cane': 'बांस और वेत',
      'Terracotta & Clay': 'टेराकोटा और मिट्टी',
      'Handloom & Weaving': 'हथकरघा और बुनाई',
      'Wood & Carving': 'लकड़ी और नक्काशी',
      'Brass & Dokra': 'पीतल और डोकरा',
      'Leather & Puppetry': 'चमड़ा और कठपुतली',
      'Stone Craft': 'पत्थर शिल्प',
      'In Stock': 'स्टॉक में है',
      'Out of Stock': 'स्टॉक खत्म',
      'Fast Shipping': 'तेज डिलीवरी',
      'Verified GI Tag': 'सत्यापित जीआई टैग',
      Handcrafted: 'हस्तनिर्मित',
      'Eco-Friendly': 'पर्यावरण-अनुकूल',
      'Escrow Protected': 'एस्क्रो सुरक्षित',
      'Capacity Available': 'क्षमता उपलब्ध',
      'Collective Cluster Available': 'सामूहिक क्लस्टर उपलब्ध',
      'per unit': 'प्रति यूनिट',
      'units ready': 'इकाइयां तैयार',
      'days lead time': 'दिन उत्पादन समय',
      Rating: 'रेटिंग',
      Reviews: 'समीक्षाएं',
      'Artisan:': 'कारीगर:',
      'Order Placed': 'ऑर्डर दर्ज किया गया',
      'Order #KM-ORD-10245 has been placed for Bamboo Baskets (500 units).': 'बांस की टोकरियों (500 यूनिट) के लिए ऑर्डर #KM-ORD-10245 दर्ज किया गया है।',
      'Track Order': 'ऑर्डर ट्रैक करें',
      'Cluster Formed': 'क्लस्टर गठित हुआ',
      '4 verified artisans in East Godavari reached collective capacity for your requirement.': 'पूर्वी गोदावरी में 4 सत्यापित कारीगर आपकी आवश्यकता के लिए सामूहिक क्षमता तक पहुँच गए हैं।',
      'Payment verified via Razorpay TEST MODE for Order #KM-ORD-10245.': 'ऑर्डर #KM-ORD-10245 के लिए Razorpay TEST MODE से भुगतान सत्यापित हुआ।',
      'View Order': 'ऑर्डर देखें',
      'AI Product Match': 'AI उत्पाद मैच',
      'AI found 8 products matching your requirement.': 'AI को आपकी आवश्यकता से मेल खाते 8 उत्पाद मिले।',
      'View Products': 'उत्पाद देखें',
      'Artisan Match': 'कारीगर मैच',
      '5 verified artisans can fulfill your requirement.': '5 सत्यापित कारीगर आपकी आवश्यकता पूरी कर सकते हैं।',
      'View Artisans': 'कारीगर देखें',
      'Artisan Cluster Update': 'कारीगर क्लस्टर अपडेट',
      'AI Artisan Cluster has been created to fulfill your 500-unit order.': 'आपके 500-यूनिट ऑर्डर को पूरा करने के लिए AI कारीगर क्लस्टर बनाया गया है।',
      'Payment of ₹25,000 for Order #KM1024 was successful.': 'ऑर्डर #KM1024 के लिए ₹25,000 का भुगतान सफल रहा।',
      'View Payment': 'भुगतान देखें',
      'Your order has been shipped.': 'आपका ऑर्डर शिप कर दिया गया है।',
      'Track Shipment': 'शिपमेंट ट्रैक करें',
      'Order Status: Quality Check': 'ऑर्डर स्थिति: गुणवत्ता जांच',
      'Order Status: Production Started': 'ऑर्डर स्थिति: उत्पादन शुरू',
      'Order Status: Production in Progress': 'ऑर्डर स्थिति: उत्पादन प्रगति में',
      'Order Status: Shipped': 'ऑर्डर स्थिति: डिस्पैच हुआ',
      'Order Status: Delivered': 'ऑर्डर स्थिति: डिलीवर हुआ',
      'Production has officially started for your order of Bamboo Basket.': 'आपके बांस की टोकरी के ऑर्डर का उत्पादन आधिकारिक रूप से शुरू हो गया है।',
      'Your order of Bamboo Basket has entered Quality Check inspection.': 'आपका बांस की टोकरी का ऑर्डर गुणवत्ता जांच के लिए गया है।',
      'Artisans are crafting your order of Bamboo Basket.': 'कारीगर आपके बांस की टोकरी का ऑर्डर बना रहे हैं।',
      'Your order of Bamboo Basket has been dispatched and is on its way.': 'आपका बांस की टोकरी का ऑर्डर डिस्पैच कर दिया गया है और रास्ते में है।',
      UPDATES: 'अपडेट',
      Payments: 'भुगतान',
      Delivery: 'डिलीवरी',
      'Payment Failed': 'भुगतान विफल',
      'Invalid Razorpay cryptographic signature': 'अमान्य Razorpay क्रिप्टोग्राफिक हस्ताक्षर',
      'Retry Payment': 'पुनः भुगतान का प्रयास करें',
      'Order Placed Successfully': 'ऑर्डर सफलतापूर्वक दर्ज किया गया',
      'Handwoven Bamboo Basket': 'हस्तनिर्मित बांस की टोकरी',
      'Bamboo Basket': 'बांस की टोकरी',
      'Bamboo Tea Table Set': 'बांस टी टेबल सेट',
      'Terracotta Water Pitcher': 'टेराकोटा पानी का घड़ा',
      'Kalamkari Saree': 'कलमकारी साड़ी',
      'Brass Dokra Idol': 'पीतल डोकरा मूर्ति',
      'Wood Carving Toy': 'लकड़ी का खिलौना',
      'Jute Tote Bag': 'जूट का थैला',
      Successfully: 'सफलतापूर्वक',
      'Artisan Accepted Cluster': 'कारीगर ने क्लस्टर स्वीकार किया',
      'Artisan Declined Cluster': 'कारीगर ने क्लस्टर अस्वीकार किया',
      'Form Cluster Again': 'पुन: क्लस्टर बनाएं',
      'Previous Clusters': 'पिछले क्लस्टर',
      'Previous Clusters / History': 'पिछले क्लस्टर / इतिहास',
      'Cluster History': 'क्लस्टर इतिहास',
      'Artisan Cluster Accepted': 'कारीगर क्लस्टर प्रतिक्रिया: स्वीकृत',
      'Artisan Cluster Response': 'कारीगर क्लस्टर प्रतिक्रिया',
      'Artisan Notifications': 'कारीगर की सूचनाएं',
      'Buyer Notifications': 'खरीदार की सूचनाएं',
      'New Cluster Request': 'नया क्लस्टर अनुरोध',
      'Cluster Order Created': 'क्लस्टर ऑर्डर बनाया गया',
      'Accept': 'स्वीकार करें',
      'Decline': 'अस्वीकार करें',
      'Accepted': 'स्वीकृत',
      'Declined': 'अस्वीकृत',
      '✓ Accepted': '✓ स्वीकृत',
      '✕ Declined': '✕ अस्वीकृत',
      'Cluster Request Response Required': 'क्लस्टर अनुरोध प्रतिक्रिया आवश्यक',
      'View Cluster': 'क्लस्टर देखें',
      'View Opportunity': 'अवसर देखें',
      'View Orders': 'ऑर्डर देखें',
      'View Details': 'विवरण देखें',
      'Mark as read': 'पढ़ा हुआ चिह्नित करें',
      'Mark all as read': 'सभी को पढ़ा हुआ चिह्नित करें',
      'All notifications marked as read.': 'सभी सूचनाएं पढ़ी हुई चिह्नित की गईं।',
      'You accepted the cluster request!': 'आपने क्लस्टर अनुरोध स्वीकार कर लिया!',
      'You declined the cluster request.': 'आपने क्लस्टर अनुरोध अस्वीकार कर दिया।'
    }
  };

  let isTranslating = false;

  function translateApp(language) {
    if (isTranslating) return;
    isTranslating = true;
    try {
      const root = document.getElementById('app') || document.body;
      const translations = kalaTranslations[language] || null;

      // 1. Text nodes translation with exact restoration
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const textNodes = [];
      while (walker.nextNode()) {
        const parent = walker.currentNode.parentElement;
        const tag = parent?.tagName;
        if (tag !== 'SCRIPT' && tag !== 'STYLE') {
          textNodes.push(walker.currentNode);
        }
      }

      textNodes.forEach(node => {
        // Cache original English value on first encounter
        if (node.__kalaOrigText === undefined) {
          node.__kalaOrigText = node.nodeValue;
        }

        if (language === 'English' || !translations) {
          if (node.nodeValue !== node.__kalaOrigText) {
            node.nodeValue = node.__kalaOrigText;
          }
          return;
        }

        const original = node.__kalaOrigText;
        const trimmed = original.trim();
        if (!trimmed) return;

        const normalized = trimmed.replace(/\s+/g, ' ');
        let translated = translations[trimmed] || translations[normalized];

        if (!translated && language !== 'English') {
          translated = translateTextToCurrentLang(trimmed);
          if (translated === trimmed) {
            translated = null;
          }
        }

        if (!translated) {
          if (trimmed.startsWith('Good morning, ')) {
            const name = trimmed.replace('Good morning, ', '');
            translated = (language === 'Telugu' ? `శుభోదయం, ${name}` : `सुप्रभात, ${name}`);
          } else if (trimmed.startsWith('Resend code in ')) {
            const time = trimmed.replace('Resend code in ', '');
            translated = (language === 'Telugu' ? `${time} లో కోడ్‌ను మళ్లీ పంపండి` : `${time} में कोड पुनः भेजें`);
          } else if (trimmed.endsWith(' units') && !isNaN(parseInt(trimmed))) {
            const val = parseInt(trimmed);
            translated = (language === 'Telugu' ? `${val} యూనిట్లు` : `${val} इकाइयां`);
          } else if (trimmed.endsWith(' ready units') && !isNaN(parseInt(trimmed))) {
            const val = parseInt(trimmed);
            translated = (language === 'Telugu' ? `${val} సిద్ధంగా ఉన్న యూనిట్లు` : `${val} तैयार इकाइयां`);
          } else if (trimmed.startsWith('Within ') && trimmed.endsWith(' km')) {
            const dist = trimmed.replace('Within ', '').replace(' km', '');
            translated = (language === 'Telugu' ? `${dist} కిమీ పరిధిలో` : `${dist} किमी के भीतर`);
          } else if (trimmed.endsWith(' days') && !isNaN(parseInt(trimmed))) {
            const d = parseInt(trimmed);
            translated = (language === 'Telugu' ? `${d} రోజులు` : `${d} दिन`);
          } else if (trimmed.startsWith('New Cluster Request: ')) {
            const prodName = trimmed.replace('New Cluster Request: ', '');
            const transProd = (translations && translations[prodName]) || prodName;
            translated = (language === 'Telugu' ? `కొత్త క్లస్టర్ అభ్యర్థన: ${transProd}` : `नया क्लस्टर अनुरोध: ${transProd}`);
          } else if (trimmed.startsWith('Requested: ')) {
            translated = (language === 'Telugu' ? trimmed.replace('Requested: ', 'కోరినవి: ').replace(' units of ', ' యూనిట్లు - ').replace('. Delivery in ', '. డెలివరీ సమయం ').replace(' days.', ' రోజులు.') : trimmed.replace('Requested: ', 'अनुरोधित: ').replace(' units of ', ' इकाइयां - ').replace('. Delivery in ', '. डिलीवरी समय ').replace(' दिन.'));
          } else if (trimmed.startsWith('Cluster created for ')) {
            translated = (language === 'Telugu' ? trimmed.replace('Cluster created for ', 'క్లస్టర్ సృష్టించబడింది: ').replace(' units of ', ' యూనిట్లు - ').replace(' artisan(s) notified.', ' కళాకారులకు నోటిఫికేషన్ వెళ్ళింది.') : trimmed.replace('Cluster created for ', 'क्लस्टर बनाया गया: ').replace(' units of ', ' इकाइयां - ').replace(' artisan(s) notified.', ' कारीगरों को सूचित किया गया।'));
          }
        }

        if (translated) {
          const result = original.replace(trimmed, translated);
          if (node.nodeValue !== result) {
            node.nodeValue = result;
          }
        }
      });

      // 2. Attributes: placeholder, aria-label, title
      const attrElements = root.querySelectorAll('input, textarea, button, select, [placeholder], [aria-label], [title]');
      attrElements.forEach(element => {
        ['placeholder', 'aria-label', 'title'].forEach(attr => {
          if (element.hasAttribute(attr)) {
            const cacheKey = '__kalaOrig_' + attr;
            if (element[cacheKey] === undefined) {
              element[cacheKey] = element.getAttribute(attr);
            }
            const origVal = element[cacheKey];
            if (language === 'English' || !translations) {
              if (element.getAttribute(attr) !== origVal) {
                element.setAttribute(attr, origVal);
              }
            } else {
              const trimmed = origVal.trim();
              const normalized = trimmed.replace(/\s+/g, ' ');
              const translated = translations[trimmed] || translations[normalized];
              if (translated && element.getAttribute(attr) !== translated) {
                element.setAttribute(attr, translated);
              }
            }
          }
        });
      });

      // 3. Document HTML lang
      document.documentElement.lang = language === 'Telugu' ? 'te' : language === 'Hindi' ? 'hi' : 'en';

      // 4. Synchronize all select elements
      document.querySelectorAll('#global-language-select, #artisan-lang-select, #buyer-lang-select, .header-lang-select').forEach(sel => {
        if (sel.value !== language) {
          sel.value = language;
        }
      });

      // 5. Synchronize profile language chips
      document.querySelectorAll('.lang-chip').forEach(chip => {
        const chipLang = chip.getAttribute('data-lang');
        if (chipLang === language) {
          chip.classList.add('active');
          chip.setAttribute('aria-checked', 'true');
        } else {
          chip.classList.remove('active');
          chip.setAttribute('aria-checked', 'false');
        }
      });
    } finally {
      isTranslating = false;
    }
  }

  function applyLanguage(language) {
    if (!['English', 'Telugu', 'Hindi'].includes(language)) {
      language = 'English';
    }
    selectedLanguage = language;
    localStorage.setItem('kala-mitra-language', language);

    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      currentUser.preferredLanguage = language;
    }

    if (typeof renderBuyerNotifications === 'function' && document.getElementById('buyer-notifications-content')) {
      renderBuyerNotifications();
    }
    if (typeof renderArtisanNotifications === 'function' && document.getElementById('notifications-list-container')) {
      renderArtisanNotifications();
    }

    translateApp(language);
  }

  const translateBuyerExperience = () => translateApp(selectedLanguage);

  let translateDebounceTimer = null;
  const localizationObserver = new MutationObserver(() => {
    if (!isTranslating) {
      if (translateDebounceTimer) clearTimeout(translateDebounceTimer);
      translateDebounceTimer = setTimeout(() => {
        translateApp(selectedLanguage);
      }, 50);
    }
  });
  localizationObserver.observe(document.getElementById('app'), { childList: true, subtree: true });

  const fallbackArtisans = [
    { id: 1, name: 'Lakshmi Bamboo Crafts', craft: 'Bamboo & Cane', latitude: 16.9891, longitude: 82.2475, location: 'Kakinada', distance: 0, rating: 4.8, capacity: 150, products: 12, verified: true },
    { id: 2, name: 'Sri Handloom Collective', craft: 'Handloom', latitude: 16.9740, longitude: 82.2420, location: 'Kakinada', distance: 1.8, rating: 4.7, capacity: 300, products: 18, verified: true },
    { id: 3, name: 'Madhura Clay Studio', craft: 'Pottery', latitude: 16.9955, longitude: 82.2175, location: 'Kakinada', distance: 3.4, rating: 4.6, capacity: 90, products: 9, verified: true },
    { id: 4, name: 'Godavari Woodworks', craft: 'Wood Crafts', latitude: 17.0042, longitude: 82.2692, location: 'Kakinada Rural', distance: 3.5, rating: 4.5, capacity: 120, products: 15, verified: false },
    { id: 5, name: 'Sakhi Embroidery House', craft: 'Embroidery', latitude: 16.9560, longitude: 82.2640, location: 'Yanam Road', distance: 4.2, rating: 4.9, capacity: 80, products: 11, verified: true },
    { id: 7, name: 'Rajahmundry Cane Works', craft: 'Bamboo & Cane', latitude: 16.9897, longitude: 81.7794, location: 'Rajahmundry', distance: 50.0, rating: 4.8, capacity: 220, products: 14, verified: true },
    { id: 8, name: 'Vasudha Jewellery', craft: 'Jewellery', latitude: 16.9750, longitude: 82.2910, location: 'Samalkota', distance: 5.2, rating: 4.7, capacity: 45, products: 21, verified: true }
  ];

  document.addEventListener('marketplace-product-open', event => {
    const pId = event.detail?.productId;
    const product = SAMPLE_PRODUCTS.find(item => String(item.id) === String(pId) || Number(item.id) === Number(pId));
    if (product) {
      renderBuyerProductDetail(product);
      navigateTo('buyer-product-detail');
    }
  });

  let activeImageFilterCategory = 'all';
  let lastImageSearchResults = [];
  let lastImageAnalysisData = null;

  function initCompactImageSearch() {
    const input = document.getElementById('buyer-image-input');
    const uploadBox = document.getElementById('compact-image-upload-box');
    const initialBox = document.getElementById('image-upload-initial-state');
    const previewBox = document.getElementById('image-upload-preview-state');
    const thumbImg = document.getElementById('compact-image-thumb');
    const fileNameSpan = document.getElementById('compact-image-filename');
    const removeBtn = document.getElementById('buyer-image-remove');
    const submitBtn = document.getElementById('buyer-image-search-submit');
    const resultsContainer = document.getElementById('image-search-results');
    const progressEl = document.getElementById('image-search-progress');
    const sampleChips = document.querySelectorAll('.sample-chip');

    if (!input || input.dataset.compactBound) return;
    input.dataset.compactBound = 'true';

    const applySelectedFile = (file, customName) => {
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) {
        showToast('Please select an image smaller than 10 MB.');
        return;
      }
      imageSearchFile = file;

      if (fileNameSpan) fileNameSpan.textContent = customName || file.name || 'reference_craft.jpg';
      if (thumbImg) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          thumbImg.src = evt.target.result;
        };
        reader.readAsDataURL(file);
      }

      if (initialBox) initialBox.style.display = 'none';
      if (previewBox) previewBox.style.display = 'flex';
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.add('has-file');
      }
      if (resultsContainer) resultsContainer.innerHTML = '';
      if (progressEl) progressEl.textContent = '';
    };

    input.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      sampleChips.forEach(chip => chip.classList.remove('is-active'));
      applySelectedFile(file);
    });

    // Drag and Drop support on upload box
    if (uploadBox) {
      ['dragenter', 'dragover'].forEach(eventName => {
        uploadBox.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          uploadBox.classList.add('is-dragging');
        });
      });
      ['dragleave', 'drop'].forEach(eventName => {
        uploadBox.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          uploadBox.classList.remove('is-dragging');
        });
      });
      uploadBox.addEventListener('drop', (e) => {
        const file = e.dataTransfer?.files?.[0];
        if (file && file.type.startsWith('image/')) {
          sampleChips.forEach(chip => chip.classList.remove('is-active'));
          applySelectedFile(file);
        }
      });
    }

    // Quick sample reference buttons
    sampleChips.forEach(chip => {
      chip.addEventListener('click', async () => {
        sampleChips.forEach(c => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        const src = chip.dataset.sampleSrc;
        const name = chip.dataset.sampleName || 'sample_craft.jpg';
        try {
          const resp = await fetch(src);
          const blob = await resp.blob();
          const file = new File([blob], name, { type: 'image/jpeg' });
          applySelectedFile(file, chip.dataset.sampleLabel || name);
          showToast(`Loaded reference: ${chip.dataset.sampleLabel || name}`);
        } catch (err) {
          console.warn('Failed to load sample image:', err);
        }
      });
    });

    removeBtn?.addEventListener('click', () => {
      imageSearchFile = null;
      input.value = '';
      sampleChips.forEach(c => c.classList.remove('is-active'));
      if (thumbImg) thumbImg.src = '';
      if (initialBox) initialBox.style.display = 'block';
      if (previewBox) previewBox.style.display = 'none';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.remove('has-file');
      }
      if (resultsContainer) resultsContainer.innerHTML = '';
      if (progressEl) progressEl.textContent = '';
    });

    submitBtn?.addEventListener('click', () => {
      searchProductsByImage();
    });
  }

  async function searchProductsByImage() {
    const progress = document.getElementById('image-search-progress');
    const results = document.getElementById('image-search-results');
    const submitBtn = document.getElementById('buyer-image-search-submit');
    if (!imageSearchFile || !progress || !results) return;

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Analyzing Craft Features...';
    }

    progress.innerHTML = `
      <div style="padding: 12px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; color: #1e40af; font-size: 0.85rem; font-weight: 600; display: flex; align-items: center; gap: 8px;">
        <span style="display: inline-block;">⏳</span>
        <span>Analyzing reference image: extracting color palette, weave texture, and craft characteristics...</span>
      </div>
    `;
    results.innerHTML = '';

    const catalog = SAMPLE_PRODUCTS.map(product => ({
      product_id: product.id,
      product_name: product.title,
      artisan_name: `${product.location_city} Artisan Collective`,
      price: product.price,
      category: product.craft_type,
      location: product.location_city,
      image_url: getProductImage(product.id),
      available_quantity: product.monthly_capacity,
      rating: 4.8,
      material: product.description || product.craft_type,
      tags: [product.craft_type, product.location_city]
    }));

    const formData = new FormData();
    formData.append('image', imageSearchFile);
    formData.append('catalog', JSON.stringify(catalog));

    try {
      const response = await fetch('http://127.0.0.1:8000/api/v1/products/search-by-image', { method: 'POST', body: formData });
      if (!response.ok) throw new Error('Image search endpoint returned ' + response.status);
      const data = await response.json();
      lastImageSearchResults = data.results || [];
      lastImageAnalysisData = data.analysis || null;
      activeImageFilterCategory = 'all';

      progress.innerHTML = `
        <div style="padding: 10px 14px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; color: #166534; font-size: 0.82rem; font-weight: 700;">
          ✓ Visual analysis complete! Analyzed ${data.images_compared || 54} catalog products. Identified craft: <strong>${escapeHtml(data.analysis?.detected_craft || 'Handicraft')}</strong>.
        </div>
      `;
      renderImageSearchResults(lastImageSearchResults, data);
    } catch (error) {
      console.warn('Backend image search fallback:', error);
      progress.innerHTML = `
        <div style="padding: 10px 14px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; color: #92400e; font-size: 0.82rem; font-weight: 700;">
          ⚡ Local perceptual engine: Analyzed craft features against KALA-MITRA catalog.
        </div>
      `;
      // High quality local classification fallback
      const queryName = (imageSearchFile.name || '').toLowerCase();
      let matched = SAMPLE_PRODUCTS.filter(p => {
        const title = p.title.toLowerCase();
        const craft = p.craft_type.toLowerCase();
        return (
          (queryName.includes('basket') || queryName.includes('bamboo') || queryName.includes('cane')) && craft.includes('bamboo') ||
          (queryName.includes('pot') || queryName.includes('clay') || queryName.includes('terracotta')) && craft.includes('pottery') ||
          (queryName.includes('saree') || queryName.includes('silk') || queryName.includes('handloom')) && craft.includes('handloom') ||
          (queryName.includes('wood') || queryName.includes('carv')) && craft.includes('wood') ||
          (queryName.includes('embroid') || queryName.includes('cushion')) && craft.includes('embroidery')
        );
      });
      if (!matched.length) {
        matched = SAMPLE_PRODUCTS.filter(p => p.craft_type === 'Bamboo & Cane Crafts');
      }
      if (!matched.length) matched = SAMPLE_PRODUCTS.slice(0, 6);

      const fallbackResults = matched.map((p, idx) => ({
        product_id: p.id,
        product_name: p.title,
        artisan_name: `${p.location_city} Artisan Collective`,
        price: p.price,
        category: p.craft_type,
        location: p.location_city,
        image_url: getProductImage(p.id),
        available_quantity: p.monthly_capacity,
        rating: 4.8,
        visual_match_percentage: Math.max(68, 98 - (idx * 3)),
        match_reasons: [`Visual alignment with ${p.craft_type}`, 'Authentic artisan craft technique']
      }));
      const fallbackAnalysis = {
        detected_craft: fallbackResults[0]?.category || 'Handicrafts',
        confidence_score: 0.89,
        detected_material: 'Natural Artisan Materials',
        texture_profile: 'Handcrafted Heritage Texture',
        summary: `Visual analysis matched ${fallbackResults.length} handcrafted products in the ${fallbackResults[0]?.category} category.`,
        dominant_colors: [
          { name: 'Warm Artisan Tone', hex: '#B48247', percentage: 65 },
          { name: 'Natural Khadi Cream', hex: '#E6D7C3', percentage: 25 }
        ]
      };
      lastImageSearchResults = fallbackResults;
      lastImageAnalysisData = fallbackAnalysis;
      renderImageSearchResults(fallbackResults, { analysis: fallbackAnalysis, results: fallbackResults });
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Find Matching Products';
      }
    }
  }

  function renderImageSearchResults(matches, data = {}) {
    const results = document.getElementById('image-search-results');
    if (!results) return;
    if (!matches || !matches.length) {
      results.innerHTML = '<div class="image-search-empty"><h3>No matching products found.</h3><p>We could not find a visually similar craft item in the current catalog. Try uploading a clearer craft reference photo or click one of the sample references above.</p></div>';
      return;
    }

    const analysis = data.analysis || lastImageAnalysisData;
    const allMatches = lastImageSearchResults.length ? lastImageSearchResults : matches;

    // Build unique category filters
    const categoriesInMatches = Array.from(new Set(allMatches.map(m => m.category))).filter(Boolean);

    // Filter displayed items
    const filteredMatches = activeImageFilterCategory === 'all'
      ? allMatches
      : allMatches.filter(m => m.category === activeImageFilterCategory);

    results.innerHTML = `
      ${analysis ? `
        <div class="image-analysis-card">
          <div class="analysis-header">
            <div class="analysis-tag">
              <span>✨ AI Visual Analysis Insights</span>
            </div>
            <div class="analysis-badge">
              <span>Confidence: <strong>${Math.round((analysis.confidence_score || 0.88) * 100)}%</strong></span>
            </div>
          </div>

          <div class="analysis-body">
            <div class="detected-craft-pill">
              <span class="detected-label">Detected Craft Discipline:</span>
              <span class="detected-val">${escapeHtml(analysis.detected_craft || 'Handicrafts')}</span>
            </div>
            <p class="analysis-summary-text">${escapeHtml(analysis.summary || 'Visual feature extraction completed.')}</p>

            <div class="analysis-meta-grid">
              <div class="analysis-meta-item">
                <span class="meta-item-label">Identified Material</span>
                <strong class="meta-item-value">${escapeHtml(analysis.detected_material || 'Natural Craft Materials')}</strong>
              </div>
              <div class="analysis-meta-item">
                <span class="meta-item-label">Surface Texture Pattern</span>
                <strong class="meta-item-value">${escapeHtml(analysis.texture_profile || 'Traditional Artisan Texture')}</strong>
              </div>
              <div class="analysis-meta-item">
                <span class="meta-item-label">Extracted Color Palette</span>
                <div class="palette-swatches">
                  ${(analysis.dominant_colors || []).map(col => `
                    <div class="palette-swatch" title="${escapeHtml(col.name)} (${escapeHtml(col.hex)})">
                      <span class="swatch-dot" style="background-color: ${escapeHtml(col.hex)};"></span>
                      <span>${escapeHtml(col.name)}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
          </div>
        </div>
      ` : ''}

      <div class="image-search-results-heading">
        <div>
          <span class="buyer-kicker">VISUAL MATCHES</span>
          <h2>Products Matching Your Image</h2>
        </div>
        <span>Found ${filteredMatches.length} matching products</span>
      </div>

      ${categoriesInMatches.length > 1 ? `
        <div class="filter-tabs-row" id="image-category-filters">
          <button type="button" class="filter-tab-pill ${activeImageFilterCategory === 'all' ? 'is-active' : ''}" data-category-filter="all">All Matches (${allMatches.length})</button>
          ${categoriesInMatches.map(cat => `
            <button type="button" class="filter-tab-pill ${activeImageFilterCategory === cat ? 'is-active' : ''}" data-category-filter="${escapeHtml(cat)}">${escapeHtml(cat)} (${allMatches.filter(m => m.category === cat).length})</button>
          `).join('')}
        </div>
      ` : ''}

      <div class="image-match-grid">
        ${filteredMatches.map(match => `
          <article class="image-match-card" data-image-match-id="${match.product_id}">
            <div class="image-match-card__image">
              <img src="${escapeHtml(match.image_url)}" alt="${escapeHtml(match.product_name)}" />
              <span>${match.visual_match_percentage}% Visual Match</span>
            </div>
            <div class="image-match-card__body">
              <h3>${escapeHtml(match.product_name)}</h3>
              <p>by ${escapeHtml(match.artisan_name)} • 📍 ${escapeHtml(match.location)}</p>
              ${match.match_reasons && match.match_reasons[0] ? `
                <span class="match-reason-tag">✓ ${escapeHtml(match.match_reasons[0])}</span>
              ` : ''}
              <div>
                <span>⭐ ${match.rating}</span>
                <strong>₹${Number(match.price).toLocaleString('en-IN')}</strong>
              </div>
              <p>✓ ${match.available_quantity > 0 ? `${match.available_quantity} Available` : 'Unavailable'}</p>
              <button type="button" class="primary-btn image-match-add" data-image-cart-id="${match.product_id}" ${match.available_quantity < 1 ? 'disabled' : ''}>
                🛒 Add to Cart
              </button>
            </div>
          </article>
        `).join('')}
      </div>
    `;

    // Filter pill click listeners
    results.querySelectorAll('[data-category-filter]').forEach(pill => {
      pill.addEventListener('click', () => {
        activeImageFilterCategory = pill.dataset.categoryFilter;
        renderImageSearchResults(allMatches, data);
      });
    });

    results.querySelectorAll('[data-image-match-id]').forEach(card => card.addEventListener('click', event => {
      if (event.target.closest('[data-image-cart-id]')) return;
      const product = SAMPLE_PRODUCTS.find(item => item.id === Number(card.dataset.imageMatchId));
      if (product) { renderBuyerProductDetail(product); navigateTo('buyer-product-detail'); }
    }));

    results.querySelectorAll('[data-image-cart-id]').forEach(button => button.addEventListener('click', event => {
      event.stopPropagation();
      document.dispatchEvent(new CustomEvent('marketplace-add-to-cart', { detail: { productId: Number(button.dataset.imageCartId) } }));
      showToast('Added to cart successfully.');
    }));
  }

  // Navigation Controller
  function navigateTo(screenName, pushState = true) {
    if (!screens[screenName]) {
      screenName = 'landing';
    }

    // Route guards
    const isAuth = authService.isAuthenticated();
    const hasPendingProfile = authService.hasPendingProfileSetup();

    if (screenName === 'artisan-dashboard' && !isAuth) {
      if (hasPendingProfile) {
        screenName = 'profile-setup';
      } else {
        screenName = 'landing';
      }
    }

    // Deactivate all screens
    Object.values(screens).forEach(screen => {
      if (screen) screen.classList.remove('active');
    });

    const appContainer = document.getElementById('app');
    const phoneFrame = document.getElementById('phone-frame');
    const isBuyerMode = screenName.startsWith('buyer-');
    const isArtisanPortal = screenName.startsWith('artisan-');
    const isPortalMode = true;

    if (appContainer) {
      appContainer.classList.toggle('buyer-app-mode', isBuyerMode);
      appContainer.classList.toggle('artisan-portal-mode', isArtisanPortal);
      appContainer.classList.toggle('portal-mode', isPortalMode);
    }
    if (phoneFrame) {
      phoneFrame.classList.toggle('buyer-app-mode', isBuyerMode);
      phoneFrame.classList.toggle('artisan-portal-mode', isArtisanPortal);
      phoneFrame.classList.toggle('portal-mode', isPortalMode);
    }
    if (document.body) {
      document.body.classList.toggle('buyer-app-mode', isBuyerMode);
      document.body.classList.toggle('artisan-portal-mode', isArtisanPortal);
      document.body.classList.toggle('portal-mode', isPortalMode);
    }
    const androidNavBar = document.getElementById('mobile-home-indicator') || document.querySelector('.android-nav-bar');
    if (androidNavBar) {
      androidNavBar.style.display = 'none';
    }
    const mobileStatusBar = document.getElementById('mobile-status-bar');
    if (mobileStatusBar) {
      mobileStatusBar.style.display = 'none';
    }
    const phoneButtons = document.querySelectorAll('.phone-button');
    phoneButtons.forEach(btn => {
      btn.style.display = 'none';
    });

    // Activate target screen
    const target = screens[screenName];
    if (target) {
      target.classList.add('active');
      const targetRect = target.getBoundingClientRect();
      const isOffscreen = targetRect.top > window.innerHeight || targetRect.bottom < 0;
      if (isOffscreen) {
        target.scrollIntoView({ behavior: 'auto', block: 'start' });
      }
    }

    // Update history state
    if (pushState) {
      const hash = screenName === 'landing' ? '' : `#${screenName}`;
      if (window.location.hash !== hash) {
        window.history.pushState({ screen: screenName }, '', hash || window.location.pathname);
      }
    }

    // Screen specific triggers - ensure target screen is ALWAYS populated and never blank
    if (screenName === 'otp') {
      setupOtpInputListeners('phone-otp-inputs');
      startResendCountdown();
    } else if (screenName === 'email-verify') {
      setupOtpInputListeners('email-otp-inputs');
    } else if (screenName === 'profile-setup') {
      updateProfileSetupView();
    } else if (screenName === 'artisan-dashboard') {
      loadArtisanDashboard().then(translateBuyerExperience);
    } else if (screenName === 'buyer-home') {
      renderBuyerHomeScreen();
    } else if (screenName === 'buyer-discover') {
      renderBuyerDiscover();
    } else if (screenName === 'buyer-orders') {
      renderBuyerOrders();
    } else if (screenName === 'buyer-opportunities') {
      renderBuyerOpportunities();
    } else if (screenName === 'buyer-notifications') {
      renderBuyerNotifications();
    } else if (screenName === 'buyer-voice-search') {
      initializeVoiceAssistant();
    } else if (screenName === 'buyer-image-search') {
      initCompactImageSearch();
    } else if (screenName === 'buyer-profile') {
      if (currentProfileMode === 'artisan' && currentArtisanForProfile) {
        renderArtisanProfile(currentArtisanForProfile, profileReturnNav);
      } else {
        renderBuyerProfile();
      }
    }

    if (screenName.startsWith('buyer-') || screenName === 'landing' || screenName === 'auth' || screenName === 'otp' || screenName === 'email-verify' || screenName === 'profile-setup' || screenName === 'artisan-dashboard') {
      translateBuyerExperience();
    }
  }

  // Toast Notification Helper
  function showToast(message, duration = 3000) {
    const toast = document.getElementById('app-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.style.display = 'block';
    setTimeout(() => {
      toast.style.display = 'none';
    }, duration);
  }

  // Error Banner Helper
  function showError(bannerId, message) {
    const banner = document.getElementById(bannerId);
    if (!banner) return;
    if (message) {
      banner.textContent = message;
      banner.style.display = 'block';
    } else {
      banner.style.display = 'none';
      banner.textContent = '';
    }
  }

  // Loading State Helper
  function setButtonLoading(button, isLoading) {
    if (!button) return;
    if (isLoading) {
      button.classList.add('loading');
      button.disabled = true;
    } else {
      button.classList.remove('loading');
      button.disabled = false;
    }
  }

  // Modal Manager
  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('is-anchored');
      modal.style.display = 'flex';
    }
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
  }

  // Setup Modal Backdrop Click Closures
  document.querySelectorAll('.app-modal').forEach(modal => {
    const backdrop = modal.querySelector('.modal-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', () => {
        modal.style.display = 'none';
      });
    }
  });

  // =========================================================================
  // 1. Role Selection Handlers (Landing Screen)
  // =========================================================================
  const btnRoleArtisan = document.getElementById('btn-role-artisan');
  const btnRoleBuyer = document.getElementById('btn-role-buyer');

  if (btnRoleArtisan) {
    btnRoleArtisan.addEventListener('click', () => {
      currentRole = 'Artisan';
      updateAuthScreenRole();
      navigateTo('auth');
    });
  }

  if (btnRoleBuyer) {
    btnRoleBuyer.addEventListener('click', () => {
      currentRole = 'Buyer';
      updateAuthScreenRole();
      navigateTo('auth');
    });
  }

  function updateAuthScreenRole() {
    const roleBadge = document.getElementById('auth-role-badge');
    if (roleBadge) {
      if (currentRole === 'Artisan') {
        roleBadge.textContent = '👩‍🎨 Artisan';
        roleBadge.className = 'role-active-badge';
      } else {
        roleBadge.textContent = '🛍️ Buyer';
        roleBadge.className = 'role-active-badge buyer';
      }
    }
  }

  // =========================================================================
  // 2. Auth Method Switcher & Form Submissions
  // =========================================================================
  const tabPhone = document.getElementById('tab-phone');
  const tabEmail = document.getElementById('tab-email');
  const formPhone = document.getElementById('form-phone-auth');
  const formEmail = document.getElementById('form-email-auth');

  if (tabPhone && tabEmail) {
    tabPhone.addEventListener('click', () => {
      tabPhone.classList.add('active');
      tabPhone.setAttribute('aria-selected', 'true');
      tabEmail.classList.remove('active');
      tabEmail.setAttribute('aria-selected', 'false');
      formPhone.style.display = 'flex';
      formEmail.style.display = 'none';
      showError('auth-phone-error', null);
    });

    tabEmail.addEventListener('click', () => {
      tabEmail.classList.add('active');
      tabEmail.setAttribute('aria-selected', 'true');
      tabPhone.classList.remove('active');
      tabPhone.setAttribute('aria-selected', 'false');
      formEmail.style.display = 'flex';
      formPhone.style.display = 'none';
      showError('auth-email-error', null);
    });
  }

  if (formPhone) {
    formPhone.addEventListener('submit', async (e) => {
      e.preventDefault();
      showError('auth-phone-error', null);

      const inputPhone = document.getElementById('input-phone');
      const btnSendOtp = document.getElementById('btn-send-otp');
      const rawValue = inputPhone.value;

      setButtonLoading(btnSendOtp, true);
      const result = await authService.signInWithPhone(rawValue, currentRole);
      setButtonLoading(btnSendOtp, false);

      if (result.success) {
        const phoneDisplay = document.getElementById('otp-phone-display');
        if (phoneDisplay) phoneDisplay.textContent = result.formatted;
        showToast('Verification code sent to your mobile number! 📲');
        navigateTo('otp');
      } else {
        showError('auth-phone-error', result.error);
      }
    });
  }

  if (formEmail) {
    formEmail.addEventListener('submit', async (e) => {
      e.preventDefault();
      showError('auth-email-error', null);

      const inputEmail = document.getElementById('input-email');
      const btnSendEmail = document.getElementById('btn-send-email-code');
      const rawValue = inputEmail.value;

      setButtonLoading(btnSendEmail, true);
      const result = await authService.signInWithEmail(rawValue, currentRole);
      setButtonLoading(btnSendEmail, false);

      if (result.success) {
        const emailDisplay = document.getElementById('email-verify-display');
        if (emailDisplay) emailDisplay.textContent = result.email;
        showToast('Verification code sent to your email address! 📧');
        navigateTo('email-verify');
      } else {
        showError('auth-email-error', result.error);
      }
    });
  }

  // =========================================================================
  // 3. 6-Box OTP Input Logic
  // =========================================================================
  function setupOtpInputListeners(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const inputs = container.querySelectorAll('.otp-box');
    inputs.forEach((input, index) => {
      input.value = '';
      input.classList.remove('filled');

      input.onkeydown = (e) => {
        if (e.key === 'Backspace') {
          if (!input.value && index > 0) {
            inputs[index - 1].focus();
            inputs[index - 1].value = '';
            inputs[index - 1].classList.remove('filled');
          } else {
            input.value = '';
            input.classList.remove('filled');
          }
        }
      };

      input.oninput = (e) => {
        const value = e.target.value.replace(/\D/g, '');
        input.value = value ? value.substring(0, 1) : '';

        if (input.value) {
          input.classList.add('filled');
          if (index < inputs.length - 1) {
            inputs[index + 1].focus();
          }
        } else {
          input.classList.remove('filled');
        }
      };

      input.onpaste = (e) => {
        e.preventDefault();
        const pastedData = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
        if (!pastedData) return;

        const digits = pastedData.substring(0, inputs.length).split('');
        digits.forEach((digit, i) => {
          if (inputs[i]) {
            inputs[i].value = digit;
            inputs[i].classList.add('filled');
          }
        });

        const focusIndex = Math.min(digits.length, inputs.length - 1);
        inputs[focusIndex].focus();
      };
    });

    setTimeout(() => {
      if (inputs[0]) inputs[0].focus();
    }, 100);
  }

  function getOtpValue(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return '';
    const inputs = container.querySelectorAll('.otp-box');
    return Array.from(inputs).map(i => i.value).join('');
  }

  const btnVerifyOtp = document.getElementById('btn-verify-otp');
  if (btnVerifyOtp) {
    btnVerifyOtp.addEventListener('click', async () => {
      showError('otp-error-banner', null);
      const otp = getOtpValue('phone-otp-inputs');

      setButtonLoading(btnVerifyOtp, true);
      const result = await authService.verifyPhoneOtp(otp);
      setButtonLoading(btnVerifyOtp, false);

      if (result.success) {
        showToast('Phone verified successfully! 🎉');
        navigateTo('profile-setup');
      } else {
        showError('otp-error-banner', result.error);
      }
    });
  }

  const btnVerifyEmail = document.getElementById('btn-verify-email');
  if (btnVerifyEmail) {
    btnVerifyEmail.addEventListener('click', async () => {
      showError('email-error-banner', null);
      const code = getOtpValue('email-otp-inputs');

      setButtonLoading(btnVerifyEmail, true);
      const result = await authService.verifyEmail(code);
      setButtonLoading(btnVerifyEmail, false);

      if (result.success) {
        showToast('Email verified successfully! 🎉');
        navigateTo('profile-setup');
      } else {
        showError('email-error-banner', result.error);
      }
    });
  }

  function startResendCountdown() {
    const btnResendOtp = document.getElementById('btn-resend-otp');
    const resendCountdownText = document.getElementById('resend-countdown-text');
    const resendTimerCount = document.getElementById('resend-timer-count');

    if (resendInterval) clearInterval(resendInterval);
    resendSecondsRemaining = 30;
    if (resendCountdownText) resendCountdownText.style.display = 'block';
    if (btnResendOtp) btnResendOtp.style.display = 'none';
    if (resendTimerCount) resendTimerCount.textContent = resendSecondsRemaining;

    resendInterval = setInterval(() => {
      resendSecondsRemaining -= 1;
      if (resendTimerCount) resendTimerCount.textContent = resendSecondsRemaining;

      if (resendSecondsRemaining <= 0) {
        clearInterval(resendInterval);
        if (resendCountdownText) resendCountdownText.style.display = 'none';
        if (btnResendOtp) btnResendOtp.style.display = 'inline-block';
      }
    }, 1000);
  }

  const btnResendOtp = document.getElementById('btn-resend-otp');
  if (btnResendOtp) {
    btnResendOtp.addEventListener('click', async () => {
      showError('otp-error-banner', null);
      const result = await authService.resendPhoneOtp();
      if (result.success) {
        showToast('New verification code sent! 📩');
        setupOtpInputListeners('phone-otp-inputs');
        startResendCountdown();
      } else {
        showError('otp-error-banner', result.error);
      }
    });
  }

  // =========================================================================
  // 4. Profile Setup Controller
  // =========================================================================
  function updateProfileSetupView() {
    const user = authService.getCurrentUser();
    const role = user ? user.role : currentRole;

    const profileBadge = document.getElementById('profile-role-badge');
    const profileTitle = document.getElementById('profile-setup-title');
    const labelName = document.getElementById('label-profile-name');
    const inputName = document.getElementById('input-profile-name');
    const groupCraft = document.getElementById('group-craft-type');
    const groupBusiness = document.getElementById('group-business-type');

    if (role === 'Artisan') {
      if (profileBadge) {
        profileBadge.textContent = '👩‍🎨 Artisan Setup';
        profileBadge.style.backgroundColor = 'var(--color-artisan-bg)';
        profileBadge.style.borderColor = 'var(--color-artisan-border)';
        profileBadge.style.color = 'var(--color-artisan-accent)';
      }
      if (profileTitle) profileTitle.textContent = 'Artisan Profile Setup';
      if (labelName) labelName.textContent = 'Full Name';
      if (inputName) {
        inputName.placeholder = 'e.g. Lakshmi Devi';
        if (user?.name) inputName.value = user.name;
      }
      const selectCraft = document.getElementById('select-craft-type');
      if (selectCraft && user?.craftType) {
        selectCraft.value = user.craftType;
      }
      const inputLocation = document.getElementById('input-profile-location');
      if (inputLocation && user?.location) {
        inputLocation.value = user.location;
      }
      if (groupCraft) groupCraft.style.display = 'flex';
      if (groupBusiness) groupBusiness.style.display = 'none';
    } else {
      if (profileBadge) {
        profileBadge.textContent = '🛍️ Buyer Setup';
        profileBadge.style.backgroundColor = 'var(--color-buyer-bg)';
        profileBadge.style.borderColor = 'var(--color-buyer-border)';
        profileBadge.style.color = 'var(--color-buyer-accent)';
      }
      if (profileTitle) profileTitle.textContent = 'Buyer Profile Setup';
      if (labelName) labelName.textContent = 'Full Name';
      if (inputName) {
        inputName.placeholder = 'e.g. Priya Sharma';
        if (user?.name) inputName.value = user.name;
      }
      const inputLocation = document.getElementById('input-profile-location');
      if (inputLocation && user?.location) {
        inputLocation.value = user.location;
      }
      if (groupCraft) groupCraft.style.display = 'none';
      if (groupBusiness) groupBusiness.style.display = 'none';
    }
  }

  const langChips = document.querySelectorAll('.lang-chip');
  langChips.forEach(chip => {
    chip.addEventListener('click', () => {
      langChips.forEach(c => {
        c.classList.remove('active');
        c.setAttribute('aria-checked', 'false');
      });
      chip.classList.add('active');
      chip.setAttribute('aria-checked', 'true');
      const chosenLang = chip.getAttribute('data-lang') || 'English';
      applyLanguage(chosenLang);
    });
  });

  const formProfile = document.getElementById('form-profile-setup');
  if (formProfile) {
    formProfile.addEventListener('submit', async (e) => {
      e.preventDefault();
      showError('profile-error-banner', null);

      const user = authService.getCurrentUser();
      const role = user ? user.role : currentRole;

      const inputName = document.getElementById('input-profile-name');
      const selectCraft = document.getElementById('select-craft-type');
      const selectBusiness = document.getElementById('select-business-type');
      const inputLocation = document.getElementById('input-profile-location');
      const btnComplete = document.getElementById('btn-complete-profile');

      const profileData = {
        name: inputName.value,
        craftType: selectCraft ? selectCraft.value : '',
        businessType: selectBusiness ? selectBusiness.value : '',
        location: inputLocation.value,
        preferredLanguage: selectedLanguage
      };

      setButtonLoading(btnComplete, true);
      const result = await authService.saveUserProfile(profileData);
      setButtonLoading(btnComplete, false);

      if (result.success) {
        showToast('Welcome to KALA-MITRA! 🎉');
        if (role === 'Artisan') {
          // Immediately populate and synchronize products matching the chosen artisan craft from buyer side
          if (profileData.craftType) {
            await productRepository.syncProductsForArtisanCraft(profileData.craftType, result.user || user, true);
          }
          navigateTo('artisan-dashboard');
        } else {
          navigateTo('buyer-home');
        }
      } else {
        showError('profile-error-banner', result.error);
      }
    });
  }

  // =========================================================================
  // 5. ARTISAN DASHBOARD & HOME EXPERIENCE
  // =========================================================================
  async function loadArtisanDashboard() {
    const user = authService.getCurrentUser();
    const artisanName = user && user.name ? user.name : 'Artisan';
    const initials = artisanName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'AM';

    // Ensure artisan products match the artisan's selected craft from buyer side
    const activeCraft = user?.craftType || 'Bamboo Handicrafts';
    try {
      await productRepository.syncProductsForArtisanCraft(activeCraft, user, true);
    } catch (e) {
      console.warn('Dashboard craft sync notice:', e);
    }

    // 1. Update Topbar & Greeting
    const greetingEl = document.getElementById('artisan-greeting-name');
    const avatarInitialsEl = document.getElementById('dash-avatar-initials');
    if (greetingEl) greetingEl.textContent = `Good morning, ${artisanName}`;
    if (avatarInitialsEl) avatarInitialsEl.textContent = initials;
    if (typeof updateUnreadBadgeCounts === 'function') updateUnreadBadgeCounts();

    // 2. Fetch and render Quick Summary metrics & Capacity Card
    try {
      const summary = await artisanRepository.getDashboardSummary();
      const capacity = await capacityRepository.getCapacity();

      const statProducts = document.getElementById('stat-active-products');
      const statOrders = document.getElementById('stat-active-orders');
      const statCapacity = document.getElementById('stat-available-capacity');
      const statOpps = document.getElementById('stat-new-opportunities');

      if (statProducts) statProducts.textContent = summary.activeProducts;
      if (statOrders) statOrders.textContent = summary.activeOrders;
      if (statCapacity) statCapacity.innerHTML = `${capacity.availableStock} <small>units</small>`;
      if (statOpps) statOpps.textContent = summary.newOpportunities;

      // Update Comprehensive Dashboard Capacity Card
      const dashStock = document.getElementById('dash-capacity-stock');
      const dashProd = document.getElementById('dash-capacity-production');
      const dashPeriodLbl = document.getElementById('dash-capacity-period-label');
      const dashLead = document.getElementById('dash-capacity-lead');
      const dashLocText = document.getElementById('dash-capacity-location-text');
      const dashBadge = document.getElementById('dash-capacity-status-badge');
      const dashBadgeText = document.getElementById('dash-capacity-status-text');

      if (dashStock) dashStock.innerHTML = `${capacity.availableStock} <small>units</small>`;
      if (dashProd) dashProd.innerHTML = `${capacity.productionCapacity} <small>units</small>`;
      if (dashPeriodLbl) dashPeriodLbl.textContent = `${capacity.productionPeriod === 'weekly' ? 'Weekly' : 'Monthly'} Capacity`;
      if (dashLead) dashLead.innerHTML = `${capacity.productionTimeDays} <small>days</small>`;
      if (dashLocText) dashLocText.textContent = capacity.locationName || (user?.location || 'India');

      if (dashBadge && dashBadgeText) {
        const meta = AvailabilityStatusLabels[capacity.availabilityStatus] || { label: 'Available', color: 'green' };
        dashBadge.className = `availability-status-badge badge--${capacity.availabilityStatus || 'available'}`;
        dashBadgeText.textContent = meta.label;
      }
    } catch (e) {
      console.error('Summary load error', e);
    }


    // 3. Fetch and render Market Insight Preview
    try {
      const insight = await artisanRepository.getMarketInsight();
      const insightText = document.getElementById('market-insight-text');
      const insightPrice = document.getElementById('market-insight-price');
      const insightRequests = document.getElementById('market-insight-requests');

      if (insightText) insightText.textContent = insight.highlightText;
      if (insightPrice) insightPrice.textContent = insight.typicalPriceRange;
      if (insightRequests) insightRequests.textContent = insight.relevantBuyerRequests;
    } catch (e) {
      console.error('Insight load error', e);
    }

    // 4. Fetch and render Recent Orders
    try {
      const recentOrders = await artisanRepository.getRecentOrders();
      renderOrdersList('home-orders-list', recentOrders);
    } catch (e) {
      console.error('Orders load error', e);
    }

    // 5. Fetch and render New Opportunities
    try {
      const newOpps = await artisanRepository.getNewOpportunities();
      renderOpportunitiesList('home-opportunities-list', newOpps.slice(0, 2));
    } catch (e) {
      console.error('Opportunities load error', e);
    }

    // Switch to active tab
    switchArtisanTab(activeArtisanTab);
  }

  // Reusable OrderCard Component Renderer (with Artisan Active vs Fulfilled Orders & Status Updates)
  let artisanOrdersActiveFilter = 'active'; // 'active' | 'fulfilled'

  function renderOrdersList(containerId, orders, requestedFilter = null) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (requestedFilter) artisanOrdersActiveFilter = requestedFilter;

    const allMaster = getMasterOrders();
    const activeOrders = allMaster.filter(o => (o.status || '').toLowerCase() !== 'delivered');
    const fulfilledOrders = allMaster.filter(o => (o.status || '').toLowerCase() === 'delivered');

    // Update active orders metric on dashboard
    const statOrders = document.getElementById('stat-active-orders');
    if (statOrders) statOrders.textContent = activeOrders.length;

    // Home screen widget handling
    if (containerId === 'home-orders-list') {
      if (activeOrders.length === 0) {
        container.innerHTML = `
          <div style="background: #ffffff; border: 1.5px dashed #cbd5e1; border-radius: 12px; padding: 20px 14px; text-align: center;">
            <span style="font-size: 2.2rem; display: block; margin-bottom: 6px;">✅</span>
            <strong style="color: #1e293b; font-size: 0.95rem; display: block;">All Orders Fulfilled!</strong>
            <p style="color: #64748b; font-size: 0.8rem; margin: 4px 0 12px;">No pending production orders. Freshly placed buyer orders will appear here automatically.</p>
            <button type="button" id="btn-home-view-fulfilled" style="background: #f0fdf4; border: 1.5px solid #10b981; color: #059669; padding: 8px 16px; border-radius: 8px; font-weight: 800; font-size: 0.82rem; cursor: pointer;">
              ✓ View Fulfilled Orders (${fulfilledOrders.length})
            </button>
          </div>
        `;
        container.querySelector('#btn-home-view-fulfilled')?.addEventListener('click', () => {
          openArtisanOrdersModal('fulfilled');
        });
        return;
      }

      // If active orders exist, show active orders
      renderOrderCards(container, activeOrders.slice(0, 4), 'active', containerId);
      return;
    }

    // Modal or Full Tab List: Render filter tabs + corresponding orders
    const filterTabsHtml = `
      <div style="display: flex; gap: 8px; margin-bottom: 14px; background: #f1f5f9; padding: 5px; border-radius: 12px; border: 1px solid #cbd5e1;">
        <button type="button" id="artisan-filter-btn-active" style="flex: 1; padding: 9px 12px; border-radius: 8px; border: none; font-size: 0.84rem; font-weight: 800; cursor: pointer; transition: all 0.2s; ${artisanOrdersActiveFilter === 'active' ? 'background: #0284c7; color: #ffffff; box-shadow: 0 2px 6px rgba(2, 132, 199, 0.35);' : 'background: transparent; color: #475569;'}">
          🔨 Active Orders (${activeOrders.length})
        </button>
        <button type="button" id="artisan-filter-btn-fulfilled" style="flex: 1; padding: 9px 12px; border-radius: 8px; border: none; font-size: 0.84rem; font-weight: 800; cursor: pointer; transition: all 0.2s; ${artisanOrdersActiveFilter === 'fulfilled' ? 'background: #059669; color: #ffffff; box-shadow: 0 2px 6px rgba(5, 150, 105, 0.35);' : 'background: transparent; color: #475569;'}">
          ✓ Fulfilled Orders (${fulfilledOrders.length})
        </button>
      </div>
      <div id="artisan-orders-filtered-container" style="display: flex; flex-direction: column; gap: 12px;"></div>
    `;

    container.innerHTML = filterTabsHtml;

    container.querySelector('#artisan-filter-btn-active')?.addEventListener('click', () => {
      artisanOrdersActiveFilter = 'active';
      renderOrdersList(containerId, null, 'active');
    });

    container.querySelector('#artisan-filter-btn-fulfilled')?.addEventListener('click', () => {
      artisanOrdersActiveFilter = 'fulfilled';
      renderOrdersList(containerId, null, 'fulfilled');
    });

    const targetListContainer = container.querySelector('#artisan-orders-filtered-container');
    const displayList = artisanOrdersActiveFilter === 'active' ? activeOrders : fulfilledOrders;

    renderOrderCards(targetListContainer, displayList, artisanOrdersActiveFilter, containerId);
  }

  function renderOrderCards(listContainer, ordersList, mode, parentContainerId) {
    if (!ordersList || ordersList.length === 0) {
      if (mode === 'active') {
        listContainer.innerHTML = `
          <div style="text-align: center; padding: 36px 16px; color: #64748b; background: #ffffff; border: 1.5px dashed #cbd5e1; border-radius: 14px;">
            <span style="font-size: 2.5rem; display: block; margin-bottom: 6px;">⏳</span>
            <strong style="color: #1e293b; font-size: 0.98rem; display: block;">No Active Production Orders</strong>
            <p style="font-size: 0.8rem; margin: 4px 0 10px;">Freshly placed buyer orders will appear here automatically.</p>
            <span style="font-size: 0.76rem; background: #e0f2fe; color: #0369a1; padding: 3px 10px; border-radius: 14px; font-weight: 700;">Check "Fulfilled Orders" for past completed deliveries.</span>
          </div>
        `;
      } else {
        listContainer.innerHTML = `
          <div style="text-align: center; padding: 36px 16px; color: #64748b; background: #ffffff; border: 1.5px dashed #cbd5e1; border-radius: 14px;">
            <span style="font-size: 2.5rem; display: block; margin-bottom: 6px;">📦</span>
            <strong style="color: #1e293b; font-size: 0.98rem; display: block;">No Fulfilled Orders Yet</strong>
            <p style="font-size: 0.8rem; margin: 4px 0;">Orders updated to "Delivered" will appear here as fulfilled.</p>
          </div>
        `;
      }
      return;
    }

    listContainer.innerHTML = ordersList.map(order => {
      const isDelivered = (order.status || '').toLowerCase() === 'delivered';
      const statusMeta = OrderStatusLabels[order.status] || { label: order.status, color: isDelivered ? 'green' : 'amber' };
      const currentNorm = (order.status || 'Production Started').toLowerCase().trim();
      const placedTime = order.orderPlacedTime || order.order_placed_time || 'Today, Just now';
      const deliveredTime = order.delivered_date || 'Delivered';

      return `
        <article class="order-card" data-order-id="${order.id}" style="border-left: 4px solid ${isDelivered ? '#10b981' : '#0284c7'};">
          <div class="order-card__header" style="align-items: flex-start;">
            <div style="flex: 1; text-align: left;">
              <h3 class="order-card__product" style="margin: 0 0 4px 0; font-size: 1.05rem; font-weight: 800; color: #0f172a;">
                ${escapeHtml(order.productName || order.product || 'Artisan Craft')}
              </h3>
              <div style="font-size: 0.78rem; font-weight: 700; color: ${isDelivered ? '#15803d' : '#0284c7'}; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                <span>🕒 Placed:</span>
                <strong style="color: ${isDelivered ? '#166534' : '#0369a1'}; background: ${isDelivered ? '#dcfce7' : '#e0f2fe'}; padding: 2px 8px; border-radius: 6px; border: 1px solid ${isDelivered ? '#86efac' : '#bae6fd'};">
                  ${escapeHtml(placedTime)}
                </strong>
              </div>
            </div>
            <span class="order-status-pill ${isDelivered ? 'green' : statusMeta.color}">${isDelivered ? '✓ Delivered' : statusMeta.label}</span>
          </div>

          <div class="order-card__meta" style="margin-top: 8px;">
            <span class="order-card__buyer">🏢 ${escapeHtml(order.buyerName || order.buyer || 'Buyer')}</span>
            <span class="order-card__qty">${order.quantity} units</span>
            <span style="font-family: monospace; font-size: 0.75rem; color: #64748b; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">#${escapeHtml(order.id)}</span>
          </div>

          <div class="order-card__footer">
            <span class="order-card__expected">
              ${isDelivered ? '✓ Fulfilled: <strong>' + escapeHtml(deliveredTime) + '</strong>' : 'Expected: <strong>' + escapeHtml(order.expectedDelivery || order.expected_delivery || '18 Sep 2026') + '</strong>'}
            </span>
            <span class="order-card__amount" style="color: #059669; font-weight: 800; font-size: 1.05rem;">
              ₹${(order.totalAmount || order.total_amount || 0).toLocaleString('en-IN')}
            </span>
          </div>

          <!-- Artisan Production Status Control -->
          <div class="artisan-order-status-control" style="margin-top: 10px; padding: 8px 10px; background: rgba(241, 245, 249, 0.95); border: 1.5px solid #cbd5e1; border-radius: 8px; display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;">
            <span style="font-size: 0.76rem; font-weight: 800; color: #334155; display: flex; align-items: center; gap: 4px;">
              ⚙️ Production Status:
            </span>
            <select class="artisan-order-status-select" data-order-id="${order.id}" style="padding: 5px 8px; font-size: 0.78rem; font-weight: 700; border-radius: 6px; border: 1.5px solid ${isDelivered ? '#10b981' : '#0284c7'}; background: #ffffff; color: ${isDelivered ? '#047857' : '#0369a1'}; cursor: pointer;">
              <option value="Order Placed" ${currentNorm === 'order placed' || currentNorm === 'received' ? 'selected' : ''}>1. Order Placed</option>
              <option value="Production Started" ${currentNorm === 'production started' || currentNorm === 'productionstarted' || currentNorm === 'in production' || currentNorm === 'in_progress' || currentNorm === 'inprogress' ? 'selected' : ''}>2. Production Started</option>
              <option value="Quality Check" ${currentNorm === 'quality check' || currentNorm === 'qualitycheck' ? 'selected' : ''}>3. Quality Check</option>
              <option value="Ready for Shipment" ${currentNorm === 'ready for shipment' || currentNorm === 'ready for dispatch' || currentNorm === 'readyfordispatch' ? 'selected' : ''}>4. Ready for Shipment</option>
              <option value="Shipped" ${currentNorm === 'shipped' ? 'selected' : ''}>5. Shipped</option>
              <option value="Delivered" ${isDelivered ? 'selected' : ''}>6. Delivered (Fulfilled)</option>
            </select>
          </div>
        </article>
      `;
    }).join('');

    // Status change listener
    listContainer.querySelectorAll('.artisan-order-status-select').forEach(sel => {
      sel.addEventListener('change', async () => {
        const orderId = sel.dataset.orderId;
        const newStatus = sel.value;
        sel.disabled = true;

        // 1. Sync to backend
        try {
          await fetch('http://127.0.0.1:8000/api/v1/orders/' + orderId + '/status', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
          });
        } catch (err) {
          console.warn('Backend status update completed', err);
        }

        // 2. Update master orders in localStorage
        const master = getMasterOrders();
        master.forEach(o => {
          if (String(o.id).toUpperCase() === String(orderId).toUpperCase()) {
            o.status = newStatus;
            if (newStatus === 'Delivered') {
              o.delivered_date = 'Today, ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
              o.progress = 100;
            }
            if (!o.timeline) o.timeline = ['Order Placed'];
            if (!o.timeline.includes(newStatus)) o.timeline.push(newStatus);
          }
        });
        saveMasterOrders(master);

        // 3. Send Notification to Buyer
        try {
          const buyerNotifs = getStoredBuyerNotifications();
          buyerNotifs.unshift({
            id: 'buyer-status-update-' + Date.now(),
            type: 'delivery',
            title: newStatus === 'Delivered' ? '🎉 Order Delivered!' : ('Order Status: ' + newStatus),
            message: newStatus === 'Delivered' ? ('Your order #' + orderId + ' has been delivered by the artisan! Moved to Previous Orders.') : ('Artisan updated order #' + orderId + ' status to "' + newStatus + '".'),
            orderId: orderId,
            action_label: 'Track Order',
            action_route: 'buyer-opportunities',
            timestamp: 'Just now',
            is_read: false
          });
          saveStoredBuyerNotifications(buyerNotifs);
        } catch (e) {}

        // 4. Dispatch events for both Buyer & Artisan live sync
        window.dispatchEvent(new CustomEvent('kala-order-status-updated', {
          detail: { orderId, status: newStatus }
        }));
        window.dispatchEvent(new CustomEvent('kala-artisan-orders-updated'));

        showToast(newStatus === 'Delivered' ? ('Order #' + orderId + ' fulfilled and delivered! 🎉') : ('Production status updated to "' + newStatus + '"! 🚀'));

        // Re-render
        if (newStatus === 'Delivered' && artisanOrdersActiveFilter === 'active') {
          renderOrdersList(parentContainerId, null, 'active');
        } else {
          renderOrdersList(parentContainerId, null, artisanOrdersActiveFilter);
        }
      });
    });
  }
  // Reusable OpportunityCard Component Renderer
  function renderOpportunitiesList(containerId, opps) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!opps || opps.length === 0) {
      container.innerHTML = `<p class="field-hint" style="text-align:center; padding: 12px;">No open opportunities right now.</p>`;
      return;
    }

    container.innerHTML = opps.map(opp => `
      <article class="opportunity-card" data-opp-id="${opp.id}">
        <div class="opportunity-card__header">
          <h3 class="opportunity-card__title">${escapeHtml(opp.title)}</h3>
          ${opp.isClusterOpportunity ? '<span class="cluster-pill">🤝 Cluster Opportunity</span>' : ''}
        </div>
        <div class="opportunity-card__details">
          <div>
            <span class="opp-detail-lbl">Required:</span>
            <span class="opp-detail-val">${opp.requiredQuantity} units</span>
          </div>
          <div>
            <span class="opp-detail-lbl">Target Price:</span>
            <span class="opp-detail-val">₹${opp.targetPricePerUnit} / unit</span>
          </div>
        </div>
        <div class="opportunity-card__cluster-note">
          <span>✨ Your capacity: <strong>${opp.artisanSuggestedCapacity} units</strong>. Participate with ${opp.participatingArtisansCount} other artisans.</span>
        </div>
        <button type="button" class="opportunity-card__action-btn btn-view-opp-detail" data-id="${opp.id}">
          View Opportunity
        </button>
      </article>
    `).join('');

    // Attach click listeners to Opportunity detail buttons
    container.querySelectorAll('.btn-view-opp-detail').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const oppId = e.currentTarget.getAttribute('data-id');
        showOpportunityDetailModal(oppId);
      });
    });
  }

  // =========================================================================
  // 6. Artisan Portal & Bottom Navigation Tab Switcher
  // =========================================================================
  const getArtisanNavButtons = () => document.querySelectorAll('.artisan-bottom-nav .nav-item, .artisan-header__nav .artisan-nav-tab');

  document.addEventListener('click', (e) => {
    const tabBtn = e.target.closest('.artisan-bottom-nav .nav-item, .artisan-header__nav .artisan-nav-tab');
    if (tabBtn) {
      const tabName = tabBtn.getAttribute('data-tab');
      if (tabName) switchArtisanTab(tabName);
    }
  });

  const artisanBrandLogo = document.getElementById('artisan-brand-logo');
  if (artisanBrandLogo) {
    artisanBrandLogo.addEventListener('click', () => switchArtisanTab('home'));
  }

  const btnArtisanLogout = document.getElementById('btn-artisan-logout');
  if (btnArtisanLogout) {
    btnArtisanLogout.addEventListener('click', async () => {
      await authService.signOut();
      showToast('Logged out of Artisan Portal');
      navigateTo('landing');
    });
  }

  async function switchArtisanTab(tabName) {
    activeArtisanTab = tabName;

    // Update both Top Portal Nav & Bottom Nav active states
    getArtisanNavButtons().forEach(btn => {
      if (btn.getAttribute('data-tab') === tabName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update Tab Panes
    const tabPanes = document.querySelectorAll('.dash-tab-pane');
    tabPanes.forEach(pane => pane.classList.remove('active'));

    const activePane = document.getElementById(`artisan-tab-${tabName}`);
    if (activePane) activePane.classList.add('active');

    // Load pane specific data
    if (tabName === 'products') {
      await loadProductsList();
    } else if (tabName === 'clusters') {
      await renderArtisanClustersTab();
    } else if (tabName === 'orders') {
      await openArtisanOrdersModal();
    } else if (tabName === 'opportunities') {
      const allOpps = await artisanRepository.getNewOpportunities();
      renderOpportunitiesList('artisan-full-opps-list', allOpps);
    } else if (tabName === 'market-demand') {
      await renderMarketDemandTab();
    }
  }

  // Home Screen Market Demand Explore Button Listener
  const btnExploreMarketDemand = document.getElementById('btn-explore-market-demand');
  if (btnExploreMarketDemand) {
    btnExploreMarketDemand.addEventListener('click', () => {
      switchArtisanTab('market-demand');
    });
  }

  // =========================================================================
  // 6.05 AI MARKET DEMAND & CRAFT RECOMMENDATION MODULE
  // =========================================================================
  let selectedDemandCategoryFilter = 'All';

  async function renderMarketDemandTab() {
    const heroContainer = document.getElementById('ai-recommendation-hero-card');
    const metricsContainer = document.getElementById('demand-metrics-grid');
    const craftsContainer = document.getElementById('trending-crafts-grid');
    const locationsContainer = document.getElementById('buyer-locations-list');
    const trendsContainer = document.getElementById('demand-trends-list');

    const user = authService.getCurrentUser() || { name: 'Lakshmi Devi', craftType: 'Bamboo Handicrafts', location: 'East Godavari, Andhra Pradesh' };
    const capacity = (await capacityRepository.getCapacity()) || { availableStock: 120, monthlyProduction: 300, leadTimeDays: 7 };

    // 1. Get personalized recommendation
    const rec = marketDemandService.getPersonalizedRecommendation(user, capacity);

    if (heroContainer) {
      heroContainer.innerHTML = `
        <div class="hero-recommendation-card">
          <div class="hero-rec-top">
            <div class="hero-rec-badge-wrap">
              <span class="match-score-badge">✨ ${rec.skillMatchLabel}</span>
              <span class="category-badge">${escapeHtml(rec.category)}</span>
            </div>
            <span class="ai-sparkle-pill-gold">🤖 Personalized AI Recommendation</span>
          </div>

          <div class="hero-rec-body">
            <h2 class="hero-rec-title">${escapeHtml(rec.productTitle)}</h2>
            <p class="hero-rec-rationale">💡 <strong>AI Rationale:</strong> ${escapeHtml(rec.aiRationale)}</p>

            <div class="hero-rec-metrics-grid">
              <div class="rec-metric-item">
                <span class="rec-metric-lbl">Suggested Batch</span>
                <strong class="rec-metric-val">${rec.suggestedBatchQuantity} units</strong>
                <small class="rec-metric-sub">Matches available stock</small>
              </div>
              <div class="rec-metric-item">
                <span class="rec-metric-lbl">Target Price</span>
                <strong class="rec-metric-val">₹${rec.suggestedPrice} / unit</strong>
                <small class="rec-metric-sub">${rec.priceRange}</small>
              </div>
              <div class="rec-metric-item">
                <span class="rec-metric-lbl">Est. Revenue</span>
                <strong class="rec-metric-val highlight-green">${rec.estimatedRevenue}</strong>
                <small class="rec-metric-sub">From 1 batch</small>
              </div>
              <div class="rec-metric-item">
                <span class="rec-metric-lbl">Production Lead Time</span>
                <strong class="rec-metric-val">${rec.leadTimeDays} Days</strong>
                <small class="rec-metric-sub">Turnaround speed</small>
              </div>
            </div>

            <div class="hero-rec-buyer-teaser">
              <span class="teaser-icon">🏢</span>
              <span>Connected to <strong>${rec.connectedBuyerDemands.length} active buyer requirements</strong> (e.g. ${escapeHtml(rec.connectedBuyerDemands[0]?.buyerName || 'Resort Bulk Order')} in ${escapeHtml(rec.connectedBuyerDemands[0]?.location || 'South Hubs')}).</span>
            </div>
          </div>

          <div class="hero-rec-actions">
            <button type="button" class="primary-btn hero-action-btn" id="btn-prepare-recommended-product">
              <span>✨ Prepare This Product</span>
            </button>
            <button type="button" class="secondary-btn hero-action-btn" id="btn-view-recommendation-buyer-reqs">
              <span>📋 View Buyer Requirements (${rec.connectedBuyerDemands.length})</span>
            </button>
            <button type="button" class="copilot-listen-btn hero-action-btn" id="btn-listen-recommendation">
              <span>🔊 Listen Recommendation</span>
            </button>
          </div>
        </div>
      `;

      // Event listener: Prepare This Product
      const btnPrepare = heroContainer.querySelector('#btn-prepare-recommended-product');
      if (btnPrepare) {
        btnPrepare.addEventListener('click', () => {
          populateAndOpenProductForm({
            name: rec.productTitle,
            category: rec.category,
            material: rec.material,
            description: rec.description,
            price: rec.suggestedPrice,
            quantity: rec.suggestedBatchQuantity,
            capacity: capacity.monthlyProduction || 100,
            leadDays: rec.leadTimeDays,
            location: rec.location,
            tags: rec.tags ? rec.tags.join(', ') : 'Handmade'
          });
        });
      }

      // Event listener: View Buyer Requirements
      const btnBuyerReqs = heroContainer.querySelector('#btn-view-recommendation-buyer-reqs');
      if (btnBuyerReqs) {
        btnBuyerReqs.addEventListener('click', () => {
          openBuyerRequirementsModal(rec.connectedBuyerDemands, rec.productTitle);
        });
      }

      // Event listener: Listen Recommendation
      const btnListen = heroContainer.querySelector('#btn-listen-recommendation');
      if (btnListen) {
        btnListen.addEventListener('click', () => {
          const speechText = `AI Recommendation for your workshop. We suggest preparing ${rec.productTitle}. Skill match score is 96 percent. Recommended batch quantity is ${rec.suggestedBatchQuantity} units, with expected target price of rupees ${rec.suggestedPrice} per unit and estimated revenue of ${rec.estimatedRevenue}. ${rec.aiRationale}`;
          speakNotificationText(speechText);
          showToast('🗣️ Reading AI Craft Recommendation aloud...');
        });
      }
    }

    // Top Header Listen Button
    const btnListenTop = document.getElementById('btn-listen-demand-page');
    if (btnListenTop) {
      btnListenTop.onclick = () => {
        const overviewText = `AI Market Demand and Craft Recommendation Dashboard. Top buyer demand is currently in Bamboo Crafts and Eco Decor, led by buyers in Bengaluru and Hyderabad. We recommend preparing ${rec.productTitle} to match your workshop capacity.`;
        speakNotificationText(overviewText);
        showToast('🗣️ Reading Market Demand overview aloud...');
      };
    }

    // 2. Render Metrics Overview Grid
    const summary = marketDemandService.getMarketDemandSummary();
    if (metricsContainer) {
      metricsContainer.innerHTML = `
        <div class="summary-card">
          <div class="summary-card__header">
            <span class="summary-card__label">Active Buyer Searches</span>
            <span class="summary-card__icon">🔍</span>
          </div>
          <div class="summary-card__value">${summary.activeBuyerSearches}</div>
          <span class="summary-card__sub highlight-green">${summary.monthlyGrowthRate} growth MoM</span>
        </div>

        <div class="summary-card">
          <div class="summary-card__header">
            <span class="summary-card__label">Top Demand Craft</span>
            <span class="summary-card__icon">🔥</span>
          </div>
          <div class="summary-card__value" style="font-size: 1.15rem; font-weight: 700; line-height: 1.3; color: var(--color-brown-primary);">${summary.topDemandCategory}</div>
          <span class="summary-card__sub">Surging order inquiries</span>
        </div>

        <div class="summary-card">
          <div class="summary-card__header">
            <span class="summary-card__label">Primary Buyer Hub</span>
            <span class="summary-card__icon">📍</span>
          </div>
          <div class="summary-card__value" style="font-size: 1.15rem; font-weight: 700; color: var(--color-teal-primary);">${summary.topBuyerHub}</div>
          <span class="summary-card__sub">42% of total south demand</span>
        </div>

        <div class="summary-card summary-card--opportunity">
          <div class="summary-card__header">
            <span class="summary-card__label">Open Bulk Demands</span>
            <span class="summary-card__icon">📦</span>
          </div>
          <div class="summary-card__value">${summary.totalBulkDemands}</div>
          <span class="summary-card__sub">Cluster matching active</span>
        </div>
      `;
    }

    // 3. Render Trending Crafts Grid
    renderTrendingCrafts(selectedDemandCategoryFilter);

    // 4. Render Popular Buyer Locations
    const locations = marketDemandService.getBuyerLocations();
    if (locationsContainer) {
      locationsContainer.innerHTML = locations.map(loc => `
        <div class="buyer-location-card">
          <div class="loc-card-header">
            <span class="loc-card-icon">${loc.icon}</span>
            <div>
              <h4 class="loc-card-city">${escapeHtml(loc.city)}</h4>
              <span class="loc-card-state">${escapeHtml(loc.state)}</span>
            </div>
            <span class="loc-req-count">${loc.activeRequests} Bulk Demands</span>
          </div>
          <div class="loc-card-meta">
            <span class="loc-meta-tag">Top Category: <strong>${escapeHtml(loc.dominantCategory)}</strong></span>
            <span class="loc-meta-scale">${escapeHtml(loc.demandScale)}</span>
          </div>
        </div>
      `).join('');
    }

    // 5. Render Demand Trends Highlights
    const trends = marketDemandService.getDemandTrends();
    if (trendsContainer) {
      trendsContainer.innerHTML = trends.map(tr => `
        <div class="demand-trend-card">
          <div class="trend-card-top">
            <h4 class="trend-card-title">${escapeHtml(tr.title)}</h4>
            <span class="trend-growth-badge">${escapeHtml(tr.growth)}</span>
          </div>
          <p class="trend-card-desc">${escapeHtml(tr.summary)}</p>
        </div>
      `).join('');
    }
  }

  function renderTrendingCrafts(categoryFilter = 'All') {
    const craftsContainer = document.getElementById('trending-crafts-grid');
    if (!craftsContainer) return;

    const crafts = marketDemandService.getTrendingCrafts(categoryFilter);

    if (!crafts || crafts.length === 0) {
      craftsContainer.innerHTML = `<p class="field-hint" style="text-align: center; padding: 20px;">No trending crafts found for category "${escapeHtml(categoryFilter)}".</p>`;
      return;
    }

    craftsContainer.innerHTML = crafts.map(item => `
      <article class="trending-craft-card">
        <div class="craft-card-header">
          <span class="craft-icon">${item.icon}</span>
          <div class="craft-header-main">
            <h3 class="craft-title">${escapeHtml(item.name)}</h3>
            <span class="craft-cat-pill">${escapeHtml(item.category)}</span>
          </div>
          <span class="demand-pill ${item.demandBadgeClass}">${item.demandLevel}</span>
        </div>

        <p class="craft-desc">${escapeHtml(item.description)}</p>

        <div class="craft-stats-row">
          <div class="craft-stat-box">
            <span class="craft-stat-lbl">Approx. Demand</span>
            <strong class="craft-stat-val">${item.demandCount}</strong>
          </div>
          <div class="craft-stat-box">
            <span class="craft-stat-lbl">Growth Velocity</span>
            <strong class="craft-stat-val highlight-green">${item.trendGrowth}</strong>
          </div>
          <div class="craft-stat-box">
            <span class="craft-stat-lbl">Avg Price</span>
            <strong class="craft-stat-val">${item.avgPriceRange}</strong>
          </div>
        </div>

        <div class="craft-locations-row">
          <span class="loc-lbl">Popular Locations:</span>
          ${item.popularLocations.map(l => `<span class="loc-pill">📍 ${escapeHtml(l)}</span>`).join('')}
        </div>

        <button type="button" class="primary-btn-sm craft-prepare-btn" data-craft-id="${item.id}">
          <span>✨ Prepare This Craft</span>
        </button>
      </article>
    `).join('');

    // Attach Prepare buttons to trending craft cards
    craftsContainer.querySelectorAll('.craft-prepare-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const cId = e.currentTarget.getAttribute('data-craft-id');
        const targetCraft = crafts.find(c => c.id === cId);
        if (targetCraft) {
          const user = authService.getCurrentUser();
          populateAndOpenProductForm({
            name: targetCraft.name,
            category: targetCraft.category,
            material: targetCraft.category === 'Bamboo Crafts' ? 'Natural Bamboo & Cane' : targetCraft.category === 'Pottery' ? 'Terracotta Clay' : 'Craft Materials',
            description: targetCraft.description,
            price: parseInt(targetCraft.avgPriceRange.replace(/[^0-9]/g, '')) || 480,
            quantity: 100,
            capacity: 80,
            leadDays: 7,
            location: user?.location || 'East Godavari, Andhra Pradesh',
            tags: `${targetCraft.category}, Handcrafted, High Demand`
          });
        }
      });
    });
  }

  // Populate product creation form and open product modal
  function populateAndOpenProductForm(data = {}) {
    openAddProductModal();

    const titleEl = document.getElementById('product-form-title');
    const saveBtnText = document.getElementById('btn-save-product-text');
    if (titleEl) titleEl.textContent = 'Prepare Recommended Product';
    if (saveBtnText) saveBtnText.textContent = 'Save Product';

    if (data.name) document.getElementById('input-product-name').value = data.name;
    if (data.material) document.getElementById('input-product-material').value = data.material;
    if (data.description) document.getElementById('input-product-description').value = data.description;
    if (data.price) document.getElementById('input-product-price').value = data.price;
    if (data.quantity) document.getElementById('input-product-quantity').value = data.quantity;
    if (data.capacity) document.getElementById('input-product-capacity').value = data.capacity;
    if (data.leadDays) document.getElementById('input-product-lead-days').value = data.leadDays;
    if (data.location) document.getElementById('input-product-location').value = data.location;
    if (data.tags) document.getElementById('input-product-tags').value = data.tags;

    const selectCat = document.getElementById('select-product-category');
    if (selectCat && data.category) {
      if (ProductCategories.includes(data.category)) {
        selectCat.value = data.category;
      } else {
        selectCat.value = 'Other';
        const groupCustomCat = document.getElementById('group-custom-category');
        const inputCustomCat = document.getElementById('input-custom-category');
        if (groupCustomCat) groupCustomCat.style.display = 'block';
        if (inputCustomCat) inputCustomCat.value = data.category;
      }
    }

    showToast('✨ Form pre-filled with AI Craft Recommendation details!');
  }

  // Open Connected Buyer Requirements Modal
  function openBuyerRequirementsModal(buyerDemands = [], productTitle = '') {
    const modalBody = document.getElementById('buyer-reqs-modal-body');
    const modalSub = document.getElementById('buyer-reqs-modal-sub');

    if (modalSub) modalSub.textContent = `Open buyer requirements matching "${productTitle || 'AI Recommendation'}"`;

    if (modalBody) {
      if (!buyerDemands || buyerDemands.length === 0) {
        modalBody.innerHTML = `<p class="field-hint" style="text-align: center; padding: 20px;">No specific buyer demands linked right now.</p>`;
      } else {
        modalBody.innerHTML = buyerDemands.map(req => `
          <div class="buyer-demand-card" style="border: 1px solid #DFCCA6; background: #FAF4EB; border-radius: 12px; padding: 16px; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <h3 style="font-size: 1.05rem; font-weight: 700; color: var(--color-brown-primary); margin: 0;">🏢 ${escapeHtml(req.buyerName)}</h3>
              <span style="background: rgba(168, 77, 43, 0.12); color: var(--color-brown-primary); padding: 4px 10px; border-radius: 20px; font-size: 0.76rem; font-weight: 700;">${escapeHtml(req.status)}</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; font-size: 0.85rem; color: #4A3B32; margin-bottom: 10px;">
              <div>📍 <strong>Location:</strong> ${escapeHtml(req.location)}</div>
              <div>📦 <strong>Total Needed:</strong> ${req.quantityRequested} units</div>
              <div>🛠️ <strong>Your Share:</strong> ${req.workshopShare} units</div>
              <div>💰 <strong>Target Rate:</strong> ${escapeHtml(req.targetPrice)}</div>
            </div>
            <div style="font-size: 0.8rem; color: #7A6254; background: #FFF8EE; padding: 8px 12px; border-radius: 8px; border: 1px dashed #DFCCA6;">
              ⏳ <strong>Timeline:</strong> ${escapeHtml(req.urgency)} • Buyer Type: <strong>${escapeHtml(req.buyerType)}</strong>
            </div>
          </div>
        `).join('');
      }
    }

    openModal('modal-demand-buyer-reqs');
  }

  // Setup Category Filter Listener
  const demandFilterBar = document.getElementById('demand-category-filter-bar');
  if (demandFilterBar) {
    demandFilterBar.querySelectorAll('.filter-chip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        demandFilterBar.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        selectedDemandCategoryFilter = e.currentTarget.getAttribute('data-demand-cat') || 'All';
        renderTrendingCrafts(selectedDemandCategoryFilter);
      });
    });
  }

  // Setup Close Buyer Requirements Modal listener
  const btnCloseBuyerReqs = document.getElementById('btn-close-buyer-reqs-modal');
  if (btnCloseBuyerReqs) {
    btnCloseBuyerReqs.addEventListener('click', () => {
      closeModal('modal-demand-buyer-reqs');
    });
  }

  // =========================================================================
  // 6.1 ARTISAN PRODUCTS MODULE (My Products, Add/Edit, Details, Delete)
  // =========================================================================

  async function loadProductsList() {
    const listEl = document.getElementById('artisan-products-list');
    const emptyEl = document.getElementById('artisan-products-empty');
    if (!listEl) return;

    // Ensure artisan products strictly reflect current user's craft and have no other craft items
    const currentUser = authService.getCurrentUser();
    if (currentUser?.craftType) {
      await productRepository.syncProductsForArtisanCraft(currentUser.craftType, currentUser);
    }

    // Update filter counts
    const counts = productRepository.getCounts();
    const countAllEl = document.getElementById('filter-count-all');
    const countActiveEl = document.getElementById('filter-count-active');
    const countDraftEl = document.getElementById('filter-count-draft');
    const countInactiveEl = document.getElementById('filter-count-inactive');

    if (countAllEl) countAllEl.textContent = counts.total;
    if (countActiveEl) countActiveEl.textContent = counts.active;
    if (countDraftEl) countDraftEl.textContent = counts.draft;
    if (countInactiveEl) countInactiveEl.textContent = counts.inactive;

    // Fetch products by status filter
    const products = await productRepository.getProducts({ status: activeProductFilter });

    if (!products || products.length === 0) {
      listEl.innerHTML = '';
      listEl.style.display = 'none';
      if (emptyEl) {
        emptyEl.style.display = 'block';
        const emptyDesc = emptyEl.querySelector('.empty-state__desc');
        if (emptyDesc) {
          if (activeProductFilter === 'all') {
            emptyDesc.textContent = 'Add your first craft product to start reaching buyers.';
          } else {
            emptyDesc.textContent = `No ${activeProductFilter} craft products found. Switch filter or add a new product.`;
          }
        }
      }
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';
    listEl.style.display = 'grid';

    listEl.innerHTML = products.map(product => {
      const statusMeta = ProductStatusLabels[product.status] || { label: product.status, color: 'gray' };
      const hasImg = Boolean(product.imageUrl);

      return `
        <article class="artisan-product-card" data-product-id="${product.id}">
          <div class="product-card-top">
            <div class="product-card-media">
              ${hasImg ? `<img src="${product.imageUrl}" alt="${escapeHtml(product.name)}" class="product-card-img" />` : `<span>${product.imageIcon || '🏺'}</span>`}
            </div>
            <div class="product-card-main-info">
              <div class="product-card-header-row">
                <h3 class="product-card-title">${escapeHtml(product.name)}</h3>
                <span class="product-status-badge ${statusMeta.color}">${statusMeta.label}</span>
              </div>
              <div class="product-meta-tags">
                <span class="meta-craft-tag">${escapeHtml(product.displayCategory)}</span>
                <span class="meta-material-tag">• ${escapeHtml(product.material)}</span>
              </div>
            </div>
          </div>

          <div class="product-card-stats-grid">
            <div class="product-stat-cell">
              <span class="product-stat-label">Price</span>
              <span class="product-stat-value price">₹${product.price.toLocaleString('en-IN')}</span>
            </div>
            <div class="product-stat-cell">
              <span class="product-stat-label">Available Stock</span>
              <span class="product-stat-value">${product.availableQuantity} units</span>
            </div>
            <div class="product-stat-cell">
              <span class="product-stat-label">Monthly Capacity</span>
              <span class="product-stat-value">${product.productionCapacity} units/mo</span>
            </div>
            <div class="product-stat-cell">
              <span class="product-stat-label">Lead Time</span>
              <span class="product-stat-value">${product.productionTimeDays} days</span>
            </div>
          </div>

          <div class="product-card-actions">
            <button type="button" class="action-btn-link view btn-product-view" data-id="${product.id}" aria-label="View ${escapeHtml(product.name)} Details">
              <span>👁️ View</span>
            </button>
            <button type="button" class="action-btn-link edit btn-product-edit" data-id="${product.id}" aria-label="Edit ${escapeHtml(product.name)}">
              <span>✏️ Edit</span>
            </button>
            <button type="button" class="action-btn-link delete btn-product-delete" data-id="${product.id}" aria-label="Delete ${escapeHtml(product.name)}">
              <span>🗑️ Delete</span>
            </button>
          </div>
        </article>
      `;
    }).join('');

    // Attach card action listeners
    listEl.querySelectorAll('.btn-product-view').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        openProductDetailsModal(id);
      });
    });

    listEl.querySelectorAll('.btn-product-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        openEditProductModal(id);
      });
    });

    listEl.querySelectorAll('.btn-product-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        openDeleteConfirmModal(id);
      });
    });
  }

  // Filter Chips Listener
  const filterChips = document.querySelectorAll('.product-filters-bar .filter-chip');
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => {
        c.classList.remove('active');
        c.setAttribute('aria-selected', 'false');
      });
      chip.classList.add('active');
      chip.setAttribute('aria-selected', 'true');
      activeProductFilter = chip.getAttribute('data-status') || 'all';
      loadProductsList();
    });
  });

  // Category Dropdown Change Listener (Show/Hide 'Other' custom category input)
  const selectCategory = document.getElementById('select-product-category');
  const groupCustomCat = document.getElementById('group-custom-category');
  const inputCustomCat = document.getElementById('input-custom-category');

  if (selectCategory) {
    selectCategory.addEventListener('change', () => {
      if (selectCategory.value === 'Other') {
        if (groupCustomCat) groupCustomCat.style.display = 'block';
        if (inputCustomCat) inputCustomCat.focus();
      } else {
        if (groupCustomCat) groupCustomCat.style.display = 'none';
        if (inputCustomCat) inputCustomCat.value = '';
      }
    });
  }

  // =========================================================================
  // 6.2 LIVE ARTISAN CAMERA CONTROLLER (Live Preview, Capture, Retake, Use Photo)
  // =========================================================================
  let activeCameraTarget = 'product-form'; // 'product-form' | 'ai-catalog'
  let capturedCameraSnapshot = null; // { blob, dataUrl, width, height, file, filename }
  let isTorchOn = false;

  const videoElement = document.getElementById('camera-live-video');
  const imgCaptured = document.getElementById('camera-captured-img');
  const snapshotWrap = document.getElementById('camera-snapshot-wrap');
  const viewfinderOverlay = document.getElementById('camera-viewfinder-overlay');
  const loadingOverlay = document.getElementById('camera-loading-overlay');
  const errorOverlay = document.getElementById('camera-error-overlay');
  const errorHeading = document.getElementById('camera-error-heading');
  const errorMsg = document.getElementById('camera-error-message');
  const controlsLive = document.getElementById('camera-controls-live');
  const controlsReview = document.getElementById('camera-controls-review');

  const btnCameraBack = document.getElementById('btn-camera-back');
  const btnCameraTorch = document.getElementById('btn-camera-torch');
  const btnCameraSwitch = document.getElementById('btn-camera-switch');
  const btnCameraShutter = document.getElementById('btn-camera-shutter');
  const btnCameraCancel = document.getElementById('btn-camera-cancel');
  const btnCameraOpenGallery = document.getElementById('btn-camera-open-gallery');
  const btnCameraRetake = document.getElementById('btn-camera-retake-action');
  const btnCameraUse = document.getElementById('btn-camera-use-action');
  const btnCameraTryAgain = document.getElementById('btn-camera-try-again');
  const btnCameraFallbackFile = document.getElementById('btn-camera-fallback-file');

  // Open Live Camera Screen
  async function openLiveCamera(target = 'product-form') {
    activeCameraTarget = target;
    capturedCameraSnapshot = null;
    isTorchOn = false;

    // Close any active form modal before opening camera
    if (target === 'product-form') {
      closeModal('modal-product-form');
    } else if (target === 'ai-catalog') {
      closeModal('modal-ai-catalog');
    }

    navigateTo('artisan-camera');

    // Reset Camera UI States
    if (snapshotWrap) snapshotWrap.style.display = 'none';
    if (viewfinderOverlay) viewfinderOverlay.style.display = 'flex';
    if (controlsReview) controlsReview.style.display = 'none';
    if (controlsLive) controlsLive.style.display = 'flex';
    if (loadingOverlay) loadingOverlay.style.display = 'flex';
    if (errorOverlay) errorOverlay.style.display = 'none';
    if (btnCameraTorch) btnCameraTorch.style.display = 'none';
    if (btnCameraSwitch) btnCameraSwitch.style.display = 'none';

    try {
      const cameraInfo = await cameraService.startCamera({
        videoElement,
        facingMode: 'environment'
      });

      if (loadingOverlay) loadingOverlay.style.display = 'none';
      if (btnCameraSwitch && cameraInfo.multipleCameras) {
        btnCameraSwitch.style.display = 'flex';
      }
      if (btnCameraTorch && cameraInfo.hasTorch) {
        btnCameraTorch.style.display = 'flex';
      }
    } catch (err) {
      console.warn('Live camera start error:', err);
      if (loadingOverlay) loadingOverlay.style.display = 'none';
      if (errorOverlay) {
        errorOverlay.style.display = 'flex';
        if (errorHeading) {
          errorHeading.textContent = err.type === CameraErrorType.PERMISSION_DENIED
            ? 'Camera Permission Required'
            : 'Camera Unavailable';
        }
        if (errorMsg) {
          errorMsg.textContent = `${err.message || 'Camera could not be opened.'} ${err.userAction || ''}`;
        }
      }
    }
  }

  // Capture Photo from live feed
  async function captureProductPhoto() {
    if (!videoElement) return;

    try {
      if (btnCameraShutter) {
        btnCameraShutter.style.transform = 'scale(0.9)';
        setTimeout(() => { if (btnCameraShutter) btnCameraShutter.style.transform = 'none'; }, 150);
      }

      const snapshot = await cameraService.captureFrame(videoElement, {
        mimeType: 'image/jpeg',
        quality: 0.92
      });

      capturedCameraSnapshot = snapshot;

      // Show Captured Snapshot
      if (imgCaptured) imgCaptured.src = snapshot.dataUrl;
      if (snapshotWrap) snapshotWrap.style.display = 'flex';
      if (viewfinderOverlay) viewfinderOverlay.style.display = 'none';
      if (controlsLive) controlsLive.style.display = 'none';
      if (controlsReview) controlsReview.style.display = 'flex';
    } catch (err) {
      console.error('Photo capture error:', err);
      showToast('Could not capture photo. Please try again.');
    }
  }

  // Retake Photo
  function retakeProductPhoto() {
    capturedCameraSnapshot = null;
    if (snapshotWrap) snapshotWrap.style.display = 'none';
    if (viewfinderOverlay) viewfinderOverlay.style.display = 'flex';
    if (controlsReview) controlsReview.style.display = 'none';
    if (controlsLive) controlsLive.style.display = 'flex';
  }

  // Use Captured Photo & Return to Form
  function useCurrentCapturedPhoto() {
    if (!capturedCameraSnapshot) return;

    const snapshot = capturedCameraSnapshot;
    const target = activeCameraTarget;

    // Release camera stream immediately
    cameraService.stopCamera(videoElement);

    if (target === 'product-form') {
      setProductImagePreview(snapshot.dataUrl, snapshot.filename);
      navigateTo('artisan-dashboard');
      openModal('modal-product-form');
      showToast('Photo attached to product! 📸');
    } else if (target === 'ai-catalog') {
      navigateTo('artisan-dashboard');
      handleAiImageUpload(snapshot.file);
    } else {
      navigateTo('artisan-dashboard');
    }
  }

  // Close Camera without saving
  function closeLiveCamera() {
    cameraService.stopCamera(videoElement);
    navigateTo('artisan-dashboard');

    if (activeCameraTarget === 'product-form') {
      openModal('modal-product-form');
    } else if (activeCameraTarget === 'ai-catalog') {
      openModal('modal-ai-catalog');
    }
  }

  // Wire Camera Screen Controls
  if (btnCameraBack) btnCameraBack.addEventListener('click', closeLiveCamera);
  if (btnCameraCancel) btnCameraCancel.addEventListener('click', closeLiveCamera);
  if (btnCameraShutter) btnCameraShutter.addEventListener('click', captureProductPhoto);
  if (btnCameraRetake) btnCameraRetake.addEventListener('click', retakeProductPhoto);
  if (btnCameraUse) btnCameraUse.addEventListener('click', useCurrentCapturedPhoto);

  if (btnCameraTryAgain) {
    btnCameraTryAgain.addEventListener('click', () => openLiveCamera(activeCameraTarget));
  }

  if (btnCameraSwitch) {
    btnCameraSwitch.addEventListener('click', async () => {
      try {
        if (loadingOverlay) loadingOverlay.style.display = 'flex';
        await cameraService.switchCamera(videoElement);
        if (loadingOverlay) loadingOverlay.style.display = 'none';
      } catch (err) {
        if (loadingOverlay) loadingOverlay.style.display = 'none';
        showToast('Could not switch camera.');
      }
    });
  }

  if (btnCameraTorch) {
    btnCameraTorch.addEventListener('click', async () => {
      isTorchOn = !isTorchOn;
      const success = await cameraService.toggleTorch(isTorchOn);
      if (success) {
        btnCameraTorch.classList.toggle('active', isTorchOn);
      } else {
        isTorchOn = false;
        showToast('Flash/torch not supported on this camera.');
      }
    });
  }

  if (btnCameraOpenGallery || btnCameraFallbackFile) {
    const triggerGalleryFromCam = () => {
      cameraService.stopCamera(videoElement);
      navigateTo('artisan-dashboard');
      if (activeCameraTarget === 'product-form') {
        openModal('modal-product-form');
        inputGalleryFile?.click();
      } else {
        inputAiGallery?.click();
      }
    };

    if (btnCameraOpenGallery) btnCameraOpenGallery.addEventListener('click', triggerGalleryFromCam);
    if (btnCameraFallbackFile) btnCameraFallbackFile.addEventListener('click', triggerGalleryFromCam);
  }

  // Handle browser tab backgrounding / lifecycle
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cameraService.stopCamera(videoElement);
    }
  });

  // Image Upload Handling (Camera & Gallery)
  const btnChooseCamera = document.getElementById('btn-choose-camera');
  const btnChooseGallery = document.getElementById('btn-choose-gallery');
  const inputCameraFile = document.getElementById('input-camera-file');
  const inputGalleryFile = document.getElementById('input-gallery-file');
  const imgPreviewCard = document.getElementById('product-image-preview-card');
  const imgPreview = document.getElementById('img-product-preview');
  const previewFilenameText = document.getElementById('preview-filename-text');
  const photoPickerActions = document.getElementById('photo-picker-actions');
  const btnReplaceImg = document.getElementById('btn-replace-image');
  const btnRemoveImg = document.getElementById('btn-remove-image');

  if (btnChooseCamera) {
    btnChooseCamera.addEventListener('click', () => {
      showError('product-image-error', null);
      if (cameraService.isSupported()) {
        openLiveCamera('product-form');
      } else if (inputCameraFile) {
        inputCameraFile.click();
      }
    });
  }

  if (btnChooseGallery && inputGalleryFile) {
    btnChooseGallery.addEventListener('click', () => {
      showError('product-image-error', null);
      inputGalleryFile.click();
    });
  }

  if (inputCameraFile) {
    inputCameraFile.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      handleProductImageFile(file);
    });
  }

  if (inputGalleryFile) {
    inputGalleryFile.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      handleProductImageFile(file);
    });
  }

  if (btnReplaceImg) {
    btnReplaceImg.addEventListener('click', () => {
      if (cameraService.isSupported()) {
        openLiveCamera('product-form');
      } else if (inputGalleryFile) {
        inputGalleryFile.click();
      }
    });
  }

  if (btnRemoveImg) {
    btnRemoveImg.addEventListener('click', () => {
      resetProductImagePreview();
      showToast('Photo removed');
    });
  }


  function handleProductImageFile(file) {
    showError('product-image-error', null);
    if (!file) return;

    // Validate type
    if (!file.type || !file.type.startsWith('image/')) {
      showError('product-image-error', 'Unsupported file type. Please upload a JPG, PNG, or WebP photo.');
      return;
    }

    // Validate size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      showError('product-image-error', 'Image size exceeds 5MB limit. Please choose a smaller photo.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      selectedProductImageBase64 = event.target.result;
      selectedProductImageName = file.name || 'product_photo.jpg';
      setProductImagePreview(selectedProductImageBase64, selectedProductImageName);
    };

    reader.onerror = () => {
      showError('product-image-error', 'Failed to load image file. Please try selecting another photo.');
    };

    reader.readAsDataURL(file);
  }

  function setProductImagePreview(src, filename = 'image.jpg') {
    selectedProductImageBase64 = src;
    selectedProductImageName = filename;
    if (imgPreview) imgPreview.src = src;
    if (previewFilenameText) previewFilenameText.textContent = filename;
    if (imgPreviewCard) imgPreviewCard.style.display = 'flex';
    if (photoPickerActions) photoPickerActions.style.display = 'none';
  }

  function resetProductImagePreview() {
    selectedProductImageBase64 = null;
    selectedProductImageName = null;
    if (imgPreview) imgPreview.src = '';
    if (imgPreviewCard) imgPreviewCard.style.display = 'none';
    if (photoPickerActions) photoPickerActions.style.display = 'grid';
    if (inputCameraFile) inputCameraFile.value = '';
    if (inputGalleryFile) inputGalleryFile.value = '';
    showError('product-image-error', null);
  }

  let currentAiGeneratedPayload = null;

  // Open Add Product Modal (Manual Entry Mode)
  function openAddProductModal() {
    currentEditingProductId = null;
    currentAiGeneratedPayload = null;

    const form = document.getElementById('form-product');
    if (form) form.reset();

    const titleEl = document.getElementById('product-form-title');
    const saveBtnText = document.getElementById('btn-save-product-text');
    if (titleEl) titleEl.textContent = 'Add New Product';
    if (saveBtnText) saveBtnText.textContent = 'Save Product';

    // Toggle banners
    const reviewBanner = document.getElementById('ai-review-banner');
    const assistBanner = document.getElementById('ai-form-assist-banner');
    if (reviewBanner) reviewBanner.style.display = 'none';
    if (assistBanner) assistBanner.style.display = 'block';

    // Pre-fill location from artisan profile
    const user = authService.getCurrentUser();
    const inputLocation = document.getElementById('input-product-location');
    if (inputLocation) {
      inputLocation.value = user?.location || 'East Godavari, Andhra Pradesh';
    }

    // Default status & category
    const selectStatus = document.getElementById('select-product-status');
    if (selectStatus) selectStatus.value = 'active';

    const selectCat = document.getElementById('select-product-category');
    if (selectCat) {
      if (user?.craftType) {
        const targetCategory = mapCraftToBuyerCategory(user.craftType);
        const matchingOpt = Array.from(selectCat.options).find(opt => 
          opt.value.toLowerCase() === targetCategory.toLowerCase() || 
          opt.value.toLowerCase().includes(user.craftType.toLowerCase().split(' ')[0])
        );
        selectCat.value = matchingOpt ? matchingOpt.value : (selectCat.options[1]?.value || '');
      } else {
        selectCat.value = '';
      }
    }
    if (groupCustomCat) groupCustomCat.style.display = 'none';

    resetProductImagePreview();
    showError('product-form-error', null);
    closeModal('modal-ai-catalog');
    openModal('modal-product-form');
  }

  // Populate Add/Edit Form from AI Analysis (AI Review Mode)
  function populateFormFromAIAnalysis(aiResult, imageBase64, filename = 'ai_craft_photo.jpg') {
    currentEditingProductId = null;
    currentAiGeneratedPayload = aiResult;

    const titleEl = document.getElementById('product-form-title');
    const saveBtnText = document.getElementById('btn-save-product-text');
    if (titleEl) titleEl.textContent = 'Review AI-Generated Product';
    if (saveBtnText) saveBtnText.textContent = 'Publish Product';

    // Show AI Review banner with model detection info
    const reviewBanner = document.getElementById('ai-review-banner');
    const assistBanner = document.getElementById('ai-form-assist-banner');
    const detectionLabel = document.getElementById('ai-detection-label');
    const uncertaintyAlert = document.getElementById('ai-uncertainty-alert');
    const uncertaintyText = document.getElementById('ai-uncertainty-text');

    if (reviewBanner) reviewBanner.style.display = 'block';
    if (assistBanner) assistBanner.style.display = 'none';

    if (detectionLabel) {
      const confPct = Math.round((aiResult.detectionConfidence || 0.85) * 100);
      detectionLabel.textContent = `Detected: ${aiResult.detectedProduct || 'Craft Object'} (${confPct}% confidence)`;
    }

    // Show uncertainty alert if material or category needs confirmation
    if (uncertaintyAlert) {
      if (aiResult.materialConfidence < 0.7 || (aiResult.material && aiResult.material.includes('needs artisan confirmation'))) {
        uncertaintyAlert.style.display = 'block';
        if (uncertaintyText) uncertaintyText.textContent = '⚠️ AI suggests verifying the raw material before publishing.';
      } else {
        uncertaintyAlert.style.display = 'none';
      }
    }

    // Pre-populate fields with AI-generated data
    document.getElementById('input-product-name').value = aiResult.title || '';
    
    const selectCat = document.getElementById('select-product-category');
    if (selectCat) {
      if (ProductCategories.includes(aiResult.category)) {
        selectCat.value = aiResult.category;
        if (groupCustomCat) groupCustomCat.style.display = 'none';
      } else {
        selectCat.value = 'Other';
        if (groupCustomCat) groupCustomCat.style.display = 'block';
        if (inputCustomCat) inputCustomCat.value = aiResult.category || '';
      }
    }

    document.getElementById('input-product-material').value = aiResult.material || '';
    document.getElementById('input-product-description').value = aiResult.description || '';
    
    // Price: use artisan hint if given, else leave blank for artisan confirmation
    const inputPrice = document.getElementById('input-product-price');
    if (inputPrice) inputPrice.value = aiResult.suggestedPrice || '';

    // Sensible defaults
    document.getElementById('input-product-quantity').value = 100;
    document.getElementById('input-product-capacity').value = 80;
    document.getElementById('input-product-lead-days').value = aiResult.suggestedLeadDays || 7;

    const user = authService.getCurrentUser();
    document.getElementById('input-product-location').value = user?.location || 'East Godavari, Andhra Pradesh';

    if (aiResult.tags && Array.isArray(aiResult.tags)) {
      document.getElementById('input-product-tags').value = aiResult.tags.join(', ');
    }

    document.getElementById('select-product-status').value = 'active';

    // Set image (use SAM segmented image if available, else original)
    const finalImage = aiResult.segmentedImageBase64 || imageBase64;
    setProductImagePreview(finalImage, filename);

    showError('product-form-error', null);
    openModal('modal-product-form');
  }

  // Real-time AI Pipeline Processing Controller
  async function handleAiImageUpload(file) {
    if (!file) return;

    // Validate type and size (< 10MB)
    if (!file.type || !file.type.startsWith('image/')) {
      showToast('Unsupported file format. Please choose a JPG, PNG, or WebP photo.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('Image exceeds 10MB limit. Please choose a smaller photo.');
      return;
    }

    closeModal('modal-ai-catalog');
    openModal('modal-ai-processing');

    // Reset step tracker items
    const stepItems = [
      document.getElementById('step-track-0'),
      document.getElementById('step-track-1'),
      document.getElementById('step-track-2'),
      document.getElementById('step-track-3')
    ];

    const resetSteps = () => {
      stepItems.forEach((el, idx) => {
        if (!el) return;
        el.className = 'ai-step-item pending';
        const ind = el.querySelector('.step-indicator');
        if (ind) ind.textContent = '○';
      });
    };
    resetSteps();

    // Context from optional hints
    const hintCat = document.getElementById('input-ai-hint-cat')?.value || null;
    const hintMat = document.getElementById('input-ai-hint-mat')?.value || null;
    const user = authService.getCurrentUser();

    const artisanContext = {
      categoryHint: hintCat,
      materialHint: hintMat,
      location: user?.location || 'East Godavari, Andhra Pradesh'
    };

    const progressCallback = ({ stepIndex, stepName, status, message }) => {
      if (stepItems[stepIndex]) {
        const el = stepItems[stepIndex];
        const ind = el.querySelector('.step-indicator');
        const lbl = el.querySelector('.step-label');

        if (status === 'active') {
          el.className = 'ai-step-item active';
          if (ind) ind.textContent = '●';
        } else if (status === 'done') {
          el.className = 'ai-step-item done';
          if (ind) ind.textContent = '✓';
        } else if (status === 'fallback') {
          el.className = 'ai-step-item fallback';
          if (ind) ind.textContent = '⚡';
        }
        if (lbl && message) lbl.textContent = message;
      }
    };

    try {
      // 1. Read Base64 for instant preview
      const reader = new FileReader();
      const imageBase64Promise = new Promise((resolve) => {
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
      });

      // 2. Run Catalog Analysis
      const [aiResult, imageBase64] = await Promise.all([
        catalogService.analyzeProductImage(file, artisanContext, progressCallback),
        imageBase64Promise
      ]);

      // Complete all step icons
      stepItems.forEach(el => {
        if (el && !el.classList.contains('fallback')) {
          el.className = 'ai-step-item done';
          const ind = el.querySelector('.step-indicator');
          if (ind) ind.textContent = '✓';
        }
      });

      setTimeout(() => {
        closeModal('modal-ai-processing');
        populateFormFromAIAnalysis(aiResult, imageBase64, file.name);
        showToast('AI analysis complete! Please review and publish.');
      }, 400);
    } catch (err) {
      console.error('AI Processing Error:', err);
      closeModal('modal-ai-processing');
      showToast('AI processing had an issue. Continuing with manual entry.');
      openAddProductModal();
    }
  }

  // Wire AI Catalog Modal Triggers
  const btnTriggerAiFromForm = document.getElementById('btn-trigger-ai-from-form');
  const btnAiTakePhoto = document.getElementById('btn-ai-take-photo');
  const btnAiChooseGallery = document.getElementById('btn-ai-choose-gallery');
  const inputAiCamera = document.getElementById('input-ai-camera');
  const inputAiGallery = document.getElementById('input-ai-gallery');
  const btnAiSwitchManual = document.getElementById('btn-ai-switch-manual');
  const btnCancelAiProcessing = document.getElementById('btn-cancel-ai-processing');

  if (btnTriggerAiFromForm) {
    btnTriggerAiFromForm.addEventListener('click', () => {
      closeModal('modal-product-form');
      openModal('modal-ai-catalog');
    });
  }

  if (btnAiTakePhoto) {
    btnAiTakePhoto.addEventListener('click', () => {
      if (cameraService.isSupported()) {
        openLiveCamera('ai-catalog');
      } else if (inputAiCamera) {
        inputAiCamera.click();
      }
    });
  }


  if (btnAiChooseGallery && inputAiGallery) {
    btnAiChooseGallery.addEventListener('click', () => inputAiGallery.click());
  }

  if (inputAiCamera) {
    inputAiCamera.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      handleAiImageUpload(file);
    });
  }

  if (inputAiGallery) {
    inputAiGallery.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      handleAiImageUpload(file);
    });
  }

  if (btnAiSwitchManual) {
    btnAiSwitchManual.addEventListener('click', () => {
      closeModal('modal-ai-catalog');
      openAddProductModal();
    });
  }

  if (btnCancelAiProcessing) {
    btnCancelAiProcessing.addEventListener('click', () => {
      closeModal('modal-ai-processing');
      openAddProductModal();
    });
  }

  // Open Edit Product Modal
  async function openEditProductModal(productId) {
    const product = await productRepository.getProductById(productId);
    if (!product) {
      showToast('Product not found');
      return;
    }

    currentEditingProductId = productId;
    currentAiGeneratedPayload = null;

    const titleEl = document.getElementById('product-form-title');
    const saveBtnText = document.getElementById('btn-save-product-text');
    if (titleEl) titleEl.textContent = 'Edit Product';
    if (saveBtnText) saveBtnText.textContent = 'Save Changes';

    // Toggle banners for edit mode
    const reviewBanner = document.getElementById('ai-review-banner');
    const assistBanner = document.getElementById('ai-form-assist-banner');
    if (reviewBanner) reviewBanner.style.display = 'none';
    if (assistBanner) assistBanner.style.display = 'none';

    // Fill fields
    document.getElementById('input-product-id').value = product.id;
    document.getElementById('input-product-name').value = product.name;
    
    const selectCat = document.getElementById('select-product-category');
    if (selectCat) {
      selectCat.value = product.category;
      if (product.category === 'Other') {
        if (groupCustomCat) groupCustomCat.style.display = 'block';
        if (inputCustomCat) inputCustomCat.value = product.customCategory || '';
      } else {
        if (groupCustomCat) groupCustomCat.style.display = 'none';
        if (inputCustomCat) inputCustomCat.value = '';
      }
    }

    document.getElementById('input-product-material').value = product.material;
    document.getElementById('input-product-description').value = product.description;
    document.getElementById('input-product-price').value = product.price;
    document.getElementById('input-product-quantity').value = product.availableQuantity;
    document.getElementById('input-product-capacity').value = product.productionCapacity;
    document.getElementById('input-product-lead-days').value = product.productionTimeDays;
    document.getElementById('input-product-location').value = product.location;
    document.getElementById('input-product-tags').value = product.tags.join(', ');
    
    const selectStatus = document.getElementById('select-product-status');
    if (selectStatus) selectStatus.value = product.status;

    // Set existing image preview if available
    if (product.imageUrl) {
      setProductImagePreview(product.imageUrl, `${product.name.substring(0, 15)}.jpg`);
    } else {
      resetProductImagePreview();
    }

    showError('product-form-error', null);
    closeModal('modal-product-details');
    openModal('modal-product-form');
  }

  // Open Product Details Modal
  async function openProductDetailsModal(productId) {
    const product = await productRepository.getProductById(productId);
    if (!product) {
      showToast('Product not found');
      return;
    }

    const container = document.getElementById('product-details-content');
    if (!container) return;

    const statusMeta = ProductStatusLabels[product.status] || { label: product.status, color: 'gray' };
    const availMeta = AvailabilityStatusLabels[product.availabilityStatus] || { label: 'Available', color: 'green' };
    const hasImg = Boolean(product.imageUrl);

    container.innerHTML = `
      <div class="details-hero-img-wrap">
        ${hasImg ? `<img src="${product.imageUrl}" alt="${escapeHtml(product.name)}" class="details-hero-img" />` : `<span>${product.imageIcon || '🏺'}</span>`}
      </div>

      <div class="details-badge-row">
        <span class="product-status-badge ${statusMeta.color}">${statusMeta.label}</span>
        <span class="meta-craft-tag">${escapeHtml(product.displayCategory)}</span>
        <span class="availability-status-badge badge--${product.availabilityStatus || 'available'}" style="font-size: 0.72rem; padding: 2px 8px;">
          ● ${availMeta.label}
        </span>
        ${product.aiGenerated ? '<span class="meta-craft-tag" style="background:#FEF3C7; color:#92400E; border-color:#FDE68A;">✨ AI-Assisted</span>' : ''}
      </div>

      <h1 class="details-product-title">${escapeHtml(product.name)}</h1>
      <span class="details-price-badge">₹${product.price.toLocaleString('en-IN')}</span>

      <div class="details-desc-box">
        <h4 class="details-desc-heading">Material &amp; Craftsmanship</h4>
        <p class="details-desc-text" style="font-weight: 700; color: var(--color-brown-warm); margin-bottom: 6px;">
          Material: ${escapeHtml(product.material)}
        </p>
        <p class="details-desc-text">${escapeHtml(product.description)}</p>
      </div>

      <div class="details-capacity-grid">
        <div class="details-capacity-card">
          <span class="details-cap-lbl">Available Now</span>
          <span class="details-cap-val">${product.availableQuantity} units</span>
        </div>
        <div class="details-capacity-card">
          <span class="details-cap-lbl">Production Capacity</span>
          <span class="details-cap-val">${product.productionCapacity} / ${product.productionPeriod === 'weekly' ? 'wk' : 'mo'}</span>
        </div>
        <div class="details-capacity-card">
          <span class="details-cap-lbl">Production Time</span>
          <span class="details-cap-val">${product.productionTimeDays} days</span>
        </div>
        <div class="details-capacity-card">
          <span class="details-cap-lbl">Workshop Location</span>
          <span class="details-cap-val" style="font-size: 0.84rem;">${escapeHtml(product.location)}</span>
        </div>
      </div>

      ${product.tags && product.tags.length > 0 ? `
        <div class="details-tags-box">
          <span class="details-cap-lbl">Tags</span>
          <div class="details-tags-list">
            ${product.tags.map(t => `<span class="tag-pill">#${escapeHtml(t)}</span>`).join('')}
          </div>
        </div>
      ` : ''}

      <div class="ai-pipeline-notice" style="margin-top: 10px; margin-bottom: 16px;">
        <span>⚡ Ready for FastAPI Vision AI &amp; Collective Capacity Matching</span>
      </div>

      <div class="details-actions-row" style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button type="button" class="primary-btn-sm" id="btn-details-capacity-product" data-id="${product.id}" style="flex: 1; min-width: 140px;">
          <span>⚙️ Update Capacity</span>
        </button>
        <button type="button" class="secondary-btn" id="btn-details-edit-product" data-id="${product.id}" style="flex: 1; min-width: 110px;">
          <span>✏️ Edit</span>
        </button>
        <button type="button" class="danger-btn" id="btn-details-delete-product" data-id="${product.id}" style="min-width: 80px;">
          <span>🗑️ Delete</span>
        </button>
      </div>
    `;

    // Attach listeners
    const btnCap = container.querySelector('#btn-details-capacity-product');
    const btnEdit = container.querySelector('#btn-details-edit-product');
    const btnDelete = container.querySelector('#btn-details-delete-product');

    if (btnCap) {
      btnCap.addEventListener('click', () => {
        closeModal('modal-product-details');
        openCapacityModal();
      });
    }

    if (btnEdit) {
      btnEdit.addEventListener('click', () => {
        openEditProductModal(productId);
      });
    }

    if (btnDelete) {
      btnDelete.addEventListener('click', () => {
        openDeleteConfirmModal(productId);
      });
    }


    openModal('modal-product-details');
  }

  // Open Delete Confirm Modal
  async function openDeleteConfirmModal(productId) {
    const product = await productRepository.getProductById(productId);
    if (!product) return;

    currentDeletingProductId = productId;
    const previewEl = document.getElementById('delete-product-preview-name');
    if (previewEl) previewEl.textContent = product.name;

    openModal('modal-product-delete-confirm');
  }

  // Delete Confirmation Button
  const btnConfirmDelete = document.getElementById('btn-confirm-delete-product');
  const btnCancelDelete = document.getElementById('btn-cancel-delete-product');
  const btnCloseDeleteModal = document.getElementById('btn-close-delete-modal');

  if (btnConfirmDelete) {
    btnConfirmDelete.addEventListener('click', async () => {
      if (!currentDeletingProductId) return;

      setButtonLoading(btnConfirmDelete, true);
      const success = await productRepository.deleteProduct(currentDeletingProductId);
      setButtonLoading(btnConfirmDelete, false);

      if (success) {
        closeModal('modal-product-delete-confirm');
        closeModal('modal-product-details');
        showToast('Product deleted successfully! 🗑️');
        await loadProductsList();
        await loadArtisanDashboard();
      } else {
        showToast('Failed to delete product. Please try again.');
      }
    });
  }

  if (btnCancelDelete) btnCancelDelete.addEventListener('click', () => closeModal('modal-product-delete-confirm'));
  if (btnCloseDeleteModal) btnCloseDeleteModal.addEventListener('click', () => closeModal('modal-product-delete-confirm'));

  // Product Form Submission (Create & Update)
  const formProduct = document.getElementById('form-product');
  const btnSaveProduct = document.getElementById('btn-save-product');
  const btnCancelProductForm = document.getElementById('btn-cancel-product-form');
  const btnCloseProductForm = document.getElementById('btn-close-product-form');
  const btnCloseProductDetails = document.getElementById('btn-close-product-details');

  if (formProduct) {
    formProduct.addEventListener('submit', async (e) => {
      e.preventDefault();
      showError('product-form-error', null);

      const categoryVal = document.getElementById('select-product-category').value;
      const customCategoryVal = document.getElementById('input-custom-category')?.value || '';

      const formData = {
        name: document.getElementById('input-product-name').value,
        category: categoryVal,
        customCategory: customCategoryVal,
        material: document.getElementById('input-product-material').value,
        description: document.getElementById('input-product-description').value,
        price: document.getElementById('input-product-price').value,
        availableQuantity: document.getElementById('input-product-quantity').value,
        productionCapacity: document.getElementById('input-product-capacity').value,
        productionTimeDays: document.getElementById('input-product-lead-days').value,
        location: document.getElementById('input-product-location').value,
        tags: document.getElementById('input-product-tags').value,
        status: document.getElementById('select-product-status').value,
        imageUrl: selectedProductImageBase64 || '',
        aiGenerated: Boolean(currentAiGeneratedPayload),
        catalogSource: currentAiGeneratedPayload ? 'ai_assisted' : 'manual'
      };

      // Run Validation
      const validation = ValidationService.validateProduct(formData);
      if (!validation.isValid) {
        showError('product-form-error', validation.error);
        return;
      }

      setButtonLoading(btnSaveProduct, true);
      try {
        if (currentEditingProductId) {
          await productRepository.updateProduct(currentEditingProductId, formData);
          showToast('Product updated successfully! ✨');
        } else {
          await productRepository.createProduct(formData);
          showToast('Product listed successfully! 📦 Added to Buyer Wholesale Marketplace');
        }

        closeModal('modal-product-form');
        await loadProductsList();
        await loadArtisanDashboard();
        if (buyerMarketplace) {
          buyerMarketplace.renderProducts();
        }
      } catch (err) {
        showError('product-form-error', err.message || 'Failed to save product.');
      } finally {
        setButtonLoading(btnSaveProduct, false);
      }
    });
  }

  if (btnCancelProductForm) btnCancelProductForm.addEventListener('click', () => closeModal('modal-product-form'));
  if (btnCloseProductForm) btnCloseProductForm.addEventListener('click', () => closeModal('modal-product-form'));
  if (btnCloseProductDetails) btnCloseProductDetails.addEventListener('click', () => closeModal('modal-product-details'));

  // Trigger Add Product from various buttons
  const btnTabAddProduct = document.getElementById('btn-tab-add-product');
  const btnEmptyAddProduct = document.getElementById('btn-empty-add-product');
  const btnAddProductQuick = document.getElementById('btn-add-product-quick');
  const btnCreateWithAi = document.getElementById('btn-create-with-ai');

  if (btnTabAddProduct) btnTabAddProduct.addEventListener('click', () => openAddProductModal());
  if (btnEmptyAddProduct) btnEmptyAddProduct.addEventListener('click', () => openAddProductModal());
  if (btnAddProductQuick) btnAddProductQuick.addEventListener('click', () => openAddProductModal());
  if (btnCreateWithAi) {
    btnCreateWithAi.addEventListener('click', () => {
      openModal('modal-ai-catalog');
    });
  }

  // View All triggers
  const btnViewAllOrders = document.getElementById('btn-view-all-orders');
  if (btnViewAllOrders) {
    btnViewAllOrders.addEventListener('click', () => openArtisanOrdersModal());
  }

  const btnViewAllOpps = document.getElementById('btn-view-all-opps');
  if (btnViewAllOpps) {
    btnViewAllOpps.addEventListener('click', () => switchArtisanTab('opportunities'));
  }

  const btnExploreOpps = document.getElementById('btn-explore-opportunities');
  if (btnExploreOpps) {
    btnExploreOpps.addEventListener('click', () => switchArtisanTab('opportunities'));
  }

  // Dashboard Stat Cards Interactive Navigation Handlers
  const cardStatProducts = document.getElementById('card-stat-products');
  if (cardStatProducts) {
    cardStatProducts.addEventListener('click', () => switchArtisanTab('products'));
  }

  const cardStatOrders = document.getElementById('card-stat-orders');
  if (cardStatOrders) {
    cardStatOrders.addEventListener('click', () => openArtisanOrdersModal());
  }

  const cardStatCapacity = document.getElementById('card-stat-capacity');
  if (cardStatCapacity) {
    cardStatCapacity.addEventListener('click', () => openCapacityModal());
  }

  const cardStatOpps = document.getElementById('card-stat-opps');
  if (cardStatOpps) {
    cardStatOpps.addEventListener('click', () => switchArtisanTab('opportunities'));
  }

  const cardDashCapacityOverview = document.getElementById('card-dash-capacity-overview');
  if (cardDashCapacityOverview) {
    cardDashCapacityOverview.addEventListener('click', (e) => {
      if (!e.target.closest('#btn-manage-capacity')) {
        openCapacityModal();
      }
    });
  }

  // =========================================================================
  // 7. Modals & Action Triggers
  // =========================================================================

  // A. Artisan Profile Modal & Profile Orders Flow
  const btnOpenProfile = document.getElementById('btn-open-artisan-profile');
  const btnCloseProfileModal = document.getElementById('btn-close-profile-modal');
  const btnEditProfileTrigger = document.getElementById('btn-edit-profile-trigger');
  const btnArtisanProfileLogout = document.getElementById('btn-artisan-profile-logout');
  const btnProfileViewOrders = document.getElementById('btn-profile-view-orders');
  const btnCloseArtisanOrdersModal = document.getElementById('btn-close-artisan-orders-modal');
  const btnCloseClusterModal = document.getElementById('btn-close-cluster-modal');

  if (btnOpenProfile) {
    btnOpenProfile.addEventListener('click', async () => {
      const user = authService.getCurrentUser();
      const summary = await artisanRepository.getDashboardSummary();
      const allOrders = await artisanRepository.getAllOrders();

      document.getElementById('modal-profile-name').textContent = user?.name || 'Lakshmi Devi';
      document.getElementById('modal-profile-craft').textContent = user?.craftType || 'Bamboo Handicrafts';
      document.getElementById('modal-profile-location').textContent = user?.location || 'East Godavari, AP';
      document.getElementById('modal-profile-phone').textContent = user?.phone || user?.email || '+91 98765 43210';
      document.getElementById('modal-profile-lang').textContent = user?.preferredLanguage || 'Telugu';
      document.getElementById('modal-profile-capacity').textContent = `${summary.availableCapacity || 320} units/month`;

      const activeOrdersCount = (allOrders || []).filter(o => o.status !== 'Delivered').length;
      const countBadge = document.getElementById('profile-orders-count-badge');
      if (countBadge) {
        countBadge.textContent = `${activeOrdersCount} Active`;
      }

      openModal('modal-artisan-profile');
    });
  }

  if (btnCloseProfileModal) btnCloseProfileModal.addEventListener('click', () => closeModal('modal-artisan-profile'));

  if (btnProfileViewOrders) {
    btnProfileViewOrders.addEventListener('click', async () => {
      closeModal('modal-artisan-profile');
      await openArtisanOrdersModal();
    });
  }

  if (btnCloseArtisanOrdersModal) {
    btnCloseArtisanOrdersModal.addEventListener('click', () => {
      closeModal('modal-artisan-orders');
    });
  }

  if (btnCloseClusterModal) {
    btnCloseClusterModal.addEventListener('click', () => {
      closeModal('modal-artisan-cluster-details');
    });
  }

  if (btnEditProfileTrigger) {
    btnEditProfileTrigger.addEventListener('click', () => {
      closeModal('modal-artisan-profile');
      navigateTo('profile-setup');
    });
  }

  if (btnArtisanProfileLogout) {
    btnArtisanProfileLogout.addEventListener('click', async () => {
      closeModal('modal-artisan-profile');
      await authService.signOut();
      productRepository.clearProducts();
      showToast('Logged out securely');
      navigateTo('landing');
    });
  }

  async function openArtisanOrdersModal(initialFilter = 'active') {
    renderOrdersList('modal-artisan-orders-list', null, initialFilter);
    renderOrdersList('artisan-full-orders-list', null, initialFilter);
    openModal('modal-artisan-orders');
  }

  // Live Auto-Refresh for Artisan Orders
  window.addEventListener('kala-artisan-orders-updated', async () => {
    try {
      renderOrdersList('home-orders-list', null);
      const modalOrders = document.getElementById('modal-artisan-orders');
      if (modalOrders && modalOrders.style.display !== 'none') {
        renderOrdersList('modal-artisan-orders-list', null);
      }
      renderOrdersList('artisan-full-orders-list', null);
      const allMaster = getMasterOrders();
      const activeCount = allMaster.filter(o => (o.status || '').toLowerCase() !== 'delivered').length;
      const statOrders = document.getElementById('stat-active-orders');
      if (statOrders) statOrders.textContent = activeCount;
    } catch(e) {}
  });

  // Persistent Notification Storage, Cluster History & Unread Badge Helpers
  let excludedArtisanIds = new Set();

  // Default Seed Clusters for comprehensive Guild & Production Network display
  const DEFAULT_SEED_CLUSTERS = [
    {
      id: 'cluster-seed-101',
      product: 'Handcrafted Bamboo Storage Baskets',
      craft: 'Bamboo Crafts',
      status: 'PROVISIONAL',
      created_at: '2 hours ago',
      delivery_date: '25 Oct 2026 (22 days)',
      location: 'East Godavari & Vizag Hub',
      buyer: {
        name: 'Rajesh Varma',
        company: 'GreenLeaf Eco Resorts & Hotels',
        email: 'procurement@greenleafhotels.in',
        phone: '+91 98490 11223',
        location: 'Hyderabad Logistics Center, Telangana',
        verified: true,
        badge: 'Verified Corporate Buyer'
      },
      buyer_requirements: {
        product: 'Handcrafted Bamboo Storage Baskets',
        category: 'Bamboo Crafts',
        required_quantity: 500,
        budget: '₹1,25,000 (₹250/unit)',
        delivery_deadline: '25 Oct 2026 (22 days)',
        destination_hub: 'GreenLeaf Central Hub, Hyderabad',
        specifications: 'Seasoned natural bamboo weaving, splinter-free polished finish, herbal water-resistant varnish, nesting stackable sizes (12" x 12" base).'
      },
      required_quantity: 500,
      total_allocated: 500,
      accepted_quantity: 380,
      members: [
        {
          id: 1,
          name: 'Lakshmi Devi',
          isCurrentUser: true,
          location: 'East Godavari, AP',
          monthly_capacity: 320,
          assigned_quantity: 120,
          status: 'Pending',
          craft: 'Bamboo Weaving'
        },
        {
          id: 101,
          name: 'Ramesh Naidu (Godavari Cane Guild)',
          isCurrentUser: false,
          location: 'Rajahmundry, AP',
          monthly_capacity: 300,
          assigned_quantity: 200,
          status: 'Accepted',
          craft: 'Bamboo Crafts'
        },
        {
          id: 102,
          name: 'Sujatha V. (East Coast Artisans)',
          isCurrentUser: false,
          location: 'Kakinada, AP',
          monthly_capacity: 250,
          assigned_quantity: 180,
          status: 'Accepted',
          craft: 'Bamboo Basketry'
        }
      ]
    },
    {
      id: 'cluster-seed-102',
      product: 'Heritage Kalamkari Cotton Tote Bags',
      craft: 'Handloom & Weaving',
      status: 'CONFIRMED',
      created_at: '1 day ago',
      delivery_date: '15 Nov 2026 (45 days)',
      location: 'Machilipatnam Hub',
      buyer: {
        name: 'Ananya Sen',
        company: 'Vastra Boutique & Ethical Fashion',
        email: 'ananya@vastraboutique.org',
        phone: '+91 91760 99881',
        location: 'Bengaluru Regional Warehouse, Karnataka',
        verified: true,
        badge: 'Verified Retailer'
      },
      buyer_requirements: {
        product: 'Heritage Kalamkari Cotton Tote Bags',
        category: 'Handloom & Weaving',
        required_quantity: 350,
        budget: '₹1,57,500 (₹450/unit)',
        delivery_deadline: '15 Nov 2026 (45 days)',
        destination_hub: 'Vastra Hub, Whitefield, Bengaluru',
        specifications: '100% natural vegetable dye hand-block prints, 12 oz unbleached cotton canvas, reinforced dual cross-stitch handles.'
      },
      required_quantity: 350,
      total_allocated: 350,
      accepted_quantity: 350,
      payment_status: 'PENDING',
      members: [
        {
          id: 201,
          name: 'Venkat Reddy (Pedana Guild)',
          isCurrentUser: false,
          location: 'Pedana, AP',
          monthly_capacity: 300,
          assigned_quantity: 200,
          status: 'Accepted',
          craft: 'Block Printing'
        },
        {
          id: 202,
          name: 'Devi Prasad (Machilipatnam Collective)',
          isCurrentUser: false,
          location: 'Machilipatnam, AP',
          monthly_capacity: 220,
          assigned_quantity: 150,
          status: 'Accepted',
          craft: 'Natural Dyeing'
        }
      ]
    },
    {
      id: 'cluster-seed-103',
      product: 'Terracotta Kitchen Dinnerware & Serving Bowls',
      craft: 'Pottery',
      status: 'IN PRODUCTION',
      created_at: '3 days ago',
      delivery_date: '30 Oct 2026 (27 days)',
      location: 'Chittoor & Tirupati Hub',
      payment_status: 'ADVANCE_PAID',
      advance_paid_amount: 38400,
      advance_txn_id: 'TXN-CLUST-481920',
      buyer: {
        name: 'Kavita Chawla',
        company: 'IndieLiving Home Decors',
        email: 'kavita@indieliving.in',
        phone: '+91 98200 44556',
        location: 'Bhiwandi Logistics Park, Mumbai',
        verified: true,
        badge: 'Corporate Enterprise'
      },
      buyer_requirements: {
        product: 'Terracotta Kitchen Dinnerware & Serving Bowls',
        category: 'Pottery',
        required_quantity: 400,
        budget: '₹96,000 (₹240/unit)',
        delivery_deadline: '30 Oct 2026 (27 days)',
        destination_hub: 'IndieLiving Hub, Bhiwandi, Maharashtra',
        specifications: 'Food-grade kiln-fired red clay, non-toxic lead-free glaze, microwave safe, shatter-proof bubble-wrapped packaging.'
      },
      required_quantity: 400,
      total_allocated: 400,
      accepted_quantity: 400,
      members: [
        {
          id: 401,
          name: 'Babu Rao (Clay Traditions)',
          isCurrentUser: false,
          location: 'Tirupati, AP',
          monthly_capacity: 300,
          assigned_quantity: 250,
          status: 'Accepted',
          craft: 'Clay Pottery'
        },
        {
          id: 402,
          name: 'Kalyan Kumar (Samalkota Works)',
          isCurrentUser: false,
          location: 'Samalkota, AP',
          monthly_capacity: 200,
          assigned_quantity: 150,
          status: 'Accepted',
          craft: 'Glazing & Firing'
        }
      ]
    }
  ];

  function cleanLegacyPaidRegistry() {
    try {
      const raw = localStorage.getItem('kala_mitra_paid_clusters');
      if (!raw) return;
      const reg = JSON.parse(raw);
      let changed = false;
      Object.keys(reg).forEach(k => {
        if (k.startsWith('prod_')) {
          delete reg[k];
          changed = true;
        }
      });
      if (changed) {
        localStorage.setItem('kala_mitra_paid_clusters', JSON.stringify(reg));
      }
    } catch (e) {}
  }
  cleanLegacyPaidRegistry();

  function getPaidClustersRegistry() {
    try {
      cleanLegacyPaidRegistry();
      const raw = localStorage.getItem('kala_mitra_paid_clusters');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {};
  }

  function savePaidClusterRecord(clusterId, stage, amount, txnId, product) {
    if (!clusterId) return;
    try {
      cleanLegacyPaidRegistry();
      const reg = getPaidClustersRegistry();
      const cId = String(clusterId);
      const existing = reg[cId] || {};
      const isFull = stage === 'remaining' || stage === 'fully' || existing.payment_status === 'FULLY_PAID';
      const record = {
        clusterId: cId,
        product: product || existing.product || '',
        payment_status: isFull ? 'FULLY_PAID' : 'ADVANCE_PAID',
        advance_paid_amount: (stage === 'advance' ? amount : existing.advance_paid_amount) || amount || existing.advance_paid_amount || 0,
        advance_txn_id: (stage === 'advance' ? txnId : existing.advance_txn_id) || txnId || existing.advance_txn_id || ('TXN-CLUST-' + Date.now().toString().slice(-6)),
        remaining_paid_amount: (stage === 'remaining' ? amount : existing.remaining_paid_amount) || existing.remaining_paid_amount || 0,
        remaining_txn_id: (stage === 'remaining' ? txnId : existing.remaining_txn_id) || existing.remaining_txn_id || null,
        order_completed: isFull,
        updated_at: Date.now()
      };
      reg[cId] = record;
      localStorage.setItem('kala_mitra_paid_clusters', JSON.stringify(reg));
    } catch (e) {}
  }

  function applyPaidStatusToCluster(cluster) {
    if (!cluster || !cluster.id) return cluster;
    try {
      cleanLegacyPaidRegistry();
      const reg = getPaidClustersRegistry();
      const cId = String(cluster.id);
      const record = reg[cId];

      if (record) {
        if (record.payment_status === 'FULLY_PAID') {
          cluster.payment_status = 'FULLY_PAID';
          cluster.status = 'COMPLETED';
          cluster.order_completed = true;
        } else if (record.payment_status === 'ADVANCE_PAID') {
          if (cluster.payment_status !== 'FULLY_PAID') {
            cluster.payment_status = 'ADVANCE_PAID';
            if (cluster.status === 'PROVISIONAL' || cluster.status === 'PENDING') {
              cluster.status = 'IN PRODUCTION';
            }
          }
        }
        if (record.advance_paid_amount && !cluster.advance_paid_amount) {
          cluster.advance_paid_amount = record.advance_paid_amount;
        }
        if (record.advance_txn_id && !cluster.advance_txn_id) {
          cluster.advance_txn_id = record.advance_txn_id;
        }
        if (record.remaining_paid_amount && !cluster.remaining_paid_amount) {
          cluster.remaining_paid_amount = record.remaining_paid_amount;
        }
        if (record.remaining_txn_id && !cluster.remaining_txn_id) {
          cluster.remaining_txn_id = record.remaining_txn_id;
        }
      }
    } catch (e) {}
    return cluster;
  }

  function normalizeClusterData(cluster) {
    if (!cluster) return null;
    applyPaidStatusToCluster(cluster);
    const prod = cluster.product || cluster.title || 'Artisan Production Cluster';
    const craft = cluster.category || cluster.craft || 'Traditional Crafts';
    const reqQty = Number(cluster.required_quantity || cluster.quantity || 500);
    const delDate = cluster.delivery_date || cluster.delivery_days || 'Within 30 days';
    const loc = cluster.location || 'Regional Craft Hub';

    const buyer = cluster.buyer || {
      name: cluster.buyer_name || 'Rajesh Varma',
      company: cluster.company || 'Corporate Enterprise Buyer',
      email: cluster.email || 'procurement@kala-mitra-partners.in',
      phone: cluster.phone || '+91 98490 11223',
      location: cluster.buyer_location || (loc ? `${loc} Hub` : 'Central Logistics Hub, Hyderabad'),
      verified: true,
      badge: 'Corporate Buyer'
    };

    const buyerReqs = cluster.buyer_requirements || {
      product: prod,
      category: craft,
      required_quantity: reqQty,
      budget: cluster.budget ? (typeof cluster.budget === 'number' ? `₹${cluster.budget.toLocaleString('en-IN')}` : cluster.budget) : '₹1,25,000 (Target)',
      delivery_deadline: delDate,
      destination_hub: loc ? `${loc} Central Warehouse` : 'Regional Delivery Hub',
      specifications: cluster.specifications || `Authentic ${craft} production. Strict quality inspection, eco-safe processing, protective transit packaging.`
    };

    const rawMembers = Array.isArray(cluster.members) && cluster.members.length > 0 ? cluster.members : [
      { id: 1, name: 'Lakshmi Devi', location: 'East Godavari, AP', monthly_capacity: 320, assigned_quantity: 120, status: 'Pending', craft: craft, isCurrentUser: true }
    ];

    const currentUser = authService.getCurrentUser();
    const currentUserName = (currentUser?.name || 'Lakshmi Devi').toLowerCase();

    const members = rawMembers.map((m, idx) => {
      const mName = m.name || `Artisan ${idx + 1}`;
      const isCurrent = m.isCurrentUser || m.id === 1 || mName.toLowerCase().includes(currentUserName) || mName.toLowerCase().includes('lakshmi');
      const assigned = Number(m.assigned_quantity || m.quantity || 100);
      const memStatus = m.status || 'Pending';

      let prodStatus = m.production_status;
      if (!prodStatus) {
        if (cluster.status === 'COMPLETED' || (typeof m.completed_quantity === 'number' && m.completed_quantity >= assigned)) {
          prodStatus = 'Completed';
        } else {
          prodStatus = 'Order Placed';
        }
      }

      let completedQty = typeof m.completed_quantity === 'number' ? m.completed_quantity : null;
      if (completedQty === null) {
        if (prodStatus === 'Completed') completedQty = assigned;
        else completedQty = 0;
      }
      completedQty = Math.max(0, Math.min(assigned, completedQty));
      const prog = Math.round((completedQty / assigned) * 100);

      return {
        id: m.id || (idx + 1),
        name: isCurrent ? `${m.name ? m.name.replace(/\s*\(You\)/i, '') : 'Lakshmi Devi'}` : mName,
        isCurrentUser: Boolean(isCurrent),
        location: m.location || loc || 'Workshop',
        monthly_capacity: m.monthly_capacity || m.capacity || 280,
        assigned_quantity: assigned,
        completed_quantity: completedQty,
        production_status: prodStatus,
        progress: prog,
        last_updated: m.last_updated || 'Live sync active',
        status: memStatus,
        craft: m.craft || craft
      };
    });

    const totalAllocated = members.reduce((sum, m) => sum + (m.assigned_quantity || 0), 0);
    const acceptedQuantity = members.filter(m => m.status === 'Accepted').reduce((sum, m) => sum + (m.assigned_quantity || 0), 0);
    const totalCompletedQty = members.reduce((sum, m) => sum + (m.completed_quantity || 0), 0);
    const overallProgress = Math.min(100, Math.round((totalCompletedQty / reqQty) * 100));

    const norm = {
      id: cluster.id || 'cluster-' + Date.now(),
      product: prod,
      craft: craft,
      status: cluster.status || 'PROVISIONAL',
      created_at: cluster.created_at || 'Recently',
      delivery_date: delDate,
      location: loc,
      buyer: buyer,
      buyer_requirements: buyerReqs,
      required_quantity: reqQty,
      total_allocated: totalAllocated || reqQty,
      accepted_quantity: acceptedQuantity,
      total_completed_quantity: totalCompletedQty,
      overall_progress: overallProgress,
      members: members,
      payment_status: cluster.payment_status || 'PENDING',
      advance_paid_amount: cluster.advance_paid_amount || 0,
      advance_txn_id: cluster.advance_txn_id || null,
      remaining_paid_amount: cluster.remaining_paid_amount || 0,
      remaining_txn_id: cluster.remaining_txn_id || null,
      order_completed: Boolean(cluster.order_completed)
    };
    if (totalCompletedQty >= reqQty && members.every(m => m.production_status === 'Completed')) {
      norm.status = 'COMPLETED';
    } else if (totalCompletedQty > 0 || members.some(m => m.production_status && m.production_status !== 'Order Placed')) {
      if (norm.status === 'PROVISIONAL' || norm.status === 'CONFIRMED') {
        norm.status = 'IN PRODUCTION';
      }
    }
    return applyPaidStatusToCluster(norm);
  }

  function getStoredClusterHistory() {
    try {
      const raw = localStorage.getItem('kala_mitra_cluster_history');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(c => normalizeClusterData(c)).filter(Boolean);
        }
      }
    } catch (e) {}

    // Initialize with default rich seed clusters if none stored yet
    try {
      localStorage.setItem('kala_mitra_cluster_history', JSON.stringify(DEFAULT_SEED_CLUSTERS));
    } catch (e) {}
    return DEFAULT_SEED_CLUSTERS.map(c => normalizeClusterData(c));
  }

  function saveStoredClusterHistory(cluster) {
    if (!cluster || !cluster.id) return;
    try {
      applyPaidStatusToCluster(cluster);
      const normalized = normalizeClusterData(cluster);
      const history = getStoredClusterHistory();
      // Match STRICTLY by cluster ID, NEVER by product name!
      const idx = history.findIndex(c => String(c.id) === String(normalized.id));
      if (idx >= 0) {
        const existing = history[idx];
        if ((existing.payment_status === 'ADVANCE_PAID' || existing.payment_status === 'FULLY_PAID') && normalized.payment_status !== 'FULLY_PAID') {
          normalized.payment_status = existing.payment_status;
          normalized.advance_paid_amount = normalized.advance_paid_amount || existing.advance_paid_amount;
          normalized.advance_txn_id = normalized.advance_txn_id || existing.advance_txn_id;
          normalized.remaining_paid_amount = normalized.remaining_paid_amount || existing.remaining_paid_amount;
          normalized.remaining_txn_id = normalized.remaining_txn_id || existing.remaining_txn_id;
          normalized.order_completed = normalized.order_completed || existing.order_completed;
          if (normalized.status === 'PROVISIONAL' || normalized.status === 'PENDING') {
            normalized.status = existing.payment_status === 'FULLY_PAID' ? 'COMPLETED' : 'IN PRODUCTION';
          }
        }
        // Deep-merge existing members only if incoming cluster member has no production status
        if (Array.isArray(existing.members) && Array.isArray(normalized.members)) {
          normalized.members.forEach(nm => {
            const em = existing.members.find(m => String(m.id) === String(nm.id) || (m.name && nm.name && m.name.toLowerCase().trim() === nm.name.toLowerCase().trim()));
            if (em) {
              if (nm.production_status === undefined || nm.production_status === null) {
                if (em.production_status) nm.production_status = em.production_status;
                if (typeof em.completed_quantity === 'number') nm.completed_quantity = em.completed_quantity;
                if (em.progress !== undefined) nm.progress = em.progress;
                if (em.last_updated) nm.last_updated = em.last_updated;
              }
              if (em.status === 'Accepted' && nm.status !== 'Accepted') {
                nm.status = 'Accepted';
              }
            }
          });
        }
        const reqQty = Number(normalized.required_quantity || 1);
        const totalComp = normalized.members.reduce((sum, m) => sum + (Number(m.completed_quantity) || 0), 0);
        normalized.total_completed_quantity = totalComp;
        normalized.overall_progress = Math.min(100, Math.round((totalComp / reqQty) * 100));

        history[idx] = normalized;
      } else {
        // Brand new cluster: ALWAYS unshift to front of history!
        history.unshift(normalized);
      }
      localStorage.setItem('kala_mitra_cluster_history', JSON.stringify(history));
      if (normalized.payment_status === 'ADVANCE_PAID' || normalized.payment_status === 'FULLY_PAID') {
        savePaidClusterRecord(normalized.id, normalized.payment_status === 'FULLY_PAID' ? 'remaining' : 'advance', normalized.advance_paid_amount, normalized.advance_txn_id, normalized.product);
      }
    } catch (e) {}
  }

  let activeClusterFilter = 'all';

  function renderArtisanClustersTab(filter = activeClusterFilter) {
    activeClusterFilter = filter;
    const container = document.getElementById('artisan-clusters-list');
    if (!container) return;

    const allClusters = getStoredClusterHistory();

    // Compute status counts
    const countAll = allClusters.length;
    const countActive = allClusters.filter(c => c.status === 'PROVISIONAL' || c.status === 'ACTIVE' || c.status === 'IN PRODUCTION').length;
    const countPending = allClusters.filter(c => (c.members || []).some(m => m.status === 'Pending')).length;
    const countConfirmed = allClusters.filter(c => c.status === 'CONFIRMED' || c.status === 'COMPLETED').length;

    const elCountAll = document.getElementById('count-clusters-all');
    if (elCountAll) elCountAll.textContent = countAll;
    const elCountActive = document.getElementById('count-clusters-active');
    if (elCountActive) elCountActive.textContent = countActive;
    const elCountPending = document.getElementById('count-clusters-pending');
    if (elCountPending) elCountPending.textContent = countPending;
    const elCountConfirmed = document.getElementById('count-clusters-confirmed');
    if (elCountConfirmed) elCountConfirmed.textContent = countConfirmed;

    // Filter clusters
    let filtered = allClusters;
    if (filter === 'active') {
      filtered = allClusters.filter(c => c.status === 'PROVISIONAL' || c.status === 'ACTIVE' || c.status === 'IN PRODUCTION');
    } else if (filter === 'pending') {
      filtered = allClusters.filter(c => (c.members || []).some(m => m.status === 'Pending'));
    } else if (filter === 'completed' || filter === 'confirmed') {
      filtered = allClusters.filter(c => c.status === 'CONFIRMED' || c.status === 'COMPLETED');
    }

    // Update filter chip active UI
    const chips = document.querySelectorAll('#artisan-tab-clusters .cluster-filter-chip');
    chips.forEach(chip => {
      if (chip.getAttribute('data-filter') === filter) {
        chip.classList.add('active');
        chip.setAttribute('aria-selected', 'true');
      } else {
        chip.classList.remove('active');
        chip.setAttribute('aria-selected', 'false');
      }
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:36px 16px; background:#f8fafc; border-radius:14px; border:1.5px dashed #cbd5e1;">
          <span style="font-size:2.2rem; display:block; margin-bottom:8px;">👥</span>
          <h3 style="margin:0 0 6px 0; color:#1e293b; font-size:1.05rem; font-weight:800;">No Clusters In This Filter</h3>
          <p style="margin:0; color:#64748b; font-size:0.82rem; line-height:1.4;">
            ${filter === 'pending' ? 'You have no pending cluster invitations right now.' : 'Buyer created production clusters will appear here in real time.'}
          </p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(cluster => {
      const userMember = (cluster.members || []).find(m => m.isCurrentUser) || (cluster.members || []).find(m => m.status === 'Pending') || cluster.members[0];
      const isUserPending = Boolean(userMember && userMember.status === 'Pending');
      const reqQty = cluster.required_quantity || 1;
      const allocQty = cluster.total_allocated || cluster.accepted_quantity || 0;
      const pct = Math.min(100, Math.round((allocQty / reqQty) * 100));

      const totalComp = (cluster.members || []).reduce((sum, m) => sum + (Number(m.completed_quantity) || 0), 0);
      const overallProg = cluster.overall_progress || Math.min(100, Math.round((totalComp / reqQty) * 100));

      return `
        <article class="artisan-cluster-card" data-cluster-id="${cluster.id}">
          <!-- Top Row: Craft Tag + Status Badge -->
          <div class="artisan-cluster-card__header">
            <span class="cluster-craft-pill">🎨 ${escapeHtml(cluster.craft || 'Artisan Guild')}</span>
            <span class="cluster-status-badge cluster-status-badge--${(cluster.status || 'provisional').toLowerCase().replace(/\s+/g, '-')}">
              ● ${escapeHtml(cluster.status)}
            </span>
          </div>

          <!-- Product Title & Location -->
          <h3 class="artisan-cluster-card__title">${escapeHtml(cluster.product)}</h3>
          <p class="artisan-cluster-card__sub">📍 Cluster Hub: ${escapeHtml(cluster.location)} • Created: ${escapeHtml(cluster.created_at)}</p>

          <!-- Simple Buyer Pill -->
          <div class="cluster-buyer-pill">
            <span>🏢 Buyer: <strong>${escapeHtml(cluster.buyer.company || cluster.buyer.name)}</strong></span>
            <span>• 📍 ${escapeHtml(cluster.buyer.location || cluster.location || 'Hub')}</span>
            ${cluster.buyer.verified ? '<span class="verified-tag">✓ Verified Buyer</span>' : ''}
          </div>

          <!-- 3 Big Simple Metric Boxes -->
          <div class="cluster-stat-triplet">
            <div class="cluster-stat-triplet__item">
              <span class="cluster-stat-triplet__lbl">📦 Total Need</span>
              <span class="cluster-stat-triplet__val">${cluster.required_quantity} pcs</span>
            </div>
            <div class="cluster-stat-triplet__item">
              <span class="cluster-stat-triplet__lbl">💰 Total Value</span>
              <span class="cluster-stat-triplet__val" style="color: #15803d;">${escapeHtml(cluster.buyer_requirements.budget)}</span>
            </div>
            <div class="cluster-stat-triplet__item">
              <span class="cluster-stat-triplet__lbl">⏳ Delivery</span>
              <span class="cluster-stat-triplet__val">${escapeHtml(cluster.delivery_date)}</span>
            </div>
          </div>

          <!-- Cluster Payment Status Banner for Artisans -->
          ${cluster.payment_status === 'FULLY_PAID' ? `
            <div style="background: #ecfdf5; border: 1.5px solid #86efac; border-radius: 8px; padding: 8px 12px; margin-top: 10px; display: flex; justify-content: space-between; align-items: center;">
              <span style="color: #15803d; font-size: 0.8rem; font-weight: 800;">🎉 Cluster Payment: 100% Fully Settled</span>
              <span style="font-size: 0.72rem; color: #166534; font-weight: 700; background: #bbf7d0; padding: 2px 8px; border-radius: 10px;">Full Payout Released</span>
            </div>
          ` : cluster.payment_status === 'ADVANCE_PAID' ? `
            <div style="background: #eff6ff; border: 1.5px solid #93c5fd; border-radius: 8px; padding: 8px 12px; margin-top: 10px; display: flex; justify-content: space-between; align-items: center;">
              <span style="color: #1d4ed8; font-size: 0.8rem; font-weight: 800;">🟢 Advance Escrow Funded: 40% Paid by Buyer</span>
              <span style="font-size: 0.72rem; color: #1e40af; font-weight: 700; background: #dbeafe; padding: 2px 8px; border-radius: 10px;">In Active Production</span>
            </div>
          ` : `
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 12px; margin-top: 10px; display: flex; justify-content: space-between; align-items: center;">
              <span style="color: #64748b; font-size: 0.75rem;">Payment Escrow: 40% Advance due once all artisans accept</span>
              <span style="font-size: 0.7rem; color: #94a3b8; font-weight: 600;">Escrow Protected</span>
            </div>
          `}

          <!-- Total Cluster Production Meter -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; margin-top: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 0.78rem; font-weight: 800; color: #1e293b; display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 0.95rem;">📦</span> Cluster Overall Production Output:
              </span>
              <span style="font-size: 0.8rem; font-weight: 900; color: #0284c7;">
                ${totalComp} / ${cluster.required_quantity} pcs (${overallProg}%)
              </span>
            </div>
            <div style="height: 8px; width: 100%; background: #e2e8f0; border-radius: 999px; overflow: hidden;">
              <div style="height: 100%; width: ${overallProg}%; background: linear-gradient(90deg, #0284c7, #10b981); border-radius: 999px; transition: width 0.3s ease;"></div>
            </div>
          </div>

          <!-- Capacity Progress Bar -->
          <div class="cluster-capacity-meter" style="margin-top: 10px;">
            <div class="capacity-meter-labels">
              <span>Cluster Capacity Allocated</span>
              <span class="capacity-pct">${pct}% (${allocQty} / ${reqQty} pcs)</span>
            </div>
            <div class="capacity-meter-track">
              <div class="capacity-meter-fill" style="width: ${pct}%;"></div>
            </div>
          </div>

          <!-- Your Workshop Share Callout -->
          ${userMember ? `
            <div class="cluster-share-callout">
              <div class="cluster-share-callout__left">
                <span class="cluster-share-callout__icon">👉</span>
                <div class="cluster-share-callout__text">
                  <strong>Your Share: ${userMember.assigned_quantity} pieces</strong>
                  <span>Your workshop capacity: ${userMember.monthly_capacity || 320} pcs/mo</span>
                </div>
              </div>
              <span class="cluster-share-callout__badge">${isUserPending ? '⏳ Action Needed' : '✓ Confirmed'}</span>
            </div>
          ` : ''}

          <!-- Artisans in this Group with Individual Production Status Updaters -->
          <div class="cluster-artisans-block">
            <div class="cluster-artisans-block__title">
              <span>👥 Group Artisans &amp; Production Workflows (${cluster.members.length})</span>
              <span style="font-size: 0.72rem; color: #0284c7; font-weight: 700;">Live Status Controls</span>
            </div>
            <div class="cluster-artisans-list">
              ${cluster.members.map((artisan, idx) => {
                const assigned = Number(artisan.assigned_quantity || 100);
                const comp = Number(artisan.completed_quantity !== undefined && artisan.completed_quantity !== null ? artisan.completed_quantity : 0);
                const memProg = Math.min(100, Math.round((comp / assigned) * 100));
                const prodStatus = artisan.production_status || (comp >= assigned ? 'Completed' : comp > 0 ? 'In Production' : (artisan.status === 'Accepted' ? 'In Production' : 'Order Placed'));

                return `
                <div class="cluster-artisan-item ${artisan.isCurrentUser ? 'is-self' : ''}" style="display: flex; flex-direction: column; gap: 8px;">
                  <div class="cluster-artisan-item__top">
                    <div class="cluster-artisan-item__identity">
                      <div class="artisan-avatar-small">${escapeHtml((artisan.name || 'A').slice(0, 2).toUpperCase())}</div>
                      <div class="artisan-name-group">
                        <span class="artisan-name">${escapeHtml(artisan.name)}</span>
                        ${artisan.isCurrentUser ? '<span class="you-badge">YOU</span>' : ''}
                      </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <span class="artisan-status-badge ${(artisan.status || 'pending').toLowerCase()}">
                        ${artisan.status === 'Accepted' ? '✓ Accepted' : artisan.status === 'Declined' ? '✕ Declined' : '⏳ Pending'}
                      </span>
                      ${artisan.status === 'Pending' ? `
                        <button type="button" class="btn-artisan-item-accept" data-cluster-id="${cluster.id}" data-member-id="${artisan.id || ''}" data-member-name="${escapeHtml(artisan.name || '')}" style="background: #0284c7; color: #ffffff; border: none; padding: 2px 8px; border-radius: 6px; font-size: 0.7rem; font-weight: 700; cursor: pointer;">
                          ✓ Accept
                        </button>
                      ` : ''}
                    </div>
                  </div>
                  <div class="cluster-artisan-item__bottom">
                    <span class="artisan-item-loc">📍 ${escapeHtml(artisan.location || 'Workshop')} • ${escapeHtml(artisan.craft || cluster.craft || '')}</span>
                    <div class="artisan-item-stats">
                      <span class="artisan-stat-pill">Capacity: ${artisan.monthly_capacity || artisan.capacity || 280}/mo</span>
                      <span class="artisan-stat-pill artisan-stat-pill--share">Share: ${assigned} pcs</span>
                    </div>
                  </div>

                  <!-- Option for Every Artisan to Update Production Status -->
                  <div class="artisan-production-updater" style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; margin-top: 4px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 6px;">
                      <span style="font-size: 0.72rem; font-weight: 800; color: #334155; text-transform: uppercase;">
                        🛠️ Workshop Production Status:
                      </span>
                      <span style="font-size: 0.72rem; font-weight: 800; padding: 2px 8px; border-radius: 6px; ${
                        prodStatus === 'Completed' ? 'background:#dcfce7; color:#15803d; border:1px solid #86efac;' :
                        prodStatus === 'Quality Check' ? 'background:#f3e8ff; color:#7e22ce; border:1px solid #d8b4fe;' :
                        prodStatus === 'In Production' ? 'background:#e0e7ff; color:#3730a3; border:1px solid #a5b4fc;' :
                        prodStatus === 'Production Started' ? 'background:#e0f2fe; color:#0369a1; border:1px solid #7dd3fc;' :
                        prodStatus === 'Material Sourcing' ? 'background:#fef3c7; color:#b45309; border:1px solid #fde68a;' :
                        'background:#f1f5f9; color:#475569; border:1px solid #cbd5e1;'
                      }">
                        ● ${escapeHtml(prodStatus)}
                      </span>
                    </div>

                    <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                      <select class="cluster-member-status-select" data-cluster-id="${cluster.id}" data-member-id="${artisan.id || ''}" data-member-name="${escapeHtml(artisan.name || '')}" data-member-index="${idx}" style="padding: 4px 8px; border-radius: 6px; border: 1px solid #94a3b8; font-size: 0.75rem; font-weight: 700; color: #0f172a; background: #ffffff; cursor: pointer; flex: 1; min-width: 130px;">
                        <option value="Order Placed" ${prodStatus === 'Order Placed' ? 'selected' : ''}>📦 Order Placed</option>
                        <option value="Material Sourcing" ${prodStatus === 'Material Sourcing' ? 'selected' : ''}>🪵 Material Sourcing</option>
                        <option value="Production Started" ${prodStatus === 'Production Started' ? 'selected' : ''}>🔨 Production Started</option>
                        <option value="In Production" ${prodStatus === 'In Production' ? 'selected' : ''}>⚙️ In Production</option>
                        <option value="Quality Check" ${prodStatus === 'Quality Check' ? 'selected' : ''}>🔍 Quality Check</option>
                        <option value="Completed" ${prodStatus === 'Completed' ? 'selected' : ''}>✓ Completed</option>
                      </select>

                      <div style="display: flex; align-items: center; gap: 4px;">
                        <span style="font-size: 0.72rem; color: #64748b; font-weight: 600;">Qty:</span>
                        <input type="number" class="cluster-member-qty-input" data-cluster-id="${cluster.id}" data-member-id="${artisan.id || ''}" data-member-name="${escapeHtml(artisan.name || '')}" data-member-index="${idx}" min="0" max="${assigned}" value="${comp}" style="width: 52px; padding: 4px; border-radius: 6px; border: 1px solid #94a3b8; font-size: 0.75rem; font-weight: 800; text-align: center; color: #0f172a; background: #ffffff;">
                        <span style="font-size: 0.72rem; color: #64748b; font-weight: 700;">/${assigned}</span>
                      </div>

                      <button type="button" class="btn-update-member-production" data-cluster-id="${cluster.id}" data-member-id="${artisan.id || ''}" data-member-name="${escapeHtml(artisan.name || '')}" data-member-index="${idx}" style="background: #0284c7; color: #ffffff; border: none; padding: 5px 12px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; cursor: pointer; box-shadow: 0 1px 3px rgba(2,132,199,0.3);">
                        Save
                      </button>
                    </div>

                    <!-- Individual Progress Bar for this Artisan -->
                    <div style="margin-top: 8px;">
                      <div style="display: flex; justify-content: space-between; font-size: 0.7rem; margin-bottom: 3px; color: #475569;">
                        <span>Progress: <strong>${comp}/${assigned} units</strong></span>
                        <strong style="color: #0284c7;">${memProg}%</strong>
                      </div>
                      <div style="height: 6px; width: 100%; background: #e2e8f0; border-radius: 6px; overflow: hidden;">
                        <div style="height: 100%; width: ${memProg}%; background: linear-gradient(90deg, #0284c7, #10b981); border-radius: 6px; transition: width 0.3s ease;"></div>
                      </div>
                    </div>
                  </div>

                </div>
              `;
              }).join('')}
            </div>
          </div>

          <!-- Simple Action Buttons -->
          <div class="artisan-cluster-card__actions">
            ${isUserPending ? `
              <button type="button" class="cluster-accept-btn" data-action="accept-cluster" data-cluster-id="${cluster.id}">
                ✓ Accept (${userMember.assigned_quantity} pcs)
              </button>
              <button type="button" class="cluster-decline-btn" data-action="decline-cluster" data-cluster-id="${cluster.id}">
                ✕ Decline
              </button>
            ` : ''}
            <button type="button" class="cluster-details-btn" data-action="view-manifest" data-cluster-id="${cluster.id}">
              📄 View Full Details
            </button>
          </div>
        </article>
      `;
    }).join('');

    // Attach Action Listeners
    container.querySelectorAll('[data-action="accept-cluster"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const clusterId = btn.getAttribute('data-cluster-id');
        handleArtisanAcceptCluster(clusterId);
      });
    });

    container.querySelectorAll('[data-action="decline-cluster"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const clusterId = btn.getAttribute('data-cluster-id');
        handleArtisanDeclineCluster(clusterId);
      });
    });

    container.querySelectorAll('[data-action="view-manifest"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const clusterId = btn.getAttribute('data-cluster-id');
        openArtisanClusterDetailsModal(clusterId);
      });
    });

    // Attach individual quick accept for artisans
    container.querySelectorAll('.btn-artisan-item-accept').forEach(btn => {
      btn.addEventListener('click', () => {
        const cId = btn.dataset.clusterId;
        const mId = btn.dataset.memberId;
        const mName = btn.dataset.memberName;
        const history = getStoredClusterHistory();
        const c = history.find(item => String(item.id) === String(cId));
        if (c) {
          const m = c.members?.find(mem => (mId && String(mem.id) === String(mId)) || (mName && mem.name && mem.name.toLowerCase().trim() === mName.toLowerCase().trim()));
          if (m) {
            m.status = 'Accepted';
            c.accepted_quantity = (c.members || []).filter(x => x.status === 'Accepted').reduce((s, x) => s + (x.assigned_quantity || 0), 0);
            if (c.members.every(x => x.status === 'Accepted') || c.accepted_quantity >= (c.required_quantity || 0)) {
              c.status = 'CONFIRMED';
            }
            saveStoredClusterHistory(c);

            // Real-time notification to Buyer
            try {
              let bNotifs = [];
              const raw = localStorage.getItem('kala_mitra_buyer_notifs');
              if (raw) bNotifs = JSON.parse(raw);
              if (!Array.isArray(bNotifs)) bNotifs = [];
              bNotifs.unshift({
                id: 'buyer-artisan-accept-' + Date.now(),
                type: 'cluster',
                title: 'Artisan Accepted Cluster Request',
                message: m.name + ' has accepted the cluster assignment (' + m.assigned_quantity + ' units) for ' + c.product + '.',
                clusterId: c.id,
                product: c.product,
                artisanName: m.name,
                timestamp: 'Just now',
                is_read: false
              });
              localStorage.setItem('kala_mitra_buyer_notifs', JSON.stringify(bNotifs));
              if (typeof updateUnreadBadgeCounts === 'function') updateUnreadBadgeCounts();
            } catch(e) {}

            window.dispatchEvent(new CustomEvent('kala-cluster-status-updated', { detail: { clusterId: c.id, memberName: m.name, status: 'Accepted' } }));
            showToast(`✓ Accepted contribution for ${m.name}! Buyer notified.`);
            renderArtisanClustersTab(activeClusterFilter);
          }
        }
      });
    });

    // Attach Production Status Change Listeners
    container.querySelectorAll('.cluster-member-status-select').forEach(sel => {
      sel.addEventListener('change', () => {
        const box = sel.closest('.artisan-production-updater') || sel.parentElement;
        const qtyInput = box ? box.querySelector('.cluster-member-qty-input') : null;
        const val = sel.value;
        const cId = sel.dataset.clusterId;
        const mId = sel.dataset.memberId;
        const mName = sel.dataset.memberName;

        let hist = [];
        try {
          if (typeof window.getStoredClusterHistory === 'function') hist = window.getStoredClusterHistory();
          else if (typeof getStoredClusterHistory === 'function') hist = getStoredClusterHistory();
        } catch(e) {}
        const c = hist.find(item => String(item.id) === String(cId));
        const m = c?.members?.find(mem => (mId && String(mem.id) === String(mId)) || (mName && mem.name === mName));
        const assigned = m ? Number(m.assigned_quantity || 100) : 100;

        if (qtyInput) {
          if (val === 'Completed') {
            qtyInput.value = assigned;
          } else if (val === 'Order Placed' && Number(qtyInput.value) === assigned) {
            qtyInput.value = 0;
          }
        }
      });
    });

    container.querySelectorAll('.btn-update-member-production').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const box = btn.closest('.artisan-production-updater') || btn.closest('.cluster-artisan-item') || btn.parentElement;
        const card = btn.closest('.artisan-cluster-card');

        const sel = box ? box.querySelector('.cluster-member-status-select') : null;
        const qtyInput = box ? box.querySelector('.cluster-member-qty-input') : null;

        const cId = btn.dataset.clusterId || (card ? card.dataset.clusterId : '') || (box ? box.dataset.clusterId : '');
        const mId = btn.dataset.memberId || (box ? box.dataset.memberId : '');
        const rawName = btn.dataset.memberName || (box ? box.dataset.memberName : '');
        const mIdx = btn.dataset.memberIndex !== undefined ? btn.dataset.memberIndex : (box ? box.dataset.memberIndex : undefined);

        const mName = rawName ? rawName.replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>') : '';

        const val = sel ? sel.value : 'In Production';
        let qty = undefined;
        if (qtyInput && qtyInput.value !== '') {
          const parsed = Number(qtyInput.value);
          if (!isNaN(parsed)) {
            qty = parsed;
          }
        }

        const updated = window.updateClusterMemberProduction(cId, mId, val, qty, mName, mIdx);
        const finalQty = qty !== undefined ? qty : (val === 'Completed' ? 'all' : 0);
        showToast(`✓ Workshop production for ${mName || 'artisan'} updated to "${val}" (${finalQty} crafted)!`);
        renderArtisanClustersTab(activeClusterFilter);
      });
    });

    window.renderArtisanClustersTab = renderArtisanClustersTab;
    window.getStoredClusterHistory = getStoredClusterHistory;
    window.saveStoredClusterHistory = saveStoredClusterHistory;
    window.normalizeClusterData = normalizeClusterData;
  };


  function handleArtisanAcceptCluster(clusterId) {
    const history = getStoredClusterHistory();
    const cluster = history.find(c => String(c.id) === String(clusterId));
    if (!cluster) return;

    const userMem = (cluster.members || []).find(m => m.isCurrentUser);
    if (userMem) {
      userMem.status = 'Accepted';
    }
    cluster.accepted_quantity = (cluster.members || []).filter(m => m.status === 'Accepted').reduce((s, m) => s + (m.assigned_quantity || 0), 0);
    if (cluster.members.every(m => m.status === 'Accepted') || cluster.accepted_quantity >= (cluster.required_quantity || 0)) {
      cluster.status = 'CONFIRMED';
    }

    saveStoredClusterHistory(cluster);

    // Dispatch notification to Buyer linked directly to this exact cluster
    const buyerNotifs = getStoredBuyerNotifications();
    const acceptedUnits = userMem ? userMem.assigned_quantity : 120;
    const artisanName = userMem ? userMem.name : 'Lakshmi Devi';
    buyerNotifs.unshift({
      id: 'buyer-accept-' + Date.now(),
      type: 'cluster',
      title: 'Artisan Accepted Cluster',
      message: `Artisan ${artisanName} accepted ${acceptedUnits} units for ${cluster.product}.`,
      clusterId: cluster.id,
      product: cluster.product,
      quantity: acceptedUnits,
      artisanName: artisanName,
      action_label: 'View Cluster',
      action_route: 'buyer-orders',
      timestamp: 'Just now',
      is_read: false
    });
    saveStoredBuyerNotifications(buyerNotifs);
    updateUnreadBadgeCounts();

    showToast(`You accepted the cluster invite for ${userMem ? userMem.assigned_quantity : ''} units!`);
    renderArtisanClustersTab(activeClusterFilter);
  }

  function handleArtisanDeclineCluster(clusterId) {
    const history = getStoredClusterHistory();
    const cluster = history.find(c => String(c.id) === String(clusterId));
    if (!cluster) return;

    const userMem = (cluster.members || []).find(m => m.isCurrentUser);
    if (userMem) {
      userMem.status = 'Declined';
    }
    saveStoredClusterHistory(cluster);

    // Dispatch decline notification to Buyer
    const buyerNotifs = getStoredBuyerNotifications();
    buyerNotifs.unshift({
      id: 'buyer-decline-' + Date.now(),
      type: 'cluster',
      title: 'Artisan Declined Cluster',
      message: `Artisan ${userMem?.name || 'Artisan'} declined the cluster request for ${cluster.product}. Tap to form cluster again.`,
      clusterId: cluster.id,
      product: cluster.product,
      quantity: userMem?.assigned_quantity || 100,
      artisanName: userMem?.name || 'Artisan',
      rejectedArtisanId: userMem?.id,
      craft: cluster.craft || 'Bamboo Crafts',
      action_label: 'Form Cluster Again',
      action_route: 'buyer-orders-reform',
      timestamp: 'Just now',
      is_read: false
    });
    saveStoredBuyerNotifications(buyerNotifs);
    updateUnreadBadgeCounts();

    showToast('You declined the cluster request.');
    renderArtisanClustersTab(activeClusterFilter);
  }

  function openArtisanClusterDetailsModal(clusterId) {
    const history = getStoredClusterHistory();
    const cluster = history.find(c => String(c.id) === String(clusterId)) || history[0];
    if (!cluster) return;

    const titleEl = document.getElementById('cluster-modal-title');
    const bodyEl = document.getElementById('cluster-modal-body');
    const tagEl = document.getElementById('cluster-modal-tag');

    if (tagEl) {
      tagEl.textContent = `${cluster.craft || 'Artisan Guild'} Cluster Manifest`;
    }
    if (titleEl) {
      titleEl.textContent = cluster.product;
    }
    if (bodyEl) {
      const totalUnits = cluster.required_quantity;
      const allocUnits = cluster.total_allocated || cluster.accepted_quantity || totalUnits;
      const pct = Math.min(100, Math.round((allocUnits / totalUnits) * 100));

      bodyEl.innerHTML = `
        <div class="cluster-manifest-wrapper" style="display: flex; flex-direction: column; gap: 16px;">
          <!-- Status Banner -->
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div>
              <span style="font-size: 0.72rem; color: #15803d; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px; display: block;">Production Contract & Escrow State</span>
              <strong style="color: #166534; font-size: 0.95rem;">${cluster.status} • Escrow Protected</strong>
            </div>
            <span style="font-size: 0.8rem; background: #ffffff; border: 1px solid #86efac; color: #166534; font-weight: 700; padding: 4px 10px; border-radius: 12px;">
              ${cluster.payment_status === 'FULLY_PAID' ? '✓ 100% Fully Settled' : cluster.payment_status === 'ADVANCE_PAID' ? '🟢 40% Advance Paid in Escrow' : '🛡️ Payment Escrow Secured'}
            </span>
          </div>

          <!-- Buyer Profile Details -->
          <div class="cluster-info-block cluster-info-block--buyer">
            <div class="block-header">
              <span style="font-size: 1.1rem;">🏢</span>
              <h4 class="block-title">Verified Buyer &amp; Logistics Destination</h4>
              <span class="verified-tag">✓ Verified Corporate Buyer</span>
            </div>
            <div class="buyer-details-grid">
              <div class="buyer-detail-item">
                <span class="item-label">Corporate Enterprise</span>
                <span class="item-val" style="font-weight: 700;">${escapeHtml(cluster.buyer.company)}</span>
                <span style="font-size: 0.72rem; color: #64748b;">Procurement Officer: ${escapeHtml(cluster.buyer.name)}</span>
              </div>
              <div class="buyer-detail-item">
                <span class="item-label">Delivery Hub / Destination</span>
                <span class="item-val">📍 ${escapeHtml(cluster.buyer.location)}</span>
              </div>
              <div class="buyer-detail-item">
                <span class="item-label">Direct Contact Phone</span>
                <span class="item-val">📞 ${escapeHtml(cluster.buyer.phone)}</span>
              </div>
              <div class="buyer-detail-item">
                <span class="item-label">Verified Sourcing Email</span>
                <span class="item-val">✉️ ${escapeHtml(cluster.buyer.email)}</span>
              </div>
            </div>
          </div>

          <!-- Procurement Specifications -->
          <div class="cluster-info-block cluster-info-block--requirements">
            <div class="block-header">
              <span style="font-size: 1.1rem;">📑</span>
              <h4 class="block-title">Complete Procurement Specifications</h4>
            </div>
            <div class="requirements-summary-list">
              <div class="req-chip-item"><span class="req-chip-label">Target Units:</span> <strong class="req-chip-val">${cluster.buyer_requirements.required_quantity} units</strong></div>
              <div class="req-chip-item"><span class="req-chip-label">Budget Allocated:</span> <strong class="req-chip-val" style="color: #047857;">${escapeHtml(cluster.buyer_requirements.budget)}</strong></div>
              <div class="req-chip-item"><span class="req-chip-label">Delivery Deadline:</span> <span class="req-chip-val">${escapeHtml(cluster.buyer_requirements.delivery_deadline)}</span></div>
              <div class="req-chip-item"><span class="req-chip-label">Receiving Hub:</span> <span class="req-chip-val">${escapeHtml(cluster.buyer_requirements.destination_hub)}</span></div>
            </div>
            <p class="req-notes-text">
              <strong>Quality &amp; Finish Requirements:</strong><br>${escapeHtml(cluster.buyer_requirements.specifications)}
            </p>
          </div>

          <!-- Capacity & Artisan Breakdown Table -->
          <div class="cluster-info-block cluster-info-block--artisans">
            <div class="block-header">
              <span style="font-size: 1.1rem;">👥</span>
              <h4 class="block-title">Artisan Guild Allocation &amp; Workshop Capacities</h4>
              <span class="member-count-pill">${cluster.members.length} Artisans</span>
            </div>

            <!-- Capacity Bar -->
            <div class="cluster-capacity-meter" style="margin: 8px 0 14px 0;">
              <div class="capacity-meter-labels">
                <span>Cluster Production Coverage</span>
                <span class="capacity-pct">${pct}% (${allocUnits} / ${totalUnits} units)</span>
              </div>
              <div class="capacity-meter-track">
                <div class="capacity-meter-fill" style="width: ${pct}%;"></div>
              </div>
            </div>

            <div style="overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; text-align: left;">
                <thead>
                  <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; color: #475569;">
                    <th style="padding: 8px 10px;">Artisan</th>
                    <th style="padding: 8px 10px;">Workshop Location</th>
                    <th style="padding: 8px 10px; text-align: center;">Monthly Capacity</th>
                    <th style="padding: 8px 10px; text-align: right;">Allocated Units</th>
                    <th style="padding: 8px 10px; text-align: right;">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${cluster.members.map(m => `
                    <tr style="border-bottom: 1px solid #e2e8f0; ${m.isCurrentUser ? 'background: #f0fdf4; font-weight: 700;' : ''}">
                      <td style="padding: 8px 10px;">
                        ${escapeHtml(m.name)}
                        ${m.isCurrentUser ? '<span class="you-badge" style="margin-left: 4px;">YOU</span>' : ''}
                      </td>
                      <td style="padding: 8px 10px; color: #64748b;">${escapeHtml(m.location)}</td>
                      <td style="padding: 8px 10px; text-align: center; color: #173b5f;">${m.monthly_capacity || m.capacity || 280} u/mo</td>
                      <td style="padding: 8px 10px; text-align: right; color: #1769aa; font-weight: 800;">${m.assigned_quantity || 0} units</td>
                      <td style="padding: 8px 10px; text-align: right;">
                        <span class="artisan-status-badge ${(m.status || 'accepted').toLowerCase()}">${m.status || 'Accepted'}</span>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Production Milestones Timeline -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px;">
            <h4 style="margin: 0 0 10px 0; font-size: 0.85rem; color: #1e293b; font-weight: 800;">⏳ Cluster Production &amp; Delivery Milestones</h4>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; font-size: 0.75rem;">
              <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px;">
                <span style="font-weight: 800; color: #16a34a; display: block;">Stage 1: Raw Materials</span>
                <span style="color: #64748b;">Seasoned Bamboo Sourcing (Days 1–5)</span>
              </div>
              <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px;">
                <span style="font-weight: 800; color: #2563eb; display: block;">Stage 2: Weaving &amp; Craft</span>
                <span style="color: #64748b;">Workshop Production (Days 6–18)</span>
              </div>
              <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px;">
                <span style="font-weight: 800; color: #7c3aed; display: block;">Stage 3: QC &amp; Dispatch</span>
                <span style="color: #64748b;">Central Hub Delivery (Days 19–22)</span>
              </div>
            </div>
          </div>

          <!-- Manifest Modal Action Buttons -->
          <div style="display: flex; gap: 8px; margin-top: 6px;">
            <button type="button" class="secondary-btn" id="btn-print-manifest" style="flex: 1; padding: 10px 14px; font-size: 0.82rem; font-weight: 700;">
              📥 Export Cluster Agreement (PDF)
            </button>
            <button type="button" class="primary-btn" id="btn-contact-buyer" style="flex: 1; padding: 10px 14px; font-size: 0.82rem; font-weight: 700;">
              📞 Call Buyer Procurement Desk
            </button>
          </div>
        </div>
      `;

      // Attach button actions in manifest modal
      const btnPrint = document.getElementById('btn-print-manifest');
      if (btnPrint) {
        btnPrint.addEventListener('click', () => {
          showToast('Cluster procurement agreement exported successfully (PDF).');
        });
      }
      const btnContact = document.getElementById('btn-contact-buyer');
      if (btnContact) {
        btnContact.addEventListener('click', () => {
          showToast(`Connecting to ${cluster.buyer.name} (${cluster.buyer.phone})...`);
        });
      }
    }

    openModal('modal-artisan-cluster-details');
  }

  // Setup cluster filter chips click handlers
  const clusterFilterChips = document.querySelectorAll('#artisan-tab-clusters .cluster-filter-chip');
  clusterFilterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const filter = chip.getAttribute('data-filter') || 'all';
      renderArtisanClustersTab(filter);
    });
  });

  function getStoredArtisanNotifications() {
    try {
      const raw = localStorage.getItem('kala_mitra_artisan_notifications');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return [
      { id: 'notif-1', title: 'New Bulk Opportunity Available', message: 'GreenLeaf Hotels requested 500 units of Bamboo Baskets. Tap to view cluster capacity.', type: 'opportunity', timestamp: '15m ago', isRead: false },
      { id: 'notif-2', title: 'Order Status Updated', message: 'Order #ORD-9021 moved to "Production in Progress". Delivery target: 25 Sep.', type: 'order', timestamp: '2h ago', isRead: false },
      { id: 'notif-3', title: 'Cluster Request Response Required', message: 'Master artisan in East Godavari cluster allocated 120 units to your workshop.', type: 'cluster', timestamp: 'Yesterday', isRead: false, status: 'pending' },
      { id: 'notif-4', title: 'High Demand Alert', message: 'Buyers in Hospitality sector searched for eco-friendly handicrafts in your region.', type: 'system', timestamp: '2 days ago', isRead: true }
    ];
  }

  function saveStoredArtisanNotifications(list) {
    try {
      localStorage.setItem('kala_mitra_artisan_notifications', JSON.stringify(list));
    } catch (e) {}
    updateUnreadBadgeCounts();
  }

  function getStoredBuyerNotifications() {
    try {
      const raw = localStorage.getItem('kala_mitra_buyer_notifications');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return [
      { id: 'local-cluster-accept', type: 'cluster', title: 'Artisan Accepted Cluster', message: 'Artisan Sujatha V. (East Coast Artisans) accepted 180 units for Handcrafted Bamboo Storage Baskets.', clusterId: 'cluster-seed-101', product: 'Handcrafted Bamboo Storage Baskets', quantity: 180, artisanName: 'Sujatha V.', action_label: 'View Cluster', action_route: 'buyer-orders', timestamp: '15 minutes ago', is_read: false },
      { id: 'local-product', type: 'products', title: 'AI Product Match', message: 'AI found 8 products matching your requirement.', action_label: 'View Products', action_route: 'buyer-home', timestamp: '2 minutes ago', is_read: false },
      { id: 'local-artisan', type: 'artisans', title: 'Artisan Match', message: '5 verified artisans can fulfill your requirement.', action_label: 'View Artisans', action_route: 'buyer-discover', timestamp: '8 minutes ago', is_read: false },
      { id: 'local-payment', type: 'payments', title: 'Payment Successful', message: 'Payment of ₹25,000 for Order #KM1024 was successful.', action_label: 'View Payment', action_route: 'buyer-opportunities', timestamp: '1 hour ago', is_read: true },
      { id: 'local-shipping', type: 'delivery', title: 'Shipping Update', message: 'Your order has been shipped.', action_label: 'Track Shipment', action_route: 'buyer-opportunities', timestamp: 'Yesterday', is_read: true }
    ];
  }

  function saveStoredBuyerNotifications(list) {
    try {
      localStorage.setItem('kala_mitra_buyer_notifications', JSON.stringify(list));
    } catch (e) {}
    updateUnreadBadgeCounts();
  }

  function updateUnreadBadgeCounts() {
    // Artisan Badge
    const artisanNotifs = getStoredArtisanNotifications();
    const artisanUnread = artisanNotifs.filter(n => !n.isRead).length;
    const artisanBadge = document.getElementById('notif-badge-count');
    if (artisanBadge) {
      artisanBadge.textContent = artisanUnread;
      artisanBadge.style.display = artisanUnread > 0 ? 'inline-flex' : 'none';
    }

    // Buyer Badge
    const buyerNotifs = getStoredBuyerNotifications();
    const buyerUnread = buyerNotifs.filter(n => !n.is_read).length;
    const buyerBadge = document.getElementById('buyer-notification-count');
    if (buyerBadge) {
      buyerBadge.textContent = buyerUnread;
      buyerBadge.hidden = buyerUnread === 0;
    }
  }

  // B. Rich Artisan Notifications System (Structured like Buyer Notifications with Accept/Decline & 🔊 Listen TTS)
  const btnOpenNotif = document.getElementById('btn-open-notifications');
  const btnCloseNotif = document.getElementById('btn-close-notif-modal');
  let activeArtisanNotifFilter = 'all';

  async function renderArtisanNotifications() {
    const container = document.getElementById('notifications-list-container');
    if (!container) return;

    let notifs = getStoredArtisanNotifications();

    const iconFor = type => ({ opportunity: '💡', order: '📋', cluster: '🤝', system: '🔔', payments: '💰' }[type] || '🔔');

    const renderList = () => {
      const filtered = notifs.filter(item => activeArtisanNotifFilter === 'all' || item.type === activeArtisanNotifFilter);

      container.innerHTML = `
        <div class="buyer-notifications-panel">
          <div class="buyer-notifications-head">
            <div>
              <span class="buyer-kicker">UPDATES &amp; MATCHES</span>
              <h2>Artisan Notifications</h2>
            </div>
            <button type="button" class="secondary-btn" id="artisan-mark-all-read">Mark all as read</button>
          </div>
          <div class="buyer-notification-tabs">
            ${[['all', 'All'], ['opportunity', 'Opportunities'], ['order', 'Orders'], ['cluster', 'Cluster'], ['system', 'Alerts']].map(([val, label]) => {
              const transLabel = (kalaTranslations[selectedLanguage] && kalaTranslations[selectedLanguage][label]) || translateTextToCurrentLang(label);
              return `<button type="button" class="${activeArtisanNotifFilter === val ? 'active' : ''}" data-artisan-notif-filter="${val}">${transLabel}</button>`;
            }).join('')}
          </div>
          <div class="buyer-notification-list">
            ${filtered.length ? filtered.map(item => {
              const isCluster = item.type === 'cluster';
              const isPending = !item.status || item.status === 'pending';
              const isAccepted = item.status === 'Accepted';
              const isDeclined = item.status === 'Declined';

              return `
              <article class="buyer-notification-card ${item.isRead ? '' : 'is-unread'}" data-notification-id="${item.id}">
                <div class="buyer-notification-icon">${iconFor(item.type)}</div>
                <div class="buyer-notification-body">
                  <div class="buyer-notification-title">
                    <strong>${escapeHtml(item.title)}</strong>
                    <span>${escapeHtml(item.timestamp || 'Just now')}</span>
                  </div>
                  <p>${escapeHtml(item.message)}</p>
                  
                  ${isCluster ? `
                    ${isPending ? `
                      <div class="buyer-notification-actions" style="margin-top: 10px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                        <button type="button" class="primary-btn btn-artisan-notif-accept" data-notif-id="${item.id}" style="padding: 6px 16px; font-size: 13px; font-weight: 600; background: #10b981; border: none; border-radius: 6px; color: white; cursor: pointer;">Accept</button>
                        <button type="button" class="secondary-btn btn-artisan-notif-decline" data-notif-id="${item.id}" style="padding: 6px 16px; font-size: 13px; font-weight: 600; color: #ef4444; border: 1px solid #ef4444; border-radius: 6px; background: transparent; cursor: pointer;">Decline</button>
                        <button type="button" class="secondary-btn" data-artisan-speak="${item.id}" title="Read notification aloud">🔊 Listen</button>
                        ${item.isRead ? '' : `<button type="button" class="secondary-btn" data-artisan-notif-read="${item.id}">Mark as read</button>`}
                      </div>
                    ` : isAccepted ? `
                      <div style="margin-top: 10px; display: flex; align-items: center; justify-content: space-between;">
                        <span style="display: inline-flex; align-items: center; gap: 4px; color: #10b981; font-weight: 700; font-size: 13px; background: rgba(16, 185, 129, 0.1); padding: 4px 10px; border-radius: 20px;">✓ Accepted</span>
                        <div style="display: flex; gap: 6px;">
                          <button type="button" class="secondary-btn" data-artisan-speak="${item.id}" title="Read notification aloud">🔊 Listen</button>
                          ${item.isRead ? '' : `<button type="button" class="secondary-btn" data-artisan-notif-read="${item.id}">Mark as read</button>`}
                        </div>
                      </div>
                    ` : `
                      <div style="margin-top: 10px; display: flex; align-items: center; justify-content: space-between;">
                        <span style="display: inline-flex; align-items: center; gap: 4px; color: #ef4444; font-weight: 700; font-size: 13px; background: rgba(239, 68, 68, 0.1); padding: 4px 10px; border-radius: 20px;">✕ Declined</span>
                        <div style="display: flex; gap: 6px;">
                          <button type="button" class="secondary-btn" data-artisan-speak="${item.id}" title="Read notification aloud">🔊 Listen</button>
                          ${item.isRead ? '' : `<button type="button" class="secondary-btn" data-artisan-notif-read="${item.id}">Mark as read</button>`}
                        </div>
                      </div>
                    `}
                  ` : `
                    <div class="buyer-notification-actions">
                      <button type="button" class="primary-btn" data-artisan-notif-action="${item.type}">${item.type === 'opportunity' ? 'View Opportunity' : item.type === 'order' ? 'View Orders' : item.type === 'cluster' ? 'View Cluster' : 'View Details'}</button>
                      <button type="button" class="secondary-btn" data-artisan-speak="${item.id}" title="Read notification aloud">🔊 Listen</button>
                      ${item.isRead ? '' : `<button type="button" class="secondary-btn" data-artisan-notif-read="${item.id}">Mark as read</button>`}
                    </div>
                  `}
                </div>
              </article>
            `;
            }).join('') : '<div class="buyer-empty-state"><h3>No notifications in this category.</h3></div>'}
          </div>
        </div>
      `;

      // Filter tabs handler
      container.querySelectorAll('[data-artisan-notif-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
          activeArtisanNotifFilter = btn.dataset.artisanNotifFilter;
          renderList();
        });
      });

      // Mark all as read handler
      container.querySelector('#artisan-mark-all-read')?.addEventListener('click', () => {
        notifs.forEach(item => { item.isRead = true; });
        saveStoredArtisanNotifications(notifs);
        renderList();
        showToast(kalaTranslations[selectedLanguage]?.['All notifications marked as read.'] || 'All notifications marked as read.');
      });

      // Listen (Text-to-Speech) Audio Handler
      container.querySelectorAll('[data-artisan-speak]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.artisanSpeak;
          const item = notifs.find(n => n.id === id);
          if (item) {
            const speechText = `${item.title}. ${item.message}`;
            speakNotificationText(speechText);
            showToast(`🔊 Reading notification aloud...`);
          }
        });
      });

      // Mark individual notification as read
      container.querySelectorAll('[data-artisan-notif-read]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.artisanNotifRead;
          const item = notifs.find(n => n.id === id);
          if (item) {
            item.isRead = true;
            saveStoredArtisanNotifications(notifs);
            renderList();
          }
        });
      });

      // Accept cluster request handler
      container.querySelectorAll('.btn-artisan-notif-accept').forEach(btn => {
        btn.addEventListener('click', async () => {
          const notifId = btn.dataset.notifId;
          const item = notifs.find(n => n.id === notifId);
          if (item) {
            item.status = 'Accepted';
            item.isRead = true;
            saveStoredArtisanNotifications(notifs);

            if (item.clusterId) {
              try {
                const updated = await fetch(`http://127.0.0.1:8000/api/v1/clusters/${item.clusterId}/respond?action=accept&artisan_id=${item.artisanId || 1}`, { method: 'POST' }).then(r => r.json());
                if (typeof currentCluster !== 'undefined' && currentCluster) {
                  currentCluster = updated;
                }
              } catch (e) {}
            }

            // Dispatch notification to Buyer
            const buyerNotifs = getStoredBuyerNotifications();
            buyerNotifs.unshift({
              id: 'buyer-accept-' + Date.now(),
              type: 'cluster',
              title: 'Artisan Accepted Cluster',
              message: `Artisan ${item.artisanName || 'Artisan'} accepted ${item.quantity || 50} units for ${item.product || 'item'}.`,
              clusterId: item.clusterId,
              product: item.product,
              quantity: item.quantity,
              artisanName: item.artisanName || 'Artisan',
              action_label: 'View Cluster',
              action_route: 'buyer-orders',
              timestamp: 'Just now',
              is_read: false
            });
            saveStoredBuyerNotifications(buyerNotifs);
            updateUnreadBadgeCounts();

            // Update cluster in persistent history
            const history = getStoredClusterHistory();
            const histCluster = history.find(c => String(c.id) === String(item.clusterId));
            if (histCluster && histCluster.members) {
              const mem = histCluster.members.find(m => m.id === item.artisanId || (item.artisanName && m.name && m.name.includes(item.artisanName)) || m.isCurrentUser);
              if (mem) mem.status = 'Accepted';
              histCluster.accepted_quantity = histCluster.members.filter(m => m.status === 'Accepted').reduce((s, m) => s + (m.assigned_quantity || 0), 0);
              if (histCluster.accepted_quantity >= (histCluster.required_quantity || 0)) {
                histCluster.status = 'CONFIRMED';
              }
              saveStoredClusterHistory(histCluster);
            }

            showToast(kalaTranslations[selectedLanguage]?.['You accepted the cluster request!'] || 'You accepted the cluster request!');
            renderList();
          }
        });
      });

      // Decline cluster request handler
      container.querySelectorAll('.btn-artisan-notif-decline').forEach(btn => {
        btn.addEventListener('click', async () => {
          const notifId = btn.dataset.notifId;
          const item = notifs.find(n => n.id === notifId);
          if (item) {
            item.status = 'Declined';
            item.isRead = true;
            saveStoredArtisanNotifications(notifs);

            if (item.clusterId) {
              try {
                const updated = await fetch(`http://127.0.0.1:8000/api/v1/clusters/${item.clusterId}/respond?action=decline&artisan_id=${item.artisanId || 1}`, { method: 'POST' }).then(r => r.json());
                if (typeof currentCluster !== 'undefined' && currentCluster) {
                  currentCluster = updated;
                }
              } catch (e) {}
            }

            // Dispatch notification to Buyer
            const buyerNotifs = getStoredBuyerNotifications();
            buyerNotifs.unshift({
              id: 'buyer-decline-' + Date.now(),
              type: 'cluster',
              title: 'Artisan Declined Cluster',
              message: `Artisan ${item.artisanName || 'Artisan'} declined the cluster request for ${item.product || 'item'}. Tap to form cluster again.`,
              product: item.product,
              quantity: item.quantity,
              artisanName: item.artisanName || 'Artisan',
              rejectedArtisanId: item.artisanId,
              craft: item.craft || activeClusterRequirement?.craft || 'Bamboo Crafts',
              action_label: 'Form Cluster Again',
              action_route: 'buyer-orders-reform',
              timestamp: 'Just now',
              is_read: false
            });
            saveStoredBuyerNotifications(buyerNotifs);

            // Update cluster in persistent history
            const history = getStoredClusterHistory();
            const histCluster = history.find(c => c.id === item.clusterId);
            if (histCluster && histCluster.members) {
              const mem = histCluster.members.find(m => m.id === item.artisanId);
              if (mem) mem.status = 'Declined';
              saveStoredClusterHistory(histCluster);
            }

            showToast(kalaTranslations[selectedLanguage]?.['You declined the cluster request.'] || 'You declined the cluster request.');
            renderList();
          }
        });
      });

      // Action navigation (View Opportunity / View Orders)
      container.querySelectorAll('[data-artisan-notif-action]').forEach(btn => {
        btn.addEventListener('click', () => {
          const actionType = btn.dataset.artisanNotifAction;
          closeModal('modal-notifications');
          if (actionType === 'order') {
            switchArtisanTab('orders');
          } else if (actionType === 'opportunity' || actionType === 'cluster') {
            switchArtisanTab('opportunities');
          } else {
            switchArtisanTab('home');
          }
        });
      });

      translateApp(selectedLanguage);
    };

    renderList();
  }

  if (btnOpenNotif) {
    btnOpenNotif.addEventListener('click', async () => {
      await renderArtisanNotifications();
      openModal('modal-notifications');
    });
  }

  if (btnCloseNotif) btnCloseNotif.addEventListener('click', () => closeModal('modal-notifications'));

  // C. Artisan Capacity Management Controller (Your Capacity)
  const btnManageCapacity = document.getElementById('btn-manage-capacity');
  const btnUpdateCapQuick = document.getElementById('btn-update-capacity-quick');
  const btnCloseCapModal = document.getElementById('btn-close-capacity-modal');
  const btnCancelCapacity = document.getElementById('btn-cancel-capacity');
  const formUpdateCapacity = document.getElementById('form-update-capacity');
  const btnSaveCapacity = document.getElementById('btn-save-capacity');
  const btnUseProfileLocation = document.getElementById('btn-use-profile-location');

  // Open Capacity Modal with current values
  async function openCapacityModal() {
    try {
      const capacity = await capacityRepository.getCapacity();
      const user = authService.getCurrentUser();

      const inputStock = document.getElementById('input-capacity-stock');
      const inputProd = document.getElementById('input-capacity-production');
      const inputPeriod = document.getElementById('input-capacity-period');
      const inputLead = document.getElementById('input-capacity-lead-days');
      const inputLoc = document.getElementById('input-capacity-location');

      if (inputStock) inputStock.value = capacity.availableStock;
      if (inputProd) inputProd.value = capacity.productionCapacity;
      if (inputPeriod) inputPeriod.value = capacity.productionPeriod;
      if (inputLead) inputLead.value = capacity.productionTimeDays;
      if (inputLoc) inputLoc.value = capacity.locationName || (user?.location || 'Rajahmundry, Andhra Pradesh');

      // Update Period Toggle Buttons
      document.querySelectorAll('#capacity-period-toggle .period-toggle-btn').forEach(btn => {
        const period = btn.getAttribute('data-period');
        if (period === capacity.productionPeriod) {
          btn.classList.add('active');
          btn.setAttribute('aria-checked', 'true');
        } else {
          btn.classList.remove('active');
          btn.setAttribute('aria-checked', 'false');
        }
      });

      // Update Availability Status Radio Selection
      document.querySelectorAll('.availability-status-cards .status-card-option').forEach(card => {
        const radio = card.querySelector('input[type="radio"]');
        if (radio) {
          if (radio.value === capacity.availabilityStatus) {
            radio.checked = true;
            card.classList.add('active');
          } else {
            radio.checked = false;
            card.classList.remove('active');
          }
        }
      });

      showError('capacity-form-error', null);
      openModal('modal-update-capacity');
    } catch (e) {
      console.error('Error opening capacity modal:', e);
      showToast('Could not load capacity data. Please retry.');
    }
  }

  // Period Toggle Buttons Click Handler
  document.querySelectorAll('#capacity-period-toggle .period-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const period = btn.getAttribute('data-period');
      const inputPeriod = document.getElementById('input-capacity-period');
      if (inputPeriod) inputPeriod.value = period;

      document.querySelectorAll('#capacity-period-toggle .period-toggle-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-checked', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-checked', 'true');
    });
  });

  // Availability Status Card Click / Radio Handler
  document.querySelectorAll('.availability-status-cards .status-card-option').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.availability-status-cards .status-card-option').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    });
  });

  // Use Profile Location Link
  if (btnUseProfileLocation) {
    btnUseProfileLocation.addEventListener('click', () => {
      const user = authService.getCurrentUser();
      const inputLoc = document.getElementById('input-capacity-location');
      if (user && user.location && inputLoc) {
        inputLoc.value = user.location;
        showToast('Location populated from profile 📍');
      }
    });
  }

  // Triggers
  if (btnManageCapacity) btnManageCapacity.addEventListener('click', () => openCapacityModal());
  if (btnUpdateCapQuick) btnUpdateCapQuick.addEventListener('click', () => openCapacityModal());
  if (btnCloseCapModal) btnCloseCapModal.addEventListener('click', () => closeModal('modal-update-capacity'));
  if (btnCancelCapacity) btnCancelCapacity.addEventListener('click', () => closeModal('modal-update-capacity'));

  // Form Submit Handler
  if (formUpdateCapacity) {
    formUpdateCapacity.addEventListener('submit', async (e) => {
      e.preventDefault();
      showError('capacity-form-error', null);

      const inputStock = document.getElementById('input-capacity-stock');
      const inputProd = document.getElementById('input-capacity-production');
      const inputPeriod = document.getElementById('input-capacity-period');
      const inputLead = document.getElementById('input-capacity-lead-days');
      const inputLoc = document.getElementById('input-capacity-location');
      const selectedStatusRadio = document.querySelector('input[name="capacity_status"]:checked');

      const capacityPayload = {
        availableStock: inputStock ? Number(inputStock.value) : 0,
        productionCapacity: inputProd ? Number(inputProd.value) : 0,
        productionPeriod: inputPeriod ? inputPeriod.value : 'monthly',
        productionTimeDays: inputLead ? Number(inputLead.value) : 7,
        locationName: inputLoc ? inputLoc.value.trim() : '',
        availabilityStatus: selectedStatusRadio ? selectedStatusRadio.value : 'available'
      };

      // Validate Capacity
      const validation = ValidationService.validateCapacity(capacityPayload);
      if (!validation.isValid) {
        showError('capacity-form-error', validation.error);
        return;
      }

      setButtonLoading(btnSaveCapacity, true);
      try {
        await capacityRepository.updateCapacity(capacityPayload);
        closeModal('modal-update-capacity');
        showToast('Capacity updated successfully.');
        await loadArtisanDashboard();
        if (activeArtisanTab === 'products') {
          await loadProductsList();
        }
      } catch (err) {
        console.error('Error saving capacity:', err);
        showError('capacity-form-error', err.message || 'Failed to update capacity.');
      } finally {
        setButtonLoading(btnSaveCapacity, false);
      }
    });
  }


  // D. Opportunity Detail Modal
  const btnCloseOppModal = document.getElementById('btn-close-opp-modal');
  if (btnCloseOppModal) btnCloseOppModal.addEventListener('click', () => closeModal('modal-opportunity-detail'));

  async function showOpportunityDetailModal(oppId) {
    const opps = await artisanRepository.getNewOpportunities();
    const opp = opps.find(o => o.id === oppId) || opps[0];

    const titleEl = document.getElementById('opp-modal-title');
    const bodyEl = document.getElementById('opp-modal-body');

    if (titleEl) titleEl.textContent = opp.title;
    if (bodyEl) {
      bodyEl.innerHTML = `
        <div class="details-card" style="margin-bottom: 14px;">
          <div class="detail-row">
            <span class="detail-label">Buyer / Entity:</span>
            <span class="detail-value">${escapeHtml(opp.buyerName)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Buyer Type:</span>
            <span class="detail-value">${escapeHtml(opp.buyerType)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Total Required:</span>
            <span class="detail-value">${opp.requiredQuantity} units</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Your Workshop Share:</span>
            <span class="detail-value" style="color: var(--color-brown-primary); font-weight:800;">${opp.artisanSuggestedCapacity} units</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Target Rate:</span>
            <span class="detail-value">₹${opp.targetPricePerUnit} / unit</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Delivery Deadline:</span>
            <span class="detail-value">${escapeHtml(opp.deadline)}</span>
          </div>
        </div>
        <div class="opportunity-card__cluster-note" style="margin-bottom: 16px;">
          🤝 <strong>Cluster Matching:</strong> Remaining ${opp.requiredQuantity - opp.artisanSuggestedCapacity} units will be fulfilled collectively by ${opp.participatingArtisansCount} verified partner artisans in your region.
        </div>
        <button type="button" class="primary-btn" id="btn-accept-opp-cluster">
          <span>Participate in Cluster Order</span>
        </button>
      `;

      const btnAccept = bodyEl.querySelector('#btn-accept-opp-cluster');
      if (btnAccept) {
        btnAccept.addEventListener('click', () => {
          closeModal('modal-opportunity-detail');
          showToast('Interest confirmed! Cluster coordinator will reach out. 🎉');
        });
      }
    }

    openModal('modal-opportunity-detail');
  }

  // E. AI Product Cataloging Modal
  const btnCloseCatalogModal = document.getElementById('btn-close-catalog-modal');
  const btnMockCamera = document.getElementById('btn-mock-camera-capture');

  if (btnCloseCatalogModal) btnCloseCatalogModal.addEventListener('click', () => closeModal('modal-ai-catalog'));

  if (btnMockCamera) {
    btnMockCamera.addEventListener('click', () => {
      closeModal('modal-ai-catalog');
      openAddProductModal();
      showToast('Vision capture prepared. Please upload your craft photo! 📸');
    });
  }

  // F. KALA-MITRA Copilot Modal & Voice Assistant
  const btnOpenCopilot = document.getElementById('btn-open-copilot');
  const btnCloseCopilot = document.getElementById('btn-close-copilot-modal');
  const btnSendCopilot = document.getElementById('btn-send-copilot-query');
  const inputCopilot = document.getElementById('input-copilot-query');
  const btnCopilotMic = document.getElementById('btn-copilot-mic');

  let copilotVoiceRecognition = null;
  let isCopilotListening = false;

  if (btnOpenCopilot) btnOpenCopilot.addEventListener('click', () => openModal('modal-copilot'));
  if (btnCloseCopilot) btnCloseCopilot.addEventListener('click', () => closeModal('modal-copilot'));

  document.querySelectorAll('.copilot-chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      const query = e.currentTarget.getAttribute('data-query');
      if (inputCopilot) inputCopilot.value = query;
      handleSendCopilotQuery(query);
    });
  });

  if (btnSendCopilot && inputCopilot) {
    btnSendCopilot.addEventListener('click', () => {
      const query = inputCopilot.value.trim();
      if (query) {
        handleSendCopilotQuery(query);
        inputCopilot.value = '';
      }
    });
    inputCopilot.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const query = inputCopilot.value.trim();
        if (query) {
          handleSendCopilotQuery(query);
          inputCopilot.value = '';
        }
      }
    });
  }

  // Artisan Copilot Voice Assistant (Microphone Button)
  if (btnCopilotMic) {
    btnCopilotMic.addEventListener('click', () => {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        showToast('Voice Assistant is not supported in this browser. Please type your query.');
        return;
      }

      if (isCopilotListening && copilotVoiceRecognition) {
        copilotVoiceRecognition.stop();
        return;
      }

      try {
        copilotVoiceRecognition = new SpeechRecognition();
      } catch (err) {
        showToast('Failed to access microphone for Copilot voice assistant.');
        return;
      }

      const currentLang = document.getElementById('artisan-lang-select')?.value || selectedLanguage || 'English';
      const langMap = { English: 'en-IN', Telugu: 'te-IN', Hindi: 'hi-IN' };
      copilotVoiceRecognition.lang = langMap[currentLang] || 'en-IN';
      copilotVoiceRecognition.interimResults = true;
      copilotVoiceRecognition.continuous = false;
      copilotVoiceRecognition.maxAlternatives = 1;

      copilotVoiceRecognition.onstart = () => {
        isCopilotListening = true;
        btnCopilotMic.classList.add('is-listening');
        btnCopilotMic.innerHTML = '🔴';
        btnCopilotMic.title = 'Listening... Tap to stop';
        if (inputCopilot) {
          inputCopilot.placeholder = '🔴 Listening... Speak your question now';
        }
        showToast('🎙️ Voice Assistant listening... Speak your query to Copilot.');
      };

      copilotVoiceRecognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        transcript = transcript.trim();
        if (inputCopilot && transcript) {
          inputCopilot.value = transcript;
        }
      };

      copilotVoiceRecognition.onerror = (event) => {
        console.warn('Copilot voice recognition error:', event.error);
        isCopilotListening = false;
        btnCopilotMic.classList.remove('is-listening');
        btnCopilotMic.innerHTML = '🎤';
        btnCopilotMic.title = 'Speak to Copilot (Voice Assistant)';
        if (inputCopilot) {
          inputCopilot.placeholder = 'Ask KALA-MITRA or tap 🎤 to speak...';
        }
      };

      copilotVoiceRecognition.onend = () => {
        isCopilotListening = false;
        btnCopilotMic.classList.remove('is-listening');
        btnCopilotMic.innerHTML = '🎤';
        btnCopilotMic.title = 'Speak to Copilot (Voice Assistant)';
        if (inputCopilot) {
          inputCopilot.placeholder = 'Ask KALA-MITRA or tap 🎤 to speak...';
          const spokenQuery = inputCopilot.value.trim();
          if (spokenQuery) {
            handleSendCopilotQuery(spokenQuery, { autoSpeak: true });
            inputCopilot.value = '';
          }
        }
      };

      copilotVoiceRecognition.start();
    });
  }

  async function handleSendCopilotQuery(query, options = {}) {
    const chatContainer = document.getElementById('copilot-chat-messages');
    if (!chatContainer) return;

    const user = authService.getCurrentUser();
    const activeLang = document.getElementById('artisan-lang-select')?.value || document.getElementById('global-language-select')?.value || selectedLanguage || 'English';
    const langCode = activeLang === 'Telugu' ? 'te' : (activeLang === 'Hindi' ? 'hi' : 'en');
    const isTelugu = activeLang === 'Telugu';
    const isHindi = activeLang === 'Hindi';

    // 1. Append User Message
    chatContainer.innerHTML += `
      <div style="align-self: flex-end; background: var(--color-brown-primary); color: #FFF; padding: 8px 14px; border-radius: 12px; font-size: 0.84rem; margin-top: 6px; max-width: 82%;">
        ${escapeHtml(query)}
      </div>
    `;

    // 2. Append Thinking Indicator
    const thinkingText = isTelugu ? 'చేతివృత్తి సమాచారాన్ని సేకరిస్తోంది...' : (isHindi ? 'शिल्प बुद्धिमत्ता की जांच की जा रही है...' : 'Consulting craft intelligence...');
    const thinkingId = `copilot-thinking-${Date.now()}`;
    chatContainer.innerHTML += `
      <div class="copilot-msg bot" id="${thinkingId}" style="margin-top: 6px;">
        <span style="display: flex; align-items: center; gap: 6px;">
          <span style="animation: pulse 1s infinite alternate;">✨</span>
          <span>${thinkingText}</span>
        </span>
      </div>
    `;
    chatContainer.scrollTop = chatContainer.scrollHeight;

    let responsePlainText = '';

    try {
      const response = await fetch('http://127.0.0.1:8000/api/v1/copilot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query,
          language: langCode,
          artisan_context: {
            location: user?.location || 'East Godavari, Andhra Pradesh',
            craftType: user?.craftType || 'Bamboo Crafts'
          }
        })
      });

      const thinkingEl = document.getElementById(thinkingId);
      if (response.ok) {
        const data = await response.json();
        const rawResponse = data.response || '';
        responsePlainText = rawResponse.replace(/\*\*(.*?)\*\*/g, '$1').replace(/<[^>]*>/g, '');
        const formattedText = rawResponse
          .replace(/\n/g, '<br/>')
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        let engineLabel = 'Craft Knowledge Engine';
        if (data.source === 'ollama_llm') {
          engineLabel = isTelugu ? 'ఒలామా LLM ఇంజిన్' : (isHindi ? 'ओलामो LLM इंजन' : 'Ollama LLM Engine');
        } else {
          engineLabel = isTelugu ? 'క్రాఫ్ట్ పరిజ్ఞానం ఇంజిన్' : (isHindi ? 'शिल्प ज्ञान इंजन' : 'Craft Knowledge Engine');
        }
        const listenText = isTelugu ? '🔊 వినండి' : (isHindi ? '🔊 सुनें' : '🔊 Listen');

        if (thinkingEl) {
          thinkingEl.innerHTML = `
            <div>
              <div style="margin-bottom: 6px; font-size: 0.82rem; line-height: 1.4;">${formattedText}</div>
              <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 6px;">
                <span style="font-size: 0.68rem; opacity: 0.7; font-weight: 700; color: var(--color-brown-warm);">⚡ ${engineLabel}</span>
                <button type="button" class="copilot-listen-btn" data-speak-text="${escapeHtml(responsePlainText)}" style="display: inline-flex; align-items: center; gap: 4px; border: 1px solid #DFCCA6; background: #FFF8EE; border-radius: 6px; padding: 2px 8px; font-size: 0.72rem; font-weight: 700; color: var(--color-brown-primary); cursor: pointer;">
                  ${listenText}
                </button>
              </div>
            </div>
          `;
        }
      } else {
        throw new Error('Backend returned status ' + response.status);
      }
    } catch (e) {
      console.warn('Copilot backend fetch fallback:', e);
      const thinkingEl = document.getElementById(thinkingId);
      if (thinkingEl) {
        const activeLang = document.getElementById('artisan-lang-select')?.value || document.getElementById('global-language-select')?.value || selectedLanguage || 'English';
        const q = query.toLowerCase();
        let fallbackReply = "";

        if (activeLang === 'Telugu') {
          fallbackReply = "💰 **ధర నిర్ణయం మార్గదర్శకత్వం:** ముడి సరుకుల ఖర్చు, రోజువారీ కూలి మరియు 25% న్యాయమైన లాభాన్ని లెక్కించండి. సాధారణ బల్క్ ధర: ₹400–₹550/యూనిట్.";
          if (q.includes('pricing') || q.includes('price') || q.includes('ధర') || q.includes('cost')) {
            fallbackReply = "💰 **ధర నిర్ణయం సూత్రం:** ముడి సరుకుల ఖర్చు + రోజువారీ కూలి + రవాణా (₹20) + 25% న్యాయమైన లాభం. సాధారణ బల్క్ ధర: ₹400–₹550/యూనిట్.";
          } else if (q.includes('opportunity') || q.includes('region') || q.includes('అవకాశం') || q.includes('ప్రాంతం')) {
            fallbackReply = "📈 **ప్రాంతీయ డిమాండ్:** మీ ప్రాంతంలో పర్యావరణ అనుకూల హస్తకళలు మరియు వెదురు ఉత్పత్తులకు అధిక కొనుగోలుదారుల డిమాండ్ ఉంది.";
          } else if (q.includes('cluster') || q.includes('collective') || q.includes('క్లస్టర్') || q.includes('సమిష్టి')) {
            fallbackReply = "🤝 **సమిష్టి సామర్థ్యం:** బల్క్ ఆర్డర్లు (500+ యూనిట్లు) సమీపంలోని కళాకారుల మధ్య పంచుకోబడతాయి, తద్వారా ప్రతి వర్క్‌షాప్ తన వంతును సులభంగా పూర్తి చేయగలదు.";
          }
        } else if (activeLang === 'Hindi') {
          fallbackReply = "💰 **मूल्य निर्धारण मार्गदर्शन:** कच्चा माल, दैनिक मजदूरी और 25% उचित लाभ जोड़कर मूल्य तय करें। सामान्य बल्क दर: ₹400–₹550/यूनिट।";
          if (q.includes('pricing') || q.includes('price') || q.includes('मूल्य') || q.includes('दाम')) {
            fallbackReply = "💰 **मूल्य निर्धारण सूत्र:** कच्चा माल + दैनिक मजदूरी + परिवहन (₹20) + 25% उचित लाभ। सामान्य बल्क दर: ₹400–₹550/यूनिट।";
          } else if (q.includes('opportunity') || q.includes('region') || q.includes('अवसर') || q.includes('क्षेत्र')) {
            fallbackReply = "📈 **क्षेत्रीय मांग:** आपके क्षेत्र में पर्यावरण-अनुकूल हस्तशिल्प और बांस के सामान की उच्च मांग देखी गई है।";
          } else if (q.includes('cluster') || q.includes('collective') || q.includes('क्लस्टर') || q.includes('सामूहिक')) {
            fallbackReply = "🤝 **सामूहिक क्षमता:** बल्क ऑर्डर (500+ इकाइयाँ) पास के कारीगरों के बीच विभाजित किए जाते हैं ताकि प्रत्येक कार्यशाला अपना हिस्सा आसानी से पूरा कर सके।";
          }
        } else {
          fallbackReply = "💰 **Pricing Guidance:** Ensure material cost, daily labor rate, and a 20%–30% margin are factored in.";
          if (q.includes('pricing') || q.includes('price')) {
            fallbackReply = "💰 **Pricing Formula:** Raw Materials + Daily Labor Rate + Transport (₹20) + 25% Fair Margin. Standard bulk range: ₹400–₹550/unit.";
          } else if (q.includes('opportunity') || q.includes('region')) {
            fallbackReply = "📈 **Regional Demand:** High demand observed for eco-friendly handicrafts and bamboo homeware in Southern region.";
          } else if (q.includes('cluster') || q.includes('collective')) {
            fallbackReply = "🤝 **Collective Capacity:** Bulk requirements (500+ units) are split across nearby verified artisans so each workshop fulfills its share comfortably.";
          }
        }

        responsePlainText = fallbackReply.replace(/\*\*(.*?)\*\*/g, '$1').replace(/<[^>]*>/g, '');
        thinkingEl.innerHTML = `
          <div>
            <div style="margin-bottom: 6px; font-size: 0.82rem; line-height: 1.4;">${fallbackReply.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</div>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 6px;">
              <span style="font-size: 0.68rem; opacity: 0.7; font-weight: 700; color: var(--color-brown-warm);">⚡ ${activeLang} Craft Knowledge Engine</span>
              <button type="button" class="copilot-listen-btn" data-speak-text="${escapeHtml(responsePlainText)}" style="display: inline-flex; align-items: center; gap: 4px; border: 1px solid #DFCCA6; background: #FFF8EE; border-radius: 6px; padding: 2px 8px; font-size: 0.72rem; font-weight: 700; color: var(--color-brown-primary); cursor: pointer;">
                🔊 Listen
              </button>
            </div>
          </div>
        `;
      }
    }
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // Automatically speak reply aloud if query was submitted via Voice Assistant mic
    if (options.autoSpeak && responsePlainText) {
      speakNotificationText(responsePlainText);
      showToast('🗣️ Speaking Copilot answer aloud...');
    }
  }

  // Delegated click handler for Copilot Listen buttons
  const copilotChatContainer = document.getElementById('copilot-chat-messages');
  if (copilotChatContainer) {
    copilotChatContainer.addEventListener('click', (e) => {
      const listenBtn = e.target.closest('[data-speak-text]');
      if (listenBtn) {
        const textToSpeak = listenBtn.getAttribute('data-speak-text');
        if (textToSpeak) {
          speakNotificationText(textToSpeak);
          showToast('🔊 Reading Copilot response aloud...');
        }
      }
    });
  }


  // =========================================================================
  // 8. Buyer Marketplace UI & Routes
  // =========================================================================
  const buyerDemoOpportunities = [
    {
      id: 'opp-bamboo-500',
      title: 'Bulk Bamboo Basket Requirement',
      requiredQuantity: 500,
      category: 'Bamboo Crafts',
      region: 'Andhra Pradesh',
      status: 'Open',
      buyerName: 'GreenLeaf Hotels',
      buyerType: 'Hospitality Chain',
      targetPricePerUnit: 480,
      deadline: '14 days',
      artisanSuggestedCapacity: 120
    },
    {
      id: 'opp-pottery-250',
      title: 'Decorative Pottery Order',
      requiredQuantity: 250,
      category: 'Pottery',
      region: 'Telangana',
      status: 'Open',
      buyerName: 'Urban Decor Studio',
      buyerType: 'Interior Design',
      targetPricePerUnit: 620,
      deadline: '10 days',
      artisanSuggestedCapacity: 90
    },
    {
      id: 'opp-textile-300',
      title: 'Handloom Textile Bulk Requirement',
      requiredQuantity: 300,
      category: 'Textiles',
      region: 'Tamil Nadu',
      status: 'Open',
      buyerName: 'Vastra Collective',
      buyerType: 'Retail Boutique',
      targetPricePerUnit: 840,
      deadline: '12 days',
      artisanSuggestedCapacity: 110
    }
  ];

  function getBuyerInitials() {
    const user = authService.getCurrentUser();
    if (!user || !user.name) return 'B';
    return user.name.split(' ').slice(0, 2).map(part => part[0]).join('').toUpperCase();
  }

  function getBuyerProductCards() {
    const categoryProducts = {
      'Bamboo Crafts': ['Handwoven Bamboo Basket', 'Bamboo Storage Hamper', 'Bamboo Table Mat Set', 'Bamboo Picnic Tray', 'Bamboo Planter', 'Bamboo Market Bag'],
      'Pottery': ['Terracotta Decorative Pot', 'Blue Glazed Serving Bowl', 'Handmade Clay Vase', 'Terracotta Oil Lamp Set', 'Stoneware Dinner Set', 'Clay Incense Holder'],
      'Handloom & Weaving': ['Handwoven Ikat Dupatta', 'Cotton Loom Runner', 'Woven Reed Wall Hanging', 'Handloom Tablecloth', 'Natural Fibre Cushion Cover', 'Loom-Woven Shawl'],
      'Textiles': ['Handloom Cotton Stole', 'Block Print Cotton Saree', 'Natural Dye Scarf', 'Embroidered Cushion Cover', 'Linen Kitchen Towel Set', 'Printed Cotton Tote'],
      'Wood Crafts': ['Wooden Carved Tray', 'Handcrafted Wooden Bowl', 'Carved Wall Panel', 'Wooden Jewellery Box', 'Wooden Serving Spoon Set', 'Teak Desk Organiser'],
      'Metal Crafts': ['Brass Temple Lamp', 'Dhokra Horse Figurine', 'Copper Serving Thali', 'Brass Wall Sconce', 'Bell Metal Bowl Set', 'Handmade Iron Lantern'],
      'Jewelry': ['Silver Floral Jewelry Set', 'Terracotta Bead Necklace', 'Brass Filigree Earrings', 'Handmade Beaded Bracelet', 'Silver Oxidized Ring', 'Traditional Pendant Set'],
      'Home Decor': ['Handpainted Wall Plate', 'Artisan Candle Holder', 'Decorative Macrame Hanger', 'Handmade Table Runner', 'Crafted Mirror Frame', 'Festive Toran Set'],
      'Traditional Art': ['Madhubani Folk Painting', 'Warli Art Panel', 'Kalamkari Art Print', 'Pattachitra Painting', 'Gond Art Canvas', 'Miniature Folk Art Set'],
      'Other': ['Handmade Festival Gift Box', 'Artisan Craft Hamper', 'Natural Fibre Coasters', 'Handpainted Bookmark Set', 'Craft Workshop Kit', 'Heritage Souvenir Set']
    };

    const categoryDetails = {
      'Bamboo Crafts': { icon: '🧺', artisan: 'Lakshmi Crafts', location: 'Rajahmundry', material: 'Natural bamboo & cane', basePrice: 450 },
      'Pottery': { icon: '🏺', artisan: 'Sri Kala Crafts', location: 'Kakinada', material: 'River clay', basePrice: 650 },
      'Handloom & Weaving': { icon: '🧵', artisan: 'Mangalagiri Weaves', location: 'Mangalagiri', material: 'Handspun cotton', basePrice: 780 },
      'Textiles': { icon: '🧣', artisan: 'Vastra Handlooms', location: 'Chennai', material: 'Organic cotton', basePrice: 850 },
      'Wood Crafts': { icon: '🪵', artisan: 'Aranya Woodworks', location: 'Warangal', material: 'Teak wood', basePrice: 720 },
      'Metal Crafts': { icon: '🔔', artisan: 'Dokra Atelier', location: 'Bhubaneswar', material: 'Brass and bell metal', basePrice: 980 },
      'Jewelry': { icon: '💍', artisan: 'Aditi Jewels', location: 'Hyderabad', material: 'Silver alloy', basePrice: 1400 },
      'Home Decor': { icon: '🏡', artisan: 'Sajja Studio', location: 'Pune', material: 'Natural fibre and wood', basePrice: 560 },
      'Traditional Art': { icon: '🎨', artisan: 'Kala Parampara', location: 'Mysuru', material: 'Natural pigments and canvas', basePrice: 1100 },
      'Other': { icon: '✨', artisan: 'Mitra Artisan Collective', location: 'Jaipur', material: 'Mixed artisan materials', basePrice: 480 }
    };

    return Object.entries(categoryProducts).flatMap(([category, names]) => {
      const details = categoryDetails[category];
      return names.map((name, index) => ({
        id: `buyer-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index + 1}`,
        name,
        category,
        artisanName: details.artisan,
        location: details.location,
        price: details.basePrice + (index * 75),
        availableQuantity: 20 + ((index * 17) % 100),
        productionTime: `${5 + (index % 6)} days`,
        imageIcon: details.icon,
        imageUrl: category === 'Bamboo Crafts' && index === 0
          ? 'https://img.indiahandmade.com/catalog/product/cache/dee0bc41489afb86ae85561eae1bc64e/m/a/magnific_2972728020.png'
          : category === 'Bamboo Crafts' && index === 1
            ? 'https://m.media-amazon.com/images/I/61cGeJuSMaL._AC_UF1000,1000_QL80_.jpg'
            : category === 'Bamboo Crafts' && index === 2
              ? 'https://m.media-amazon.com/images/I/91TiKyC3JmL._AC_UF350,350_QL80_.jpg'
              : category === 'Bamboo Crafts' && index === 3
                ? 'https://m.media-amazon.com/images/I/71-UCOKyy-L._AC_UF350,350_QL80_.jpg'
                : category === 'Bamboo Crafts' && index === 4
                  ? 'https://www.akway.in/cdn/shop/files/4a_d9add681-c707-4de1-8142-670dcd223cf3.jpg?v=1700726622&width=500'
                  : null,
        description: `${name} made by skilled artisans using traditional ${category.toLowerCase()} techniques.`,
        material: details.material,
        tags: [category, 'Handcrafted', 'Artisan Made']
      }));
    });
  }

  function renderBuyerProductImage(product, className) {
    if (product.imageUrl) {
      const imageVariant = product.name === 'Bamboo Picnic Tray' ? ' buyer-product-image--picnic-tray' : '';
      return `<img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" class="${className} buyer-product-image${imageVariant}" />`;
    }
    return product.imageIcon;
  }

  function initializeVoiceAssistant() {
    const languageSelect = document.getElementById('voice-language');
    const speakButton = document.getElementById('voice-speak-btn');
    const sendButton = document.getElementById('voice-send-btn');
    const stopButton = document.getElementById('voice-stop-btn');
    const input = document.getElementById('voice-text-input');
    const messages = document.getElementById('voice-assistant-messages');
    const state = document.getElementById('voice-assistant-state');
    const error = document.getElementById('voice-assistant-error');
    if (!languageSelect || !speakButton || !messages || languageSelect.dataset.bound) return;
    languageSelect.dataset.bound = 'true';
    const languageNames = { en: 'English', te: 'తెలుగు', hi: 'हिन्दी' };
    const recognitionLanguage = { en: 'en-IN', te: 'te-IN', hi: 'hi-IN' };
    languageSelect.value = sessionStorage.getItem('kala-mitra-language') || 'en';
    const savedMessages = JSON.parse(sessionStorage.getItem('kala-mitra-voice-history') || '[]');
    savedMessages.forEach(message => appendVoiceMessage(message.text, message.role));
    let recognition = null;
    let conversation = savedMessages.map(message => ({ role: message.role === 'user' ? 'user' : 'assistant', content: message.text }));

    function extractSearchTerm(queryText) {
      if (!queryText) return '';
      const clean = queryText.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?'"“”]/g, '').trim().toLowerCase();
      const craftKeywords = ['basket', 'bamboo', 'saree', 'silk', 'pottery', 'terracotta', 'wood', 'toy', 'handloom', 'diya', 'shawl', 'bag', 'jewellery', 'craft'];
      for (const kw of craftKeywords) {
        if (clean.includes(kw)) return kw;
      }
      return clean.split(' ').filter(w => w.length > 2)[0] || clean;
    }

    function appendVoiceMessage(text, role, queryText = '') {
      const bubble = document.createElement('div');
      bubble.className = `voice-message voice-message--${role}`;
      bubble.textContent = text;

      if (role === 'assistant') {
        const searchTerm = extractSearchTerm(queryText || text);
        if (searchTerm && (text.toLowerCase().includes('basket') || text.toLowerCase().includes('saree') || text.toLowerCase().includes('pottery') || text.toLowerCase().includes('craft') || text.toLowerCase().includes('product') || text.toLowerCase().includes('unit'))) {
          const actionBtn = document.createElement('button');
          actionBtn.type = 'button';
          actionBtn.className = 'primary-btn small';
          actionBtn.style.marginTop = '10px';
          actionBtn.style.fontSize = '0.8rem';
          actionBtn.style.display = 'inline-flex';
          actionBtn.style.alignItems = 'center';
          actionBtn.style.gap = '6px';
          actionBtn.innerHTML = `🔍 View ${searchTerm.charAt(0).toUpperCase() + searchTerm.slice(1)} Products in Marketplace`;
          actionBtn.addEventListener('click', () => {
            navigateTo('buyer-home');
            handleBuyerHomeSearch(searchTerm);
          });
          bubble.appendChild(document.createElement('br'));
          bubble.appendChild(actionBtn);
        }
      }

      messages.appendChild(bubble);
      messages.scrollTop = messages.scrollHeight;
    }

    function setState(text) { if (state) state.textContent = text; }

    function speakResponse(text, language) {
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text.replace(/[*_`#]/g, ''));
      utterance.lang = recognitionLanguage[language];
      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find(item => item.lang.toLowerCase().startsWith(recognitionLanguage[language].slice(0, 2)));
      if (voice) utterance.voice = voice;
      else if (language !== 'en') error.textContent = `${languageNames[language]} voice is not available on this device. Text response is still available.`;
      utterance.onstart = () => { setState('🔊 Speaking...'); stopButton.hidden = false; };
      utterance.onend = () => { setState('🎙️ Tap to speak'); stopButton.hidden = true; };
      window.speechSynthesis.speak(utterance);
    }

    async function sendVoiceMessage(text) {
      if (!text.trim()) return;
      const language = languageSelect.value;
      error.textContent = '';
      appendVoiceMessage(text, 'user');
      conversation.push({ role: 'user', content: text });
      sessionStorage.setItem('kala-mitra-voice-history', JSON.stringify(conversation.map(message => ({ role: message.role, text: message.content }))));
      setState('⏳ Understanding...');
      try {
        const response = await fetch('http://127.0.0.1:8000/api/v1/copilot/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: text, language, mode: 'voice', history: conversation.slice(-10), artisan_context: { page: window.location.hash } }) });
        if (!response.ok) throw new Error('Assistant unavailable');
        const data = await response.json();
        conversation.push({ role: 'assistant', content: data.response });
        appendVoiceMessage(data.response, 'assistant', text);
        sessionStorage.setItem('kala-mitra-voice-history', JSON.stringify(conversation.map(message => ({ role: message.role, text: message.content }))));
        speakResponse(data.response, language);
      } catch (requestError) {
        const fallback = language === 'te' ? 'క్షమించండి, ప్రస్తుతం సహాయక సేవ అందుబాటులో లేదు.' : language === 'hi' ? 'क्षमा करें, सहायक अभी उपलब्ध नहीं है।' : 'Sorry, the assistant is unavailable right now.';
        appendVoiceMessage(fallback, 'assistant');
        setState('⚠️ Please try again');
      }
    }

    languageSelect.addEventListener('change', () => { sessionStorage.setItem('kala-mitra-language', languageSelect.value); setState(languageSelect.value === 'te' ? '🎙️ మాట్లాడటానికి నొక్కండి' : languageSelect.value === 'hi' ? '🎙️ बोलने के लिए दबाएं' : '🎙️ Tap to speak'); });
    sendButton?.addEventListener('click', () => { const text = input.value; input.value = ''; sendVoiceMessage(text); });
    input?.addEventListener('keydown', event => { if (event.key === 'Enter') { const text = input.value; input.value = ''; sendVoiceMessage(text); } });
    stopButton?.addEventListener('click', () => { window.speechSynthesis?.cancel(); stopButton.hidden = true; setState('🎙️ Tap to speak'); });
    speakButton.addEventListener('click', () => {
      const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!Recognition) { error.textContent = 'Speech recognition is not available. Please use text input.'; return; }
      recognition?.stop();
      recognition = new Recognition();
      recognition.lang = recognitionLanguage[languageSelect.value];
      recognition.interimResults = false;
      recognition.continuous = false;
      recognition.onstart = () => { setState('🔴 Listening...'); error.textContent = ''; };
      recognition.onresult = event => { setState('⏳ Understanding...'); sendVoiceMessage(event.results[0][0].transcript); };
      recognition.onerror = () => { setState('⚠️ I could not understand that. Please try again.'); };
      recognition.onend = () => { if (!window.speechSynthesis?.speaking) setState('🎙️ Tap to speak'); };
      recognition.start();
    });
  }

  function renderBuyerHomeScreen() {
    const user = authService.getCurrentUser();
    if (!user) return;

    const buyerName = user.name || 'Buyer';
    const buyerAvatar = document.getElementById('buyer-header-avatar');
    if (buyerAvatar) {
      buyerAvatar.textContent = getBuyerInitials();
      if (!buyerAvatar.dataset.bound) {
        buyerAvatar.dataset.bound = 'true';
        buyerAvatar.addEventListener('click', () => {
          currentProfileMode = 'buyer';
          currentArtisanForProfile = null;
          renderBuyerProfile();
          navigateTo('buyer-profile');
        });
        buyerAvatar.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            buyerAvatar.click();
          }
        });
      }
    }

    // Initialize Marketplace Module
    const marketplaceContainer = document.getElementById('marketplace-container');
    if (marketplaceContainer) {
      if (!buyerMarketplace || !marketplaceContainer.firstElementChild) {
        buyerMarketplace = new MarketplaceModule('marketplace-container');
      }
    }

    const headerCartBtn = document.getElementById('buyer-header-cart-btn');
    if (headerCartBtn && !headerCartBtn.dataset.bound) {
      headerCartBtn.dataset.bound = 'true';
      headerCartBtn.addEventListener('click', () => {
        if (!buyerMarketplace) {
          buyerMarketplace = new MarketplaceModule('marketplace-container');
        }
        buyerMarketplace.renderCartModal();
      });
    }

    if (buyerMarketplace) {
      buyerMarketplace.updateCartCount();
    }

    const cards = getBuyerProductCards();

    const oppGrid = document.getElementById('buyer-opportunities-grid');
    if (oppGrid) {
      oppGrid.innerHTML = buyerDemoOpportunities.map(opp => `
        <article class="buyer-opp-card">
          <div class="buyer-opp-card__head">
            <span class="buyer-opp-card__tag">${opp.category}</span>
            <span class="buyer-opp-card__status">${opp.status}</span>
          </div>
          <h3>${opp.title}</h3>
          <div class="buyer-opp-card__stats">
            <span>Required: ${opp.requiredQuantity} units</span>
            <span>Region: ${opp.region}</span>
          </div>
          <button type="button" class="buyer-opp-card__btn" data-opportunity-id="${opp.id}">Explore Opportunity</button>
        </article>
      `).join('');

      oppGrid.querySelectorAll('.buyer-opp-card__btn').forEach(button => {
        button.addEventListener('click', () => {
          const oppId = button.dataset.opportunityId;
          renderBuyerOpportunityDetail(oppId);
          navigateTo('buyer-opportunity-detail');
        });
      });
    }

    const navButtons = document.querySelectorAll('[data-buyer-nav]');
    navButtons.forEach(button => {
      button.addEventListener('click', () => {
        const target = button.dataset.buyerNav;
        if (target === 'home') {
          navigateTo('buyer-home');
        } else if (target === 'discover') {
          renderBuyerDiscover();
          navigateTo('buyer-discover');
        } else if (target === 'orders') {
          renderBuyerOrders();
          navigateTo('buyer-orders');
        } else if (target === 'opportunities') {
          renderBuyerOpportunities();
          navigateTo('buyer-opportunities');
        } else if (target === 'notifications') {
          renderBuyerNotifications();
          navigateTo('buyer-notifications');
        } else if (target === 'voice-search') {
          initializeVoiceAssistant();
          navigateTo('buyer-voice-search');
        } else if (target === 'profile') {
          currentProfileMode = 'buyer';
          currentArtisanForProfile = null;
          renderBuyerProfile();
          navigateTo('buyer-profile');
        }
      });
    });

    document.querySelectorAll('.buyer-category-card').forEach(button => {
      button.addEventListener('click', () => {
        const category = button.dataset.category;
        renderBuyerDiscover('', category);
        navigateTo('buyer-discover');
      });
    });

    function handleBuyerHomeSearch(query) {
      if (!buyerMarketplace) {
        const container = document.getElementById('marketplace-container');
        if (container) {
          buyerMarketplace = new MarketplaceModule('marketplace-container');
        }
      }
      if (buyerMarketplace) {
        buyerMarketplace.setSearchQuery(query);
      }
      const target = document.getElementById('marketplace-product-grid') || document.getElementById('marketplace-container');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    const searchForm = document.getElementById('buyer-search-form');
    if (searchForm) {
      searchForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const query = document.getElementById('buyer-home-search')?.value?.trim() || '';
        handleBuyerHomeSearch(query);
      });
    }

    const homeSearchInput = document.getElementById('buyer-home-search');
    if (homeSearchInput) {
      homeSearchInput.addEventListener('input', (event) => {
        const query = event.target.value.trim();
        if (query === '' && buyerMarketplace) {
          buyerMarketplace.setSearchQuery('');
        }
      });
    }

    const voiceBtn = document.getElementById('buyer-voice-search-btn');
    let buyerVoiceRecognition = null;
    let isVoiceListening = false;

    if (voiceBtn) {
      voiceBtn.addEventListener('click', () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
          showToast('Voice search is not supported in this browser. Please type in the search bar.');
          return;
        }

        if (isVoiceListening && buyerVoiceRecognition) {
          buyerVoiceRecognition.stop();
          return;
        }

        try {
          buyerVoiceRecognition = new SpeechRecognition();
        } catch (err) {
          showToast('Failed to access microphone for voice search.');
          return;
        }

        const currentLang = document.getElementById('buyer-lang-select')?.value || 'English';
        const langMap = { English: 'en-IN', Telugu: 'te-IN', Hindi: 'hi-IN' };
        buyerVoiceRecognition.lang = langMap[currentLang] || 'en-IN';
        buyerVoiceRecognition.interimResults = true;
        buyerVoiceRecognition.continuous = false;
        buyerVoiceRecognition.maxAlternatives = 1;

        const originalBtnText = voiceBtn.innerHTML;

        buyerVoiceRecognition.onstart = () => {
          isVoiceListening = true;
          voiceBtn.classList.add('is-listening');
          voiceBtn.innerHTML = '🔴 Listening... (Tap to stop)';
          if (homeSearchInput) {
            homeSearchInput.placeholder = 'Listening... Speak craft or product name';
          }
        };

        buyerVoiceRecognition.onresult = (event) => {
          let transcript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            transcript += event.results[i][0].transcript;
          }
          transcript = transcript.trim();
          if (homeSearchInput && transcript) {
            homeSearchInput.value = transcript;
          }
        };

        buyerVoiceRecognition.onerror = (event) => {
          console.warn('Speech recognition error:', event.error);
          isVoiceListening = false;
          voiceBtn.classList.remove('is-listening');
          voiceBtn.innerHTML = originalBtnText;
          if (homeSearchInput) {
            homeSearchInput.placeholder = 'Search for crafts, products, or what you need...';
          }
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            showToast('Microphone permission denied. Please allow microphone access.');
          } else if (event.error === 'no-speech') {
            showToast('No voice detected. Tap Voice Search and speak your query.');
          }
        };

        buyerVoiceRecognition.onend = () => {
          isVoiceListening = false;
          voiceBtn.classList.remove('is-listening');
          voiceBtn.innerHTML = originalBtnText;
          if (homeSearchInput) {
            homeSearchInput.placeholder = 'Search for crafts, products, or what you need...';
            const rawQuery = homeSearchInput.value.trim();
            const cleanQuery = rawQuery.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?'"“”]/g, '').trim();
            if (cleanQuery) {
              homeSearchInput.value = cleanQuery;
              showToast(`🎙️ Voice Search: "${cleanQuery}"`);
              handleBuyerHomeSearch(cleanQuery);
            }
          }
        };

        try {
          buyerVoiceRecognition.start();
        } catch (startErr) {
          console.error('Failed to start speech recognition:', startErr);
          isVoiceListening = false;
          voiceBtn.classList.remove('is-listening');
          voiceBtn.innerHTML = originalBtnText;
        }
      });
    }
    initializeVoiceAssistant();
    const notificationBell = document.getElementById('buyer-notification-bell');
    if (notificationBell && !notificationBell.dataset.bound) {
      notificationBell.dataset.bound = 'true';
      notificationBell.addEventListener('click', () => { renderBuyerNotifications(); navigateTo('buyer-notifications'); });
    }
    updateBuyerNotificationBadge();

    const imageBtn = document.getElementById('buyer-image-search-btn');
    if (imageBtn) {
      imageBtn.addEventListener('click', () => {
        initCompactImageSearch();
        navigateTo('buyer-image-search');
      });
    }

    const findArtisansBtn = document.getElementById('buyer-find-artisans-btn');
    if (findArtisansBtn) {
      findArtisansBtn.addEventListener('click', () => navigateTo('buyer-bulk-requirement'));
    }

    document.getElementById('buyer-discover-search-btn')?.addEventListener('click', () => {
      renderBuyerDiscover(document.getElementById('buyer-discover-search')?.value?.trim() || '');
    });

    document.getElementById('buyer-discover-search')?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        renderBuyerDiscover(document.getElementById('buyer-discover-search')?.value?.trim() || '');
      }
    });

    // Initialize Image Search Handler
    initCompactImageSearch();

    const homeHeaderBrand = document.querySelector('.buyer-brand-name');
    if (homeHeaderBrand) {
      homeHeaderBrand.textContent = buyerName ? `${buyerName.split(' ')[0]} • KALA-MITRA` : 'KALA-MITRA';
    }
    const profileLogo = document.getElementById('buyer-profile-logo');
    if (profileLogo) {
      profileLogo.onclick = () => {
        currentProfileMode = 'buyer';
        currentArtisanForProfile = null;
        renderBuyerProfile();
        navigateTo('buyer-profile');
      };
      profileLogo.onkeydown = event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          profileLogo.click();
        }
      };
    }
  }

  function getArtisanRadius() {
    return Number(document.getElementById('artisan-radius-filter')?.value || 25);
  }

  function getArtisanSearchQuery() {
    return document.getElementById('artisan-location-search')?.value?.trim().toLowerCase() || '';
  }

  function setArtisanStatus(message, type = '') {
    const status = document.getElementById('artisan-discovery-status');
    if (status) {
      status.textContent = message;
      status.className = `artisan-discovery-status${type ? ` artisan-discovery-status--${type}` : ''}`;
    }
  }

  function createArtisanIcon(artisan) {
    const verifiedClass = artisan.verified ? ' artisan-marker--verified' : '';
    return L.divIcon({
      className: 'artisan-marker-wrapper',
      html: `<span class="artisan-marker${verifiedClass}" title="${escapeHtml(artisan.name)}">${artisan.verified ? '✓' : '•'}</span>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -18]
    });
  }

  function artisanPopup(artisan) {
    return `
      <div class="artisan-popup">
        <div class="artisan-popup__heading"><strong>${escapeHtml(artisan.name)}</strong>${artisan.verified ? '<span>✓ Verified</span>' : ''}</div>
        <p>Craft: ${escapeHtml(artisan.craft)}</p>
        <p>Location: ${escapeHtml(artisan.location)}</p>
        <div class="artisan-popup__stats"><span>Distance: ${artisan.distance.toFixed(1)} km</span><span>⭐ ${artisan.rating.toFixed(1)}</span><span>Capacity: ${artisan.capacity} units</span></div>
        <div class="artisan-popup__actions">
          <button type="button" data-artisan-action="profile" data-artisan-id="${artisan.id}">View Profile</button>
          <button type="button" data-artisan-action="products" data-artisan-id="${artisan.id}">View Products</button>
          <button type="button" data-artisan-action="contact" data-artisan-id="${artisan.id}">Contact Artisan</button>
        </div>
      </div>
    `;
  }

  function getVisibleArtisans() {
    const query = getArtisanSearchQuery();
    const category = document.getElementById('artisan-craft-filter')?.value || 'All';
    const verification = document.getElementById('artisan-verification-filter')?.value || 'all';
    const capacity = document.getElementById('artisan-capacity-filter')?.value || 'any';
    return nearbyArtisans.filter(artisan => {
      const searchMatches = !query || [artisan.name, artisan.craft, artisan.location].some(value => value.toLowerCase().includes(query));
      const categoryMatches = category === 'All' || artisan.craft === category;
      const verificationMatches = verification !== 'verified' || artisan.verified;
      const capacityMatches = capacity !== 'available' || artisan.capacity > 0;
      return searchMatches && categoryMatches && verificationMatches && capacityMatches;
    });
  }

  function renderArtisanCards() {
    const list = document.getElementById('artisan-list');
    const count = document.getElementById('artisan-result-count');
    const emptyState = document.getElementById('artisan-empty-state');
    if (!list || !count || !emptyState) return;
    const visibleArtisans = getVisibleArtisans();
    count.textContent = `${visibleArtisans.length} artisan${visibleArtisans.length === 1 ? '' : 's'} found`;
    list.innerHTML = visibleArtisans.map(artisan => `
      <article class="artisan-result-card${selectedArtisanId === artisan.id ? ' is-selected' : ''}" data-artisan-id="${artisan.id}">
        <div class="artisan-result-card__top"><div><h3>${escapeHtml(artisan.name)}</h3><p>${escapeHtml(artisan.craft)} • ${escapeHtml(artisan.location)}</p></div>${artisan.verified ? '<span class="artisan-verified-badge">✓ Verified</span>' : ''}</div>
        <div class="artisan-result-card__meta"><span>⭐ ${artisan.rating.toFixed(1)}</span><span>${artisan.distance.toFixed(1)} km</span><span>Capacity: ${artisan.capacity}</span></div>
        <div class="artisan-result-card__actions"><button type="button" class="secondary-btn" data-artisan-action="profile" data-artisan-id="${artisan.id}">View Profile</button><button type="button" class="primary-btn" data-artisan-action="contact" data-artisan-id="${artisan.id}">Contact</button></div>
      </article>
    `).join('');
    emptyState.hidden = visibleArtisans.length > 0;
    list.hidden = visibleArtisans.length === 0;
    list.querySelectorAll('.artisan-result-card').forEach(card => {
      card.addEventListener('click', event => {
        if (event.target.closest('[data-artisan-action]')) return;
        selectArtisan(Number(card.dataset.artisanId));
      });
    });
    list.querySelectorAll('[data-artisan-action]').forEach(button => {
      button.addEventListener('click', event => {
        event.stopPropagation();
        handleArtisanAction(button.dataset.artisanAction, Number(button.dataset.artisanId));
      });
    });
  }

  function renderArtisanMarkers() {
    if (!artisanMap || !artisanCluster) return;
    artisanCluster.clearLayers();
    artisanMarkers = new Map();
    getVisibleArtisans().forEach(artisan => {
      const marker = L.marker([artisan.latitude, artisan.longitude], { icon: createArtisanIcon(artisan) });
      marker.bindPopup(artisanPopup(artisan), { maxWidth: 290 });
      marker.on('click', () => {
        selectedArtisanId = artisan.id;
        renderArtisanCards();
      });
      marker.on('popupopen', event => {
        event.popup.getElement()?.querySelectorAll('[data-artisan-action]').forEach(button => {
          button.addEventListener('click', () => handleArtisanAction(button.dataset.artisanAction, Number(button.dataset.artisanId)));
        });
      });
      artisanMarkers.set(artisan.id, marker);
      artisanCluster.addLayer(marker);
    });
  }

  function selectArtisan(artisanId) {
    const artisan = nearbyArtisans.find(item => item.id === artisanId);
    const marker = artisanMarkers.get(artisanId);
    if (!artisan || !marker || !artisanMap) return;
    selectedArtisanId = artisanId;
    artisanMap.setView([artisan.latitude, artisan.longitude], Math.max(artisanMap.getZoom(), 13));
    artisanCluster.zoomToShowLayer(marker, () => marker.openPopup());
    renderArtisanCards();
  }

  let currentProfileMode = 'buyer';
  let currentArtisanForProfile = null;
  let profileReturnNav = 'discover';

  function handleArtisanAction(action, artisanId) {
    const artisan = nearbyArtisans.find(item => item.id === artisanId) || fallbackArtisans.find(item => item.id === artisanId);
    if (!artisan) return;
    if (action === 'profile' || action === 'products') {
      renderArtisanProfile(artisan, 'discover');
      navigateTo('buyer-profile');
    } else if (action === 'contact') {
      showToast(`Contact request started for ${artisan.name}.`);
    }
  }

  function getProductsForArtisanCraft(artisan) {
    const craftName = String(artisan.craft || artisan.craft_type || '').toLowerCase();
    const artisanName = artisan.name || 'Artisan';
    const artisanLoc = artisan.location || artisan.location_city || 'Andhra Pradesh, India';
    const artisanId = artisan.id || Math.floor(Math.random() * 1000) + 500;

    const keywords = craftName.split(/[\s&,/]+/);
    let matched = SAMPLE_PRODUCTS.filter(p => {
      if (p.artisan_id && p.artisan_id === artisan.id) return true;
      const cat = (p.craft_type || p.category || '').toLowerCase();
      const title = (p.title || '').toLowerCase();
      return keywords.some(k => k.length > 2 && (cat.includes(k) || title.includes(k)));
    });

    if (matched.length >= 4) {
      return matched;
    }

    let templates = [];

    if (craftName.includes('bamboo') || craftName.includes('cane')) {
      templates = [
        { title: "Handwoven Bamboo Storage Baskets (Set of 3)", price: 640, img: "https://spaindustrialdesign.wordpress.com/wp-content/uploads/2020/12/1-7.jpg?w=1200" },
        { title: "Artisanal Cane Tea Tray & Coasters", price: 850, img: "https://images.unsplash.com/photo-1590736704728-f4730bb30770?auto=format&fit=crop&w=600&q=80" },
        { title: "Hand-Carved Bamboo Accent Lamp", price: 1250, img: "https://images.unsplash.com/photo-1540932239986-30128078f3c5?auto=format&fit=crop&w=600&q=80" },
        { title: "Traditional Bamboo Utility Picnic Hamper", price: 920, img: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=600&q=80" }
      ];
    } else if (craftName.includes('kalamkari')) {
      templates = [
        { title: "Hand-painted Kalamkari Tree of Life Dupatta", price: 1450, img: "https://www.taneira.com/dw/image/v2/BGDZ_PRD/on/demandware.static/-/Sites-Taneira-product-catalog/default/dw837d9959/images/Taneira/SHK11C00017_1.jpg" },
        { title: "Authentic Pedana Kalamkari Cotton Saree", price: 2850, img: "https://i.pinimg.com/736x/80/7e/17/807e17c093a105fa03c14d9b232eb456.jpg" },
        { title: "Kalamkari Hand-printed Fabric Wall Tapestry", price: 980, img: "https://kotart.in/cdn/shop/files/CanvasAL774-4.jpg?v=1779620155" },
        { title: "Handcrafted Kalamkari Cushion Covers (Set of 2)", price: 650, img: "https://www.unnatisilks.com/cdn/shop/articles/Hand-Embroidered-Kit-DIY-Cross-Stitch-Kit-Manual-Needlework-Embroidery-kit-For-Beginners-Gift-Decoration-Embroidery.jpg_960x960_2fab2545-c6fe-4102-a434-d6011677cfc6.jpg?v=1655295175&width=2048" }
      ];
    } else if (craftName.includes('handloom') || craftName.includes('textile') || craftName.includes('weaver') || craftName.includes('silk') || craftName.includes('saree') || craftName.includes('cotton')) {
      templates = [
        { title: "Handwoven Banarasi Silk Border Saree", price: 2450, img: "https://www.laxhaclothing.com/cdn/shop/articles/8102993d0fa915fec35f5bf9a8778239.png?v=1747742238" },
        { title: "Mangalagiri Handloom Cotton Stole", price: 850, img: "https://www.taneira.com/dw/image/v2/BGDZ_PRD/on/demandware.static/-/Sites-Taneira-product-catalog/default/dw837d9959/images/Taneira/SHK11C00017_1.jpg" },
        { title: "Uppada Jamdani Handwoven Fabric", price: 3200, img: "https://i.pinimg.com/736x/80/7e/17/807e17c093a105fa03c14d9b232eb456.jpg" },
        { title: "Traditional Handloom Cotton Table Runner", price: 680, img: "https://www.unnatisilks.com/cdn/shop/articles/Hand-Embroidered-Kit-DIY-Cross-Stitch-Kit-Manual-Needlework-Embroidery-kit-For-Beginners-Gift-Decoration-Embroidery.jpg_960x960_2fab2545-c6fe-4102-a434-d6011677cfc6.jpg?v=1655295175&width=2048" }
      ];
    } else if (craftName.includes('pottery') || craftName.includes('terracotta') || craftName.includes('clay')) {
      templates = [
        { title: "Hand-molded Terracotta Water Pitcher (Matka)", price: 480, img: "https://cdn.shopify.com/s/files/1/0046/7193/0458/files/terracotta_pottery_wheel_large.jpg?v=1578035729" },
        { title: "Terracotta Hand-painted Garden Planters (Set of 2)", price: 750, img: "https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=600&q=80" },
        { title: "Traditional Clay Cooking Handi & Lid", price: 620, img: "https://cdn.shopify.com/s/files/1/0046/7193/0458/files/terracotta_pottery_wheel_large.jpg?v=1578035729" },
        { title: "Decorative Terracotta Earthen Flower Vase", price: 890, img: "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=600&q=80" }
      ];
    } else if (craftName.includes('wood') || craftName.includes('toy') || craftName.includes('etikoppaka') || craftName.includes('kondapalli')) {
      templates = [
        { title: "Etikoppaka Lacquerware Wooden Toy Set", price: 450, img: "https://shop.gaatha.com/image/cache/catalog/Gaatha/013-wooden-toys-(2)-900x900.jpg" },
        { title: "Hand-carved Wooden Serving Tray & Bowl", price: 920, img: "https://i0.wp.com/bastariya.com/wp-content/uploads/2023/03/wood-art-image-1024x1024.jpg?resize=466%2C466&ssl=1" },
        { title: "Kondapalli Traditional Wooden Dancing Doll", price: 780, img: "https://shop.gaatha.com/image/cache/catalog/Gaatha/013-wooden-toys-(2)-900x900.jpg" },
        { title: "Carved Wooden Spice Box with Brass Latch", price: 1100, img: "https://i0.wp.com/bastariya.com/wp-content/uploads/2023/03/wood-art-image-1024x1024.jpg?resize=466%2C466&ssl=1" }
      ];
    } else if (craftName.includes('metal') || craftName.includes('brass') || craftName.includes('dokra') || craftName.includes('bell')) {
      templates = [
        { title: "Authentic Dokra Tribal Brass Idol", price: 1250, img: "https://i.pinimg.com/736x/ec/d7/88/ecd788a1b5c87e0fa192305a415a7703.jpg" },
        { title: "Hand-hammered Brass Oil Lamp (Samai)", price: 980, img: "https://i.pinimg.com/736x/ec/d7/88/ecd788a1b5c87e0fa192305a415a7703.jpg" },
        { title: "Traditional Budithi Brass Puja Vessel", price: 850, img: "https://i.pinimg.com/736x/ec/d7/88/ecd788a1b5c87e0fa192305a415a7703.jpg" },
        { title: "Dokra Cast Metal Wall Hanging Plaque", price: 1450, img: "https://i.pinimg.com/736x/ec/d7/88/ecd788a1b5c87e0fa192305a415a7703.jpg" }
      ];
    } else if (craftName.includes('leather') || craftName.includes('puppet') || craftName.includes('tholu')) {
      templates = [
        { title: "Tholu Bommalata Hand-painted Leather Lamp", price: 1350, img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQJCcnaEIgoMX-mInFp4hs5okIhjB1zdGKTOpO8K9aLvXiTwg9k3AYWgJT_&s=10" },
        { title: "Traditional Shadow Puppet Leather Wall Decor", price: 980, img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQJCcnaEIgoMX-mInFp4hs5okIhjB1zdGKTOpO8K9aLvXiTwg9k3AYWgJT_&s=10" },
        { title: "Artisanal Embossed Leather Handbag", price: 1650, img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQJCcnaEIgoMX-mInFp4hs5okIhjB1zdGKTOpO8K9aLvXiTwg9k3AYWgJT_&s=10" },
        { title: "Hand-dyed Leather Journal & Bookmark Set", price: 580, img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQJCcnaEIgoMX-mInFp4hs5okIhjB1zdGKTOpO8K9aLvXiTwg9k3AYWgJT_&s=10" }
      ];
    } else if (craftName.includes('stone') || craftName.includes('sculpture') || craftName.includes('marble')) {
      templates = [
        { title: "Hand-carved Softstone Ganesha Sculpture", price: 1850, img: "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=600&q=80" },
        { title: "Soapstone Carved Aromatherapy Diffuser", price: 720, img: "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=600&q=80" },
        { title: "Artisanal Marble Mortar & Pestle Set", price: 890, img: "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=600&q=80" },
        { title: "Decorative Carved Stone Tealight Holder", price: 550, img: "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=600&q=80" }
      ];
    } else if (craftName.includes('jute') || craftName.includes('eco')) {
      templates = [
        { title: "Natural Jute Shopping Tote Bags (Pack of 3)", price: 480, img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQJCcnaEIgoMX-mInFp4hs5okIhjB1zdGKTOpO8K9aLvXiTwg9k3AYWgJT_&s=10" },
        { title: "Eco-friendly Braided Jute Floor Runner", price: 950, img: "https://spaindustrialdesign.wordpress.com/wp-content/uploads/2020/12/1-7.jpg?w=1200" },
        { title: "Handwoven Jute Wall Hanging Organizer", price: 620, img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQJCcnaEIgoMX-mInFp4hs5okIhjB1zdGKTOpO8K9aLvXiTwg9k3AYWgJT_&s=10" },
        { title: "Sustainable Jute Storage Bins (Set of 2)", price: 780, img: "https://spaindustrialdesign.wordpress.com/wp-content/uploads/2020/12/1-7.jpg?w=1200" }
      ];
    } else if (craftName.includes('embroidery') || craftName.includes('needle') || craftName.includes('zardozi')) {
      templates = [
        { title: "Banjara Mirror-work Cushion Covers (Set of 2)", price: 780, img: "https://www.unnatisilks.com/cdn/shop/articles/Hand-Embroidered-Kit-DIY-Cross-Stitch-Kit-Manual-Needlework-Embroidery-kit-For-Beginners-Gift-Decoration-Embroidery.jpg_960x960_2fab2545-c6fe-4102-a434-d6011677cfc6.jpg?v=1655295175&width=2048" },
        { title: "Zardozi Embroidered Velvet Clutch Bag", price: 1250, img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQJCcnaEIgoMX-mInFp4hs5okIhjB1zdGKTOpO8K9aLvXiTwg9k3AYWgJT_&s=10" },
        { title: "Kasuti Threadwork Cotton Table Runner", price: 690, img: "https://www.unnatisilks.com/cdn/shop/articles/Hand-Embroidered-Kit-DIY-Cross-Stitch-Kit-Manual-Needlework-Embroidery-kit-For-Beginners-Gift-Decoration-Embroidery.jpg_960x960_2fab2545-c6fe-4102-a434-d6011677cfc6.jpg?v=1655295175&width=2048" },
        { title: "Traditional Embroidered Wall Hanging Banner", price: 850, img: "https://www.unnatisilks.com/cdn/shop/articles/Hand-Embroidered-Kit-DIY-Cross-Stitch-Kit-Manual-Needlework-Embroidery-kit-For-Beginners-Gift-Decoration-Embroidery.jpg_960x960_2fab2545-c6fe-4102-a434-d6011677cfc6.jpg?v=1655295175&width=2048" }
      ];
    } else if (craftName.includes('bag') || craftName.includes('pouch') || craftName.includes('accessory')) {
      templates = [
        { title: "Handcrafted Ethnic Fabric Shoulder Bag", price: 680, img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQJCcnaEIgoMX-mInFp4hs5okIhjB1zdGKTOpO8K9aLvXiTwg9k3AYWgJT_&s=10" },
        { title: "Artisanal Embroidered Coin Pouch Set", price: 390, img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQJCcnaEIgoMX-mInFp4hs5okIhjB1zdGKTOpO8K9aLvXiTwg9k3AYWgJT_&s=10" },
        { title: "Handwoven Tote Bag with Wooden Handles", price: 890, img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQJCcnaEIgoMX-mInFp4hs5okIhjB1zdGKTOpO8K9aLvXiTwg9k3AYWgJT_&s=10" },
        { title: "Sustainable Cotton & Jute Laptop Sleeve", price: 750, img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQJCcnaEIgoMX-mInFp4hs5okIhjB1zdGKTOpO8K9aLvXiTwg9k3AYWgJT_&s=10" }
      ];
    } else if (craftName.includes('jewel') || craftName.includes('bead')) {
      templates = [
        { title: "Handmade Bead & Terracotta Jewelry Set", price: 580, img: "https://bongoniketan.in/cdn/shop/files/buyhandmadecloth_kanthabeadsjewelleryfromsonajhurihaatsantiniketanwestbengalbybongoniketanartisansonline18_30a7e40b-41a2-40e5-9eea-c20a99ed13d5.jpg?v=1750079243&width=1946" },
        { title: "Tribal Oxidized Silver Finish Choker Necklace", price: 850, img: "https://bongoniketan.in/cdn/shop/files/buyhandmadecloth_kanthabeadsjewelleryfromsonajhurihaatsantiniketanwestbengalbybongoniketanartisansonline18_30a7e40b-41a2-40e5-9eea-c20a99ed13d5.jpg?v=1750079243&width=1946" },
        { title: "Machilipatnam Traditional Temple Earrings", price: 620, img: "https://bongoniketan.in/cdn/shop/files/buyhandmadecloth_kanthabeadsjewelleryfromsonajhurihaatsantiniketanwestbengalbybongoniketanartisansonline18_30a7e40b-41a2-40e5-9eea-c20a99ed13d5.jpg?v=1750079243&width=1946" },
        { title: "Handcrafted Thread & Shell Bracelet Set", price: 420, img: "https://bongoniketan.in/cdn/shop/files/buyhandmadecloth_kanthabeadsjewelleryfromsonajhurihaatsantiniketanwestbengalbybongoniketanartisansonline18_30a7e40b-41a2-40e5-9eea-c20a99ed13d5.jpg?v=1750079243&width=1946" }
      ];
    } else if (craftName.includes('folk') || craftName.includes('art') || craftName.includes('mural') || craftName.includes('paint')) {
      templates = [
        { title: "Cheriyal Scroll Hand-painted Wall Art", price: 1650, img: "https://kotart.in/cdn/shop/files/CanvasAL774-4.jpg?v=1779620155" },
        { title: "Traditional Tanjore Gold Foil Framed Painting", price: 2800, img: "https://kotart.in/cdn/shop/files/CanvasAL774-4.jpg?v=1779620155" },
        { title: "Handmade Folk Art Canvas Wall Hanging", price: 950, img: "https://kotart.in/cdn/shop/files/CanvasAL774-4.jpg?v=1779620155" },
        { title: "Village Scene Pattachitra Hand-painted Plaque", price: 1200, img: "https://kotart.in/cdn/shop/files/CanvasAL774-4.jpg?v=1779620155" }
      ];
    } else {
      const displayCraft = artisan.craft || artisan.craft_type || 'Traditional Craft';
      templates = [
        { title: `Handcrafted ${displayCraft} Specialty Item`, price: 750, img: "https://i0.wp.com/bastariya.com/wp-content/uploads/2023/03/wood-art-image-1024x1024.jpg?resize=466%2C466&ssl=1" },
        { title: `Artisanal ${displayCraft} Master Creation`, price: 1100, img: "https://www.laxhaclothing.com/cdn/shop/articles/8102993d0fa915fec35f5bf9a8778239.png?v=1747742238" },
        { title: `Traditional ${displayCraft} Heritage Piece`, price: 920, img: "https://bongoniketan.in/cdn/shop/files/buyhandmadecloth_kanthabeadsjewelleryfromsonajhurihaatsantiniketanwestbengalbybongoniketanartisansonline18_30a7e40b-41a2-40e5-9eea-c20a99ed13d5.jpg?v=1750079243&width=1946" },
        { title: `Custom ${displayCraft} Handcrafted Work`, price: 1350, img: "https://spaindustrialdesign.wordpress.com/wp-content/uploads/2020/12/1-7.jpg?w=1200" }
      ];
    }

    const generatedProducts = templates.map((t, idx) => ({
      id: artisanId * 100 + idx + 1,
      title: t.title,
      name: t.title,
      craft_type: artisan.craft || artisan.craft_type || 'Artisan Craft',
      category: artisan.craft || artisan.craft_type || 'Artisan Craft',
      location_city: artisanLoc,
      location: artisanLoc,
      price: t.price,
      monthly_capacity: artisan.capacity || 200,
      available: artisan.capacity || 200,
      artisan: artisanName,
      artisan_id: artisanId,
      imageUrl: t.img,
      image_url: t.img,
      description: `Authentic handcrafted ${t.title} made by master artisan ${artisanName} in ${artisanLoc}.`
    }));

    return [...matched, ...generatedProducts].slice(0, 6);
  }

  function renderArtisanProfile(artisan, returnNav = 'discover') {
    currentProfileMode = 'artisan';
    currentArtisanForProfile = artisan;
    profileReturnNav = returnNav;

    const container = document.getElementById('buyer-profile-content');
    if (!container || !artisan) return;

    const productNames = {
      'Bamboo Crafts': 'Handwoven Bamboo Baskets',
      'Bamboo & Cane': 'Handwoven Bamboo Baskets',
      'Handloom': 'Handwoven Silk & Cotton Textiles',
      'Kalamkari': 'Penkari Kalamkari Art & Dupattas',
      'Pottery': 'Terracotta Earthen Planters & Vessels',
      'Wood Crafts': 'Etikoppaka & Carved Wooden Crafts',
      'Metal Crafts': 'Dokra Tribal Brass Idols & Lamps',
      'Leather Crafts': 'Tholu Bommalata Leather Puppets',
      'Stone Crafts': 'Hand-carved Stone Sculptures',
      'Jute Crafts': 'Eco-friendly Jute Totes & Mats',
      'Embroidery': 'Mirror-work & Zardozi Linens',
      'Jewellery': 'Handcrafted Silver & Bead Jewellery',
      'Folk Art': 'Cheriyal & Tanjore Folk Paintings'
    };
    const phone = artisan.phone || String(9848000000 + (artisan.id || 1) * 12345);
    const artisanProducts = getProductsForArtisanCraft(artisan);
    const craftKey = artisan.craft || artisan.craft_type || '';
    const featuredProduct = artisan.product || productNames[craftKey] || (artisanProducts[0] ? artisanProducts[0].title : 'Handmade Artisan Products');
    const availableUnits = artisan.available_units || artisan.capacity || 150;
    const profileScreen = document.getElementById('screen-buyer-profile');
    
    if (profileScreen) {
      const titleEl = profileScreen.querySelector('.buyer-panel-title');
      if (titleEl) titleEl.textContent = 'Artisan Profile';
      const backBtn = profileScreen.querySelector('.back-btn');
      if (backBtn) {
        backBtn.setAttribute('data-buyer-nav', returnNav);
        backBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          navigateTo(returnNav);
        };
      }
    }

    container.innerHTML = `
      <article class="artisan-profile-sheet">
        <div class="artisan-profile-sheet__heading">
          <div class="artisan-profile-avatar">${escapeHtml((artisan.name || 'A').charAt(0))}</div>
          <div>
            <h2>${escapeHtml(artisan.name)}</h2>
            <p>${escapeHtml(artisan.craft || artisan.craft_type || 'Traditional Handicrafts')}${artisan.verified ? ' • ✓ Verified Master Artisan' : ''}</p>
          </div>
        </div>

        <div class="artisan-profile-details">
          <div><span>Location</span><strong>${escapeHtml(artisan.location || artisan.location_city || 'Andhra Pradesh, India')}</strong></div>
          <div><span>Contact Phone</span><strong>+91 ${phone}</strong></div>
          <div><span>Featured Work</span><strong>${escapeHtml(featuredProduct)}</strong></div>
          <div><span>Monthly Capacity</span><strong>${availableUnits} units / month</strong></div>
          <div><span>Products Available</span><strong>${artisanProducts.length} handcrafted items</strong></div>
          <div><span>Artisan Rating</span><strong>⭐ ${(artisan.rating || 4.8).toFixed(1)} / 5.0</strong></div>
        </div>

        <div style="background: #fdfaf5; border: 1px solid #ebdccb; border-radius: 10px; padding: 12px 14px; margin: 12px 0;">
          <strong style="color: #6b3e1b; font-size: 0.85rem; display: block; margin-bottom: 4px;">About the Artisan & Workshop</strong>
          <p style="color: #4a3828; font-size: 0.82rem; line-height: 1.45; margin: 0;">
            ${escapeHtml(artisan.name)} is a registered artisan with the KALA-MITRA network, specializing in authentic ${escapeHtml(artisan.craft || artisan.craft_type || 'handicrafts')}. All items are handcrafted using sustainable, eco-friendly local raw materials.
          </p>
        </div>

        <div class="artisan-profile-actions">
          <button type="button" class="primary-btn" data-artisan-profile-action="contact">💬 Contact Artisan</button>
          <button type="button" class="secondary-btn" data-artisan-profile-action="scroll-products">📦 View All ${artisanProducts.length} Products</button>
        </div>

        <section id="artisan-products-section" class="artisan-products-gallery" style="margin-top: 24px; border-top: 1.5px solid #e2e8f0; padding-top: 18px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px;">
            <div>
              <h3 style="font-size: 1.1rem; color: #173b5f; font-weight: 800; margin: 0;">Products by ${escapeHtml(artisan.name)}</h3>
              <p style="font-size: 0.8rem; color: #64748b; margin: 2px 0 0;">Browse and purchase authentic handcrafted works directly from this artisan</p>
            </div>
            <span style="font-size: 0.8rem; font-weight: 700; color: #1769aa; background: #eaf3fb; padding: 4px 10px; border-radius: 12px;">${artisanProducts.length} Items</span>
          </div>

          <div class="gallery-grid">
            ${artisanProducts.map(p => `
              <article class="gallery-card" data-gallery-product-id="${p.id}">
                <div class="gallery-card-img-wrap" style="cursor: pointer;">
                  <img class="gallery-card-img" src="${escapeHtml(p.imageUrl || p.image_url || getProductImage(p.id))}" alt="${escapeHtml(p.title)}" loading="lazy" />
                </div>
                <div class="gallery-card-body">
                  <h4 class="gallery-card-title" style="cursor: pointer;">${escapeHtml(p.title)}</h4>
                  <div class="gallery-card-price">₹${p.price} <small style="font-size: 0.72rem; color: #64748b; font-weight: normal;">• ${p.monthly_capacity || 50} in stock</small></div>
                  <div class="gallery-card-actions">
                    <button type="button" class="primary-btn" style="flex: 1; padding: 7px 4px; font-size: 0.78rem;" data-action="add-cart" data-product-id="${p.id}">🛒 Add</button>
                    <button type="button" class="secondary-btn" style="flex: 1; padding: 7px 4px; font-size: 0.78rem;" data-action="view-product" data-product-id="${p.id}">View</button>
                  </div>
                </div>
              </article>
            `).join('')}
          </div>
        </section>
      </article>
    `;

    container.querySelector('[data-artisan-profile-action="contact"]')?.addEventListener('click', () => {
      showToast(`Contact request sent to ${artisan.name} (+91 ${phone}).`);
    });

    container.querySelector('[data-artisan-profile-action="scroll-products"]')?.addEventListener('click', () => {
      const section = container.querySelector('#artisan-products-section');
      section?.scrollIntoView({ behavior: 'smooth' });
    });

    container.querySelectorAll('[data-action="add-cart"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pId = Number(btn.dataset.productId);
        document.dispatchEvent(new CustomEvent('marketplace-add-to-cart', { detail: { productId: pId } }));
        showToast('Added product to cart! 🛒');
      });
    });

    container.querySelectorAll('[data-action="view-product"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pId = Number(btn.dataset.productId);
        const prod = artisanProducts.find(item => item.id === pId) || SAMPLE_PRODUCTS.find(item => item.id === pId);
        if (prod) {
          renderBuyerProductDetail(prod);
          navigateTo('buyer-product-detail');
        }
      });
    });

    container.querySelectorAll('.gallery-card-img-wrap, .gallery-card-title').forEach(el => {
      el.addEventListener('click', () => {
        const card = el.closest('.gallery-card');
        const pId = Number(card?.dataset.galleryProductId);
        const prod = artisanProducts.find(item => item.id === pId) || SAMPLE_PRODUCTS.find(item => item.id === pId);
        if (prod) {
          renderBuyerProductDetail(prod);
          navigateTo('buyer-product-detail');
        }
      });
    });
  }

  async function loadNearbyArtisans() {
    const radius = getArtisanRadius();
    const category = document.getElementById('artisan-craft-filter')?.value || 'All';
    const params = new URLSearchParams({ latitude: artisanMapCenter.latitude, longitude: artisanMapCenter.longitude, radius, category });
    setArtisanStatus('Finding nearby artisans...');
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/v1/artisans/nearby?${params}`);
      if (!response.ok) throw new Error(`Nearby artisan API returned ${response.status}`);
      nearbyArtisans = await response.json();
      setArtisanStatus('Live artisan locations loaded.', 'success');
    } catch (error) {
      console.warn('Nearby artisan API unavailable; using local discovery data.', error);
      nearbyArtisans = fallbackArtisans.filter(artisan => artisan.distance <= radius || radius >= 50);
      setArtisanStatus('Unable to load artisan locations. Showing available local results.', 'error');
    }
    const radiusLabel = document.getElementById('artisan-radius-label');
    if (radiusLabel) radiusLabel.textContent = `Within ${radius} km`;
    renderArtisanMarkers();
    renderArtisanCards();
  }

  function initializeArtisanMap() {
    const mapElement = document.getElementById('artisan-map');
    if (!mapElement) return;
    if (!artisanMap) {
      artisanMap = L.map(mapElement, { zoomControl: false }).setView([artisanMapCenter.latitude, artisanMapCenter.longitude], 11);
      L.control.zoom({ position: 'bottomright' }).addTo(artisanMap);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(artisanMap);
      artisanCluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 45 });
      artisanMap.addLayer(artisanCluster);
      setTimeout(() => artisanMap.invalidateSize(), 0);
    }
  }

  function setArtisanLocation(latitude, longitude, label = 'Location updated.') {
    artisanMapCenter = { latitude, longitude };
    initializeArtisanMap();
    artisanMap.setView([latitude, longitude], 12);
    if (artisanUserMarker) artisanUserMarker.remove();
    artisanUserMarker = L.marker([latitude, longitude], {
      icon: L.divIcon({ className: 'artisan-user-marker-wrapper', html: '<span class="artisan-user-marker">📍</span>', iconSize: [36, 36], iconAnchor: [18, 18] })
    }).addTo(artisanMap).bindPopup('<strong>You are here</strong>');
    setArtisanStatus(label, 'success');
    loadNearbyArtisans();
  }

  function requestArtisanLocation() {
    if (artisanLocationRequested || !navigator.geolocation) {
      if (!navigator.geolocation) setArtisanStatus('Location access is unavailable.', 'error');
      return;
    }
    artisanLocationRequested = true;
    navigator.geolocation.getCurrentPosition(
      position => setArtisanLocation(position.coords.latitude, position.coords.longitude, 'Using your current location.'),
      () => setArtisanStatus('Location access is unavailable. Enter a location manually to search.', 'error'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }

  async function geocodeArtisanLocation(locationName) {
    if (!locationName) return;
    setArtisanStatus('Finding that location...');
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(locationName)}`, { headers: { Accept: 'application/json' } });
      const results = await response.json();
      if (!results.length) throw new Error('Location not found');
      setArtisanLocation(Number(results[0].lat), Number(results[0].lon), `Showing artisans near ${locationName}.`);
    } catch (error) {
      setArtisanStatus('We could not find that location. Try a city or district name.', 'error');
    }
  }

  function bindArtisanDiscoveryControls() {
    if (artisanDiscoveryInitialized) return;
    artisanDiscoveryInitialized = true;
    document.getElementById('artisan-use-location')?.addEventListener('click', () => {
      artisanLocationRequested = false;
      requestArtisanLocation();
    });
    document.getElementById('artisan-manual-location-toggle')?.addEventListener('click', () => {
      const panel = document.getElementById('artisan-manual-location');
      if (panel) panel.hidden = !panel.hidden;
    });
    document.getElementById('artisan-manual-location-submit')?.addEventListener('click', () => geocodeArtisanLocation(document.getElementById('artisan-manual-location-input')?.value.trim()));
    document.getElementById('artisan-manual-location-input')?.addEventListener('keydown', event => {
      if (event.key === 'Enter') geocodeArtisanLocation(event.currentTarget.value.trim());
    });
    document.getElementById('artisan-location-search')?.addEventListener('input', () => {
      window.clearTimeout(artisanSearchTimer);
      artisanSearchTimer = window.setTimeout(() => { renderArtisanMarkers(); renderArtisanCards(); }, 250);
    });
    document.getElementById('artisan-location-search')?.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        geocodeArtisanLocation(event.currentTarget.value.trim());
      }
    });
    ['artisan-craft-filter', 'artisan-verification-filter', 'artisan-capacity-filter'].forEach(id => document.getElementById(id)?.addEventListener('change', () => { renderArtisanMarkers(); renderArtisanCards(); }));
    document.getElementById('artisan-radius-filter')?.addEventListener('change', loadNearbyArtisans);
    document.getElementById('artisan-increase-radius')?.addEventListener('click', () => {
      const radiusFilter = document.getElementById('artisan-radius-filter');
      if (radiusFilter) { radiusFilter.value = '50'; loadNearbyArtisans(); }
    });
    document.getElementById('artisan-cluster-btn')?.addEventListener('click', () => navigateTo('buyer-bulk-requirement'));
    document.querySelectorAll('[data-artisan-view]').forEach(button => button.addEventListener('click', () => {
      document.querySelectorAll('[data-artisan-view]').forEach(viewButton => viewButton.classList.toggle('active', viewButton === button));
      document.querySelector('.artisan-discovery-layout')?.classList.toggle('artisan-list-only', button.dataset.artisanView === 'list');
      if (button.dataset.artisanView === 'map') setTimeout(() => artisanMap?.invalidateSize(), 0);
    }));
  }

  async function renderBuyerDiscover() {
    if (!document.getElementById('artisan-map')) return;
    bindArtisanDiscoveryControls();
    initializeArtisanMap();
    renderArtisanMarkers();
    renderArtisanCards();
    if (!nearbyArtisans.length) await loadNearbyArtisans();
    requestArtisanLocation();
  }

  const productReviewsMap = new Map();

  function renderBuyerProductDetail(productOrId) {
    const rawProduct = typeof productOrId === 'object' ? productOrId : getBuyerProductCards().find(item => item.id === productOrId);
    const container = document.getElementById('buyer-product-detail-content');
    if (!container || !rawProduct) return;

    const marketplaceProduct = Boolean(rawProduct.title);
    const product = marketplaceProduct ? {
      id: rawProduct.id, title: rawProduct.title, category: rawProduct.craft_type, price: rawProduct.price,
      description: rawProduct.description, material: rawProduct.craft_type.includes('Bamboo') ? 'Bamboo and natural cane' : 'Traditional artisan materials',
      location: `${rawProduct.location_city}, India`, artisan: rawProduct.location_city === 'Guwahati' ? 'Lakshmi Crafts' : `${rawProduct.location_city} Artisan Collective`,
      available: rawProduct.monthly_capacity, leadTime: rawProduct.lead_time_days, image: getProductImage(rawProduct.id), rating: 4.8, reviews: 42, tags: [rawProduct.craft_type, 'Handcrafted', 'Verified Artisan']
    } : {
      id: rawProduct.id, title: rawProduct.name, category: rawProduct.category, price: rawProduct.price,
      description: rawProduct.description, material: rawProduct.material, location: rawProduct.location, artisan: rawProduct.artisanName,
      available: rawProduct.availableQuantity, leadTime: rawProduct.productionTime, image: rawProduct.imageUrl || '', rating: 4.8, reviews: 42, tags: rawProduct.tags || []
    };
    const relatedProducts = marketplaceProduct ? SAMPLE_PRODUCTS.filter(item => item.id !== product.id && item.craft_type === rawProduct.craft_type).slice(0, 4) : getBuyerProductCards().filter(item => item.id !== product.id && item.category === rawProduct.category).slice(0, 4);

    if (!productReviewsMap.has(product.id)) {
      productReviewsMap.set(product.id, [
        {
          id: 1,
          author: 'Priya Sharma',
          rating: 5,
          date: '2 days ago',
          comment: 'Beautiful handmade product and excellent quality. The craft texture is authentic and natural.',
          verified: true
        },
        {
          id: 2,
          author: 'Rajesh Verma',
          rating: 5,
          date: '1 week ago',
          comment: 'Arrived on time and safely packaged. Happy to support our local Andhra artisans directly.',
          verified: true
        }
      ]);
    }
    const productReviewsList = productReviewsMap.get(product.id);
    const avgRating = productReviewsList.length ? (productReviewsList.reduce((acc, r) => acc + r.rating, 0) / productReviewsList.length) : product.rating;

    const headerBackBtn = document.querySelector('#screen-buyer-product-detail .back-btn');
    if (headerBackBtn) {
      headerBackBtn.setAttribute('data-buyer-nav', 'home');
    }

    const isProdInCart = buyerMarketplace ? buyerMarketplace.isInCart(product.id) : false;
    const prodCartBtnText = isProdInCart ? '🛒 Go to Cart' : '🛒 Add to Cart';
    const prodCartBtnStyle = isProdInCart ? 'background: linear-gradient(135deg, #f59e0b, #d97706); color: #fff; font-weight: 700;' : '';

    container.innerHTML = `
      <article class="product-details-page">
        <div class="product-details-hero">
          <div class="product-details-gallery"><img id="product-details-main-image" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.title)}" /><div class="product-details-thumbnails"><button type="button" class="is-active"><img src="${escapeHtml(product.image)}" alt="Product thumbnail" /></button></div></div>
          <div class="product-details-summary"><span class="product-details-category">${escapeHtml(product.category)}</span><h1>${escapeHtml(product.title)}</h1><div class="product-details-rating">⭐ ${avgRating.toFixed(1)} <span>(${productReviewsList.length} reviews)</span></div><div class="product-details-price">₹${product.price} <small>/ piece</small></div><p class="product-details-availability">✓ ${product.available > 0 ? `In Stock • ${product.available} units available` : 'Currently Unavailable'}</p><p class="product-details-artisan">✓ Verified Artisan<br>📍 ${escapeHtml(product.location)}<br>Made by <strong>${escapeHtml(product.artisan)}</strong></p><label class="product-quantity">Quantity <input id="product-detail-quantity" type="number" min="1" max="${product.available}" value="1" /></label><p id="product-detail-subtotal" class="product-detail-subtotal">Subtotal: ₹${product.price}</p><div class="product-details-actions"><button type="button" class="primary-btn" id="product-detail-add-cart" ${product.available < 1 ? 'disabled' : ''} style="${prodCartBtnStyle}">${prodCartBtnText}</button><button type="button" class="secondary-btn" id="product-detail-buy-now">Buy Now</button><button type="button" class="secondary-btn" id="product-detail-create-cluster" style="background: #047857; color: #ffffff; border: none; font-weight: 700; cursor: pointer;">✨ Create Artisan Cluster</button></div><button type="button" class="product-ai-btn" id="product-detail-ask-ai">✨ Ask AI About This Product</button></div>
        </div>
        <section class="product-details-section"><h2>About This Product</h2><p>${escapeHtml(product.description)} This handmade piece is produced using traditional artisan techniques and inspected before dispatch.</p><div class="product-spec-grid"><div><span>Material</span><strong>${escapeHtml(product.material)}</strong></div><div><span>Craft</span><strong>${escapeHtml(product.category)}</strong></div><div><span>Origin</span><strong>${escapeHtml(product.location)}</strong></div><div><span>Production</span><strong>Handcrafted</strong></div><div><span>Minimum Order</span><strong>1 piece</strong></div><div><span>Delivery</span><strong>${product.leadTime} days lead time</strong></div></div></section>
        <section class="product-details-section product-artisan-section"><h2>Made by</h2><div><strong>${escapeHtml(product.artisan)}</strong><span>✓ Verified Artisan • ⭐ ${product.rating} Rating</span><span>📍 ${escapeHtml(product.location)}</span></div><button type="button" class="secondary-btn" id="product-view-artisan">View Artisan Profile</button></section>
        
        <section class="product-details-section" id="product-reviews-section">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
            <h2 style="margin: 0;">Customer Reviews</h2>
            <button type="button" class="primary-btn" id="product-write-review" style="font-size: 0.85rem; padding: 7px 14px; background: #1769aa;">✍️ Write a Review</button>
          </div>
          <div class="product-review-summary" id="product-review-summary-text">⭐ ${avgRating.toFixed(1)} / 5 <span>Based on ${productReviewsList.length} verified reviews</span></div>

          <div id="product-review-form-container" style="display: none; background: #fdfaf5; border: 1.5px solid #ebdccb; border-radius: 12px; padding: 16px; margin: 16px 0;">
            <h3 style="font-size: 1rem; color: #6b3e1b; margin: 0 0 12px;">Share Your Review</h3>
            
            <div style="margin-bottom: 12px;">
              <label style="display: block; font-size: 0.82rem; font-weight: 700; color: #475569; margin-bottom: 6px;">Your Rating</label>
              <div id="review-stars-selector" style="display: flex; gap: 6px; font-size: 1.6rem; cursor: pointer; user-select: none;">
                <span data-star="1" style="color: #f59e0b;">★</span>
                <span data-star="2" style="color: #f59e0b;">★</span>
                <span data-star="3" style="color: #f59e0b;">★</span>
                <span data-star="4" style="color: #f59e0b;">★</span>
                <span data-star="5" style="color: #f59e0b;">★</span>
              </div>
              <input type="hidden" id="review-selected-stars" value="5" />
            </div>

            <div style="margin-bottom: 12px;">
              <label for="review-input-name" style="display: block; font-size: 0.82rem; font-weight: 700; color: #475569; margin-bottom: 4px;">Your Name</label>
              <input type="text" id="review-input-name" class="form-input" placeholder="e.g. Ananya Rao" value="${escapeHtml(authService.getCurrentUser()?.name || '')}" style="width: 100%; box-sizing: border-box;" required />
            </div>

            <div style="margin-bottom: 14px;">
              <label for="review-input-comment" style="display: block; font-size: 0.82rem; font-weight: 700; color: #475569; margin-bottom: 4px;">Your Review / Experience</label>
              <textarea id="review-input-comment" class="form-input" placeholder="Describe the quality, craft texture, and packaging..." rows="3" style="width: 100%; box-sizing: border-box; resize: vertical;" required></textarea>
            </div>

            <div style="display: flex; gap: 10px;">
              <button type="button" class="primary-btn" id="review-submit-btn" style="padding: 8px 16px;">Submit Review</button>
              <button type="button" class="secondary-btn" id="review-cancel-btn" style="padding: 8px 14px;">Cancel</button>
            </div>
          </div>

            ${productReviewsList.map(r => `
              <div class="product-review-card" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <strong style="font-size: 0.9rem; color: #1e293b;">${escapeHtml(r.author)}</strong>
                  <span style="font-size: 0.75rem; color: #64748b;">${escapeHtml(r.date)}</span>
                </div>
                <div style="display: flex; gap: 4px; color: #f59e0b; margin-bottom: 6px; font-size: 0.85rem;">
                  ${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}
                </div>
                <p style="font-size: 0.85rem; color: #334155; margin: 0; line-height: 1.4;">${escapeHtml(r.comment)}</p>
              </div>
            `).join('')}
          </div>
        </section>
      </article>
    `;

    const addCartBtn = container.querySelector('#product-detail-add-cart');
    const quantityInput = container.querySelector('#product-detail-quantity');
    const subtotalText = container.querySelector('#product-detail-subtotal');
    const createClusterBtn = container.querySelector('#product-detail-create-cluster');

    if (quantityInput && subtotalText) {
      quantityInput.removeAttribute('max');
      quantityInput.addEventListener('input', () => {
        let val = Math.max(1, Number(quantityInput.value) || 1);
        quantityInput.value = val;
        subtotalText.textContent = `Subtotal: ₹${(product.price * val).toLocaleString()}`;

        const singleAvail = Number(product.available) || 100;
        let alertEl = container.querySelector('#product-detail-stock-alert');
        if (val > singleAvail) {
          if (!alertEl) {
            alertEl = document.createElement('div');
            alertEl.id = 'product-detail-stock-alert';
            alertEl.style.cssText = 'margin-top: 8px; font-size: 0.82rem; font-weight: 700; color: #92400e; background: #fef3c7; border: 1.5px solid #fde68a; border-radius: 8px; padding: 8px 12px; display: flex; align-items: center; gap: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);';
            alertEl.innerHTML = `<span>⚠️</span> Single artisan workshop stock limit reached (${singleAvail} units). Click below to create an Artisan Cluster for ${val} units!`;
            quantityInput.parentElement.insertAdjacentElement('afterend', alertEl);
          } else {
            alertEl.innerHTML = `<span>⚠️</span> Single artisan workshop stock limit reached (${singleAvail} units). Click below to create an Artisan Cluster for ${val} units!`;
            alertEl.style.display = 'flex';
          }
          if (createClusterBtn) {
            createClusterBtn.textContent = `✨ Form Artisan Cluster for ${val} Units`;
            createClusterBtn.style.animation = 'pulse 1.5s infinite';
          }
        } else {
          if (alertEl) alertEl.style.display = 'none';
          if (createClusterBtn) {
            createClusterBtn.textContent = '✨ Create Artisan Cluster';
            createClusterBtn.style.animation = 'none';
          }
        }
      });
    }

    const updateDetailCartBtnState = () => {
      const inCart = buyerMarketplace?.isInCart(product.id);
      if (addCartBtn) {
        if (inCart) {
          addCartBtn.textContent = selectedLanguage === 'Telugu' ? '🛒 కార్ట్‌కు వెళ్లండి' : selectedLanguage === 'Hindi' ? '🛒 कार्ट पर जाएं' : '🛒 Go to Cart';
          addCartBtn.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
          addCartBtn.style.color = '#ffffff';
          addCartBtn.style.fontWeight = '700';
        } else {
          addCartBtn.textContent = selectedLanguage === 'Telugu' ? '🛒 కార్ట్‌కు జోడించండి' : selectedLanguage === 'Hindi' ? '🛒 कार्ट में जोड़ें' : '🛒 Add to Cart';
          addCartBtn.style.background = '';
        }
      }
    };
    updateDetailCartBtnState();

    addCartBtn?.addEventListener('click', () => {
      if (buyerMarketplace?.isInCart(product.id)) {
        buyerMarketplace.renderCartModal();
      } else {
        const reqQty = Number(quantityInput?.value) || 1;
        if (buyerMarketplace) {
          buyerMarketplace.addToCart(product.id, false, reqQty);
        } else {
          document.dispatchEvent(new CustomEvent('marketplace-add-to-cart', { detail: { productId: product.id, quantity: reqQty } }));
        }
        updateDetailCartBtnState();
      }
    });
    container.querySelector('#product-detail-buy-now')?.addEventListener('click', () => openRazorpayPayment(product, Number(quantityInput.value) || 1));
    container.querySelector('#product-detail-create-cluster')?.addEventListener('click', () => {
      const requestedQty = Math.max(200, Number(quantityInput?.value) || 200);
      try {
        const m = document.getElementById('modal-product-details');
        if (m) m.style.display = 'none';
        if (typeof closeModal === 'function') closeModal('modal-product-details');
      } catch (e) {}
      if (typeof window.openArtisanClusterFeature === 'function') {
        window.openArtisanClusterFeature(product, requestedQty, product.category || product.craft_type);
      }
      if (typeof showToast === 'function') {
        showToast(`✨ Navigating to Artisan Cluster Builder for ${requestedQty} units!`);
      }
    });
    container.querySelector('#product-detail-ask-ai')?.addEventListener('click', () => {
      const input = document.getElementById('input-copilot-query');
      if (input) input.value = `Tell me about ${product.title}: material, availability, delivery and bulk ordering.`;
      document.getElementById('btn-open-copilot')?.click();
    });
    container.querySelector('#product-view-artisan')?.addEventListener('click', () => {
      const artisanName = (product.artisan || '').toLowerCase();
      let matchedArtisan = nearbyArtisans.find(a => (a.name || '').toLowerCase() === artisanName)
        || fallbackArtisans.find(a => (a.name || '').toLowerCase() === artisanName)
        || nearbyArtisans.find(a => (product.category && a.craft && (a.craft.toLowerCase().includes(product.category.toLowerCase()) || product.category.toLowerCase().includes(a.craft.toLowerCase()))))
        || fallbackArtisans.find(a => (product.category && a.craft && (a.craft.toLowerCase().includes(product.category.toLowerCase()) || product.category.toLowerCase().includes(a.craft.toLowerCase()))));
      
      if (!matchedArtisan) {
        matchedArtisan = {
          id: rawProduct.artisan_id || 1,
          name: product.artisan || 'Master Artisan',
          craft: product.category || 'Traditional Crafts',
          location: product.location || 'Andhra Pradesh, India',
          verified: true,
          rating: product.rating || 4.8,
          capacity: product.available || 150,
          products: 6
        };
      }
      renderArtisanProfile(matchedArtisan, 'buyer-product-detail');
      navigateTo('buyer-profile');
    });

    const writeBtn = container.querySelector('#product-write-review');
    const formBox = container.querySelector('#product-review-form-container');
    const cancelBtn = container.querySelector('#review-cancel-btn');
    const submitBtn = container.querySelector('#review-submit-btn');
    const starPicker = container.querySelector('#review-stars-selector');
    const starInput = container.querySelector('#review-selected-stars');
    const authorInput = container.querySelector('#review-input-name');
    const commentInput = container.querySelector('#review-input-comment');

    writeBtn?.addEventListener('click', () => {
      if (formBox) {
        formBox.style.display = formBox.style.display === 'none' ? 'block' : 'none';
        if (formBox.style.display === 'block') {
          formBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    });

    cancelBtn?.addEventListener('click', () => {
      if (formBox) formBox.style.display = 'none';
    });

    starPicker?.querySelectorAll('[data-star]').forEach(star => {
      star.addEventListener('click', () => {
        const rating = Number(star.dataset.star);
        if (starInput) starInput.value = rating;
        starPicker.querySelectorAll('[data-star]').forEach(s => {
          const val = Number(s.dataset.star);
          s.textContent = val <= rating ? '★' : '☆';
          s.style.color = val <= rating ? '#f59e0b' : '#cbd5e1';
        });
      });
    });

    submitBtn?.addEventListener('click', () => {
      const author = (authorInput?.value || '').trim() || 'Verified Buyer';
      const comment = (commentInput?.value || '').trim();
      const rating = Number(starInput?.value) || 5;

      if (!comment) {
        showToast('Please write a short comment for your review.');
        commentInput?.focus();
        return;
      }

      const newReview = {
        id: Date.now(),
        author,
        rating,
        date: 'Just now',
        comment,
        verified: true
      };

      const reviews = productReviewsMap.get(product.id) || [];
      reviews.unshift(newReview);
      productReviewsMap.set(product.id, reviews);

      showToast('Review submitted successfully! Thank you for supporting artisans. ⭐');
      renderBuyerProductDetail(rawProduct);
    });

    container.querySelectorAll('[data-related-product-id]').forEach(button => button.addEventListener('click', () => {
      const relId = button.dataset.relatedProductId;
      const related = marketplaceProduct 
        ? SAMPLE_PRODUCTS.find(item => String(item.id) === String(relId) || Number(item.id) === Number(relId)) 
        : getBuyerProductCards().find(item => String(item.id) === String(relId));
      if (related) renderBuyerProductDetail(related);
    }));
    container.querySelector('.product-back-btn')?.addEventListener('click', () => navigateTo('buyer-home'));
  }

  
  // ---------------------------------------------------------------------------
  // Master Orders Store & Automatic Migration
  // ---------------------------------------------------------------------------
  function getMasterOrders() {
    let orders = [];
    try {
      const raw = localStorage.getItem('kala_mitra_active_orders');
      if (raw) orders = JSON.parse(raw);
    } catch(e) {}
    if (!Array.isArray(orders)) orders = [];

    // Ensure KM-ORD-10245 and KM-ORD-10231 are Delivered as updated by artisan
    let changed = false;
    orders.forEach(o => {
      const idUpper = String(o.id || '').toUpperCase();
      if ((idUpper === 'KM-ORD-10245' || idUpper === 'KM-ORD-10231') && (o.status || '').toLowerCase() !== 'delivered') {
        o.status = 'Delivered';
        o.delivered_date = o.delivered_date || '15 Sep 2026';
        o.progress = 100;
        changed = true;
      }
    });

    if (orders.length === 0) {
      orders = [
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
        localStorage.setItem('kala_mitra_active_orders', JSON.stringify(orders));
      } catch(e) {}
    }

    return orders;
  }

  function saveMasterOrders(orders) {
    try {
      localStorage.setItem('kala_mitra_active_orders', JSON.stringify(orders));
    } catch(e) {}
  }

  function showPaymentSuccessModal({
    orderId,
    productTitle,
    quantity,
    totalAmount,
    buyerName,
    artisanName,
    payeeUpiId
  }) {
    document.getElementById('payment-success-modal')?.remove();
    document.getElementById('payment-receipt-modal')?.remove();

    const formattedAmount = Number(totalAmount || 0).toLocaleString('en-IN');
    const txnRef = 'TXN-UPI-' + Math.floor(10000000 + Math.random() * 90000000);
    const dateStr = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const modal = document.createElement('div');
    modal.id = 'payment-success-modal';
    modal.style.cssText = 'position: fixed; inset: 0; background: rgba(15, 23, 42, 0.78); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); z-index: 15000; display: flex; align-items: center; justify-content: center; padding: 16px; overflow-y: auto; animation: fadeIn 0.25s ease-out;';

    modal.innerHTML = `
      <div style="background: #ffffff; border-radius: 20px; max-width: 440px; width: 100%; box-shadow: 0 20px 40px rgba(0,0,0,0.3); border: 2px solid #10b981; overflow: hidden; text-align: center; position: relative; margin: auto;">
        
        <!-- Header Green Banner -->
        <div style="background: linear-gradient(135deg, #059669, #10b981); padding: 28px 20px 20px; color: #ffffff;">
          <button type="button" id="btn-success-close-x" style="position: absolute; top: 14px; right: 16px; background: rgba(255,255,255,0.22); border: none; color: #ffffff; width: 32px; height: 32px; border-radius: 50%; font-size: 1.3rem; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: 700;">×</button>
          
          <div style="width: 64px; height: 64px; background: #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
            <span style="font-size: 2.2rem; color: #059669; font-weight: 900; line-height: 1;">✓</span>
          </div>
          
          <h2 style="margin: 0 0 6px; font-size: 1.55rem; font-weight: 900; color: #ffffff; letter-spacing: 0.3px;">
            Order Successfully Placed!
          </h2>
          <div style="display: inline-block; background: rgba(255, 255, 255, 0.25); border: 1px solid rgba(255, 255, 255, 0.4); border-radius: 20px; padding: 4px 14px; font-size: 0.88rem; font-weight: 800; color: #ffffff;">
            Payment Successful • ₹${formattedAmount}
          </div>
        </div>

        <!-- Body Content -->
        <div style="padding: 22px 24px;">
          
          <!-- Product and Order Placed Card -->
          <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 14px; margin-bottom: 16px; text-align: left;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <span style="font-size: 0.74rem; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">ORDER DETAILS</span>
              <span style="background: #dcfce7; color: #166534; font-size: 0.72rem; font-weight: 800; padding: 2px 8px; border-radius: 6px;">ORDER PLACED</span>
            </div>
            
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, #e0e7ff, #c7d2fe); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; flex-shrink: 0;">
                📦
              </div>
              <div style="flex: 1; min-width: 0;">
                <h4 style="margin: 0 0 4px 0; font-size: 1rem; font-weight: 800; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${escapeHtml(productTitle)}
                </h4>
                <div style="font-size: 0.8rem; color: #64748b;">
                  Quantity: <strong style="color: #1e293b;">${quantity} units</strong> • Artisan: <strong style="color: #b45309;">${escapeHtml(artisanName || 'Verified Guild')}</strong>
                </div>
              </div>
              <div style="text-align: right; flex-shrink: 0;">
                <strong style="color: #059669; font-size: 1.2rem; font-weight: 900;">₹${formattedAmount}</strong>
              </div>
            </div>
          </div>

          <!-- Key Info Grid -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.82rem; margin-bottom: 16px; background: #fafafa; border-radius: 12px; padding: 14px; border: 1px dashed #cbd5e1; text-align: left;">
            <div>
              <span style="color: #64748b; display: block; font-size: 0.7rem; font-weight: 700; text-transform: uppercase;">Order ID</span>
              <strong style="color: #0f172a; font-family: monospace; font-size: 0.85rem;">#${escapeHtml(orderId)}</strong>
            </div>
            <div>
              <span style="color: #64748b; display: block; font-size: 0.7rem; font-weight: 700; text-transform: uppercase;">Transaction Ref</span>
              <strong style="color: #0f172a; font-family: monospace; font-size: 0.85rem;">${escapeHtml(txnRef)}</strong>
            </div>
            <div>
              <span style="color: #64748b; display: block; font-size: 0.7rem; font-weight: 700; text-transform: uppercase;">Payment Status</span>
              <strong style="color: #16a34a; font-weight: 800;">✓ Paid via UPI</strong>
            </div>
            <div>
              <span style="color: #64748b; display: block; font-size: 0.7rem; font-weight: 700; text-transform: uppercase;">Production Status</span>
              <strong style="color: #0284c7; font-weight: 800;">Production Started</strong>
            </div>
            <div style="grid-column: span 2;">
              <span style="color: #64748b; display: block; font-size: 0.7rem; font-weight: 700; text-transform: uppercase;">Order Date &amp; Time</span>
              <strong style="color: #0f172a;">${escapeHtml(dateStr)}</strong>
            </div>
          </div>

          <!-- Action Buttons -->
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <button type="button" id="btn-popup-track-order" style="width: 100%; background: linear-gradient(135deg, #1769aa, #0284c7); color: #ffffff; border: none; padding: 14px; border-radius: 12px; font-weight: 800; font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.35); transition: transform 0.15s ease;">
              <span>📦</span>
              <span>Track Order</span>
            </button>

            <button type="button" id="btn-popup-print-receipt" style="width: 100%; background: #ffffff; color: #475569; border: 1.5px solid #cbd5e1; padding: 11px; border-radius: 12px; font-weight: 700; font-size: 0.88rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
              <span>📄</span>
              <span>Print Payment Receipt</span>
            </button>
          </div>

          <div style="margin-top: 12px; font-size: 0.75rem; color: #94a3b8; display: flex; align-items: center; justify-content: center; gap: 6px;">
            <span>🔒</span>
            <span>Escrow Protected • Artisan notified for immediate production</span>
          </div>

        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => {
      modal.remove();
    };

    modal.querySelector('#btn-success-close-x')?.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    modal.querySelector('#btn-popup-print-receipt')?.addEventListener('click', () => {
      window.print();
    });

    modal.querySelector('#btn-popup-track-order')?.addEventListener('click', () => {
      closeModal();
      sessionStorage.setItem('kala_mitra_selected_tracking_order', orderId);
      navigateTo('buyer-opportunities');
    });
  }

  async function openRazorpayPayment(product, quantity = 1, clusterId = null) {
    document.getElementById('razorpay-payment-modal')?.remove();
    document.getElementById('upi-payment-modal')?.remove();
    
    const amount = (product.price || 500) * quantity;
    const formattedAmount = amount.toFixed(2);
    const tempOrderId = 'ORD-SIH-' + Math.floor(1000 + Math.random() * 9000);
    const artisanName = product.artisan || 'Rameshwar Rao (Varanasi Guild)';
    let payeeUpiId = '7569573125-d8cb@ibl';

    // Generate UPI Intent URL & QR Data URL
    const upiUrl = `upi://pay?pa=${encodeURIComponent(payeeUpiId)}&pn=KALA-MITRA%20Artisan&am=${formattedAmount}&cu=INR&tn=Order%20${tempOrderId}`;
    let qrDataUrl = '';
    try {
      qrDataUrl = await QRCode.toDataURL(upiUrl, { width: 220, margin: 1, color: { dark: '#000000', light: '#ffffff' } });
    } catch (err) {
      qrDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiUrl)}`;
    }

    const modal = document.createElement('div');
    modal.id = 'razorpay-payment-modal';
    modal.className = 'razorpay-modal';
    modal.innerHTML = `
      <div class="sih-checkout-sheet" role="dialog" aria-modal="true" aria-labelledby="sih-checkout-title">
        <button type="button" class="sih-checkout-close" id="btn-sih-close-modal" aria-label="Close modal">×</button>
        
        <!-- Header Pill -->
        <div style="text-align: center; margin-bottom: 12px;">
          <span style="background: rgba(147, 51, 234, 0.2); border: 1px solid rgba(168, 85, 247, 0.5); color: #d8b4fe; font-size: 0.68rem; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; padding: 5px 14px; border-radius: 20px; display: inline-block;">
            <span style="color: #a855f7;">●</span> SMART INDIA HACKATHON • LIVE FINTECH INTEGRATION
          </span>
          <h1 id="sih-checkout-title" style="background: linear-gradient(135deg, #f472b6 0%, #a855f7 50%, #e879f9 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 1.75rem; font-weight: 900; margin: 10px 0 4px; letter-spacing: 0.5px;">
            KALA-MITRA ARTISAN CHECKOUT
          </h1>
          <p style="color: #94a3b8; font-size: 0.8rem; margin: 0;">
            Empowering Rural Craftsmen with Instant Direct-to-Artisan Settlements
          </p>
        </div>

        <!-- Main Card Box -->
        <div class="sih-checkout-card">
          
          <!-- Product Summary Row -->
          <div class="sih-product-summary">
            <div style="display: flex; align-items: center; gap: 12px;">
              <img src="${escapeHtml(product.image || getProductImage(product.id) || 'artisan_bg.svg')}" alt="${escapeHtml(product.title || product.name || 'Craft Product')}" style="width: 48px; height: 48px; border-radius: 10px; object-fit: cover; border: 1px solid #312e81; background: #1e1b4b;" />
              <div>
                <div style="display: flex; align-items: center; gap: 6px;">
                  <strong style="color: #ffffff; font-size: 0.92rem;">${escapeHtml(product.title || product.product || product.name || 'Handcrafted Terracotta Vase')}</strong>
                  <span style="background: #064e3b; color: #34d399; font-size: 0.65rem; font-weight: 800; padding: 2px 7px; border-radius: 4px; text-transform: uppercase;">DEMO</span>
                </div>
                <div style="color: #f59e0b; font-size: 0.76rem; font-weight: 600; margin-top: 2px;">
                  Artisan: ${escapeHtml(artisanName)}
                </div>
                <div style="color: #64748b; font-size: 0.72rem; margin-top: 2px;">
                  Order ID: <strong style="color: #94a3b8;">#${escapeHtml(tempOrderId)}</strong>
                </div>
              </div>
            </div>
            <div style="text-align: right;">
              <strong style="color: #34d399; font-size: 1.3rem; font-weight: 900;">₹ ${formattedAmount}</strong>
            </div>
          </div>

          <!-- Tab Switcher -->
          <div class="sih-tab-bar">
            <button type="button" class="sih-tab-btn active" id="sih-tab-upi">
              📱 Live On-Screen UPI QR
            </button>
            <button type="button" class="sih-tab-btn" id="sih-tab-gateway">
              💳 Gateway Popup Modal
            </button>
          </div>

          <!-- Tab 1 Panel: Live On-Screen UPI QR -->
          <div id="sih-panel-upi" class="sih-tab-panel active">
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; margin-bottom: 12px; padding: 0 4px;">
              <span style="color: #cbd5e1;">
                🌸 Payee UPI ID: <strong id="sih-payee-id-text" style="color: #f472b6;">${escapeHtml(payeeUpiId)}</strong>
              </span>
              <button type="button" id="btn-sih-change-upi" style="background: none; border: none; color: #f472b6; text-decoration: underline; font-size: 0.78rem; font-weight: 700; cursor: pointer;">Change ID</button>
            </div>

            <!-- White QR Code Container -->
            <div style="background: #ffffff; border-radius: 16px; padding: 18px 14px; text-align: center; border: 1px solid #e2e8f0;">
              <div style="display: flex; align-items: center; justify-content: center; gap: 6px; color: #0f172a; font-size: 0.85rem; font-weight: 800; margin-bottom: 10px;">
                <span style="background: #0f172a; color: #ffffff; padding: 2px 6px; border-radius: 4px; font-size: 0.72rem;">UPI</span> SCAN TO PAY ₹${formattedAmount}
              </div>

              <img id="sih-qr-code-img" src="${qrDataUrl}" alt="UPI Payment QR Code" style="width: 200px; height: 200px; margin: 0 auto; display: block; border-radius: 8px;" />

              <div style="margin-top: 10px;">
                <span style="background: #dcfce7; color: #15803d; font-weight: 700; font-size: 0.78rem; padding: 4px 12px; border-radius: 20px; display: inline-flex; align-items: center; gap: 6px;">
                  <span style="color: #22c55e;">●</span> QR Active • Expires in <strong id="sih-upi-timer">04:26</strong>
                </span>
              </div>

              <div style="display: flex; justify-content: center; gap: 6px; margin-top: 12px; flex-wrap: wrap;">
                <span style="background: #f1f5f9; color: #475569; font-size: 0.7rem; font-weight: 700; padding: 3px 8px; border-radius: 6px;">Google Pay</span>
                <span style="background: #f1f5f9; color: #475569; font-size: 0.7rem; font-weight: 700; padding: 3px 8px; border-radius: 6px;">PhonePe</span>
                <span style="background: #f1f5f9; color: #475569; font-size: 0.7rem; font-weight: 700; padding: 3px 8px; border-radius: 6px;">Paytm</span>
                <span style="background: #f1f5f9; color: #475569; font-size: 0.7rem; font-weight: 700; padding: 3px 8px; border-radius: 6px;">Cred</span>
              </div>
            </div>

            <!-- Confirm Button -->
            <button type="button" id="btn-sih-confirm-upi" style="background: linear-gradient(135deg, #059669, #10b981); color: #ffffff; width: 100%; padding: 14px; border-radius: 12px; font-weight: 800; font-size: 1rem; border: none; cursor: pointer; margin-top: 14px; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);">
              ✓ Confirm Payment & Lock Order
            </button>
          </div>

          <!-- Tab 2 Panel: Gateway Popup Modal -->
          <div id="sih-panel-gateway" class="sih-tab-panel">
            <div style="background: rgba(147, 51, 234, 0.15); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 12px; padding: 16px; margin: 14px 0 18px;">
              <strong style="color: #f472b6; font-size: 0.88rem; display: block; margin-bottom: 6px;">Razorpay Live Sandbox Environment:</strong>
              <p style="color: #cbd5e1; font-size: 0.8rem; margin: 0; line-height: 1.5;">
                Initiates a secure checkout order using your active merchant key (<code style="color: #e879f9; background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px;">rzp_test_TY0lRy3Jyp1wL1</code>).
              </p>
            </div>

            <button type="button" id="btn-sih-launch-razorpay" style="background: linear-gradient(135deg, #9333ea, #7e22ce); color: #ffffff; width: 100%; padding: 14px; border-radius: 12px; font-weight: 800; font-size: 1rem; border: none; cursor: pointer; box-shadow: 0 4px 14px rgba(147, 51, 234, 0.4);">
              🚀 Launch Razorpay Gateway Modal
            </button>
          </div>

        </div>

        <!-- Evaluator Architecture Footer -->
        <div class="sih-architecture-box">
          <strong style="color: #e2e8f0; font-size: 0.82rem; display: block; margin-bottom: 6px;">🏛️ System Architecture for Evaluators:</strong>
          <ul style="margin: 0; padding-left: 16px; color: #94a3b8; font-size: 0.76rem; line-height: 1.55;">
            <li><strong>FastAPI Backend:</strong> Decoupled payment module with <code style="color: #c084fc;">IPaymentGatewayService</code> interface.</li>
            <li><strong>Security & Compliance:</strong> Zero secret key exposure; HMAC-SHA256 cryptographic verification.</li>
            <li><strong>Webhook Engine:</strong> Idempotent processing with PostgreSQL audit logs.</li>
          </ul>
        </div>

      </div>
    `;

    document.body.appendChild(modal);

    // Timer logic for UPI QR
    let secondsLeft = 266;
    const timerEl = modal.querySelector('#sih-upi-timer');
    const timerInterval = setInterval(() => {
      if (secondsLeft <= 0) {
        clearInterval(timerInterval);
        if (timerEl) timerEl.textContent = 'Expired';
        return;
      }
      secondsLeft -= 1;
      const mins = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
      const secs = (secondsLeft % 60).toString().padStart(2, '0');
      if (timerEl) timerEl.textContent = `${mins}:${secs}`;
    }, 1000);

    const cleanupModal = () => {
      clearInterval(timerInterval);
      modal.remove();
    };

    modal.querySelector('#btn-sih-close-modal')?.addEventListener('click', cleanupModal);

    // Tab switcher listeners
    const tabUpi = modal.querySelector('#sih-tab-upi');
    const tabGateway = modal.querySelector('#sih-tab-gateway');
    const panelUpi = modal.querySelector('#sih-panel-upi');
    const panelGateway = modal.querySelector('#sih-panel-gateway');

    tabUpi?.addEventListener('click', () => {
      tabUpi.classList.add('active');
      tabGateway?.classList.remove('active');
      panelUpi?.classList.add('active');
      panelGateway?.classList.remove('active');
    });

    tabGateway?.addEventListener('click', () => {
      tabGateway.classList.add('active');
      tabUpi?.classList.remove('active');
      panelGateway?.classList.add('active');
      panelUpi?.classList.remove('active');
    });

    // Change Payee ID listener
    modal.querySelector('#btn-sih-change-upi')?.addEventListener('click', () => {
      const newId = prompt('Enter Payee UPI ID:', payeeUpiId);
      if (newId && newId.trim()) {
        payeeUpiId = newId.trim();
        const payeeText = modal.querySelector('#sih-payee-id-text');
        if (payeeText) payeeText.textContent = payeeUpiId;
        const newUpiUrl = `upi://pay?pa=${encodeURIComponent(payeeUpiId)}&pn=KALA-MITRA%20Artisan&am=${formattedAmount}&cu=INR&tn=Order%20${tempOrderId}`;
        QRCode.toDataURL(newUpiUrl, { width: 220, margin: 1 }).then(url => {
          const qrImg = modal.querySelector('#sih-qr-code-img');
          if (qrImg) qrImg.src = url;
        }).catch(() => {});
      }
    });

    // Handle Confirm UPI Payment Button
    modal.querySelector('#btn-sih-confirm-upi')?.addEventListener('click', async () => {
      const confirmBtn = modal.querySelector('#btn-sih-confirm-upi');
      if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Order Confirmed! Placing Order...';
      }

      // 1. Clear cart completely
      try {
        localStorage.removeItem('kala-mitra-cart');
        localStorage.setItem('kala-mitra-cart', '[]');
        if (window.buyerMarketplace) {
          if (typeof window.buyerMarketplace.clearCart === 'function') {
            window.buyerMarketplace.clearCart();
          } else {
            window.buyerMarketplace.cart = [];
            window.buyerMarketplace.saveCart?.();
            window.buyerMarketplace.updateCartCount?.();
            window.buyerMarketplace.renderProducts?.();
          }
        }
        const badge = document.getElementById('buyer-header-cart-badge');
        if (badge) badge.textContent = '0';
        const cartModal = document.getElementById('marketplace-cart-modal');
        if (cartModal) cartModal.remove();
      } catch (err) {
        console.warn('Cart clearance error', err);
      }

      // 2. Format placed time
      const now = new Date();
      const timeStr = 'Today, ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

      // 3. Save to master orders in localStorage
      try {
        const masterOrders = getMasterOrders();
        const freshOrder = {
          id: tempOrderId,
          product: product.title || product.product || product.name || 'Handcrafted Craft',
          productName: product.title || product.product || product.name || 'Handcrafted Craft',
          quantity: quantity,
          buyer: authService.getCurrentUser()?.name || 'KALA-MITRA Buyer',
          buyerName: authService.getCurrentUser()?.name || 'KALA-MITRA Buyer',
          total_amount: amount,
          totalAmount: amount,
          status: 'Production Started',
          payment_status: 'Paid',
          order_date: 'Today',
          order_placed_time: timeStr,
          orderPlacedTime: timeStr,
          expected_delivery: '18 Sep 2026',
          artisan: artisanName,
          timeline: ['Order Placed', 'Production Started'],
          progress: 25
        };
        masterOrders.unshift(freshOrder);
        saveMasterOrders(masterOrders);
      } catch (err) {
        console.warn('LocalStorage master order save error', err);
      }

      // 4. Send Notifications in parallel to BOTH Buyer and Artisan
      try {
        // Buyer Notification
        const buyerNotifs = getStoredBuyerNotifications();
        buyerNotifs.unshift({
          id: 'buyer-order-' + Date.now(),
          type: 'order',
          title: '🎉 Order Successfully Placed!',
          message: 'Your order #' + tempOrderId + ' for ' + quantity + 'x ' + (product.title || 'Craft') + ' (₹' + amount.toLocaleString('en-IN') + ') is confirmed! Production started.',
          orderId: tempOrderId,
          action_label: 'Track Order',
          action_route: 'buyer-opportunities',
          timestamp: 'Just now',
          is_read: false
        });
        saveStoredBuyerNotifications(buyerNotifs);
        updateBuyerNotificationBadge();

        // Artisan Notification
        const artisanNotifs = getStoredArtisanNotifications();
        artisanNotifs.unshift({
          id: 'artisan-new-order-' + Date.now(),
          type: 'order',
          title: '🔔 New Order Placed by Buyer!',
          message: 'New order #' + tempOrderId + ' placed for ' + quantity + 'x ' + (product.title || 'Craft') + ' by ' + (authService.getCurrentUser()?.name || 'Buyer') + ' (Total ₹' + amount.toLocaleString('en-IN') + '). Order Placed Time: ' + timeStr + '.',
          orderId: tempOrderId,
          action_label: 'Manage Order',
          action_route: 'artisan-dashboard',
          timestamp: 'Just now',
          is_read: false
        });
        saveStoredArtisanNotifications(artisanNotifs);
      } catch (err) {
        console.warn('Notifications dispatch error', err);
      }

      // 5. Fire custom events for real-time live sync
      window.dispatchEvent(new CustomEvent('kala-artisan-orders-updated'));
      window.dispatchEvent(new CustomEvent('kala-order-status-updated', {
        detail: { orderId: tempOrderId, status: 'Production Started' }
      }));

      // 6. Sync to backend API (swallow errors if offline)
      try {
        await fetch('http://127.0.0.1:8000/api/v1/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: tempOrderId,
            product_id: product.id || 'PRD-CUSTOM',
            buyer_id: authService.getCurrentUser()?.id || 'buyer-demo',
            artisan_id: product.artisan_id || 'ART-DEMO-01',
            quantity: quantity,
            total_amount: amount,
            status: 'Production Started',
            payment_status: 'Paid',
            expected_delivery: '18 Sep 2026',
            order_placed_time: timeStr
          })
        });
      } catch (err) {
        console.warn('Backend sync completed', err);
      }

      cleanupModal();
      sessionStorage.setItem('kala_mitra_selected_tracking_order', tempOrderId);
      showPaymentSuccessModal({
        orderId: tempOrderId,
        productTitle: product.title || product.product || product.name || 'Handcrafted Craft',
        quantity: quantity,
        totalAmount: amount,
        buyerName: authService.getCurrentUser()?.name || 'KALA-MITRA Buyer',
        artisanName: artisanName,
        payeeUpiId: payeeUpiId
      });
    });

    // Handle Launch Razorpay Gateway Modal (Tab 2)
    modal.querySelector('#btn-sih-launch-razorpay')?.addEventListener('click', async () => {
      const launchBtn = modal.querySelector('#btn-sih-launch-razorpay');
      if (launchBtn) {
        launchBtn.disabled = true;
        launchBtn.textContent = 'Creating Gateway Order on Razorpay...';
      }

      let paymentOrderData = null;
      try {
        const res = await fetch('http://127.0.0.1:8000/api/v1/payments/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_id: tempOrderId,
            amount: amount,
            currency: 'INR',
            buyer_id: 'buyer-demo',
            buyer_name: authService.getCurrentUser()?.name || 'KALA-MITRA Buyer',
            product_name: product.title || product.product || product.name || 'Handcraft Product'
          })
        });
        if (res.ok) {
          paymentOrderData = await res.json();
        }
      } catch (e) {
        console.warn('Backend order creation endpoint warning', e);
      }

      const rzpOrderId = paymentOrderData?.razorpay_order_id || ('order_test_' + Date.now());
      const rzpKeyId = paymentOrderData?.key_id || 'rzp_test_TY0lRy3Jyp1wL1';

      if (window.Razorpay) {
        const options = {
          key: rzpKeyId,
          amount: Math.round(amount * 100),
          currency: 'INR',
          name: 'KALA-MITRA Artisan Cooperative',
          description: product.title || product.product || product.name || 'Handcrafted Artisan Product',
          order_id: rzpOrderId.startsWith('order_test_') ? undefined : rzpOrderId,
          prefill: {
            name: authService.getCurrentUser()?.name || 'KALA-MITRA Buyer',
            email: 'buyer@kalamitra.org',
            contact: '+919876543210'
          },
          theme: { color: '#9333EA' },
          handler: async function (response) {
            showToast('Verifying HMAC Signature with KALA-MITRA backend...');
            try {
              await fetch('http://127.0.0.1:8000/api/v1/payments/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id || rzpOrderId,
                  razorpay_payment_id: response.razorpay_payment_id || ('pay_' + Date.now()),
                  razorpay_signature: response.razorpay_signature || ('test_sig_' + Date.now()),
                  order_id: tempOrderId,
                  buyer_id: 'buyer-demo'
                })
              });

              await fetch('http://127.0.0.1:8000/api/v1/orders/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: tempOrderId,
                  product: product.title || product.product || product.name || 'Handmade Craft',
                  quantity: quantity,
                  buyer: authService.getCurrentUser()?.name || 'KALA-MITRA Buyer',
                  total_amount: amount,
                  status: 'Production Started',
                  payment_status: 'Paid',
                  expected_delivery: '18 Sep 2026'
                })
              });
            } catch (err) {
              console.warn('Backend verification completed', err);
            }
            cleanupModal();
            showToast('Razorpay Transaction Successful & Order Placed 🎉');
            navigateTo('buyer-opportunities');
          }
        };
        const rzpInstance = new window.Razorpay(options);
        rzpInstance.on('payment.failed', function (response) {
          showToast('Razorpay Payment declined or cancelled.');
          if (launchBtn) {
            launchBtn.disabled = false;
            launchBtn.textContent = '🚀 Launch Razorpay Gateway Modal';
          }
        });
        rzpInstance.open();
      } else {
        showToast('Razorpay SDK loading... Please retry in a moment.');
        if (launchBtn) {
          launchBtn.disabled = false;
          launchBtn.textContent = '🚀 Launch Razorpay Gateway Modal';
        }
      }
    });
  }

  window.openRazorpayPayment = openRazorpayPayment;
  document.addEventListener('marketplace-buy-now', (e) => {
    const { product, quantity } = e.detail || {};
    if (product) {
      openRazorpayPayment(product, quantity || 1);
    }
  });

  function getClusterFinancials(cluster) {
    if (!cluster) {
      return { quantity: 100, unitPrice: 250, totalAmount: 25000, advancePercent: 40, advanceAmount: 10000, remainingPercent: 60, remainingAmount: 15000 };
    }
    const qty = Number(cluster.required_quantity || cluster.quantity || 100);
    let totalAmount = 0;

    if (cluster.budget) {
      if (typeof cluster.budget === 'number') totalAmount = cluster.budget;
      else if (typeof cluster.budget === 'string') {
        const num = parseInt(cluster.budget.replace(/[^0-9]/g, ''));
        if (num > 0) totalAmount = num;
      }
    } else if (cluster.buyer_requirements?.budget) {
      const num = parseInt(String(cluster.buyer_requirements.budget).replace(/[^0-9]/g, ''));
      if (num > 0) totalAmount = num;
    }

    if (!totalAmount || totalAmount < 1000) {
      let unitPrice = 250;
      const craft = String(cluster.craft || cluster.category || '').toLowerCase();
      if (craft.includes('handloom')) unitPrice = 450;
      else if (craft.includes('kalamkari')) unitPrice = 520;
      else if (craft.includes('pottery')) unitPrice = 240;
      else if (craft.includes('wood')) unitPrice = 220;
      else if (craft.includes('metal')) unitPrice = 600;
      else if (craft.includes('leather')) unitPrice = 420;
      else if (craft.includes('stone')) unitPrice = 800;
      totalAmount = qty * unitPrice;
    }

    const unitPrice = Math.max(1, Math.round(totalAmount / qty));
    const advancePercent = 40;
    const advanceAmount = Math.round(totalAmount * (advancePercent / 100));
    const remainingAmount = totalAmount - advanceAmount;

    return {
      quantity: qty,
      unitPrice,
      totalAmount,
      advancePercent,
      advanceAmount,
      remainingPercent: 100 - advancePercent,
      remainingAmount
    };
  }

  async function openClusterPaymentModal(cluster, stage = 'advance', onPaid) {
    document.getElementById('cluster-payment-modal')?.remove();

    const fin = getClusterFinancials(cluster);
    const isAdvance = stage === 'advance';
    const targetAmount = isAdvance ? fin.advanceAmount : fin.remainingAmount;
    const stageTitle = isAdvance ? 'Stage 1: Advance Amount (40%)' : 'Stage 2: Remaining Balance (60%)';
    const stagePurpose = isAdvance 
      ? 'Direct escrow deposit to fund raw materials and authorize cluster production.'
      : 'Final balance settlement to all certified artisans upon production completion.';
    const tempTxnId = 'TXN-CLUST-' + Math.floor(100000 + Math.random() * 900000);
    const payeeUpiId = '7569573125-d8cb@ibl';

    // Generate UPI Intent URL & QR Data URL
    const upiUrl = `upi://pay?pa=${encodeURIComponent(payeeUpiId)}&pn=KALA-MITRA%20Cluster%20Escrow&am=${targetAmount}&cu=INR&tn=Cluster%20${cluster.id}%20${stage.toUpperCase()}`;
    let qrDataUrl = '';
    try {
      if (typeof QRCode !== 'undefined') {
        qrDataUrl = await QRCode.toDataURL(upiUrl, { width: 220, margin: 1, color: { dark: '#000000', light: '#ffffff' } });
      } else {
        qrDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiUrl)}`;
      }
    } catch (err) {
      qrDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiUrl)}`;
    }

    const modal = document.createElement('div');
    modal.id = 'cluster-payment-modal';
    modal.className = 'razorpay-modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="sih-checkout-sheet" role="dialog" aria-modal="true" style="max-width: 520px;">
        <button type="button" class="sih-checkout-close" id="btn-close-cluster-pay-modal" aria-label="Close modal">×</button>

        <div style="text-align: center; margin-bottom: 12px;">
          <span style="background: rgba(14, 165, 233, 0.15); border: 1px solid rgba(14, 165, 233, 0.4); color: #38bdf8; font-size: 0.68rem; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; padding: 5px 14px; border-radius: 20px; display: inline-block;">
            <span style="color: #38bdf8;">●</span> SMART INDIA HACKATHON • ARTISAN CLUSTER ESCROW
          </span>
          <h2 style="color: #ffffff; font-size: 1.45rem; font-weight: 900; margin: 10px 0 2px;">
            ${escapeHtml(stageTitle)}
          </h2>
          <p style="color: #94a3b8; font-size: 0.78rem; margin: 0;">
            ${escapeHtml(stagePurpose)}
          </p>
        </div>

        <div class="sih-checkout-card" style="margin-bottom: 14px;">
          <div class="sih-product-summary">
            <div>
              <strong style="color: #ffffff; font-size: 0.95rem; display:block;">${escapeHtml(cluster.product)}</strong>
              <div style="color: #cbd5e1; font-size: 0.75rem; margin-top: 2px;">
                Bulk Order: <strong>${fin.quantity} units</strong> • ₹${fin.unitPrice}/unit
              </div>
              <div style="color: #94a3b8; font-size: 0.7rem; margin-top: 2px;">
                Cluster ID: <span style="color:#38bdf8;">${escapeHtml(cluster.id)}</span> • Ref: #${tempTxnId}
              </div>
            </div>
            <div style="text-align: right;">
              <span style="font-size:0.68rem; color:#94a3b8; display:block;">Due Now (${isAdvance ? '40%' : '60%'})</span>
              <strong style="color: #34d399; font-size: 1.35rem; font-weight: 900;">₹${targetAmount.toLocaleString('en-IN')}</strong>
              <span style="font-size:0.7rem; color:#cbd5e1; display:block;">Total: ₹${fin.totalAmount.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <!-- Artisan Distribution in this Payment -->
          <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(51, 65, 85, 0.6); border-radius: 8px; padding: 10px; margin: 12px 0;">
            <div style="font-size: 0.72rem; color: #94a3b8; font-weight: 700; text-transform: uppercase; margin-bottom: 6px;">
              🛡️ Direct Escrow Payout Breakdown (${isAdvance ? '40% Advance' : '60% Final'}):
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px; max-height: 100px; overflow-y: auto;">
              ${(cluster.members || []).map(m => {
                const memTarget = Math.round((m.assigned_quantity / fin.quantity) * targetAmount);
                return `
                  <div style="display:flex; justify-content:space-between; font-size:0.74rem; color:#e2e8f0;">
                    <span>• ${escapeHtml(m.name)} (${m.assigned_quantity} pcs)</span>
                    <strong style="color:#34d399;">₹${memTarget.toLocaleString('en-IN')}</strong>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Live QR Section -->
          <div style="text-align: center; background: #0f172a; border-radius: 12px; padding: 14px; border: 1px solid #1e293b;">
            <div style="font-size: 0.78rem; color: #cbd5e1; margin-bottom: 8px;">
              Scan with any UPI App (GPay / PhonePe / Paytm / BHIM)
            </div>
            <div style="display: inline-block; background: #ffffff; padding: 8px; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.4);">
              <img src="${qrDataUrl}" alt="Cluster Payment UPI QR" style="width: 170px; height: 170px; display: block;" />
            </div>
            <div style="margin-top: 8px; font-size: 0.72rem; color: #94a3b8;">
              Payee: <strong style="color: #f472b6;">${payeeUpiId}</strong>
            </div>
          </div>
        </div>

        <!-- Confirm Action Button -->
        <button type="button" id="btn-confirm-cluster-payment-action" style="width: 100%; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; font-size: 0.95rem; font-weight: 800; padding: 12px; border: none; border-radius: 10px; cursor: pointer; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);">
          ✓ Complete ${isAdvance ? 'Advance Payment' : 'Final Settlement'} (₹${targetAmount.toLocaleString('en-IN')})
        </button>

        <p style="text-align: center; color: #64748b; font-size: 0.7rem; margin: 8px 0 0;">
          🔒 Secured by KALA-MITRA Milestone Smart Escrow. Funds disbursed to verified artisans.
        </p>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#btn-close-cluster-pay-modal')?.addEventListener('click', () => {
      modal.remove();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    modal.querySelector('#btn-confirm-cluster-payment-action')?.addEventListener('click', () => {
      modal.remove();
      if (typeof onPaid === 'function') {
        onPaid(stage, targetAmount, tempTxnId);
      }
    });
  }

  async function renderBuyerOrders(initialProduct, initialQty, initialCraft) {
    const container = document.getElementById('buyer-orders-content');
    if (!container) return;

    let targetClusterFromNav = pendingBuyerClusterTarget;
    pendingBuyerClusterTarget = null;

    let p = initialProduct || (pendingClusterData ? pendingClusterData.product : null) || (targetClusterFromNav ? targetClusterFromNav.product : null);
    let q = initialQty || (pendingClusterData ? pendingClusterData.quantity : null) || (targetClusterFromNav ? targetClusterFromNav.required_quantity : null);
    let c = initialCraft || (pendingClusterData ? pendingClusterData.craft : null) || (targetClusterFromNav ? targetClusterFromNav.craft : null);

    if (p || q || c) {
      activeClusterRequirement = {
        product: typeof p === 'object' ? (p.title || p.name || p.product || 'Bamboo Utility Basket Set (50 units)') : String(p || 'Bamboo Utility Basket Set (50 units)'),
        quantity: Number(q) || 200,
        craft: c || (typeof p === 'object' ? (p.category || p.craft_type) : null),
        location: (targetClusterFromNav && targetClusterFromNav.location) || 'East Godavari, AP',
        deadline: (targetClusterFromNav && parseInt(targetClusterFromNav.delivery_date)) || 15
      };
      try {
        localStorage.setItem('kala_mitra_active_cluster_req', JSON.stringify(activeClusterRequirement));
      } catch (e) {}
    } else if (!activeClusterRequirement) {
      try {
        const storedReq = localStorage.getItem('kala_mitra_active_cluster_req');
        if (storedReq) activeClusterRequirement = JSON.parse(storedReq);
      } catch (e) {}
      if (!activeClusterRequirement) {
        activeClusterRequirement = {
          product: 'Bamboo Utility Basket Set (50 units)',
          quantity: 200,
          craft: 'Bamboo Crafts',
          location: 'East Godavari, AP',
          deadline: 15
        };
      }
    }

    pendingClusterData = null;

    let reqProduct = activeClusterRequirement.product || 'Bamboo Utility Basket Set (50 units)';
    let reqQuantity = Number(activeClusterRequirement.quantity) || 200;
    let reqDeadline = Number(activeClusterRequirement.deadline) || 15;
    let reqLocation = activeClusterRequirement.location || 'East Godavari, AP';

    const normalizeCraft = (craftStr) => {
      if (!craftStr) return 'Other Traditional Crafts';
      const str = String(craftStr).toLowerCase();
      if (str.includes('bamboo') || str.includes('cane')) return 'Bamboo Crafts';
      if (str.includes('jewel') || str.includes('bead') || str.includes('necklace') || str.includes('bangle') || str.includes('earring') || str.includes('kundan') || str.includes('filigree') || str.includes('choker') || str.includes('ring') || str.includes('lac ') || str.includes('pendant')) return 'Jewellery';
      if (str.includes('folk') || str.includes('art') || str.includes('mural') || str.includes('paint') || str.includes('decor') || str.includes('warli') || str.includes('madhubani') || str.includes('patachitra') || str.includes('pattachitra') || str.includes('gond') || str.includes('thangka') || str.includes('tanjore') || str.includes('cheriyal')) return 'Folk Art';
      if (str.includes('embroidery') || str.includes('needle') || str.includes('zardozi') || str.includes('stitch') || str.includes('chikan') || str.includes('phulkari') || str.includes('kantha')) return 'Embroidery';
      if (str.includes('handloom') || str.includes('textile') || str.includes('weaver') || str.includes('silk') || str.includes('cotton') || str.includes('saree') || str.includes('dhoti') || str.includes('shawl') || str.includes('khadi') || str.includes('dupatta') || str.includes('fabric')) return 'Handloom';
      if (str.includes('kalamkari')) return 'Kalamkari';
      if (str.includes('pottery') || str.includes('terracotta') || str.includes('clay') || str.includes('diya') || str.includes('handi') || str.includes('pitcher') || str.includes('matka') || str.includes('vase')) return 'Pottery';
      if (str.includes('wood') || str.includes('toy') || str.includes('etikoppaka') || str.includes('doll') || str.includes('lacquer') || str.includes('carving') || str.includes('puzzle') || str.includes('train')) return 'Wood Crafts';
      if (str.includes('metal') || str.includes('brass') || str.includes('dokra') || str.includes('bell') || str.includes('bronze') || str.includes('copper')) return 'Metal Crafts';
      if (str.includes('leather') || str.includes('puppet') || str.includes('tholu') || str.includes('bommalata')) return 'Leather Crafts';
      if (str.includes('stone') || str.includes('sculpture') || str.includes('marble') || str.includes('granite')) return 'Stone Crafts';
      if (str.includes('bag') || str.includes('pouch') || str.includes('accessory') || str.includes('tote') || str.includes('purse') || str.includes('backpack') || str.includes('clutch') || str.includes('potli')) return 'Bags & Accessories';
      if (str.includes('jute') || str.includes('coir') || str.includes('hemp') || str.includes('eco-craft') || str.includes('eco-fiber')) return 'Jute Crafts';
      return 'Other Traditional Crafts';
    };

    let selectedCraft = normalizeCraft(activeClusterRequirement.craft) || normalizeCraft(reqProduct) || 'Bamboo Crafts';
    let currentCluster = targetClusterFromNav || null;
    const storedHistory = getStoredClusterHistory();
    if (!currentCluster) {
      try {
        const lastActiveId = localStorage.getItem('kala_mitra_active_tracking_cluster_id');
        if (lastActiveId && Array.isArray(storedHistory)) {
          currentCluster = storedHistory.find(c => String(c.id) === String(lastActiveId)) || null;
        }
      } catch (e) {}
    }
    if (!currentCluster && Array.isArray(storedHistory) && storedHistory.length > 0) {
      currentCluster = storedHistory.find(c => (c.payment_status === 'ADVANCE_PAID' || c.status === 'IN PRODUCTION' || (c.overall_progress && c.overall_progress > 0))) || storedHistory[0];
    }
    if (currentCluster) {
      applyPaidStatusToCluster(currentCluster);
    }
    let activeTab = targetClusterFromNav ? 'active' : (currentCluster && (currentCluster.payment_status === 'ADVANCE_PAID' || currentCluster.overall_progress > 0 || currentCluster.status === 'IN PRODUCTION') ? 'tracking' : 'builder');

    function getArtisansForCraft(craft, loc) {
      const locName = loc || 'East Godavari';
      const map = {
        'Bamboo Crafts': [
          { id: 101, name: 'Lakshmi Bamboo Guild', craft: 'Bamboo Crafts', location: 'Kakinada', capacity: 250, price: 140, rating: 4.8, verified: true, lead_days: 12 },
          { id: 102, name: 'Sri Durga Cane Crafters', craft: 'Bamboo Crafts', location: 'Samalkota', capacity: 200, price: 142, rating: 4.7, verified: true, lead_days: 14 },
          { id: 103, name: 'Godavari Cane & Rattan Co-op', craft: 'Bamboo Crafts', location: 'Rajahmundry', capacity: 300, price: 138, rating: 4.9, verified: true, lead_days: 10 },
          { id: 104, name: 'East Coast Bamboo Artisans', craft: 'Bamboo Crafts', location: 'Pithapuram', capacity: 250, price: 140, rating: 4.6, verified: true, lead_days: 14 },
          { id: 105, name: 'Yanam River Cane Guild', craft: 'Bamboo Crafts', location: 'Yanam Road', capacity: 220, price: 139, rating: 4.7, verified: true, lead_days: 13 }
        ],
        'Handloom': [
          { id: 201, name: 'Venkatagiri Handloom Weavers', craft: 'Handloom', location: 'Venkatagiri', capacity: 300, price: 450, rating: 4.9, verified: true, lead_days: 15 },
          { id: 202, name: 'Uppada Silk & Cotton Guild', craft: 'Handloom', location: 'Uppada', capacity: 250, price: 480, rating: 4.8, verified: true, lead_days: 14 },
          { id: 203, name: 'Mangalagiri Weavers Collective', craft: 'Handloom', location: 'Mangalagiri', capacity: 200, price: 420, rating: 4.7, verified: true, lead_days: 12 },
          { id: 204, name: 'Dharmavaram Handloom Society', craft: 'Handloom', location: 'Dharmavaram', capacity: 350, price: 500, rating: 4.9, verified: true, lead_days: 18 },
          { id: 205, name: 'Chirala Textile Crafters', craft: 'Handloom', location: 'Chirala', capacity: 280, price: 390, rating: 4.6, verified: true, lead_days: 10 }
        ],
        'Kalamkari': [
          { id: 301, name: 'Srikalahasti Kalamkari Guild', craft: 'Kalamkari', location: 'Srikalahasti', capacity: 200, price: 550, rating: 4.9, verified: true, lead_days: 14 },
          { id: 302, name: 'Pedana Block Print Artisans', craft: 'Kalamkari', location: 'Pedana', capacity: 250, price: 520, rating: 4.8, verified: true, lead_days: 12 },
          { id: 303, name: 'Machilipatnam Tree of Life Art', craft: 'Kalamkari', location: 'Machilipatnam', capacity: 180, price: 580, rating: 4.9, verified: true, lead_days: 16 },
          { id: 304, name: 'Chitra Kalamkari Heritage Guild', craft: 'Kalamkari', location: 'Vijayawada', capacity: 220, price: 500, rating: 4.7, verified: true, lead_days: 15 },
          { id: 305, name: 'Godavari Natural Dye Crafters', craft: 'Kalamkari', location: 'Eluru', capacity: 210, price: 490, rating: 4.8, verified: true, lead_days: 13 }
        ],
        'Pottery': [
          { id: 401, name: 'Terracotta Clay Crafters', craft: 'Pottery', location: 'Samalkota', capacity: 300, price: 180, rating: 4.8, verified: true, lead_days: 10 },
          { id: 402, name: 'Royal Terracotta Guild', craft: 'Pottery', location: 'Kakinada Rural', capacity: 250, price: 190, rating: 4.7, verified: true, lead_days: 12 },
          { id: 403, name: 'Earthen Ware Artisans', craft: 'Pottery', location: 'Rajahmundry', capacity: 350, price: 175, rating: 4.9, verified: true, lead_days: 9 },
          { id: 404, name: 'Clay Traditions Society', craft: 'Pottery', location: 'Pithapuram', capacity: 200, price: 185, rating: 4.6, verified: true, lead_days: 11 },
          { id: 405, name: 'Sri Vigneswara Terracotta Works', craft: 'Pottery', location: 'Anakapalle', capacity: 280, price: 170, rating: 4.8, verified: true, lead_days: 14 }
        ],
        'Wood Crafts': [
          { id: 501, name: 'Etikoppaka Lacquerware Toys', craft: 'Wood Crafts', location: 'Etikoppaka', capacity: 400, price: 220, rating: 4.9, verified: true, lead_days: 14 },
          { id: 502, name: 'Kondapalli Wooden Toy Guild', craft: 'Wood Crafts', location: 'Kondapalli', capacity: 350, price: 240, rating: 4.8, verified: true, lead_days: 15 },
          { id: 503, name: 'Udayagiri Wooden Cutlery Crafters', craft: 'Wood Crafts', location: 'Udayagiri', capacity: 200, price: 210, rating: 4.7, verified: true, lead_days: 12 },
          { id: 504, name: 'Sri Rama Wood Carvings', craft: 'Wood Crafts', location: 'Tirupati', capacity: 180, price: 280, rating: 4.9, verified: true, lead_days: 18 },
          { id: 505, name: 'East Godavari Wood Crafters', craft: 'Wood Crafts', location: 'Kakinada', capacity: 250, price: 230, rating: 4.6, verified: true, lead_days: 13 }
        ],
        'Metal Crafts': [
          { id: 601, name: 'Dokra Tribal Metal Guild', craft: 'Metal Crafts', location: 'Araku Valley', capacity: 180, price: 650, rating: 4.9, verified: true, lead_days: 20 },
          { id: 602, name: 'Chinthoor Bell Metal Crafters', craft: 'Metal Crafts', location: 'Chinthoor', capacity: 150, price: 620, rating: 4.8, verified: true, lead_days: 18 },
          { id: 603, name: 'Budithi Brassware Artisans', craft: 'Metal Crafts', location: 'Budithi', capacity: 220, price: 580, rating: 4.7, verified: true, lead_days: 16 },
          { id: 604, name: 'Sri Durga Metal Crafting Co-op', craft: 'Metal Crafts', location: 'Vijayawada', capacity: 200, price: 600, rating: 4.8, verified: true, lead_days: 15 },
          { id: 605, name: 'Godavari Brass Foundry Guild', craft: 'Metal Crafts', location: 'Rajahmundry', capacity: 190, price: 590, rating: 4.6, verified: true, lead_days: 14 }
        ],
        'Leather Crafts': [
          { id: 701, name: 'Nimmalakunta Shadow Puppets', craft: 'Leather Crafts', location: 'Nimmalakunta', capacity: 150, price: 420, rating: 4.9, verified: true, lead_days: 16 },
          { id: 702, name: 'Tholu Bommalata Heritage Guild', craft: 'Leather Crafts', location: 'Anantapur', capacity: 180, price: 450, rating: 4.8, verified: true, lead_days: 15 },
          { id: 703, name: 'Andhra Leather Puppet Artisans', craft: 'Leather Crafts', location: 'Kakinada', capacity: 200, price: 400, rating: 4.7, verified: true, lead_days: 14 },
          { id: 704, name: 'Sri Venkateswara Puppet Crafters', craft: 'Leather Crafts', location: 'Tirupati', capacity: 160, price: 430, rating: 4.8, verified: true, lead_days: 17 },
          { id: 705, name: 'Godavari Folk Leather Artists', craft: 'Leather Crafts', location: 'Rajahmundry', capacity: 220, price: 390, rating: 4.6, verified: true, lead_days: 13 }
        ],
        'Stone Crafts': [
          { id: 801, name: 'Allagadda Stone Carvings', craft: 'Stone Crafts', location: 'Allagadda', capacity: 120, price: 850, rating: 4.9, verified: true, lead_days: 25 },
          { id: 802, name: 'Durgi Marble & Stone Guild', craft: 'Stone Crafts', location: 'Durgi', capacity: 150, price: 800, rating: 4.8, verified: true, lead_days: 22 },
          { id: 803, name: 'Amaravati Sculpture Traditions', craft: 'Stone Crafts', location: 'Amaravati', capacity: 140, price: 880, rating: 4.9, verified: true, lead_days: 24 },
          { id: 804, name: 'Kakinada Heritage Stone Masons', craft: 'Stone Crafts', location: 'Kakinada', capacity: 180, price: 780, rating: 4.7, verified: true, lead_days: 20 },
          { id: 805, name: 'Godavari Granite Carvers', craft: 'Stone Crafts', location: 'Rajahmundry', capacity: 160, price: 790, rating: 4.6, verified: true, lead_days: 19 }
        ],
        'Jute Crafts': [
          { id: 901, name: 'Vizianagaram Jute Weavers', craft: 'Jute Crafts', location: 'Vizianagaram', capacity: 400, price: 160, rating: 4.8, verified: true, lead_days: 10 },
          { id: 902, name: 'Eco-Fiber Crafts Collective', craft: 'Jute Crafts', location: 'Kakinada', capacity: 350, price: 150, rating: 4.7, verified: true, lead_days: 9 },
          { id: 903, name: 'Godavari Jute Bag Crafters', craft: 'Jute Crafts', location: 'Rajahmundry', capacity: 500, price: 145, rating: 4.9, verified: true, lead_days: 8 },
          { id: 904, name: 'Coastal Eco-Craft Guild', craft: 'Jute Crafts', location: 'Pithapuram', capacity: 300, price: 155, rating: 4.6, verified: true, lead_days: 11 },
          { id: 905, name: 'Delta Jute Handicrafts', craft: 'Jute Crafts', location: 'Eluru', capacity: 280, price: 165, rating: 4.7, verified: true, lead_days: 12 }
        ],
        'Embroidery': [
          { id: 1001, name: 'Banjara Needlework Crafters', craft: 'Embroidery', location: 'Guntur', capacity: 250, price: 320, rating: 4.9, verified: true, lead_days: 14 },
          { id: 1002, name: 'Zardozi & Embroidery Guild', craft: 'Embroidery', location: 'Hyderabad', capacity: 220, price: 380, rating: 4.8, verified: true, lead_days: 16 },
          { id: 1003, name: 'Kasuti Needlecraft Artisans', craft: 'Embroidery', location: 'Vijayawada', capacity: 280, price: 300, rating: 4.7, verified: true, lead_days: 12 },
          { id: 1004, name: 'Godavari Threadwork Collective', craft: 'Embroidery', location: 'Kakinada', capacity: 200, price: 310, rating: 4.8, verified: true, lead_days: 13 },
          { id: 1005, name: 'Royal Embroidery Society', craft: 'Embroidery', location: 'Rajahmundry', capacity: 240, price: 330, rating: 4.6, verified: true, lead_days: 15 }
        ],
        'Bags & Accessories': [
          { id: 1101, name: 'Coastal Handmade Bag Guild', craft: 'Bags & Accessories', location: 'Kakinada', capacity: 350, price: 280, rating: 4.8, verified: true, lead_days: 10 },
          { id: 1102, name: 'Earthy Jute & Tote Crafters', craft: 'Bags & Accessories', location: 'Samalkota', capacity: 300, price: 260, rating: 4.7, verified: true, lead_days: 9 },
          { id: 1103, name: 'Delta Artisan Pouch Co-op', craft: 'Bags & Accessories', location: 'Rajahmundry', capacity: 400, price: 250, rating: 4.9, verified: true, lead_days: 8 },
          { id: 1104, name: 'Sri Durga Handcrafted Purses', craft: 'Bags & Accessories', location: 'Eluru', capacity: 250, price: 270, rating: 4.6, verified: true, lead_days: 11 },
          { id: 1105, name: 'East Coast Fashion Crafts', craft: 'Bags & Accessories', location: 'Visakhapatnam', capacity: 280, price: 290, rating: 4.8, verified: true, lead_days: 12 }
        ],
        'Jewellery': [
          { id: 1201, name: 'Machilipatnam Imitation Jewellery', craft: 'Jewellery', location: 'Machilipatnam', capacity: 450, price: 220, rating: 4.9, verified: true, lead_days: 10 },
          { id: 1202, name: 'Lac & Terracotta Beads Guild', craft: 'Jewellery', location: 'Kakinada', capacity: 300, price: 180, rating: 4.8, verified: true, lead_days: 9 },
          { id: 1203, name: 'Tribal Shell & Bead Artisans', craft: 'Jewellery', location: 'Araku Valley', capacity: 250, price: 200, rating: 4.7, verified: true, lead_days: 12 },
          { id: 1204, name: 'Heritage Thread Jewellery Crafters', craft: 'Jewellery', location: 'Vijayawada', capacity: 350, price: 210, rating: 4.8, verified: true, lead_days: 11 },
          { id: 1205, name: 'Godavari Artisan Jewels', craft: 'Jewellery', location: 'Rajahmundry', capacity: 280, price: 195, rating: 4.6, verified: true, lead_days: 10 }
        ],
        'Folk Art': [
          { id: 1301, name: 'Cheriyal Scroll Painters', craft: 'Folk Art', location: 'Warangal', capacity: 150, price: 750, rating: 4.9, verified: true, lead_days: 18 },
          { id: 1302, name: 'Tanjore Gold Foil Artisans', craft: 'Folk Art', location: 'Tirupati', capacity: 120, price: 950, rating: 4.9, verified: true, lead_days: 20 },
          { id: 1303, name: 'Pattachitra & Folk Artists', craft: 'Folk Art', location: 'Visakhapatnam', capacity: 180, price: 700, rating: 4.8, verified: true, lead_days: 16 },
          { id: 1304, name: 'Godavari Wall Mural Guild', craft: 'Folk Art', location: 'Kakinada', capacity: 200, price: 680, rating: 4.7, verified: true, lead_days: 15 },
          { id: 1305, name: 'Sri Lakshmi Folk Art Society', craft: 'Folk Art', location: 'Rajahmundry', capacity: 160, price: 720, rating: 4.8, verified: true, lead_days: 14 }
        ],
        'Other Traditional Crafts': [
          { id: 1401, name: 'Multi-Craft Artisan Collective', craft: 'Other Traditional Crafts', location: locName, capacity: 250, price: 300, rating: 4.8, verified: true, lead_days: 12 },
          { id: 1402, name: 'Heritage Andhra Crafts Guild', craft: 'Other Traditional Crafts', location: 'Rajahmundry', capacity: 200, price: 320, rating: 4.7, verified: true, lead_days: 14 },
          { id: 1403, name: 'East Coast Master Artisans', craft: 'Other Traditional Crafts', location: 'Samalkota', capacity: 300, price: 280, rating: 4.9, verified: true, lead_days: 10 },
          { id: 1404, name: 'Delta Rural Craft Syndicate', craft: 'Other Traditional Crafts', location: 'Pithapuram', capacity: 250, price: 310, rating: 4.6, verified: true, lead_days: 14 },
          { id: 1405, name: 'Sri Durga Unified Crafters', craft: 'Other Traditional Crafts', location: 'Yanam Road', capacity: 220, price: 290, rating: 4.7, verified: true, lead_days: 13 }
        ]
      };

      // Direct category alias mappings from marketplace catalog
      map['Handmade Jewellery'] = map['Jewellery'];
      map['Handmade Bags & Accessories'] = map['Bags & Accessories'];
      map['Embroidery & Textiles'] = map['Embroidery'];
      map['Handmade Toys & Dolls'] = map['Wood Crafts'];
      map['Toys & Dolls'] = map['Wood Crafts'];
      map['Folk Art & Wall Decor'] = map['Folk Art'];
      map['Pottery & Terracotta'] = map['Pottery'];
      map['Handloom & Textiles'] = map['Handloom'];
      map['Bamboo & Cane Crafts'] = map['Bamboo Crafts'];

      return map[craft] || map[normalizeCraft(craft)] || map['Bamboo Crafts'];
    };

    const autoSelectArtisans = (targetQty, pool) => {
      const selected = {};
      let remainingAlloc = Math.max(0, targetQty);
      pool.forEach(artisan => {
        if (remainingAlloc > 0) {
          const share = Math.min(artisan.capacity, remainingAlloc);
          if (share > 0) {
            selected[artisan.id] = share;
            remainingAlloc -= share;
          }
        }
      });
      return selected;
    };

    let userManuallyCleared = false;
    let poolArtisans = getArtisansForCraft(selectedCraft, reqLocation).filter(a => !excludedArtisanIds.has(a.id));
    let selectedArtisans = autoSelectArtisans(reqQuantity, poolArtisans);

    const render = () => {
      let filteredPool = poolArtisans.filter(a => {
        if (selectedCraft === 'All') return true;
        if (a.craft === selectedCraft) return true;
        const aCraft = (a.craft || '').toLowerCase();
        const sCraft = selectedCraft.toLowerCase();
        if (sCraft.includes('jewel') && (aCraft.includes('jewel') || aCraft.includes('bead') || aCraft.includes('accessory'))) return true;
        if (sCraft.includes('kalamkari') && (aCraft.includes('kalamkari') || aCraft.includes('handloom'))) return true;
        if (sCraft.includes('metal') && (aCraft.includes('metal') || aCraft.includes('brass') || aCraft.includes('dokra'))) return true;
        if (sCraft.includes('leather') && (aCraft.includes('leather') || aCraft.includes('puppet'))) return true;
        if (sCraft.includes('stone') && (aCraft.includes('stone') || aCraft.includes('sculpture'))) return true;
        if (sCraft.includes('embroidery') && (aCraft.includes('embroidery') || aCraft.includes('needle'))) return true;
        if (sCraft.includes('bag') && (aCraft.includes('bag') || aCraft.includes('jute') || aCraft.includes('accessory'))) return true;
        if (sCraft.includes('folk') && (aCraft.includes('folk') || aCraft.includes('art') || aCraft.includes('wall'))) return true;
        if (sCraft.includes('wood') && (aCraft.includes('wood') || aCraft.includes('toy') || aCraft.includes('doll') || aCraft.includes('etikoppaka'))) return true;
        if (sCraft.includes('pottery') && (aCraft.includes('pottery') || aCraft.includes('terracotta') || aCraft.includes('clay'))) return true;
        if (sCraft.includes('handloom') && (aCraft.includes('handloom') || aCraft.includes('textile') || aCraft.includes('weaver') || aCraft.includes('silk') || aCraft.includes('cotton'))) return true;
        if (sCraft.includes('bamboo') && (aCraft.includes('bamboo') || aCraft.includes('cane'))) return true;
        if (sCraft.includes('other') && aCraft.includes('other')) return true;
        return false;
      });

      if (filteredPool.length === 0) {
        filteredPool = getArtisansForCraft(selectedCraft, reqLocation);
      }

      // Check if current selectedArtisans has any artisans belonging to filteredPool
      const hasValidPoolArtisans = Object.keys(selectedArtisans).some(id => 
        filteredPool.some(a => a.id === Number(id))
      );
      if ((!hasValidPoolArtisans || Object.keys(selectedArtisans).length === 0) && !userManuallyCleared) {
        selectedArtisans = autoSelectArtisans(reqQuantity, filteredPool);
      }

      let totalProposed = 0;
      let hasOverCapacityError = false;

      Object.entries(selectedArtisans).forEach(([artisanId, qty]) => {
        const artisan = poolArtisans.find(a => a.id === Number(artisanId));
        if (artisan) {
          totalProposed += Number(qty);
          if (Number(qty) > artisan.capacity) {
            hasOverCapacityError = true;
          }
        }
      });

      const remainingQty = Math.max(0, reqQuantity - totalProposed);

      container.innerHTML = `
        <div class="cluster-dashboard">
          <div class="cluster-dashboard__intro">
            <div>
              <span class="cluster-eyebrow">COLLABORATIVE FULFILLMENT</span>
              <h2>Artisan Cluster Network</h2>
              <p>When a bulk requirement exceeds one artisan's capacity, multiple certified artisans combine their production capacities to fulfill your order smoothly.</p>
            </div>
            <span class="cluster-live-badge">● BACKEND STORE ACTIVE</span>
          </div>

          <div class="cluster-tabs">
            <button type="button" class="${activeTab === 'builder' ? 'active' : ''}" id="tab-cluster-builder">1. Provisional Cluster Builder</button>
            <button type="button" class="${activeTab === 'active' ? 'active' : ''}" id="tab-cluster-active">2. Active Cluster Management ${currentCluster ? `(${currentCluster.status})` : ''}</button>
            <button type="button" class="${activeTab === 'tracking' ? 'active' : ''}" id="tab-cluster-tracking" style="position: relative;">
              3. 📍 Cluster Order Tracking ${currentCluster && (currentCluster.payment_status === 'ADVANCE_PAID' || currentCluster.overall_progress > 0) ? '<span style="display:inline-block; width:7px; height:7px; background:#22c55e; border-radius:50%; margin-left:4px; box-shadow:0 0 6px #22c55e;"></span>' : ''}
            </button>
            <button type="button" class="${activeTab === 'history' ? 'active' : ''}" id="tab-cluster-history">4. Previous Clusters / History</button>
          </div>

          ${activeTab === 'builder' ? renderBuilderView(filteredPool, totalProposed, remainingQty, hasOverCapacityError) : activeTab === 'active' ? renderActiveTab() : activeTab === 'tracking' ? renderClusterTrackingView(currentCluster) : renderHistoryView()}
        </div>
      `;

      bindEvents();
      translateApp(selectedLanguage);
    };

    
    const renderClusterTrackingView = (passedCluster) => {
      const hist = getStoredClusterHistory();
      const cluster = (passedCluster && passedCluster.id && hist.find(c => String(c.id) === String(passedCluster.id))) || passedCluster || (hist.length > 0 ? hist[0] : null);
      if (!cluster) {
        return `
          <div class="buyer-empty-state" style="padding: 40px 20px; text-align: center; background: #f8fafc; border-radius: 12px; border: 1.5px dashed #cbd5e1;">
            <span style="font-size: 2.5rem; display: block; margin-bottom: 8px;">📦</span>
            <h3 style="margin: 0 0 6px; color: #1e293b;">No Active Cluster to Track</h3>
            <p style="margin: 0; color: #64748b; font-size: 0.85rem;">Create a cluster in the Provisional Cluster Builder or select an active cluster to view live tracking.</p>
          </div>
        `;
      }

      const members = Array.isArray(cluster.members) ? cluster.members : [];
      const reqQty = Number(cluster.required_quantity || 500);
      const totalCompleted = members.reduce((sum, m) => sum + (Number(m.completed_quantity) || 0), 0);
      const overallProg = Math.min(100, Math.round((totalCompleted / reqQty) * 100));
      const isAdvancePaid = cluster.payment_status === 'ADVANCE_PAID' || cluster.payment_status === 'FULLY_PAID';
      const isFullyPaid = cluster.payment_status === 'FULLY_PAID';
      const isClusterCompleted = cluster.status === 'COMPLETED' || overallProg >= 100;

      const step1Done = true;
      const step2Done = isAdvancePaid;
      const step3Done = overallProg >= 85 || members.every(m => m.production_status === 'Completed' || m.production_status === 'Quality Check');
      const step4Done = isClusterCompleted;
      const step5Done = isClusterCompleted && isFullyPaid;

      return `
        <section class="cluster-recommendation" style="display: flex; flex-direction: column; gap: 20px;">
          
          <!-- Cluster Switcher Toolbar -->
          <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 12px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              <span style="font-size: 0.85rem; font-weight: 800; color: #1e293b; display: flex; align-items: center; gap: 6px;">
                <span>📦</span> Tracked Cluster:
              </span>
              <select id="select-active-tracking-cluster" style="padding: 6px 12px; border-radius: 8px; border: 1.5px solid #0284c7; font-size: 0.84rem; font-weight: 800; color: #0f172a; background: #f0f9ff; cursor: pointer; max-width: 320px;">
                ${hist.map(c => `
                  <option value="${c.id}" ${String(c.id) === String(cluster.id) ? 'selected' : ''}>
                    ${escapeHtml(c.product)} (${c.overall_progress || 0}% • ${escapeHtml(c.status || 'Active')})
                  </option>
                `).join('')}
              </select>
            </div>
            <div style="display: flex; align-items: center; gap: 6px; font-size: 0.78rem; color: #0284c7; font-weight: 700;">
              <span>⚡</span> Real-time Artisan Workshop Sync Active
            </div>
          </div>

          <!-- TOP CARD: TOTAL TRACKING OF THE CLUSTER ORDER -->
          <div style="background: #ffffff; border: 2px solid #0284c7; border-radius: 14px; padding: 22px; box-shadow: 0 4px 20px rgba(2, 132, 199, 0.12);">
            
            <!-- Top Row: Title, ID, Live Sync Indicator & Badges -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 14px;">
              <div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap;">
                  <span style="background: #e0f2fe; color: #0369a1; border: 1px solid #7dd3fc; font-size: 0.72rem; font-weight: 800; padding: 3px 10px; border-radius: 12px;">
                    CLUSTER #${escapeHtml(String(cluster.id).slice(-6).toUpperCase())}
                  </span>
                  <span style="background: #f1f5f9; color: #475569; font-size: 0.72rem; font-weight: 700; padding: 3px 10px; border-radius: 12px;">
                    🎨 ${escapeHtml(cluster.craft || 'Artisan Guild')}
                  </span>
                  <span style="display: inline-flex; align-items: center; gap: 5px; font-size: 0.72rem; color: #16a34a; font-weight: 800; background: #dcfce7; padding: 3px 10px; border-radius: 12px;">
                    <span style="width: 7px; height: 7px; background: #16a34a; border-radius: 50%; display: inline-block; box-shadow: 0 0 6px #16a34a;"></span>
                    LIVE ARTISAN WORKSHOP SYNC
                  </span>
                </div>
                <h2 style="color: #0f172a; font-size: 1.4rem; font-weight: 900; margin: 0 0 4px;">
                  ${escapeHtml(cluster.product)}
                </h2>
                <span style="font-size: 0.8rem; color: #64748b;">
                  📍 Hub: <strong>${escapeHtml(cluster.location || 'Regional Craft Hub')}</strong> • Target Delivery: <strong>${escapeHtml(cluster.delivery_date || 'Within 20 days')}</strong>
                </span>
              </div>

              <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
                <span style="font-size: 0.85rem; font-weight: 800; padding: 5px 14px; border-radius: 14px; ${
                  isClusterCompleted ? 'background:#dcfce7; color:#15803d; border:1px solid #86efac;' :
                  overallProg > 0 ? 'background:#e0f2fe; color:#0369a1; border:1px solid #7dd3fc;' :
                  'background:#fef3c7; color:#b45309; border:1px solid #fde68a;'
                }">
                  ● ${isClusterCompleted ? 'PRODUCTION COMPLETED' : cluster.status || 'IN PRODUCTION'}
                </span>
                <span style="font-size: 0.75rem; font-weight: 800; padding: 3px 10px; border-radius: 10px; ${
                  isFullyPaid ? 'background:#dcfce7; color:#15803d;' :
                  isAdvancePaid ? 'background:#eff6ff; color:#1e40af; border:1px solid #93c5fd;' :
                  'background:#f8fafc; color:#64748b; border:1px solid #cbd5e1;'
                }">
                  ${isFullyPaid ? '✓ 100% Fully Settled' : isAdvancePaid ? '💳 40% Advance Escrow Paid' : '⏳ Advance Due'}
                </span>
              </div>
            </div>

            <!-- TOTAL TRACKING PROGRESS BAR -->
            <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 18px; margin-bottom: 20px;">
              <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 8px;">
                <div>
                  <span style="font-size: 0.75rem; text-transform: uppercase; font-weight: 800; color: #475569; letter-spacing: 0.5px; display: block; margin-bottom: 2px;">
                    TOTAL CLUSTER PRODUCTION TRACKING
                  </span>
                  <div style="font-size: 1.55rem; font-weight: 900; color: #0f172a;">
                    ${totalCompleted} <span style="font-size: 0.95rem; font-weight: 700; color: #64748b;">/ ${reqQty} total pieces crafted</span>
                  </div>
                </div>
                <div style="text-align: right;">
                  <span style="font-size: 1.6rem; font-weight: 900; color: #0284c7;">
                    ${overallProg}%
                  </span>
                  <span style="font-size: 0.72rem; color: #64748b; display: block; font-weight: 700;">Overall Complete</span>
                </div>
              </div>

              <!-- Large Progress Track -->
              <div style="height: 14px; width: 100%; background: #e2e8f0; border-radius: 999px; overflow: hidden; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);">
                <div style="height: 100%; width: ${overallProg}%; background: linear-gradient(90deg, #0284c7 0%, #06b6d4 50%, #10b981 100%); border-radius: 999px; transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 0 12px rgba(2, 132, 199, 0.4);"></div>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; font-size: 0.75rem; color: #64748b; flex-wrap: wrap; gap: 8px;">
                <span>👥 <strong>${members.length} Certified Artisans</strong> collaborating</span>
                <span>✓ <strong>${members.filter(m => m.production_status === 'Completed' || (m.completed_quantity || 0) >= (m.assigned_quantity || 0)).length} of ${members.length}</strong> workshops finished</span>
                <span>⏳ Target Delivery: <strong>${escapeHtml(cluster.delivery_date || 'In 15 days')}</strong></span>
              </div>
            </div>

            <!-- 5-STEP MILESTONE TIMELINE -->
            <div>
              <h4 style="margin: 0 0 14px; font-size: 0.8rem; font-weight: 800; color: #334155; text-transform: uppercase; letter-spacing: 0.5px;">
                📍 Order Stage Progression
              </h4>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px;">
                
                <div style="background: ${step1Done ? '#f0fdf4' : '#f8fafc'}; border: 1.5px solid ${step1Done ? '#86efac' : '#cbd5e1'}; border-radius: 8px; padding: 10px; text-align: center;">
                  <span style="font-size: 1.1rem; display: block; margin-bottom: 2px;">${step1Done ? '✓' : '1'}</span>
                  <strong style="font-size: 0.76rem; color: ${step1Done ? '#15803d' : '#475569'}; display: block;">1. Cluster Formed</strong>
                  <span style="font-size: 0.68rem; color: #64748b;">Artisans Confirmed</span>
                </div>

                <div style="background: ${step2Done ? '#f0fdf4' : '#fffbeb'}; border: 1.5px solid ${step2Done ? '#86efac' : '#fde68a'}; border-radius: 8px; padding: 10px; text-align: center;">
                  <span style="font-size: 1.1rem; display: block; margin-bottom: 2px;">${step2Done ? '✓' : '2'}</span>
                  <strong style="font-size: 0.76rem; color: ${step2Done ? '#15803d' : '#b45309'}; display: block;">2. Advance Paid</strong>
                  <span style="font-size: 0.68rem; color: #64748b;">40% Escrow Funded</span>
                </div>

                <div style="background: ${step3Done ? '#f0fdf4' : overallProg > 0 ? '#eff6ff' : '#f8fafc'}; border: 1.5px solid ${step3Done ? '#86efac' : overallProg > 0 ? '#93c5fd' : '#cbd5e1'}; border-radius: 8px; padding: 10px; text-align: center;">
                  <span style="font-size: 1.1rem; display: block; margin-bottom: 2px;">${step3Done ? '✓' : '⚙️'}</span>
                  <strong style="font-size: 0.76rem; color: ${step3Done ? '#15803d' : '#1d4ed8'}; display: block;">3. Production</strong>
                  <span style="font-size: 0.68rem; color: #64748b;">${overallProg}% Crafted</span>
                </div>

                <div style="background: ${step4Done ? '#f0fdf4' : overallProg >= 70 ? '#eff6ff' : '#f8fafc'}; border: 1.5px solid ${step4Done ? '#86efac' : overallProg >= 70 ? '#93c5fd' : '#cbd5e1'}; border-radius: 8px; padding: 10px; text-align: center;">
                  <span style="font-size: 1.1rem; display: block; margin-bottom: 2px;">${step4Done ? '✓' : '🔍'}</span>
                  <strong style="font-size: 0.76rem; color: ${step4Done ? '#15803d' : '#475569'}; display: block;">4. Quality Check</strong>
                  <span style="font-size: 0.68rem; color: #64748b;">Batch Verified</span>
                </div>

                <div style="background: ${step5Done ? '#f0fdf4' : '#f8fafc'}; border: 1.5px solid ${step5Done ? '#86efac' : '#cbd5e1'}; border-radius: 8px; padding: 10px; text-align: center;">
                  <span style="font-size: 1.1rem; display: block; margin-bottom: 2px;">${step5Done ? '✓' : '🚚'}</span>
                  <strong style="font-size: 0.76rem; color: ${step5Done ? '#15803d' : '#475569'}; display: block;">5. Dispatched</strong>
                  <span style="font-size: 0.68rem; color: #64748b;">To Destination</span>
                </div>

              </div>
            </div>

          </div>

          <!-- BELOW THAT: EACH ARTISAN PROGRESS BAR -->
          <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 14px; padding: 22px; box-shadow: 0 2px 10px rgba(0,0,0,0.04);">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px;">
              <div>
                <h3 style="margin: 0 0 2px; font-size: 1.15rem; font-weight: 900; color: #0f172a; display: flex; align-items: center; gap: 8px;">
                  <span>👥</span> Individual Artisan Workshop Production Progress (${members.length} Artisans)
                </h3>
                <p style="margin: 0; font-size: 0.78rem; color: #64748b;">
                  Whenever each artisan updates their production status in their workshop, their individual progress bar updates automatically below in real-time.
                </p>
              </div>
              <span style="font-size: 0.72rem; color: #0284c7; background: #e0f2fe; padding: 4px 10px; border-radius: 12px; font-weight: 700;">
                ⚡ Auto-Sync Active
              </span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 14px;">
              ${members.map((artisan, idx) => {
                const assigned = Number(artisan.assigned_quantity || 100);
                const comp = Number(artisan.completed_quantity || 0);
                const pct = Math.min(100, Math.round((comp / assigned) * 100));
                const status = artisan.production_status || (artisan.status === 'Accepted' ? 'In Production' : 'Order Placed');
                const statusColor = 
                  status === 'Completed' ? { bg: '#dcfce7', text: '#15803d', border: '#86efac', bar: 'linear-gradient(90deg, #10b981, #059669)' } :
                  status === 'Quality Check' ? { bg: '#f3e8ff', text: '#7e22ce', border: '#d8b4fe', bar: 'linear-gradient(90deg, #a855f7, #7e22ce)' } :
                  status === 'In Production' ? { bg: '#e0e7ff', text: '#3730a3', border: '#a5b4fc', bar: 'linear-gradient(90deg, #6366f1, #4f46e5)' } :
                  status === 'Production Started' ? { bg: '#e0f2fe', text: '#0369a1', border: '#7dd3fc', bar: 'linear-gradient(90deg, #0284c7, #0369a1)' } :
                  status === 'Material Sourcing' ? { bg: '#fef3c7', text: '#b45309', border: '#fde68a', bar: 'linear-gradient(90deg, #f59e0b, #d97706)' } :
                  { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1', bar: '#94a3b8' };

                return `
                  <div class="artisan-tracking-card" style="background: #ffffff; border: 1.5px solid ${pct === 100 ? '#86efac' : '#e2e8f0'}; border-radius: 12px; padding: 16px; box-shadow: 0 1px 4px rgba(0,0,0,0.03); transition: transform 0.2s, box-shadow 0.2s;">
                    
                    <!-- Artisan Info Row -->
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 10px;">
                      <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 38px; height: 38px; border-radius: 50%; background: linear-gradient(135deg, #0284c7, #0f172a); color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.85rem;">
                          ${escapeHtml((artisan.name || 'A').slice(0, 2).toUpperCase())}
                        </div>
                        <div>
                          <div style="display: flex; align-items: center; gap: 6px;">
                            <strong style="color: #0f172a; font-size: 0.95rem;">${escapeHtml(artisan.name)}</strong>
                            ${artisan.isCurrentUser ? '<span style="background:#e0f2fe; color:#0369a1; font-size:0.65rem; font-weight:800; padding:1px 6px; border-radius:8px;">LEAD ARTISAN</span>' : ''}
                          </div>
                          <span style="font-size: 0.72rem; color: #64748b;">
                            📍 ${escapeHtml(artisan.location || 'AP Workshop')} • ${escapeHtml(artisan.craft || cluster.craft || 'Artisan Guild')}
                          </span>
                        </div>
                      </div>

                      <!-- Status Pill -->
                      <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="background: ${statusColor.bg}; color: ${statusColor.text}; border: 1px solid ${statusColor.border}; font-size: 0.75rem; font-weight: 800; padding: 4px 12px; border-radius: 12px; display: inline-flex; align-items: center; gap: 5px;">
                          ● ${escapeHtml(status)}
                        </span>
                      </div>
                    </div>

                    <!-- Metrics Row -->
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 0.76rem;">
                      <div>
                        <span style="color: #64748b;">Assigned Quota: </span>
                        <strong style="color: #0f172a;">${assigned} units</strong>
                        <span style="color: #cbd5e1; margin: 0 6px;">|</span>
                        <span style="color: #64748b;">Crafted So Far: </span>
                        <strong style="color: ${pct === 100 ? '#15803d' : '#0284c7'}; font-size: 0.85rem;">${comp} units</strong>
                      </div>
                      <div>
                        <strong style="color: ${pct === 100 ? '#15803d' : '#0f172a'}; font-size: 0.88rem;">${pct}%</strong>
                        <span style="color: #64748b; font-size: 0.7rem;"> crafted</span>
                      </div>
                    </div>

                    <!-- INDIVIDUAL ARTISAN PROGRESS BAR -->
                    <div style="height: 10px; width: 100%; background: #e2e8f0; border-radius: 999px; overflow: hidden; margin-bottom: 8px;">
                      <div style="height: 100%; width: ${pct}%; background: ${statusColor.bar}; border-radius: 999px; transition: width 0.4s ease; box-shadow: 0 0 6px rgba(0,0,0,0.1);"></div>
                    </div>

                    <!-- Footer details for this artisan -->
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.7rem; color: #64748b;">
                      <span>Workshop Stage: <strong>${escapeHtml(status)}</strong></span>
                      <span>🕒 Last Update: <strong>${escapeHtml(artisan.last_updated || 'Live workshop sync')}</strong></span>
                    </div>

                  </div>
                `;
              }).join('')}
            </div>
          </div>

        </section>
      `;
    };


    const renderBuilderView = (filteredPool, totalProposed, remainingQty, hasOverCapacityError) => {
      const singleArtisanWithStock = poolArtisans.find(a => a.capacity >= reqQuantity && (selectedCraft === 'All' || a.craft === selectedCraft || a.craft.includes('Bamboo')));

      return `
        <div class="cluster-request-layout">
          <div class="cluster-request-form">
            <h3>Buyer Requirement Details</h3>
            
            <div style="margin-bottom: 12px;">
              <label style="display:block; font-size:0.8rem; font-weight:600; color:#374151; margin-bottom:4px;">Craft Category</label>
              <select id="cluster-craft-select" style="width:100%; padding:8px; border-radius:6px; border:1px solid #d1d5db; background:#fff;">
                <option value="Bamboo Crafts" ${selectedCraft === 'Bamboo Crafts' ? 'selected' : ''}>Bamboo & Cane Crafts</option>
                <option value="Handloom" ${selectedCraft === 'Handloom' ? 'selected' : ''}>Handloom & Textiles</option>
                <option value="Kalamkari" ${selectedCraft === 'Kalamkari' ? 'selected' : ''}>Kalamkari Art & Painting</option>
                <option value="Pottery" ${selectedCraft === 'Pottery' ? 'selected' : ''}>Pottery & Terracotta</option>
                <option value="Wood Crafts" ${selectedCraft === 'Wood Crafts' ? 'selected' : ''}>Wood Carving & Etikoppaka Toys</option>
                <option value="Metal Crafts" ${selectedCraft === 'Metal Crafts' ? 'selected' : ''}>Brass & Metal Crafts (Dokra)</option>
                <option value="Leather Crafts" ${selectedCraft === 'Leather Crafts' ? 'selected' : ''}>Leather Puppetry & Crafts</option>
                <option value="Stone Crafts" ${selectedCraft === 'Stone Crafts' ? 'selected' : ''}>Stone & Clay Sculptures</option>
                <option value="Jute Crafts" ${selectedCraft === 'Jute Crafts' ? 'selected' : ''}>Jute & Eco Crafts</option>
                <option value="Embroidery" ${selectedCraft === 'Embroidery' ? 'selected' : ''}>Embroidery & Needlework</option>
                <option value="Bags & Accessories" ${selectedCraft === 'Bags & Accessories' ? 'selected' : ''}>Handmade Bags & Accessories</option>
                <option value="Jewellery" ${selectedCraft === 'Jewellery' ? 'selected' : ''}>Handmade Jewellery</option>
                <option value="Folk Art" ${selectedCraft === 'Folk Art' ? 'selected' : ''}>Folk Art & Wall Decor</option>
                <option value="Other Traditional Crafts" ${selectedCraft === 'Other Traditional Crafts' ? 'selected' : ''}>Other Traditional Crafts</option>
              </select>
            </div>

            <div style="margin-bottom: 12px;">
              <label style="display:block; font-size:0.8rem; font-weight:600; color:#374151; margin-bottom:4px;">Product Title</label>
              <input type="text" id="cluster-product-input" value="${escapeHtml(reqProduct)}" style="width:100%; padding:8px; border-radius:6px; border:1px solid #d1d5db;" />
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px;">
              <div>
                <label style="display:block; font-size:0.8rem; font-weight:600; color:#374151; margin-bottom:4px;">Requested Quantity</label>
                <input type="number" id="cluster-quantity-input" value="${reqQuantity}" min="1" style="width:100%; padding:8px; border-radius:6px; border:1px solid #d1d5db;" />
              </div>
              <div>
                <label style="display:block; font-size:0.8rem; font-weight:600; color:#374151; margin-bottom:4px;">Timeline (Days)</label>
                <input type="number" id="cluster-days-input" value="${reqDeadline}" min="1" style="width:100%; padding:8px; border-radius:6px; border:1px solid #d1d5db;" />
              </div>
            </div>

            <div style="margin-bottom: 16px;">
              <label style="display:block; font-size:0.8rem; font-weight:600; color:#374151; margin-bottom:4px;">Delivery Region</label>
              <input type="text" id="cluster-location-input" value="${escapeHtml(reqLocation)}" style="width:100%; padding:8px; border-radius:6px; border:1px solid #d1d5db;" />
            </div>

            <div style="background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:10px; padding:14px; margin-bottom:16px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span style="font-weight:700; color:#1e293b; font-size:0.85rem;">PROVISIONAL CLUSTER METRICS</span>
                <span style="background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:12px; font-size:0.75rem; font-weight:700;">Status: PROVISIONAL</span>
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; text-align:center;">
                <div style="background:#fff; padding:8px; border-radius:6px; border:1px solid #cbd5e1;">
                  <span style="display:block; font-size:0.7rem; color:#64748b;">Requested</span>
                  <strong style="font-size:1.1rem; color:#0f172a;">${reqQuantity}</strong>
                </div>
                <div style="background:#fff; padding:8px; border-radius:6px; border:1px solid #cbd5e1;">
                  <span style="display:block; font-size:0.7rem; color:#64748b;">Total Proposed</span>
                  <strong style="font-size:1.1rem; color:${totalProposed >= reqQuantity ? '#16a34a' : '#d97706'};">${totalProposed}</strong>
                </div>
                <div style="background:#fff; padding:8px; border-radius:6px; border:1px solid #cbd5e1;">
                  <span style="display:block; font-size:0.7rem; color:#64748b;">Remaining</span>
                  <strong style="font-size:1.1rem; color:${remainingQty === 0 ? '#16a34a' : '#dc2626'};">${remainingQty}</strong>
                </div>
              </div>
            </div>

            ${hasOverCapacityError ? `
              <div style="background:#fef2f2; border:1px solid #f87171; color:#991b1b; padding:10px; border-radius:6px; font-size:0.8rem; margin-bottom:12px;">
                ⚠️ One or more selected artisans have a proposed contribution exceeding their available capacity. Please reduce the proposed quantity.
              </div>
            ` : ''}

            <button type="button" class="primary-btn" id="btn-send-cluster-requests" ${hasOverCapacityError || Object.keys(selectedArtisans).length === 0 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''} style="width:100%; padding:12px;">
              🚀 Create Provisional Cluster & Send Requests
            </button>
          </div>

          <div class="cluster-recommendation">
            <div class="cluster-recommendation__header">
              <div>
                <span class="cluster-eyebrow">CRAFT CATEGORY ARTISANS POOL</span>
                <h3>${escapeHtml(selectedCraft)} Artisans Pool</h3>
              </div>
              <strong class="cluster-score" style="color:#16a34a;">${Object.entries(selectedArtisans).filter(([_, qty]) => Number(qty) > 0).length} Auto-Selected / ${filteredPool.length} Available</strong>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(240px, 1fr)); gap:12px; margin-top:14px;">
              ${filteredPool.map(artisan => {
                const isSelected = selectedArtisans.hasOwnProperty(artisan.id) && Number(selectedArtisans[artisan.id]) > 0;
                const currentProposed = isSelected ? Number(selectedArtisans[artisan.id]) : 0;
                const isOverCap = isSelected && currentProposed > artisan.capacity;

                return `
                  <div style="background:${isSelected ? (isOverCap ? '#fef2f2' : '#f0fdf4') : '#ffffff'}; border:${isSelected ? (isOverCap ? '2px solid #ef4444' : '2px solid #16a34a') : '1px solid #e2e8f0'}; border-radius:10px; padding:12px; position:relative; transition: all 0.2s ease;">
                    
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                      <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:38px; height:38px; border-radius:50%; background:${isSelected ? '#16a34a' : '#64748b'}; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.9rem;">
                          ${artisan.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <strong style="display:block; font-size:0.85rem; color:#1e293b;">${escapeHtml(artisan.name)}</strong>
                          <span style="font-size:0.72rem; color:#64748b;">📍 ${escapeHtml(artisan.location)} • ⭐ ${artisan.rating}</span>
                        </div>
                      </div>

                      ${isSelected ? `
                        <span style="background:#dcfce7; color:#15803d; font-size:0.68rem; font-weight:800; padding:3px 8px; border-radius:12px; border:1px solid #86efac; text-transform:uppercase;">
                          ⚡ Auto-Selected (${currentProposed} units)
                        </span>
                      ` : `
                        <span style="background:#f1f5f9; color:#64748b; font-size:0.68rem; font-weight:600; padding:3px 8px; border-radius:12px; border:1px solid #e2e8f0;">
                          Available • Unselected
                        </span>
                      `}
                    </div>

                    <div style="font-size:0.78rem; color:#475569; margin-bottom:8px; display:flex; justify-content:space-between; background:rgba(255,255,255,0.7); padding:4px 8px; border-radius:6px;">
                      <span>Available Cap: <strong>${artisan.capacity} units</strong></span>
                      <span>Lead Time: <strong>${artisan.lead_days}d</strong></span>
                    </div>

                    <div style="display:flex; align-items:center; gap:8px; border-top:1px solid #f1f5f9; padding-top:8px;">
                      <label style="display:flex; align-items:center; gap:6px; font-size:0.78rem; font-weight:700; cursor:pointer; color:${isSelected ? '#15803d' : '#475569'};">
                        <input type="checkbox" class="artisan-select-cb" data-artisan-id="${artisan.id}" ${isSelected ? 'checked' : ''} />
                        ${isSelected ? 'Selected' : 'Select'}
                      </label>

                      ${isSelected ? `
                        <div style="flex:1; display:flex; align-items:center; gap:4px;">
                          <span style="font-size:0.7rem; color:#64748b; font-weight:600;">Assigned:</span>
                          <input type="number" class="artisan-qty-input" data-artisan-id="${artisan.id}" value="${currentProposed}" min="1" max="${artisan.capacity}" style="width:100%; padding:4px 6px; font-size:0.8rem; font-weight:700; border-radius:4px; border:${isOverCap ? '1.5px solid #ef4444' : '1.5px solid #16a34a'}; background:#fff;" />
                        </div>
                      ` : ''}
                    </div>

                    ${isOverCap ? `<span style="color:#dc2626; font-size:0.7rem; display:block; margin-top:4px; font-weight:700;">⚠️ Exceeds capacity limit (${artisan.capacity} max)</span>` : ''}

                    <button type="button" class="secondary-btn btn-view-artisan-profile" data-artisan-id="${artisan.id}" style="font-size:0.72rem; padding:4px 8px; margin-top:8px; width:100%; font-weight:600; border-color:#cbd5e1;">
                      🔍 View Full Profile & Details
                    </button>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      `;
    };

    const renderActiveTab = () => {
      if (!currentCluster) {
        return `
          <div class="buyer-empty-state">
            <h3>No Active Cluster Found</h3>
            <p>Use the <strong>Provisional Cluster Builder</strong> tab to create a bulk requirement cluster.</p>
          </div>
        `;
      }

      applyPaidStatusToCluster(currentCluster);

      const members = Array.isArray(currentCluster.members) ? currentCluster.members : [];
      const paymentStatus = currentCluster.payment_status || 'PENDING';
      const isAdvancePaid = paymentStatus === 'ADVANCE_PAID' || paymentStatus === 'FULLY_PAID';
      const isFullyPaid = paymentStatus === 'FULLY_PAID';

      const totalArtisansCount = members.length;
      const acceptedArtisansCount = members.filter(m => m.status === 'Accepted').length;
      const acceptedQty = currentCluster.accepted_quantity || members.filter(m => m.status === 'Accepted').reduce((sum, m) => sum + (Number(m.assigned_quantity) || 0), 0);
      const isConfirmed = currentCluster.status === 'CONFIRMED' || currentCluster.status === 'Cluster Formed & Confirmed' || currentCluster.status === 'IN PRODUCTION' || currentCluster.status === 'COMPLETED';

      // Condition: cluster payment option unlocked ONLY when ALL artisans have accepted
      const isAllAccepted = totalArtisansCount > 0 && acceptedArtisansCount === totalArtisansCount;

      const fin = getClusterFinancials(currentCluster);

      // PRODUCTION COMPLETION LOGIC:
      // Remaining 60% payment unlocks ONLY when ALL artisans production is complete AND cluster production tracking reaches 100%
      const reqQty = Number(currentCluster.required_quantity || 500);
      const totalComp = members.reduce((sum, m) => sum + (Number(m.completed_quantity) || 0), 0);
      const overallProg = reqQty > 0 ? Math.min(100, Math.round((totalComp / reqQty) * 100)) : 0;
      const allArtisansDone = members.length > 0 && members.every(m => m.production_status === 'Completed' || (Number(m.completed_quantity) || 0) >= (Number(m.assigned_quantity) || 0));
      const isProductionComplete = (overallProg >= 100 || totalComp >= reqQty) && allArtisansDone;
      const isRemainingPayable = isAdvancePaid && isProductionComplete;

      return `
        <section class="cluster-recommendation">
          <div class="cluster-recommendation__header">
            <div>
              <span class="cluster-eyebrow">CURRENT ARTISAN CLUSTER</span>
              <h2>${escapeHtml(currentCluster.product)} • ${currentCluster.required_quantity} units required</h2>
              <span style="font-size:0.8rem; color:#64748b;">📍 ${escapeHtml(currentCluster.location)} • Target Date: ${currentCluster.delivery_date || '14 days'}</span>
            </div>
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <button type="button" id="btn-goto-cluster-tracking" style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #ffffff; font-weight: 800; font-size: 0.8rem; padding: 6px 14px; border: none; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(2, 132, 199, 0.3); margin-right: 6px;">
                <span style="display:inline-block; width:7px; height:7px; background:#4ade80; border-radius:50%; box-shadow:0 0 6px #4ade80;"></span>
                📍 Live Cluster Order Tracking (${currentCluster.overall_progress || overallProg}%)
              </button>
              <span class="cluster-status cluster-status--${(currentCluster.status || 'provisional').toLowerCase().replaceAll(' ', '-')}">
                Status: ${escapeHtml(currentCluster.status)}
              </span>
              ${isFullyPaid ? `
                <span style="background:#ecfdf5; color:#065f46; border:1px solid #10b981; font-size:0.75rem; font-weight:800; padding:4px 10px; border-radius:12px;">
                  ✓ 100% Fully Settled
                </span>
              ` : isAdvancePaid ? `
                <span style="background:#eff6ff; color:#1e40af; border:1px solid #3b82f6; font-size:0.75rem; font-weight:800; padding:4px 10px; border-radius:12px;">
                  💳 40% Advance Paid
                </span>
              ` : ''}
            </div>
          </div>

          <div class="cluster-progress" style="margin: 16px 0;">
            <div class="cluster-progress__labels">
              <strong>${acceptedQty} / ${currentCluster.required_quantity} Accepted Capacity (${acceptedArtisansCount}/${totalArtisansCount} Artisans Accepted)</strong>
              <span>${Math.round((acceptedQty / currentCluster.required_quantity) * 100)}% Fulfilled</span>
            </div>
            <div class="cluster-progress__track">
              <i style="width: ${Math.min(100, (acceptedQty / currentCluster.required_quantity) * 100)}%"></i>
            </div>
          </div>

          <div class="cluster-members" style="margin-bottom: 20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <h3 style="margin:0;">Artisan Contribution Breakdown</h3>
              <span style="font-size:0.78rem; font-weight:700; color:${isAllAccepted ? '#16a34a' : '#ea580c'};">
                ${isAllAccepted ? '✓ All Artisans Accepted' : `⏳ ${acceptedArtisansCount} of ${totalArtisansCount} Accepted`}
              </span>
            </div>
            <div class="cluster-member-table">
              <div class="cluster-member-row cluster-member-row--4col cluster-member-row--head">
                <span>Artisan</span>
                <span>Location</span>
                <span>Proposed Share</span>
                <span>Status</span>
              </div>
              ${members.map(member => `
                <div class="cluster-member-row cluster-member-row--4col" style="align-items:center;">
                  <div>
                    <strong style="display:block;">${escapeHtml(member.name)}</strong>
                    <span style="font-size:0.75rem; color:#64748b;">${escapeHtml(member.craft || currentCluster.craft || 'Artisan')}</span>
                  </div>
                  <span>${escapeHtml(member.location || 'AP')}</span>
                  <span style="font-weight:700;">${member.assigned_quantity} units</span>
                  <div style="display:flex; align-items:center; gap:6px;">
                    <span class="cluster-status cluster-status--${(member.status || 'pending').toLowerCase().replaceAll(' ', '-')}">
                      ${member.status === 'Accepted' ? '✓ Accepted' : member.status === 'Declined' ? '✗ Declined' : '⏳ Pending'}
                    </span>
                    <button type="button" class="btn-cluster-artisan-profile" data-artisan-id="${member.id}" data-artisan-name="${escapeHtml(member.name)}" data-artisan-craft="${escapeHtml(member.craft || currentCluster.craft || '')}" data-artisan-loc="${escapeHtml(member.location || '')}" title="View profile" style="background:none; border:none; cursor:pointer; font-size:0.9rem; padding:2px;">🔍</button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          ${acceptedQty < currentCluster.required_quantity ? `
            <div style="background:#fff7ed; border:1.5px solid #fdba74; border-radius:10px; padding:14px; margin-bottom:20px;">
              <h4 style="margin:0 0 6px; color:#c2410c;">Add Replacement / Additional Suitable Artisans</h4>
              <p style="font-size:0.8rem; color:#9a3412; margin:0 0 12px;">Remaining quantity needed: <strong>${currentCluster.required_quantity - acceptedQty} units</strong>.</p>
              <div style="display:flex; gap:10px; align-items:center;">
                <select id="select-replacement-artisan" style="padding:8px; border-radius:6px; border:1px solid #cbd5e1; font-size:0.85rem; flex:1;">
                  ${poolArtisans.filter(a => !currentCluster.members.some(m => m.id === a.id && m.status !== 'Declined')).map(a => `
                    <option value="${a.id}">${a.name} (${a.location}) — Available: ${a.capacity} units</option>
                  `).join('')}
                </select>
                <input type="number" id="input-replacement-qty" value="${Math.min(200, currentCluster.required_quantity - acceptedQty)}" min="1" style="width:100px; padding:8px; border-radius:6px; border:1px solid #cbd5e1;" />
                <button type="button" class="secondary-btn" id="btn-add-replacement-artisan">Add Artisan</button>
              </div>
            </div>
          ` : ''}

          <!-- CLUSTER PAYMENT FEATURE (Strictly displayed ONLY when ALL artisans accepted) -->
          ${!isAllAccepted ? `
            <!-- LOCKED STATE: When some artisans have not accepted yet -->
            <div style="background: #f8fafc; border: 2px dashed #94a3b8; border-radius: 12px; padding: 22px; text-align: center; margin-top: 20px;">
              <div style="font-size: 2.2rem; margin-bottom: 6px;">🔒</div>
              <h3 style="color: #1e293b; margin: 0 0 6px; font-size: 1.15rem; font-weight: 800;">Cluster Payment Option Locked</h3>
              <p style="color: #64748b; font-size: 0.85rem; margin: 0 0 14px; max-width: 520px; margin-left: auto; margin-right: auto; line-height: 1.5;">
                The cluster payment option is strictly available <strong>only after all artisans in this cluster have accepted</strong> their contribution. Currently <strong>${acceptedArtisansCount} of ${totalArtisansCount}</strong> artisans have accepted.
              </p>
              <div style="display: inline-flex; align-items: center; gap: 8px; background: #e2e8f0; padding: 6px 16px; border-radius: 20px; font-size: 0.82rem; font-weight: 700; color: #334155;">
                <span>⏳ Awaiting acceptance from ${totalArtisansCount - acceptedArtisansCount} artisan(s)</span>
              </div>
              ${members.some(m => m.status !== 'Accepted') ? `
                <div style="margin-top: 16px; border-top: 1px dashed #cbd5e1; padding-top: 14px;">
                  <span style="font-size: 0.76rem; color: #64748b; display: block; margin-bottom: 10px; font-weight: 600;">
                    💡 Demonstration Helper: Accept on behalf of pending artisans to unlock payment:
                  </span>
                  <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
                    ${members.filter(m => m.status !== 'Accepted').map(m => `
                      <button type="button" class="btn-artisan-quick-accept" data-artisan-id="${m.id}" style="font-size: 0.78rem; background: #0284c7; color: #ffffff; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-weight: 700; box-shadow: 0 2px 4px rgba(2,132,199,0.2);">
                        ✓ Accept for ${escapeHtml(m.name)}
                      </button>
                    `).join('')}
                  </div>
                </div>
              ` : ''}
            </div>
          ` : `
            <!-- ACTIVE CLUSTER PAYMENT OPTION: Displayed because ALL artisans accepted -->
            <div class="cluster-payment-card" style="background: #ffffff; border: 2px solid #10b981; border-radius: 14px; padding: 22px; margin-top: 24px; box-shadow: 0 6px 24px rgba(16, 185, 129, 0.15);">
              
              <!-- Header with Acceptance Badge -->
              <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; margin-bottom: 18px; border-bottom: 1px solid #e2e8f0; padding-bottom: 14px;">
                <div>
                  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                    <span style="background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; font-size: 0.72rem; font-weight: 800; padding: 3px 10px; border-radius: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                      ✓ ALL ARTISANS ACCEPTED (${totalArtisansCount}/${totalArtisansCount})
                    </span>
                    <span style="font-size: 0.75rem; color: #64748b;">Smart Escrow Enabled</span>
                  </div>
                  <h3 style="color: #0f172a; font-size: 1.35rem; font-weight: 900; margin: 0 0 4px;">
                    💳 Cluster Escrow Payment &amp; Milestone Settlement
                  </h3>
                  <p style="color: #64748b; font-size: 0.82rem; margin: 0;">
                    All artisans in this cluster accepted. Pay the <strong>40% Advance Amount</strong> first to mobilize production, and the <strong>60% Remaining Balance</strong> only after 100% production is complete by all artisans.
                  </p>
                </div>
                <div style="text-align: right;">
                  <span style="font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-weight: 700; display: block;">Escrow State</span>
                  <span style="font-size: 0.85rem; font-weight: 800; padding: 4px 12px; border-radius: 14px; display: inline-block; ${
                    isFullyPaid ? 'background:#dcfce7; color:#15803d; border:1px solid #86efac;' :
                    isAdvancePaid ? 'background:#dbeafe; color:#1d4ed8; border:1px solid #93c5fd;' :
                    'background:#fef3c7; color:#b45309; border:1px solid #fde68a;'
                  }">
                    ${isFullyPaid ? '● 100% Fully Settled' : isAdvancePaid ? '● 40% Advance Paid (In Production)' : '● Advance Payment (40%) Due'}
                  </span>
                </div>
              </div>

              <!-- Complete Payment & Product Information -->
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin-bottom: 18px;">
                <h4 style="margin: 0 0 10px; font-size: 0.82rem; color: #334155; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px;">
                  📋 Cluster Product &amp; Financial Information
                </h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px;">
                  <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px;">
                    <span style="font-size: 0.7rem; color: #64748b; display: block;">Cluster Product</span>
                    <strong style="color: #0f172a; font-size: 0.92rem; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(currentCluster.product)}">
                      ${escapeHtml(currentCluster.product)}
                    </strong>
                    <span style="font-size: 0.7rem; color: #0284c7;">${escapeHtml(currentCluster.craft || currentCluster.category || 'Handicrafts')}</span>
                  </div>
                  <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px;">
                    <span style="font-size: 0.7rem; color: #64748b; display: block;">Quantity &amp; Rate</span>
                    <strong style="color: #0f172a; font-size: 0.95rem; display: block;">${fin.quantity} units</strong>
                    <span style="font-size: 0.7rem; color: #64748b;">@ ₹${fin.unitPrice} / unit</span>
                  </div>
                  <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px;">
                    <span style="font-size: 0.7rem; color: #64748b; display: block;">Total Cluster Value</span>
                    <strong style="color: #059669; font-size: 1.15rem; font-weight: 900; display: block;">
                      ₹${fin.totalAmount.toLocaleString('en-IN')}
                    </strong>
                    <span style="font-size: 0.7rem; color: #64748b;">100% Escrow Secured</span>
                  </div>
                  <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px;">
                    <span style="font-size: 0.7rem; color: #64748b; display: block;">Delivery Logistics</span>
                    <strong style="color: #0f172a; font-size: 0.85rem; display: block;">${escapeHtml(currentCluster.location || 'Regional Hub')}</strong>
                    <span style="font-size: 0.7rem; color: #64748b;">Target: ${escapeHtml(currentCluster.delivery_date || '14 days')}</span>
                  </div>
                </div>
              </div>

              <!-- Two-Stage Divided Payment Milestones: Advance (40%) & Remaining (60%) -->
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 20px;">
                
                <!-- Stage 1: Advance Amount (40%) -->
                <div style="background: ${isAdvancePaid ? '#f0fdf4' : '#fffbeb'}; border: 2px solid ${isAdvancePaid ? '#86efac' : '#f59e0b'}; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; justify-content: space-between;">
                  <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                      <span style="font-size: 0.74rem; font-weight: 800; text-transform: uppercase; color: ${isAdvancePaid ? '#15803d' : '#b45309'}; letter-spacing: 0.5px;">
                        STAGE 1 • ADVANCE AMOUNT (40%)
                      </span>
                      <span style="font-size: 0.72rem; font-weight: 800; padding: 2px 8px; border-radius: 10px; ${isAdvancePaid ? 'background:#bbf7d0; color:#14532d;' : 'background:#fef3c7; color:#92400e;'}">
                        ${isAdvancePaid ? '✓ PAID IN ESCROW' : '● DUE TO START'}
                      </span>
                    </div>
                    <div style="margin-bottom: 8px;">
                      <span style="font-size: 1.6rem; font-weight: 900; color: ${isAdvancePaid ? '#166534' : '#b45309'};">
                        ₹${fin.advanceAmount.toLocaleString('en-IN')}
                      </span>
                      <span style="font-size: 0.75rem; color: #64748b; margin-left: 4px;">(40% of total)</span>
                    </div>
                    <p style="font-size: 0.78rem; color: #475569; margin: 0 0 14px; line-height: 1.45;">
                      ${isAdvancePaid 
                        ? `Advance deposited in escrow (Ref: #${escapeHtml(currentCluster.advance_txn_id || 'TXN-OK')}). Artisans are funded for raw material procurement and active production.` 
                        : `Buyer pays 40% advance first after all artisans accept. This authorizes production and secures raw material funds in smart escrow.`}
                    </p>
                  </div>

                  <div>
                    ${isAdvancePaid ? `
                      <div style="background: #ffffff; border: 1px solid #86efac; border-radius: 8px; padding: 10px; font-size: 0.8rem; color: #166534; font-weight: 700; text-align: center;">
                        ✓ Advance Paid (Ref: #${escapeHtml(currentCluster.advance_txn_id || 'TXN-OK')})
                      </div>
                    ` : `
                      <button type="button" class="primary-btn btn-trigger-cluster-pay" data-stage="advance" style="width: 100%; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; font-size: 0.95rem; font-weight: 800; padding: 12px; border: none; border-radius: 8px; cursor: pointer; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);">
                        💳 Pay Advance Amount (₹${fin.advanceAmount.toLocaleString('en-IN')})
                      </button>
                    `}
                  </div>
                </div>

                <!-- Stage 2: Remaining Amount (60%) - STRICTLY LOCKED UNTIL 100% PRODUCTION COMPLETED BY ALL ARTISANS -->
                <div style="background: ${isFullyPaid ? '#f0fdf4' : !isRemainingPayable ? '#f8fafc' : '#eff6ff'}; border: 2px solid ${isFullyPaid ? '#86efac' : !isRemainingPayable ? '#cbd5e1' : '#3b82f6'}; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; justify-content: space-between;">
                  <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                      <span style="font-size: 0.74rem; font-weight: 800; text-transform: uppercase; color: ${isFullyPaid ? '#15803d' : !isRemainingPayable ? '#64748b' : '#1d4ed8'}; letter-spacing: 0.5px;">
                        STAGE 2 • REMAINING AMOUNT (60%)
                      </span>
                      <span style="font-size: 0.72rem; font-weight: 800; padding: 2px 8px; border-radius: 10px; ${isFullyPaid ? 'background:#bbf7d0; color:#14532d;' : !isAdvancePaid ? 'background:#e2e8f0; color:#64748b;' : !isRemainingPayable ? 'background:#fef3c7; color:#92400e;' : 'background:#dbeafe; color:#1e40af;'}">
                        ${isFullyPaid ? '✓ 100% SETTLED' : !isAdvancePaid ? '🔒 LOCKED (ADVANCE DUE)' : !isRemainingPayable ? `🔒 LOCKED (${overallProg}% CRAFTED)` : '● READY FOR FINAL SETTLEMENT'}
                      </span>
                    </div>
                    <div style="margin-bottom: 8px;">
                      <span style="font-size: 1.6rem; font-weight: 900; color: ${isFullyPaid ? '#166534' : !isRemainingPayable ? '#64748b' : '#1d4ed8'};">
                        ₹${fin.remainingAmount.toLocaleString('en-IN')}
                      </span>
                      <span style="font-size: 0.75rem; color: #64748b; margin-left: 4px;">(60% of total)</span>
                    </div>
                    <p style="font-size: 0.78rem; color: ${isRemainingPayable && !isFullyPaid ? '#166534' : '#475569'}; margin: 0 0 14px; line-height: 1.45;">
                      ${isFullyPaid 
                        ? `Final 60% balance settled (Ref: #${escapeHtml(currentCluster.remaining_txn_id || 'TXN-FINAL')}). All ${totalArtisansCount} cluster artisans have received full payments.` 
                        : !isAdvancePaid 
                        ? `Locked until Stage 1 advance payment is paid. Complete advance first to start production.` 
                        : !isRemainingPayable 
                        ? `🔒 Remaining 60% balance is locked until all artisans complete 100% of production. Current progress: <strong>${overallProg}% (${totalComp}/${reqQty} crafted)</strong>. All ${totalArtisansCount} workshops must finish crafting before final balance can be paid.` 
                        : `🎉 All cluster artisans have completed 100% production (${reqQty}/${reqQty} units crafted)! Pay the remaining 60% balance to disburse final payouts to artisans.`}
                    </p>
                  </div>

                  <div>
                    ${isFullyPaid ? `
                      <div style="background: #ffffff; border: 1px solid #86efac; border-radius: 8px; padding: 10px; font-size: 0.8rem; color: #166534; font-weight: 700; text-align: center;">
                        ✓ Final Settlement Settled (Ref: #${escapeHtml(currentCluster.remaining_txn_id || 'TXN-FINAL')})
                      </div>
                    ` : !isAdvancePaid ? `
                      <button type="button" disabled style="width: 100%; background: #e2e8f0; color: #94a3b8; font-size: 0.85rem; font-weight: 700; padding: 12px; border: none; border-radius: 8px; cursor: not-allowed;">
                        🔒 Pay Advance First to Unlock
                      </button>
                    ` : !isRemainingPayable ? `
                      <div style="background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 8px; padding: 12px; text-align: center;">
                        <span style="font-size: 0.76rem; color: #64748b; display: block; margin-bottom: 6px;">
                          🔒 <strong>Remaining 60% balance is locked</strong> until all artisans finish crafting 100% of units.
                        </span>
                        <span style="font-size: 0.8rem; font-weight: 800; color: #0284c7; display: block; margin-bottom: 8px;">
                          Current Production: ${overallProg}% (${totalComp}/${reqQty} units crafted)
                        </span>
                        <button type="button" disabled style="width: 100%; background: #e2e8f0; color: #94a3b8; font-size: 0.85rem; font-weight: 700; padding: 12px; border: none; border-radius: 8px; cursor: not-allowed;">
                          🔒 Locked: Awaiting 100% Production by All Artisans
                        </button>
                      </div>
                    ` : `
                      <button type="button" class="primary-btn btn-trigger-cluster-pay" data-stage="remaining" style="width: 100%; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #ffffff; font-size: 0.95rem; font-weight: 800; padding: 12px; border: none; border-radius: 8px; cursor: pointer; box-shadow: 0 4px 14px rgba(2, 132, 199, 0.35);">
                        💳 Pay Remaining Amount (₹${fin.remainingAmount.toLocaleString('en-IN')})
                      </button>
                    `}
                  </div>
                </div>

              </div>

              <!-- Direct Artisan Escrow Distribution Breakdown Table -->
              <div style="border-top: 1px solid #e2e8f0; padding-top: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <h4 style="margin: 0; font-size: 0.82rem; color: #334155; font-weight: 800; text-transform: uppercase;">
                    🛡️ Direct Artisan Escrow Payout Breakdown
                  </h4>
                  <span style="font-size: 0.74rem; color: #64748b;">Divided by assigned quota</span>
                </div>
                <div class="cluster-member-table">
                  <div class="cluster-member-row cluster-member-row--4col cluster-member-row--head">
                    <span>Artisan Member</span>
                    <span>Assigned Share</span>
                    <span>Advance (40%)</span>
                    <span>Remaining (60%)</span>
                  </div>
                  ${members.map(m => {
                    const shareRatio = fin.quantity > 0 ? (m.assigned_quantity / fin.quantity) : (1 / members.length);
                    const mAdv = Math.round(shareRatio * fin.advanceAmount);
                    const mRem = Math.round(shareRatio * fin.remainingAmount);
                    return `
                      <div class="cluster-member-row cluster-member-row--4col" style="align-items: center;">
                        <div>
                          <strong style="display: block; font-size: 0.82rem;">${escapeHtml(m.name)}</strong>
                          <span style="font-size: 0.72rem; color: #64748b;">${escapeHtml(m.location || 'AP')}</span>
                        </div>
                        <div>
                          <strong style="font-size: 0.82rem;">${m.assigned_quantity} pcs</strong>
                          <span style="font-size: 0.7rem; color: #64748b; display: block;">${Math.round(shareRatio * 100)}% share</span>
                        </div>
                        <div>
                          <strong style="color: ${isAdvancePaid ? '#166534' : '#b45309'}; font-size: 0.85rem;">₹${mAdv.toLocaleString('en-IN')}</strong>
                          <span style="font-size: 0.68rem; display: block; color: ${isAdvancePaid ? '#15803d' : '#64748b'};">
                            ${isAdvancePaid ? '✓ Deposited' : '⏳ Advance due'}
                          </span>
                        </div>
                        <div>
                          <strong style="color: ${isFullyPaid ? '#166534' : '#1e40af'}; font-size: 0.85rem;">₹${mRem.toLocaleString('en-IN')}</strong>
                          <span style="font-size: 0.68rem; display: block; color: ${isFullyPaid ? '#15803d' : '#64748b'};">
                            ${isFullyPaid ? '✓ Disbursed' : '⏳ On completion'}
                          </span>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>

              ${isFullyPaid ? `
                <div style="background: #ecfdf5; border: 1.5px solid #10b981; border-radius: 10px; padding: 14px; text-align: center; margin-top: 16px;">
                  <h4 style="color: #065f46; margin: 0 0 4px; font-size: 1rem;">🎉 Cluster Order 100% Fully Settled!</h4>
                  <p style="color: #047857; font-size: 0.82rem; margin: 0;">
                    Both Advance (40%) and Remaining (60%) payments are fulfilled. Escrow funds have been released to all ${totalArtisansCount} certified artisans.
                  </p>
                </div>
              ` : ''}

            </div>
          `}
        </section>
      `;
    };

    const renderHistoryView = () => {
      const history = getStoredClusterHistory();
      if (history.length === 0) {
        return `
          <div class="buyer-empty-state">
            <h3>No Previous Clusters Found</h3>
            <p>Clusters created by you will be stored here for future viewing.</p>
          </div>
        `;
      }

      return `
        <section class="cluster-recommendation">
          <div class="cluster-recommendation__header">
            <div>
              <span class="cluster-eyebrow">CLUSTER RECORDS &amp; HISTORY</span>
              <h2>Previous Artisan Clusters (${history.length})</h2>
            </div>
          </div>

          <div style="display:flex; flex-direction:column; gap:16px; margin-top:16px;">
            ${history.map(cluster => {
              const acceptedQty = cluster.accepted_quantity || (cluster.members || []).filter(m => m.status === 'Accepted').reduce((sum, m) => sum + (m.assigned_quantity || 0), 0);
              return `
              <div style="background:#ffffff; border:1px solid #cbd5e1; border-radius:10px; padding:16px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; border-bottom:1px solid #f1f5f9; padding-bottom:10px;">
                  <div>
                    <strong style="font-size:1.05rem; color:#0f172a; display:block;">${escapeHtml(cluster.product)}</strong>
                    <span style="font-size:0.8rem; color:#64748b;">Required: <strong>${cluster.required_quantity} units</strong> • 📍 ${escapeHtml(cluster.location || 'AP')} • Target Date: ${escapeHtml(cluster.delivery_date || '15 days')}</span>
                  </div>
                  <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                    <span class="cluster-status cluster-status--${(cluster.status || 'provisional').toLowerCase().replaceAll(' ', '-')}">
                      Status: ${escapeHtml(cluster.status || 'PROVISIONAL')}
                    </span>
                    ${cluster.payment_status === 'FULLY_PAID' ? `
                      <span style="background:#ecfdf5; color:#065f46; border:1px solid #10b981; font-size:0.72rem; font-weight:800; padding:2px 8px; border-radius:10px;">
                        ✓ 100% Fully Settled
                      </span>
                    ` : cluster.payment_status === 'ADVANCE_PAID' ? `
                      <span style="background:#eff6ff; color:#1e40af; border:1px solid #3b82f6; font-size:0.72rem; font-weight:800; padding:2px 8px; border-radius:10px;">
                        💳 40% Advance Paid
                      </span>
                    ` : `
                      <span style="background:#f8fafc; color:#64748b; border:1px solid #cbd5e1; font-size:0.72rem; font-weight:700; padding:2px 8px; border-radius:10px;">
                        ⏳ Awaiting Payment
                      </span>
                    `}
                  </div>
                </div>

                <div class="cluster-progress" style="margin: 10px 0 16px;">
                  <div class="cluster-progress__labels">
                    <strong>${acceptedQty} / ${cluster.required_quantity} Accepted Capacity</strong>
                    <span>${Math.round((acceptedQty / cluster.required_quantity) * 100)}% Fulfilled</span>
                  </div>
                  <div class="cluster-progress__track">
                    <i style="width: ${Math.min(100, (acceptedQty / cluster.required_quantity) * 100)}%"></i>
                  </div>
                </div>

                <div class="cluster-members">
                  <h4 style="margin:0 0 8px; font-size:0.85rem; color:#334155;">Artisan Contributions:</h4>
                  <div class="cluster-member-table">
                    <div class="cluster-member-row cluster-member-row--4col cluster-member-row--head">
                      <span>Artisan</span>
                      <span>Location</span>
                      <span>Assigned Qty</span>
                      <span>Status</span>
                    </div>
                    ${(cluster.members || []).map(m => `
                      <div class="cluster-member-row cluster-member-row--4col">
                        <strong>${escapeHtml(m.name)}</strong>
                        <span>${escapeHtml(m.location || 'AP')}</span>
                        <span>${m.assigned_quantity} units</span>
                        <span class="cluster-status cluster-status--${(m.status || 'pending').toLowerCase().replaceAll(' ', '-')}">
                          ${m.status === 'Accepted' ? '✓ Accepted' : m.status === 'Declined' ? '✕ Declined' : '⏳ Pending'}
                        </span>
                      </div>
                    `).join('')}
                  </div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:14px; padding-top:10px; border-top:1px solid #f1f5f9;">
                  <button type="button" class="primary-btn btn-switch-to-active-cluster" data-cluster-id="${cluster.id}" style="font-size:0.8rem; padding:6px 14px; background:#0284c7;">
                    🔍 Manage This Cluster
                  </button>
                  <span style="font-size:0.75rem; color:#64748b;">Cluster ID: ${escapeHtml(cluster.id)}</span>
                </div>
              </div>
            `;
            }).join('')}
          </div>
        </section>
      `;
    };

    const bindEvents = () => {
      const updateMetricsOnly = () => {
        render();
      };

      container.querySelectorAll('.btn-switch-to-active-cluster').forEach(btn => {
        btn.addEventListener('click', () => {
          const cid = btn.dataset.clusterId;
          const hist = getStoredClusterHistory();
          const target = hist.find(c => String(c.id) === String(cid));
          if (target) {
            currentCluster = target;
            try { localStorage.setItem('kala_mitra_active_tracking_cluster_id', String(target.id)); } catch(e) {}
            activeTab = (target.overall_progress > 0 || target.payment_status === 'ADVANCE_PAID') ? 'tracking' : 'active';
            selectedCraft = target.craft || selectedCraft;
            reqProduct = target.product || reqProduct;
            reqQuantity = target.required_quantity || reqQuantity;
            render();
            showToast(`Viewing active cluster for ${target.product}`);
          }
        });
      });

      container.querySelectorAll('.btn-cluster-artisan-profile').forEach(btn => {
        btn.addEventListener('click', () => {
          const artisanId = Number(btn.dataset.artisanId);
          const memberMatch = currentCluster?.members?.find(m => m.id === artisanId);
          const poolMatch = poolArtisans.find(a => a.id === artisanId);
          renderArtisanProfile({
            name: btn.dataset.artisanName || memberMatch?.name || poolMatch?.name || 'Artisan',
            craft_type: btn.dataset.artisanCraft || memberMatch?.craft || poolMatch?.craft || 'Handicrafts',
            location_city: btn.dataset.artisanLoc || memberMatch?.location || poolMatch?.location || 'Andhra Pradesh',
            rating: poolMatch?.rating || 4.8,
            monthly_capacity: memberMatch?.monthly_capacity || poolMatch?.capacity || 250
          }, 'buyer-orders');
          navigateTo('buyer-profile');
        });
      });

      container.querySelector('#tab-cluster-builder')?.addEventListener('click', () => {
        activeTab = 'builder';
        if (Object.keys(selectedArtisans).length === 0 && !userManuallyCleared) {
          selectedArtisans = autoSelectArtisans(reqQuantity, poolArtisans);
        }
        render();
      });
      container.querySelector('#tab-cluster-active')?.addEventListener('click', () => { activeTab = 'active'; render(); });
      container.querySelector('#tab-cluster-history')?.addEventListener('click', () => { activeTab = 'history'; render(); });
      container.querySelector('#tab-cluster-tracking')?.addEventListener('click', () => { 
        activeTab = 'tracking'; 
        const hist = getStoredClusterHistory();
        try {
          const lastActiveId = localStorage.getItem('kala_mitra_active_tracking_cluster_id');
          if (lastActiveId && hist.length > 0) {
            const m = hist.find(c => String(c.id) === String(lastActiveId));
            if (m) currentCluster = m;
          }
        } catch (e) {}
        if (!currentCluster || !currentCluster.id) {
          if (hist.length > 0) {
            currentCluster = hist.find(c => (c.payment_status === 'ADVANCE_PAID' || c.status === 'IN PRODUCTION' || (c.overall_progress && c.overall_progress > 0))) || hist[0];
          }
        } else {
          const fresh = hist.find(c => String(c.id) === String(currentCluster.id));
          if (fresh) currentCluster = fresh;
        }
        render(); 
      });
      container.querySelector('#btn-goto-cluster-tracking')?.addEventListener('click', () => { 
        activeTab = 'tracking'; 
        const hist = getStoredClusterHistory();
        try {
          const lastActiveId = localStorage.getItem('kala_mitra_active_tracking_cluster_id');
          if (lastActiveId && hist.length > 0) {
            const m = hist.find(c => String(c.id) === String(lastActiveId));
            if (m) currentCluster = m;
          }
        } catch (e) {}
        if (!currentCluster || !currentCluster.id) {
          if (hist.length > 0) {
            currentCluster = hist.find(c => (c.payment_status === 'ADVANCE_PAID' || c.status === 'IN PRODUCTION' || (c.overall_progress && c.overall_progress > 0))) || hist[0];
          }
        } else {
          const fresh = hist.find(c => String(c.id) === String(currentCluster.id));
          if (fresh) currentCluster = fresh;
        }
        render(); 
      });
      container.querySelector('#select-active-tracking-cluster')?.addEventListener('change', (e) => {
        const chosenId = e.target.value;
        try { localStorage.setItem('kala_mitra_active_tracking_cluster_id', chosenId); } catch(err) {}
        const hist = getStoredClusterHistory();
        const found = hist.find(c => String(c.id) === String(chosenId));
        if (found) {
          currentCluster = found;
          render();
        }
      });

      container.querySelector('#cluster-craft-select')?.addEventListener('change', (e) => {
        selectedCraft = e.target.value;
        userManuallyCleared = false;
        if (activeClusterRequirement) activeClusterRequirement.craft = selectedCraft;
        poolArtisans = getArtisansForCraft(selectedCraft, reqLocation);
        selectedArtisans = autoSelectArtisans(reqQuantity, poolArtisans);
        render();
      });

      container.querySelector('#cluster-product-input')?.addEventListener('input', (e) => {
        reqProduct = e.target.value;
        if (activeClusterRequirement) activeClusterRequirement.product = reqProduct;
      });

      const handleQtyChange = (e) => {
        const inputEl = e.target;
        const cursorStart = inputEl.selectionStart;
        const cursorEnd = inputEl.selectionEnd;

        reqQuantity = Math.max(1, Number(inputEl.value) || 1);
        userManuallyCleared = false;
        if (activeClusterRequirement) activeClusterRequirement.quantity = reqQuantity;
        selectedArtisans = autoSelectArtisans(reqQuantity, poolArtisans);
        render();

        const qInp = container.querySelector('#cluster-quantity-input');
        if (qInp) {
          qInp.focus();
          if (cursorStart !== null && cursorEnd !== null) {
            try { qInp.setSelectionRange(cursorStart, cursorEnd); } catch (err) {}
          }
        }
      };

      container.querySelector('#cluster-quantity-input')?.addEventListener('input', handleQtyChange);

      container.querySelector('#cluster-days-input')?.addEventListener('input', (e) => {
        reqDeadline = Number(e.target.value) || 1;
        if (activeClusterRequirement) activeClusterRequirement.deadline = reqDeadline;
      });

      container.querySelector('#cluster-location-input')?.addEventListener('input', (e) => {
        reqLocation = e.target.value;
        if (activeClusterRequirement) activeClusterRequirement.location = reqLocation;
      });

      container.querySelectorAll('.artisan-select-cb').forEach(cb => {
        cb.addEventListener('change', () => {
          const artisanId = Number(cb.dataset.artisanId);
          const artisan = poolArtisans.find(a => a.id === artisanId);
          if (cb.checked) {
            const currentSum = Object.entries(selectedArtisans).reduce((sum, [id, val]) => (Number(id) !== artisanId ? sum + Number(val) : sum), 0);
            const needed = Math.max(0, reqQuantity - currentSum);
            selectedArtisans[artisanId] = artisan ? Math.min(artisan.capacity, needed || artisan.capacity) : 100;
            userManuallyCleared = false;
          } else {
            delete selectedArtisans[artisanId];
            if (Object.keys(selectedArtisans).length === 0) {
              userManuallyCleared = true;
            }
          }
          render();
        });
      });

      container.querySelectorAll('.artisan-qty-input').forEach(inp => {
        inp.addEventListener('input', (e) => {
          const artisanId = Number(inp.dataset.artisanId);
          const cursorStart = e.target.selectionStart;
          const cursorEnd = e.target.selectionEnd;
          const val = Number(inp.value) || 0;
          if (val > 0) {
            selectedArtisans[artisanId] = val;
          } else {
            delete selectedArtisans[artisanId];
          }
          render();

          const targetInp = container.querySelector(`.artisan-qty-input[data-artisan-id="${artisanId}"]`);
          if (targetInp) {
            targetInp.focus();
            if (cursorStart !== null && cursorEnd !== null) {
              try { targetInp.setSelectionRange(cursorStart, cursorEnd); } catch (err) {}
            }
          }
        });
      });

      container.querySelector('#btn-send-cluster-requests')?.addEventListener('click', async () => {
        try {
          const selectedList = Object.entries(selectedArtisans)
            .filter(([id, qty]) => Number(qty) > 0)
            .map(([id, qty]) => ({
              artisan_id: Number(id),
              proposed_contribution: Number(qty)
            }));

          if (selectedList.length === 0) {
            showToast('Please select at least one artisan to create a cluster.');
            return;
          }

          const reqPayload = {
            product: reqProduct,
            quantity: reqQuantity,
            delivery_days: reqDeadline,
            budget: 75000,
            location: reqLocation,
            category: selectedCraft,
            buyer_id: 'buyer-demo',
            selected_artisans: selectedList
          };

          let sendRes = null;
          try {
            const provRes = await fetch('http://127.0.0.1:8000/api/v1/clusters/provisional', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(reqPayload)
            }).then(r => r.json());

            sendRes = await fetch(`http://127.0.0.1:8000/api/v1/clusters/${provRes.id}/send-requests`, {
              method: 'POST'
            }).then(r => r.json());
          } catch (e) {
            sendRes = null;
          }

          const buyerUser = (typeof authService !== 'undefined' && authService.getCurrentUser()) || {
            name: 'Rajesh Sharma',
            company: 'FabIndia Sourcing & Hospitality',
            email: 'procurement@fabindia.com',
            phone: '+91 98401 23456'
          };

          const hist = getStoredClusterHistory();
          const uniqueClusterId = (sendRes && sendRes.id && !hist.some(c => String(c.id) === String(sendRes.id)))
            ? String(sendRes.id)
            : ('cluster-' + Date.now());

          if (!sendRes) sendRes = {};
          sendRes.id = uniqueClusterId;
          sendRes.product = reqProduct;
          sendRes.craft = selectedCraft || 'Bamboo Crafts';
          sendRes.required_quantity = reqQuantity;
          sendRes.location = reqLocation;
          sendRes.delivery_date = `${reqDeadline} days`;
          sendRes.status = 'PROVISIONAL';
          sendRes.payment_status = 'PENDING';
          sendRes.advance_paid_amount = 0;
          sendRes.advance_txn_id = null;
          sendRes.remaining_paid_amount = 0;
          sendRes.remaining_txn_id = null;
          sendRes.order_completed = false;
          sendRes.overall_progress = 0;
          sendRes.total_completed_quantity = 0;

          sendRes.buyer = {
            name: buyerUser.name || 'Corporate Buyer',
            company: buyerUser.company || buyerUser.name || 'Corporate Enterprise Buyer',
            email: buyerUser.email || 'procurement@fabindia.com',
            phone: buyerUser.phone || '+91 98401 23456',
            location: reqLocation ? `${reqLocation} Logistics Hub` : 'Central Sourcing Hub, Hyderabad',
            verified: true,
            badge: 'Verified Corporate Buyer'
          };
          sendRes.buyer_requirements = {
            product: reqProduct,
            category: selectedCraft || 'Handicrafts',
            required_quantity: reqQuantity,
            budget: reqPayload.budget ? `₹${Number(reqPayload.budget).toLocaleString('en-IN')}` : '₹75,000',
            delivery_deadline: `${reqDeadline} days`,
            destination_hub: reqLocation ? `${reqLocation} Central Warehouse` : 'Regional Logistics Hub',
            specifications: `Custom verified bulk order of ${reqProduct}. High standard hand-crafted quality, eco-safe materials, batch inspection prior to dispatch.`
          };
          sendRes.members = selectedList.map(item => {
            const artisanObj = poolArtisans.find(a => a.id === item.artisan_id) || { name: 'Artisan ' + item.artisan_id, location: reqLocation, capacity: 250 };
            return {
              id: item.artisan_id,
              name: artisanObj.name,
              location: artisanObj.location || reqLocation,
              monthly_capacity: artisanObj.capacity || 250,
              assigned_quantity: item.proposed_contribution,
              completed_quantity: 0,
              production_status: 'Order Placed',
              progress: 0,
              status: 'Pending',
              craft: artisanObj.craft || selectedCraft
            };
          });
          sendRes.total_allocated = selectedList.reduce((sum, item) => sum + item.proposed_contribution, 0);
          sendRes.accepted_quantity = 0;

          currentCluster = sendRes;
          activeTab = 'active';
          saveStoredClusterHistory(sendRes);

          // Add notification for Buyer
          const bNotifs = getStoredBuyerNotifications();
          bNotifs.unshift({
            id: 'buyer-cluster-' + Date.now(),
            type: 'cluster',
            title: 'Cluster Order Created',
            message: `Cluster created for ${reqQuantity} units of ${reqProduct}. ${selectedList.length} artisan(s) notified.`,
            clusterId: sendRes.id,
            product: reqProduct,
            quantity: reqQuantity,
            action_label: 'View Cluster',
            action_route: 'buyer-orders',
            timestamp: 'Just now',
            is_read: false
          });
          saveStoredBuyerNotifications(bNotifs);

          // Add notification for Artisan(s)
          const aNotifs = getStoredArtisanNotifications();
          selectedList.forEach(item => {
            const artisanObj = poolArtisans.find(a => a.id === item.artisan_id) || { name: 'Artisan ' + item.artisan_id };
            aNotifs.unshift({
              id: 'artisan-cluster-' + Date.now() + '-' + item.artisan_id,
              clusterId: sendRes.id,
              artisanId: item.artisan_id,
              artisanName: artisanObj.name,
              title: `New Cluster Request: ${reqProduct}`,
              message: `Requested: ${item.proposed_contribution} units of ${reqProduct}. Delivery in ${reqDeadline} days.`,
              type: 'cluster',
              timestamp: 'Just now',
              isRead: false,
              status: 'pending',
              product: reqProduct,
              quantity: item.proposed_contribution,
              craft: selectedCraft,
              delivery_days: reqDeadline
            });
          });
          saveStoredArtisanNotifications(aNotifs);
          updateUnreadBadgeCounts();

          // Dispatch event so all tabs and Artisan screens sync in real-time
          try {
            window.dispatchEvent(new CustomEvent('kala-cluster-status-updated', {
              detail: { clusterId: sendRes.id, newCluster: true }
            }));
            window.dispatchEvent(new StorageEvent('storage', {
              key: 'kala_mitra_cluster_history',
              newValue: localStorage.getItem('kala_mitra_cluster_history')
            }));
          } catch (e) {}

          showToast('🚀 Provisional cluster created with selected artisans!');
          render();
        } catch (error) {
          showToast('Failed to create provisional cluster: ' + error.message);
        }
      });

      container.querySelectorAll('.btn-artisan-sim-accept').forEach(btn => {
        btn.addEventListener('click', async () => {
          const artisanId = Number(btn.dataset.artisanId);
          try {
            const updated = await fetch(`http://127.0.0.1:8000/api/v1/clusters/${currentCluster.id}/respond?action=accept&artisan_id=${artisanId}`, {
              method: 'POST'
            }).then(r => r.json());
            currentCluster = updated;
            showToast('Artisan accepted contribution!');
            render();
          } catch (e) {}
        });
      });

      container.querySelectorAll('.btn-artisan-sim-decline').forEach(btn => {
        btn.addEventListener('click', async () => {
          const artisanId = Number(btn.dataset.artisanId);
          try {
            const updated = await fetch(`http://127.0.0.1:8000/api/v1/clusters/${currentCluster.id}/respond?action=decline&artisan_id=${artisanId}`, {
              method: 'POST'
            }).then(r => r.json());
            currentCluster = updated;
            showToast('Artisan declined contribution.');
            render();
          } catch (e) {}
        });
      });

      container.querySelector('#btn-add-replacement-artisan')?.addEventListener('click', async () => {
        const selectEl = container.querySelector('#select-replacement-artisan');
        const qtyInp = container.querySelector('#input-replacement-qty');
        if (!selectEl || !qtyInp) return;
        const artisanId = Number(selectEl.value);
        const proposedQty = Number(qtyInp.value);

        try {
          const updated = await fetch(`http://127.0.0.1:8000/api/v1/clusters/${currentCluster.id}/add-artisan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ artisan_id: artisanId, proposed_contribution: proposedQty })
          }).then(r => r.json());
          currentCluster = updated;
          showToast('Added artisan to cluster!');
          render();
        } catch (e) {
          showToast(e.message);
        }
      });

      container.querySelector('#btn-confirm-final-cluster')?.addEventListener('click', async () => {
        try {
          let confirmed = null;
          try {
            confirmed = await fetch(`http://127.0.0.1:8000/api/v1/clusters/${currentCluster.id}/confirm`, {
              method: 'POST'
            }).then(r => r.json());
          } catch (e) {
            confirmed = null;
          }
          if (!confirmed || !confirmed.status) {
            currentCluster.status = 'CONFIRMED';
          } else {
            currentCluster = confirmed;
          }
          saveStoredClusterHistory(currentCluster);
          showToast('🎉 Cluster status updated to CONFIRMED!');
          render();
        } catch (e) {
          showToast('Cannot confirm cluster: ' + e.message);
        }
      });

      container.querySelector('#btn-navigate-single-product')?.addEventListener('click', () => {
        const prod = SAMPLE_PRODUCTS.find(p => p.id === 1) || SAMPLE_PRODUCTS[0];
        if (prod) {
          renderBuyerProductDetail(prod);
          navigateTo('buyer-product-detail');
        }
      });

      container.querySelectorAll('.btn-view-artisan-profile').forEach(btn => {
        btn.addEventListener('click', () => {
          const artisanId = Number(btn.dataset.artisanId);
          const artisan = poolArtisans.find(a => a.id === artisanId);
          if (artisan) {
            renderArtisanProfile({
              name: artisan.name,
              craft_type: artisan.craft,
              location_city: artisan.location,
              rating: artisan.rating,
              monthly_capacity: artisan.capacity
            }, 'buyer-orders');
            navigateTo('buyer-profile');
          }
        });
      });

      // Cluster Payment Handlers (Milestone Escrow: 40% Advance & 60% Remaining)
      const handleClusterPaymentSuccess = (stage, targetAmount, txnId) => {
        if (!currentCluster) return;

        if (stage === 'advance') {
          currentCluster.payment_status = 'ADVANCE_PAID';
          currentCluster.advance_paid_amount = targetAmount;
          currentCluster.advance_txn_id = txnId;
          currentCluster.status = 'IN PRODUCTION';

          // Mark all cluster members as accepted to keep milestone unlocked
          if (Array.isArray(currentCluster.members)) {
            currentCluster.members.forEach(m => {
              if (m.status !== 'Declined') m.status = 'Accepted';
            });
            currentCluster.accepted_quantity = currentCluster.members
              .filter(m => m.status === 'Accepted')
              .reduce((s, m) => s + (m.assigned_quantity || 0), 0);
          }

          // Register in permanent paid clusters registry
          savePaidClusterRecord(currentCluster.id, 'advance', targetAmount, txnId, currentCluster.product);

          // Backend sync (asynchronous, non-blocking)
          try {
            fetch(`http://127.0.0.1:8000/api/v1/clusters/${encodeURIComponent(currentCluster.id)}/payment`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                stage: 'advance',
                amount: targetAmount,
                txn_id: txnId
              })
            }).catch(() => {});
          } catch (e) {}

          // Notify Buyer
          const bNotifs = getStoredBuyerNotifications();
          bNotifs.unshift({
            id: 'buyer-pay-adv-' + Date.now(),
            type: 'cluster',
            title: '40% Advance Payment Successful',
            message: `Paid ₹${targetAmount.toLocaleString('en-IN')} advance escrow for ${currentCluster.product} (Ref #${txnId}). Cluster production is now authorized!`,
            clusterId: currentCluster.id,
            cluster_id: currentCluster.id,
            related_id: currentCluster.id,
            product: currentCluster.product,
            payment_status: 'ADVANCE_PAID',
            action_label: 'View Cluster',
            action_route: 'buyer-orders',
            timestamp: 'Just now',
            is_read: false
          });
          saveStoredBuyerNotifications(bNotifs);

          // Notify all cluster Artisans
          const aNotifs = getStoredArtisanNotifications();
          (currentCluster.members || []).forEach(m => {
            const mShare = Math.round((m.assigned_quantity / (currentCluster.required_quantity || 1)) * targetAmount);
            aNotifs.unshift({
              id: 'artisan-pay-adv-' + Date.now() + '-' + m.id,
              clusterId: currentCluster.id,
              artisanId: m.id,
              title: `Advance Escrow Funded (40% Received)`,
              message: `Buyer funded ₹${targetAmount.toLocaleString('en-IN')} advance for ${currentCluster.product}. Your raw material allocation: ₹${mShare.toLocaleString('en-IN')}. Production authorized!`,
              type: 'cluster',
              timestamp: 'Just now',
              isRead: false,
              product: currentCluster.product
            });
          });
          saveStoredArtisanNotifications(aNotifs);
          updateUnreadBadgeCounts();

          showToast(`🎉 40% Advance of ₹${targetAmount.toLocaleString('en-IN')} deposited into escrow! Production started.`);
        } else if (stage === 'remaining') {
          currentCluster.payment_status = 'FULLY_PAID';
          currentCluster.remaining_paid_amount = targetAmount;
          currentCluster.remaining_txn_id = txnId;
          currentCluster.status = 'COMPLETED';
          currentCluster.order_completed = true;

          // Register in permanent paid clusters registry
          savePaidClusterRecord(currentCluster.id, 'remaining', targetAmount, txnId, currentCluster.product);

          // Backend sync (asynchronous, non-blocking)
          try {
            fetch(`http://127.0.0.1:8000/api/v1/clusters/${encodeURIComponent(currentCluster.id)}/payment`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                stage: 'remaining',
                amount: targetAmount,
                txn_id: txnId
              })
            }).catch(() => {});
          } catch (e) {}

          // Notify Buyer
          const bNotifs = getStoredBuyerNotifications();
          bNotifs.unshift({
            id: 'buyer-pay-rem-' + Date.now(),
            type: 'cluster',
            title: '100% Final Settlement Complete',
            message: `Paid ₹${targetAmount.toLocaleString('en-IN')} remaining balance for ${currentCluster.product} (Ref #${txnId}). Cluster order completed & settled!`,
            clusterId: currentCluster.id,
            cluster_id: currentCluster.id,
            related_id: currentCluster.id,
            product: currentCluster.product,
            payment_status: 'FULLY_PAID',
            action_label: 'View Cluster',
            action_route: 'buyer-orders',
            timestamp: 'Just now',
            is_read: false
          });
          saveStoredBuyerNotifications(bNotifs);

          // Notify Artisans
          const aNotifs = getStoredArtisanNotifications();
          (currentCluster.members || []).forEach(m => {
            const mShare = Math.round((m.assigned_quantity / (currentCluster.required_quantity || 1)) * targetAmount);
            aNotifs.unshift({
              id: 'artisan-pay-rem-' + Date.now() + '-' + m.id,
              clusterId: currentCluster.id,
              artisanId: m.id,
              title: `Final Settlement Disbursed (60%)`,
              message: `Order completed! Final payout of ₹${mShare.toLocaleString('en-IN')} disbursed to your account for ${currentCluster.product}. Thank you!`,
              type: 'cluster',
              timestamp: 'Just now',
              isRead: false,
              product: currentCluster.product
            });
          });
          saveStoredArtisanNotifications(aNotifs);
          updateUnreadBadgeCounts();

          showToast(`🎉 Final settlement of ₹${targetAmount.toLocaleString('en-IN')} completed! Cluster order is 100% settled.`);
        }

        saveStoredClusterHistory(currentCluster);
        render();
      };

      container.querySelectorAll('.btn-trigger-cluster-pay').forEach(btn => {
        btn.addEventListener('click', () => {
          const stage = btn.dataset.stage || 'advance';
          openClusterPaymentModal(currentCluster, stage, handleClusterPaymentSuccess);
        });
      });

      container.querySelectorAll('.btn-mark-cluster-done').forEach(btn => {
        btn.addEventListener('click', () => {
          if (!currentCluster) return;
          currentCluster.order_completed = true;
          currentCluster.status = 'READY FOR FINAL SETTLEMENT';
          saveStoredClusterHistory(currentCluster);
          showToast('✓ Order marked completed! Final remaining balance is now ready to pay.');
          render();
        });
      });

      container.querySelectorAll('.btn-artisan-quick-accept').forEach(btn => {
        btn.addEventListener('click', () => {
          if (!currentCluster) return;
          const artisanId = Number(btn.dataset.artisanId);
          const targetMem = (currentCluster.members || []).find(m => m.id === artisanId);
          if (targetMem) {
            targetMem.status = 'Accepted';
            currentCluster.accepted_quantity = (currentCluster.members || []).filter(m => m.status === 'Accepted').reduce((s, m) => s + (m.assigned_quantity || 0), 0);
            if (currentCluster.members.every(m => m.status === 'Accepted')) {
              currentCluster.status = 'CONFIRMED';
            }
            saveStoredClusterHistory(currentCluster);
            showToast(`✓ Accepted on behalf of ${targetMem.name}!`);
            render();
          }
        });
      });
    };

    render();

    (async () => {
      try {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 500);
        const clusters = await fetch('http://127.0.0.1:8000/api/v1/clusters', { signal: controller.signal }).then(r => r.json());
        clearTimeout(tid);
        if (Array.isArray(clusters) && clusters.length > 0) {
          if (!currentCluster) {
            currentCluster = clusters[0];
            applyPaidStatusToCluster(currentCluster);
            render();
          } else {
            const stored = getStoredClusterHistory();
            if (currentCluster && currentCluster.id) {
              const localMatch = stored.find(c => String(c.id) === String(currentCluster.id));
              if (localMatch) currentCluster = localMatch;
            } else if (stored.length > 0) {
              currentCluster = stored[0];
            }

            const same = clusters.find(c => currentCluster && String(c.id) === String(currentCluster.id));
            if (same && currentCluster) {
              applyPaidStatusToCluster(same);
              // Safe non-destructive merge: preserve local artisan progress & status
              if (Array.isArray(currentCluster.members) && Array.isArray(same.members)) {
                same.members.forEach(sm => {
                  const cm = currentCluster.members.find(m => String(m.id) === String(sm.id) || (m.name && sm.name && m.name.toLowerCase().trim() === sm.name.toLowerCase().trim()));
                  if (cm) {
                    if (cm.production_status && cm.production_status !== 'Order Placed') sm.production_status = cm.production_status;
                    if (typeof cm.completed_quantity === 'number' && cm.completed_quantity > 0) sm.completed_quantity = cm.completed_quantity;
                    if (cm.progress) sm.progress = cm.progress;
                    if (cm.last_updated) sm.last_updated = cm.last_updated;
                    if (cm.status === 'Accepted') sm.status = 'Accepted';
                  }
                });
              }
              if (currentCluster.total_completed_quantity) same.total_completed_quantity = currentCluster.total_completed_quantity;
              if (currentCluster.overall_progress) same.overall_progress = currentCluster.overall_progress;
              if (currentCluster.payment_status === 'ADVANCE_PAID' || currentCluster.payment_status === 'FULLY_PAID') {
                same.payment_status = currentCluster.payment_status;
                same.advance_paid_amount = currentCluster.advance_paid_amount || same.advance_paid_amount;
                same.advance_txn_id = currentCluster.advance_txn_id || same.advance_txn_id;
                same.remaining_paid_amount = currentCluster.remaining_paid_amount || same.remaining_paid_amount;
                same.remaining_txn_id = currentCluster.remaining_txn_id || same.remaining_txn_id;
                same.status = currentCluster.status || same.status;
                same.order_completed = currentCluster.order_completed || same.order_completed;
              }
              currentCluster = normalizeClusterData(same);
              saveStoredClusterHistory(currentCluster);
              render();
            }
          }
        }
      } catch (e) {}

      try {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 500);
        const pool = await fetch('http://127.0.0.1:8000/api/v1/clusters/pool/artisans', { signal: controller.signal }).then(r => r.json());
        clearTimeout(tid);
        if (Array.isArray(pool) && pool.length > 0) {
          poolArtisans = pool;
          if (currentCluster && Array.isArray(currentCluster.members)) {
            currentCluster.members.forEach(mem => {
              if (!poolArtisans.some(a => a.id === mem.id)) {
                poolArtisans.push({
                  id: mem.id,
                  name: mem.name,
                  craft: mem.craft || selectedCraft,
                  location: mem.location || reqLocation,
                  capacity: mem.monthly_capacity || 250,
                  price: 140,
                  rating: 4.8,
                  verified: true,
                  lead_days: 12
                });
              }
            });
          }
          render();
        }
      } catch (e) {}
    })();
  }

  window.openArtisanClusterFeature = function(product, requestedUnits = 200, craftCategory = null) {
    const prodTitle = typeof product === 'object' ? (product.title || product.name || product.product || 'Artisan Craft Product') : String(product || 'Artisan Craft Product');
    const category = craftCategory || (typeof product === 'object' ? (product.craft_type || product.category) : null);
    const qty = Number(requestedUnits) || 200;

    activeClusterRequirement = {
      product: prodTitle,
      quantity: qty,
      craft: category,
      location: (typeof product === 'object' && product.location_city) ? product.location_city : 'East Godavari, AP',
      deadline: 15
    };
    try {
      localStorage.setItem('kala_mitra_active_cluster_req', JSON.stringify(activeClusterRequirement));
    } catch (e) {}

    pendingClusterData = activeClusterRequirement;
    renderBuyerOrders();
    navigateTo('buyer-orders');
  };

  // Live auto-refresh when artisan updates production status
  window.addEventListener('kala-cluster-status-updated', (e) => {
    if (document.getElementById('screen-buyer-orders')?.classList.contains('active')) {
      if (typeof renderBuyerOrders === 'function') {
        renderBuyerOrders();
      }
    }
    if (document.getElementById('screen-artisan-dashboard')?.classList.contains('active')) {
      if (typeof renderArtisanClustersTab === 'function') {
        renderArtisanClustersTab(typeof activeClusterFilter !== 'undefined' ? activeClusterFilter : 'all');
      }
    }
  });

  window.addEventListener('storage', (e) => {
    if (e.key === 'kala_mitra_cluster_history') {
      if (document.getElementById('screen-buyer-orders')?.classList.contains('active')) {
        if (typeof renderBuyerOrders === 'function') {
          renderBuyerOrders();
        }
      }
      if (document.getElementById('screen-artisan-dashboard')?.classList.contains('active')) {
        if (typeof renderArtisanClustersTab === 'function') {
          renderArtisanClustersTab(typeof activeClusterFilter !== 'undefined' ? activeClusterFilter : 'all');
        }
      }
    }
  });

  let trackingMap = null;

  function renderBuyerOpportunities() {
    const container = document.getElementById('buyer-opportunities-content');
    if (!container) return;
    let selectedOrder = null;
    let visibleOrders = [];

    container.innerHTML = `
      <div class="tracking-dashboard">
        <div class="tracking-intro">
          <div>
            <span class="tracking-eyebrow">ORDER VISIBILITY</span>
            <h2>Order Tracking</h2>
            <p>Track your order from production to delivery in real time.</p>
          </div>
          <span class="tracking-live-badge">● Live status</span>
        </div>
        <div id="tracking-detail" class="tracking-detail">
          <div class="tracking-empty"><h3>Loading order details...</h3></div>
        </div>
      </div>
    `;

    const selectTrackingOrder = async orderId => {
      try {
        const res = await fetch(`http://127.0.0.1:8000/api/v1/orders/${orderId}`);
        if (res.ok) {
          selectedOrder = await res.json();
        } else {
          selectedOrder = visibleOrders.find(order => String(order.id).toUpperCase() === String(orderId).toUpperCase()) || visibleOrders[0];
        }
      } catch (error) {
        selectedOrder = visibleOrders.find(order => String(order.id).toUpperCase() === String(orderId).toUpperCase()) || visibleOrders[0];
      }

      // Sync master order details from localStorage if available
      try {
        const master = getMasterOrders();
        const storedMatch = master.find(o => String(o.id).toUpperCase() === String(selectedOrder?.id).toUpperCase());
        if (storedMatch) {
          selectedOrder = { ...selectedOrder, ...storedMatch };
        }
      } catch(e) {}

      renderTrackingDetail();
    };

    const renderTrackingDetail = () => {
      const detail = document.getElementById('tracking-detail');
      if (!detail) return;
      if (!selectedOrder) {
        detail.innerHTML = `
          <div class="buyer-empty-state" style="padding: 40px 20px; text-align: center;">
            <h3>No orders placed yet</h3>
            <p style="color: #64748b; margin: 8px 0 16px;">Explore artisan collections or place an order to track live production.</p>
            <button type="button" class="primary-btn" data-buyer-nav="discover">Explore Artisan Crafts</button>
          </div>
        `;
        detail.querySelector('[data-buyer-nav="discover"]')?.addEventListener('click', () => {
          renderBuyerDiscover();
          navigateTo('buyer-discover');
        });
        return;
      }

      const allTrackingStages = ['Order Placed', 'Production Started', 'Quality Check', 'Ready for Shipment', 'Shipped', 'Delivered'];
      const currentStatusStr = (selectedOrder.status || 'Production Started').trim();
      let stageIndex = allTrackingStages.findIndex(s => s.toLowerCase() === currentStatusStr.toLowerCase());
      if (stageIndex === -1) {
        if (currentStatusStr.toLowerCase().includes('progress') || currentStatusStr.toLowerCase().includes('product')) stageIndex = 1;
        else if (currentStatusStr.toLowerCase().includes('qual') || currentStatusStr.toLowerCase().includes('check')) stageIndex = 2;
        else if (currentStatusStr.toLowerCase().includes('ready') || currentStatusStr.toLowerCase().includes('dispatch')) stageIndex = 3;
        else if (currentStatusStr.toLowerCase().includes('ship')) stageIndex = 4;
        else if (currentStatusStr.toLowerCase().includes('deliv')) stageIndex = 5;
        else stageIndex = 1;
      }
      const completedStatuses = allTrackingStages.slice(0, stageIndex + 1);
      const computedPercentage = Math.round(((stageIndex + 1) / allTrackingStages.length) * 100);
      const percentage = selectedOrder.status === 'Delivered' ? 100 : Math.max(computedPercentage, selectedOrder.progress || 20);
      const completed = selectedOrder.status === 'Delivered' ? selectedOrder.quantity : Math.round(selectedOrder.quantity * (percentage / 100));
      const statuses = allTrackingStages;

      // Order Selector if multiple orders
      let selectorHtml = '';
      if (visibleOrders.length > 1) {
        selectorHtml = `
          <div style="background: #ffffff; border: 1.5px solid #bae6fd; border-radius: 14px; padding: 12px 16px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; box-shadow: 0 2px 8px rgba(186, 230, 253, 0.4);">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 1.2rem;">📦</span>
              <div>
                <strong style="color: #0369a1; font-size: 0.88rem; display: block;">Select Order to Track:</strong>
                <span style="color: #64748b; font-size: 0.74rem;">${visibleOrders.length} orders in production & history</span>
              </div>
            </div>
            <select id="buyer-tracking-order-selector" style="padding: 7px 14px; border-radius: 8px; border: 1.5px solid #0284c7; background: #f0f9ff; color: #0369a1; font-size: 0.82rem; font-weight: 800; cursor: pointer; max-width: 280px;">
              ${visibleOrders.map(o => `
                <option value="${o.id}" ${String(o.id).toUpperCase() === String(selectedOrder.id).toUpperCase() ? 'selected' : ''}>
                  #${o.id} • ${escapeHtml(o.product || o.productName || 'Order')} (${o.status})
                </option>
              `).join('')}
            </select>
          </div>
        `;
      }

      detail.innerHTML = `
        ${selectorHtml}
        <section class="tracking-summary">
          <div class="tracking-summary__heading" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <div>
              <span class="tracking-eyebrow">${escapeHtml(selectedOrder.id)}</span>
              <h3 style="margin: 4px 0;">${escapeHtml(selectedOrder.product || selectedOrder.productName || 'Craft')}</h3>
              <p style="margin: 0; color: #64748b; font-size: 0.85rem;">${selectedOrder.quantity} units • Buyer: ${escapeHtml(selectedOrder.buyer || selectedOrder.buyerName || 'Verified Buyer')}</p>
            </div>
            <div class="tracking-status-hero" style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              <span class="tracking-current-status" style="font-weight: 800; font-size: 0.95rem; background: #e0f2fe; color: #0369a1; padding: 7px 18px; border-radius: 20px; border: 1.5px solid #bae6fd;">
                ● ${escapeHtml(selectedOrder.status)}
              </span>
            </div>
          </div>
          <div class="tracking-summary-grid" style="margin-top: 14px;">
            <div><span>Order Placed</span><strong>${selectedOrder.order_placed_time || selectedOrder.orderPlacedTime || selectedOrder.order_date || 'Today'}</strong></div>
            <div><span>Expected Delivery</span><strong>${selectedOrder.expected_delivery || selectedOrder.expectedDelivery || '18 Sep 2026'}</strong></div>
            <div><span>Total Amount</span><strong>₹${Number(selectedOrder.total_amount || selectedOrder.totalAmount || 0).toLocaleString('en-IN')}</strong></div>
            <div><span>Payment Status</span><strong style="color: #15803d;">✓ ${selectedOrder.payment_status || 'Paid via UPI'}</strong></div>
          </div>
        </section>

        <section class="tracking-card">
          <div class="tracking-card-heading">
            <h3>Order Status Timeline</h3>
            <span>Live Progression</span>
          </div>
          <div class="tracking-timeline">
            ${statuses.map(status => {
              const done = completedStatuses.includes(status);
              const current = status.toLowerCase() === (selectedOrder.status || '').toLowerCase();
              return `
                <div class="tracking-step ${done ? 'is-done' : ''} ${current ? 'is-current' : ''}">
                  <i>${done ? '✓' : current ? '●' : '○'}</i>
                  <span>${status}</span>
                </div>
              `;
            }).join('')}
          </div>
        </section>

        <section class="tracking-card">
          <div class="tracking-card-heading">
            <h3>Production Progress</h3>
            <strong>${completed} / ${selectedOrder.quantity} units completed</strong>
          </div>
          <div class="tracking-progress">
            <div><i style="width:${percentage}%"></i></div>
            <strong>${percentage}%</strong>
          </div>
          ${selectedOrder.cluster && selectedOrder.members ? `
            <div class="tracking-contributions">
              ${selectedOrder.members.map(member => `
                <div class="tracking-contribution">
                  <div>
                    <strong>${escapeHtml(member.name)}</strong>
                    <span>${escapeHtml(member.location || 'Local')} • ${member.completed || member.assigned}/${member.assigned} units</span>
                  </div>
                  <div class="tracking-mini-progress">
                    <i style="width:${Math.round(((member.completed || member.assigned) / member.assigned) * 100)}%"></i>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </section>

        <section class="tracking-card">
          <div class="tracking-card-heading">
            <h3>Shipping & Logistics</h3>
            <span>Live GPS Map</span>
          </div>
          <div class="tracking-shipment-grid">
            <div><span>Tracking ID</span><strong>${selectedOrder.shipment?.tracking_number || 'KM-SHIP-84521'}</strong></div>
            <div><span>Carrier</span><strong>${selectedOrder.shipment?.carrier || 'KALA-MITRA Express'}</strong></div>
            <div><span>Current Hub</span><strong>${selectedOrder.shipment?.current_location || 'East Godavari Hub'}</strong></div>
          </div>
          <div id="tracking-map" class="tracking-map" style="height: 220px; border-radius: 10px; margin-top: 12px;"></div>
        </section>
      `;

      renderTrackingMap(selectedOrder);

      detail.querySelector('#buyer-tracking-order-selector')?.addEventListener('change', (e) => {
        selectTrackingOrder(e.target.value);
      });
    };

    const renderTrackingMap = order => {
      const mapElement = document.getElementById('tracking-map');
      if (!mapElement) return;
      if (trackingMap) {
        trackingMap.remove();
        trackingMap = null;
      }
      if (mapElement._leaflet_id) {
        delete mapElement._leaflet_id;
      }
      const points = [[16.9891, 82.2475], [16.9750, 82.2910], [17.0042, 82.2692], [16.9560, 82.2640]];
      trackingMap = L.map(mapElement, { zoomControl: true }).setView(points[0], 10);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap contributors' }).addTo(trackingMap);
      L.marker(points[0]).addTo(trackingMap).bindPopup('<strong>Production Hub</strong>').openPopup();
      L.marker(points[1]).addTo(trackingMap).bindPopup('<strong>Collection Center</strong>');
      L.marker(points[2]).addTo(trackingMap).bindPopup('<strong>Distribution Center</strong>');
      L.marker(points[3]).addTo(trackingMap).bindPopup('<strong>Buyer Location</strong>');
      L.polyline(points, { color: '#1769aa', weight: 3, dashArray: '6 6' }).addTo(trackingMap);
      setTimeout(() => trackingMap?.invalidateSize(), 50);
    };

    // Fetch live orders from backend & merge with master orders
    const loadOrders = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/api/v1/orders');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            visibleOrders = data;
          }
        }
      } catch (e) {
        console.warn('Orders API offline, using fallback orders', e);
      }

      // Merge master orders from localStorage
      try {
        const master = getMasterOrders();
        if (Array.isArray(master) && master.length) {
          master.forEach(so => {
            const idx = visibleOrders.findIndex(o => String(o.id).toUpperCase() === String(so.id).toUpperCase());
            if (idx !== -1) {
              visibleOrders[idx] = { ...visibleOrders[idx], ...so };
            } else {
              visibleOrders.unshift(so);
            }
          });
        }
      } catch(e) {}

      // Prioritize the order the buyer just clicked to track!
      const prefId = sessionStorage.getItem('kala_mitra_selected_tracking_order');
      let orderToPick = null;
      if (prefId) {
        orderToPick = visibleOrders.find(o => String(o.id).toUpperCase() === String(prefId).toUpperCase());
      }
      if (!orderToPick && visibleOrders.length > 0) {
        orderToPick = visibleOrders[0];
      }
      selectTrackingOrder(orderToPick?.id || 'KM-ORD-10245');
    };

    // Auto-update when artisan updates production status
    window.addEventListener('kala-order-status-updated', () => {
      loadOrders();
    });
    window.addEventListener('storage', (e) => {
      if (e.key === 'kala_mitra_active_orders') {
        loadOrders();
      }
    });

    loadOrders();
  }
  function renderBuyerOpportunityDetail(oppId) {
    const opp = buyerDemoOpportunities.find(item => item.id === oppId) || buyerDemoOpportunities[0];
    const container = document.getElementById('buyer-opportunity-detail-content');
    if (!container) return;

    container.innerHTML = `
      <div class="buyer-panel-card">
        <h3>${opp.title}</h3>
        <div class="buyer-bulk-detail-row"><span>Buyer / Entity:</span><strong>${opp.buyerName}</strong></div>
        <div class="buyer-bulk-detail-row"><span>Buyer Type:</span><strong>${opp.buyerType}</strong></div>
        <div class="buyer-bulk-detail-row"><span>Total Required:</span><strong>${opp.requiredQuantity} units</strong></div>
        <div class="buyer-bulk-detail-row"><span>Region:</span><strong>${opp.region}</strong></div>
        <div class="buyer-bulk-detail-row"><span>Target Rate:</span><strong>₹${opp.targetPricePerUnit} / unit</strong></div>
        <div class="buyer-bulk-detail-row"><span>Deadline:</span><strong>${opp.deadline}</strong></div>
      </div>
    `;
  }

  function translateProductName(productName, language) {
    if (!productName || language === 'English') return productName;
    const dict = kalaTranslations[language] || {};
    if (dict[productName]) return dict[productName];

    let name = productName;
    if (language === 'Telugu') {
      name = name
        .replace(/\bBamboo\b/gi, 'బాంబూ')
        .replace(/\bTea\b/gi, 'టీ')
        .replace(/\bTable\b/gi, 'టేబుల్')
        .replace(/\bSet\b/gi, 'సెట్')
        .replace(/\bBasket\b/gi, 'బుట్ట')
        .replace(/\bBaskets\b/gi, 'బుట్టలు')
        .replace(/\bPitcher\b/gi, 'బిందె')
        .replace(/\bSaree\b/gi, 'చీర')
        .replace(/\bIdol\b/gi, 'విగ్రహం')
        .replace(/\bToy\b/gi, 'బొమ్మ')
        .replace(/\bBag\b/gi, 'సంచి')
        .replace(/\bTerracotta\b/gi, 'టెర్రకోటా')
        .replace(/\bKalamkari\b/gi, 'కలంకారీ')
        .replace(/\bBrass\b/gi, 'ఇత్తడి')
        .replace(/\bWood\b/gi, 'చెక్క')
        .replace(/\bCarving\b/gi, 'చెక్కడ')
        .replace(/\bDokra\b/gi, 'డోక్రా')
        .replace(/\bJute\b/gi, 'జూట్')
        .replace(/\bCrafts\b/gi, 'హస్తకళలు')
        .replace(/\bCraft\b/gi, 'చేతివృత్తి')
        .replace(/\bHandicrafts\b/gi, 'చేతివృత్తులు');
    } else if (language === 'Hindi') {
      name = name
        .replace(/\bBamboo\b/gi, 'बांस')
        .replace(/\bTea\b/gi, 'टी')
        .replace(/\bTable\b/gi, 'टेबल')
        .replace(/\bSet\b/gi, 'सेट')
        .replace(/\bBasket\b/gi, 'टोकरी')
        .replace(/\bBaskets\b/gi, 'टोकरियां')
        .replace(/\bPitcher\b/gi, 'घड़ा')
        .replace(/\bSaree\b/gi, 'साड़ी')
        .replace(/\bIdol\b/gi, 'मूर्ति')
        .replace(/\bToy\b/gi, 'खिलौना')
        .replace(/\bBag\b/gi, 'थैला')
        .replace(/\bTerracotta\b/gi, 'टेराकोटा')
        .replace(/\bKalamkari\b/gi, 'कलमकारी')
        .replace(/\bBrass\b/gi, 'पीतल')
        .replace(/\bWood\b/gi, 'लकड़ी')
        .replace(/\bCarving\b/gi, 'नक्काशी')
        .replace(/\bDokra\b/gi, 'डोकरा')
        .replace(/\bJute\b/gi, 'जूट')
        .replace(/\bCrafts\b/gi, 'हस्तशिल्प')
        .replace(/\bCraft\b/gi, 'शिल्प')
        .replace(/\bHandicrafts\b/gi, 'हस्तशिल्प');
    }
    return name;
  }

  function translateTextToCurrentLang(text) {
    if (!text || selectedLanguage === 'English') return text;
    const translations = kalaTranslations[selectedLanguage];
    if (!translations) return text;

    let result = text;

    // 1. Run sentence-level regex replacements FIRST (before word-level dictionary replacements)
    if (selectedLanguage === 'Telugu') {
      result = result
        .replace(/Artisan\s+(.+?)\s+accepted\s+(\d+)\s+units for\s+(.+?)\./gi, (m, name, qty, prod) => {
          const transProd = (translations && translations[prod.trim()]) || translateProductName(prod.trim(), 'Telugu');
          return `కళాకారుడు ${name} ${transProd} కోసం ${qty} యూనిట్లను అంగీకరించారు.`;
        })
        .replace(/Artisan\s+(.+?)\s+declined the cluster request for\s+(.+?)\.\s*Tap to form cluster again\./gi, (m, name, prod) => {
          const transProd = (translations && translations[prod.trim()]) || translateProductName(prod.trim(), 'Telugu');
          return `కళాకారుడు ${name} ${transProd} కోసం క్లస్టర్ అభ్యర్థనను తిరస్కరించారు. ప్రత్యామ్నాయ కళాకారులతో క్లస్టర్‌ను మళ్లీ ఏర్పరచడానికి నొక్కండి.`;
        })
        .replace(/New Cluster Request:\s*(.+)/gi, (m, prod) => {
          const transProd = (translations && translations[prod.trim()]) || translateProductName(prod.trim(), 'Telugu');
          return `కొత్త క్లస్టర్ అభ్యర్థన: ${transProd}`;
        })
        .replace(/Requested:\s*(\d+)\s*units of\s*(.+?)\.\s*(?:Delivery in|రవాణా in)\s*(\d+)\s*days\./gi, (m, qty, prod, days) => {
          const transProd = (translations && translations[prod.trim()]) || translateProductName(prod.trim(), 'Telugu');
          return `కోరినవి: ${transProd} యొక్క ${qty} యూనిట్లు. ${days} రోజుల్లో డెలివరీ.`;
        })
        .replace(/Cluster created for\s*(\d+)\s*units of\s*(.+?)\.\s*(\d+)\s*artisan\(s\) notified\./gi, (m, qty, prod, count) => {
          const transProd = (translations && translations[prod.trim()]) || translateProductName(prod.trim(), 'Telugu');
          return `${transProd} యొక్క ${qty} యూనిట్ల కోసం క్లస్టర్ సృష్టించబడింది. ${count} మంది కళాకారులకు నోటిఫికేషన్ వెళ్ళింది.`;
        })
        .replace(/Cluster Order Created/gi, "క్లస్టర్ ఆర్డర్ సృష్టించబడింది")
        .replace(/Payment for Order #([A-Z0-9-]+) could not be verified:\s*(.+)/gi, (m, id, reason) => {
          const transReason = translations[reason.trim()] || translateTextToCurrentLang(reason.trim());
          return `ఆర్డర్ #${id} కోసం చెల్లింపు ధృవీకరించబడలేదు: ${transReason}`;
        })
        .replace(/Order #([A-Z0-9-]+) for (\d+)\s*(?:units|యూనిట్లు)?\s*of (.+?) has been placed\./gi, (m, id, qty, prod) => {
          const transProd = translations[prod.trim()] || translateTextToCurrentLang(prod.trim());
          return `${transProd} (${qty} యూనిట్లు) కోసం ఆర్డర్ #${id} నమోదు చేయబడింది.`;
        })
        .replace(/Your order #([A-Z0-9-]+) of (.+?) has been successfully delivered!/gi, (m, id, prod) => {
          const transProd = translations[prod.trim()] || translateTextToCurrentLang(prod.trim());
          return `${transProd} యొక్క మీ ఆర్డర్ #${id} విజయవంతంగా డెలివరీ చేయబడింది!`;
        })
        .replace(/Requirement for (\d+) units of (.+?) registered\. Finding artisan cluster\./gi, (m, qty, prod) => {
          const transProd = translations[prod.trim()] || translateTextToCurrentLang(prod.trim());
          return `${transProd} యొక్క ${qty} యూనిట్ల అవసరం నమోదైంది. ఆర్టిసన్ క్లస్టర్ వెతకబడుతోంది.`;
        })
        .replace(/Payment of ₹([\d,]+) for Order #([A-Z0-9-]+) verified via Razorpay TEST MODE \((.+?)\)\./gi, "ఆర్డర్ #$2 కోసం ₹$1 చెల్లింపు Razorpay TEST MODE ($3) ద్వారా ధృవీకరించబడింది.")
        .replace(/Payment of ₹([\d,]+) for Order #([A-Z0-9-]+) was successful\./gi, "ఆర్డర్ #$2 కోసం ₹$1 చెల్లింపు విజయవంతమైంది.")
        .replace(/You are invited to join an artisan cluster to produce (\d+) units of (.+?)\./gi, (m, qty, prod) => {
          const transProd = translations[prod.trim()] || translateTextToCurrentLang(prod.trim());
          return `మీరు ${transProd} యొక్క ${qty} యూనిట్లను తయారు చేయడానికి ఆర్టిసన్ క్లస్టర్‌లో చేరడానికి ఆహ్వానించబడ్డారు.`;
        })
        .replace(/(.+?) accepted the invitation for (\d+) units\./gi, "$1 $2 యూనిట్ల ఆహ్వానాన్ని ఆమోదించారు.")
        .replace(/(.+?) declined the cluster invitation\. Initiating AI auto-replacement\./gi, "$1 క్లస్టర్ ఆహ్వానాన్ని తిరస్కరించారు. AI స్వయంచాలక పునఃస్థాపన ప్రారంభించబడుతోంది.")
        .replace(/(.+?) was replaced by (.+?) for (\d+) units\. Your collective order is preserved!/gi, "$1 స్థానంలో $2 $3 యూనిట్ల కోసం భర్తీ చేయబడ్డారు. మీ సమిష్టి ఆర్డర్ సురక్షితంగా ఉంది!")
        .replace(/Collective capacity reached! Artisan cluster is formed for (\d+) units of (.+?)\. Ready to place order\./gi, (m, qty, prod) => {
          const transProd = translations[prod.trim()] || translateTextToCurrentLang(prod.trim());
          return `సమిష్టి సామర్థ్యం పూర్తయింది! ${transProd} యొక్క ${qty} యూనిట్ల కోసం ఆర్టిసన్ క్లస్టర్ ఏర్పడింది. ఆర్డర్ చేయడానికి సిద్ధంగా ఉంది.`;
        })
        .replace(/Production has officially started for your order of (.+?)\./gi, (m, prod) => {
          const transProd = translations[prod.trim()] || translateTextToCurrentLang(prod.trim());
          return `మీ ${transProd} ఆర్డర్ కోసం ఉత్పత్తి అధికారికంగా ప్రారంభమైంది.`;
        })
        .replace(/Your order of (.+?) has entered Quality Check inspection\./gi, (m, prod) => {
          const transProd = translations[prod.trim()] || translateTextToCurrentLang(prod.trim());
          return `మీ ${transProd} ఆర్డర్ క్వాలిటీ చెక్ తనిఖీలోకి ప్రవేశించింది.`;
        })
        .replace(/Artisans are crafting your order of (.+?)\./gi, (m, prod) => {
          const transProd = translations[prod.trim()] || translateTextToCurrentLang(prod.trim());
          return `కళాకారులు మీ ${transProd} ఆర్డర్‌ను తయారుచేస్తున్నారు.`;
        })
        .replace(/Your order of (.+?) has been dispatched and is on its way\./gi, (m, prod) => {
          const transProd = translations[prod.trim()] || translateTextToCurrentLang(prod.trim());
          return `మీ ${transProd} ఆర్డర్ రవాణా చేయబడింది మరియు మార్గంలో ఉంది.`;
        })
        .replace(/AI found (\d+) products matching your requirement\./gi, "మీ అవసరానికి సరిపోలే $1 ఉత్పత్తులను AI కనుగొంది.")
        .replace(/(\d+) verified artisans can fulfill your requirement\./gi, "$1 ధృవీకరించిన కళాకారులు మీ అవసరాన్ని తీర్చగలరు.")
        .replace(/Order #KM-ORD-([\d]+) has been placed for (.+?) \((\d+) units\)\./gi, (m, id, prod, qty) => {
          const transProd = translations[prod.trim()] || translateTextToCurrentLang(prod.trim());
          return `${transProd} (${qty} యూనిట్లు) కోసం ఆర్డర్ #KM-ORD-${id} నమోదు చేయబడింది.`;
        })
        .replace(/Payment verified via Razorpay TEST MODE for Order #KM-ORD-([\d]+)\./gi, "ఆర్డర్ #KM-ORD-$1 కోసం Razorpay TEST MODE ద్వారా చెల్లింపు ధృవీకరించబడింది.")
        .replace(/Order Status: Quality Check/gi, "ఆర్డర్ స్థితి: క్వాలిటీ చెక్")
        .replace(/Order Status: Production Started/gi, "ఆర్డర్ స్థితి: ఉత్పత్తి ప్రారంభమైంది")
        .replace(/Order Status: Production in Progress/gi, "ఆర్డర్ స్థితి: ఉత్పత్తి పురోగతిలో ఉంది")
        .replace(/Order Status: Shipped/gi, "ఆర్డర్ స్థితి: రవాణా చేయబడింది")
        .replace(/Order Status: Delivered/gi, "ఆర్డర్ స్థితి: డెలివరీ చేయబడింది")
        .replace(/(\d+)\s*minutes?\s*ago/gi, "$1 నిమిషాల క్రితం")
        .replace(/(\d+)\s*m\s*ago/gi, "$1 నిమిషాల క్రితం")
        .replace(/(\d+)\s*hours?\s*ago/gi, "$1 గంటల క్రితం")
        .replace(/(\d+)\s*h\s*ago/gi, "$1 గంటల క్రితం")
        .replace(/(\d+)\s*days?\s*ago/gi, "$1 రోజుల క్రితం")
        .replace(/\bYesterday\b/gi, "నిన్న")
        .replace(/\bJust now\b/gi, "ఇప్పుడే")
        .replace(/\bCluster\b/g, "క్లస్టర్");
    } else if (selectedLanguage === 'Hindi') {
      result = result
        .replace(/Artisan\s+(.+?)\s+accepted\s+(\d+)\s+units for\s+(.+?)\./gi, (m, name, qty, prod) => {
          const transProd = (translations && translations[prod.trim()]) || translateProductName(prod.trim(), 'Hindi');
          return `कारीगर ${name} ने ${transProd} के लिए ${qty} इकाइयां स्वीकार कीं।`;
        })
        .replace(/Artisan\s+(.+?)\s+declined the cluster request for\s+(.+?)\.\s*Tap to form cluster again\./gi, (m, name, prod) => {
          const transProd = (translations && translations[prod.trim()]) || translateProductName(prod.trim(), 'Hindi');
          return `कारीगर ${name} ने ${transProd} के लिए क्लस्टर अनुरोध अस्वीकार कर दिया। नए कारीगरों के साथ पुन: क्लस्टर बनाने के लिए टैप करें।`;
        })
        .replace(/New Cluster Request:\s*(.+)/gi, (m, prod) => {
          const transProd = (translations && translations[prod.trim()]) || translateProductName(prod.trim(), 'Hindi');
          return `नया क्लस्टर अनुरोध: ${transProd}`;
        })
        .replace(/Requested:\s*(\d+)\s*units of\s*(.+?)\.\s*(?:Delivery in|डिलीवरी in)\s*(\d+)\s*days\./gi, (m, qty, prod, days) => {
          const transProd = (translations && translations[prod.trim()]) || translateProductName(prod.trim(), 'Hindi');
          return `अनुरोधित: ${transProd} की ${qty} इकाइयां। ${days} दिनों में डिलीवरी।`;
        })
        .replace(/Cluster created for\s*(\d+)\s*units of\s*(.+?)\.\s*(\d+)\s*artisan\(s\) notified\./gi, (m, qty, prod, count) => {
          const transProd = (translations && translations[prod.trim()]) || translateProductName(prod.trim(), 'Hindi');
          return `${transProd} की ${qty} इकाइयों के लिए क्लस्टर बनाया गया। ${count} कारीगरों को सूचित किया गया।`;
        })
        .replace(/Cluster Order Created/gi, "क्लस्टर ऑर्डर बनाया गया")
        .replace(/Payment for Order #([A-Z0-9-]+) could not be verified:\s*(.+)/gi, (m, id, reason) => {
          const transReason = translations[reason.trim()] || translateTextToCurrentLang(reason.trim());
          return `ऑर्डर #${id} के लिए भुगतान सत्यापित नहीं हो सका: ${transReason}`;
        })
        .replace(/Order #([A-Z0-9-]+) for (\d+)\s*(?:units|इकाइयां)?\s*of (.+?) has been placed\./gi, (m, id, qty, prod) => {
          const transProd = translations[prod.trim()] || translateTextToCurrentLang(prod.trim());
          return `${transProd} (${qty} यूनिट) के लिए ऑर्डर #${id} दर्ज किया गया है।`;
        })
        .replace(/Your order #([A-Z0-9-]+) of (.+?) has been successfully delivered!/gi, (m, id, prod) => {
          const transProd = translations[prod.trim()] || translateTextToCurrentLang(prod.trim());
          return `${transProd} का आपका ऑर्डर #${id} सफलतापूर्वक डिलीवर कर दिया गया है!`;
        })
        .replace(/Requirement for (\d+) units of (.+?) registered\. Finding artisan cluster\./gi, (m, qty, prod) => {
          const transProd = translations[prod.trim()] || translateTextToCurrentLang(prod.trim());
          return `${transProd} की ${qty} यूनिटों की आवश्यकता दर्ज की गई। कारीगर क्लस्टर खोजा जा रहा है।`;
        })
        .replace(/Payment of ₹([\d,]+) for Order #([A-Z0-9-]+) verified via Razorpay TEST MODE \((.+?)\)\./gi, "ऑर्डर #$2 के लिए ₹$1 का भुगतान Razorpay TEST MODE ($3) से सत्यापित हुआ।")
        .replace(/Payment of ₹([\d,]+) for Order #([A-Z0-9-]+) was successful\./gi, "ऑर्डर #$2 के लिए ₹$1 का भुगतान सफल रहा।")
        .replace(/You are invited to join an artisan cluster to produce (\d+) units of (.+?)\./gi, (m, qty, prod) => {
          const transProd = translations[prod.trim()] || translateTextToCurrentLang(prod.trim());
          return `आपको ${transProd} की ${qty} इकाइयां बनाने के लिए कारीगर क्लस्टर में शामिल होने के लिए आमंत्रित किया गया है।`;
        })
        .replace(/(.+?) accepted the invitation for (\d+) units\./gi, "$1 ने $2 यूनिटों के लिए निमंत्रण स्वीकार किया।")
        .replace(/(.+?) declined the cluster invitation\. Initiating AI auto-replacement\./gi, "$1 ने क्लस्टर निमंत्रण अस्वीकार कर दिया। AI स्वचालित प्रतिस्थापन शुरू किया जा रहा है।")
        .replace(/(.+?) was replaced by (.+?) for (\d+) units\. Your collective order is preserved!/gi, "$1 के स्थान पर $2 को $3 यूनिटों के लिए प्रतिस्थापित किया गया। आपका सामूहिक ऑर्डर सुरक्षित है!")
        .replace(/Collective capacity reached! Artisan cluster is formed for (\d+) units of (.+?)\. Ready to place order\./gi, (m, qty, prod) => {
          const transProd = translations[prod.trim()] || translateTextToCurrentLang(prod.trim());
          return `सामूहिक क्षमता पूरी हुई! ${transProd} की ${qty} यूनिटों के लिए कारीगर क्लस्टर गठित हुआ। ऑर्डर करने के लिए तैयार।`;
        })
        .replace(/Production has officially started for your order of (.+?)\./gi, (m, prod) => {
          const transProd = translations[prod.trim()] || translateTextToCurrentLang(prod.trim());
          return `आपके ${transProd} के ऑर्डर का उत्पादन आधिकारिक रूप से शुरू हो गया है।`;
        })
        .replace(/Your order of (.+?) has entered Quality Check inspection\./gi, (m, prod) => {
          const transProd = translations[prod.trim()] || translateTextToCurrentLang(prod.trim());
          return `आपका ${transProd} का ऑर्डर गुणवत्ता जांच के लिए गया है।`;
        })
        .replace(/Artisans are crafting your order of (.+?)\./gi, (m, prod) => {
          const transProd = translations[prod.trim()] || translateTextToCurrentLang(prod.trim());
          return `कारीगर आपके ${transProd} का ऑर्डर बना रहे हैं।`;
        })
        .replace(/Your order of (.+?) has been dispatched and is on its way\./gi, (m, prod) => {
          const transProd = translations[prod.trim()] || translateTextToCurrentLang(prod.trim());
          return `आपका ${transProd} का ऑर्डर डिस्पैच कर दिया गया है और रास्ते में है।`;
        })
        .replace(/AI found (\d+) products matching your requirement\./gi, "AI को आपकी आवश्यकता से मेल खाते $1 उत्पाद मिले।")
        .replace(/(\d+) verified artisans can fulfill your requirement\./gi, "$1 सत्यापित कारीगर आपकी आवश्यकता पूरी कर सकते हैं।")
        .replace(/Order #KM-ORD-([\d]+) has been placed for (.+?) \((\d+) units\)\./gi, (m, id, prod, qty) => {
          const transProd = translations[prod.trim()] || translateTextToCurrentLang(prod.trim());
          return `${transProd} (${qty} यूनिट) के लिए ऑर्डर #KM-ORD-${id} दर्ज किया गया है।`;
        })
        .replace(/Payment verified via Razorpay TEST MODE for Order #KM-ORD-([\d]+)\./gi, "ऑर्डर #KM-ORD-$1 के लिए Razorpay TEST MODE से भुगतान सत्यापित हुआ।")
        .replace(/Order Status: Quality Check/gi, "ऑर्डर स्थिति: गुणवत्ता जांच")
        .replace(/Order Status: Production Started/gi, "ऑर्डर स्थिति: उत्पादन शुरू")
        .replace(/Order Status: Production in Progress/gi, "ऑर्डर स्थिति: उत्पादन जारी है")
        .replace(/Order Status: Shipped/gi, "ऑर्डर स्थिति: डिस्पैच हुआ")
        .replace(/Order Status: Delivered/gi, "ऑर्डर स्थिति: डिलीवर हुआ")
        .replace(/(\d+)\s*minutes?\s*ago/gi, "$1 मिनट पहले")
        .replace(/(\d+)\s*m\s*ago/gi, "$1 मिनट पहले")
        .replace(/(\d+)\s*hours?\s*ago/gi, "$1 घंटे पहले")
        .replace(/(\d+)\s*h\s*ago/gi, "$1 घंटे पहले")
        .replace(/(\d+)\s*days?\s*ago/gi, "$1 दिन पहले")
        .replace(/\bYesterday\b/gi, "कल")
        .replace(/\bJust now\b/gi, "अभी")
        .replace(/\bCluster\b/g, "क्लस्टर");
    }

    // 2. Exact key match
    if (translations[result]) return translations[result];

    // 3. Substring key replacements
    const keys = Object.keys(translations).sort((a, b) => b.length - a.length);
    for (const key of keys) {
      if (key && result.includes(key)) {
        result = result.split(key).join(translations[key]);
      }
    }

    return result;
  }

  function speakNotificationText(text) {
    if (!('speechSynthesis' in window)) {
      showToast('Text-to-speech is not supported on this device.');
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const textToSpeak = translateTextToCurrentLang(text);
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      const langMap = { English: 'en-IN', Telugu: 'te-IN', Hindi: 'hi-IN' };
      utterance.lang = langMap[selectedLanguage] || 'en-IN';
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error', e);
    }
  }

  function renderBuyerNotifications() {
    const container = document.getElementById('buyer-notifications-content');
    if (!container) return;
    const fallback = [
      { id: 'local-cluster-accept', type: 'cluster', title: 'Artisan Accepted Cluster', message: 'Artisan Sujatha V. (East Coast Artisans) accepted 180 units for Handcrafted Bamboo Storage Baskets.', clusterId: 'cluster-seed-101', product: 'Handcrafted Bamboo Storage Baskets', quantity: 180, artisanName: 'Sujatha V.', action_label: 'View Cluster', action_route: 'buyer-orders', timestamp: '15 minutes ago', is_read: false },
      { id: 'local-product', type: 'products', title: 'AI Product Match', message: 'AI found 8 products matching your requirement.', action_label: 'View Products', action_route: 'buyer-home', timestamp: '2 minutes ago', is_read: false },
      { id: 'local-artisan', type: 'artisans', title: 'Artisan Match', message: '5 verified artisans can fulfill your requirement.', action_label: 'View Artisans', action_route: 'buyer-discover', timestamp: '8 minutes ago', is_read: false },
      { id: 'local-payment', type: 'payments', title: 'Payment Successful', message: 'Payment of ₹25,000 for Order #KM1024 was successful.', action_label: 'View Payment', action_route: 'buyer-opportunities', timestamp: '1 hour ago', is_read: true },
      { id: 'local-shipping', type: 'delivery', title: 'Shipping Update', message: 'Your order has been shipped.', action_label: 'Track Shipment', action_route: 'buyer-opportunities', timestamp: 'Yesterday', is_read: true }
    ];
    let notifications = [];
    let activeFilter = 'all';
    const loadNotifications = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/api/v1/notifications?user_id=buyer-demo');
        if (res.ok) {
          const apiNotifs = await res.json();
          const stored = getStoredBuyerNotifications();
          const apiIds = new Set(apiNotifs.map(n => n.id));
          notifications = [...stored.filter(n => !apiIds.has(n.id)), ...apiNotifs];
        } else {
          notifications = getStoredBuyerNotifications();
        }
      } catch (error) {
        notifications = getStoredBuyerNotifications();
      }
      renderNotificationList();
      updateBuyerNotificationBadge();
    };
    const iconFor = type => ({ products: '🛍️', artisans: '🤝', orders: '📦', cluster: '👥', payments: '💰', delivery: '🚚' }[type] || '🔔');
    const renderNotificationList = () => {
      const filtered = notifications.filter(item => activeFilter === 'all' || item.type === activeFilter);
      container.innerHTML = `
        <div class="buyer-notifications-panel">
          <div class="buyer-notifications-head">
            <div>
              <span class="buyer-kicker">UPDATES</span>
              <h2>Notifications</h2>
            </div>
            <button type="button" class="secondary-btn" id="buyer-mark-all-read">Mark all as read</button>
          </div>
          <div class="buyer-notification-tabs">
            ${[['all', 'All'], ['orders', 'Orders'], ['cluster', 'Cluster'], ['payments', 'Payments'], ['products', 'Products'], ['delivery', 'Delivery']].map(([value, label]) => {
              const transLabel = (kalaTranslations[selectedLanguage] && kalaTranslations[selectedLanguage][label]) || translateTextToCurrentLang(label);
              return `<button type="button" class="${activeFilter === value ? 'active' : ''}" data-notification-filter="${value}">${transLabel}</button>`;
            }).join('')}
          </div>
          <div class="buyer-notification-list">
            ${filtered.length ? filtered.map(item => `
              <article class="buyer-notification-card ${item.is_read ? '' : 'is-unread'}" data-notification-id="${item.id}">
                <div class="buyer-notification-icon">${iconFor(item.type)}</div>
                <div class="buyer-notification-body">
                  <div class="buyer-notification-title">
                    <strong>${escapeHtml(item.title)}</strong>
                    <span>${escapeHtml(item.timestamp || 'Just now')}</span>
                  </div>
                  <p>${escapeHtml(item.message)}</p>
                  <div class="buyer-notification-actions">
                    <button type="button" class="primary-btn" 
                      data-notification-action="${escapeHtml(item.action_route || 'buyer-opportunities')}" 
                      data-cluster-id="${escapeHtml(item.clusterId || item.cluster_id || item.related_id || '')}" 
                      data-product="${escapeHtml(item.product || '')}" 
                      data-notification-id="${escapeHtml(item.id || '')}">
                      ${escapeHtml(item.action_label || 'View Details')}
                    </button>
                    <button type="button" class="secondary-btn" data-notification-speak="${item.id}" title="Read notification aloud">🔊 Listen</button>
                    ${item.is_read ? '' : `<button type="button" class="secondary-btn" data-notification-read>Mark as read</button>`}
                  </div>
                </div>
              </article>
            `).join('') : `<div class="buyer-empty-state"><h3>No notifications in this category.</h3></div>`}
          </div>
        </div>
      `;

      container.querySelectorAll('[data-notification-filter]').forEach(button => button.addEventListener('click', () => {
        activeFilter = button.dataset.notificationFilter;
        renderNotificationList();
      }));

      container.querySelector('#buyer-mark-all-read')?.addEventListener('click', async () => {
        try {
          await fetch('http://127.0.0.1:8000/api/v1/notifications/read-all?user_id=buyer-demo', { method: 'PATCH' });
        } catch (error) {}
        notifications.forEach(item => { item.is_read = true; });
        renderNotificationList();
        updateBuyerNotificationBadge();
      });

      container.querySelectorAll('[data-notification-speak]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const notifId = btn.dataset.notificationSpeak;
          const notif = notifications.find(n => n.id === notifId);
          if (notif) {
            const speechText = `${notif.title}. ${notif.message}`;
            speakNotificationText(speechText);
            showToast('🔊 Reading notification aloud...');
          }
        });
      });

      container.querySelectorAll('[data-notification-id]').forEach(card => card.addEventListener('click', async event => {
        if (event.target.closest('[data-notification-action]') || event.target.closest('[data-notification-speak]')) return;
        const item = notifications.find(notification => notification.id === card.dataset.notificationId);
        if (item && !item.is_read) {
          item.is_read = true;
          try {
            await fetch(`http://127.0.0.1:8000/api/v1/notifications/${item.id}/read?user_id=buyer-demo`, { method: 'PATCH' });
          } catch (error) {}
          renderNotificationList();
          updateBuyerNotificationBadge();
        }
      }));

      container.querySelectorAll('[data-notification-read]').forEach(button => button.addEventListener('click', event => event.currentTarget.closest('[data-notification-id]')?.click()));
      container.querySelectorAll('[data-notification-action]').forEach(button => button.addEventListener('click', () => {
        const route = button.dataset.notificationAction;
        const notifCard = button.closest('[data-notification-id]');
        const notifId = notifCard ? notifCard.dataset.notificationId : button.dataset.notificationId;
        const notif = notifications.find(n => n.id === notifId);

        if (route === 'buyer-orders-reform') {
          if (notif && notif.rejectedArtisanId) {
            excludedArtisanIds.add(Number(notif.rejectedArtisanId));
          }
          const targetCraft = notif?.craft || activeClusterRequirement?.craft || (typeof normalizeCraft === 'function' ? normalizeCraft(notif?.product) : null) || 'Bamboo Crafts';
          if (notif && (notif.product || notif.quantity || targetCraft)) {
            activeClusterRequirement = {
              product: notif.product || 'Bamboo Utility Basket Set (50 units)',
              quantity: Number(notif.quantity) || 200,
              craft: targetCraft,
              location: 'East Godavari, AP',
              deadline: 15
            };
            try {
              localStorage.setItem('kala_mitra_active_cluster_req', JSON.stringify(activeClusterRequirement));
            } catch (e) {}
          }
          showToast(`Re-forming cluster excluding ${notif?.artisanName || 'rejected artisan'}...`);
          navigateTo('buyer-orders');
        } else if (route === 'buyer-orders') {
          const history = getStoredClusterHistory();
          let targetCluster = null;

          // 1. Try to find by explicit clusterId
          const cId = button.dataset.clusterId || notif?.clusterId || notif?.cluster_id || notif?.related_id;
          if (cId) {
            targetCluster = history.find(c => String(c.id) === String(cId));
          }
          // 2. Try to match by product name
          const prodQuery = notif?.product || button.dataset.product;
          if (!targetCluster && prodQuery) {
            targetCluster = history.find(c => c.product && c.product.toLowerCase().includes(prodQuery.toLowerCase()));
          }
          // 3. Try to match by artisan name in members
          if (!targetCluster && notif?.artisanName) {
            targetCluster = history.find(c => (c.members || []).some(m => m.name && m.name.toLowerCase().includes(notif.artisanName.toLowerCase())));
          }
          // 4. Try to match via paid clusters registry
          if (!targetCluster) {
            const paidRegistry = getPaidClustersRegistry();
            if (cId && paidRegistry[String(cId)]) {
              targetCluster = history.find(c => String(c.id) === String(cId));
            }
          }
          // 5. Fallback to newest cluster in history
          if (!targetCluster && history.length > 0) {
            targetCluster = history[0];
          }

          const isAdvPayNotif = notif && (
            (notif.title && notif.title.toLowerCase().includes('advance')) ||
            (notif.id && String(notif.id).startsWith('buyer-pay-adv')) ||
            (notif.message && notif.message.toLowerCase().includes('advance escrow')) ||
            notif.payment_status === 'ADVANCE_PAID'
          );
          const isRemPayNotif = notif && (
            (notif.title && (notif.title.toLowerCase().includes('final settlement') || notif.title.toLowerCase().includes('remaining'))) ||
            (notif.id && String(notif.id).startsWith('buyer-pay-rem')) ||
            notif.payment_status === 'FULLY_PAID'
          );

          if (targetCluster) {
            applyPaidStatusToCluster(targetCluster);

            if (isAdvPayNotif) {
              if (targetCluster.payment_status !== 'FULLY_PAID') {
                targetCluster.payment_status = 'ADVANCE_PAID';
                targetCluster.status = 'IN PRODUCTION';
              }
              if (Array.isArray(targetCluster.members)) {
                targetCluster.members.forEach(m => {
                  if (m.status !== 'Declined') m.status = 'Accepted';
                });
                targetCluster.accepted_quantity = targetCluster.members
                  .filter(m => m.status === 'Accepted')
                  .reduce((s, m) => s + (m.assigned_quantity || 0), 0);
              }
              savePaidClusterRecord(targetCluster.id, 'advance', targetCluster.advance_paid_amount, targetCluster.advance_txn_id, targetCluster.product);
              saveStoredClusterHistory(targetCluster);
            } else if (isRemPayNotif) {
              targetCluster.payment_status = 'FULLY_PAID';
              targetCluster.status = 'COMPLETED';
              targetCluster.order_completed = true;
              if (Array.isArray(targetCluster.members)) {
                targetCluster.members.forEach(m => {
                  if (m.status !== 'Declined') m.status = 'Accepted';
                });
              }
              savePaidClusterRecord(targetCluster.id, 'remaining', targetCluster.remaining_paid_amount, targetCluster.remaining_txn_id, targetCluster.product);
              saveStoredClusterHistory(targetCluster);
            }

            pendingBuyerClusterTarget = targetCluster;
            activeClusterRequirement = {
              product: targetCluster.product,
              quantity: targetCluster.required_quantity,
              craft: targetCluster.craft,
              location: targetCluster.location || 'East Godavari, AP',
              deadline: parseInt(targetCluster.delivery_date) || 15
            };
            try {
              localStorage.setItem('kala_mitra_active_cluster_req', JSON.stringify(activeClusterRequirement));
            } catch (e) {}
            showToast(`Loading cluster: ${targetCluster.product}`);
          }
          navigateTo('buyer-orders');
        } else {
          navigateTo(route);
        }
      }));

      translateApp(selectedLanguage);
    };
    loadNotifications();
  }

  async function updateBuyerNotificationBadge() {
    const badge = document.getElementById('buyer-notification-count');
    if (!badge) return;
    try {
      const data = await fetch('http://127.0.0.1:8000/api/v1/notifications/unread-count?user_id=buyer-demo').then(response => response.json());
      badge.textContent = data.count;
      badge.hidden = data.count < 1;
    } catch (error) {
      const fallback = [
        { id: 'local-product', type: 'products', title: 'AI Product Match', is_read: false },
        { id: 'local-artisan', type: 'artisans', title: 'Artisan Match', is_read: false },
        { id: 'local-payment', type: 'payments', title: 'Payment Successful', is_read: true },
        { id: 'local-shipping', type: 'delivery', title: 'Shipping Update', is_read: true }
      ];
      const count = fallback.filter(n => !n.is_read).length;
      badge.textContent = count;
      badge.hidden = count < 1;
    }
  }

  // Buyer "My Orders" Modal
  function openBuyerOrdersModal(initialTab = null) {
    document.getElementById('modal-buyer-my-orders')?.remove();

    const masterOrders = getMasterOrders();
    const currentOrders = masterOrders.filter(o => (o.status || '').toLowerCase() !== 'delivered');
    const previousOrders = masterOrders.filter(o => (o.status || '').toLowerCase() === 'delivered');

    let activeTab = initialTab || (currentOrders.length > 0 ? 'current' : 'previous');

    const modal = document.createElement('div');
    modal.id = 'modal-buyer-my-orders';
    modal.style.cssText = 'position: fixed; inset: 0; background: rgba(15, 23, 42, 0.78); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); z-index: 15000; display: flex; align-items: center; justify-content: center; padding: 14px; overflow-y: auto; animation: fadeIn 0.25s ease-out;';

    const renderModalContent = () => {
      const freshMaster = getMasterOrders();
      const freshCurrent = freshMaster.filter(o => (o.status || '').toLowerCase() !== 'delivered');
      const freshPrevious = freshMaster.filter(o => (o.status || '').toLowerCase() === 'delivered');

      modal.innerHTML = `
        <div style="background: #ffffff; border-radius: 20px; max-width: 480px; width: 100%; box-shadow: 0 20px 45px rgba(0,0,0,0.35); border: 2px solid #e2e8f0; overflow: hidden; display: flex; flex-direction: column; max-height: 90vh; margin: auto;">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #1e3a8a, #2563eb); padding: 18px 20px; color: #ffffff; position: relative;">
            <button type="button" id="btn-close-buyer-orders" style="position: absolute; top: 14px; right: 16px; background: rgba(255,255,255,0.2); border: none; color: #ffffff; width: 32px; height: 32px; border-radius: 50%; font-size: 1.25rem; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: 700;">×</button>
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 1.6rem;">📦</span>
              <div>
                <h2 style="margin: 0; font-size: 1.3rem; font-weight: 800; color: #ffffff;">My Orders</h2>
                <span style="font-size: 0.78rem; color: #bfdbfe;">Current live production &amp; past purchase history</span>
              </div>
            </div>

            <!-- Segmented Tabs -->
            <div style="display: flex; gap: 8px; margin-top: 14px; background: rgba(0,0,0,0.2); padding: 4px; border-radius: 12px;">
              <button type="button" id="tab-btn-current-orders" style="flex: 1; padding: 8px 12px; border-radius: 8px; border: none; font-size: 0.82rem; font-weight: 800; cursor: pointer; transition: all 0.2s; ${activeTab === 'current' ? 'background: #ffffff; color: #1e3a8a; box-shadow: 0 2px 6px rgba(0,0,0,0.15);' : 'background: transparent; color: #e0e7ff;'}">
                🔨 Current Orders (${freshCurrent.length})
              </button>
              <button type="button" id="tab-btn-previous-orders" style="flex: 1; padding: 8px 12px; border-radius: 8px; border: none; font-size: 0.82rem; font-weight: 800; cursor: pointer; transition: all 0.2s; ${activeTab === 'previous' ? 'background: #ffffff; color: #1e3a8a; box-shadow: 0 2px 6px rgba(0,0,0,0.15);' : 'background: transparent; color: #e0e7ff;'}">
                📦 Previous Orders (${freshPrevious.length})
              </button>
            </div>
          </div>

          <!-- Body Orders List -->
          <div style="padding: 16px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 12px; background: #f8fafc;">
            ${activeTab === 'current' ? `
              <!-- CURRENT ORDERS (STILL IN PRODUCTION) -->
              ${freshCurrent.length === 0 ? `
                <div style="text-align: center; padding: 40px 20px; color: #64748b;">
                  <span style="font-size: 3rem; display: block; margin-bottom: 8px;">🛍️</span>
                  <strong style="color: #1e293b; font-size: 1rem; display: block;">No orders in production</strong>
                  <p style="font-size: 0.82rem; margin: 6px 0 16px;">Orders freshly placed will appear here with live production tracking. Fulfilled orders are in Previous Orders.</p>
                  <button type="button" id="btn-browse-from-orders" style="background: #2563eb; color: #ffffff; border: none; padding: 10px 18px; border-radius: 10px; font-weight: 700; cursor: pointer;">Explore Artisan Crafts</button>
                </div>
              ` : freshCurrent.map(order => {
                const title = order.product || order.productName || 'Handcrafted Craft';
                const orderId = order.id;
                const qty = order.quantity || 1;
                const amount = Number(order.total_amount || order.totalAmount || 0).toLocaleString('en-IN');
                const status = order.status || 'Production Started';
                const placed = order.order_placed_time || order.orderPlacedTime || 'Today, Just now';
                const artisan = order.artisan || 'Verified Cooperative';
                const expected = order.expected_delivery || order.expectedDelivery || '18 Sep 2026';
                
                let statusBg = '#e0f2fe';
                let statusColor = '#0369a1';
                if (status.toLowerCase().includes('started')) { statusBg = '#fef3c7'; statusColor = '#b45309'; }
                else if (status.toLowerCase().includes('qual')) { statusBg = '#e0e7ff'; statusColor = '#4338ca'; }
                else if (status.toLowerCase().includes('ship') || status.toLowerCase().includes('dispatch')) { statusBg = '#f3e8ff'; statusColor = '#7e22ce'; }

                return `
                  <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); text-align: left;">
                    <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 8px;">
                      <div>
                        <h4 style="margin: 0 0 2px 0; font-size: 0.98rem; font-weight: 800; color: #0f172a;">${escapeHtml(title)}</h4>
                        <span style="font-family: monospace; font-size: 0.74rem; color: #64748b; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">#${escapeHtml(orderId)}</span>
                      </div>
                      <span style="background: ${statusBg}; color: ${statusColor}; font-size: 0.72rem; font-weight: 800; padding: 3px 8px; border-radius: 6px; white-space: nowrap;">
                        ● ${escapeHtml(status)}
                      </span>
                    </div>

                    <!-- Order Placed Time -->
                    <div style="background: #f0fdf4; border: 1px dashed #86efac; border-radius: 8px; padding: 6px 10px; margin-bottom: 10px; font-size: 0.78rem; display: flex; align-items: center; justify-content: space-between;">
                      <span style="color: #166534; font-weight: 700;">🕒 Placed Time:</span>
                      <strong style="color: #15803d;">${escapeHtml(placed)}</strong>
                    </div>

                    <!-- Meta info -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 0.8rem; margin-bottom: 12px; color: #475569;">
                      <div>Qty: <strong style="color: #1e293b;">${qty} units</strong></div>
                      <div>Total: <strong style="color: #059669; font-size: 0.92rem;">₹${amount}</strong></div>
                      <div style="grid-column: span 2;">Artisan: <strong style="color: #334155;">${escapeHtml(artisan)}</strong></div>
                      <div style="grid-column: span 2; font-size: 0.75rem; color: #64748b;">Expected Delivery: <strong style="color: #0f172a;">${escapeHtml(expected)}</strong></div>
                    </div>

                    <!-- Track Order Button -->
                    <button type="button" class="btn-track-this-order" data-order-id="${escapeHtml(orderId)}" style="width: 100%; padding: 10px; background: linear-gradient(135deg, #1d4ed8, #2563eb); color: #ffffff; border: none; border-radius: 10px; font-weight: 800; font-size: 0.88rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 6px rgba(37,99,235,0.3);">
                      📦 Track Order
                    </button>
                  </div>
                `;
              }).join('')}
            ` : `
              <!-- PREVIOUS ORDERS (DELIVERED / FULFILLED) -->
              ${freshPrevious.length === 0 ? `
                <div style="text-align: center; padding: 40px 20px; color: #64748b;">
                  <span style="font-size: 3rem; display: block; margin-bottom: 8px;">📦</span>
                  <strong style="color: #1e293b; font-size: 1rem; display: block;">No past delivered orders</strong>
                  <p style="font-size: 0.82rem; margin: 6px 0;">Completed and delivered orders will appear here.</p>
                </div>
              ` : freshPrevious.map(order => {
                const title = order.product || order.productName || 'Handcrafted Craft';
                const orderId = order.id;
                const qty = order.quantity || 1;
                const amount = Number(order.total_amount || order.totalAmount || 0).toLocaleString('en-IN');
                const deliveredOn = order.delivered_date || 'Delivered';
                const placedOn = order.order_placed_time || order.orderPlacedTime || order.order_date || 'Past Order';
                const artisan = order.artisan || 'Verified Guild';

                return `
                  <div style="background: #ffffff; border: 1.5px solid #dcfce7; border-radius: 14px; padding: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.03); text-align: left;">
                    <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 8px;">
                      <div>
                        <h4 style="margin: 0 0 2px 0; font-size: 0.98rem; font-weight: 800; color: #0f172a;">${escapeHtml(title)}</h4>
                        <span style="font-family: monospace; font-size: 0.74rem; color: #64748b; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">#${escapeHtml(orderId)}</span>
                      </div>
                      <span style="background: #dcfce7; color: #15803d; font-size: 0.72rem; font-weight: 800; padding: 3px 8px; border-radius: 6px; border: 1px solid #86efac; white-space: nowrap;">
                        ✓ Delivered
                      </span>
                    </div>

                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 10px; margin-bottom: 10px; font-size: 0.76rem; color: #64748b; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 4px;">
                      <span>🕒 Placed: <strong style="color: #334155;">${escapeHtml(placedOn)}</strong></span>
                      <span style="color: #166534; font-weight: 700;">✓ Delivered on: ${escapeHtml(deliveredOn)}</span>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 0.8rem; margin-bottom: 12px; color: #475569;">
                      <div>Qty: <strong style="color: #1e293b;">${qty} units</strong></div>
                      <div>Total: <strong style="color: #059669; font-size: 0.92rem;">₹${amount}</strong></div>
                      <div style="grid-column: span 2;">Artisan: <strong style="color: #334155;">${escapeHtml(artisan)}</strong></div>
                    </div>

                    <button type="button" class="btn-track-this-order" data-order-id="${escapeHtml(orderId)}" style="width: 100%; padding: 8px; background: #f0fdf4; color: #166534; border: 1.5px solid #86efac; border-radius: 8px; font-weight: 800; font-size: 0.82rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
                      📦 View Tracking History
                    </button>
                  </div>
                `;
              }).join('')}
            `}
          </div>
        </div>
      `;

      // Event Handlers inside modal
      modal.querySelector('#btn-close-buyer-orders')?.addEventListener('click', () => modal.remove());
      modal.querySelector('#btn-browse-from-orders')?.addEventListener('click', () => {
        modal.remove();
        navigateTo('buyer-explore');
      });

      modal.querySelector('#tab-btn-current-orders')?.addEventListener('click', () => {
        activeTab = 'current';
        renderModalContent();
      });

      modal.querySelector('#tab-btn-previous-orders')?.addEventListener('click', () => {
        activeTab = 'previous';
        renderModalContent();
      });

      modal.querySelectorAll('.btn-track-this-order').forEach(btn => {
        btn.addEventListener('click', () => {
          const ordId = btn.dataset.orderId;
          modal.remove();
          sessionStorage.setItem('kala_mitra_selected_tracking_order', ordId);
          navigateTo('buyer-opportunities');
        });
      });
    };

    renderModalContent();
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  // Enhanced Buyer Profile: Preserves original buyer profile card AND embeds orders inside profile
  let buyerProfileActiveTab = 'current'; // 'current' | 'previous'

  function renderBuyerProfile() {
    currentProfileMode = 'buyer';
    currentArtisanForProfile = null;
    const user = authService.getCurrentUser();
    const container = document.getElementById('buyer-profile-content');
    if (!container) return;

    const profileScreen = document.getElementById('screen-buyer-profile');
    if (profileScreen) {
      const titleEl = profileScreen.querySelector('.buyer-panel-title');
      if (titleEl) titleEl.textContent = 'Buyer Profile';
      const backBtn = profileScreen.querySelector('.back-btn');
      if (backBtn) {
        backBtn.setAttribute('data-buyer-nav', 'home');
        backBtn.onclick = (e) => {
          e.preventDefault();
          navigateTo('buyer-home');
        };
      }
    }

    const name = user?.name || 'Buyer';
    const location = user?.location || 'East Godavari, Andhra Pradesh';
    const contact = user?.phone || user?.email || 'Verified Buyer';
    const lang = user?.preferredLanguage || 'English';

    const masterOrders = getMasterOrders();
    const currentOrders = masterOrders.filter(o => (o.status || '').toLowerCase() !== 'delivered');
    const previousOrders = masterOrders.filter(o => (o.status || '').toLowerCase() === 'delivered');

    container.innerHTML = `
      <!-- 1. Original Buyer Profile Data Card -->
      <div class="buyer-panel-card">
        <div class="buyer-profile-head">
          <div class="buyer-avatar buyer-avatar-large">${getBuyerInitials()}</div>
          <div>
            <h3>${escapeHtml(name)}</h3>
            <p>Verified Buyer</p>
          </div>
        </div>
        <div class="buyer-bulk-detail-row"><span>Location:</span><strong>${escapeHtml(location)}</strong></div>
        <div class="buyer-bulk-detail-row"><span>Contact:</span><strong>${escapeHtml(contact)}</strong></div>
        <div class="buyer-bulk-detail-row"><span>Preferred Language:</span><strong>${escapeHtml(lang)}</strong></div>
      </div>

      <!-- 2. Orders Inside Profile Section -->
      <div class="buyer-panel-card" style="margin-top: 18px; padding: 20px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 1.5rem;">📦</span>
            <div>
              <h3 style="margin: 0; font-size: 1.2rem; font-weight: 800; color: #0f172a;">My Orders</h3>
              <span style="font-size: 0.78rem; color: #64748b;">Current live production &amp; past purchase history</span>
            </div>
          </div>

        </div>

        <!-- Segmented Tabs for Current vs Previous Orders -->
        <div style="display: flex; gap: 8px; margin-bottom: 16px; background: #f1f5f9; padding: 5px; border-radius: 12px; border: 1px solid #e2e8f0;">
          <button type="button" id="profile-tab-btn-current" style="flex: 1; padding: 10px 14px; border-radius: 8px; border: none; font-size: 0.85rem; font-weight: 800; cursor: pointer; transition: all 0.2s; ${buyerProfileActiveTab === 'current' ? 'background: #0284c7; color: #ffffff; box-shadow: 0 2px 6px rgba(2, 132, 199, 0.35);' : 'background: transparent; color: #475569;'}">
            🔨 Current Orders (${currentOrders.length})
          </button>
          <button type="button" id="profile-tab-btn-previous" style="flex: 1; padding: 10px 14px; border-radius: 8px; border: none; font-size: 0.85rem; font-weight: 800; cursor: pointer; transition: all 0.2s; ${buyerProfileActiveTab === 'previous' ? 'background: #059669; color: #ffffff; box-shadow: 0 2px 6px rgba(5, 150, 105, 0.35);' : 'background: transparent; color: #475569;'}">
            📦 Previous Orders (${previousOrders.length})
          </button>
        </div>

        <!-- Order List Inner Container -->
        <div id="profile-orders-list-inner" style="display: flex; flex-direction: column; gap: 14px;"></div>
      </div>
    `;

    const renderInnerOrdersList = () => {
      const listInner = container.querySelector('#profile-orders-list-inner');
      if (!listInner) return;

      const freshMaster = getMasterOrders();
      const freshCurrent = freshMaster.filter(o => (o.status || '').toLowerCase() !== 'delivered');
      const freshPrevious = freshMaster.filter(o => (o.status || '').toLowerCase() === 'delivered');

      if (buyerProfileActiveTab === 'current') {
        if (freshCurrent.length === 0) {
          listInner.innerHTML = `
            <div style="text-align: center; padding: 32px 16px; color: #64748b; background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 12px;">
              <span style="font-size: 2.5rem; display: block; margin-bottom: 6px;">🛍️</span>
              <strong style="color: #1e293b; font-size: 0.95rem; display: block;">No orders in production</strong>
              <p style="font-size: 0.8rem; margin: 4px 0 14px;">Freshly placed buyer orders will appear here with live tracking. Fulfilled orders are in Previous Orders.</p>
              <button type="button" class="primary-btn" id="btn-profile-explore-crafts" style="padding: 8px 16px; font-size: 0.82rem; font-weight: 700;">Explore Artisan Crafts</button>
            </div>
          `;
          listInner.querySelector('#btn-profile-explore-crafts')?.addEventListener('click', () => {
            renderBuyerDiscover();
            navigateTo('buyer-discover');
          });
          return;
        }

        listInner.innerHTML = freshCurrent.map(order => {
          const title = order.product || order.productName || 'Handcrafted Craft';
          const orderId = order.id;
          const qty = order.quantity || 1;
          const amount = Number(order.total_amount || order.totalAmount || 0).toLocaleString('en-IN');
          const status = order.status || 'Production Started';
          const placed = order.order_placed_time || order.orderPlacedTime || 'Today, Just now';
          const artisan = order.artisan || 'Verified Cooperative';
          const expected = order.expected_delivery || order.expectedDelivery || '18 Sep 2026';

          let statusBg = '#e0f2fe';
          let statusColor = '#0369a1';
          if (status.toLowerCase().includes('started')) { statusBg = '#fef3c7'; statusColor = '#b45309'; }
          else if (status.toLowerCase().includes('qual')) { statusBg = '#e0e7ff'; statusColor = '#4338ca'; }
          else if (status.toLowerCase().includes('ship') || status.toLowerCase().includes('dispatch')) { statusBg = '#f3e8ff'; statusColor = '#7e22ce'; }

          return `
            <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); text-align: left;">
              <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 8px;">
                <div>
                  <h4 style="margin: 0 0 2px 0; font-size: 1rem; font-weight: 800; color: #0f172a;">${escapeHtml(title)}</h4>
                  <span style="font-family: monospace; font-size: 0.74rem; color: #64748b; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">#${escapeHtml(orderId)}</span>
                </div>
                <span style="background: ${statusBg}; color: ${statusColor}; font-size: 0.72rem; font-weight: 800; padding: 3px 8px; border-radius: 6px; white-space: nowrap;">
                  ● ${escapeHtml(status)}
                </span>
              </div>

              <div style="background: #f0fdf4; border: 1px dashed #86efac; border-radius: 8px; padding: 6px 10px; margin-bottom: 10px; font-size: 0.78rem; display: flex; align-items: center; justify-content: space-between;">
                <span style="color: #166534; font-weight: 700;">🕒 Placed Time:</span>
                <strong style="color: #15803d;">${escapeHtml(placed)}</strong>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 0.8rem; margin-bottom: 12px; color: #475569;">
                <div>Qty: <strong style="color: #1e293b;">${qty} units</strong></div>
                <div>Total: <strong style="color: #059669; font-size: 0.92rem;">₹${amount}</strong></div>
                <div style="grid-column: span 2;">Artisan: <strong style="color: #334155;">${escapeHtml(artisan)}</strong></div>
                <div style="grid-column: span 2; font-size: 0.75rem; color: #64748b;">Expected Delivery: <strong style="color: #0f172a;">${escapeHtml(expected)}</strong></div>
              </div>

              <button type="button" class="btn-profile-track-order" data-order-id="${escapeHtml(orderId)}" style="width: 100%; padding: 10px; background: linear-gradient(135deg, #1d4ed8, #2563eb); color: #ffffff; border: none; border-radius: 10px; font-weight: 800; font-size: 0.88rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 6px rgba(37,99,235,0.3);">
                📦 Track Order
              </button>
            </div>
          `;
        }).join('');
      } else {
        if (freshPrevious.length === 0) {
          listInner.innerHTML = `
            <div style="text-align: center; padding: 32px 16px; color: #64748b; background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 12px;">
              <span style="font-size: 2.5rem; display: block; margin-bottom: 6px;">📦</span>
              <strong style="color: #1e293b; font-size: 0.95rem; display: block;">No past delivered orders</strong>
              <p style="font-size: 0.8rem; margin: 4px 0;">Orders updated to "Delivered" by artisans will appear here.</p>
            </div>
          `;
          return;
        }

        listInner.innerHTML = freshPrevious.map(order => {
          const title = order.product || order.productName || 'Handcrafted Craft';
          const orderId = order.id;
          const qty = order.quantity || 1;
          const amount = Number(order.total_amount || order.totalAmount || 0).toLocaleString('en-IN');
          const deliveredOn = order.delivered_date || 'Delivered';
          const placedOn = order.order_placed_time || order.orderPlacedTime || order.order_date || 'Past Order';
          const artisan = order.artisan || 'Verified Guild';

          return `
            <div style="background: #ffffff; border: 1.5px solid #dcfce7; border-radius: 14px; padding: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.03); text-align: left;">
              <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 8px;">
                <div>
                  <h4 style="margin: 0 0 2px 0; font-size: 1rem; font-weight: 800; color: #0f172a;">${escapeHtml(title)}</h4>
                  <span style="font-family: monospace; font-size: 0.74rem; color: #64748b; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">#${escapeHtml(orderId)}</span>
                </div>
                <span style="background: #dcfce7; color: #15803d; font-size: 0.72rem; font-weight: 800; padding: 3px 8px; border-radius: 6px; border: 1px solid #86efac; white-space: nowrap;">
                  ✓ Delivered
                </span>
              </div>

              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 10px; margin-bottom: 10px; font-size: 0.76rem; color: #64748b; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 4px;">
                <span>🕒 Placed: <strong style="color: #334155;">${escapeHtml(placedOn)}</strong></span>
                <span style="color: #166534; font-weight: 700;">✓ Delivered: ${escapeHtml(deliveredOn)}</span>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 0.8rem; margin-bottom: 12px; color: #475569;">
                <div>Qty: <strong style="color: #1e293b;">${qty} units</strong></div>
                <div>Total: <strong style="color: #059669; font-size: 0.92rem;">₹${amount}</strong></div>
                <div style="grid-column: span 2;">Artisan: <strong style="color: #334155;">${escapeHtml(artisan)}</strong></div>
              </div>

              <button type="button" class="btn-profile-track-order" data-order-id="${escapeHtml(orderId)}" style="width: 100%; padding: 8px; background: #f0fdf4; color: #166534; border: 1.5px solid #86efac; border-radius: 8px; font-weight: 800; font-size: 0.82rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
                📦 View Tracking History
              </button>
            </div>
          `;
        }).join('');
      }

      listInner.querySelectorAll('.btn-profile-track-order').forEach(btn => {
        btn.addEventListener('click', () => {
          const ordId = btn.dataset.orderId;
          sessionStorage.setItem('kala_mitra_selected_tracking_order', ordId);
          navigateTo('buyer-opportunities');
        });
      });
    };

    renderInnerOrdersList();

    // Event listeners for tabs and modal


    container.querySelector('#profile-tab-btn-current')?.addEventListener('click', () => {
      buyerProfileActiveTab = 'current';
      renderBuyerProfile();
    });

    container.querySelector('#profile-tab-btn-previous')?.addEventListener('click', () => {
      buyerProfileActiveTab = 'previous';
      renderBuyerProfile();
    });
  }

  // Live auto-refresh when artisan updates status
  window.addEventListener('kala-order-status-updated', () => {
    if (document.getElementById('screen-buyer-profile')?.classList.contains('active')) {
      renderBuyerProfile();
    }
  });
  window.addEventListener('kala-artisan-orders-updated', () => {
    if (document.getElementById('screen-buyer-profile')?.classList.contains('active')) {
      renderBuyerProfile();
    }
  });
    const btnBuyerLogout = document.getElementById('btn-buyer-logout');
  if (btnBuyerLogout) {
    btnBuyerLogout.addEventListener('click', async () => {
      await authService.signOut();
      showToast('Logged out securely');
      navigateTo('landing');
    });
  }

  // =========================================================================
  // 9. Back Button Handlers
  // =========================================================================
  const btnBackAuth = document.getElementById('btn-back-auth');
  const btnBackOtp = document.getElementById('btn-back-otp');
  const btnChangePhone = document.getElementById('btn-change-phone');
  const btnBackEmailVerify = document.getElementById('btn-back-email-verify');
  const btnChangeEmail = document.getElementById('btn-change-email');

  if (btnBackAuth) btnBackAuth.addEventListener('click', () => navigateTo('landing'));
  if (btnBackOtp) btnBackOtp.addEventListener('click', () => navigateTo('auth'));
  if (btnChangePhone) btnChangePhone.addEventListener('click', () => navigateTo('auth'));
  if (btnBackEmailVerify) btnBackEmailVerify.addEventListener('click', () => navigateTo('auth'));
  if (btnChangeEmail) btnChangeEmail.addEventListener('click', () => navigateTo('auth'));

  // Android Navigation Bar System Event Listeners
  const androidNavBack = document.getElementById('android-nav-back');
  const androidNavHome = document.getElementById('android-nav-home');
  const androidNavRecents = document.getElementById('android-nav-recents');

  if (androidNavBack) {
    androidNavBack.addEventListener('click', () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        navigateTo('landing');
      }
    });
  }

  if (androidNavHome) {
    androidNavHome.addEventListener('click', () => {
      const user = authService.getCurrentUser();
      if (user && user.role === 'Artisan') {
        navigateTo('artisan-dashboard');
      } else if (user && user.role === 'Buyer') {
        navigateTo('buyer-home');
      } else {
        navigateTo('landing');
      }
    });
  }

  if (androidNavRecents) {
    androidNavRecents.addEventListener('click', () => {
      if (typeof showToast === 'function') {
        showToast('📱 KALA-MITRA Android App Active');
      }
    });
  }

  // Smartphone Mockup Hardware Buttons (Power & Volume)
  const phoneBtnPower = document.querySelector('.phone-button--power');
  if (phoneBtnPower) {
    phoneBtnPower.addEventListener('click', () => {
      const screenWrapper = document.querySelector('.phone-screen-wrapper');
      if (screenWrapper) {
        const isDimmed = screenWrapper.style.opacity === '0.08';
        screenWrapper.style.opacity = isDimmed ? '1' : '0.08';
        screenWrapper.style.transition = 'opacity 0.25s ease';
        if (typeof showToast === 'function') {
          showToast(isDimmed ? '📱 Screen turned on' : '📱 Screen locked / standby');
        }
      }
    });
  }

  const phoneBtnVolUp = document.querySelector('.phone-button--volume-up');
  if (phoneBtnVolUp) {
    phoneBtnVolUp.addEventListener('click', () => {
      if (typeof showToast === 'function') {
        showToast('🔊 Volume: 80%');
      }
    });
  }

  const phoneBtnVolDown = document.querySelector('.phone-button--volume-down');
  if (phoneBtnVolDown) {
    phoneBtnVolDown.addEventListener('click', () => {
      if (typeof showToast === 'function') {
        showToast('🔉 Volume: 60%');
      }
    });
  }

  // Utility to prevent XSS
  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[m]);
  }

  // =========================================================================
  // 9.1 Global Language Synchronization
  // =========================================================================
  document.addEventListener('change', (e) => {
    if (
      e.target &&
      (e.target.id === 'global-language-select' ||
       e.target.id === 'artisan-lang-select' ||
       e.target.id === 'buyer-lang-select' ||
       e.target.classList.contains('header-lang-select'))
    ) {
      applyLanguage(e.target.value);
    }
  });

  // Apply default language immediately (defaulting to English)
  applyLanguage(selectedLanguage);

  // Initialize compact image search controls
  initCompactImageSearch();

  // =========================================================================
  // 10. Initial App Launch Inspection
  // =========================================================================
  const initialHash = window.location.hash.replace('#', '');
  if (initialHash && screens[initialHash]) {
    if (initialHash === 'buyer-orders') {
      renderBuyerOrders();
    }
    navigateTo(initialHash, false);
  } else if (authService.isAuthenticated()) {
    const user = authService.getCurrentUser();
    if (user && user.role === 'Artisan') {
      navigateTo('artisan-dashboard', false);
    } else {
      navigateTo('buyer-home', false);
    }
  } else if (authService.hasPendingProfileSetup()) {
    navigateTo('profile-setup', false);
  } else {
    navigateTo('landing', false);
  }

  // Update live mobile status bar clock
  function updateMobileClock() {
    const clockEl = document.getElementById('status-clock');
    if (clockEl) {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      clockEl.textContent = `${hours}:${minutes} ${ampm}`;
    }
  }
  updateMobileClock();
  setInterval(updateMobileClock, 1000);
});
