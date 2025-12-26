import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockPushMessage, mockSupabaseFrom } = vi.hoisted(() => {
  return {
    mockPushMessage: vi.fn().mockResolvedValue(undefined),
    mockSupabaseFrom: vi.fn()
  };
});

vi.mock("../line/lineClient", () => {
  return {
    LineClient: class MockLineClient {
      pushMessage = mockPushMessage;
    }
  };
});

vi.mock("../line/credentials", () => {
  return {
    getLineCredentials: vi.fn().mockResolvedValue({
      channelAccessToken: "mock-access-token"
    })
  };
});

vi.mock("../../utils/supabaseClient", () => {
  return {
    supabaseAdmin: {
      from: (table: string) => mockSupabaseFrom(table)
    }
  };
});

import { 
  notifyAdminsNewApplication, 
  getAdminLineUserIds,
  broadcastToAdmins,
  sendApprovalNotificationToApplicant,
  sendRejectionNotificationToApplicant
} from "../memberApprovalService";

describe("LINE Notification Tests for Visitor Application Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getAdminLineUserIds", () => {
    it("should return empty array when no admin roles found", async () => {
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null })
          })
        })
      });

      const result = await getAdminLineUserIds("test-tenant-id");
      expect(result).toEqual([]);
    });

    it("should return LINE user IDs of admins", async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "user_roles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [{ user_id: "admin-user-1" }, { user_id: "admin-user-2" }],
                  error: null
                })
              })
            })
          };
        }
        if (table === "participants") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  not: vi.fn().mockResolvedValue({
                    data: [
                      { line_user_id: "U1234567890" },
                      { line_user_id: "U0987654321" }
                    ],
                    error: null
                  })
                })
              })
            })
          };
        }
        return {};
      });

      const result = await getAdminLineUserIds("test-tenant-id");
      expect(result).toEqual(["U1234567890", "U0987654321"]);
    });
  });

  describe("notifyAdminsNewApplication", () => {
    it("should send flex message to all admins when visitor applies", async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "user_roles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [{ user_id: "admin-user-1" }],
                  error: null
                })
              })
            })
          };
        }
        if (table === "participants") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  not: vi.fn().mockResolvedValue({
                    data: [{ line_user_id: "Uadmin123" }],
                    error: null
                  })
                })
              })
            })
          };
        }
        return {};
      });

      await notifyAdminsNewApplication(
        "tenant-123",
        {
          participant_id: "participant-456",
          full_name_th: "สมชาย ใจดี",
          nickname_th: "ชาย",
          phone: "0891234567",
          company: "บริษัท ABC จำกัด"
        },
        "BNI The World"
      );

      expect(mockPushMessage).toHaveBeenCalledTimes(1);
      expect(mockPushMessage).toHaveBeenCalledWith(
        "Uadmin123",
        expect.objectContaining({
          type: "flex",
          altText: "คำขอสมัครสมาชิกใหม่: สมชาย ใจดี"
        })
      );

      const flexMessage = mockPushMessage.mock.calls[0][1];
      expect(flexMessage.contents.body.contents[0].text).toBe("สมชาย ใจดี");
      
      expect(flexMessage.contents.footer.contents).toHaveLength(2);
      expect(flexMessage.contents.footer.contents[0].action.label).toBe("อนุมัติ");
      expect(flexMessage.contents.footer.contents[1].action.label).toBe("ปฏิเสธ");
      
      expect(flexMessage.contents.footer.contents[0].action.data).toContain("action=approve_member");
      expect(flexMessage.contents.footer.contents[0].action.data).toContain("participant_id=participant-456");
    });

    it("should send to multiple admins when there are multiple", async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "user_roles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [{ user_id: "admin-1" }, { user_id: "admin-2" }],
                  error: null
                })
              })
            })
          };
        }
        if (table === "participants") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  not: vi.fn().mockResolvedValue({
                    data: [
                      { line_user_id: "UadminA" },
                      { line_user_id: "UadminB" }
                    ],
                    error: null
                  })
                })
              })
            })
          };
        }
        return {};
      });

      await notifyAdminsNewApplication(
        "tenant-123",
        {
          participant_id: "p-123",
          full_name_th: "ทดสอบ"
        },
        "Test Chapter"
      );

      expect(mockPushMessage).toHaveBeenCalledTimes(2);
      expect(mockPushMessage).toHaveBeenCalledWith("UadminA", expect.any(Object));
      expect(mockPushMessage).toHaveBeenCalledWith("UadminB", expect.any(Object));
    });

    it("should not send notification when no admins found", async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "user_roles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [],
                  error: null
                })
              })
            })
          };
        }
        return {};
      });

      await notifyAdminsNewApplication(
        "tenant-123",
        { participant_id: "p-1", full_name_th: "Test" },
        "Chapter"
      );

      expect(mockPushMessage).not.toHaveBeenCalled();
    });
  });

  describe("broadcastToAdmins", () => {
    it("should send text message to all admins except sender", async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "user_roles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [{ user_id: "admin-1" }, { user_id: "admin-2" }],
                  error: null
                })
              })
            })
          };
        }
        if (table === "participants") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  not: vi.fn().mockResolvedValue({
                    data: [
                      { line_user_id: "UsenderAdmin" },
                      { line_user_id: "UotherAdmin" }
                    ],
                    error: null
                  })
                })
              })
            })
          };
        }
        return {};
      });

      await broadcastToAdmins(
        "tenant-123",
        "Admin A อนุมัติ สมชาย เป็นสมาชิกแล้ว",
        "UsenderAdmin"
      );

      expect(mockPushMessage).toHaveBeenCalledTimes(1);
      expect(mockPushMessage).toHaveBeenCalledWith(
        "UotherAdmin",
        { type: "text", text: "Admin A อนุมัติ สมชาย เป็นสมาชิกแล้ว" }
      );
    });
  });

  describe("sendApprovalNotificationToApplicant", () => {
    it("should send approval flex message to applicant", async () => {
      await sendApprovalNotificationToApplicant(
        "tenant-123",
        "UapplicantLineId",
        "BNI The World"
      );

      expect(mockPushMessage).toHaveBeenCalledTimes(1);
      expect(mockPushMessage).toHaveBeenCalledWith(
        "UapplicantLineId",
        expect.objectContaining({
          type: "flex",
          altText: "ยินดีต้อนรับเข้าเป็นสมาชิก!"
        })
      );

      const flexMessage = mockPushMessage.mock.calls[0][1];
      expect(flexMessage.contents.body.contents[0].text).toBe("ยินดีต้อนรับ!");
      expect(flexMessage.contents.body.contents[3].text).toBe("BNI The World");
    });
  });

  describe("sendRejectionNotificationToApplicant", () => {
    it("should send rejection message to applicant", async () => {
      await sendRejectionNotificationToApplicant(
        "tenant-123",
        "UapplicantLineId"
      );

      expect(mockPushMessage).toHaveBeenCalledTimes(1);
      expect(mockPushMessage).toHaveBeenCalledWith(
        "UapplicantLineId",
        expect.objectContaining({
          type: "text"
        })
      );

      const message = mockPushMessage.mock.calls[0][1];
      expect(message.text).toContain("ไม่ได้รับการอนุมัติ");
    });
  });
});
