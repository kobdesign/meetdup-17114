import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, MapPin, Clock, Repeat } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { th } from "date-fns/locale";
import { Meeting, RecurringMeetingInstance, getAllMeetingsInRange } from "@/lib/meetingUtils";
import { useNavigate } from "react-router-dom";

interface MeetingsCalendarProps {
  meetings: Meeting[];
}

export default function MeetingsCalendar({ meetings }: MeetingsCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const navigate = useNavigate();

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  
  // Get all meetings including recurring instances for this month
  const allMeetings = getAllMeetingsInRange(meetings, calendarStart, calendarEnd);

  const getMeetingsForDate = (date: Date) => {
    return allMeetings.filter((meeting) => {
      const meetingDate = 'instance_date' in meeting 
        ? new Date(meeting.instance_date)
        : new Date(meeting.meeting_date);
      return isSameDay(meetingDate, date);
    });
  };

  const handlePrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleMeetingClick = (meeting: Meeting | RecurringMeetingInstance) => {
    const meetingId = 'original_meeting_id' in meeting 
      ? meeting.original_meeting_id 
      : meeting.meeting_id;
    navigate(`/admin/meetings/${meetingId}`);
  };

  const weekDays = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            {format(currentMonth, "MMMM yyyy", { locale: th })}
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={handlePrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-2">
          {/* Week day headers */}
          {weekDays.map((day) => (
            <div key={day} className="text-center font-semibold text-sm text-muted-foreground py-2">
              {day}
            </div>
          ))}

          {/* Calendar days */}
          {calendarDays.map((day) => {
            const dayMeetings = getMeetingsForDate(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={day.toString()}
                className={`min-h-[100px] border rounded-lg p-2 ${
                  isCurrentMonth ? "bg-background" : "bg-muted/20"
                } ${isToday ? "border-primary ring-1 ring-primary" : ""}`}
              >
                <div className={`text-sm font-medium mb-1 ${
                  isToday ? "text-primary font-bold" : isCurrentMonth ? "text-foreground" : "text-muted-foreground"
                }`}>
                  {format(day, "d")}
                </div>
                
                <div className="space-y-1">
                  {dayMeetings.map((meeting, idx) => {
                    const isRecurring = 'is_recurring_instance' in meeting && meeting.is_recurring_instance;
                    return (
                      <div
                        key={`${meeting.meeting_id}-${idx}`}
                        onClick={() => handleMeetingClick(meeting)}
                        className="text-xs p-1.5 rounded bg-primary/10 hover:bg-primary/20 cursor-pointer transition-colors border-l-2 border-primary"
                      >
                        <div className="flex items-center gap-1">
                          {isRecurring && (
                            <Repeat className="h-3 w-3 text-primary flex-shrink-0" />
                          )}
                          {meeting.meeting_time && (
                            <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          )}
                          <span className="font-medium truncate">
                            {meeting.meeting_time || "ไม่ระบุเวลา"}
                          </span>
                        </div>
                        {meeting.venue && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <span className="text-muted-foreground truncate">{meeting.venue}</span>
                          </div>
                        )}
                        {meeting.theme && (
                          <div className="mt-0.5 text-muted-foreground truncate">
                            {meeting.theme}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded border-2 border-primary"></div>
            <span>วันนี้</span>
          </div>
          <div className="flex items-center gap-2">
            <Repeat className="h-3 w-3" />
            <span>การประชุมซ้ำ</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
