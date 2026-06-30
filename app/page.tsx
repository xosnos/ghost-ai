import { EditorChrome } from "@/components/editor/editor-chrome";

export default function Home() {
  return (
    <EditorChrome>
      <div
        className="flex flex-1 items-center justify-center"
        style={{ color: "var(--text-faint)" }}
      >
        Canvas goes here
      </div>
    </EditorChrome>
  );
}
