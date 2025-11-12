import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface JsonEditorProps {
  id: string;
  label: string;
  value: Record<string, any> | string;
  onChange: (value: Record<string, any>) => void;
  placeholder?: string;
  hint?: string;
  disabled?: boolean;
}

const JsonEditor = ({ 
  id, 
  label, 
  value, 
  onChange, 
  placeholder = "{}",
  hint,
  disabled 
}: JsonEditorProps) => {
  const [textValue, setTextValue] = useState("");
  const [isValid, setIsValid] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  // Initialize from value prop
  useEffect(() => {
    if (value) {
      const jsonString = typeof value === 'string' 
        ? value 
        : JSON.stringify(value, null, 2);
      setTextValue(jsonString);
      setIsValid(true);
    }
  }, [value]);

  const handleChange = (newValue: string) => {
    setTextValue(newValue);
    
    // Validate JSON
    if (!newValue.trim()) {
      setIsValid(true);
      setErrorMessage("");
      onChange({});
      return;
    }

    try {
      const parsed = JSON.parse(newValue);
      setIsValid(true);
      setErrorMessage("");
      onChange(parsed);
    } catch (error) {
      setIsValid(false);
      setErrorMessage(error instanceof Error ? error.message : "Invalid JSON format");
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        value={textValue}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`font-mono text-sm min-h-[120px] ${!isValid ? 'border-destructive' : ''}`}
      />
      
      {!isValid && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {errorMessage}
          </AlertDescription>
        </Alert>
      )}
      
      {isValid && textValue.trim() && (
        <Alert>
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-xs text-green-600">
            Valid JSON format
          </AlertDescription>
        </Alert>
      )}
      
      {hint && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
};

export default JsonEditor;
