import { Link } from 'react-router-dom';
import type { ScoreRow } from './scoresData';

/**
 * Locked generation scores (decision 039) as a table: the Scores page and the admin panel. `ranked`
 * adds the place and who played. Each world name links to its replay.
 */
export function ScoreTable({ rows, you, ranked = false }: { rows: ScoreRow[]; you?: string; ranked?: boolean }) {
  return (
    <table className="score-table">
      <thead>
        <tr>
          {ranked && <th scope="col" aria-label="Place" />}
          {ranked && <th scope="col">Who</th>}
          <th scope="col">World</th>
          <th scope="col">Grown and gathered</th>
          <th scope="col">Kept</th>
          <th scope="col">Cost of keeping</th>
          <th scope="col">The world they left</th>
          <th scope="col">In all</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.worldId}:${r.turn}`} className={ranked && r.username === you ? 'score-table__you' : undefined}>
            {ranked && <td className="score-table__place">{i + 1}</td>}
            {ranked && <td className="score-table__name">{r.username}</td>}
            <td className="score-table__name">
              <Link to={`/world/${r.worldId}/replay`}>{r.worldName}</Link> <span className="score-table__when">Gen {r.turn}</span>
            </td>
            <td>{fmt(r.productive)}</td>
            <td>{fmt(r.extraction)}</td>
            <td>{r.corruption > 0 ? `−${fmt(r.corruption)}` : fmt(0)}</td>
            <td>{fmt(r.exitBonus)}</td>
            <td className="score-table__total">{fmt(r.total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Locked scores carry one decimal; whole numbers show without it. */
function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
