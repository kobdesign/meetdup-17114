import { addDays, addWeeks, addMonths, addYears, isAfter, isBefore, format, getDay } from "date-fns";

export interface Meeting {
  meeting_id: string;
  meeting_date: string;
  meeting_time?: string;
  venue?: string;
  location_details?: string;
  location_lat?: number;
  location_lng?: number;
  theme?: string;
  visitor_fee?: number;
  recurrence_pattern?: string;
  recurrence_interval?: number;
  recurrence_end_date?: string;
  recurrence_days_of_week?: string[];
  recurrence_end_type?: "never" | "date" | "count";
  recurrence_occurrence_count?: number;
  parent_meeting_id?: string | null;
  tenant_id: string;
  created_at?: string;
}

export interface RecurringMeetingInstance extends Meeting {
  original_meeting_id: string;
  instance_date: string;
  is_recurring_instance: boolean;
}

const dayNameToNumber: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

/**
 * Generate all recurring meeting instances based on recurrence pattern
 */
export function generateRecurringMeetings(meeting: Meeting): RecurringMeetingInstance[] {
  const instances: RecurringMeetingInstance[] = [];
  
  if (!meeting.recurrence_pattern || meeting.recurrence_pattern === "none") {
    return instances;
  }

  const startDate = new Date(meeting.meeting_date);
  
  // Determine end condition
  let maxOccurrences: number | null = null;
  let endDate: Date | null = null;
  
  if (meeting.recurrence_end_type === "count" && meeting.recurrence_occurrence_count) {
    maxOccurrences = meeting.recurrence_occurrence_count;
  } else if (meeting.recurrence_end_type === "date" && meeting.recurrence_end_date) {
    endDate = new Date(meeting.recurrence_end_date);
  } else {
    // Default: 1 year if "never" or no end type specified
    endDate = addYears(startDate, 1);
  }
  
  const interval = meeting.recurrence_interval || 1;
  let currentDate = new Date(startDate);
  let count = 1;  // นับ original meeting เป็นครั้งที่ 1 แล้ว

  // Generate instances
  currentDate = getNextOccurrence(currentDate, meeting.recurrence_pattern, interval, meeting.recurrence_days_of_week);

  while (true) {
    // Check if we've reached max occurrences
    if (maxOccurrences !== null && count >= maxOccurrences) {
      break;
    }
    
    // Check if we've passed end date
    if (endDate && isAfter(currentDate, endDate)) {
      break;
    }

    instances.push({
      ...meeting,
      original_meeting_id: meeting.meeting_id,
      instance_date: format(currentDate, "yyyy-MM-dd"),
      is_recurring_instance: true,
    });

    count++;
    currentDate = getNextOccurrence(currentDate, meeting.recurrence_pattern, interval, meeting.recurrence_days_of_week);
  }

  return instances;
}

/**
 * Calculate the next occurrence date based on pattern
 */
function getNextOccurrence(
  currentDate: Date,
  pattern: string,
  interval: number,
  daysOfWeek?: string[]
): Date {
  switch (pattern) {
    case "daily":
      return addDays(currentDate, interval);
    
    case "weekly":
      return addWeeks(currentDate, interval);
    
    case "monthly":
      return addMonths(currentDate, interval);
    
    case "yearly":
      return addYears(currentDate, interval);
    
    case "weekdays":
      let nextDay = addDays(currentDate, 1);
      while (getDay(nextDay) === 0 || getDay(nextDay) === 6) {
        nextDay = addDays(nextDay, 1);
      }
      return nextDay;
    
    case "custom":
      if (!daysOfWeek || daysOfWeek.length === 0) {
        return addWeeks(currentDate, interval);
      }
      
      // Start from next week (respect interval)
      let nextCustomDay = addWeeks(currentDate, interval);
      
      // Find the first matching day in the target week
      let attempts = 0;
      while (attempts < 7) {
        const dayNum = getDay(nextCustomDay);
        const dayName = Object.keys(dayNameToNumber).find(
          key => dayNameToNumber[key] === dayNum
        );
        if (dayName && daysOfWeek.includes(dayName)) {
          return nextCustomDay;
        }
        nextCustomDay = addDays(nextCustomDay, 1);
        attempts++;
      }
      
      // Fallback: add interval weeks
      return addWeeks(currentDate, interval);
    
    default:
      return addDays(currentDate, 1);
  }
}

/**
 * Format recurrence pattern to readable Thai text
 */
export function formatRecurrenceText(pattern: string, interval: number = 1): string {
  if (!pattern || pattern === "none") {
    return "ไม่มีการทำซ้ำ";
  }

  switch (pattern) {
    case "daily":
      return interval === 1 ? "ทุกวัน" : `ทุก ${interval} วัน`;
    case "weekly":
      return interval === 1 ? "ทุกสัปดาห์" : `ทุก ${interval} สัปดาห์`;
    case "monthly":
      return interval === 1 ? "ทุกเดือน" : `ทุก ${interval} เดือน`;
    case "yearly":
      return interval === 1 ? "ทุกปี" : `ทุก ${interval} ปี`;
    case "weekdays":
      return "ทุกวันจันทร์-ศุกร์";
    case "custom":
      return "กำหนดเอง";
    default:
      return "ไม่ทราบรูปแบบ";
  }
}

/**
 * Get the appropriate label for interval input based on pattern
 */
export function getRecurrenceIntervalLabel(pattern: string): string {
  switch (pattern) {
    case "daily":
      return "ทุกๆ กี่วัน";
    case "weekly":
      return "ทุกๆ กี่สัปดาห์";
    case "monthly":
      return "ทุกๆ กี่เดือน";
    case "yearly":
      return "ทุกๆ กี่ปี";
    default:
      return "ทุกๆ (ช่วง)";
  }
}

/**
 * Get example text for recurrence settings
 */
export function getRecurrenceExampleText(pattern: string, interval: number = 1): string {
  if (!pattern || pattern === "none") {
    return "";
  }

  const text = formatRecurrenceText(pattern, interval);
  return `การประชุมจะซ้ำ${text}`;
}

/**
 * Check if interval input should be shown for the pattern
 */
export function shouldShowIntervalInput(pattern: string): boolean {
  return pattern !== "none" && pattern !== "weekdays" && pattern !== "custom";
}

/**
 * Get all meetings including recurring instances for a date range
 */
export function getAllMeetingsInRange(
  meetings: Meeting[],
  startDate: Date,
  endDate: Date
): (Meeting | RecurringMeetingInstance)[] {
  const allMeetings: (Meeting | RecurringMeetingInstance)[] = [];

  meetings.forEach((meeting) => {
    const meetingDate = new Date(meeting.meeting_date);
    
    // Add original meeting if in range
    if (
      (isAfter(meetingDate, startDate) || meetingDate.getTime() === startDate.getTime()) &&
      (isBefore(meetingDate, endDate) || meetingDate.getTime() === endDate.getTime())
    ) {
      allMeetings.push(meeting);
    }

    // Add recurring instances
    if (meeting.recurrence_pattern && meeting.recurrence_pattern !== "none") {
      const instances = generateRecurringMeetings(meeting);
      instances.forEach((instance) => {
        const instanceDate = new Date(instance.instance_date);
        if (
          (isAfter(instanceDate, startDate) || instanceDate.getTime() === startDate.getTime()) &&
          (isBefore(instanceDate, endDate) || instanceDate.getTime() === endDate.getTime())
        ) {
          allMeetings.push(instance);
        }
      });
    }
  });

  return allMeetings;
}
