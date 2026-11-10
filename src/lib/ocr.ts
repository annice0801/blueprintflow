import "server-only";
import os from "os";
import path from "path";

/*
 * 掃描型 PDF 文字辨識（OCR）：取出每頁的掃描影像，依頁面旋轉角度轉正後以 Tesseract 繁中模型辨識。
 * 模型（chi_tra，約 20MB）第一次使用時下載：本機存 data/ocr；Vercel 上只有暫存目錄可寫，存在 /tmp。
 */

const CACHE = process.env.VERCEL ? path.join(os.tmpdir(), "ocr") : path.join(process.cwd(), "data", "ocr");
const CJK = "\\u3000-\\u303f\\u4e00-\\u9fff\\uff00-\\uffef";

/** 常見誤認：會議次別、被雜點拆開的欄位名 */
const FIXES: [RegExp, string][] = [
  [/第([一二三四五六七八九十\d]+)[軟欠吹坎]/g, "第$1次"],
  [/([決時主紀說])[ 　]*[”“"'‧。、]?[ 　]*([議間席錄明])[ 　]*[:：]/g, "$1$2："],
  [/時[ 　]*[。、]?[ 　]*問[ 　]*[:：]/g, "時間："],
  [/\bB[lI](?=[^\dA-Za-z]|$)/g, "B1"],
];

/** Tesseract 會在中文字之間插空白：移除中文字與標點之間的空白 */
export function tidyOcr(text: string) {
  const t = text
    .replace(new RegExp(`([${CJK}])[ \\t]+(?=[${CJK}0-9])`, "g"), "$1")
    .replace(new RegExp(`([0-9])[ \\t]+(?=[${CJK}])`, "g"), "$1")
    .replace(/^[\s“”"'‧_|]+/gm, "")
    .replace(/\n{3,}/g, "\n\n");
  return FIXES.reduce((acc, [re, to]) => acc.replace(re, to), t);
}

type Page = { png: Buffer; rotate: number };

async function pageImages(buf: Buffer): Promise<Page[]> {
  const { extractImages, getDocumentProxy } = await import("unpdf");
  const sharp = (await import("sharp")).default;
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const pages: Page[] = [];
  for (let i = 1; i <= Math.min(pdf.numPages, 30); i++) {
    const page = await pdf.getPage(i);
    const imgs = await extractImages(pdf, i);
    const img = imgs.sort((a, b) => b.width * b.height - a.width * a.height)[0];
    if (!img || img.width < 400) continue;
    const channels = (img.data.length / (img.width * img.height)) as 1 | 2 | 3 | 4;
    const png = await sharp(Buffer.from(img.data), { raw: { width: img.width, height: img.height, channels } }).png().toBuffer();
    pages.push({ png, rotate: page.rotate });
  }
  return pages;
}

export async function ocrPdf(buf: Buffer): Promise<string> {
  const pages = await pageImages(buf);
  if (!pages.length) return "";
  const sharp = (await import("sharp")).default;
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("chi_tra", 1, { cachePath: CACHE });
  try {
    const read = async (p: Page, deg: number) => {
      const img = deg ? await sharp(p.png).rotate(deg).png().toBuffer() : p.png;
      const { data } = await worker.recognize(img);
      return { text: data.text, conf: data.confidence };
    };
    // 先用頁面標示的旋轉角度；辨識信心偏低時換其他角度試，選最好的套用到其餘頁面
    let deg = pages[0].rotate % 360;
    let first = await read(pages[0], deg);
    if (first.conf < 60)
      for (const d of [0, 90, 180, 270].filter((x) => x !== deg)) {
        const r = await read(pages[0], d);
        if (r.conf > first.conf) [first, deg] = [r, d];
      }
    const texts = [first.text];
    const extra = (deg - pages[0].rotate + 360) % 360;
    for (const p of pages.slice(1)) texts.push((await read(p, (p.rotate + extra) % 360)).text);
    return tidyOcr(texts.join("\n"));
  } finally {
    await worker.terminate();
  }
}
