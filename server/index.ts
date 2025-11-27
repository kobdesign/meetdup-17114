import express from "express";
import { registerVite } from "./vite";
import lineRouter from "./routes/line/index";
import chaptersRouter from "./routes/chapters";
import participantsRouter from "./routes/participants";
import usersRouter from "./routes/users";
import publicRouter from "./routes/public";
import { performHealthCheck, printHealthCheckReport } from "./utils/dbHealthCheck";
import { setupRichMenuStorage } from "./utils/setupStorage";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Perform database health check and storage setup on startup
(async () => {
  try {
    const healthCheck = await performHealthCheck();
    printHealthCheckReport(healthCheck);
    
    // Setup Rich Menu storage bucket
    await setupRichMenuStorage();
  } catch (error) {
    console.error('❌ Startup checks failed:', error);
  }
})();

// Health check endpoint
app.get("/api/health", async (req, res) => {
  try {
    const { supabaseAdmin } = await import("./utils/supabaseClient");
    
    // Test database connection
    const { data, error } = await supabaseAdmin
      .from("tenants")
      .select("tenant_id")
      .limit(1);
    
    if (error) {
      return res.status(500).json({
        status: "error",
        message: "Database connection failed",
        error: error.message
      });
    }
    
    res.json({
      status: "ok",
      database: "connected",
      tables: "accessible",
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      status: "error",
      message: error.message
    });
  }
});

// Test endpoint for LINE card search (for debugging)
app.get("/api/test/card-search", async (req, res) => {
  try {
    const { supabaseAdmin } = await import("./utils/supabaseClient");
    const searchTerm = req.query.term as string || "กบ";
    const tenantId = req.query.tenant_id as string || "e2f4c38c-4dd1-4f05-9866-f18ba7028dfa";
    
    console.log(`[test-card-search] Searching for: "${searchTerm}" in tenant: ${tenantId}`);
    
    // Search by full_name
    const { data: byFullName, error: error1 } = await supabaseAdmin
      .from("participants")
      .select(`
        participant_id,
        full_name,
        nickname,
        email,
        phone,
        company,
        status,
        tenants!inner (tenant_name, logo_url)
      `)
      .eq("tenant_id", tenantId)
      .ilike("full_name", `%${searchTerm}%`)
      .limit(10);

    // Search by nickname
    const { data: byNickname, error: error2 } = await supabaseAdmin
      .from("participants")
      .select(`
        participant_id,
        full_name,
        nickname,
        email,
        phone,
        company,
        status,
        tenants!inner (tenant_name, logo_url)
      `)
      .eq("tenant_id", tenantId)
      .ilike("nickname", `%${searchTerm}%`)
      .limit(10);

    const allResults = [...(byFullName || []), ...(byNickname || [])];
    const uniqueMap = new Map();
    for (const p of allResults) {
      if (!uniqueMap.has(p.participant_id)) {
        uniqueMap.set(p.participant_id, p);
      }
    }
    const participants = Array.from(uniqueMap.values()).slice(0, 10);

    res.json({
      searchTerm,
      tenantId,
      byFullName: {
        count: byFullName?.length || 0,
        error: error1 ? JSON.stringify(error1) : null
      },
      byNickname: {
        count: byNickname?.length || 0,
        error: error2 ? JSON.stringify(error2) : null
      },
      totalUnique: participants.length,
      results: participants
    });
  } catch (error: any) {
    res.status(500).json({
      status: "error",
      message: error.message,
      stack: error.stack
    });
  }
});

// Test webhook simulation - shows what the Edge Function would do
app.post("/api/test/line-webhook-simulate", async (req, res) => {
  try {
    console.log("[webhook-simulate] Received request");
    console.log("[webhook-simulate] Body:", JSON.stringify(req.body, null, 2));
    
    const { message, tenant_id = "e2f4c38c-4dd1-4f05-9866-f18ba7028dfa" } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: "Missing 'message' in request body" });
    }
    
    // Simulate text normalization from webhook
    const text = message
      .replace(/　/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const textLower = text.toLowerCase();
    
    console.log(`[webhook-simulate] Normalized text: "${text}"`);
    console.log(`[webhook-simulate] Lowercase: "${textLower}"`);
    
    // Check if it's a card search command
    if (textLower.startsWith("card ") || textLower.startsWith("นามบัตร ")) {
      const searchTerm = textLower.startsWith("card ") 
        ? text.substring(5).trim() 
        : text.substring(8).trim();
      
      console.log(`[webhook-simulate] Command: CARD_SEARCH`);
      console.log(`[webhook-simulate] Search term: "${searchTerm}"`);
      
      const { supabaseAdmin } = await import("./utils/supabaseClient");
      
      // Search logic (same as webhook)
      const { data: byFullName } = await supabaseAdmin
        .from("participants")
        .select(`
          participant_id, full_name, nickname, email, phone, company, status,
          tenants!inner (tenant_name, logo_url)
        `)
        .eq("tenant_id", tenant_id)
        .ilike("full_name", `%${searchTerm}%`)
        .limit(10);
      
      const { data: byNickname } = await supabaseAdmin
        .from("participants")
        .select(`
          participant_id, full_name, nickname, email, phone, company, status,
          tenants!inner (tenant_name, logo_url)
        `)
        .eq("tenant_id", tenant_id)
        .ilike("nickname", `%${searchTerm}%`)
        .limit(10);
      
      const allResults = [...(byFullName || []), ...(byNickname || [])];
      const uniqueMap = new Map();
      for (const p of allResults) {
        if (!uniqueMap.has(p.participant_id)) {
          uniqueMap.set(p.participant_id, p);
        }
      }
      const participants = Array.from(uniqueMap.values()).slice(0, 10);
      
      if (participants.length === 0) {
        return res.json({
          command: "CARD_SEARCH",
          searchTerm,
          found: 0,
          response: `❌ ไม่พบข้อมูลที่ตรงกับ "${searchTerm}"`
        });
      }
      
      return res.json({
        command: "CARD_SEARCH",
        searchTerm,
        found: participants.length,
        response: participants.length === 1 ? "Single Business Card" : `Carousel with ${participants.length} cards`,
        results: participants
      });
    }
    
    // Not a card search
    return res.json({
      command: "OTHER",
      text,
      textLower,
      response: "Would trigger different handler (greeting/help/etc)"
    });
    
  } catch (error: any) {
    console.error("[webhook-simulate] Error:", error);
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
});

// LINE Integration routes
app.use("/api/line", lineRouter);

// Chapter management routes
app.use("/api/chapters", chaptersRouter);

// Participants analytics routes
app.use("/api/participants", participantsRouter);

// User management routes (Super Admin only)
app.use("/api/users", usersRouter);

// Public API routes (no auth required - for LIFF and public pages)
app.use("/api/public", publicRouter);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      console.log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    const server = await registerVite(app);

    const PORT = 5000;
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`✓ Server running on port ${PORT}`);
      console.log(`✓ Open http://localhost:${PORT} to view the app`);
    });

    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`✗ Port ${PORT} is already in use`);
      } else {
        console.error(`✗ Server error:`, error);
      }
      process.exit(1);
    });
  } catch (error) {
    console.error('✗ Failed to start server:', error);
    process.exit(1);
  }
})();
