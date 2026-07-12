import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface TagData {
  tagName: string;
  problemsSolved: number;
}

interface Props {
  tags: TagData[];
}

function BarFallback({ tags }: { tags: TagData[] }) {
  const max = Math.max(...tags.map(t => t.problemsSolved), 1);
  return (
    <div className="space-y-2" role="list" aria-label="Topic tag breakdown">
      {tags.map(tag => {
        const pct = Math.round((tag.problemsSolved / max) * 100);
        const color = tag.problemsSolved > 15
          ? '#10b981'
          : tag.problemsSolved > 8
          ? '#f59e0b'
          : '#6366f1';
        return (
          <div key={tag.tagName} role="listitem" className="flex items-center gap-3">
            <span
              className="text-xs w-28 text-right shrink-0 truncate"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {tag.tagName}
            </span>
            <div
              className="flex-1 rounded-full h-2"
              style={{ background: 'rgba(99,102,241,0.12)' }}
            >
              <div
                className="h-2 rounded-full"
                style={{ width: `${pct}%`, background: color }}
                role="progressbar"
                aria-valuenow={tag.problemsSolved}
                aria-valuemin={0}
                aria-valuemax={max}
              />
            </div>
            <span className="text-xs w-6 shrink-0" style={{ color: 'var(--color-text-muted)' }}>
              {tag.problemsSolved}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function TopicRadarChart({ tags }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const topTags = [...tags]
    .sort((a, b) => b.problemsSolved - a.problemsSolved)
    .slice(0, 8);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion || !svgRef.current || topTags.length < 3) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const size = 280;
    const cx = size / 2;
    const cy = size / 2;
    const radius = 100;
    const n = topTags.length;
    const max = Math.max(...topTags.map(t => t.problemsSolved), 1);

    const angleSlice = (Math.PI * 2) / n;

    // Grid circles
    [0.25, 0.5, 0.75, 1].forEach(frac => {
      svg.append('circle')
        .attr('cx', cx)
        .attr('cy', cy)
        .attr('r', radius * frac)
        .attr('fill', 'none')
        .attr('stroke', 'rgba(99,102,241,0.15)')
        .attr('stroke-width', 1);
    });

    // Axes
    topTags.forEach((_, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      svg.append('line')
        .attr('x1', cx)
        .attr('y1', cy)
        .attr('x2', cx + radius * Math.cos(angle))
        .attr('y2', cy + radius * Math.sin(angle))
        .attr('stroke', 'rgba(99,102,241,0.2)')
        .attr('stroke-width', 1);
    });

    // Data polygon
    const points = topTags.map((tag, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      const r = (tag.problemsSolved / max) * radius;
      return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as [number, number];
    });

    const lineGen = d3.line<[number, number]>()
      .x(d => d[0])
      .y(d => d[1])
      .curve(d3.curveLinearClosed);

    // Fill
    svg.append('path')
      .datum(points)
      .attr('d', lineGen)
      .attr('fill', 'rgba(99,102,241,0.15)')
      .attr('stroke', 'none');

    // Stroke (animated)
    const path = svg.append('path')
      .datum(points)
      .attr('d', lineGen)
      .attr('fill', 'none')
      .attr('stroke', '#6366f1')
      .attr('stroke-width', 2);

    const totalLen = (path.node() as SVGPathElement).getTotalLength();
    path
      .attr('stroke-dasharray', totalLen)
      .attr('stroke-dashoffset', totalLen)
      .transition()
      .duration(800)
      .ease(d3.easeCubicOut)
      .attr('stroke-dashoffset', 0);

    // Dots
    svg.selectAll('.radar-dot')
      .data(points)
      .join('circle')
      .attr('class', 'radar-dot')
      .attr('cx', d => d[0])
      .attr('cy', d => d[1])
      .attr('r', 3)
      .attr('fill', '#6366f1');

    // Labels
    topTags.forEach((tag, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      const labelR = radius + 18;
      const x = cx + labelR * Math.cos(angle);
      const y = cy + labelR * Math.sin(angle);
      svg.append('text')
        .attr('x', x)
        .attr('y', y)
        .attr('text-anchor', Math.cos(angle) > 0.1 ? 'start' : Math.cos(angle) < -0.1 ? 'end' : 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', 9)
        .attr('fill', '#94a3b8')
        .attr('font-family', 'Inter, system-ui, sans-serif')
        .text(tag.tagName.length > 12 ? tag.tagName.slice(0, 11) + '…' : tag.tagName);
    });
  }, [prefersReducedMotion, topTags]);

  if (topTags.length === 0) {
    return (
      <div
        className="rounded-xl py-10 text-center"
        style={{ background: 'rgba(99,102,241,0.06)' }}
      >
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          No topic data available
        </p>
      </div>
    );
  }

  if (prefersReducedMotion || topTags.length < 3) {
    return <BarFallback tags={topTags} />;
  }

  return (
    <div aria-label="Topic distribution radar chart">
      <svg
        ref={svgRef}
        viewBox="0 0 280 280"
        width={280}
        height={280}
        style={{ display: 'block', margin: '0 auto', overflow: 'visible' }}
        aria-hidden="true"
      />
    </div>
  );
}
