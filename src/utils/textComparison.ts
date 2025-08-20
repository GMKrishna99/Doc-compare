import { diffWords } from 'diff';
import { DiffResult, ComparisonResult } from '../types';

export const compareDocuments = (leftText: string, rightText: string): ComparisonResult => {
  // Use word-based diff for more granular comparison
  const diffs = diffWords(leftText, rightText);
  
  const leftDiffs: DiffResult[] = [];
  const rightDiffs: DiffResult[] = [];
  let summary = { additions: 0, deletions: 0, changes: 0 };
  
  diffs.forEach(diff => {
    if (diff.added) {
      rightDiffs.push({ type: 'insert', content: diff.value });
      summary.additions++;
    } else if (diff.removed) {
      leftDiffs.push({ type: 'delete', content: diff.value });
      summary.deletions++;
    } else {
      leftDiffs.push({ type: 'equal', content: diff.value });
      rightDiffs.push({ type: 'equal', content: diff.value });
    }
  });
  
  summary.changes = summary.additions + summary.deletions;
  
  return { leftDiffs, rightDiffs, summary };
};

export const highlightDifferences = (diffs: DiffResult[]): string => {
  return diffs.map(diff => {
    switch (diff.type) {
      case 'insert':
        return `<span class="diff-insert">${escapeHtml(diff.content)}</span>`;
      case 'delete':
        return `<span class="diff-delete">${escapeHtml(diff.content)}</span>`;
      default:
        return escapeHtml(diff.content);
    }
  }).join('');
};

const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

export const compareHtmlDocuments = (leftHtml: string, rightHtml: string): ComparisonResult => {
  // First, detect structural differences (images, tables, etc.)
  const leftStructure = extractStructuralElements(leftHtml);
  const rightStructure = extractStructuralElements(rightHtml);
  
  // Apply structural highlighting to both documents
  const leftWithStructuralHighlights = applyStructuralHighlighting(leftHtml, leftStructure, rightStructure, 'left');
  const rightWithStructuralHighlights = applyStructuralHighlighting(rightHtml, rightStructure, leftStructure, 'right');
  
  // Extract plain text from HTML for text comparison
  const leftText = extractTextFromHtml(leftHtml);
  const rightText = extractTextFromHtml(rightHtml);
  
  // Perform word-level comparison on plain text
  const textDiffs = diffWords(leftText, rightText);
  
  // Apply text highlighting to documents that already have structural highlights
  const leftFinal = applyTextDifferencesToHtml(leftWithStructuralHighlights, textDiffs, 'left');
  const rightFinal = applyTextDifferencesToHtml(rightWithStructuralHighlights, textDiffs, 'right');
  
  // Calculate summary including structural changes
  let summary = { additions: 0, deletions: 0, changes: 0 };
  
  // Count text changes
  textDiffs.forEach(diff => {
    if (diff.added) summary.additions++;
    if (diff.removed) summary.deletions++;
  });
  
  // Count structural changes
  const structuralChanges = countStructuralChanges(leftStructure, rightStructure);
  summary.additions += structuralChanges.additions;
  summary.deletions += structuralChanges.deletions;
  summary.changes = summary.additions + summary.deletions;
  
  // Return as DiffResult arrays for consistency
  const leftDiffs: DiffResult[] = [{ type: 'equal', content: leftFinal }];
  const rightDiffs: DiffResult[] = [{ type: 'equal', content: rightFinal }];
  
  return { leftDiffs, rightDiffs, summary };
};

// Extract structural elements like images, tables, etc.
const extractStructuralElements = (html: string) => {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  const images = Array.from(tempDiv.querySelectorAll('img')).map((img, index) => ({
    type: 'image',
    index,
    src: img.src,
    alt: img.alt || '',
    element: img.outerHTML,
    id: `img-${index}-${img.src.substring(0, 20)}`
  }));
  
  const tables = Array.from(tempDiv.querySelectorAll('table')).map((table, index) => ({
    type: 'table',
    index,
    element: table.outerHTML,
    id: `table-${index}-${table.textContent?.substring(0, 20) || ''}`
  }));
  
  return { images, tables };
};

