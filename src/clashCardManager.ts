import type { Viewer } from './viewer/Viewer';

/**
 * Clash issue data structure from CSV
 */
export interface ClashIssue {
  issueName: string;
  issueGUID: string;
  description: string;
  componentName: string[];
  componentType: string[];
  componentGUID: string[];
  gptRelevance: string;
  gptType: string;
  gptConfidence: string;
  gptReasoning: string;
  consensusRelevance: string;
  consensusType: string;
}

/**
 * Manages clash detection results and card UI
 */
export class ClashCardManager {
  private viewer: Viewer;
  private clashes: ClashIssue[] = [];
  private currentIndex = 0;
  
  // UI elements
  private cardContainer: HTMLElement;
  private cardContent: HTMLElement;
  private prevBtn: HTMLButtonElement;
  private nextBtn: HTMLButtonElement;
  private closeBtn: HTMLButtonElement;
  private showAllBtn: HTMLButtonElement;
  private counterEl: HTMLElement;

  constructor(viewer: Viewer) {
    this.viewer = viewer;
    
    // Get UI elements
    this.cardContainer = document.getElementById('clash-card-container')!;
    this.cardContent = document.getElementById('clash-card-content')!;
    this.prevBtn = document.getElementById('clash-prev') as HTMLButtonElement;
    this.nextBtn = document.getElementById('clash-next') as HTMLButtonElement;
    this.closeBtn = document.getElementById('clash-close') as HTMLButtonElement;
    this.showAllBtn = document.getElementById('clash-show-all') as HTMLButtonElement;
    this.counterEl = document.getElementById('clash-counter')!;
    
    this.setupEventListeners();
  }

  /**
   * Load and parse CSV file
   */
  async loadClashesFromCSV(csvPath: string): Promise<void> {
    const response = await fetch(csvPath);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const csvText = await response.text();
    this.clashes = this.parseCSV(csvText);
    
    if (this.clashes.length > 0) {
      this.currentIndex = 0;
      this.showCard();
      this.displayClash(0);
      console.log(`✅ Loaded ${this.clashes.length} clashes`);
    }
  }

  /**
   * Parse CSV with proper handling of multi-line quoted fields
   */
  private parseCSV(csvText: string): ClashIssue[] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;
    
    // Parse CSV handling multi-line quoted fields
    for (let i = 0; i < csvText.length; i++) {
      const char = csvText[i];
      const nextChar = csvText[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentField += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (currentField || currentRow.length > 0) {
          currentRow.push(currentField.trim());
          if (currentRow.some(f => f.length > 0)) {
            rows.push(currentRow);
          }
          currentRow = [];
          currentField = '';
        }
      } else if (char !== '\r') {
        currentField += char;
      }
    }
    
    // Add last row
    if (currentField || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      if (currentRow.some(f => f.length > 0)) {
        rows.push(currentRow);
      }
    }
    
    if (rows.length < 2) return [];
    
    // Convert rows to ClashIssue objects
    const issues: ClashIssue[] = [];
    for (let i = 1; i < rows.length; i++) {
      const values = rows[i];
      if (values.length < 15) continue;
      
      issues.push({
        issueName: values[0] || '',
        issueGUID: values[1] || '',
        description: values[2] || '',
        componentName: this.parseArrayField(values[3]),
        componentType: this.parseArrayField(values[4]),
        componentGUID: this.parseArrayField(values[5]),
        gptRelevance: values[8] || '',
        gptType: values[9] || '',
        gptConfidence: values[10] || '',
        gptReasoning: values[11] || '',
        consensusRelevance: values[13] || '',
        consensusType: values[14] || ''
      });
    }
    
