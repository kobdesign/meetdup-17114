import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, Repeat } from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";

interface RecurrenceConfig {
  pattern: string;
  interval: number;
  endDate: string;
  daysOfWeek: string[];
  endType: "never" | "date" | "count";
  occurrenceCount: number;
}

interface RecurrenceSelectorProps {
  value: RecurrenceConfig;
  onChange: (config: RecurrenceConfig) => void;
  meetingDate: string;
}

export default function RecurrenceSelector({ value, onChange, meetingDate }: RecurrenceSelectorProps) {
  const [showCustomDialog, setShowCustomDialog] = useState(false);
  const [tempConfig, setTempConfig] = useState<RecurrenceConfig>(value);

  const getRecurrenceLabel = () => {
    if (!value.pattern || value.pattern === "none") {
      return "ไม่ซ้ำ";
    }

    const meetingDateObj = new Date(meetingDate);
    const dayName = format(meetingDateObj, "EEEE", { locale: th });
    const dateNum = format(meetingDateObj, "d");

    switch (value.pattern) {
      case "daily":
        return value.interval === 1 ? "ทุกวัน" : `ทุก ${value.interval} วัน`;
      case "weekly":
        return value.interval === 1 
          ? `ทุกสัปดาห์ในวัน${dayName}` 
          : `ทุก ${value.interval} สัปดาห์ในวัน${dayName}`;
      case "monthly":
        return value.interval === 1
          ? `ทุกเดือนวันที่ ${dateNum}`
          : `ทุก ${value.interval} เดือนวันที่ ${dateNum}`;
      case "yearly":
        return value.interval === 1
          ? `ทุกปีในวันที่ ${format(meetingDateObj, "d MMMM", { locale: th })}`
          : `ทุก ${value.interval} ปีในวันที่ ${format(meetingDateObj, "d MMMM", { locale: th })}`;
      case "weekdays":
        return "ทุกวันจันทร์-ศุกร์";
      case "custom":
        return getCustomLabel();
      default:
        return "ไม่ซ้ำ";
    }
  };

  const getCustomLabel = () => {
    if (value.daysOfWeek && value.daysOfWeek.length > 0) {
      const dayLabels: Record<string, string> = {
        monday: "จ",
        tuesday: "อ",
        wednesday: "พ",
        thursday: "พฤ",
        friday: "ศ",
        saturday: "ส",
        sunday: "อา",
      };
      const days = value.daysOfWeek.map(d => dayLabels[d]).join(", ");
      return `กำหนดเอง: ${days}`;
    }
    return "กำหนดเอง";
  };

  const quickOptions = [
    { value: "none", label: "ไม่ซ้ำ" },
    { value: "daily", label: "ทุกวัน", interval: 1 },
    { value: "weekly", label: `ทุกสัปดาห์ในวัน${format(new Date(meetingDate), "EEEE", { locale: th })}`, interval: 1 },
    { value: "monthly", label: `ทุกเดือนวันที่ ${format(new Date(meetingDate), "d")}`, interval: 1 },
    { value: "yearly", label: `ทุกปีในวันที่ ${format(new Date(meetingDate), "d MMMM", { locale: th })}`, interval: 1 },
    { value: "weekdays", label: "ทุกวันจันทร์-ศุกร์", interval: 1 },
    { value: "custom", label: "กำหนดเอง...", interval: 1 },
  ];

  const handleQuickSelect = (optionValue: string, interval: number) => {
    if (optionValue === "custom") {
      setTempConfig(value);
      setShowCustomDialog(true);
    } else {
      onChange({
        ...value,
        pattern: optionValue,
        interval: interval,
        daysOfWeek: [],
      });
    }
  };

  const handleCustomSave = () => {
    onChange(tempConfig);
    setShowCustomDialog(false);
  };

  const dayOptions = [
    { value: "monday", label: "จันทร์" },
    { value: "tuesday", label: "อังคาร" },
    { value: "wednesday", label: "พุธ" },
    { value: "thursday", label: "พฤหัสบดี" },
    { value: "friday", label: "ศุกร์" },
    { value: "saturday", label: "เสาร์" },
    { value: "sunday", label: "อาทิตย์" },
  ];

  return (
    <>
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Repeat className="h-4 w-4" />
          การทำซ้ำ
        </Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span>{getRecurrenceLabel()}</span>
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <div className="p-1">
              {quickOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={value.pattern === option.value ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => handleQuickSelect(option.value, option.interval)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {value.pattern !== "none" && (
          <div className="text-sm text-muted-foreground pl-1">
            {value.endType === "never" && "ซ้ำตลอดไป"}
            {value.endType === "date" && value.endDate && `จนถึง ${format(new Date(value.endDate), "d MMMM yyyy", { locale: th })}`}
            {value.endType === "count" && `ทั้งหมด ${value.occurrenceCount} ครั้ง`}
          </div>
        )}
      </div>

      {/* Custom Recurrence Dialog */}
      <Dialog open={showCustomDialog} onOpenChange={setShowCustomDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>กำหนดการทำซ้ำเอง</DialogTitle>
            <DialogDescription>ตั้งค่าการทำซ้ำตามที่ต้องการ</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Repeat every */}
            <div className="flex items-center gap-2">
              <Label className="whitespace-nowrap">ซ้ำทุกๆ</Label>
              <Input
                type="number"
                min="1"
                value={tempConfig.interval}
                onChange={(e) => setTempConfig({ ...tempConfig, interval: parseInt(e.target.value) || 1 })}
                className="w-20"
              />
              <Select
                value={tempConfig.pattern === "custom" ? "weekly" : tempConfig.pattern}
                onValueChange={(val) => setTempConfig({ ...tempConfig, pattern: val })}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">วัน</SelectItem>
                  <SelectItem value="weekly">สัปดาห์</SelectItem>
                  <SelectItem value="monthly">เดือน</SelectItem>
                  <SelectItem value="yearly">ปี</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Repeat on (for weekly) */}
            {(tempConfig.pattern === "weekly" || tempConfig.pattern === "custom") && (
              <div className="space-y-2">
                <Label>ซ้ำในวัน</Label>
                <div className="grid grid-cols-2 gap-2">
                  {dayOptions.map((day) => (
                    <div key={day.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`custom_${day.value}`}
                        checked={tempConfig.daysOfWeek.includes(day.value)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setTempConfig({
                              ...tempConfig,
                              pattern: "custom",
                              daysOfWeek: [...tempConfig.daysOfWeek, day.value],
                            });
                          } else {
                            setTempConfig({
                              ...tempConfig,
                              daysOfWeek: tempConfig.daysOfWeek.filter((d) => d !== day.value),
                            });
                          }
                        }}
                      />
                      <Label htmlFor={`custom_${day.value}`} className="cursor-pointer text-sm">
                        {day.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ends */}
            <div className="space-y-3">
              <Label>สิ้นสุด</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="ends_never"
                    checked={tempConfig.endType === "never"}
                    onCheckedChange={(checked) => {
                      if (checked) setTempConfig({ ...tempConfig, endType: "never" });
                    }}
                  />
                  <Label htmlFor="ends_never" className="cursor-pointer">
                    ไม่สิ้นสุด
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="ends_date"
                    checked={tempConfig.endType === "date"}
                    onCheckedChange={(checked) => {
                      if (checked) setTempConfig({ ...tempConfig, endType: "date" });
                    }}
                  />
                  <Label htmlFor="ends_date" className="cursor-pointer">
                    ในวันที่
                  </Label>
                  <Input
                    type="date"
                    value={tempConfig.endDate}
                    onChange={(e) => setTempConfig({ ...tempConfig, endDate: e.target.value, endType: "date" })}
                    disabled={tempConfig.endType !== "date"}
                    className="flex-1"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="ends_count"
                    checked={tempConfig.endType === "count"}
                    onCheckedChange={(checked) => {
                      if (checked) setTempConfig({ ...tempConfig, endType: "count" });
                    }}
                  />
                  <Label htmlFor="ends_count" className="cursor-pointer">
                    หลังจาก
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    value={tempConfig.occurrenceCount}
                    onChange={(e) => setTempConfig({ ...tempConfig, occurrenceCount: parseInt(e.target.value) || 1, endType: "count" })}
                    disabled={tempConfig.endType !== "count"}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">ครั้ง</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCustomDialog(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleCustomSave}>บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
