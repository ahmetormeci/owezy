import Link from "next/link";
import { getOrCreateCurrentUser } from "@/lib/auth";
import { listGroupsForUser } from "@/lib/groups";
import { Badge } from "@/components/ui/badge";
import { CreateGroupDialog } from "@/components/create-group-dialog";
import { getTranslate } from "@/lib/i18n-server";

// Server Component: veriyi kendi API'mize HTTP istegi atarak degil, dogrudan
// servis katmanindan okuyoruz. Sayfa zaten sunucuda render ediliyor; ayni
// makinede kendi kendine HTTP turu atmak gereksiz gecikme olurdu.
// (Yazma islemleri /api/v1 uzerinden gidecek - mobil de ayni yolu kullanacak.)
export default async function GroupsPage() {
  const t = await getTranslate();
  const user = await getOrCreateCurrentUser();
  if (!user) {
    return null;
  }

  const groups = await listGroupsForUser(user.id);

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[1.0625rem] font-semibold">{t("ui.my_groups")}</h1>
        <CreateGroupDialog />
      </div>

      {groups.length === 0 ? (
        // Bos durum: kutu degil, cizginin altinda sessiz bir cumle. Bos bir
        // liste icin kart cizmek, olmayan bir seye yer ayirmak demek.
        <div className="mt-6 border-t border-border pt-6 text-muted-foreground">
          {t("ui.no_groups")}
        </div>
      ) : (
        // Her grup bir kart degil, bir SATIR. Kart deseninde uc grup uc ayri
        // yuzey demekti; liste olarak dizilince goz bir sey ariyorsa
        // bulabiliyor (ADR-021).
        <ul className="mt-4 flex flex-col border-t border-border">
          {groups.map((group) => (
            <li key={group.id}>
              <Link
                href={`/groups/${group.id}`}
                className="-mx-2 flex items-center justify-between gap-4 rounded-md border-b border-line-soft px-2 py-3 transition-colors hover:bg-accent"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{group.name}</p>
                  {group.description ? (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {group.description}
                    </p>
                  ) : null}
                </div>
                <Badge variant="secondary">
                  {group.role === "OWNER" ? t("ui.role_owner") : t("ui.role_member")}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
