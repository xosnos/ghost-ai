import { Input } from "@/components/ui/input";

interface AuthFieldProps {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  minLength?: number;
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
  minLength,
  labelExtra,
}: AuthFieldProps) {
  return (
    <div>
      <div className={labelExtra ? "flex items-center justify-between mb-1.5" : "mb-1.5"}>
        <label htmlFor={id} className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
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
        minLength={minLength}
      />
    </div>
  );
}
