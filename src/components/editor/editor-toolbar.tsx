"use client";

import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { Bold, Italic, List, ListOrdered, Redo2, Underline, Undo2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? "⌘" : "Ctrl+";

type BlockType = "paragraph" | "h1" | "h2" | "h3";

// Each option previews its own style, so the menu doubles as a legend for the document's type scale.
const BLOCKS: { value: BlockType; label: string; preview: string; shortcut: string }[] = [
  { value: "paragraph", label: "Normal text", preview: "font-serif text-[15px]", shortcut: isMac ? "⌥⌘0" : "Ctrl+Alt+0" },
  { value: "h1", label: "Heading 1", preview: "font-serif text-xl font-semibold", shortcut: isMac ? "⌥⌘1" : "Ctrl+Alt+1" },
  { value: "h2", label: "Heading 2", preview: "font-serif text-lg font-semibold", shortcut: isMac ? "⌥⌘2" : "Ctrl+Alt+2" },
  { value: "h3", label: "Heading 3", preview: "font-serif text-base font-semibold", shortcut: isMac ? "⌥⌘3" : "Ctrl+Alt+3" },
];

type ToolbarState = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  bulletList: boolean;
  orderedList: boolean;
  block: BlockType;
  canUndo: boolean;
  canRedo: boolean;
};

function readState(current: Editor): ToolbarState {
  return {
    bold: current.isActive("bold"),
    italic: current.isActive("italic"),
    underline: current.isActive("underline"),
    bulletList: current.isActive("bulletList"),
    orderedList: current.isActive("orderedList"),
    block: (["h1", "h2", "h3"] as const).find((block) => current.isActive("heading", { level: Number(block[1]) })) ?? "paragraph",
    canUndo: current.can().undo(),
    canRedo: current.can().redo(),
  };
}

export function EditorToolbar({ editor }: { editor: Editor | null }) {
  const selected = useEditorState({ editor, selector: ({ editor: current }) => (current && !current.isDestroyed ? readState(current) : null) });
  // The editor is created after mount (immediatelyRender: false), and useEditorState only re-selects on the next
  // transaction. Read directly until then so the toolbar is live as soon as the document appears.
  const state = selected ?? (editor && !editor.isDestroyed ? readState(editor) : null);

  const off = !editor || !state;
  const chain = () => editor!.chain().focus();

  function setBlock(value: BlockType) {
    if (!editor) return;
    // Focus the document in the same tick as the change, so keys typed right after picking a style land in it.
    if (value === "paragraph") editor.chain().focus().setParagraph().run();
    else editor.chain().focus().toggleHeading({ level: Number(value[1]) as 1 | 2 | 3 }).run();
  }

  return (
    <div role="toolbar" aria-label="Formatting" aria-orientation="horizontal" className="mx-auto flex w-max items-center gap-0.5 px-3 py-1.5">
      <ToolbarButton label="Undo" shortcut={`${mod}Z`} disabled={off || !state?.canUndo} onClick={() => chain().undo().run()}>
        <Undo2 aria-hidden />
      </ToolbarButton>
      <ToolbarButton label="Redo" shortcut={isMac ? "⇧⌘Z" : "Ctrl+Y"} disabled={off || !state?.canRedo} onClick={() => chain().redo().run()}>
        <Redo2 aria-hidden />
      </ToolbarButton>
      <Divider />
      <Select value={state?.block ?? "paragraph"} onValueChange={(value) => setBlock(value as BlockType)} disabled={off}>
        <SelectTrigger
          className="h-8 w-36 border-transparent bg-transparent font-medium shadow-none hover:bg-accent focus-visible:border-transparent aria-expanded:bg-accent"
          aria-label="Text style"
        >
          {/* Plain label in the trigger; the styled previews live only in the menu. */}
          <SelectValue>{BLOCKS.find((block) => block.value === (state?.block ?? "paragraph"))?.label}</SelectValue>
        </SelectTrigger>
        <SelectContent
          position="popper"
          align="start"
          // No exit animation: Radix keeps focus inside the menu until it unmounts, which swallowed early keystrokes.
          className="w-56 data-closed:animate-none"
          // Radix returns focus to the trigger on close; keep it in the document instead.
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            editor?.commands.focus();
          }}
        >
          {BLOCKS.map((block) => (
            <SelectItem key={block.value} value={block.value} className="py-1.5">
              <span className={block.preview}>{block.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Divider />
      <ToolbarToggle label="Bold" shortcut={`${mod}B`} pressed={!!state?.bold} disabled={off} onToggle={() => chain().toggleBold().run()}>
        <Bold aria-hidden strokeWidth={2.5} />
      </ToolbarToggle>
      <ToolbarToggle label="Italic" shortcut={`${mod}I`} pressed={!!state?.italic} disabled={off} onToggle={() => chain().toggleItalic().run()}>
        <Italic aria-hidden />
      </ToolbarToggle>
      <ToolbarToggle label="Underline" shortcut={`${mod}U`} pressed={!!state?.underline} disabled={off} onToggle={() => chain().toggleUnderline().run()}>
        <Underline aria-hidden />
      </ToolbarToggle>
      <Divider />
      <ToolbarToggle
        label="Bulleted list"
        shortcut={isMac ? "⇧⌘8" : "Ctrl+Shift+8"}
        pressed={!!state?.bulletList}
        disabled={off}
        onToggle={() => chain().toggleBulletList().run()}
      >
        <List aria-hidden />
      </ToolbarToggle>
      <ToolbarToggle
        label="Numbered list"
        shortcut={isMac ? "⇧⌘7" : "Ctrl+Shift+7"}
        pressed={!!state?.orderedList}
        disabled={off}
        onToggle={() => chain().toggleOrderedList().run()}
      >
        <ListOrdered aria-hidden />
      </ToolbarToggle>
    </div>
  );
}

const Divider = () => <span aria-hidden className="mx-1.5 h-5 w-px shrink-0 bg-border" />;

function Hint({ label, shortcut, children }: { label: string; shortcut?: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className="flex items-center gap-2">
        {label}
        {shortcut && <span className="opacity-60">{shortcut}</span>}
      </TooltipContent>
    </Tooltip>
  );
}

function ToolbarToggle(props: { label: string; shortcut?: string; pressed: boolean; disabled: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <Hint label={props.label} shortcut={props.shortcut}>
      <Toggle
        aria-label={props.label}
        aria-keyshortcuts={props.shortcut}
        pressed={props.pressed}
        disabled={props.disabled}
        onPressedChange={props.onToggle}
        className="size-8 min-w-8 px-0 text-muted-foreground hover:text-foreground active:scale-95 data-[state=on]:bg-primary-soft data-[state=on]:text-primary"
      >
        {props.children}
      </Toggle>
    </Hint>
  );
}

function ToolbarButton(props: { label: string; shortcut?: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Hint label={props.label} shortcut={props.shortcut}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={props.label}
        aria-keyshortcuts={props.shortcut}
        disabled={props.disabled}
        onClick={props.onClick}
        className="text-muted-foreground hover:text-foreground"
      >
        {props.children}
      </Button>
    </Hint>
  );
}
