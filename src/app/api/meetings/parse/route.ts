import { extractText, parseMeeting } from "@/lib/meeting-parse";
import type { Meeting, Regulation } from "@/lib/mgmt";
import { suggestPlaybooks } from "@/lib/playbooks";
import { deleteDocument, readCollection, saveDocument } from "@/lib/store";
import { errorResponse, ValidationError } from "@/lib/validate";

/** 上傳會議紀錄 → 存原檔、取出文字並解析為草稿（尚未建立會議） */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) throw new ValidationError("請選擇會議紀錄檔案");
    let extracted;
    try {
      extracted = await extractText(file, { ocr: true });
    } catch (e) {
      throw new ValidationError((e as Error).message.startsWith("僅支援") ? (e as Error).message : "無法讀取檔案內容，請確認檔案未加密或損毀");
    }
    if (!extracted.text.trim()) throw new ValidationError("檔案中沒有可讀取的文字，掃描影像也辨識不到內容，請確認檔案清晰度");
    const name = await saveDocument(file);
    const draft = parseMeeting(extracted.text, extracted.source, file.name);
    return Response.json({ file: { name, original: file.name }, text: extracted.text, draft, ocr: !!extracted.ocr, suggestions: suggestPlaybooks(extracted.text, draft.date) });
  } catch (e) {
    return errorResponse(e);
  }
}

/** 取消匯入：刪除尚未被任何會議引用的暫存原檔 */
export async function DELETE(request: Request) {
  const name = new URL(request.url).searchParams.get("file") ?? "";
  const used = [...(await readCollection<Meeting>("meetings")), ...(await readCollection<Regulation>("regulations"))].some((m) => m.file?.name === name);
  if (name && !used) await deleteDocument(name);
  return new Response(null, { status: 204 });
}
