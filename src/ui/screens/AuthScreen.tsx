import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { PASSWORD_MIN, USERNAME_PATTERN, useSession } from '../../store/session';
import { Button, Panel, TextInput } from '../kit';

type Mode = 'login' | 'signup';

/** Only same-app paths, so `?next=` can't send anyone off-site. */
function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

/**
 * Log in / sign up, a pixel panel floating over the shell's sky (app-shell brief › Shell).
 * `?next=/play` sends the player on once they are in; `?mode=signup` opens on sign up.
 */
export function AuthScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, status, signIn, signUp } = useSession();
  const next = safeNext(params.get('next'));

  const [mode, setMode] = useState<Mode>(params.get('mode') === 'signup' ? 'signup' : 'login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ username?: string; password?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  if (status === 'ready' && user && !busy) return <Navigate to={next} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const name = username.trim().toLowerCase();
    if (mode === 'signup') {
      const found: typeof errors = {};
      if (!USERNAME_PATTERN.test(name)) found.username = '3 to 20 lowercase letters, digits or _.';
      if (password.length < PASSWORD_MIN) found.password = `At least ${PASSWORD_MIN} characters.`;
      if (found.username || found.password) return setErrors(found);
    }
    setErrors({});
    setBusy(true);
    try {
      await (mode === 'signup' ? signUp(name, password) : signIn(name, password));
      navigate(next, { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (/taken/i.test(message)) setErrors({ username: 'That name is already taken.' });
      else if (mode === 'login') setErrors({ form: 'That username and password don’t match.' });
      else setErrors({ form: 'Couldn’t reach the world. Try again.' });
    } finally {
      setBusy(false);
    }
  }

  function switchMode() {
    setMode(mode === 'login' ? 'signup' : 'login');
    setErrors({});
  }

  return (
    <Panel title={mode === 'login' ? 'Log in' : 'Sign up'} className="auth">
      <form className="auth__form" onSubmit={submit} noValidate>
        <TextInput
          label="Username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          hint={mode === 'signup' ? 'Others will see this on your gravestone.' : undefined}
          error={errors.username}
        />
        <TextInput
          label="Password"
          name="password"
          type="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        {errors.form && (
          <p className="auth__error" role="alert">
            {errors.form}
          </p>
        )}
        <Button type="submit" variant="primary" disabled={busy}>
          {mode === 'login' ? 'Log in' : 'Sign up'}
        </Button>
      </form>
      <p className="auth__switch">
        {mode === 'login' ? 'New here?' : 'Already have a name?'}{' '}
        <Button variant="quiet" size="sm" onClick={switchMode}>
          {mode === 'login' ? 'Sign up' : 'Log in'}
        </Button>
      </p>
    </Panel>
  );
}
