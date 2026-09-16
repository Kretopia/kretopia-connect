export type BlockType = 'text' | 'image' | 'video' | 'gallery' | 'quote' | 'stats' | 'cta' | 'divider' | 'embed';

export interface ContentBlock {
  id: string;
  type: BlockType;
  title?: string;
  content?: string;
  imageUrl?: string;
  imageCaption?: string;
  videoUrl?: string;
  galleryUrls?: string[];
  quoteAuthor?: string;
  quoteRole?: string;
  stats?: { label: string; value: string }[];
  buttonText?: string;
  buttonUrl?: string;
  embedCode?: string;
  dividerStyle?: 'line' | 'dots' | 'space';
}

export const BLOCK_TYPES: { type: BlockType; label: string; icon: string; description: string }[] = [
  { type: 'text', label: 'Text', icon: '📝', description: 'Rich text paragraph' },
  { type: 'image', label: 'Image', icon: '🖼️', description: 'Full-width image with caption' },
  { type: 'video', label: 'Video', icon: '🎬', description: 'Embedded video (YouTube, Vimeo)' },
  { type: 'gallery', label: 'Gallery', icon: '📸', description: 'Image gallery grid' },
  { type: 'quote', label: 'Quote', icon: '💬', description: 'Testimonial or pull quote' },
  { type: 'stats', label: 'Stats', icon: '📊', description: 'Key metrics in a row' },
  { type: 'cta', label: 'Call to Action', icon: '🔗', description: 'Button with link' },
  { type: 'divider', label: 'Divider', icon: '➖', description: 'Visual separator' },
  { type: 'embed', label: 'Embed', icon: '🌐', description: 'Custom HTML embed' },
];

export const createBlock = (type: BlockType): ContentBlock => ({
  id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  type,
  title: type === 'cta' ? 'Ready to work together?' : type === 'stats' ? 'By the Numbers' : '',
  content: '',
  buttonText: type === 'cta' ? 'Get in Touch' : undefined,
  buttonUrl: type === 'cta' ? '#contact' : undefined,
  stats: type === 'stats' ? [
    { label: 'Projects', value: '50+' },
    { label: 'Clients', value: '30+' },
    { label: 'Years', value: '5+' },
  ] : undefined,
  dividerStyle: type === 'divider' ? 'line' : undefined,
});
