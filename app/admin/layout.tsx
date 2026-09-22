import "./admin.css";

export const metadata = { title: "Správa obrazoviek" };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin">{children}</div>;
}
