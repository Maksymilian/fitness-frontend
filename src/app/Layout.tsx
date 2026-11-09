import { type FormEvent, useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { flowId } from '../platform/flow';
import { TEST_MEMBERS, useMember } from './member-context';
import { ServiceHealth } from './ServiceHealth';

function MemberPicker() {
  const { memberId, chooseMember } = useMember();
  const [typed, setTyped] = useState(memberId);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    chooseMember(typed);
  };
  return (
    <form className="member-picker" onSubmit={submit}>
      <label htmlFor="member-id">Member</label>
      <input
        id="member-id"
        type="email"
        required
        list="test-members"
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        autoComplete="off"
      />
      <datalist id="test-members">
        {TEST_MEMBERS.map((member) => (
          <option key={member} value={member} />
        ))}
      </datalist>
      <button type="submit" disabled={typed.trim().toLowerCase() === memberId}>
        Choose
      </button>
    </form>
  );
}

const MEMBER_APP = [
  { to: '/', label: 'Training', end: true },
  { to: '/training-goals', label: 'Training goals' },
  { to: '/membership', label: 'Membership' },
];
const BACK_OFFICE = [
  { to: '/equipment', label: 'Equipment' },
  { to: '/workouts', label: 'Workouts' },
];

export function Layout() {
  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          Fitness platform
        </div>
        <MemberPicker />
      </header>
      <nav className="nav" aria-label="Main">
        <div className="nav-group">
          <span className="nav-heading">Member app</span>
          {MEMBER_APP.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end}>
              {label}
            </NavLink>
          ))}
        </div>
        <div className="nav-group">
          <span className="nav-heading">Back office</span>
          {BACK_OFFICE.map(({ to, label }) => (
            <NavLink key={to} to={to}>
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
      <main className="content">
        <Outlet />
      </main>
      <footer className="footer">
        <ServiceHealth />
        <p className="flow" title="Every request of this tab carries it as W3C Baggage: find them in Grafana by session.id">
          Flow <code>{flowId()}</code>
        </p>
      </footer>
    </div>
  );
}
