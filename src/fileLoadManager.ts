import type { Viewer } from './viewer/Viewer';
import type { DisciplineType } from './modelManager';

/**
 * Manages multi-file loading workflow with discipline selection
 */
export class FileLoadManager {
  private fileQueue: File[] = [];
  private currentFileIndex = 0;
  private viewer: Viewer;
  
  private disciplineModal: HTMLElement;
  private disciplineOptions: NodeListOf<Element>;
  private disciplineConfirm: HTMLButtonElement;
  private disciplineCancel: HTMLElement;
  private fileInput: HTMLInputElement;
  
  private pendingFile: File | null = null;
  private selectedDiscipline: DisciplineType | null = null;
  
  private onLoadComplete?: () => void;

  constructor(viewer: Viewer) {
    this.viewer = viewer;
    
    // Get DOM elements
    this.disciplineModal = document.getElementById('discipline-modal')!;
    this.disciplineOptions = document.querySelectorAll('.discipline-option');
    this.disciplineConfirm = document.getElementById('discipline-confirm') as HTMLButtonElement;
    this.disciplineCancel = document.getElementById('discipline-cancel')!;
    this.fileInput = document.getElementById('file') as HTMLInputElement;
    
    this.setupEventListeners();
  }

  /**
   * Set callback for when model loading completes
   */
  setLoadCompleteCallback(callback: () => void): void {
    this.onLoadComplete = callback;
  }

  /**
   * Start loading files - shows modal for first file
   */
  loadFiles(files: FileList | File[]): void {
    this.fileQueue = Array.from(files);
    this.currentFileIndex = 0;
    this.processNextFile();
  }

  /**
   * Process next file in queue
   */
  private processNextFile(): void {
    if (this.currentFileIndex >= this.fileQueue.length) {
      // All files processed
      this.fileQueue = [];
      this.currentFileIndex = 0;
      this.fileInput.value = '';
      return;
    }
    
    const file = this.fileQueue[this.currentFileIndex];
    this.showDisciplineModalForFile(file, this.currentFileIndex + 1, this.fileQueue.length);
  }

  /**
   * Show discipline selection modal for a file
   */
  private showDisciplineModalForFile(file: File, fileNumber: number, totalFiles: number): void {
    this.pendingFile = file;
    this.selectedDiscipline = null;
    this.disciplineOptions.forEach(opt => opt.classList.remove('selected'));
    this.disciplineConfirm.disabled = true;
    
    // Update modal title to show progress
    const modalTitle = this.disciplineModal.querySelector('h3');
    if (modalTitle) {
      if (totalFiles > 1) {
        modalTitle.textContent = `Select Discipline (${fileNumber}/${totalFiles}): ${file.name}`;
      } else {
        modalTitle.textContent = `Select Discipline: ${file.name}`;
      }
    }
    
    this.disciplineModal.classList.add('active');
  }

  /**
   * Reset modal to initial state
   */
  private resetDisciplineModal(): void {
    this.disciplineModal.classList.remove('active');
    this.disciplineOptions.forEach(opt => opt.classList.remove('selected'));
    this.disciplineConfirm.disabled = true;
    this.pendingFile = null;
    this.selectedDiscipline = null;
  }

  /**
   * Setup event listeners for modal and file input
   */
  private setupEventListeners(): void {
    // Discipline option selection
    this.disciplineOptions.forEach(option => {
      option.addEventListener('click', () => {
        this.disciplineOptions.forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        this.selectedDiscipline = option.getAttribute('data-discipline') as DisciplineType;
        this.disciplineConfirm.disabled = false;
      });
    });

    // Cancel button
    this.disciplineCancel.addEventListener('click', () => {
      this.resetDisciplineModal();
      this.fileQueue = [];
      this.currentFileIndex = 0;
      this.fileInput.value = '';
    });

    // Confirm button
    this.disciplineConfirm.addEventListener('click', async () => {
      if (!this.pendingFile || !this.selectedDiscipline) return;
      
      this.disciplineModal.classList.remove('active');
      const t0 = performance.now();
      
      // Load model
      await (this.viewer.getModelManager().hasModels()
        ? this.viewer.loadAdditionalModel(this.pendingFile, this.selectedDiscipline)
        : this.viewer.loadGLBFromFile(this.pendingFile, this.selectedDiscipline));
      
      const loadTime = (performance.now() - t0) / 1000;
      console.log(`✅ Loaded ${this.pendingFile.name} in ${loadTime.toFixed(2)}s`);
      
      // Update load time stat
      const loadSecEl = document.getElementById('stat-loadsec');
      if (loadSecEl) loadSecEl.textContent = loadTime.toFixed(2);
      
      // Call callback to update UI
      if (this.onLoadComplete) {
        this.onLoadComplete();
      }
      
      this.resetDisciplineModal();
      
      // Process next file in queue
      this.currentFileIndex++;
      this.processNextFile();
    });

    // File input change
    this.fileInput.addEventListener('change', (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        this.loadFiles(files);
      }
    });

    // Open button
    document.getElementById('open')!.addEventListener('click', () => {
      this.fileInput.click();
    });
  }
}

