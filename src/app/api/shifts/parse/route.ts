import { parseShiftFile } from "@/lib/shift-parse";
import { errorResponse, ValidationError } from "@/lib/validate";

/** 上傳班表（PDF / Word / Excel / CSV / 文字）→ 解析預覽，尚未匯入 */
export async function POST(request: Request) {
  try {
    const file = (await request.formData()).get("file");
    if (!(file instanceof File) || !file.size) throw new ValidationError("請選擇班表檔案");
    if (!/\.(pdf|docx|xlsx|csv|txt)$/i.test(file.name)) throw new ValidationError("支援 .pdf、.docx、.xlsx、.csv、.txt");
    const parsed = await parseShiftFile(file).catch((e) => {
      throw new ValidationError(`無法讀取班表：${(e as Error).message}`);
    });
    if (!parsed.rows.length) throw new ValidationError("找不到「姓名 + 每日班別」的列。建議用 Excel / CSV：第一欄姓名，其後每欄一天（表頭為 1、2、3…）。");
    return Response.json(parsed);
  } catch (e) {
    return errorResponse(e);
  }
}
