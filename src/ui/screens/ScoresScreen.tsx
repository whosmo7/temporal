import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { backend, type CompletedWorld } from '../../api';
import { useSession } from '../../store/session';
import { ButtonLink, Panel } from '../kit';
import { byTotal, rowsOf, scoreRows, type ScoreRow } from '../scores/scoresData';

type Load = { state: 'loading' } | { state: 'error' } | { state: 'ready'; worlds: CompletedWorld[] };

/** How many of the highest scores the page lists. */
const TOP = 10;

/**
 * `/scores` (decision 039), for a signed-in player: their own locked scores, then the highest
 * anyone has reached. From finished worlds only, so it never reveals a world still being played.
 */
export function ScoresScreen() {
  const user = useSession((s) => s.user);
  const [load, setLoad] = useState<Load>({ state: 'loading' });

  useEffect(() => {
    let live = true;
    backend
      .listCompletedWorlds()
      .then((worlds) => live && setLoad({ state: 'ready', worlds }))
      .catch(() => live && setLoad({ state: 'error' }));
    return () => {
      live = false;
    };
  }, []);

  const rows = useMemo(() => (load.state === 'ready' ? scoreRows(load.worlds) : []), [load]);
  const mine = useMemo(() => (user ? rowsOf(rows, user.username) : []), [rows, user]);
  const top = useMemo(() => byTotal(rows).slice(0, TOP), [rows]);

  if (load.state === 'loading') return null;

  if (load.state === 'error') {
    return (
      <Panel title="Scores" className="gallery-empty">
        <p>The scores couldn’t be reached. Try again in a moment.</p>
      </Panel>
    );
  }

  return (
    <section className="scores" aria-labelledby="scores-title">
      <h1 id="scores-title" className="gallery__title">
        Scores
      </h1>
      <p className="scores__note">A generation’s score shows once its world has reached its last generation.</p>
      <Panel title="Yours" className="scores__panel">
        {mine.length === 0 ? (
          <>
            <p>None of the worlds you lived in has finished yet.</p>
            <ButtonLink to="/play" variant="primary" size="sm">
              Play
            </ButtonLink>
          </>
        ) : (
          <ScoreTable rows={mine} you={user?.username} />
        )}
      </Panel>
      <Panel title="Highest" className="scores__panel">
        {top.length === 0 ? <p>No world has finished yet.</p> : <ScoreTable rows={top} you={user?.username} ranked />}
      </Panel>
    </section>
  );
}

function ScoreTable({ rows, you, ranked = false }: { rows: ScoreRow[]; you?: string; ranked?: boolean }) {
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
