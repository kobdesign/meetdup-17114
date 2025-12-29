import { Router } from "express";
import { supabaseAdmin } from "../utils/supabaseClient";
import { verifySupabaseAuth, AuthenticatedRequest } from "../utils/auth";
import { syncUserToParticipants } from "../utils/participants";
import { LineClient } from "../services/line/lineClient";
import { getLineCredentials } from "../services/line/credentials";
import { 
  approveMember, 
  rejectMember, 
  sendApprovalNotificationToApplicant,
  sendRejectionNotificationToApplicant
} from "../services/memberApprovalService";
import { subscriptionService } from "../stripe/subscriptionService";
import crypto from "crypto";

const router = Router();

// Create new chapter (user becomes admin)
router.post("/create", verifySupabaseAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { tenant_name, subdomain } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!tenant_name || !subdomain) {
      return res.status(400).json({ 
        error: "Missing required fields",
        message: "tenant_name และ subdomain จำเป็นต้องกรอก"
      });
    }

    // Check if subdomain already exists
    const { data: existingTenant } = await supabaseAdmin
      .from("tenants")
      .select("tenant_id")
      .eq("subdomain", subdomain)
      .single();

    if (existingTenant) {
      return res.status(400).json({ 
        error: "Subdomain already exists",
        message: "Subdomain นี้ถูกใช้งานแล้ว กรุณาเลือก subdomain อื่น"
      });
    }

    // Create tenant
    const { data: newTenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .insert({
        tenant_name,
        subdomain,
      })
      .select()
      .single();

    if (tenantError) {
      console.error("Error creating tenant:", tenantError);
      return res.status(500).json({ 
        error: "Failed to create chapter",
        message: tenantError.message
      });
    }

    // Create user profile if not exists
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .single();

    if (!existingProfile) {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .insert({
          id: userId,
        });

      if (profileError) {
        console.error("Error creating profile:", profileError);
        // Continue anyway as profile might already exist
      }
    }

    // Assign user as chapter_admin
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: userId,
        tenant_id: newTenant.tenant_id,
        role: "chapter_admin",
      });

    if (roleError) {
      console.error("Error assigning role:", roleError);
      // Rollback: delete tenant
      await supabaseAdmin
        .from("tenants")
        .delete()
        .eq("tenant_id", newTenant.tenant_id);

      return res.status(500).json({ 
        error: "Failed to assign admin role",
        message: roleError.message
      });
    }

    // Sync user to participants table
    const participantResult = await syncUserToParticipants({
      user_id: userId,
      tenant_id: newTenant.tenant_id,
      role: "chapter_admin",
    });

    if (!participantResult.success) {
      console.error("Error syncing participant:", participantResult.error);
      // Rollback: delete user_roles and tenant
      await supabaseAdmin.from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("tenant_id", newTenant.tenant_id);
      
      await supabaseAdmin.from("tenants")
        .delete()
        .eq("tenant_id", newTenant.tenant_id);

      return res.status(500).json({ 
        error: "Failed to create participant record",
        message: participantResult.error
      });
    }

    return res.status(201).json({
      success: true,
      tenant: newTenant,
      message: "สร้าง Chapter สำเร็จ!",
    });

  } catch (error: any) {
    console.error("Chapter creation error:", error);
    return res.status(500).json({ 
      error: "Internal server error",
      message: error.message
    });
  }
});

// Generate invite link
router.post("/invite/generate", verifySupabaseAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { tenant_id, max_uses = 1, expires_in_days = 7 } = req.body;
    const userId = req.user?.id;

    if (!userId || !tenant_id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Check if user is super admin OR chapter admin of this specific chapter
    // First check for super admin (tenant_id = NULL)
    const { data: superAdminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .is("tenant_id", null)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!superAdminRole) {
      // Not a super admin, check if chapter admin for this specific chapter
      const { data: chapterAdminRole } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("tenant_id", tenant_id)
        .eq("role", "chapter_admin")
        .maybeSingle();

      if (!chapterAdminRole) {
        return res.status(403).json({ error: "Not authorized to create invites" });
      }
    }

    // Generate unique token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expires_in_days);

    // Create invite
    const { data: invite, error } = await supabaseAdmin
      .from("chapter_invites")
      .insert({
        tenant_id,
        token,
        created_by: userId,
        max_uses,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating invite:", error);
      return res.status(500).json({ error: "Failed to create invite" });
    }

    const inviteUrl = `${req.protocol}://${req.get("host")}/invite/${token}`;

    return res.status(201).json({
      success: true,
      invite,
      inviteUrl,
    });

  } catch (error: any) {
    console.error("Invite generation error:", error);
    return res.status(500).json({ error: error.message });
  }
});

