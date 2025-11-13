import { Router } from "express";
import configRouter from "./config";
import webhookRouter from "./webhook";
import richMenuRouter from "./richMenu";

const router = Router();

router.use("/config", configRouter);
router.use("/webhook", webhookRouter);
router.use("/rich-menu", richMenuRouter);

export default router;
