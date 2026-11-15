// Stands in for the `npm:pdfjs-dist@…` specifier an edge function imports lazily to read PDF attachments. Vite cannot
// resolve Deno-style `npm:` specifiers, even ones a test never reaches; the handler tests do not parse PDFs.
export const getDocument = () => {
  throw new Error("pdfjs is not available in tests");
};
export const GlobalWorkerOptions = {};
