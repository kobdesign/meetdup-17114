import { Router, Request, Response } from "express";
import { getGrowthCopilotData } from "../services/growthCopilot";

const router = Router();

router.get("/growth-copilot/:tenantId", async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant ID is required" });
    }
    
    const data = await getGrowthCopilotData(tenantId);
    res.json(data);
  } catch (error: any) {
    console.error("[AI Growth Copilot] Error:", error);
    res.status(500).json({ 
      error: "Failed to get growth copilot data",
      message: error.message 
    });
  }
});

export default router;
