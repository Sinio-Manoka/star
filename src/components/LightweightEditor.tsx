import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { oneDark } from "@codemirror/theme-one-dark";

type LightweightEditorProps = {
  value: string;
  onChange: (value: string) => void;
};

export function LightweightEditor({ value, onChange }: LightweightEditorProps) {
  return (
    <CodeMirror
      aria-label="Prompt and configuration editor"
      extensions={[json()]}
      height="100%"
      onChange={onChange}
      theme={oneDark}
      value={value}
    />
  );
}
