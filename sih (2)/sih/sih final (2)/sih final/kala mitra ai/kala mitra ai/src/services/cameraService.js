/**
 * KALA-MITRA Camera Service
 * Clean abstraction for device camera lifecycle, permissions, live preview,
 * stream management, resolution handling, torch/flash, and photo capture.
 * Designed for both real Android/Mobile devices and desktop testing.
 */

export const CameraErrorType = {
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  NOT_FOUND: 'NOT_FOUND',
  IN_USE: 'IN_USE',
  UNSUPPORTED: 'UNSUPPORTED',
  INITIALIZATION_FAILED: 'INITIALIZATION_FAILED',
  CAPTURE_FAILED: 'CAPTURE_FAILED'
};

export class CameraService {
  constructor() {
    this._currentStream = null;
    this._activeFacingMode = 'environment'; // default to rear camera
    this._availableCameras = [];
    this._currentCameraIndex = 0;
    this._torchEnabled = false;
  }

  /**
   * Check if getUserMedia and mediaDevices are supported
   */
  isSupported() {
    return Boolean(
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function'
    );
  }

  /**
   * Enumerate available video input devices
   */
  async getAvailableCameras() {
    if (!this.isSupported()) return [];
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this._availableCameras = devices.filter(d => d.kind === 'videoinput');
      return this._availableCameras;
    } catch (err) {
      console.warn('Failed to enumerate video devices:', err);
      return [];
    }
  }

  /**
   * Start live camera stream
   * @param {Object} options
   * @param {HTMLVideoElement} options.videoElement
   * @param {'environment' | 'user'} [options.facingMode='environment']
   * @param {string} [options.deviceId]
   * @returns {Promise<{ stream: MediaStream, facingMode: string, hasTorch: boolean, multipleCameras: boolean }>}
   */
  async startCamera({ videoElement, facingMode = 'environment', deviceId = null } = {}) {
    if (!this.isSupported()) {
      const error = new Error('Camera access is not supported by your browser or environment.');
      error.type = CameraErrorType.UNSUPPORTED;
      throw error;
    }

    // Stop any existing stream before starting a new one
    this.stopCamera(videoElement);

    this._activeFacingMode = facingMode;

    const constraints = {
      audio: false,
      video: {
        width: { ideal: 1920, min: 640 },
        height: { ideal: 1080, min: 480 }
      }
    };

    if (deviceId) {
      constraints.video.deviceId = { exact: deviceId };
    } else {
      constraints.video.facingMode = { ideal: facingMode };
    }

    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (primaryErr) {
      console.warn('Initial camera constraint failed, attempting relaxed fallback:', primaryErr);
      // Fallback with basic video constraint
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: deviceId ? { deviceId: { exact: deviceId } } : true
        });
      } catch (fallbackErr) {
        const error = this._classifyError(fallbackErr);
        throw error;
      }
    }

    this._currentStream = stream;

    // Attach to video element if provided
    if (videoElement) {
      videoElement.srcObject = stream;
      videoElement.setAttribute('playsinline', 'true');
      videoElement.setAttribute('autoplay', 'true');
      videoElement.muted = true;

      try {
        await videoElement.play();
      } catch (playErr) {
        console.warn('Video play interrupted or autoplay blocked:', playErr);
      }
    }

    // Check torch / flash capability
    const hasTorch = this._checkTorchCapability(stream);

    // Refresh devices list
    await this.getAvailableCameras();
    const multipleCameras = this._availableCameras.length > 1;

    return {
      stream,
      facingMode: this._activeFacingMode,
      hasTorch,
      multipleCameras
    };
  }

  /**
   * Check if current video track supports torch/flash
   */
  _checkTorchCapability(stream) {
    if (!stream) return false;
    const track = stream.getVideoTracks()[0];
    if (!track) return false;
    const capabilities = typeof track.getCapabilities === 'function' ? track.getCapabilities() : {};
    return Boolean(capabilities.torch);
  }

  /**
   * Toggle Torch / Flash on supported mobile devices
   */
  async toggleTorch(enable) {
    if (!this._currentStream) return false;
    const track = this._currentStream.getVideoTracks()[0];
    if (!track) return false;

    try {
      const capabilities = typeof track.getCapabilities === 'function' ? track.getCapabilities() : {};
      if (capabilities.torch) {
        await track.applyConstraints({
          advanced: [{ torch: Boolean(enable) }]
        });
        this._torchEnabled = Boolean(enable);
        return true;
      }
    } catch (err) {
      console.warn('Failed to toggle torch:', err);
    }
    return false;
  }

  /**
   * Switch between Front and Rear cameras
   */
  async switchCamera(videoElement) {
    const nextFacingMode = this._activeFacingMode === 'environment' ? 'user' : 'environment';
    return await this.startCamera({
      videoElement,
      facingMode: nextFacingMode
    });
  }

  /**
   * Capture a snapshot from the live video stream
   * @param {HTMLVideoElement} videoElement
   * @param {Object} [options]
   * @param {string} [options.mimeType='image/jpeg']
   * @param {number} [options.quality=0.92]
   * @returns {Promise<{ blob: Blob, dataUrl: string, width: number, height: number, file: File, filename: string }>}
   */
  async captureFrame(videoElement, { mimeType = 'image/jpeg', quality = 0.92 } = {}) {
    if (!videoElement || !this._currentStream) {
      const error = new Error('No active camera stream available for capture.');
      error.type = CameraErrorType.CAPTURE_FAILED;
      throw error;
    }

    const width = videoElement.videoWidth || videoElement.clientWidth || 1280;
    const height = videoElement.videoHeight || videoElement.clientHeight || 720;

    if (width === 0 || height === 0) {
      const error = new Error('Camera is still initializing video frame.');
      error.type = CameraErrorType.CAPTURE_FAILED;
      throw error;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      const error = new Error('Could not create canvas context.');
      error.type = CameraErrorType.CAPTURE_FAILED;
      throw error;
    }

    // If using front camera, optionally un-mirror snapshot for natural capture
    ctx.drawImage(videoElement, 0, 0, width, height);

    const dataUrl = canvas.toDataURL(mimeType, quality);
    const filename = `craft_photo_${Date.now()}.jpg`;

    const blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), mimeType, quality);
    });

    const file = new File([blob || dataUrl], filename, { type: mimeType });

    return {
      blob,
      dataUrl,
      width,
      height,
      file,
      filename
    };
  }

  /**
   * Stop active camera stream and release hardware resources
   */
  stopCamera(videoElement = null) {
    if (this._currentStream) {
      try {
        const tracks = this._currentStream.getTracks();
        tracks.forEach(track => {
          try {
            track.stop();
          } catch (e) {
            console.warn('Track stop warning:', e);
          }
        });
      } catch (e) {
        console.warn('Error stopping stream tracks:', e);
      }
      this._currentStream = null;
    }

    if (videoElement) {
      try {
        videoElement.srcObject = null;
      } catch (e) {
        console.warn('Error detaching srcObject:', e);
      }
    }

    this._torchEnabled = false;
  }

  /**
   * Map DOMExceptions to human-friendly Artisan errors
   */
  _classifyError(err) {
    const error = new Error();
    const name = err.name || '';

    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      error.type = CameraErrorType.PERMISSION_DENIED;
      error.message = 'Camera permission is required to take a product photo.';
      error.userAction = 'Please allow camera access in your device/browser settings.';
    } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      error.type = CameraErrorType.NOT_FOUND;
      error.message = 'No camera found on this device.';
      error.userAction = 'You can upload photos directly from the Gallery.';
    } else if (name === 'NotReadableError' || name === 'TrackStartError') {
      error.type = CameraErrorType.IN_USE;
      error.message = 'Camera is currently in use by another application.';
      error.userAction = 'Please close other apps using the camera and try again.';
    } else if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
      error.type = CameraErrorType.INITIALIZATION_FAILED;
      error.message = 'Camera settings not supported by your hardware.';
      error.userAction = 'Starting camera with standard settings...';
    } else {
      error.type = CameraErrorType.GENERIC;
      error.message = "Camera couldn't be opened. Please try again.";
      error.userAction = 'Tap Try Again or select an image from your Gallery.';
    }

    return error;
  }
}

export const cameraService = new CameraService();
