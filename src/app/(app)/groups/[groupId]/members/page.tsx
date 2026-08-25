import Link from "next/link";
import { notFound } from "next/navigation";
import { findCurrentUser } from "@/lib/auth";
import { getGroupForUser, listGroupInvites, listGroupMembers } from "@/lib/groups";
import { AppError } from "@/lib/errors";
import { getTranslate } from "@/lib/i18n-server";
import { Badge } from "@/components/ui/badge";
import { InviteManager } from "@/components/invite-manager";
import { LeaveGroupButton, RemoveMemberButton } from "@/components/member-actions";
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
  const otherMembers = members.filter((member) => member.userId !== user.id);
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
        <h1 className="text-[1.0625rem] font-semibold">{t("ui.members_and_invites")}</h1>
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
                {member.role === "OWNER" ? (
                  <Badge variant="secondary">{t("ui.role_owner")}</Badge>
                ) : null}
                {member.userId === user.id ? (
                  <Badge variant="outline">{t("ui.you")}</Badge>
                ) : null}
              </div>

              {isOwner && member.userId !== user.id ? (
                <RemoveMemberButton
                  groupId={groupId}
                  userId={member.userId}
                  displayName={member.displayName}
                />
              ) : null}
            </li>
          ))}
        </ul>

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
