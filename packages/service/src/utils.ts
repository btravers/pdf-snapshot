export function pngBufferToBase64(pdf: Buffer): string {
  return `data:image/png;base64,${pdf.toString('base64')}`;
}
