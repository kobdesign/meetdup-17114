import { Router } from "express";
import configRouter from "./config";
import webhookRouter from "./webhook";
import richMenuRouter from "./richMenu";
import commandAccessRouter from "./commandAccess";

const router = Router();

router.use("/config", configRouter);
router.use("/webhook", webhookRouter);
router.use("/rich-menu", richMenuRouter);
router.use("/command-access", commandAccessRouter);

export default router;
