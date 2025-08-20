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
  // Comprehensive element extraction and comparison
  const leftElements = extractAllElements(leftHtml);
  const rightElements = extractAllElements(rightHtml);
  
  // Apply comprehensive highlighting to both documents
  const leftWithHighlights = applyComprehensiveHighlighting(leftHtml, leftElements, rightElements, 'left');
  const rightWithHighlights = applyComprehensiveHighlighting(rightHtml, rightElements, leftElements, 'right');
  
  // Extract plain text for text-level comparison
  const leftText = extractTextFromHtml(leftHtml);
  const rightText = extractTextFromHtml(rightHtml);
  
  // Perform word-level comparison on plain text
  const textDiffs = diffWords(leftText, rightText);
  
  // Apply text highlighting while preserving all structural highlights
  const leftFinal = applyTextDifferencesToHtml(leftWithHighlights, textDiffs, 'left');
  const rightFinal = applyTextDifferencesToHtml(rightWithHighlights, textDiffs, 'right');
  
  // Calculate comprehensive summary
  const summary = calculateComprehensiveSummary(textDiffs, leftElements, rightElements);
  
  // Return as DiffResult arrays for consistency
  const leftDiffs: DiffResult[] = [{ type: 'equal', content: leftFinal }];
  const rightDiffs: DiffResult[] = [{ type: 'equal', content: rightFinal }];
  
  return { leftDiffs, rightDiffs, summary };
};

// Extract ALL elements from HTML document
const extractAllElements = (html: string) => {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  // Images
  const images = Array.from(tempDiv.querySelectorAll('img')).map((img, index) => ({
    type: 'image',
    index,
    src: img.src,
    alt: img.alt || '',
    width: img.width || null,
    height: img.height || null,
    element: img.outerHTML,
    id: `img-${index}-${(img.src || img.alt || '').substring(0, 20)}`
  }));
  
  // Tables
  const tables = Array.from(tempDiv.querySelectorAll('table')).map((table, index) => ({
    type: 'table',
    index,
    rows: table.querySelectorAll('tr').length,
    cols: table.querySelector('tr')?.querySelectorAll('td, th').length || 0,
    element: table.outerHTML,
    id: `table-${index}-${table.textContent?.substring(0, 20) || ''}`
  }));
  
  // Headers (h1-h6)
  const headers = Array.from(tempDiv.querySelectorAll('h1, h2, h3, h4, h5, h6')).map((header, index) => ({
    type: 'header',
    level: parseInt(header.tagName.substring(1)),
    text: header.textContent || '',
    element: header.outerHTML,
    id: `header-${index}-${header.textContent?.substring(0, 20) || ''}`
  }));
  
  // Lists (ul, ol)
  const lists = Array.from(tempDiv.querySelectorAll('ul, ol')).map((list, index) => ({
    type: 'list',
    listType: list.tagName.toLowerCase(),
    items: list.querySelectorAll('li').length,
    element: list.outerHTML,
    id: `list-${index}-${list.textContent?.substring(0, 20) || ''}`
  }));
  
  // Links
  const links = Array.from(tempDiv.querySelectorAll('a')).map((link, index) => ({
    type: 'link',
    href: link.href || '',
    text: link.textContent || '',
    element: link.outerHTML,
    id: `link-${index}-${(link.textContent || link.href || '').substring(0, 20)}`
  }));
  
  // Blockquotes
  const blockquotes = Array.from(tempDiv.querySelectorAll('blockquote')).map((quote, index) => ({
    type: 'blockquote',
    text: quote.textContent || '',
    element: quote.outerHTML,
    id: `quote-${index}-${quote.textContent?.substring(0, 20) || ''}`
  }));
  
  // Code blocks and inline code
  const codeBlocks = Array.from(tempDiv.querySelectorAll('pre, code')).map((code, index) => ({
    type: 'code',
    isBlock: code.tagName.toLowerCase() === 'pre',
    text: code.textContent || '',
    element: code.outerHTML,
    id: `code-${index}-${code.textContent?.substring(0, 20) || ''}`
  }));
  
  // Formatted text (bold, italic, underline)
  const formattedText = Array.from(tempDiv.querySelectorAll('strong, b, em, i, u')).map((elem, index) => ({
    type: 'formatted',
    format: elem.tagName.toLowerCase(),
    text: elem.textContent || '',
    element: elem.outerHTML,
    id: `format-${index}-${elem.textContent?.substring(0, 20) || ''}`
  }));
  
  // Line breaks and spacing
  const breaks = Array.from(tempDiv.querySelectorAll('br')).map((br, index) => ({
    type: 'break',
    element: br.outerHTML,
    id: `br-${index}`
  }));
  
  // Divs and spans with specific styling
  const styledElements = Array.from(tempDiv.querySelectorAll('div[style], span[style], p[style]')).map((elem, index) => ({
    type: 'styled',
    tagName: elem.tagName.toLowerCase(),
    style: elem.getAttribute('style') || '',
    text: elem.textContent || '',
    element: elem.outerHTML,
    id: `styled-${index}-${elem.textContent?.substring(0, 20) || ''}`
  }));
  
  return {
    images,
    tables,
    headers,
    lists,
    links,
    blockquotes,
    codeBlocks,
    formattedText,
    breaks,
    styledElements
  };
};

