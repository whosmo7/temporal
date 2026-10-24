import { useEffect, useRef } from 'react';
import { paintAtlas, paintPlot, PLOT_STAGES } from '../../render/placeholder-art';
import { resolveOptions, type Biome, type PlotKind } from '../../worldgen';

const SCALE = 3;

/**
 * Dev page `#/dev/sprites`: every placeholder frame and every plot stage at game scale (3×),
 * labelled with its frame name. For checking that each stage reads at a glance and that C's
 * atlas covers every name.
 */
export function SpriteSheet() {
  const atlas = paintAtlas();
  const sizes = resolveOptions('forest').plotSizes;
  const plotFrames: { name: string; canvas: HTMLCanvasElement }[] = [];
  for (const kind of Object.keys(PLOT_STAGES) as PlotKind[]) {
    const biomes: Biome[] = kind === 'wild' ? ['forest', 'island'] : ['forest'];
    for (const biome of biomes) {
      for (const stage of PLOT_STAGES[kind]) {
        const s = sizes[kind];
        plotFrames.push({ name: `${kind}/${stage}${biomes.length > 1 ? ` (${biome})` : ''}`, canvas: paintPlot(kind, stage, s.w, s.h, biome) });
      }
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#2a2c35', color: '#fefadb', font: '12px monospace', padding: 16, boxSizing: 'border-box' }}>
      <h1 style={{ font: 'bold 16px monospace', margin: '0 0 12px' }}>Placeholder sprites</h1>
      <h2 style={{ font: 'bold 13px monospace' }}>Plot stages</h2>
      <Grid>
        {plotFrames.map((f) => (
          <Frame key={f.name} name={f.name} draw={(ctx) => ctx.drawImage(f.canvas, 0, 0)} w={f.canvas.width} h={f.canvas.height} />
        ))}
      </Grid>
      <h2 style={{ font: 'bold 13px monospace' }}>Atlas frames</h2>
      <Grid>
        {Object.entries(atlas.frames).map(([name, r]) => (
          <Frame key={name} name={name} w={r.w} h={r.h} draw={(ctx) => ctx.drawImage(atlas.canvas, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h)} />
        ))}
      </Grid>
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24, alignItems: 'flex-end' }}>{children}</div>;
}

function Frame({ name, w, h, draw }: { name: string; w: number; h: number; draw: (ctx: CanvasRenderingContext2D) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current!.getContext('2d')!;
    ctx.clearRect(0, 0, w, h);
    draw(ctx);
  });
  return (
    <figure style={{ margin: 0, display: 'grid', gap: 4, justifyItems: 'center' }}>
      <canvas ref={ref} width={w} height={h} style={{ width: w * SCALE, height: h * SCALE, imageRendering: 'pixelated', background: '#91de89' }} />
      <figcaption>{name}</figcaption>
    </figure>
  );
}
