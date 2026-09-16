import DOMPurify from "dompurify";
import { ContentBlock } from "./BlockTypes";
import { getVideoEmbedUrl } from "./BlockEditor";

interface BlockRendererProps {
  blocks: ContentBlock[];
  theme?: 'dark' | 'light';
  accentColor?: string;
}

export const BlockRenderer = ({ blocks, theme = 'dark', accentColor }: BlockRendererProps) => {
  if (!blocks || blocks.length === 0) return null;

  const isDark = theme === 'dark';
  const textColor = isDark ? 'text-white' : 'text-zinc-900';
  const mutedColor = isDark ? 'text-white/60' : 'text-zinc-500';
  const borderColor = isDark ? 'border-white/10' : 'border-zinc-200';
  const bgMuted = isDark ? 'bg-white/5' : 'bg-zinc-50';

  return (
    <section className="py-16 px-4">
      <div className="max-w-4xl mx-auto space-y-12">
        {blocks.map(block => (
          <div key={block.id}>
            {block.type === 'text' && (
              <div className="space-y-3">
                {block.title && <h3 className={`text-2xl font-bold ${textColor}`}>{block.title}</h3>}
                {block.content && (
                  <div className={`${mutedColor} leading-relaxed whitespace-pre-wrap`}>
                    {block.content}
                  </div>
                )}
              </div>
            )}

            {block.type === 'image' && (
              <div className="space-y-2">
                {block.imageUrl && (
                  <img src={block.imageUrl} alt={block.imageCaption || ''} className="w-full rounded-xl object-cover max-h-[500px]" />
                )}
                {block.imageCaption && (
                  <p className={`text-sm ${mutedColor} text-center`}>{block.imageCaption}</p>
                )}
              </div>
            )}

            {block.type === 'video' && block.videoUrl && (
              <div className="space-y-3">
                {block.title && <h3 className={`text-xl font-bold ${textColor}`}>{block.title}</h3>}
                <div className="relative w-full aspect-video rounded-xl overflow-hidden">
                  {(() => {
                    const embedUrl = getVideoEmbedUrl(block.videoUrl!);
                    return embedUrl ? (
                      <iframe src={embedUrl} className="w-full h-full" allowFullScreen />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center ${bgMuted} ${mutedColor}`}>
                        Invalid video URL
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {block.type === 'gallery' && (block.galleryUrls?.length ?? 0) > 0 && (
              <div className="space-y-4">
                {block.title && <h3 className={`text-xl font-bold ${textColor}`}>{block.title}</h3>}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {block.galleryUrls!.map((url, i) => (
                    <img key={i} src={url} alt="" className="w-full aspect-square object-cover rounded-lg hover:opacity-90 transition-opacity cursor-pointer" />
                  ))}
                </div>
              </div>
            )}

            {block.type === 'quote' && block.content && (
              <blockquote className={`border-l-4 ${accentColor ? '' : (isDark ? 'border-white/30' : 'border-zinc-300')} pl-6 py-2`}
                style={accentColor ? { borderColor: accentColor } : undefined}
              >
                <p className={`text-lg md:text-xl italic ${textColor} leading-relaxed`}>"{block.content}"</p>
                {(block.quoteAuthor || block.quoteRole) && (
                  <footer className={`mt-3 text-sm ${mutedColor}`}>
                    {block.quoteAuthor && <span className="font-medium">{block.quoteAuthor}</span>}
                    {block.quoteAuthor && block.quoteRole && <span> · </span>}
                    {block.quoteRole && <span>{block.quoteRole}</span>}
                  </footer>
                )}
              </blockquote>
            )}

            {block.type === 'stats' && (block.stats?.length ?? 0) > 0 && (
              <div className="space-y-4">
                {block.title && <h3 className={`text-xl font-bold text-center ${textColor}`}>{block.title}</h3>}
                <div className={`grid grid-cols-2 md:grid-cols-${Math.min(block.stats!.length, 4)} gap-4`}>
                  {block.stats!.map((stat, i) => (
                    <div key={i} className={`text-center p-4 rounded-xl ${bgMuted}`}>
                      <div className={`text-2xl md:text-3xl font-bold ${textColor}`}
                        style={accentColor ? { color: accentColor } : undefined}
                      >
                        {stat.value}
                      </div>
                      <div className={`text-xs mt-1 ${mutedColor} uppercase tracking-wider`}>{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {block.type === 'cta' && (
              <div className={`text-center p-8 md:p-12 rounded-2xl ${bgMuted}`}>
                {block.title && <h3 className={`text-2xl md:text-3xl font-bold ${textColor} mb-3`}>{block.title}</h3>}
                {block.content && <p className={`${mutedColor} mb-6 max-w-lg mx-auto`}>{block.content}</p>}
                {block.buttonText && block.buttonUrl && (
                  <a
                    href={block.buttonUrl}
                    target={block.buttonUrl.startsWith('http') ? '_blank' : undefined}
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center px-8 py-3 rounded-full font-semibold text-sm transition-all hover:scale-105"
                    style={accentColor
                      ? { backgroundColor: accentColor, color: isDark ? '#000' : '#fff' }
                      : { backgroundColor: isDark ? '#fff' : '#111', color: isDark ? '#000' : '#fff' }
                    }
                  >
                    {block.buttonText}
                  </a>
                )}
              </div>
            )}

            {block.type === 'divider' && (
              <div className="py-4">
                {block.dividerStyle === 'dots' ? (
                  <div className="flex justify-center gap-2">
                    {[0, 1, 2].map(i => (
                      <div key={i} className={`w-1.5 h-1.5 rounded-full ${isDark ? 'bg-white/20' : 'bg-zinc-300'}`} />
                    ))}
                  </div>
                ) : block.dividerStyle === 'space' ? (
                  <div className="h-8" />
                ) : (
                  <hr className={`border-t ${borderColor}`} />
                )}
              </div>
            )}

            {block.type === 'embed' && block.embedCode && (
              <div className="space-y-3">
                {block.title && <h3 className={`text-xl font-bold ${textColor}`}>{block.title}</h3>}
                <div
                  className="rounded-xl overflow-hidden"
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(block.embedCode, {
                      ALLOWED_TAGS: ['iframe', 'div', 'p', 'span', 'br'],
                      ALLOWED_ATTR: ['src', 'width', 'height', 'frameborder', 'allow', 'allowfullscreen', 'title', 'loading', 'referrerpolicy', 'class', 'style'],
                      ALLOWED_URI_REGEXP: /^https?:\/\//i,
                    }),
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