    return issues;
  }

  /**
   * Parse array field like "['item1', 'item2']"
   */
  private parseArrayField(field: string): string[] {
    if (!field) return [];
    
    // Remove brackets and quotes
    const cleaned = field.replace(/[\[\]'\"]/g, '');
    return cleaned.split(',').map(item => item.trim()).filter(item => item.length > 0);
  }

  /**
   * Display specific clash issue
   */
  private displayClash(index: number): void {
    if (index < 0 || index >= this.clashes.length) return;
    
    this.currentIndex = index;
    const clash = this.clashes[index];
    
    // Update counter
    this.counterEl.textContent = `${index + 1} / ${this.clashes.length}`;
    
    // Update buttons
    this.prevBtn.disabled = index === 0;
    this.nextBtn.disabled = index === this.clashes.length - 1;
    
    // Highlight objects and get found status
    const foundGUIDs = this.highlightClashObjects(clash);
    
    // Render card content with found status
    this.cardContent.innerHTML = this.renderClashCard(clash, foundGUIDs);
  }

  /**
   * Render clash card HTML - Modern blue design
   */
  private renderClashCard(clash: ClashIssue, foundGUIDs: Set<string>): string {
    const typeClass = clash.gptType.toLowerCase().replace(/\s+/g, '-');
    
    return `
      <div class="clash-card-header">
        <h3>${this.escapeHtml(clash.issueName)}</h3>
        <div class="clash-object-info">
          ${clash.componentName.map((name, i) => {
            const guid = clash.componentGUID[i] || '';
            const isFound = foundGUIDs.has(guid);
            return `
              <div class="clash-object-item ${isFound ? 'found' : 'missing'}">
                <span class="status-dot ${isFound ? 'success' : 'error'}"></span>
                <span class="clash-object-name">${this.escapeHtml(name)}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
      
      <div class="clash-card-section clash-ai-section">
        <div class="clash-meta-bar">
          <span class="badge badge-${typeClass}">${clash.consensusType || clash.gptType}</span>
          <span class="ai-confidence">${clash.gptConfidence}</span>
        </div>
        <p class="ai-reasoning">${this.escapeHtml(clash.gptReasoning)}</p>
      </div>
    `;
  }

  /**
   * Highlight clash objects in viewer and return found status
   */
  private highlightClashObjects(clash: ClashIssue): Set<string> {
    // Clear previous highlights
    this.viewer.clearGuidHighlights();
    
    if (clash.componentGUID.length === 0) {
      console.warn('No GUIDs to highlight for this clash');
      return new Set();
    }
    
    // Find meshes by GUIDs
    const meshes = this.viewer.findMeshesByGUIDs(clash.componentGUID);
    
    // Track which GUIDs were found
    const foundGUIDs = new Set<string>();
    meshes.forEach(mesh => {
      const userData = (mesh as any).userData || {};
      const possibleGuids = [
        userData.name, mesh.name, userData.guid, userData.GlobalId,
        userData.expressID, userData.ifcGuid, userData.GUID
      ].filter(Boolean).map(g => String(g).toLowerCase());
      
      clash.componentGUID.forEach(searchGuid => {
        if (possibleGuids.includes(searchGuid.toLowerCase())) {
          foundGUIDs.add(searchGuid);
        }
      });
    });
    
    if (meshes.length === 0) {
      console.warn('No objects found for GUIDs:', clash.componentGUID);
      return foundGUIDs;
    }
    
    // Add highlights
    this.viewer.addGuidHighlights(meshes);
    
    // Automatically hide all other objects
    this.viewer.setSurroundingMode('hidden');
    
    // Set camera config for close-up view
    this.viewer.setCameraFocusConfig({
      distanceMultiplier: 0.5,
      viewAngle: { x: 1, y: 1, z: 1 },
      animated: true,
      verticalOffset: 0,
      horizontalOffset: 0
    });
    
    // Focus camera on objects with closer view
    this.viewer.focusOnObjects(meshes, true);
    
    console.log(`✅ Highlighted ${meshes.length} of ${clash.componentGUID.length} clash objects`);
    return foundGUIDs;
  }

  /**
   * Show clash card UI
   */
  showCard(): void {
    this.cardContainer.classList.add('active');
  }

  /**
   * Hide clash card UI
   */
  hideCard(): void {
    this.cardContainer.classList.remove('active');
    this.viewer.clearGuidHighlights();
    this.viewer.setSurroundingMode('normal');
  }

  /**
   * Navigate to previous clash
   */
  private prevClash(): void {
    if (this.currentIndex > 0) {
      this.displayClash(this.currentIndex - 1);
    }
  }

  /**
   * Navigate to next clash
   */
  private nextClash(): void {
    if (this.currentIndex < this.clashes.length - 1) {
      this.displayClash(this.currentIndex + 1);
    }
  }

  /**
   * Show all objects (remove hide mode)
   */
  private showAllObjects(): void {
    this.viewer.setSurroundingMode('normal');
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    this.prevBtn.addEventListener('click', () => this.prevClash());
    this.nextBtn.addEventListener('click', () => this.nextClash());
    this.closeBtn.addEventListener('click', () => this.hideCard());
    this.showAllBtn.addEventListener('click', () => this.showAllObjects());
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (!this.cardContainer.classList.contains('active')) return;
      
      if (e.key === 'ArrowLeft') {
        this.prevClash();
      } else if (e.key === 'ArrowRight') {
        this.nextClash();
      } else if (e.key === 'Escape') {
        this.hideCard();
      }
    });
  }

  /**
   * Escape HTML for safe rendering
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Get total number of clashes
   */
  getClashCount(): number {
    return this.clashes.length;
  }

  /**
   * Check if clashes are loaded
   */
  hasClashes(): boolean {
    return this.clashes.length > 0;
  }
}

