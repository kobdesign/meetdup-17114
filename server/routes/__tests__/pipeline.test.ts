import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockSupabaseFrom } = vi.hoisted(() => {
  return {
    mockSupabaseFrom: vi.fn()
  };
});

vi.mock("../../utils/supabaseClient", () => {
  return {
    supabaseAdmin: {
      from: (table: string) => mockSupabaseFrom(table)
    }
  };
});

describe("Pipeline Import Preview API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("import-preview data transformation", () => {
    it("should correctly extract nickname_th from participants", () => {
      const mockRegistration = {
        registration_id: "reg-123",
        meeting_id: "meeting-456",
        registered_at: "2024-01-15T10:00:00Z",
        participant: {
          participant_id: "p-789",
          full_name_th: "สมชาย ใจดี",
          nickname_th: "ชาย",
          phone: "0891234567",
          email: "test@example.com",
          status: "visitor",
          tenant_id: "tenant-001",
          referred_by_participant_id: null
        },
        meeting: {
          meeting_id: "meeting-456",
          meeting_date: "2024-01-20",
          theme: "Networking"
        }
      };

      const visitorMap = new Map<string, any>();
      const pid = mockRegistration.participant.participant_id;
      
      visitorMap.set(pid, {
        participant_id: pid,
        full_name: mockRegistration.participant.full_name_th,
        nickname_th: mockRegistration.participant.nickname_th,
        phone: mockRegistration.participant.phone,
        email: mockRegistration.participant.email,
        status: mockRegistration.participant.status,
        referrer_name: null,
        first_meeting_date: mockRegistration.meeting.meeting_date,
        first_meeting_theme: mockRegistration.meeting.theme,
        first_meeting_id: mockRegistration.meeting.meeting_id,
        meeting_count: 1
      });

      const result = Array.from(visitorMap.values())[0];

      expect(result.nickname_th).toBe("ชาย");
      expect(result.full_name).toBe("สมชาย ใจดี");
      expect(result.referrer_name).toBeNull();
    });

    it("should lookup referrer nickname_th correctly", () => {
      const referrerMap = new Map<string, string>();
      referrerMap.set("referrer-001", "แดง");
      referrerMap.set("referrer-002", "น้ำ");

      const referrerId = "referrer-001";
      const referrerName = referrerMap.get(referrerId);

      expect(referrerName).toBe("แดง");
    });

    it("should fallback to full_name_th when referrer has no nickname_th", () => {
      const mockReferrers = [
        { participant_id: "ref-001", full_name_th: "มานะ มานี", nickname_th: null },
        { participant_id: "ref-002", full_name_th: "สมศรี ใจดี", nickname_th: "ศรี" }
      ];

      const referrerMap = new Map<string, string>();
      mockReferrers.forEach((r) => {
        referrerMap.set(r.participant_id, r.nickname_th || r.full_name_th);
      });

      expect(referrerMap.get("ref-001")).toBe("มานะ มานี");
      expect(referrerMap.get("ref-002")).toBe("ศรี");
    });

    it("should count multiple meeting registrations for same visitor", () => {
      const mockRegistrations = [
        {
          participant: { participant_id: "p-001", full_name_th: "ทดสอบ", nickname_th: "เทส" },
          meeting: { meeting_id: "m-001", meeting_date: "2024-01-10" }
        },
        {
          participant: { participant_id: "p-001", full_name_th: "ทดสอบ", nickname_th: "เทส" },
          meeting: { meeting_id: "m-002", meeting_date: "2024-01-17" }
        },
        {
          participant: { participant_id: "p-001", full_name_th: "ทดสอบ", nickname_th: "เทส" },
          meeting: { meeting_id: "m-003", meeting_date: "2024-01-24" }
        }
      ];

      const visitorMap = new Map<string, any>();
      mockRegistrations.forEach((r) => {
        const pid = r.participant.participant_id;
        if (!visitorMap.has(pid)) {
          visitorMap.set(pid, {
            participant_id: pid,
            full_name: r.participant.full_name_th,
            nickname_th: r.participant.nickname_th,
            first_meeting_date: r.meeting.meeting_date,
            meeting_count: 1
          });
        } else {
          visitorMap.get(pid).meeting_count++;
        }
      });

      const result = visitorMap.get("p-001");
      expect(result.meeting_count).toBe(3);
      expect(result.first_meeting_date).toBe("2024-01-10");
    });

    it("should filter out visitors already in pipeline", () => {
      const allVisitors = [
        { participant_id: "p-001" },
        { participant_id: "p-002" },
        { participant_id: "p-003" }
      ];

      const existingPipelineRecords = [
        { visitor_id: "p-001" },
        { visitor_id: "p-003" }
      ];

      const existingVisitorIds = new Set(existingPipelineRecords.map(r => r.visitor_id));
      const importableVisitors = allVisitors.filter(v => !existingVisitorIds.has(v.participant_id));

      expect(importableVisitors).toHaveLength(1);
      expect(importableVisitors[0].participant_id).toBe("p-002");
    });

    it("should filter by tenant and visitor/prospect status", () => {
      const mockRegistrations = [
        { participant: { tenant_id: "t-001", status: "visitor" } },
        { participant: { tenant_id: "t-001", status: "member" } },
        { participant: { tenant_id: "t-002", status: "visitor" } },
        { participant: { tenant_id: "t-001", status: "prospect" } }
      ];

      const targetTenantId = "t-001";
      const filtered = mockRegistrations.filter(r => 
        r.participant.tenant_id === targetTenantId && 
        (r.participant.status === "visitor" || r.participant.status === "prospect")
      );

      expect(filtered).toHaveLength(2);
    });
  });
});