// Apply highlighting for structural changes (images, tables)
const applyStructuralHighlighting = (html: string, ownStructure: any, otherStructure: any, side: 'left' | 'right') => {
  let modifiedHtml = html;
  
  // Handle image differences
  if (side === 'left') {
    // Mark images that were removed (exist in left but not in right)
    ownStructure.images.forEach((img: any) => {
      const existsInRight = otherStructure.images.some((rightImg: any) => 
        rightImg.src === img.src || rightImg.alt === img.alt
      );
      
      if (!existsInRight) {
        // Wrap removed image with deletion highlighting
        const highlightedImg = `<div class="diff-delete-block">
          <div class="removed-element-label">🖼️ Image Removed</div>
          ${img.element}
        </div>`;
        modifiedHtml = modifiedHtml.replace(img.element, highlightedImg);
      }
    });
  } else {
    // Mark images that were added (exist in right but not in left)
    ownStructure.images.forEach((img: any) => {
      const existsInLeft = otherStructure.images.some((leftImg: any) => 
        leftImg.src === img.src || leftImg.alt === img.alt
      );
      
      if (!existsInLeft) {
        // Wrap added image with insertion highlighting
        const highlightedImg = `<div class="diff-insert-block">
          <div class="added-element-label">🖼️ Image Added</div>
          ${img.element}
        </div>`;
        modifiedHtml = modifiedHtml.replace(img.element, highlightedImg);
      }
    });
  }
  
  // Handle table differences
  if (side === 'left') {
    // Mark tables that were removed
    ownStructure.tables.forEach((table: any) => {
      const existsInRight = otherStructure.tables.some((rightTable: any) => 
        rightTable.element === table.element
      );
      
      if (!existsInRight) {
        const highlightedTable = `<div class="diff-delete-block">
          <div class="removed-element-label">📊 Table Removed</div>
          ${table.element}
        </div>`;
        modifiedHtml = modifiedHtml.replace(table.element, highlightedTable);
      }
    });
  } else {
    // Mark tables that were added
    ownStructure.tables.forEach((table: any) => {
      const existsInLeft = otherStructure.tables.some((leftTable: any) => 
        leftTable.element === table.element
      );
      
      if (!existsInLeft) {
        const highlightedTable = `<div class="diff-insert-block">
          <div class="added-element-label">📊 Table Added</div>
          ${table.element}
        </div>`;
        modifiedHtml = modifiedHtml.replace(table.element, highlightedTable);
      }
    });
  }
  
  return modifiedHtml;
};

// Count structural changes for summary
const countStructuralChanges = (leftStructure: any, rightStructure: any) => {
  let additions = 0;
  let deletions = 0;
  
  // Count image changes
  leftStructure.images.forEach((img: any) => {
    const existsInRight = rightStructure.images.some((rightImg: any) => 
      rightImg.src === img.src || rightImg.alt === img.alt
    );
    if (!existsInRight) deletions++;
  });
  
  rightStructure.images.forEach((img: any) => {
    const existsInLeft = leftStructure.images.some((leftImg: any) => 
      leftImg.src === img.src || leftImg.alt === img.alt
    );
    if (!existsInLeft) additions++;
  });
  
  // Count table changes
  leftStructure.tables.forEach((table: any) => {
    const existsInRight = rightStructure.tables.some((rightTable: any) => 
      rightTable.element === table.element
    );
    if (!existsInRight) deletions++;
  });
  
  rightStructure.tables.forEach((table: any) => {
    const existsInLeft = leftStructure.tables.some((leftTable: any) => 
      leftTable.element === table.element
    );
    if (!existsInLeft) additions++;
  });
  
  return { additions, deletions };
};

// Extract plain text from HTML while preserving word boundaries
const extractTextFromHtml = (html: string): string => {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  // Remove images and tables from text extraction to avoid interference
  tempDiv.querySelectorAll('img, table').forEach(el => el.remove());
  
  // Get text content and normalize whitespace but preserve structure
  const text = tempDiv.textContent || '';
  return text.replace(/\s+/g, ' ').trim();
};

