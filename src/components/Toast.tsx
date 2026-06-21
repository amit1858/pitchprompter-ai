import { useEffect, useState } from "react";

let pushFn: ((msg: string) => void) | null = null;

export function toast(msg: string) {
  pushFn?.(msg);
}

export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    pushFn = (m) => {
      setMsg(m);
      window.setTimeout(() => setMsg(null), 3200);
    };
    return () => {
      pushFn = null;
    };
  }, []);
  if (!msg) return null;
  return <div className="toast">{msg}</div>;
}
