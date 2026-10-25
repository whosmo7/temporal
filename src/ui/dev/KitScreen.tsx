import { useState } from 'react';
import { Button, Dialog, Icon, Panel, PixelIcon, TextInput, type IconName, type PixelIconName } from '../kit';
import uiAtlas from '../kit/ui-atlas.json';
import { palette } from '../theme/palette';
import { LandMeter } from '../hud/Hud';
import { Toolbar } from '../hud/Toolbar';
import { landOf } from '../hud/land';
import type { Tool } from '../hud/copy';

const ICONS: IconName[] = ['close', 'undo', 'eraser', 'clear', 'left', 'right'];

/** Dev-only sheet of every kit component and state, at `#/dev/kit`. */
export function KitScreen() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [held, setHeld] = useState<Tool>('can');

  return (
    <div style={{ display: 'grid', gap: 24, gridTemplateColumns: '1fr 1fr', maxWidth: 1100, width: '100%' }}>
      <Panel title="Buttons">
        <div style={{ display: 'flex', gap: 15, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button variant="primary">Play</Button>
          <Button>Gallery</Button>
          <Button disabled>Disabled</Button>
          <Button variant="quiet">Cancel</Button>
          <Button icon="undo">Undo</Button>
          <Button icon="close" iconOnly>
            Close
          </Button>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginTop: 18 }}>
          <Button size="sm" variant="primary">
            Small primary
          </Button>
          <Button size="sm">Small</Button>
          <Button size="sm" icon="eraser" iconOnly>
            Eraser
          </Button>
          <Button size="sm" icon="clear" iconOnly>
            Clear
          </Button>
        </div>
      </Panel>

      <Panel title="Toolbar and land (13)">
        <div
          style={{ display: 'grid', gap: 18 }}
          tabIndex={0}
          onKeyDown={(e) => {
            const tool = ({ '1': 'hands', '2': 'seeds', '3': 'can' } as Record<string, Tool>)[e.key];
            if (tool) setHeld(tool);
          }}
        >
          <Toolbar held={held} data={{ seeds: 7, can: { pours: 2, capacity: 3 } }} />
          <Toolbar held="hands" data={{ seeds: null, can: null }} />
          {[30, 55, 78].map((health, i) => {
            const land = landOf({ health, level: i * 2 });
            return land && <LandMeter key={health} land={land} />;
          })}
        </div>
      </Panel>

      <Panel title="Fields">
        <div style={{ display: 'grid', gap: 18 }}>
          <TextInput
            label="Username"
            hint="3–20 lowercase letters, digits or _"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="al"
          />
          <TextInput label="Password" type="password" error="Wrong password." defaultValue="hunter2" />
        </div>
      </Panel>

      <Panel title="Paper" tone="paper">
        <p className="font-hand" style={{ margin: '0 0 18px', fontSize: 23 }}>
          I put something in by the east fence. Water it if you can.
        </p>
        <div style={{ display: 'flex', gap: 15 }}>
          <Button variant="primary">Seal</Button>
          <Button variant="quiet">Not yet</Button>
        </div>
      </Panel>

      <Panel title="Dialog and icons">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 18 }}>
          {ICONS.map((n) => (
            <Icon key={n} name={n} scale={3} label={n} />
          ))}
        </div>
        <Button onClick={() => setOpen(true)}>Open dialog</Button>
        <Dialog
          open={open}
          title="Log out?"
          onClose={() => setOpen(false)}
          actions={
            <>
              <Button variant="quiet" onClick={() => setOpen(false)}>
                Stay
              </Button>
              <Button variant="primary" onClick={() => setOpen(false)}>
                Log out
              </Button>
            </>
          }
        >
          <p style={{ margin: 0 }}>Your world stays as you left it.</p>
        </Dialog>
      </Panel>

      <div style={{ gridColumn: '1 / -1' }}>
        <Panel title="Pack icons (HUD 2×, hotbar 3×)">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'end' }}>
            {(Object.keys(uiAtlas.frames) as PixelIconName[]).map((n) => (
              <div key={n} style={{ display: 'grid', justifyItems: 'center', gap: 6 }}>
                <PixelIcon name={n} scale={3} label={n} />
                <PixelIcon name={n} scale={2} />
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)' }}>{n.replace('ui/icon-', '')}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <Panel title="Palette">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {Object.entries(palette).map(([k, v]) => (
              <div key={k} title={`${k} ${v}`} style={{ width: 48, height: 48, background: v }} />
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
