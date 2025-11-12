import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MeetingTemplate, MEETING_TEMPLATES } from "@/lib/meetingTemplates";
import { Check } from "lucide-react";

interface MeetingTemplateSelectorProps {
  onSelectTemplate: (template: MeetingTemplate) => void;
  selectedTemplateId?: string;
}

export default function MeetingTemplateSelector({ 
  onSelectTemplate,
  selectedTemplateId 
}: MeetingTemplateSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-medium">📋 เลือกเทมเพลตสำเร็จรูป</h4>
        <span className="text-xs text-muted-foreground">(ทางเลือก)</span>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {MEETING_TEMPLATES.map((template) => (
          <Card 
            key={template.id}
            className={`cursor-pointer transition-all hover:shadow-md hover:border-primary/50
                       ${selectedTemplateId === template.id ? 'ring-2 ring-primary border-primary' : ''}`}
            onClick={() => onSelectTemplate(template)}
          >
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <span className="text-lg">{template.emoji}</span>
                <span className="truncate flex-1">{template.name}</span>
                {selectedTemplateId === template.id && (
                  <Check className="h-4 w-4 text-primary shrink-0" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <CardDescription className="text-xs line-clamp-2">
                {template.description}
              </CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
