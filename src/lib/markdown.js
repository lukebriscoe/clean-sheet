import { marked } from 'marked'
import DOMPurify from 'dompurify'

// Drill text is written by anonymous members of the public (v1 has open write
// access) and then rendered in every other coach's browser. It gets sanitised —
// no exceptions, no "trusted" path. The allow-list below is deliberately tiny:
// a drill description needs paragraphs, emphasis, lists and links. Nothing else.

marked.setOptions({ gfm: true, breaks: true })

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'blockquote', 'code', 'pre', 'a', 'hr',
]

const ALLOWED_ATTR = ['href', 'title']

// Force every rendered link to open safely in a new tab. DOMPurify strips
// javascript: and data: URIs before this runs.
let hookInstalled = false
function installHook() {
  if (hookInstalled) return
  DOMPurify.addHook('afterSanitizeAttributes', node => {
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank')
      node.setAttribute('rel', 'noopener noreferrer nofollow')
      node.classList.add('print-url')
    }
  })
  hookInstalled = true
}

/** Markdown string -> sanitised HTML string, safe for dangerouslySetInnerHTML. */
export function renderMarkdown(source) {
  if (!source || typeof source !== 'string') return ''
  installHook()
  return DOMPurify.sanitize(marked.parse(source), {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  })
}

/** Strip markdown to plain text — for meta descriptions and card previews. */
export function toPlainText(source, maxLength = 160) {
  if (!source) return ''
  const text = source
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`~-]/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}…` : text
}
