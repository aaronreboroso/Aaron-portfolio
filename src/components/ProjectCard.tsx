import { ArrowUpRight, Clock3, Layers2 } from 'lucide-react';
import { artFor, kindName, number, relative } from '../lib/client';
import type { ProjectSummary } from '../lib/types';
import { Link } from './UI';
export function ProjectCard({
  project: p,
  index = 0,
}: {
  project: ProjectSummary;
  index?: number;
}) {
  return (
    <Link className={'project-card art-' + p.kind} href={'/workspace/' + p.id}>
      <div className="project-art">
        <img src={artFor(p.kind)} alt="" />
        <span className="figure-label">
          PRJ <i>/</i> {number(index + 1).padStart(3, '0')}
        </span>
        <span className="open-indicator">
          <ArrowUpRight size={14} />
        </span>
      </div>
      <div className="project-info">
        <div className="project-name">
          <h3>{p.name}</h3>
          <span className="ready-dot" title="Source and preview ready" />
        </div>
        <p>{kindName(p.kind)}</p>
        <div className="project-foot">
          <span>
            <Clock3 size={12} />
            Edited {relative(p.updated)}
          </span>
          <span>
            <Layers2 size={12} />
            {p.files} files
          </span>
        </div>
      </div>
    </Link>
  );
}
