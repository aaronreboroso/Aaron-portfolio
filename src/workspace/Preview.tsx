import { LockKeyhole, Monitor, RotateCw, Smartphone, Tablet } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorLine, IconButton } from '../components/UI';
import { api } from '../lib/client';
import type { Project, Spec } from '../lib/types';
export function Preview({
  project: p,
  design,
  page: preferred,
  compact = false,
  onRecordChange,
}: {
  project: Project;
  design?: Spec;
  page?: string;
  compact?: boolean;
  onRecordChange?: () => Promise<void>;
}) {
  const frame = useRef<HTMLIFrameElement>(null),
    [device, setDevice] = useState('Desktop'),
    [rev, setRev] = useState(0),
    [error, setError] = useState(''),
    [page, setPage] = useState(p.spec.pages[0].id);
  const spec = design || p.spec;
  const sync = useCallback(() => {
    frame.current?.contentWindow?.postMessage(
      { type: 'atrox:design', spec, page: preferred || page },
      '*',
    );
  }, [spec, preferred, page]);
  useEffect(() => {
    sync();
  }, [sync]);
  useEffect(() => {
    let count = 0,
      windowStart = Date.now();
    const receive = async (e: MessageEvent) => {
      if (
        !frame.current ||
        e.source !== frame.current.contentWindow ||
        !e.data ||
        typeof e.data !== 'object'
      )
        return;
      const win = frame.current.contentWindow;
      if (e.data.type === 'atrox:error') {
        setError(String(e.data.message).slice(0, 300));
        return;
      }
      if (e.data.type !== 'atrox:records') return;
      const { ticket, request: r } = e.data;
      if (typeof ticket !== 'string' || ticket.length > 80 || !r) return;
      try {
        if (Date.now() - windowStart > 10000) {
          count = 0;
          windowStart = Date.now();
        }
        if (++count > 80) throw Error('Preview request rate limit reached.');
        if (
          !['GET', 'POST', 'PUT', 'DELETE'].includes(r.method) ||
          !p.spec.pages.some((v) => v.id === r.page)
        )
          throw Error('Save the collection to access its records.');
        if (['GET', 'POST'].includes(r.method) && r.row != null)
          throw Error('Unexpected record identifier.');
        if ((r.method === 'PUT' || r.method === 'DELETE') && !/^[a-z0-9-]{36}$/.test(r.row))
          throw Error('Invalid record ID.');
        if (r.data && JSON.stringify(r.data).length > 24000)
          throw Error('Record exceeds the size limit.');
        const data = await api(
          `/projects/${p.id}/records/${encodeURIComponent(r.page)}${r.row ? '/' + encodeURIComponent(r.row) : ''}`,
          r.method,
          ['POST', 'PUT'].includes(r.method) ? r.data : undefined,
        );
        win?.postMessage({ type: 'atrox:result', ticket, result: data }, '*');
        if (r.method !== 'GET' && onRecordChange)
          void onRecordChange().catch(() =>
            setError('Record saved. Reload the workspace to refresh its activity.'),
          );
      } catch (err) {
        win?.postMessage({ type: 'atrox:result', ticket, error: (err as Error).message }, '*');
      }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [p.id, p.spec, onRecordChange]);
  return (
    <div className={'preview-pane ' + (compact ? 'compact-preview' : '')}>
      <div className="preview-toolbar">
        <span className="preview-address">
          <LockKeyhole size={12} />
          Sandbox preview
        </span>
        <div className="devices">
          {[
            { n: 'Desktop', I: Monitor },
            { n: 'Tablet', I: Tablet },
            { n: 'Mobile', I: Smartphone },
          ].map(({ n, I }) => (
            <IconButton
              key={n}
              label={n + ' preview'}
              aria-pressed={device === n}
              className={device === n ? 'on' : ''}
              onClick={() => setDevice(n)}
            >
              <I size={14} />
            </IconButton>
          ))}
        </div>
        <IconButton
          label="Reload preview"
          onClick={() => {
            setError('');
            setRev((v) => v + 1);
          }}
        >
          <RotateCw size={14} />
        </IconButton>
      </div>
      <div className="frame-bed">
        <iframe
          ref={frame}
          key={p.id + '-' + p.updated + '-' + rev}
          title={'Live preview of ' + p.spec.name}
          sandbox="allow-scripts allow-forms"
          referrerPolicy="no-referrer"
          src={`/api/projects/${p.id}/frame?v=${p.updated}-${rev}`}
          style={{ width: device === 'Mobile' ? '375px' : device === 'Tablet' ? '768px' : '100%' }}
          onLoad={sync}
        />
      </div>
      <div className="preview-footer">
        <span>
          <i />
          Isolated browser runtime
        </span>
        <select
          disabled={!!preferred}
          title={preferred ? 'Select a page in Page structure' : 'Navigate preview'}
          aria-label="Preview collection"
          value={preferred || page}
          onChange={(e) => {
            setPage(e.target.value);
            frame.current?.contentWindow?.postMessage(
              { type: 'atrox:design', spec, page: e.target.value },
              '*',
            );
          }}
        >
          {spec.pages.map((g) => (
            <option key={g.id} value={g.id}>
              {g.title}
            </option>
          ))}
        </select>
      </div>
      <ErrorLine text={error} />
    </div>
  );
}
