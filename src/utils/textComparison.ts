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
  // Extract plain text from HTML for comparison while preserving structure
  const leftText = extractTextFromHtml(leftHtml);
  const rightText = extractTextFromHtml(rightHtml);
  
  // Perform word-level comparison on plain text
  const diffs = diffWords(leftText, rightText);
  
  // Apply highlighting to original HTML while preserving all formatting
  const leftHighlighted = applyDifferencesToHtml(leftHtml, diffs, 'left');
  const rightHighlighted = applyDifferencesToHtml(rightHtml, diffs, 'right');
  
  // Calculate summary
  let summary = { additions: 0, deletions: 0, changes: 0 };
  diffs.forEach(diff => {
    if (diff.added) summary.additions++;
    if (diff.removed) summary.deletions++;
  });
  summary.changes = summary.additions + summary.deletions;
  
  // Return as DiffResult arrays for consistency
  const leftDiffs: DiffResult[] = [{ type: 'equal', content: leftHighlighted }];
  const rightDiffs: DiffResult[] = [{ type: 'equal', content: rightHighlighted }];
  
  return { leftDiffs, rightDiffs, summary };
};

// Extract plain text from HTML while preserving word boundaries
const extractTextFromHtml = (html: string): string => {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  // Get text content and normalize whitespace but preserve structure
  const text = tempDiv.textContent || '';
  return text.replace(/\s+/g, ' ').trim();
};

// Apply differences to HTML while preserving ALL original formatting
const applyDifferencesToHtml = (originalHtml: string, diffs: any[], side: 'left' | 'right'): string => {
  // If no changes for this side, return original HTML unchanged
  const hasChanges = diffs.some(diff => 
    (side === 'left' && diff.removed) || (side === 'right' && diff.added)
  );
  
  if (!hasChanges) {
    return originalHtml;
  }
  
  // Create a temporary container to work with the HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = originalHtml;
  
  // Get all text nodes in the document
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

// Get all text nodes from an element recursively
const getAllTextNodes = (element: Element): Text[] => {
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
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