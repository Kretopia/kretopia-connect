import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ImageLoaderProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  fallbackSrc?: string;
  aspectRatio?: "square" | "video" | "portrait";
}

export const ImageLoader = ({ 
  src, 
  alt, 
  fallbackSrc = "/placeholder.svg",
  className,
  aspectRatio,
  ...props 
}: ImageLoaderProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [imageSrc, setImageSrc] = useState(src);

  useEffect(() => {
    setImageSrc(src);
    setLoading(true);
    setError(false);
  }, [src]);

  const handleLoad = () => {
    setLoading(false);
  };

  const handleError = () => {
    setError(true);
    setLoading(false);
    if (fallbackSrc) {
      setImageSrc(fallbackSrc);
    }
  };

  const aspectRatioClass = {
    square: "aspect-square",
    video: "aspect-video",
    portrait: "aspect-[3/4]",
  }[aspectRatio || ""] || "";

  return (
    <div className={cn("relative overflow-hidden", aspectRatioClass, className)}>
      {loading && (
        <Skeleton className="absolute inset-0" />
      )}
      <img
        src={imageSrc}
        alt={alt}
        loading="lazy"
        onLoad={handleLoad}
        onError={handleError}
        className={cn(
          "transition-opacity duration-300",
          loading ? "opacity-0" : "opacity-100",
          className
        )}
        {...props}
      />
    </div>
  );
};
