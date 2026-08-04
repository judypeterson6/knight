'use client'

import { useEffect, useState } from 'react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import ImageExtension from '@tiptap/extension-image'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import { cn } from '@/lib/utils'

/**
 * Tiptap editor for post bodies.
 *
 * H2–H4 only: the page supplies the single H1, so an editor cannot introduce a
 * second one or skip a level. Image insertion demands alt text before it will
 * insert anything.
 */
export function RichTextEditor({
  value,
  onChange,
  media,
}: {
  value: string
  onChange: (html: string) => void
  media: { id: string; path: string; alt: string; filename: string }[]
}) {
  const [showSource, setShowSource] = useState(false)
  const [source, setSource] = useState(value)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        codeBlock: {},
      }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer' } }),
      ImageExtension.configure({ inline: false, allowBase64: false }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value,
    editorProps: {
      attributes: {
        class: 'kc-prose min-h-[26rem] max-w-none rounded-b-control border border-t-0 border-line bg-surface p-5 focus:outline-none',
      },
    },
    onUpdate: ({ editor: instance }) => {
      const html = instance.getHTML()
      setSource(html)
      onChange(html)
    },
  })

  useEffect(() => {
    if (editor && !showSource && source !== editor.getHTML()) {
      editor.commands.setContent(source, false)
    }
  }, [showSource, editor, source])

  if (!editor) {
    return <div className="min-h-[30rem] rounded-control border border-line bg-surface-alt" aria-busy="true" />
  }

  return (
    <div>
      <div role="toolbar" aria-label="Formatting" className="flex flex-wrap gap-1 rounded-t-control border border-line bg-surface-alt p-2">
        <ToolButton editor={editor} label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          B
        </ToolButton>
        <ToolButton editor={editor} label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
          I
        </ToolButton>
        {[2, 3, 4].map((level) => (
          <ToolButton
            key={level}
            editor={editor}
            label={`Heading ${level}`}
            active={editor.isActive('heading', { level })}
            onClick={() => editor.chain().focus().toggleHeading({ level: level as 2 | 3 | 4 }).run()}
          >
            H{level}
          </ToolButton>
        ))}
        <ToolButton editor={editor} label="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          • List
        </ToolButton>
        <ToolButton editor={editor} label="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          1. List
        </ToolButton>
        <ToolButton editor={editor} label="Quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          Quote
        </ToolButton>
        <ToolButton editor={editor} label="Code block" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
          Code
        </ToolButton>
        <ToolButton
          editor={editor}
          label="Table"
          active={editor.isActive('table')}
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          Table
        </ToolButton>
        <ToolButton
          editor={editor}
          label="Link"
          active={editor.isActive('link')}
          onClick={() => {
            const previous = editor.getAttributes('link').href as string | undefined
            const href = window.prompt('Link URL (leave empty to remove)', previous ?? '')
            if (href === null) return
            if (href === '') {
              editor.chain().focus().extendMarkRange('link').unsetLink().run()
              return
            }
            editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
          }}
        >
          Link
        </ToolButton>
        <ToolButton
          editor={editor}
          label="Insert image"
          onClick={() => {
            const path = window.prompt(
              `Image path. Available:\n${media.slice(0, 12).map((m) => m.path).join('\n')}`,
              media[0]?.path ?? '/uploads/',
            )
            if (!path) return
            const known = media.find((m) => m.path === path)
            const alt = window.prompt('Alt text (required — describe what the image shows)', known?.alt ?? '')
            if (!alt || !alt.trim()) {
              window.alert('Alt text is required. The image was not inserted.')
              return
            }
            editor.chain().focus().setImage({ src: path, alt: alt.trim() }).run()
          }}
        >
          Image
        </ToolButton>

        <button
          type="button"
          onClick={() => {
            if (showSource) {
              editor.commands.setContent(source, false)
              onChange(source)
            } else {
              setSource(editor.getHTML())
            }
            setShowSource(!showSource)
          }}
          className="ml-auto rounded-control border border-line px-2.5 py-1 text-step--1 font-bold"
        >
          {showSource ? 'Visual' : 'HTML'}
        </button>
      </div>

      {showSource ? (
        <textarea
          aria-label="HTML source"
          value={source}
          onChange={(e) => {
            setSource(e.target.value)
            onChange(e.target.value)
          }}
          rows={22}
          className="w-full rounded-b-control border border-t-0 border-line bg-surface p-4 font-mono text-step--1"
        />
      ) : (
        <EditorContent editor={editor} />
      )}
    </div>
  )
}

function ToolButton({
  children,
  label,
  active,
  onClick,
}: {
  children: React.ReactNode
  label: string
  active?: boolean
  onClick: () => void
  editor: Editor
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      className={cn(
        'rounded-control border px-2.5 py-1 text-step--1 font-bold transition',
        active ? 'border-primary bg-primary text-primary-contrast' : 'border-line hover:border-primary hover:text-primary',
      )}
    >
      <span aria-hidden>{children}</span>
      <span className="sr-only">{label}</span>
    </button>
  )
}