// Accept invite (auto-join chapter)
router.post("/invite/accept/:token", verifySupabaseAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { token } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Find invite
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("chapter_invites")
      .select("*")
      .eq("token", token)
      .single();

    if (inviteError || !invite) {
      return res.status(404).json({ error: "Invalid or expired invite" });
    }

    // Check if expired
    if (new Date(invite.expires_at) < new Date()) {
      return res.status(400).json({ error: "This invite has expired" });
    }

    // Check if max uses reached
    if (invite.uses_count >= invite.max_uses) {
      return res.status(400).json({ error: "This invite has reached maximum uses" });
    }

    // Check member limit before accepting invite
    const limitCheck = await subscriptionService.checkLimitExceeded(invite.tenant_id, 'members');
    if (limitCheck.exceeded) {
      console.log(`[invite-accept] Member limit exceeded for tenant ${invite.tenant_id}: ${limitCheck.current}/${limitCheck.limit}`);
      return res.status(403).json({ 
        success: false,
        error: "LIMIT_EXCEEDED",
        message: `Chapter นี้มีสมาชิกครบ ${limitCheck.limit} คนแล้ว ไม่สามารถรับสมาชิกเพิ่มได้ในขณะนี้`,
        current: limitCheck.current,
        limit: limitCheck.limit
      });
    }

    // Check if user already has role in this chapter
    // Use limit(2) to detect both existing role and potential duplicates
    const { data: existingRoles } = await supabaseAdmin
      .from("user_roles")
      .select("*")
      .eq("user_id", userId)
      .eq("tenant_id", invite.tenant_id)
      .limit(2);

    if (existingRoles && existingRoles.length > 0) {
      // If exact duplicates exist (same role), return 409 to signal data corruption
      if (existingRoles.length > 1) {
        const roles = existingRoles.map(r => r.role);
        const hasDuplicateRole = new Set(roles).size < roles.length;
        
        if (hasDuplicateRole) {
          console.error(`❌ DATA CORRUPTION: Duplicate identical roles detected for user ${userId} in tenant ${invite.tenant_id}`, roles);
          return res.status(409).json({ 
            error: "Data integrity error",
            message: "ข้อมูลซ้ำซ้อนในระบบ กรุณาติดต่อผู้ดูแลระบบ"
          });
        }
      }
      
      return res.status(400).json({ 
        error: "Already a member",
        message: "คุณเป็นสมาชิกของ Chapter นี้อยู่แล้ว"
      });
    }

    // Create user profile if not exists
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .single();

    if (!existingProfile) {
      await supabaseAdmin
        .from("profiles")
        .insert({ id: userId });
    }

    // Add user as member
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: userId,
        tenant_id: invite.tenant_id,
        role: "member",
      });

    if (roleError) {
      console.error("Error assigning member role:", roleError);
      return res.status(500).json({ error: "Failed to join chapter" });
    }

    // Sync user to participants table
    const participantResult = await syncUserToParticipants({
      user_id: userId,
      tenant_id: invite.tenant_id,
      role: "member",
    });

    if (!participantResult.success) {
      console.error("Error syncing participant:", participantResult.error);
      // Rollback: delete user_roles
      await supabaseAdmin.from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("tenant_id", invite.tenant_id);

      return res.status(500).json({ 
        error: "Failed to create participant record",
        message: participantResult.error
      });
    }

    // Increment invite uses
    await supabaseAdmin
      .from("chapter_invites")
      .update({ uses_count: invite.uses_count + 1 })
      .eq("invite_id", invite.invite_id);

    // Get chapter info
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("tenant_name")
      .eq("tenant_id", invite.tenant_id)
      .single();

    return res.status(200).json({
      success: true,
      message: `เข้าร่วม Chapter "${tenant?.tenant_name}" สำเร็จ!`,
      tenant_id: invite.tenant_id,
    });

  } catch (error: any) {
    console.error("Invite accept error:", error);
    return res.status(500).json({ error: error.message });
  }
});

