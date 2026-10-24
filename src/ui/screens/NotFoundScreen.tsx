import { ButtonLink, Panel } from '../kit';

export function NotFoundScreen() {
  return (
    <Panel title="Nothing here" className="lost">
      <p>This path doesn't lead anywhere.</p>
      <ButtonLink to="/" icon="left">
        Back
      </ButtonLink>
    </Panel>
  );
}
