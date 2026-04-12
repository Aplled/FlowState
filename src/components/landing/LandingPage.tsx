import React, { useState, useEffect, useRef } from 'react'
import {
  Layers, ArrowRight, CheckSquare, FileText, Calendar, GitFork,
  Palette, Layout, Zap, Globe, Pencil, Table, StickyNote,
  LayoutGrid, Search, Inbox, Shield, MousePointer2, Sparkles,
  ArrowDown, Play, Command, ChevronRight, ExternalLink,
  Monitor, Star, Users, Clock, Cpu, Lock,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface LandingPageProps {
  onGetStarted: () => void
}

const ScrollCtx = React.createContext<HTMLDivElement | null>(null)

function FadeIn({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const scrollRoot = React.useContext(ScrollCtx)
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || !scrollRoot) return
    const check = () => {
      const containerRect = scrollRoot.getBoundingClientRect()
      const elRect = el.getBoundingClientRect()
      if (elRect.top < containerRect.bottom + 100) {
        setVisible(true)
      }
    }
    check()
    scrollRoot.addEventListener('scroll', check, { passive: true })
    return () => scrollRoot.removeEventListener('scroll', check)
  }, [scrollRoot])

  return (
    <div
      ref={ref}
      className={cn('transition-all duration-700 ease-out', visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6', className)}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

function FloatingNode({ icon: Icon, label, color, className, delay }: { icon: any; label: string; color: string; className: string; delay: number }) {
  return (
    <div
      className={cn('absolute bg-surface border border-border rounded-xl p-3 shadow-lg animate-float', className)}
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: color + '20' }}>
          <Icon className="h-3.5 w-3.5" style={{ color }} />
        </div>
        <span className="text-xs font-medium text-text">{label}</span>
      </div>
    </div>
  )
}

export function LandingPage({ onGetStarted }: LandingPageProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null)
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    setScrollEl(scrollRef.current)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => setScrollY(el.scrollTop)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <ScrollCtx.Provider value={scrollEl}>
    <div ref={scrollRef} className="h-screen bg-bg text-text overflow-y-auto scroll-smooth">
      {/* Nav */}
      <nav className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrollY > 50 ? 'backdrop-blur-xl bg-bg/80 border-b border-border/30 shadow-sm' : 'bg-transparent',
      )}>
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent to-accent/60 flex items-center justify-center shadow-md shadow-accent/20">
              <Layers className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="text-base font-bold text-text tracking-tight">FlowState</span>
          </div>
          <div className="flex items-center gap-8">
            <a href="#features" className="text-sm text-text-secondary hover:text-text transition-colors cursor-pointer">Features</a>
            <a href="#how-it-works" className="text-sm text-text-secondary hover:text-text transition-colors cursor-pointer">How It Works</a>
            <a href="#views" className="text-sm text-text-secondary hover:text-text transition-colors cursor-pointer">Views</a>
            <a href="#themes" className="text-sm text-text-secondary hover:text-text transition-colors cursor-pointer">Themes</a>
            <button
              onClick={onGetStarted}
              className="px-4 py-1.5 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent-hover transition-all cursor-pointer shadow-sm shadow-accent/20"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-6 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-accent/8 rounded-full blur-3xl" />
          <div className="absolute top-40 right-1/4 w-80 h-80 bg-accent/5 rounded-full blur-3xl" />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, var(--color-border) 1px, transparent 0)',
              backgroundSize: '40px 40px',
              opacity: 0.3,
              transform: `translateY(${scrollY * 0.1}px)`,
            }}
          />
        </div>

        <div className="max-w-5xl mx-auto text-center relative">
          <FadeIn>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-medium mb-8">
              <Sparkles className="h-3.5 w-3.5" />
              Your workspace, reimagined
            </div>
          </FadeIn>

          <FadeIn delay={100}>
            <h1 className="text-5xl font-bold leading-[1.15] mb-6 tracking-tight">
              Think freely.
              <br />
              Build anything.
              <br />
              <span className="bg-gradient-to-r from-accent via-accent to-info bg-clip-text text-transparent">
                Stay in flow.
              </span>
            </h1>
          </FadeIn>

          <FadeIn delay={200}>
            <p className="text-lg text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed">
              FlowState is the infinite canvas workspace that combines rich documents,
              tasks, databases, and knowledge graphs into one seamless experience.
            </p>
          </FadeIn>

          <FadeIn delay={300}>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={onGetStarted}
                className="group flex items-center gap-2.5 px-7 py-3.5 text-sm font-semibold bg-accent text-white rounded-xl hover:bg-accent-hover transition-all shadow-lg shadow-accent/25 cursor-pointer"
              >
                Start Building
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
              <a
                href="#features"
                className="flex items-center gap-2 px-7 py-3.5 text-sm font-medium bg-surface border border-border text-text rounded-xl hover:bg-bg-hover transition-colors cursor-pointer"
              >
                <Play className="h-3.5 w-3.5" />
                See How It Works
              </a>
            </div>
          </FadeIn>

          <FadeIn delay={350}>
            <div className="flex items-center justify-center gap-6 mt-8 text-xs text-text-muted">
              <span className="flex items-center gap-1.5"><Shield className="h-3 w-3" /> Local-first</span>
              <span className="flex items-center gap-1.5"><Zap className="h-3 w-3" /> Blazing fast</span>
              <span className="flex items-center gap-1.5"><Lock className="h-3 w-3" /> Your data, your way</span>
            </div>
          </FadeIn>
        </div>

        {/* App preview */}
        <FadeIn delay={500} className="max-w-5xl mx-auto mt-20">
          <div className="relative">
            {/* Glow behind preview */}
            <div className="absolute -inset-4 bg-gradient-to-b from-accent/10 via-accent/5 to-transparent rounded-3xl blur-2xl" />

            <div className="relative bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden">
              {/* Title bar */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-bg-secondary/50">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-danger/50" />
                  <div className="w-3 h-3 rounded-full bg-warning/50" />
                  <div className="w-3 h-3 rounded-full bg-success/50" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-bg-tertiary/50 text-[10px] text-text-muted">
                    <Command className="h-2.5 w-2.5" /> FlowState
                  </div>
                </div>
              </div>

              {/* App content */}
              <div className="flex h-80">
                {/* Sidebar mock */}
                <div className="w-52 bg-bg-secondary border-r border-border/50 p-3 space-y-3 shrink-0">
                  <div className="flex items-center gap-2 px-2 py-1">
                    <div className="w-5 h-5 rounded-md bg-accent/20 flex items-center justify-center">
                      <span className="text-[9px] font-bold text-accent">F</span>
                    </div>
                    <span className="text-[11px] font-semibold text-text">My Workspace</span>
                  </div>
                  <div className="space-y-0.5">
                    {[
                      { icon: Search, label: 'Search', shortcut: 'K' },
                      { icon: Inbox, label: 'Dump', shortcut: null },
                    ].map(({ icon: I, label, shortcut }) => (
                      <div key={label} className="flex items-center justify-between px-2 py-1.5 rounded-md text-[11px] text-text-secondary">
                        <span className="flex items-center gap-2"><I className="h-3 w-3 opacity-50" /> {label}</span>
                        {shortcut && <span className="text-[9px] text-text-muted bg-bg-tertiary px-1 rounded">+{shortcut}</span>}
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 border-t border-border/30">
                    <div className="text-[9px] font-semibold uppercase tracking-wider text-text-muted px-2 mb-1.5">Views</div>
                    {['Tasks', 'Board', 'Calendar', 'Graph'].map((v) => (
                      <div key={v} className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] text-text-secondary">
                        {v === 'Tasks' ? <CheckSquare className="h-3 w-3 opacity-50" /> :
                         v === 'Board' ? <LayoutGrid className="h-3 w-3 opacity-50" /> :
                         v === 'Calendar' ? <Calendar className="h-3 w-3 opacity-50" /> :
                         <GitFork className="h-3 w-3 opacity-50" />}
                        {v}
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 border-t border-border/30">
                    <div className="text-[9px] font-semibold uppercase tracking-wider text-text-muted px-2 mb-1.5">Workspaces</div>
                    {['Product Roadmap', 'Research Notes', 'Design System'].map((w) => (
                      <div key={w} className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] text-text-secondary hover:bg-bg-hover">
                        <FileText className="h-3 w-3 opacity-50" /> {w}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Canvas mock */}
                <div className="flex-1 relative overflow-hidden bg-bg">
                  {/* Grid dots */}
                  <div
                    className="absolute inset-0 opacity-30"
                    style={{
                      backgroundImage: 'radial-gradient(circle at 1px 1px, var(--color-border) 0.5px, transparent 0)',
                      backgroundSize: '24px 24px',
                    }}
                  />

                  {/* Mock nodes */}
                  <div className="absolute top-6 left-8 w-44 bg-surface border border-border rounded-xl p-3 shadow-md">
                    <div className="flex items-center gap-1.5 mb-2">
                      <CheckSquare className="h-3 w-3 text-accent" />
                      <span className="text-[10px] font-medium text-accent">Task</span>
                    </div>
                    <div className="text-xs font-medium text-text mb-1">Launch MVP</div>
                    <div className="text-[10px] text-text-muted">Ship the first version with core features</div>
                    <div className="flex gap-1 mt-2">
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-warning/15 text-warning">High</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/15 text-accent">v1.0</span>
                    </div>
                  </div>

                  <div className="absolute top-8 right-16 w-48 bg-surface border border-border rounded-xl p-3 shadow-md">
                    <div className="flex items-center gap-1.5 mb-2">
                      <FileText className="h-3 w-3 text-info" />
                      <span className="text-[10px] font-medium text-info">Document</span>
                    </div>
                    <div className="text-xs font-medium text-text mb-1">Architecture Doc</div>
                    <div className="space-y-1 mt-2">
                      <div className="h-1.5 bg-text-muted/15 rounded-full w-full" />
                      <div className="h-1.5 bg-text-muted/15 rounded-full w-4/5" />
                      <div className="h-1.5 bg-text-muted/15 rounded-full w-3/5" />
                    </div>
                  </div>

                  <div className="absolute bottom-16 left-20 w-36 bg-surface border border-border rounded-xl p-3 shadow-md">
                    <div className="flex items-center gap-1.5 mb-2">
                      <StickyNote className="h-3 w-3 text-warning" />
                      <span className="text-[10px] font-medium text-warning">Note</span>
                    </div>
                    <div className="text-xs text-text-secondary">Consider using WebSockets for real-time sync</div>
                  </div>

                  <div className="absolute bottom-8 right-8 w-40 bg-surface border border-border rounded-xl p-3 shadow-md">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Calendar className="h-3 w-3 text-success" />
                      <span className="text-[10px] font-medium text-success">Event</span>
                    </div>
                    <div className="text-xs font-medium text-text">Team Standup</div>
                    <div className="text-[10px] text-text-muted mt-0.5">Tomorrow, 10:00 AM</div>
                  </div>

                  {/* Connection lines (SVG) */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.3 }}>
                    <line x1="190" y1="60" x2="320" y2="60" stroke="var(--color-accent)" strokeWidth="1.5" strokeDasharray="4 4" />
                    <line x1="120" y1="120" x2="120" y2="200" stroke="var(--color-accent)" strokeWidth="1.5" strokeDasharray="4 4" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </FadeIn>

        {/* Scroll indicator */}
        <div className="flex justify-center mt-12">
          <ArrowDown className="h-5 w-5 text-text-muted animate-bounce" />
        </div>
      </section>

      {/* Social proof */}
      <section className="py-12 px-6 border-y border-border/30 bg-bg-secondary/30">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center gap-12 text-text-muted">
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl font-bold text-text">12+</span>
              <span className="text-xs">Node types</span>
            </div>
            <div className="w-px h-8 bg-border/50" />
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl font-bold text-text">8</span>
              <span className="text-xs">Built-in themes</span>
            </div>
            <div className="w-px h-8 bg-border/50" />
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl font-bold text-text">5</span>
              <span className="text-xs">View modes</span>
            </div>
            <div className="w-px h-8 bg-border/50" />
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl font-bold text-text">100%</span>
              <span className="text-xs">Local-first</span>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-20">
            <h2 className="text-3xl font-bold mb-4 tracking-tight">How it works</h2>
            <p className="text-text-secondary max-w-xl mx-auto text-lg">
              Three simple steps to organize your entire workflow.
            </p>
          </FadeIn>

          <div className="grid grid-cols-3 gap-8">
            {[
              {
                step: '01',
                icon: MousePointer2,
                title: 'Drop anything on the canvas',
                desc: 'Create tasks, documents, notes, tables, drawings, or embed web pages. Place them anywhere on your infinite canvas.',
              },
              {
                step: '02',
                icon: GitFork,
                title: 'Connect your ideas',
                desc: 'Draw connections between nodes. See relationships emerge in the graph view. Your knowledge becomes a network.',
              },
              {
                step: '03',
                icon: Zap,
                title: 'Work your way',
                desc: 'Switch between canvas, board, calendar, and graph views. Customize themes, layout, and shortcuts to match your flow.',
              },
            ].map(({ step, icon: Icon, title, desc }, i) => (
              <FadeIn key={step} delay={i * 150}>
                <div className="relative">
                  <div className="text-6xl font-black text-accent/10 mb-4">{step}</div>
                  <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
                    <Icon className="h-6 w-6 text-accent" />
                  </div>
                  <h3 className="text-lg font-semibold text-text mb-2">{title}</h3>
                  <p className="text-sm text-text-muted leading-relaxed">{desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6 bg-bg-secondary/30">
        <div className="max-w-6xl mx-auto">
          <FadeIn className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium mb-4">
              <Sparkles className="h-3 w-3" /> Packed with power
            </div>
            <h2 className="text-3xl font-bold mb-4 tracking-tight">Everything you need</h2>
            <p className="text-text-secondary max-w-xl mx-auto">
              A complete workspace with the flexibility of a canvas and the power of structured tools.
            </p>
          </FadeIn>

          <div className="grid grid-cols-3 gap-5">
            {[
              { icon: FileText, title: 'Rich Documents', desc: 'Full editor with slash commands, headings, lists, code blocks, and more.', color: '#3b82f6' },
              { icon: CheckSquare, title: 'Tasks & Kanban', desc: 'Manage tasks with priorities, due dates, and drag-and-drop board.', color: '#22c55e' },
              { icon: Calendar, title: 'Calendar Sync', desc: 'Two-way Google Calendar sync. Events become canvas nodes.', color: '#f59e0b' },
              { icon: Table, title: 'Databases', desc: 'Spreadsheet-style tables with typed columns and inline editing.', color: '#8b5cf6' },
              { icon: GitFork, title: 'Graph View', desc: 'Interactive knowledge graph showing how nodes connect.', color: '#06b6d4' },
              { icon: Pencil, title: 'Drawing Canvas', desc: 'Freehand drawing with pressure sensitivity for sketches.', color: '#ec4899' },
              { icon: Globe, title: 'Web Browser', desc: 'Embed live web pages on your canvas with link previews.', color: '#f97316' },
              { icon: Inbox, title: 'Smart Dump', desc: 'AI-powered dump that classifies and routes captured items.', color: '#14b8a6' },
              { icon: Search, title: 'Global Search', desc: 'Find anything instantly across all workspaces and types.', color: '#6366f1' },
              { icon: Palette, title: 'Custom Themes', desc: 'Choose built-in themes or create your own color scheme.', color: '#e11d48' },
              { icon: Layout, title: 'Flexible Layout', desc: 'Move sidebar, resize panels, split views your way.', color: '#84cc16' },
              { icon: Shield, title: 'Local-First', desc: 'Works offline. Your data syncs when connected, stays yours.', color: '#64748b' },
            ].map(({ icon: Icon, title, desc, color }, i) => (
              <FadeIn key={title} delay={(i % 3) * 100}>
                <div className="group rounded-xl border border-border/50 bg-surface/50 p-5 hover:border-accent/30 hover:shadow-md transition-all">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110"
                    style={{ background: color + '15' }}
                  >
                    <Icon className="h-5 w-5" style={{ color }} />
                  </div>
                  <h3 className="text-sm font-semibold text-text mb-1.5">{title}</h3>
                  <p className="text-xs text-text-muted leading-relaxed">{desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Spotlight: Canvas */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 gap-16 items-center">
            <FadeIn>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium mb-4">
                Infinite Canvas
              </div>
              <h2 className="text-3xl font-bold mb-4 tracking-tight">Your thoughts, spatially organized</h2>
              <p className="text-text-secondary leading-relaxed mb-6">
                Place nodes anywhere. Draw connections between ideas. Zoom in for detail,
                zoom out for the big picture. The canvas grows with your thinking.
              </p>
              <ul className="space-y-3">
                {[
                  'Infinite zoom and pan with smooth animations',
                  'Drag-and-drop node placement',
                  'Visual connections between related nodes',
                  'Minimap for quick navigation',
                  'Group nodes into workspaces',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-text-secondary">
                    <ChevronRight className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </FadeIn>
            <FadeIn delay={200}>
              <div className="relative rounded-2xl border border-border bg-surface p-6 shadow-xl">
                <div
                  className="absolute inset-6 opacity-20"
                  style={{
                    backgroundImage: 'radial-gradient(circle at 1px 1px, var(--color-border) 0.5px, transparent 0)',
                    backgroundSize: '20px 20px',
                  }}
                />
                <FloatingNode icon={CheckSquare} label="Ship v2.0" color="#22c55e" className="top-8 left-8" delay={0} />
                <FloatingNode icon={FileText} label="PRD Document" color="#3b82f6" className="top-16 right-8" delay={0.5} />
                <FloatingNode icon={StickyNote} label="User feedback" color="#f59e0b" className="bottom-20 left-12" delay={1} />
                <FloatingNode icon={Globe} label="Competitor site" color="#f97316" className="bottom-8 right-6" delay={1.5} />
                <div className="h-52" />
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Spotlight: Editor */}
      <section className="py-20 px-6 bg-bg-secondary/30">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 gap-16 items-center">
            <FadeIn delay={200}>
              <div className="rounded-2xl border border-border bg-surface p-6 shadow-xl">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/50">
                  <FileText className="h-4 w-4 text-accent" />
                  <span className="text-sm font-medium text-text">Project Brief</span>
                </div>
                <div className="space-y-3">
                  <div className="text-lg font-bold text-text">Launch Plan</div>
                  <div className="space-y-1.5">
                    <div className="h-2 bg-text-muted/10 rounded w-full" />
                    <div className="h-2 bg-text-muted/10 rounded w-11/12" />
                    <div className="h-2 bg-text-muted/10 rounded w-4/5" />
                  </div>
                  <div className="text-sm font-semibold text-text mt-3">Key Milestones</div>
                  <div className="space-y-1.5">
                    {['Alpha release', 'Beta testing', 'Public launch'].map((item, i) => (
                      <div key={item} className="flex items-center gap-2 text-xs text-text-secondary">
                        <div className={cn('w-3.5 h-3.5 rounded border flex items-center justify-center', i === 0 ? 'bg-accent border-accent' : 'border-border')}>
                          {i === 0 && <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        <span className={i === 0 ? 'line-through text-text-muted' : ''}>{item}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 mt-3 px-3 py-2 rounded-lg bg-bg-tertiary/50 border border-border/30">
                    <span className="text-text-muted text-xs">/</span>
                    <span className="text-xs text-text-muted">Type a command...</span>
                  </div>
                </div>
              </div>
            </FadeIn>
            <FadeIn>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium mb-4">
                Rich Editor
              </div>
              <h2 className="text-3xl font-bold mb-4 tracking-tight">Write with power and simplicity</h2>
              <p className="text-text-secondary leading-relaxed mb-6">
                A full-featured editor with slash commands, markdown shortcuts,
                and block-based editing. Write docs that live alongside your tasks and ideas.
              </p>
              <ul className="space-y-3">
                {[
                  'Slash commands for quick block insertion',
                  'Headings, lists, code blocks, callouts',
                  'Todo lists with completion tracking',
                  'Inline links and formatting',
                  'Export and share documents',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-text-secondary">
                    <ChevronRight className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Views */}
      <section id="views" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <FadeIn className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4 tracking-tight">Multiple ways to see your work</h2>
            <p className="text-text-secondary max-w-xl mx-auto">
              Switch between canvas, board, calendar, and graph views instantly.
            </p>
          </FadeIn>

          <div className="grid grid-cols-2 gap-6">
            {[
              { icon: Layout, title: 'Canvas', desc: 'Infinite spatial canvas. Place nodes anywhere, draw connections, zoom and pan.', color: '#3b82f6', preview: 'Spatial thinking, redefined' },
              { icon: LayoutGrid, title: 'Board', desc: 'Kanban-style board for tasks. Drag cards between columns to update status.', color: '#22c55e', preview: 'Project management, simplified' },
              { icon: Calendar, title: 'Calendar', desc: 'See all events on a calendar. Two-way sync with Google Calendar.', color: '#f59e0b', preview: 'Time management, visualized' },
              { icon: GitFork, title: 'Graph', desc: 'Knowledge graph showing how your nodes connect. Click to navigate.', color: '#8b5cf6', preview: 'Connections, revealed' },
            ].map(({ icon: Icon, title, desc, color, preview }, i) => (
              <FadeIn key={title} delay={i * 100}>
                <div className="group flex gap-5 items-start p-6 rounded-2xl border border-border/50 bg-surface/30 hover:border-accent/30 hover:shadow-md transition-all">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
                    style={{ background: color + '12' }}
                  >
                    <Icon className="h-7 w-7" style={{ color }} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-text mb-1">{title}</h3>
                    <p className="text-sm text-text-muted leading-relaxed mb-2">{desc}</p>
                    <span className="text-xs text-accent font-medium">{preview}</span>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Themes */}
      <section id="themes" className="py-20 px-6 bg-bg-secondary/30">
        <div className="max-w-6xl mx-auto">
          <FadeIn className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4 tracking-tight">Make it yours</h2>
            <p className="text-text-secondary max-w-xl mx-auto">
              Choose from 8 built-in themes or create your own. Every color is customizable.
            </p>
          </FadeIn>

          <div className="grid grid-cols-4 gap-4">
            {[
              { name: 'Notion Light', colors: ['#ffffff', '#f7f6f3', '#2eaadc', '#37352f'] },
              { name: 'Notion Dark', colors: ['#191919', '#202020', '#529cca', '#e3e3e1'] },
              { name: 'Parchment', colors: ['#f5f0e8', '#ece6d9', '#8b6f4e', '#3d3429'] },
              { name: 'Ink', colors: ['#1a1a1e', '#222226', '#a09080', '#d4d2cc'] },
              { name: 'Moss', colors: ['#1c201c', '#232823', '#7a9468', '#d0d4c8'] },
              { name: 'Dusk', colors: ['#1e1a22', '#26222a', '#9a7eb0', '#d4d0d8'] },
              { name: 'Ocean', colors: ['#0f1923', '#162230', '#48b1bf', '#c8d6e5'] },
              { name: 'Rose', colors: ['#fdf2f8', '#fce7f3', '#db2777', '#4a1942'] },
            ].map((theme, i) => (
              <FadeIn key={theme.name} delay={(i % 4) * 80}>
                <div className="group rounded-xl border border-border/50 p-4 hover:border-accent/30 hover:shadow-md transition-all cursor-pointer">
                  <div className="flex gap-2 mb-3">
                    {theme.colors.map((c, j) => (
                      <div
                        key={j}
                        className="w-8 h-8 rounded-lg border border-border/20 transition-transform group-hover:scale-110"
                        style={{ background: c, transitionDelay: `${j * 50}ms` }}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-medium text-text">{theme.name}</span>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn className="text-center mt-8">
            <p className="text-sm text-text-muted">
              Plus unlimited custom themes with full color control
            </p>
          </FadeIn>
        </div>
      </section>

      {/* Tech stack */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <FadeIn className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4 tracking-tight">Built with modern tech</h2>
            <p className="text-text-secondary max-w-xl mx-auto">
              Native desktop performance with web flexibility.
            </p>
          </FadeIn>

          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Tauri 2', desc: 'Native shell', icon: Monitor },
              { label: 'React 19', desc: 'UI framework', icon: Cpu },
              { label: 'TypeScript', desc: 'Type-safe code', icon: Lock },
              { label: 'Zustand', desc: 'State management', icon: Layers },
            ].map(({ label, desc, icon: Icon }, i) => (
              <FadeIn key={label} delay={i * 100}>
                <div className="text-center p-4 rounded-xl border border-border/50 bg-surface/30">
                  <Icon className="h-6 w-6 text-accent mx-auto mb-2" />
                  <div className="text-sm font-semibold text-text">{label}</div>
                  <div className="text-xs text-text-muted">{desc}</div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/8 rounded-full blur-3xl" />
        </div>
        <FadeIn className="max-w-3xl mx-auto text-center relative">
          <h2 className="text-3xl font-bold mb-4 tracking-tight">Ready to enter your flow state?</h2>
          <p className="text-lg text-text-secondary mb-10">
            Start organizing your thoughts, tasks, and projects on an infinite canvas.
          </p>
          <button
            onClick={onGetStarted}
            className="group inline-flex items-center gap-2.5 px-8 py-4 text-base font-semibold bg-accent text-white rounded-xl hover:bg-accent-hover transition-all shadow-xl shadow-accent/25 cursor-pointer"
          >
            Get Started Free
            <ArrowRight className="h-5 w-5 group-hover:translate-x-0.5 transition-transform" />
          </button>
          <p className="text-xs text-text-muted mt-4">No account required. Your data stays on your device.</p>
        </FadeIn>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/30 py-10 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent to-accent/60 flex items-center justify-center">
              <Layers className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-text">FlowState</span>
          </div>
          <p className="text-xs text-text-muted">Built with care. Your data, your way.</p>
        </div>
      </footer>
    </div>
    </ScrollCtx.Provider>
  )
}
