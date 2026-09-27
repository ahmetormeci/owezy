import Link from "next/link";
import { notFound } from "next/navigation";
import { findCurrentUser } from "@/lib/auth";
import { getGroupForUser, listGroupInvites, listGroupMembers } from "@/lib/groups";
import { AppError } from "@/lib/errors";
import { getTranslate } from "@/lib/i18n-server";
import { Badge } from "@/components/ui/badge";
import { InviteManager } from "@/components/invite-manager";
import { LeaveGroupButton, RemoveMemberButton } from "@/components/member-actions";
import { AddGuestForm, RenameGuestButton } from "@/components/guest-actions";
import { SectionHead } from "@/components/section-head";
import { PersonAvatar } from "@/components/person-avatar";

export default async function GroupMembersPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const t = await getTranslate();

  const user = await findCurrentUser();
  if (!user) {
    return null;
  }

  let group: Awaited<ReturnType<typeof getGroupForUser>>;
  let members: Awaited<ReturnType<typeof listGroupMembers>>;
  let invites: Awaited<ReturnType<typeof listGroupInvites>>;
  try {
    [group, members, invites] = await Promise.all([
      getGroupForUser(user.id, groupId),
      listGroupMembers(user.id, groupId),
      listGroupInvites(user.id, groupId),
    ]);
  } catch (error) {
    if (error instanceof AppError) {
      notFound();
    }
    throw error;
  }

  const isOwner = group.role === "OWNER";
  // Sahiplik devri icin adaylar. MISAFIR ADAY DEGIL: sahip olamaz ve
  // giris yapamaz (ADR-057). Sunucu da ayni kurali uyguluyor.
  const otherMembers = members.filter(
    (member) => member.userId !== user.id && !member.isGuest,
  );
  const nameByUserId = Object.fromEntries(
    members.map((member) => [member.userId, member.displayName]),
  );

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-1">
        <Link
          href={`/groups/${groupId}`}
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          ← {group.name}
        </Link>
        <h1 className="font-heading text-2xl">{t("ui.members_and_invites")}</h1>
      </div>

      <section className="mt-6">
        <SectionHead title={t("ui.members")} />
        <ul className="flex flex-col">
          {members.map((member) => (
            <li
              key={member.userId}
              className="flex items-center justify-between gap-4 border-b border-line-soft py-2.5 last:border-b-0"
            >
              <div className="flex min-w-0 items-center gap-2">
                <PersonAvatar
                  displayName={member.displayName}
                  avatarUrl={member.avatarUrl}
                  hasImage={member.hasImage}
                />
                <span className="truncate">{member.displayName}</span>
                {/* Rol duz metin - gruplar listesindekiyle ayni sebep ve ayni
                    bicim: rol bir DURUM degil (ADR-021). Yanindaki "sen"
                    rozeti duruyor; o bir durum degil ama KIMLIK isareti ve
                    ayri bir karar. */}
                {member.role === "OWNER" ? (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {t("ui.role_owner")}
                  </span>
                ) : null}
                {/* Misafir de rol gibi DUZ METIN (ADR-021): bir durum degil,
                    kisinin ne oldugu. */}
                {member.isGuest ? (
                  <span className="shrink-0 text-xs text-muted-foreground">{t("ui.guest")}</span>
                ) : null}
                {member.userId === user.id ? (
                  <Badge variant="outline">{t("ui.you")}</Badge>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {/* Misafirin adini HER UYE duzeltebilir: kendisi giris
                    yapamiyor, baska kimse yok. */}
                {member.isGuest ? (
                  <RenameGuestButton
                    groupId={groupId}
                    guestId={member.userId}
                    displayName={member.displayName}
                  />
                ) : null}
                {isOwner && member.userId !== user.id ? (
                  <RemoveMemberButton
                    groupId={groupId}
                    userId={member.userId}
                    displayName={member.displayName}
                  />
                ) : null}
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-4">
          <AddGuestForm groupId={groupId} />
        </div>

        {/* Gruptan ayrilma listenin PARCASI degil, o yuzden cizginin
            altinda ve solda tek basina duruyor. */}
        <div className="mt-4 border-t border-border pt-4">
          <LeaveGroupButton
            groupId={groupId}
            isOwner={isOwner}
            otherMembers={otherMembers.map((member) => ({
              userId: member.userId,
              displayName: member.displayName,
            }))}
          />
        </div>
      </section>

      <section className="mt-8">
        <SectionHead title={t("ui.invites")} />
        <InviteManager
          groupId={groupId}
          nameByUserId={nameByUserId}
          invites={invites.map((invite) => ({
            id: invite.id,
            invitedById: invite.invitedById,
            expiresAt: invite.expiresAt.toISOString(),
            maxUses: invite.maxUses,
            useCount: invite.useCount,
          }))}
        />
      </section>
    </div>
  );
}
