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

export const compareHtmlDocuments = (leftHtml: string, rightHtml: string): ComparisonResult => {
  // Clean any existing diff highlighting from previous comparisons
  const cleanLeftHtml = cleanDiffHighlighting(leftHtml);
  const cleanRightHtml = cleanDiffHighlighting(rightHtml);
  
  // Parse HTML while preserving original structure
  const leftContainer = document.createElement('div');
  const rightContainer = document.createElement('div');
  leftContainer.innerHTML = cleanLeftHtml;
  rightContainer.innerHTML = cleanRightHtml;
  
  const leftDiffs: DiffResult[] = [];
  const rightDiffs: DiffResult[] = [];
  let summary = { additions: 0, deletions: 0, changes: 0 };

  // Get all meaningful elements (paragraphs, headings, etc.)
  const leftElements = extractMeaningfulElements(leftContainer);
  const rightElements = extractMeaningfulElements(rightContainer);
  
  const maxLength = Math.max(leftElements.length, rightElements.length);
  
  for (let i = 0; i < maxLength; i++) {
    const leftElement = leftElements[i];
    const rightElement = rightElements[i];
    
    if (!leftElement && rightElement) {
      // Element added in right document
      rightDiffs.push({ type: 'insert', content: rightElement.outerHTML });
      leftDiffs.push({ type: 'equal', content: '' });
      summary.additions++;
    } else if (leftElement && !rightElement) {
      // Element removed from left document
      leftDiffs.push({ type: 'delete', content: leftElement.outerHTML });
      rightDiffs.push({ type: 'equal', content: '' });
      summary.deletions++;
    } else if (leftElement && rightElement) {
      const leftText = leftElement.textContent?.trim() || '';
      const rightText = rightElement.textContent?.trim() || '';
      
      if (leftText === rightText) {
        // Same content, keep original HTML
        leftDiffs.push({ type: 'equal', content: leftElement.outerHTML });
        rightDiffs.push({ type: 'equal', content: rightElement.outerHTML });
      } else {
        // Different content, perform word-level diff
        const { leftHighlighted, rightHighlighted, changes } = compareElementContent(leftElement, rightElement);
        
        leftDiffs.push({ type: 'equal', content: leftHighlighted });
        rightDiffs.push({ type: 'equal', content: rightHighlighted });
        
        summary.additions += changes.additions;
        summary.deletions += changes.deletions;
      }
    }
  }

  summary.changes = summary.additions + summary.deletions;

  return { leftDiffs, rightDiffs, summary };
};

// Extract meaningful elements while preserving structure
const extractMeaningfulElements = (container: Element): Element[] => {
  const elements: Element[] = [];
  
  const traverse = (node: Node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      const tagName = element.tagName.toLowerCase();
      
      // Include meaningful block elements
      if (isMeaningfulElement(tagName)) {
        elements.push(element);
      } else {
        // Traverse children for non-meaningful containers
        Array.from(node.childNodes).forEach(traverse);
      }
    }
  };
  
  Array.from(container.childNodes).forEach(traverse);
  return elements;
};

const isMeaningfulElement = (tagName: string): boolean => {
  return [
    'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'blockquote', 'pre', 'li', 'td', 'th',
    'div' // Include divs that might contain formatted content
  ].includes(tagName);
};

// Compare content within elements while preserving formatting
const compareElementContent = (leftElement: Element, rightElement: Element) => {
  const leftText = leftElement.textContent || '';
  const rightText = rightElement.textContent || '';
  
  const wordDiffs = diffWords(leftText, rightText);
  
  let leftContent = '';
  let rightContent = '';
  let additions = 0;
  let deletions = 0;
  
  wordDiffs.forEach(diff => {
    if (diff.added) {
      rightContent += `<span class="diff-insert">${escapeHtml(diff.value)}</span>`;
      leftContent += ''; // Nothing added to left
      additions++;
    } else if (diff.removed) {
      leftContent += `<span class="diff-delete">${escapeHtml(diff.value)}</span>`;
      rightContent += ''; // Nothing added to right
      deletions++;
    } else {
      const escapedContent = escapeHtml(diff.value);
      leftContent += escapedContent;
      rightContent += escapedContent;
    }
  });
  
  // Reconstruct elements with original structure but highlighted content
  const leftHighlighted = reconstructElement(leftElement, leftContent);
  const rightHighlighted = reconstructElement(rightElement, rightContent);
  
  return {
    leftHighlighted,
    rightHighlighted,
    changes: { additions, deletions }
  };
};

// Reconstruct element with new content while preserving attributes and structure
const reconstructElement = (originalElement: Element, newContent: string): string => {
  const tagName = originalElement.tagName.toLowerCase();
  const attributes = Array.from(originalElement.attributes)
    .map(attr => `${attr.name}="${attr.value}"`)
    .join(' ');
  
  const attributeString = attributes ? ` ${attributes}` : '';
  
  return `<${tagName}${attributeString}>${newContent}</${tagName}>`;
};

const parseHtmlToElements = (html: string) => {
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

// Clean any existing diff highlighting to ensure clean comparisons
const cleanDiffHighlighting = (html: string): string => {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  // Remove all diff highlighting spans and blocks
  const diffElements = tempDiv.querySelectorAll('.diff-insert, .diff-delete, .diff-insert-block, .diff-delete-block');
  diffElements.forEach(element => {
    // Replace the diff element with its text content
    const textNode = document.createTextNode(element.textContent || '');
    element.parentNode?.replaceChild(textNode, element);
  });
  
  // Clean up any empty elements that might have been left behind
  const emptyElements = tempDiv.querySelectorAll('span:empty, div:empty');
  emptyElements.forEach(element => {
    if (element.textContent?.trim() === '') {
      element.remove();
    }
  });
  
  return tempDiv.innerHTML;
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