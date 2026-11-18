import { ArrowRight, ArrowUpRight, Check, ChevronDown, Cpu, Paperclip, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { catalog, modes } from '../../shared/catalog.mjs';
import type { Mode } from '../lib/types';
import { useWorkspace } from '../lib/workspace';
import { Button, ErrorLine, IconButton } from './UI';
export function Composer({ hero = false }: { hero?: boolean }) {
  const w = useWorkspace(),
    [picker, setPicker] = useState(false),
    [attachment, setAttachment] = useState<{ name: string; text: string } | null>(null),
    ref = useRef<HTMLTextAreaElement>(null),
    file = useRef<HTMLInputElement>(null),
    menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!picker) return;
    const close = (e: MouseEvent) => {
      if (!menu.current?.contains(e.target as Node)) setPicker(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPicker(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', key);
    };
  }, [picker]);
  const generate = () =>
    void w.analyze(w.prompt + (attachment ? '\n\nProject context:\n' + attachment.text : ''));
  const suggest = (s: string) => {
    w.setPrompt(s);
    w.setAnalysisError('');
    ref.current?.focus();
  };
  return (
    <div className={hero ? 'composer-block' : 'composer-block standalone'}>
      <div className="composer">
        <textarea
          ref={ref}
          data-prompt
          aria-label="Application description"
          maxLength={6500}
          placeholder="Describe the application you want to build…"
          value={w.prompt}
          onChange={(e) => w.setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !w.analyzing) {
              e.preventDefault();
              generate();
            }
          }}
        />
        {attachment && (
          <div className="attach-tag">
            <Paperclip size={11} />
            {attachment.name}
            <button aria-label="Remove attachment" onClick={() => setAttachment(null)}>
              <X size={11} />
            </button>
          </div>
        )}
        <div className="composer-tools">
          <div className="composer-left">
            <IconButton
              label="Attach project context (.txt, .md, .json, .csv)"
              onClick={() => file.current?.click()}
            >
              <Paperclip size={16} />
            </IconButton>
            <input
              ref={file}
              hidden
              type="file"
              accept=".txt,.md,.json,.csv"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 6000 || !/^.+\.(txt|md|csv|json)$/i.test(f.name)) {
                  w.setAnalysisError(
                    'Choose a text, Markdown, JSON or CSV file smaller than 6 KB.',
                  );
                  return;
                }
                try {
                  const t = await f.text();
                  if (t.length + w.prompt.length > 7900) {
                    w.setAnalysisError(
                      'Keep the combined prompt and attachment below 8,000 characters.',
                    );
                    return;
                  }
                  setAttachment({ name: f.name, text: t });
                  w.setAnalysisError('');
                } catch {
                  w.setAnalysisError('This file could not be read.');
                }
                e.target.value = '';
              }}
            />
            <i className="vline" />
            <div ref={menu} className="picker-wrap">
              <button
                className={'model-picker ' + (picker ? 'selected' : '')}
                onClick={() => setPicker(!picker)}
                aria-expanded={picker}
              >
                <Cpu size={15} />
                {w.engine === 'local'
                  ? 'Local engine'
                  : w.engine
                    ? w.data.providers.find((p) => p.slug === w.engine)?.name
                    : w.mode === 'Automatic'
                      ? 'Auto router'
                      : w.mode + ' router'}
                <ChevronDown size={12} />
              </button>
              {picker && (
                <div className="popover model-menu">
                  <div className="menu-label">ROUTING MODE</div>
                  {modes.map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        w.setMode(m as Mode);
                        w.setEngine('');
                        setPicker(false);
                      }}
                    >
                      {m}
                      {w.mode === m && !w.engine && <Check size={13} />}
                    </button>
                  ))}
                  <div className="menu-label divided">ENGINE OVERRIDE</div>
                  {[
                    { slug: 'local', name: 'Local engine' },
                    ...w.data.providers.filter((p) => p.configured),
                  ].map((p) => (
                    <button
                      key={p.slug}
                      onClick={() => {
                        w.setEngine(p.slug);
                        setPicker(false);
                      }}
                    >
                      {p.name}
                      {w.engine === p.slug && <Check size={13} />}
                    </button>
                  ))}
                  {!w.data.providers.some((p) => p.configured) && (
                    <p className="router-help">
                      No external providers configured. Requests use the local engine.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
          <Button
            className="generate-button"
            variant="primary"
            busy={w.analyzing}
            onClick={generate}
          >
            {w.analyzing ? 'Planning…' : 'Generate'}
            {!w.analyzing && <ArrowRight size={16} />}
          </Button>
        </div>
      </div>
      <ErrorLine text={w.analysisError} />
      <div className="suggestions">
        <span className="try-label">Try a prompt</span>
        {[
          { name: 'CRM system', i: 0 },
          { name: 'Inventory tracker', i: 1 },
          { name: 'Data dashboard', i: 2 },
        ].map((x) => (
          <button key={x.name} onClick={() => suggest(catalog[x.i].prompt)}>
            {x.name}
            <ArrowUpRight size={11} />
          </button>
        ))}
      </div>
    </div>
  );
}
