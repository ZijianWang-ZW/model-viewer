import type { Viewer } from './viewer/Viewer';

/**
 * Simple file loader with drag & drop support
 * Always clears previous model when loading a new one
 */
export class FileLoadManager {
  private viewer: Viewer;
  private fileInput: HTMLInputElement;
  private container: HTMLElement;
  
  private onLoadComplete?: () => void;

  constructor(viewer: Viewer) {
    this.viewer = viewer;
    this.fileInput = document.getElementById('file') as HTMLInputElement;
    this.container = document.getElementById('container')!;
    
    this.setupEventListeners();
  }

  /**
   * Set callback for when model loading completes
   */
  setLoadCompleteCallback(callback: () => void): void {
    this.onLoadComplete = callback;
  }

  /**
   * Load a GLB file (always clears previous model)
   */
  async loadFile(file: File): Promise<void> {
    const t0 = performance.now();
    
    // Always clear previous model before loading new one
    await this.viewer.loadGLBFromFile(file);
    
    const loadTime = (performance.now() - t0) / 1000;
    console.log(`✅ Loaded ${file.name} in ${loadTime.toFixed(2)}s`);
    
    // Update load time stat
    const loadSecEl = document.getElementById('stat-loadsec');
    if (loadSecEl) loadSecEl.textContent = loadTime.toFixed(2);
    
    // Call callback to update UI
    if (this.onLoadComplete) {
      this.onLoadComplete();
    }
  }

  /**
   * Setup event listeners for file input and drag & drop
   */
  private setupEventListeners(): void {
    // File input change
    this.fileInput.addEventListener('change', (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        this.loadFile(files[0]); // Only load first file
      }
    });

    // Open button
    const openBtn = document.getElementById('open');
    if (openBtn) {
      openBtn.addEventListener('click', () => {
        this.fileInput.click();
      });
    }

    // Drag and drop
    this.container.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.container.style.opacity = '0.8';
    });

    this.container.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.container.style.opacity = '1';
    });

    this.container.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.container.style.opacity = '1';

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        // Find first .glb file
        for (let i = 0; i < files.length; i++) {
          if (files[i].name.toLowerCase().endsWith('.glb')) {
            this.loadFile(files[i]);
            break;
          }
        }
      }
    });
  }
}
