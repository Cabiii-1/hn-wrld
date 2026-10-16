import Link from "next/link";
import { Heart, Leaf } from "lucide-react";
export function ContributionShell({
  children,
  admin = false,
}: {
  children: React.ReactNode;
  admin?: boolean;
}) {
  return (
    <main className={`keepsake-shell ${admin ? "keepsake-admin" : ""}`}>
      <header className="keepsake-header">
        <Link href="/" className="brand">
          <span className="brand-icon">
            <Heart size={22} fill="currentColor" />
          </span>
          <span>
            Bubu’s <span className="brand-light">Little World</span>
            <small>A LITTLE PLACE TO FEEL LOVED</small>
          </span>
        </Link>
        <span className="keepsake-label">
          {admin ? "DUDU’S DESK" : "A LITTLE LOVE NOTE"}
        </span>
      </header>
      {children}
      <footer className="keepsake-footer">
        <Leaf size={14} /> Made of little moments and the people in them.
      </footer>
    </main>
  );
}
export function SetupNotice() {
  return (
    <aside className="setup-notice" role="status">
      <strong>The little post office is being set up.</strong>
      <p>
        Contributions aren’t open just yet. Please check back with the person
        who invited you. The little house is still ready to explore.
      </p>
    </aside>
  );
}