// Apply comprehensive highlighting for ALL element types
const applyComprehensiveHighlighting = (html: string, ownElements: any, otherElements: any, side: 'left' | 'right') => {
  let modifiedHtml = html;
  
  // Helper function to check if element exists in other document
  const elementExistsInOther = (element: any, otherElementsOfType: any[]) => {
    switch (element.type) {
      case 'image':
        return otherElementsOfType.some(other => 
          other.src === element.src || 
          (other.alt === element.alt && element.alt) ||
          other.element === element.element
        );
      case 'table':
        return otherElementsOfType.some(other => 
          other.element === element.element ||
          (other.rows === element.rows && other.cols === element.cols && 
           Math.abs(other.id.localeCompare(element.id)) < 5)
        );
      case 'header':
        return otherElementsOfType.some(other => 
          other.text === element.text && other.level === element.level
        );
      case 'list':
        return otherElementsOfType.some(other => 
          other.element === element.element ||
          (other.listType === element.listType && other.items === element.items)
        );
      case 'link':
        return otherElementsOfType.some(other => 
          other.href === element.href && other.text === element.text
        );
      case 'blockquote':
        return otherElementsOfType.some(other => 
          other.text === element.text
        );
      case 'code':
        return otherElementsOfType.some(other => 
          other.text === element.text && other.isBlock === element.isBlock
        );
      case 'formatted':
        return otherElementsOfType.some(other => 
          other.text === element.text && other.format === element.format
        );
      case 'styled':
        return otherElementsOfType.some(other => 
          other.element === element.element ||
          (other.style === element.style && other.text === element.text)
        );
      default:
        return otherElementsOfType.some(other => other.element === element.element);
    }
  };
  
  // Process each element type
  const elementTypes = ['images', 'tables', 'headers', 'lists', 'links', 'blockquotes', 'codeBlocks', 'formattedText', 'styledElements'];
  
  elementTypes.forEach(elementType => {
    const elements = ownElements[elementType] || [];
    const otherElementsOfType = otherElements[elementType] || [];
    
    elements.forEach((element: any) => {
      const exists = elementExistsInOther(element, otherElementsOfType);
      
      if (!exists) {
        const isRemoval = side === 'left';
        const isAddition = side === 'right';
        
        if (isRemoval) {
          // Element was removed
          const highlightedElement = `<div class="diff-delete-block">
            <div class="removed-element-label">${getElementIcon(element.type)} ${getElementLabel(element.type)} Removed</div>
            ${element.element}
          </div>`;
          modifiedHtml = modifiedHtml.replace(element.element, highlightedElement);
        } else if (isAddition) {
          // Element was added
          const highlightedElement = `<div class="diff-insert-block">
            <div class="added-element-label">${getElementIcon(element.type)} ${getElementLabel(element.type)} Added</div>
            ${element.element}
          </div>`;
          modifiedHtml = modifiedHtml.replace(element.element, highlightedElement);
        }
      }
    });
  });
  
  return modifiedHtml;
};

// Get appropriate icon for element type
const getElementIcon = (type: string): string => {
  const icons: { [key: string]: string } = {
    image: '🖼️',
    table: '📊',
    header: '📝',
    list: '📋',
    link: '🔗',
    blockquote: '💬',
    code: '💻',
    formatted: '✨',
    styled: '🎨',
    break: '↵'
  };
  return icons[type] || '📄';
};

// Get appropriate label for element type
const getElementLabel = (type: string): string => {
  const labels: { [key: string]: string } = {
    image: 'Image',
    table: 'Table',
    header: 'Header',
    list: 'List',
    link: 'Link',
    blockquote: 'Quote',
    code: 'Code',
    formatted: 'Formatting',
    styled: 'Style',
    break: 'Line Break'
  };
  return labels[type] || 'Element';
};

// Calculate comprehensive summary including all element types
const calculateComprehensiveSummary = (textDiffs: any[], leftElements: any, rightElements: any) => {
  let summary = { additions: 0, deletions: 0, changes: 0 };
  
  // Count text changes
  textDiffs.forEach(diff => {
    if (diff.added) summary.additions++;
    if (diff.removed) summary.deletions++;
  });
  
  // Count structural changes for all element types
  const elementTypes = ['images', 'tables', 'headers', 'lists', 'links', 'blockquotes', 'codeBlocks', 'formattedText', 'styledElements'];
  
  elementTypes.forEach(elementType => {
    const leftElementsOfType = leftElements[elementType] || [];
    const rightElementsOfType = rightElements[elementType] || [];
    
    // Count deletions (exist in left but not in right)
    leftElementsOfType.forEach((element: any) => {
      const existsInRight = rightElementsOfType.some((rightElement: any) => {
        switch (element.type) {
          case 'image':
            return rightElement.src === element.src || rightElement.alt === element.alt;
          case 'header':
            return rightElement.text === element.text && rightElement.level === element.level;
          case 'link':
            return rightElement.href === element.href && rightElement.text === element.text;
          default:
            return rightElement.element === element.element;
        }
      });
      if (!existsInRight) summary.deletions++;
    });
    
    // Count additions (exist in right but not in left)
    rightElementsOfType.forEach((element: any) => {
      const existsInLeft = leftElementsOfType.some((leftElement: any) => {
        switch (element.type) {
          case 'image':
            return leftElement.src === element.src || leftElement.alt === element.alt;
          case 'header':
            return leftElement.text === element.text && leftElement.level === element.level;
          case 'link':
            return leftElement.href === element.href && leftElement.text === element.text;
          default:
            return leftElement.element === element.element;
        }
      });
      if (!existsInLeft) summary.additions++;
    });
  });
  
  summary.changes = summary.additions + summary.deletions;
  return summary;
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
  
  // Get all text nodes in the document (excluding those in highlighted blocks)
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

// Get all text nodes from an element recursively (excluding highlighted blocks)
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

// Render diffs where content is already HTML with comprehensive highlighting
export const renderHtmlDifferences = (diffs: DiffResult[]): string => {
  return diffs.map(diff => {
    // For HTML content, just return as-is since highlighting is already applied
    return diff.content;
  }).join('');
};