// Apply text differences to HTML while preserving ALL original formatting
const applyTextDifferencesToHtml = (originalHtml: string, diffs: any[], side: 'left' | 'right'): string => {
  // If no text changes for this side, return original HTML unchanged
  const hasTextChanges = diffs.some(diff => 
    (side === 'left' && diff.removed) || (side === 'right' && diff.added)
  );
  
  if (!hasTextChanges) {
    return originalHtml;
  }
  
  // Create a temporary container to work with the HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = originalHtml;
  
  // Get all text nodes in the document (excluding those in images and tables)
  const textNodes = getAllTextNodes(tempDiv);
  
  // Build the diff text for this side
  let diffSegments: Array<{text: string, type: 'normal' | 'added' | 'removed'}> = [];
  
  diffs.forEach(diff => {
    if (side === 'left') {
      if (diff.removed) {
        diffSegments.push({text: diff.value, type: 'removed'});
      } else if (!diff.added) {
        diffSegments.push({text: diff.value, type: 'normal'});
      }
    } else {
      if (diff.added) {
        diffSegments.push({text: diff.value, type: 'added'});
      } else if (!diff.removed) {
        diffSegments.push({text: diff.value, type: 'normal'});
      }
    }
  });
  
  // Apply highlighting to text nodes while preserving HTML structure
  let segmentIndex = 0;
  let segmentOffset = 0;
  
  textNodes.forEach(textNode => {
    const nodeText = textNode.textContent || '';
    let newContent = '';
    let nodeOffset = 0;
    
    while (nodeOffset < nodeText.length && segmentIndex < diffSegments.length) {
      const segment = diffSegments[segmentIndex];
      const remainingSegmentText = segment.text.substring(segmentOffset);
      const remainingNodeText = nodeText.substring(nodeOffset);
      
      // Find how much of this segment fits in this text node
      const matchLength = Math.min(remainingSegmentText.length, remainingNodeText.length);
      const textToProcess = nodeText.substring(nodeOffset, nodeOffset + matchLength);
      
      // Apply highlighting based on segment type
      if (segment.type === 'added') {
        newContent += `<span class="diff-insert">${escapeHtml(textToProcess)}</span>`;
      } else if (segment.type === 'removed') {
        newContent += `<span class="diff-delete">${escapeHtml(textToProcess)}</span>`;
      } else {
        newContent += escapeHtml(textToProcess);
      }
      
      nodeOffset += matchLength;
      segmentOffset += matchLength;
      
      // Move to next segment if current one is complete
      if (segmentOffset >= segment.text.length) {
        segmentIndex++;
        segmentOffset = 0;
      }
    }
    
    // Handle any remaining text in the node
    if (nodeOffset < nodeText.length) {
      newContent += escapeHtml(nodeText.substring(nodeOffset));
    }
    
    // Replace the text node with highlighted content
    if (newContent !== escapeHtml(nodeText)) {
      const wrapper = document.createElement('span');
      wrapper.innerHTML = newContent;
      textNode.parentNode?.replaceChild(wrapper, textNode);
    }
  });
  
  return tempDiv.innerHTML;
};

// Get all text nodes from an element recursively (excluding images and tables)
const getAllTextNodes = (element: Element): Text[] => {
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        // Skip text nodes inside images, tables, or diff blocks
        const parent = node.parentElement;
        if (parent?.closest('img, table, .diff-insert-block, .diff-delete-block')) {
          return NodeFilter.FILTER_REJECT;
        }
        
        // Only include text nodes with actual content
        return node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    },
    false
  );
  
  let node;
  while (node = walker.nextNode()) {
    textNodes.push(node as Text);
  }
  
  return textNodes;
};

// Render diffs where content is already HTML with word-level highlighting
export const renderHtmlDifferences = (diffs: DiffResult[]): string => {
  return diffs.map(diff => {
    // For HTML content, just return as-is since highlighting is already applied
    return diff.content;
  }).join('');
};