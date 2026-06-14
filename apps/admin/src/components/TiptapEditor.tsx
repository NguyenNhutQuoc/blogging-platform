"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import { useCallback, useEffect } from "react";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  TextQuote,
  SquareCode,
  ImagePlus,
  Minus,
  Undo2,
  Redo2,
} from "lucide-react";
import { Button } from "@repo/ui";

export interface TiptapOutput {
  html: string;
  json: Record<string, unknown>;
}

interface TiptapEditorProps {
  /** Initial HTML content (when editing an existing post) */
  initialHtml?: string;
  /** Called whenever content changes — debounce upstream if needed */
  onChange: (output: TiptapOutput) => void;
  placeholder?: string;
}

/**
 * Rich-text editor built on Tiptap (ProseMirror).
 * Outputs both HTML (for the `content` column) and ProseMirror JSON
 * (for the `content_json` column) on every change.
 *
 * Extensions used:
 *  - StarterKit: headings, bold, italic, strike, code, pre, blockquote,
 *                bullet list, ordered list, horizontal rule, hard break
 *  - Image: inline image insertion via URL
 *  - Placeholder: greyed-out placeholder text when empty
 *  - CharacterCount: word/character count shown in the footer
 */
export function TiptapEditor({ initialHtml, onChange, placeholder }: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        // Code block and blockquote included by default
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
      }),
      Placeholder.configure({
        placeholder: placeholder ?? "Start writing your post…",
      }),
      CharacterCount,
    ],
    content: initialHtml ?? "",
    editorProps: {
      attributes: {
        class: "tiptap-editor",
      },
    },
    onUpdate({ editor: e }) {
      onChange({
        html: e.getHTML(),
        json: e.getJSON() as Record<string, unknown>,
      });
    },
    // SSR: don't render on server
    immediatelyRender: false,
  });

  // Sync when initialHtml changes (e.g. switching between posts)
  useEffect(() => {
    if (editor && initialHtml !== undefined && editor.getHTML() !== initialHtml) {
      editor.commands.setContent(initialHtml, false);
    }
  }, [editor, initialHtml]);

  const insertImage = useCallback(() => {
    const url = window.prompt("Image URL");
    if (url) editor?.chain().focus().setImage({ src: url }).run();
  }, [editor]);

  if (!editor) return null;

  const wordCount = editor.storage.characterCount?.words() ?? 0;
  const charCount = editor.storage.characterCount?.characters() ?? 0;

  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 px-2 py-1.5">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="Bold (Ctrl+B)"
        >
          <Bold />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="Italic (Ctrl+I)"
        >
          <Italic />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive("strike")}
          title="Strikethrough"
        >
          <Strikethrough />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive("code")}
          title="Inline code"
        >
          <Code />
        </ToolbarButton>

        <div className="mx-1 h-5 w-px bg-border" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive("heading", { level: 1 })}
          title="Heading 1"
        >
          <Heading1 />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
          title="Heading 2"
        >
          <Heading2 />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive("heading", { level: 3 })}
          title="Heading 3"
        >
          <Heading3 />
        </ToolbarButton>

        <div className="mx-1 h-5 w-px bg-border" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title="Bullet list"
        >
          <List />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          title="Numbered list"
        >
          <ListOrdered />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive("blockquote")}
          title="Blockquote"
        >
          <TextQuote />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive("codeBlock")}
          title="Code block"
        >
          <SquareCode />
        </ToolbarButton>

        <div className="mx-1 h-5 w-px bg-border" />

        <ToolbarButton onClick={insertImage} title="Insert image">
          <ImagePlus />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontal rule"
        >
          <Minus />
        </ToolbarButton>

        <div className="mx-1 h-5 w-px bg-border" />

        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo (Ctrl+Y)"
        >
          <Redo2 />
        </ToolbarButton>
      </div>

      {/* Editor content area */}
      <EditorContent editor={editor} className="tiptap-editor min-h-[400px]" />

      {/* Word/char count footer */}
      <div className="border-t px-3 py-1.5 text-xs text-muted-foreground">
        {wordCount} words · {charCount} chars
      </div>
    </div>
  );
}

interface ToolbarButtonProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}

function ToolbarButton({ onClick, active, disabled, title, children }: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="icon-xs"
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </Button>
  );
}
