import { Input } from "@/components/ui/input";

interface AuthFieldProps {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  minLength?: number;
  maxLength?: number;
  labelExtra?: React.ReactNode;
}

export function AuthField({
  id,
  label,
  type,
  value,
  onChange,
  placeholder,
  required,
  autoComplete,
  inputMode,
  minLength,
  maxLength,
  onPaste,
  labelExtra,
}: AuthFieldProps) {
  return (
    <div>
      <div className={labelExtra ? "flex items-center justify-between mb-1.5" : "mb-1.5"}>
        <label
          htmlFor={id}
          className="block text-xs font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          {label}
        </label>
        {labelExtra}
      </div>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        inputMode={inputMode}
        minLength={minLength}
        maxLength={maxLength}
        onPaste={onPaste}
      />
    </div>
  );
}
