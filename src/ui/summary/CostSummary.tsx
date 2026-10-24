import { Fragment } from 'react';
import { Button, Panel, PixelIcon, type PixelIconName } from '../kit';
import type { CostSummaryView, SummaryRow } from './summaryView';
import './summary.css';

const ICON: Record<string, { name: PixelIconName; label: string }> = {
  '⚡': { name: 'ui/icon-stamina', label: 'stamina' },
  '💧': { name: 'ui/icon-water', label: 'water' },
  '🍎': { name: 'ui/icon-food', label: 'food' },
};

/**
 * "What you gave" (05): shown after the page is sealed, before the stone rises. Realised outcomes
 * only, from `costSummary()`. Wording: docs/content/cost-summary.md.
 */
export function CostSummary({ view, onContinue }: { view: CostSummaryView; onContinue: () => void }) {
  const { night, store } = view;
  const short = night.short;
  return (
    <div className="cost-summary" role="dialog" aria-modal="true" aria-labelledby="cost-summary-title">
      <Panel tone="paper" className="cost-summary__panel">
        <h2 id="cost-summary-title" className="cost-summary__title">
          What you gave
        </h2>
        <div className="cost-summary__lines">
          {[view.spentLine, view.waterLine, view.foodLine, view.eatenLine, view.rottedLine]
            .filter((l): l is string => !!l)
            .map((line) => (
              <p key={line}>
                <WithIcons text={line} />
              </p>
            ))}
        </div>
        {view.rows.length > 0 && (
          <table className="cost-summary__rows">
            <tbody>
              {view.rows.map((row) => (
                <Row key={row.label} row={row} />
              ))}
            </tbody>
          </table>
        )}
        <p>
          <WithIcons
            text={
              `For the night: ${night.food}🍎 ${night.water}💧 — ` +
              (short ? `short by ${[short.food > 0 && `${short.food}🍎`, short.water > 0 && `${short.water}💧`].filter(Boolean).join(' ')}.` : 'enough.')
            }
          />
        </p>
        <p>
          <WithIcons text={`Left in the store: ${store.food}🍎 ${store.water}💧`} />
        </p>
        <div className="cost-summary__actions">
          <Button variant="primary" onClick={onContinue} autoFocus>
            Continue
          </Button>
        </div>
      </Panel>
    </div>
  );
}

function Row({ row }: { row: SummaryRow }) {
  const label = row.count > 1 || needsCount(row.label) ? `${row.label} ×${row.count}` : row.label;
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>{row.stamina !== 0 && <WithIcons text={`${signed(row.stamina)}⚡`} />}</td>
      <td>{row.water !== 0 && <WithIcons text={`${signed(row.water)}💧`} />}</td>
      <td>{row.food !== 0 && <WithIcons text={`${signed(row.food)}🍎`} />}</td>
    </tr>
  );
}

/** One-off builds read as a thing ("Orchard", "Well"); repeatable work keeps its count ("Hunt ×1"). */
function needsCount(label: string): boolean {
  return !['Orchard', 'Reservoir wall', 'Well'].includes(label) && !label.startsWith('Hurried');
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `−${-n}`;
}

/** The copy keeps ⚡💧🍎 so it reads in the docs; on screen they become the pack's icons. */
function WithIcons({ text }: { text: string }) {
  const parts = text.split(/(⚡|💧|🍎)/u);
  return (
    <>
      {parts.map((part, i) => {
        const icon = ICON[part];
        return icon ? (
          <PixelIcon key={i} name={icon.name} scale={2} label={icon.label} className="cost-summary__icon" />
        ) : (
          <Fragment key={i}>{part}</Fragment>
        );
      })}
    </>
  );
}
