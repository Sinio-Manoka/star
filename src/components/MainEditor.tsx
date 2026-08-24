import Editor from "@monaco-editor/react";
import "../lib/monaco";

type MainEditorProps = {
  value: string;
  onChange: (value: string) => void;
};

export function MainEditor({ value, onChange }: MainEditorProps) {
  return (
    <Editor
      height="100%"
      language="typescript"
      path="src/example.ts"
      theme="vs-dark"
      value={value}
      onChange={(next) => onChange(next ?? "")}
      options={{
        automaticLayout: true,
        fontFamily: "'Cascadia Code', 'SFMono-Regular', Consolas, monospace",
        fontSize: 13,
        minimap: { enabled: false },
        padding: { top: 12 },
        scrollBeyondLastLine: false,
      }}
    />
  );
}
