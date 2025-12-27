import { Router } from "express";
import multer from "multer";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
    files: 5 // max 5 files
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`ประเภทไฟล์ไม่รองรับ: ${file.mimetype}`));
    }
  }
});

interface AIEstimateRequest {
  description?: string;
  availableItems: Array<{
    id: string;
    name: string;
    unit: string;
    unitPrice: number;
    categoryId: string;
  }>;
}

interface AISuggestion {
  itemId: string;
  itemName: string;
  quantity: number;
  reason: string;
}

interface AIEstimateResponse {
  success: boolean;
  suggestions: AISuggestion[];
  summary?: string;
  error?: string;
}

router.post("/ai-estimate", upload.array("files", 5), async (req, res) => {
  try {
    const webhookUrl = process.env.N8N_BOQ_WEBHOOK_URL;
    
    if (!webhookUrl) {
      return res.status(503).json({
        success: false,
        suggestions: [],
        error: "AI service ยังไม่ได้ตั้งค่า กรุณาติดต่อผู้ดูแลระบบ"
      } as AIEstimateResponse);
    }

    const files = req.files as Express.Multer.File[];
    const { description, availableItems } = req.body;

    let parsedItems: AIEstimateRequest['availableItems'] = [];
    try {
      parsedItems = JSON.parse(availableItems || '[]');
    } catch (e) {
      console.error("[BOQ AI] Failed to parse availableItems:", e);
    }

    if (!files?.length && !description) {
      return res.status(400).json({
        success: false,
        suggestions: [],
        error: "กรุณาอัปโหลดไฟล์หรือพิมพ์รายละเอียดโครงการ"
      } as AIEstimateResponse);
    }

    const filesData = files?.map(file => ({
      filename: file.originalname,
      mimetype: file.mimetype,
      base64: file.buffer.toString('base64'),
      size: file.size
    })) || [];

    console.log(`[BOQ AI] Sending request to n8n - Files: ${filesData.length}, Description: ${description?.length || 0} chars`);

    const n8nPayload = {
      description: description || '',
      files: filesData,
      availableItems: parsedItems.map(item => ({
        id: item.id,
        name: item.name,
        unit: item.unit,
        unitPrice: item.unitPrice,
        categoryId: item.categoryId
      }))
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(n8nPayload),
    });

    if (!response.ok) {
      console.error(`[BOQ AI] n8n returned ${response.status}`);
      return res.status(502).json({
        success: false,
        suggestions: [],
        error: "ไม่สามารถเชื่อมต่อ AI service ได้"
      } as AIEstimateResponse);
    }

    const result = await response.json() as { suggestions?: AISuggestion[]; summary?: string };
    console.log(`[BOQ AI] Received ${result.suggestions?.length || 0} suggestions from n8n`);

    return res.json({
      success: true,
      suggestions: result.suggestions || [],
      summary: result.summary || ''
    } as AIEstimateResponse);

  } catch (error: any) {
    console.error("[BOQ AI] Error:", error);
    return res.status(500).json({
      success: false,
      suggestions: [],
      error: error.message || "เกิดข้อผิดพลาดในการประมวลผล"
    } as AIEstimateResponse);
  }
});

export default router;
