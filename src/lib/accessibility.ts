/**
 * Accessibility utilities for the application
 */

/**
 * Creates a visually hidden but screen reader accessible element
 * Use this for labels that should be hidden visually but read by screen readers
 */
export const srOnly = "absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0";

/**
 * Announces a message to screen readers without visual change
 * @param message - The message to announce
 * @param priority - The priority of the announcement (polite or assertive)
 */
export const announceToScreenReader = (
  message: string, 
  priority: 'polite' | 'assertive' = 'polite'
) => {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = srOnly;
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  // Remove after announcement is made
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
};

/**
 * Checks if user prefers reduced motion
 * @returns true if user prefers reduced motion
 */
export const prefersReducedMotion = (): boolean => {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * Gets appropriate focus visible ring classes based on theme
 */
export const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

/**
 * Skip to main content link for keyboard navigation
 */
export const skipToMainContentId = "main-content";
