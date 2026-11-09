import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <div className="page-heading">
      <h1>Not found</h1>
      <p>
        No page here. <Link to="/">Back to Training</Link>.
      </p>
    </div>
  );
}
