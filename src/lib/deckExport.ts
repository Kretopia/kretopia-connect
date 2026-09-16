import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/**
 * Exports the live deck DOM to a multi-page PDF.
 * Each `[style*="page-break-after"]` slide becomes one PDF page.
 */
export async function exportDeckToPDF(rootEl: HTMLElement, filename: string) {
  const slides = Array.from(rootEl.children) as HTMLElement[];
  if (!slides.length) throw new Error("No slides to export");

  const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [1280, 800] });

  for (let i = 0; i < slides.length; i++) {
    const canvas = await html2canvas(slides[i], {
      scale: 2,
      useCORS: true,
      backgroundColor: null,
    });
    const img = canvas.toDataURL("image/jpeg", 0.92);
    if (i > 0) pdf.addPage([1280, 800], "landscape");
    pdf.addImage(img, "JPEG", 0, 0, 1280, 800, undefined, "FAST");
  }

  pdf.save(filename);
}
