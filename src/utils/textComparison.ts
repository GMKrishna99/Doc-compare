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
  
  // Create highlighted versions by applying diffs to original HTML
  const leftHighlighted = applyDiffsToHtml(leftHtml, diffs, 'left');
  const rightHighlighted = applyDiffsToHtml(rightHtml, diffs, 'right');
  
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
  
  // Get text content and normalize whitespace
  const text = tempDiv.textContent || '';
  return text.replace(/\s+/g, ' ').trim();
};

// Apply word-level diffs to original HTML structure
const applyDiffsToHtml = (originalHtml: string, diffs: any[], side: 'left' | 'right'): string => {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = originalHtml;
  
  // Get all text nodes
  const textNodes = getTextNodes(tempDiv);
  
  // Build diff text based on side
  let diffText = '';
  diffs.forEach(diff => {
    if (side === 'left') {
      if (diff.removed) {
        diffText += `<span class="diff-delete">${escapeHtml(diff.value)}</span>`;
      } else if (!diff.added) {
        diffText += escapeHtml(diff.value);
      }
    } else {
      if (diff.added) {
        diffText += `<span class="diff-insert">${escapeHtml(diff.value)}</span>`;
      } else if (!diff.removed) {
        diffText += escapeHtml(diff.value);
      }
    }
  });
  
  // If no changes, return original HTML
  if (diffText === extractTextFromHtml(originalHtml)) {
    return originalHtml;
  }
  
  // Apply highlighting to the original structure
  return applyHighlightingToStructure(originalHtml, diffText);
};

// Get all text nodes from an element
const getTextNodes = (element: Element): Text[] => {
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  
  let node;
  while (node = walker.nextNode()) {
    if (node.textContent?.trim()) {
      textNodes.push(node as Text);
    }
  }
  
  return textNodes;
};

// Apply highlighting while preserving original HTML structure
const applyHighlightingToStructure = (originalHtml: string, highlightedText: string): string => {
  // For now, return a simple approach that preserves structure
  // This is a complex operation that would require sophisticated HTML parsing
  // to maintain exact formatting while applying word-level highlighting
  
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = originalHtml;
  
  // Simple approach: if there are highlights, wrap the content
  if (highlightedText.includes('diff-insert') || highlightedText.includes('diff-delete')) {
    // Find the main content area and apply highlighting
    const paragraphs = tempDiv.querySelectorAll('p, h1, h2, h3, h4, h5, h6, div');
    
    if (paragraphs.length > 0) {
      // Apply highlighting to the first significant paragraph
      const firstParagraph = paragraphs[0];
      if (firstParagraph.textContent?.trim()) {
        firstParagraph.innerHTML = highlightedText;
      }
    }
  }
  
  return tempDiv.innerHTML;
};

// Render diffs where content is already HTML with word-level highlighting
export const renderHtmlDifferences = (diffs: DiffResult[]): string => {
  return diffs.map(diff => {
    switch (diff.type) {
      case 'insert':
        if (diff.content.startsWith('<') && diff.content.endsWith('>')) {
          return `<div class="diff-insert-block">${diff.content}</div>`;
        }
        return `<span class="diff-insert">${diff.content}</span>`;
      case 'delete':
        if (diff.content.startsWith('<') && diff.content.endsWith('>')) {
          return `<div class="diff-delete-block">${diff.content}</div>`;
        }
        return `<span class="diff-delete">${diff.content}</span>`;
      default:
        return diff.content;
    }
  }).join('');
};