// Discover chapters (for new users to find and join)
router.get("/discover", verifySupabaseAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { search } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    let query = supabaseAdmin
      .from("tenants")
      .select("tenant_id, tenant_name, subdomain, created_at")
      .order("tenant_name");

    // Apply search filter if provided
    if (search && typeof search === "string") {
      query = query.or(`tenant_name.ilike.%${search}%,subdomain.ilike.%${search}%`);
    }

    const { data: tenants, error } = await query;

    if (error) {
      console.error("Error fetching tenants:", error);
      return res.status(500).json({ error: "Failed to fetch chapters" });
    }

    // Filter out chapters user is already member of
    const { data: userRoles } = await supabaseAdmin
      .from("user_roles")
      .select("tenant_id")
      .eq("user_id", userId);

    const userTenantIds = new Set(userRoles?.map(r => r.tenant_id) || []);
    const availableChapters = tenants?.filter(t => !userTenantIds.has(t.tenant_id)) || [];

    return res.status(200).json(availableChapters);

  } catch (error: any) {
    console.error("Discover chapters error:", error);
    return res.status(500).json({ error: error.message });
  }
});

// List all chapters (with optional search) - Alias for /discover
router.get("/list", verifySupabaseAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { search } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    let query = supabaseAdmin
      .from("tenants")
      .select("tenant_id, tenant_name, subdomain, created_at")
      .order("tenant_name");

    // Apply search filter if provided
    if (search && typeof search === "string") {
      query = query.or(`tenant_name.ilike.%${search}%,subdomain.ilike.%${search}%`);
    }

    const { data: tenants, error } = await query;

    if (error) {
      console.error("Error fetching tenants:", error);
      return res.status(500).json({ error: "Failed to fetch chapters" });
    }

    // Filter out chapters user is already member of
    const { data: userRoles } = await supabaseAdmin
      .from("user_roles")
      .select("tenant_id")
      .eq("user_id", userId);

    const userTenantIds = new Set(userRoles?.map(r => r.tenant_id) || []);
    const availableChapters = tenants?.filter(t => !userTenantIds.has(t.tenant_id)) || [];

    return res.status(200).json(availableChapters);

  } catch (error: any) {
    console.error("List chapters error:", error);
    return res.status(500).json({ error: error.message });
  }
});

// Create join request
router.post("/join-request", verifySupabaseAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { tenant_id, message } = req.body;
    const userId = req.user?.id;

    if (!userId || !tenant_id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Check if user already has role in this chapter
    // Use limit(2) to detect both existing role and potential duplicates
    const { data: existingRoles } = await supabaseAdmin
      .from("user_roles")
      .select("*")
      .eq("user_id", userId)
      .eq("tenant_id", tenant_id)
      .limit(2);

    if (existingRoles && existingRoles.length > 0) {
      // If exact duplicates exist (same role), return 409 to signal data corruption
      if (existingRoles.length > 1) {
        const roles = existingRoles.map(r => r.role);
        const hasDuplicateRole = new Set(roles).size < roles.length;
        
        if (hasDuplicateRole) {
          console.error(`❌ DATA CORRUPTION: Duplicate identical roles detected for user ${userId} in tenant ${tenant_id}`, roles);
          return res.status(409).json({ 
            error: "Data integrity error",
            message: "ข้อมูลซ้ำซ้อนในระบบ กรุณาติดต่อผู้ดูแลระบบ"
          });
        }
      }
      
      return res.status(400).json({ 
        error: "Already a member",
        message: "คุณเป็นสมาชิกของ Chapter นี้อยู่แล้ว"
      });
    }

    // Check if pending request already exists
    // Use limit(2) to detect potential duplicates
    const { data: existingRequests } = await supabaseAdmin
      .from("chapter_join_requests")
      .select("*")
      .eq("user_id", userId)
      .eq("tenant_id", tenant_id)
      .eq("status", "pending")
      .limit(2);

    if (existingRequests && existingRequests.length > 1) {
      console.error(`❌ DATA CORRUPTION: Duplicate pending join_requests detected for user ${userId} in tenant ${tenant_id}`);
      return res.status(409).json({ 
        error: "Data integrity error",
        message: "ข้อมูลซ้ำซ้อนในระบบ กรุณาติดต่อผู้ดูแลระบบ"
      });
    }
    
    if (existingRequests && existingRequests.length > 0) {
      return res.status(400).json({ 
        error: "Request already exists",
        message: "คุณมีคำขอเข้าร่วมที่รอการอนุมัติอยู่แล้ว"
      });
    }

    // Create join request
    const { data: request, error } = await supabaseAdmin
      .from("chapter_join_requests")
      .insert({
        tenant_id,
        user_id: userId,
        message,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating join request:", error);
      return res.status(500).json({ error: "Failed to create join request" });
    }

    return res.status(201).json({
      success: true,
      request,
      message: "ส่งคำขอเข้าร่วมสำเร็จ",
    });

  } catch (error: any) {
    console.error("Join request error:", error);
    return res.status(500).json({ error: error.message });
  }
});

