// Araç panosu: eklenebilir, kaldırılabilir, sıralanabilir cam kartlar.
import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useOverlayFlag } from "./parts";
import { loadWidgets, saveWidgets, type WidgetType } from "./stores";
import { WIDGET_INFO, WidgetBody, WidgetShell } from "./Widgets";

const TYPES = Object.keys(WIDGET_INFO) as WidgetType[];

export default function WidgetBoard(): React.JSX.Element {
  const [list, setList] = useState<WidgetType[]>(loadWidgets);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useOverlayFlag(menu);

  const update = (next: WidgetType[]): void => {
    setList(next);
    saveWidgets(next);
  };
  const move = (i: number, dir: -1 | 1): void => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = list.slice();
    [next[i], next[j]] = [next[j], next[i]];
    update(next);
  };

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent): void => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setMenu(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const available = TYPES.filter((t) => !list.includes(t));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex shrink-0 items-center justify-between px-1">
        <span className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">
          Araçlar
        </span>
        <div className="relative" ref={menuRef}>
          <button
            className="glass glass-press flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-text"
            onClick={() => setMenu((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menu}
          >
            <Plus size={15} /> Araç ekle
          </button>
          {menu && (
            <div className="absolute right-0 top-11 z-30 w-64 animate-scale-in">
              <div className="glass rounded-2xl p-1.5" role="menu">
                <div className="absolute inset-0 -z-10 rounded-[inherit] bg-bg/80" />
                {available.length === 0 ? (
                  <div className="px-3 py-3 text-sm text-muted">
                    Tüm araçlar ekli.
                  </div>
                ) : (
                  available.map((t) => {
                    const info = WIDGET_INFO[t];
                    const Icon = info.icon;
                    return (
                      <button
                        key={t}
                        role="menuitem"
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-text/10"
                        onClick={() => {
                          update([...list, t]);
                          setMenu(false);
                        }}
                      >
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-text/10 text-text">
                          <Icon size={15} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-text">
                            {info.label}
                          </span>
                          <span className="block truncate text-xs text-muted">
                            {info.desc}
                          </span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="grid flex-1 place-items-center text-center text-sm text-muted">
          <div>
            <p>Panoda araç yok.</p>
            <p className="mt-1">
              “Araç ekle” ile saat, kronometre ya da pomodoro ekleyebilirsin.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 auto-rows-[minmax(224px,1fr)] grid-cols-2 gap-4 overflow-y-auto pb-2 pr-1 min-[1360px]:grid-cols-3">
          {list.map((t, i) => (
            <WidgetShell
              key={t}
              title={WIDGET_INFO[t].label}
              big={i === 0 && t === "clock"}
              canLeft={i > 0}
              canRight={i < list.length - 1}
              onMove={(d) => move(i, d)}
              onRemove={() => update(list.filter((x) => x !== t))}
            >
              <WidgetBody type={t} big={i === 0 && t === "clock"} />
            </WidgetShell>
          ))}
        </div>
      )}
    </div>
  );
}
