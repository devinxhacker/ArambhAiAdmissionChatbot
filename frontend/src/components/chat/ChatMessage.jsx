import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { Bot, User, ExternalLink, Copy, Check, ChevronDown, FileText } from 'lucide-react'
import { format } from 'date-fns'
import { useState } from 'react'

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
      title="Copy code"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

function SourcesDropdown({ sources }) {
  const [open, setOpen] = useState(false)

  if (!sources || sources.length === 0) return null

  const typeColors = {
    web: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
    pdf: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
    indexed: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
    upload: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
    html: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
    web_crawl: 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300',
  }

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <FileText className="h-3.5 w-3.5" />
        <span>Sources ({sources.length})</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")} />
      </button>

      {open && (
        <div className="mt-2 rounded-xl border border-border dark:border-gray-700/60 bg-muted/30 dark:bg-gray-800/40 p-3 animate-fade-in">
          <div className="space-y-1.5">
            {sources.map((src, i) => {
              const url = src.source_url || src.url || src.host || ''
              let title = src.title || src.source || `Source ${i + 1}`
              if (!title && url) {
                try { title = new URL(url).hostname } catch { title = `Source ${i + 1}` }
              }
              const snippet = src.snippet || ''
              const sourceType = src.source_type || (url.includes('.pdf') ? 'pdf' : 'web')

              return (
                <a
                  key={i}
                  href={url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-background dark:hover:bg-gray-700/50 border border-transparent hover:border-border dark:hover:border-gray-600/50 transition-all group"
                >
                  <span className="flex items-center justify-center h-5 w-5 rounded bg-primary/10 text-primary text-[10px] font-bold shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">
                        {title}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${typeColors[sourceType] || typeColors.web}`}>
                        {sourceType}
                      </span>
                    </div>
                    {snippet && (
                      <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{snippet}</p>
                    )}
                    {url && (
                      <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5 flex items-center gap-1">
                        <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                        {url.replace(/^https?:\/\//, '').slice(0, 60)}
                      </p>
                    )}
                  </div>
                </a>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ChatMessage({ message }) {
  const isUser = message.role === 'user'

  return (
    <div
      className={cn(
        'flex gap-3 animate-fade-in',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      <Avatar className="h-8 w-8 shrink-0 mt-1">
        <AvatarFallback
          className={cn(
            'text-xs',
            isUser
              ? 'bg-gradient-to-br from-indigo-500 to-blue-500 text-white'
              : 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white'
          )}
        >
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>

      <div className={cn('flex flex-col gap-1', isUser ? 'items-end max-w-[80%]' : 'max-w-[85%]')}>
        {/* Role label */}
        <span className="text-[11px] font-medium text-muted-foreground px-1">
          {isUser ? 'You' : 'Arambh AI'}
        </span>

        <div
          className={cn(
            'rounded-2xl px-4 py-3 text-sm',
            isUser
              ? 'bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-tr-sm shadow-md'
              : 'bg-white dark:bg-gray-800/90 border border-slate-200/80 dark:border-gray-700/60 text-foreground rounded-tl-sm shadow-sm'
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              className="markdown-response"
              components={{
                table({ children }) {
                  return (
                    <div className="my-3 overflow-x-auto rounded-lg border border-border">
                      <table className="w-full text-sm border-collapse">{children}</table>
                    </div>
                  )
                },
                thead({ children }) {
                  return <thead className="bg-muted/50 border-b border-border">{children}</thead>
                },
                th({ children }) {
                  return <th className="px-3 py-2 text-left text-xs font-semibold whitespace-nowrap">{children}</th>
                },
                td({ children }) {
                  return <td className="px-3 py-2 text-sm border-t border-border/50">{children}</td>
                },
                tr({ children }) {
                  return <tr className="hover:bg-muted/30 transition-colors">{children}</tr>
                },
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '')
                  const codeString = String(children).replace(/\n$/, '')
                  if (!inline && (match || codeString.includes('\n'))) {
                    return (
                      <div className="relative my-3 rounded-lg overflow-hidden">
                        {match && (
                          <div className="bg-slate-800 px-3 py-1.5 text-xs text-slate-400 border-b border-slate-700">
                            {match[1]}
                          </div>
                        )}
                        <CopyButton text={codeString} />
                        <SyntaxHighlighter
                          style={oneDark}
                          language={match?.[1] || 'text'}
                          PreTag="div"
                          customStyle={{ margin: 0, borderRadius: match ? '0 0 0.5rem 0.5rem' : '0.5rem', fontSize: '0.8rem' }}
                          {...props}
                        >
                          {codeString}
                        </SyntaxHighlighter>
                      </div>
                    )
                  }
                  return (
                    <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
                      {children}
                    </code>
                  )
                },
                h1({ children }) { return <h1 className="text-lg font-bold mt-4 mb-2">{children}</h1> },
                h2({ children }) { return <h2 className="text-base font-bold mt-3 mb-1.5">{children}</h2> },
                h3({ children }) { return <h3 className="text-sm font-bold mt-2.5 mb-1">{children}</h3> },
                p({ children }) { return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p> },
                ul({ children }) { return <ul className="list-disc ml-4 mb-2 space-y-1">{children}</ul> },
                ol({ children }) { return <ol className="list-decimal ml-4 mb-2 space-y-1">{children}</ol> },
                li({ children }) { return <li className="leading-relaxed">{children}</li> },
                blockquote({ children }) {
                  return (
                    <blockquote className="border-l-3 border-primary/60 bg-primary/5 pl-3 py-1.5 my-2 rounded-r-lg italic">
                      {children}
                    </blockquote>
                  )
                },
                a({ href, children }) {
                  return (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 underline underline-offset-2 decoration-primary/40">
                      {children}
                    </a>
                  )
                },
                strong({ children }) { return <strong className="font-semibold">{children}</strong> },
                em({ children }) { return <em className="italic">{children}</em> },
                hr() { return <hr className="my-3 border-border" /> },
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>

        {/* Sources — collapsible dropdown */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <SourcesDropdown sources={message.sources} />
        )}

        <span className="text-[11px] text-muted-foreground px-1">
          {(message.createdAt || message.created_at) ? format(new Date(message.createdAt || message.created_at), 'HH:mm') : ''}
        </span>
      </div>
    </div>
  )
}