// List invites for a tenant (Admin only)
router.get("/invites", verifySupabaseAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { tenant_id } = req.query;
    const userId = req.user?.id;

    if (!userId || !tenant_id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Check if user is admin (support both super_admin with NULL tenant_id and chapter_admin)
    const { data: userRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role, tenant_id")
      .eq("user_id", userId);

    const hasAccess = userRoles?.some(r => 
      r.role === "super_admin" || 
      (r.tenant_id === tenant_id && ["chapter_admin", "super_admin"].includes(r.role))
    );

    if (!hasAccess) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const { data: invites, error } = await supabaseAdmin
      .from("chapter_invites")
      .select("*")
      .eq("tenant_id", tenant_id as string)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return res.status(200).json(invites);

  } catch (error: any) {
    console.error("List invites error:", error);
    return res.status(500).json({ error: error.message });
  }
});

// List join requests for a tenant (Admin only)
router.get("/join-requests", verifySupabaseAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { tenant_id } = req.query;
    const userId = req.user?.id;

    if (!userId || !tenant_id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Check if user is admin (support both super_admin with NULL tenant_id and chapter_admin)
    const { data: userRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role, tenant_id")
      .eq("user_id", userId);

    const hasAccess = userRoles?.some(r => 
      r.role === "super_admin" || 
      (r.tenant_id === tenant_id && ["chapter_admin", "super_admin"].includes(r.role))
    );

    if (!hasAccess) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const { data: requests, error } = await supabaseAdmin
      .from("chapter_join_requests")
      .select("*")
      .eq("tenant_id", tenant_id as string)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Enrich requests with user email and participant data
    const enrichedRequests = await Promise.all(
      (requests || []).map(async (request) => {
        // Get user email from auth.users
        let userEmail = null;
        try {
          const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(request.user_id);
          userEmail = authUser?.user?.email || null;
        } catch (emailError) {
          console.error(`Error fetching email for user ${request.user_id}:`, emailError);
        }

        // Get participant data if exists
        let participantData = null;
        try {
          const { data: participant } = await supabaseAdmin
            .from("participants")
            .select("full_name_th, nickname_th, company, position, phone, email, photo_url")
            .eq("user_id", request.user_id)
            .eq("tenant_id", tenant_id as string)
            .maybeSingle();
          
          participantData = participant;
        } catch (participantError) {
          console.error(`Error fetching participant for user ${request.user_id}:`, participantError);
        }

        // Get profile data as fallback if no participant
        let profileData = null;
        if (!participantData?.full_name_th) {
          try {
            const { data: profile } = await supabaseAdmin
              .from("profiles")
              .select("full_name, avatar_url, phone")
              .eq("id", request.user_id)
              .maybeSingle();
            
            profileData = profile;
          } catch (profileError) {
            console.error(`Error fetching profile for user ${request.user_id}:`, profileError);
          }
        }

        return {
          ...request,
          user_email: userEmail,
          participant: participantData,
          profile: profileData,
        };
      })
    );

    return res.status(200).json(enrichedRequests);

  } catch (error: any) {
    console.error("List join requests error:", error);
    return res.status(500).json({ error: error.message });
  }
});

