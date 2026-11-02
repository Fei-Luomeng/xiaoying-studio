import Link from "next/link";
import { UserSwitcher } from "@/components/user-switcher";

export function SiteHeader() {
  return (
    <header className="topbar">
      <Link className="brand" href="/" aria-label="拾影首页">
        <span className="brand-mark" aria-hidden="true">拾</span>
        <span>拾影<span className="brand-caption">STUDIO</span></span>
      </Link>
      <nav aria-label="主导航"><Link className="nav-link" href="/">探索模板</Link><Link className="nav-link" href="/history">我的作品</Link></nav>
      <UserSwitcher />
    </header>
  );
}
