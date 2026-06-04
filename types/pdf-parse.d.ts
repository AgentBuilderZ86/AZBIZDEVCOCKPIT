interface PdfParseResult {
  text?: string;
  numpages?: number;
}

declare module "pdf-parse/lib/pdf-parse.js" {
  function pdfParse(buffer: Buffer): Promise<PdfParseResult>;
  export default pdfParse;
}

declare module "pdf-parse" {
  function pdfParse(buffer: Buffer): Promise<PdfParseResult>;
  export default pdfParse;
}
