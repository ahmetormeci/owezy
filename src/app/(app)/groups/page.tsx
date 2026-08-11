import Link from "next/link";
import { getOrCreateCurrentUser } from "@/lib/auth";
import { listGroupsForUser } from "@/lib/groups";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{t("ui.my_groups")}</h1>
        <CreateGroupDialog />
      </div>

      {groups.length === 0 ? (
        <Card className="p-6 text-muted-foreground">
          {t("ui.no_groups")}
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {groups.map((group) => (
            <li key={group.id}>
              <Link href={`/groups/${group.id}`} className="block">
                <Card className="p-4 transition-colors hover:bg-accent">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{group.name}</p>
                      {group.description ? (
                        <p className="truncate text-sm text-muted-foreground">
                          {group.description}
                        </p>
                      ) : null}
                    </div>
                    <Badge variant="secondary">
                      {group.role === "OWNER" ? t("ui.role_owner") : t("ui.role_member")}
                    </Badge>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
