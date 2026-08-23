import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";

function clean(value, max = 200000) {
  return String(value ?? "").replace(/\u0000/g, "").slice(0, max);
}

export async function buildDocx({ title = "موسوعة دين الله", text = "", language = "ar", source = "" } = {}) {
  const paragraphs = clean(text).split(/\r?\n/).map(line => new Paragraph({
    children: [new TextRun({ text: clean(line, 12000), rightToLeft: language === "ar" || /[\u0600-\u06ff]/.test(line) })]
  }));
  const children = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: clean(title, 5000), bold: true, rightToLeft: /[\u0600-\u06ff]/.test(title) })] }),
    ...paragraphs,
    source ? new Paragraph({ children: [new TextRun({ text: `المصدر: ${clean(source, 5000)}`, italics: true, rightToLeft: true })] }) : null
  ].filter(Boolean);
  const document = new Document({ sections: [{ properties: {}, children }] });
  return Packer.toBuffer(document);
}

export function printableHtml({ title = "موسوعة دين الله", text = "", language = "ar" } = {}) {
  const escaped = clean(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escapedTitle = clean(title, 5000).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!doctype html><html lang="${clean(language,20)}" dir="${language === "ar" ? "rtl" : "ltr"}"><meta charset="utf-8"><title>${escapedTitle}</title><style>body{font-family:serif;line-height:1.9;max-width:900px;margin:40px auto;padding:20px}h1{font-size:28px}pre{white-space:pre-wrap;font:inherit}</style><h1>${escapedTitle}</h1><pre>${escaped}</pre><script>window.onload=()=>setTimeout(()=>window.print(),250)</script></html>`;
}
