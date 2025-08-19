import { diffWords, diffSentences, diffArrays } from 'diff';
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

// Enhanced comparison for HTML content with word-level precision
export const compareHtmlDocuments = (leftHtml: string, rightHtml: string): ComparisonResult => {
  // Extract structured text while preserving HTML elements
  const leftStructure = extractStructuredContent(leftHtml);
  const rightStructure = extractStructuredContent(rightHtml);
  
  // Compare the structured content at word level
  const leftDiffs: DiffResult[] = [];
  const rightDiffs: DiffResult[] = [];
  let summary = { additions: 0, deletions: 0, changes: 0 };

  // Process each HTML element separately for more precise comparison
  const maxLength = Math.max(leftStructure.length, rightStructure.length);
  
  for (let i = 0; i < maxLength; i++) {
    const leftElement = leftStructure[i];
    const rightElement = rightStructure[i];
    
    if (!leftElement && rightElement) {
      // Element added in right document
      rightDiffs.push({ type: 'insert', content: rightElement.html });
      leftDiffs.push({ type: 'equal', content: '' });
      summary.additions++;
    } else if (leftElement && !rightElement) {
      // Element removed from left document
      leftDiffs.push({ type: 'delete', content: leftElement.html });
      rightDiffs.push({ type: 'equal', content: '' });
      summary.deletions++;
    } else if (leftElement && rightElement) {
      // Compare text content of elements at word level
      if (leftElement.text === rightElement.text) {
        // Same content, keep original HTML
        leftDiffs.push({ type: 'equal', content: leftElement.html });
        rightDiffs.push({ type: 'equal', content: rightElement.html });
      } else {
        // Different content, perform word-level diff
        const wordDiffs = diffWords(leftElement.text, rightElement.text);
        
        const leftWordDiffs: string[] = [];
        const rightWordDiffs: string[] = [];
        
        wordDiffs.forEach(diff => {
          if (diff.added) {
            rightWordDiffs.push(`<span class="diff-insert">${escapeHtml(diff.value)}</span>`);
            summary.additions++;
          } else if (diff.removed) {
            leftWordDiffs.push(`<span class="diff-delete">${escapeHtml(diff.value)}</span>`);
            summary.deletions++;
          } else {
            leftWordDiffs.push(escapeHtml(diff.value));
            rightWordDiffs.push(escapeHtml(diff.value));
          }
        });
        
        // Reconstruct HTML with word-level highlighting
        const leftHighlighted = reconstructElementWithDiffs(leftElement, leftWordDiffs.join(''));
        const rightHighlighted = reconstructElementWithDiffs(rightElement, rightWordDiffs.join(''));
        
        leftDiffs.push({ type: 'equal', content: leftHighlighted });
        rightDiffs.push({ type: 'equal', content: rightHighlighted });
      }
    }
  }

  summary.changes = summary.additions + summary.deletions;

  return { leftDiffs, rightDiffs, summary };
};

// Extract structured content preserving HTML elements
const extractStructuredContent = (html: string): { text: string; html: string; tag: string }[] => {
  const container = document.createElement('div');
  container.innerHTML = html;

  const elements: { text: string; html: string; tag: string }[] = [];
  
  // Process all child nodes, including text nodes
  const processNode = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) {
        elements.push({
          text,
          html: escapeHtml(text),
          tag: 'text'
        });
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      const tagName = element.tagName.toLowerCase();
      
      // For block elements, process as a unit
      if (isBlockElement(tagName)) {
        const text = element.textContent?.trim() || '';
        elements.push({
          text,
          html: element.outerHTML,
          tag: tagName
        });
      } else {
        // For inline elements, process children
        Array.from(node.childNodes).forEach(processNode);
      }
    }
  };

  Array.from(container.childNodes).forEach(processNode);

  return elements;
};

const isBlockElement = (tagName: string): boolean => {
  const blockElements = [
    'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'blockquote', 'pre', 'ul', 'ol', 'li', 'table',
    'tr', 'td', 'th', 'thead', 'tbody', 'tfoot'
  ];
  return blockElements.includes(tagName);
};

// Reconstruct HTML element with word-level diffs
const reconstructElementWithDiffs = (
  element: { text: string; html: string; tag: string },
  diffContent: string
): string => {
  if (element.tag === 'text') {
    return diffContent;
  }
  
  // Parse the original HTML to get the tag structure
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = element.html;
  const originalElement = tempDiv.firstElementChild;
  
  if (!originalElement) {
    return diffContent;
  }
  
  // Clone the element and replace its text content with diff content
  const newElement = originalElement.cloneNode(false) as Element;
  newElement.innerHTML = diffContent;
  
  return newElement.outerHTML;
};

// Render diffs where content is already HTML with word-level highlighting
export const renderHtmlDifferences = (diffs: DiffResult[]): string => {
  return diffs.map(diff => {
    switch (diff.type) {
      case 'insert':
        // For insertions at the element level, wrap the entire element
        if (diff.content.startsWith('<') && diff.content.endsWith('>')) {
          return `<div class="diff-insert-block">${diff.content}</div>`;
        }
        return `<span class="diff-insert">${diff.content}</span>`;
      case 'delete':
        // For deletions at the element level, wrap the entire element
        if (diff.content.startsWith('<') && diff.content.endsWith('>')) {
          return `<div class="diff-delete-block">${diff.content}</div>`;
        }
        return `<span class="diff-delete">${diff.content}</span>`;
      default:
        return diff.content;
    }
  }).join('');
};