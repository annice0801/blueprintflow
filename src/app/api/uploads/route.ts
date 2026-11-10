import { savePhoto } from "@/lib/store";
import { errorResponse, ValidationError } from "@/lib/validate";

/** 上傳單張照片，回傳檔名（公告、值班日誌、張貼照片共用） */
export async function POST(request: Request) {
  try {
    const file = (await request.formData()).get("file");
    if (!(file instanceof File) || !file.size) throw new ValidationError("請選擇照片");
    return Response.json({ name: await savePhoto(file) }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
