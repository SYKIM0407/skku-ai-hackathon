'use client';

/**
 * 교안 PDF에서 텍스트 추출 (브라우저, pdf.js).
 * 서버로는 PDF가 아니라 추출한 텍스트만 보낸다 → Vercel 요청 크기 제한(4.5MB)과 서버 PDF 라이브러리 문제를 피한다.
 * worker는 public/pdf.worker.min.mjs (pdfjs-dist와 같은 버전으로 복사해 둔 것).
 */
export const PDF_TEXT_MAX_CHARS = 100_000; // 서버 저장 상한과 동일. AI에는 앞 2만 자만 간다

export type PdfTextResult = { text: string; pages: number } | { error: 'unreadable' | 'no_text' };

export async function extractPdfText(file: File, onProgress?: (page: number, total: number) => void): Promise<PdfTextResult> {
  let pdf;
  try {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  } catch {
    return { error: 'unreadable' };
  }

  const parts: string[] = [];
  let length = 0;
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      // pdf.js 조각에는 공백 조각이 따로 들어 있으므로 그대로 잇고, 줄이 바뀔 때만 줄바꿈
      const line = content.items
        .map((it) => ('str' in it ? it.str + (it.hasEOL ? '\n' : '') : ''))
        .join('')
        .replace(/[ \t]+/g, ' ')
        .trim();
      if (line) {
        parts.push(line);
        length += line.length;
      }
      onProgress?.(i, pdf.numPages);
      if (length >= PDF_TEXT_MAX_CHARS) break; // 뒤쪽은 어차피 쓰지 않는다
    }
  } catch {
    return { error: 'unreadable' };
  } finally {
    await pdf.destroy().catch(() => {});
  }

  const text = parts.join('\n\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, PDF_TEXT_MAX_CHARS);
  if (!text) return { error: 'no_text' }; // 스캔본
  return { text, pages: pdf.numPages };
}
