// All PDF Master tools configuration
export const toolCategories = [
  {
    id: 'pdf-tools',
    label: 'PDF Tools',
    color: 'blue',
    tools: [
      { id: 'merge-pdf', label: 'Merge PDF', icon: 'Combine', desc: 'Combine multiple PDFs into one', color: 'blue', accepts: ['.pdf'], multi: true },
      { id: 'split-pdf', label: 'Split PDF', icon: 'Scissors', desc: 'Split a PDF into separate pages', color: 'blue', accepts: ['.pdf'], multi: false },
      { id: 'compress-pdf', label: 'Compress PDF', icon: 'PackageOpen', desc: 'Reduce PDF file size', color: 'blue', accepts: ['.pdf'], multi: false },
      { id: 'organize-pdf', label: 'Organize PDF', icon: 'LayoutGrid', desc: 'Reorder and rearrange pages', color: 'blue', accepts: ['.pdf'], multi: false },
      { id: 'rotate-pdf', label: 'Rotate PDF', icon: 'RotateCw', desc: 'Rotate pages to correct orientation', color: 'blue', accepts: ['.pdf'], multi: false },
      { id: 'delete-pages', label: 'Delete Pages', icon: 'Trash2', desc: 'Remove specific pages from PDF', color: 'blue', accepts: ['.pdf'], multi: false },
      { id: 'extract-pages', label: 'Extract Pages', icon: 'FileOutput', desc: 'Extract specific pages to new PDF', color: 'blue', accepts: ['.pdf'], multi: false },
      { id: 'protect-pdf', label: 'Protect PDF', icon: 'Lock', desc: 'Add password protection to PDF', color: 'blue', accepts: ['.pdf'], multi: false },
      { id: 'unlock-pdf', label: 'Unlock PDF', icon: 'Unlock', desc: 'Remove password from PDF', color: 'blue', accepts: ['.pdf'], multi: false },
      { id: 'repair-pdf', label: 'Repair PDF', icon: 'Wrench', desc: 'Fix corrupted PDF files', color: 'blue', accepts: ['.pdf'], multi: false },
      { id: 'add-page-numbers', label: 'Add Page Numbers', icon: 'Hash', desc: 'Add numbered footers to pages', color: 'blue', accepts: ['.pdf'], multi: false },
      { id: 'add-watermark', label: 'Add Watermark', icon: 'Stamp', desc: 'Stamp text or image watermarks', color: 'blue', accepts: ['.pdf'], multi: false },
    ]
  },
  {
    id: 'convert-to-pdf',
    label: 'Convert to PDF',
    color: 'violet',
    tools: [
      { id: 'jpg-to-pdf', label: 'JPG to PDF', icon: 'Image', desc: 'Convert JPG images to PDF', color: 'violet', accepts: ['.jpg', '.jpeg'], multi: true },
      { id: 'png-to-pdf', label: 'PNG to PDF', icon: 'Image', desc: 'Convert PNG images to PDF', color: 'violet', accepts: ['.png'], multi: true },
      { id: 'webp-to-pdf', label: 'WebP to PDF', icon: 'Image', desc: 'Convert WebP images to PDF', color: 'violet', accepts: ['.webp'], multi: true },
      { id: 'word-to-pdf', label: 'Word to PDF', icon: 'FileText', desc: 'Convert Word documents to PDF', color: 'violet', accepts: ['.doc', '.docx'], multi: false },
      { id: 'excel-to-pdf', label: 'Excel to PDF', icon: 'Table', desc: 'Convert Excel spreadsheets to PDF', color: 'violet', accepts: ['.xls', '.xlsx'], multi: false },
      { id: 'ppt-to-pdf', label: 'PowerPoint to PDF', icon: 'Presentation', desc: 'Convert presentations to PDF', color: 'violet', accepts: ['.ppt', '.pptx'], multi: false },
    ]
  },
  {
    id: 'convert-from-pdf',
    label: 'Convert from PDF',
    color: 'pink',
    tools: [
      { id: 'pdf-to-jpg', label: 'PDF to JPG', icon: 'Image', desc: 'Convert PDF pages to JPG images', color: 'pink', accepts: ['.pdf'], multi: false },
      { id: 'pdf-to-png', label: 'PDF to PNG', icon: 'Image', desc: 'Convert PDF pages to PNG images', color: 'pink', accepts: ['.pdf'], multi: false },
      { id: 'pdf-to-word', label: 'PDF to Word', icon: 'FileText', desc: 'Convert PDF to editable Word doc', color: 'pink', accepts: ['.pdf'], multi: false },
      { id: 'pdf-to-excel', label: 'PDF to Excel', icon: 'Table', desc: 'Extract tables to Excel format', color: 'pink', accepts: ['.pdf'], multi: false },
      { id: 'pdf-to-ppt', label: 'PDF to PowerPoint', icon: 'Presentation', desc: 'Convert PDF to presentation', color: 'pink', accepts: ['.pdf'], multi: false },
      { id: 'pdf-to-text', label: 'PDF to Text', icon: 'AlignLeft', desc: 'Extract all text from PDF', color: 'pink', accepts: ['.pdf'], multi: false },
    ]
  },
  {
    id: 'image-tools',
    label: 'Image Tools',
    color: 'amber',
    tools: [
      { id: 'resize-image', label: 'Resize Image', icon: 'Maximize2', desc: 'Resize images to any dimension', color: 'amber', accepts: ['.jpg', '.jpeg', '.png', '.webp', '.gif'], multi: false },
      { id: 'compress-image', label: 'Compress Image', icon: 'PackageOpen', desc: 'Reduce image file size', color: 'amber', accepts: ['.jpg', '.jpeg', '.png', '.webp'], multi: true },
      { id: 'crop-image', label: 'Crop Image', icon: 'Crop', desc: 'Crop images to custom shape', color: 'amber', accepts: ['.jpg', '.jpeg', '.png', '.webp'], multi: false },
      { id: 'rotate-image', label: 'Rotate Image', icon: 'RotateCw', desc: 'Rotate images to any angle', color: 'amber', accepts: ['.jpg', '.jpeg', '.png', '.webp'], multi: false },
      { id: 'flip-image', label: 'Flip Image', icon: 'FlipHorizontal', desc: 'Flip images horizontally or vertically', color: 'amber', accepts: ['.jpg', '.jpeg', '.png', '.webp'], multi: false },
      { id: 'convert-jpg', label: 'Convert to JPG', icon: 'RefreshCw', desc: 'Convert any image to JPG', color: 'amber', accepts: ['.png', '.webp', '.gif', '.bmp'], multi: true },
      { id: 'convert-png', label: 'Convert to PNG', icon: 'RefreshCw', desc: 'Convert any image to PNG', color: 'amber', accepts: ['.jpg', '.jpeg', '.webp', '.gif', '.bmp'], multi: true },
      { id: 'convert-webp', label: 'Convert to WebP', icon: 'RefreshCw', desc: 'Convert images to WebP format', color: 'amber', accepts: ['.jpg', '.jpeg', '.png', '.gif'], multi: true },
      { id: 'image-quality', label: 'Image Quality', icon: 'Sliders', desc: 'Adjust image quality settings', color: 'amber', accepts: ['.jpg', '.jpeg', '.png', '.webp'], multi: false },
      { id: 'remove-bg', label: 'Remove Background', icon: 'Eraser', desc: 'Remove image backgrounds with AI', color: 'amber', accepts: ['.jpg', '.jpeg', '.png', '.webp'], multi: false, badge: 'AI' },
    ]
  }
]

export const allTools = toolCategories.flatMap(cat => cat.tools)

export const getToolById = (id) => allTools.find(t => t.id === id)

export const colorMap = {
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    icon: 'text-blue-600',
    border: 'border-blue-200 dark:border-blue-800',
    badge: 'badge-blue',
    gradient: 'from-blue-500 to-blue-700',
  },
  violet: {
    bg: 'bg-violet-50 dark:bg-violet-950/30',
    icon: 'text-violet-600',
    border: 'border-violet-200 dark:border-violet-800',
    badge: 'badge-purple',
    gradient: 'from-violet-500 to-violet-700',
  },
  pink: {
    bg: 'bg-pink-50 dark:bg-pink-950/30',
    icon: 'text-pink-600',
    border: 'border-pink-200 dark:border-pink-800',
    badge: 'badge-pink',
    gradient: 'from-pink-500 to-pink-700',
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    icon: 'text-amber-600',
    border: 'border-amber-200 dark:border-amber-800',
    badge: 'badge-amber',
    gradient: 'from-amber-500 to-amber-700',
  },
}