// Approve/Reject join request (Admin only)
router.post("/join-request/:requestId/:action", verifySupabaseAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { requestId, action } = req.params;
    const userId = req.user?.id;

    if (!userId || !requestId || !["approve", "reject"].includes(action)) {
      return res.status(400).json({ error: "Invalid request" });
    }

    const { data: request, error: requestError } = await supabaseAdmin
      .from("chapter_join_requests")
      .select("*")
      .eq("request_id", requestId)
      .single();

    if (requestError || !request) {
      return res.status(404).json({ error: "Request not found" });
    }

    const { data: superAdminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .is("tenant_id", null)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!superAdminRole) {
      const { data: chapterAdminRole } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("tenant_id", request.tenant_id)
        .eq("role", "chapter_admin")
        .maybeSingle();

      if (!chapterAdminRole) {
        return res.status(403).json({ error: "Not authorized" });
      }
    }

    if (request.status !== "pending") {
      return res.status(400).json({ error: "คำขอนี้ได้รับการดำเนินการแล้ว" });
    }

    // Check member limit before approving
    if (action === "approve") {
      const limitCheck = await subscriptionService.checkLimitExceeded(request.tenant_id, 'members');
      if (limitCheck.exceeded) {
        console.log(`[join-request] Member limit exceeded for tenant ${request.tenant_id}: ${limitCheck.current}/${limitCheck.limit}`);
        return res.status(403).json({ 
          success: false,
          error: "LIMIT_EXCEEDED",
          message: `Chapter มีสมาชิกครบ ${limitCheck.limit} คนแล้ว กรุณาอัพเกรดแพลนเพื่อเพิ่มสมาชิก`,
          current: limitCheck.current,
          limit: limitCheck.limit
        });
      }
    }

    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("tenant_name")
      .eq("tenant_id", request.tenant_id)
      .single();

    const isParticipantRequest = !!request.participant_id;

    if (isParticipantRequest) {
      if (action === "approve") {
        const result = await approveMember({
          participantId: request.participant_id,
          tenantId: request.tenant_id,
          approvedBy: userId
        });

        if (!result.success) {
          return res.status(500).json({ error: result.error || "Failed to approve" });
        }

        if (result.participant?.line_user_id) {
          await sendApprovalNotificationToApplicant(
            request.tenant_id,
            result.participant.line_user_id,
            tenant?.tenant_name || "Chapter"
          );
        }
      } else {
        const result = await rejectMember({
          participantId: request.participant_id,
          tenantId: request.tenant_id,
          approvedBy: userId
        });

        if (!result.success) {
          return res.status(500).json({ error: result.error || "Failed to reject" });
        }

        if (result.participant?.line_user_id) {
          await sendRejectionNotificationToApplicant(request.tenant_id, result.participant.line_user_id);
        }
      }
    } else if (request.user_id) {
      if (action === "approve") {
        const { data: existingProfile } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("id", request.user_id)
          .single();

        if (!existingProfile) {
          await supabaseAdmin
            .from("profiles")
            .insert({ id: request.user_id });
        }

        const { error: roleError } = await supabaseAdmin
          .from("user_roles")
          .insert({
            user_id: request.user_id,
            tenant_id: request.tenant_id,
            role: "member",
          });

        if (roleError) {
          console.error("Error assigning member role:", roleError);
          return res.status(500).json({ error: "Failed to approve request" });
        }

        const participantResult = await syncUserToParticipants({
          user_id: request.user_id,
          tenant_id: request.tenant_id,
          role: "member",
        });

        if (!participantResult.success) {
          console.error("Error syncing participant:", participantResult.error);
          await supabaseAdmin.from("user_roles")
            .delete()
            .eq("user_id", request.user_id)
            .eq("tenant_id", request.tenant_id);

          return res.status(500).json({ 
            error: "Failed to create participant record",
            message: participantResult.error
          });
        }

        const { error: updateError } = await supabaseAdmin
          .from("chapter_join_requests")
          .update({
            status: "approved",
            approved_by: userId,
            approved_at: new Date().toISOString(),
          })
          .eq("request_id", requestId);

        if (updateError) throw updateError;
      } else {
        const { error: updateError } = await supabaseAdmin
          .from("chapter_join_requests")
          .update({
            status: "rejected",
            approved_by: userId,
            approved_at: new Date().toISOString(),
          })
          .eq("request_id", requestId);

        if (updateError) throw updateError;
      }
    }

    return res.status(200).json({
      success: true,
      message: action === "approve" ? "อนุมัติสำเร็จ" : "ปฏิเสธสำเร็จ",
    });

  } catch (error: any) {
    console.error("Join request action error:", error);
    return res.status(500).json({ error: error.message });
  }
});

