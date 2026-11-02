"use client";

import { useState } from "react";
import { decodeUsers, useAuth } from "@/components/auth-provider";
import { useResource } from "@/lib/use-resource";

function UserOptions({ onRetry }: { onRetry: () => void }) {
  const users = useResource("/api/auth/demo-users", decodeUsers);
  const auth = useAuth();
  const busy = auth.phase === "loading" || auth.phase === "switching";
  return <div className="user-controls">
    <label className="sr-only" htmlFor="demo-user">演示用户</label>
    <select id="demo-user" aria-label="选择演示用户" value={auth.user?.id ?? ""} disabled={busy || users.status !== "success"}
      onChange={(event) => { void auth.switchUser(event.target.value); }}>
      <option value="" disabled>{busy ? "正在确认身份…" : "选择演示用户"}</option>
      {users.status === "success" && users.data.map((user) => <option key={user.id} value={user.id}>{user.displayName} · 演示账号</option>)}
    </select>
    {auth.user && <button type="button" className="text-button" onClick={() => { void auth.switchUser(null); }} disabled={busy}>退出</button>}
    {users.status === "error" && <button type="button" className="text-button" onClick={onRetry}>重载用户</button>}
    {auth.phase === "error" && <button className="text-button identity-error" type="button" onClick={auth.refresh}>{auth.message} 点击重试</button>}
  </div>;
}

export function UserSwitcher() {
  const [revision, setRevision] = useState(0);
  return <UserOptions key={revision} onRetry={() => setRevision((value) => value + 1)} />;
}
