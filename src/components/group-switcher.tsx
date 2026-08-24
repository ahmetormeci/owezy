"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTranslate } from "@/lib/i18n";

export type SwitcherGroup = { id: string; name: string };

/**
 * Baslikta duran grup degistirici.
 *
 * NEDEN VAR: kullanicilarin cogunun bir ya da iki grubu oluyor. Gruplar
 * listesi boyle bir kullanici icin arada duran bos bir duraktir - uygulama
 * artik dogrudan grubun icine acilyor (Faz 16.4) ve gruplar arasi gecis
 * buradan yapiliyor.
 *
 * Aktif grubu URL'den okuyoruz, prop olarak almiyoruz: bilesen yapiskan
 * basligin icinde ve her sayfa gecisinde yeniden render edilmiyor; pathname
 * ise gecis aninda guncelleniyor.
 */
export function GroupSwitcher({ groups }: { groups: SwitcherGroup[] }) {
  const t = useTranslate();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const activeId = pathname.match(/^\/groups\/([0-9a-f-]{36})/)?.[1];
  const active = groups.find((group) => group.id === activeId);

  // Tek grubu olan kullanicida acilir menu bir sey sunmuyor: gidilecek baska
  // grup yok ve "Tum gruplar" tek satirlik bir listeye goturur. Duz metin.
  if (groups.length < 2) {
    return active ? (
      <span className="truncate text-[0.8125rem] font-semibold">{active.name}</span>
    ) : null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="flex min-w-0 items-center gap-1.5 rounded-md text-[0.8125rem] font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="truncate">{active ? active.name : t("ui.my_groups")}</span>
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
        }
      />
      <PopoverContent align="start" className="w-56 p-1">
        <ul className="flex flex-col">
          {groups.map((group) => (
            <li key={group.id}>
              <Link
                href={`/groups/${group.id}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
              >
                <Check
                  className={`size-3.5 shrink-0 ${group.id === activeId ? "text-brand" : "invisible"}`}
                  aria-hidden="true"
                />
                <span className="truncate">{group.name}</span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-1 border-t border-line-soft pt-1">
          <Link
            href="/groups"
            onClick={() => setOpen(false)}
            className="block rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {t("ui.my_groups")} →
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