// Performance Metrics Dashboard API
router.get("/:tenantId/performance-metrics", verifySupabaseAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { tenantId } = req.params;
    const { period = "current_month" } = req.query;

    // Calculate date ranges based on period
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    let currentPeriodStart: Date;
    let currentPeriodEnd: Date;
    let previousPeriodStart: Date;
    let previousPeriodEnd: Date;

    switch (period) {
      case "last_3_months":
        currentPeriodStart = new Date(currentYear, currentMonth - 2, 1);
        currentPeriodEnd = new Date(currentYear, currentMonth + 1, 0);
        previousPeriodStart = new Date(currentYear, currentMonth - 5, 1);
        previousPeriodEnd = new Date(currentYear, currentMonth - 2, 0);
        break;
      case "last_6_months":
        currentPeriodStart = new Date(currentYear, currentMonth - 5, 1);
        currentPeriodEnd = new Date(currentYear, currentMonth + 1, 0);
        previousPeriodStart = new Date(currentYear, currentMonth - 11, 1);
        previousPeriodEnd = new Date(currentYear, currentMonth - 5, 0);
        break;
      default: // current_month
        currentPeriodStart = new Date(currentYear, currentMonth, 1);
        currentPeriodEnd = new Date(currentYear, currentMonth + 1, 0);
        previousPeriodStart = new Date(currentYear, currentMonth - 1, 1);
        previousPeriodEnd = new Date(currentYear, currentMonth, 0);
    }

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    // Get total members count
    const { data: membersData, error: membersError } = await supabaseAdmin
      .from("participants")
      .select("participant_id", { count: "exact" })
      .eq("tenant_id", tenantId)
      .eq("status", "member");

    if (membersError) throw membersError;
    const totalMembers = membersData?.length || 0;

    // Get meetings in current period
    const { data: currentMeetings, error: meetingsError } = await supabaseAdmin
      .from("meetings")
      .select("meeting_id, meeting_date, meeting_name")
      .eq("tenant_id", tenantId)
      .gte("meeting_date", formatDate(currentPeriodStart))
      .lte("meeting_date", formatDate(currentPeriodEnd))
      .order("meeting_date", { ascending: false });

    if (meetingsError) throw meetingsError;

    // Get meetings in previous period for comparison
    const { data: previousMeetings } = await supabaseAdmin
      .from("meetings")
      .select("meeting_id")
      .eq("tenant_id", tenantId)
      .gte("meeting_date", formatDate(previousPeriodStart))
      .lte("meeting_date", formatDate(previousPeriodEnd));

    const currentMeetingIds = currentMeetings?.map(m => m.meeting_id) || [];
    const previousMeetingIds = previousMeetings?.map(m => m.meeting_id) || [];

    // Current period attendance stats
    let currentAttendance = { checkedIn: 0, onTime: 0, late: 0, substitutes: 0 };
    let previousAttendance = { checkedIn: 0, onTime: 0, late: 0, substitutes: 0 };

    if (currentMeetingIds.length > 0) {
      // Get check-ins for current period
      const { data: checkins } = await supabaseAdmin
        .from("checkins")
        .select("checkin_id, is_late, participant_id")
        .eq("tenant_id", tenantId)
        .in("meeting_id", currentMeetingIds);

      // Filter by members only
      const { data: memberParticipants } = await supabaseAdmin
        .from("participants")
        .select("participant_id")
        .eq("tenant_id", tenantId)
        .eq("status", "member");

      const memberIds = new Set(memberParticipants?.map(p => p.participant_id) || []);
      const memberCheckins = checkins?.filter(c => memberIds.has(c.participant_id)) || [];

      currentAttendance.checkedIn = memberCheckins.length;
      currentAttendance.onTime = memberCheckins.filter(c => !c.is_late).length;
      currentAttendance.late = memberCheckins.filter(c => c.is_late).length;

      // Get substitutes
      const { data: subs } = await supabaseAdmin
        .from("substitute_requests")
        .select("request_id")
        .eq("tenant_id", tenantId)
        .eq("status", "confirmed")
        .in("meeting_id", currentMeetingIds);

      currentAttendance.substitutes = subs?.length || 0;
    }

    if (previousMeetingIds.length > 0) {
      const { data: prevCheckins } = await supabaseAdmin
        .from("checkins")
        .select("checkin_id, is_late, participant_id")
        .eq("tenant_id", tenantId)
        .in("meeting_id", previousMeetingIds);

      const { data: memberParticipants } = await supabaseAdmin
        .from("participants")
        .select("participant_id")
        .eq("tenant_id", tenantId)
        .eq("status", "member");

      const memberIds = new Set(memberParticipants?.map(p => p.participant_id) || []);
      const memberCheckins = prevCheckins?.filter(c => memberIds.has(c.participant_id)) || [];

      previousAttendance.checkedIn = memberCheckins.length;
      previousAttendance.onTime = memberCheckins.filter(c => !c.is_late).length;
      previousAttendance.late = memberCheckins.filter(c => c.is_late).length;

      const { data: prevSubs } = await supabaseAdmin
        .from("substitute_requests")
        .select("request_id")
        .eq("tenant_id", tenantId)
        .eq("status", "confirmed")
        .in("meeting_id", previousMeetingIds);

      previousAttendance.substitutes = prevSubs?.length || 0;
    }

    // Visitor conversion stats for current period
    let currentVisitor = { registered: 0, checkedIn: 0, converted: 0 };
    let previousVisitor = { registered: 0, checkedIn: 0, converted: 0 };

    if (currentMeetingIds.length > 0) {
      const { data: registrations } = await supabaseAdmin
        .from("meeting_registrations")
        .select("participant_id, meeting_id")
        .in("meeting_id", currentMeetingIds);

      currentVisitor.registered = registrations?.length || 0;

      // Check which visitors checked in
      if (registrations && registrations.length > 0) {
        const regParticipantIds = registrations.map(r => r.participant_id);
        
        const { data: visitorCheckins } = await supabaseAdmin
          .from("checkins")
          .select("participant_id")
          .eq("tenant_id", tenantId)
          .in("meeting_id", currentMeetingIds)
          .in("participant_id", regParticipantIds);

        currentVisitor.checkedIn = visitorCheckins?.length || 0;

        // Check converted (now members)
        const { data: convertedMembers } = await supabaseAdmin
          .from("participants")
          .select("participant_id")
          .eq("tenant_id", tenantId)
          .eq("status", "member")
          .in("participant_id", regParticipantIds);

        currentVisitor.converted = convertedMembers?.length || 0;
      }
    }

    if (previousMeetingIds.length > 0) {
      const { data: prevRegistrations } = await supabaseAdmin
        .from("meeting_registrations")
        .select("participant_id, meeting_id")
        .in("meeting_id", previousMeetingIds);

      previousVisitor.registered = prevRegistrations?.length || 0;

      if (prevRegistrations && prevRegistrations.length > 0) {
        const prevRegParticipantIds = prevRegistrations.map(r => r.participant_id);
        
        const { data: prevVisitorCheckins } = await supabaseAdmin
          .from("checkins")
          .select("participant_id")
          .eq("tenant_id", tenantId)
          .in("meeting_id", previousMeetingIds)
          .in("participant_id", prevRegParticipantIds);

        previousVisitor.checkedIn = prevVisitorCheckins?.length || 0;

        const { data: prevConvertedMembers } = await supabaseAdmin
          .from("participants")
          .select("participant_id")
          .eq("tenant_id", tenantId)
          .eq("status", "member")
          .in("participant_id", prevRegParticipantIds);

        previousVisitor.converted = prevConvertedMembers?.length || 0;
      }
    }

    // Calculate rates
    const expectedAttendance = totalMembers * currentMeetingIds.length;
    const prevExpectedAttendance = totalMembers * previousMeetingIds.length;

    const currentAttendanceRate = expectedAttendance > 0 
      ? Math.round(((currentAttendance.checkedIn + currentAttendance.substitutes) / expectedAttendance) * 100) 
      : 0;
    const previousAttendanceRate = prevExpectedAttendance > 0 
      ? Math.round(((previousAttendance.checkedIn + previousAttendance.substitutes) / prevExpectedAttendance) * 100) 
      : 0;

    const currentConversionRate = currentVisitor.registered > 0 
      ? Math.round((currentVisitor.converted / currentVisitor.registered) * 100) 
      : 0;
    const previousConversionRate = previousVisitor.registered > 0 
      ? Math.round((previousVisitor.converted / previousVisitor.registered) * 100) 
      : 0;

    const currentCheckinRate = currentVisitor.registered > 0 
      ? Math.round((currentVisitor.checkedIn / currentVisitor.registered) * 100) 
      : 0;

    // Get monthly trend data (last 6 months)
    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(currentYear, currentMonth - i, 1);
      const monthEnd = new Date(currentYear, currentMonth - i + 1, 0);
      
      const { data: monthMeetings } = await supabaseAdmin
        .from("meetings")
        .select("meeting_id")
        .eq("tenant_id", tenantId)
        .gte("meeting_date", formatDate(monthStart))
        .lte("meeting_date", formatDate(monthEnd));

      const monthMeetingIds = monthMeetings?.map(m => m.meeting_id) || [];
      let monthAttendanceRate = 0;
      let monthVisitorConversion = 0;

      if (monthMeetingIds.length > 0) {
        const { data: monthCheckins } = await supabaseAdmin
          .from("checkins")
          .select("participant_id")
          .eq("tenant_id", tenantId)
          .in("meeting_id", monthMeetingIds);

        const { data: monthSubs } = await supabaseAdmin
          .from("substitute_requests")
          .select("request_id")
          .eq("tenant_id", tenantId)
          .eq("status", "confirmed")
          .in("meeting_id", monthMeetingIds);

        const { data: memberParticipants } = await supabaseAdmin
          .from("participants")
          .select("participant_id")
          .eq("tenant_id", tenantId)
          .eq("status", "member");

        const memberIds = new Set(memberParticipants?.map(p => p.participant_id) || []);
        const memberMonthCheckins = monthCheckins?.filter(c => memberIds.has(c.participant_id)).length || 0;

        const monthExpected = totalMembers * monthMeetingIds.length;
        monthAttendanceRate = monthExpected > 0 
          ? Math.round(((memberMonthCheckins + (monthSubs?.length || 0)) / monthExpected) * 100) 
          : 0;

        // Visitor conversion
        const { data: monthRegs } = await supabaseAdmin
          .from("meeting_registrations")
          .select("participant_id")
          .in("meeting_id", monthMeetingIds);

        if (monthRegs && monthRegs.length > 0) {
          const regIds = monthRegs.map(r => r.participant_id);
          const { data: converted } = await supabaseAdmin
            .from("participants")
            .select("participant_id")
            .eq("tenant_id", tenantId)
            .eq("status", "member")
            .in("participant_id", regIds);

          monthVisitorConversion = monthRegs.length > 0 
            ? Math.round(((converted?.length || 0) / monthRegs.length) * 100) 
            : 0;
        }
      }

      monthlyTrend.push({
        month: monthStart.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' }),
        attendanceRate: monthAttendanceRate,
        visitorConversionRate: monthVisitorConversion,
        meetings: monthMeetingIds.length,
      });
    }

    return res.json({
      summary: {
        totalMembers,
        meetingsInPeriod: currentMeetingIds.length,
        attendanceRate: currentAttendanceRate,
        attendanceRateChange: currentAttendanceRate - previousAttendanceRate,
        visitorConversionRate: currentConversionRate,
        visitorConversionRateChange: currentConversionRate - previousConversionRate,
        visitorCheckinRate: currentCheckinRate,
      },
      attendance: {
        current: currentAttendance,
        previous: previousAttendance,
        onTimeRate: currentAttendance.checkedIn > 0 
          ? Math.round((currentAttendance.onTime / currentAttendance.checkedIn) * 100) 
          : 0,
      },
      visitors: {
        current: currentVisitor,
        previous: previousVisitor,
        funnel: {
          registered: currentVisitor.registered,
          checkedIn: currentVisitor.checkedIn,
          converted: currentVisitor.converted,
        },
      },
      monthlyTrend,
      period: {
        current: {
          start: formatDate(currentPeriodStart),
          end: formatDate(currentPeriodEnd),
        },
        previous: {
          start: formatDate(previousPeriodStart),
          end: formatDate(previousPeriodEnd),
        },
      },
    });

  } catch (error: any) {
    console.error("Performance metrics error:", error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
