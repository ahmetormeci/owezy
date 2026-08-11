import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrCreateCurrentUser } from "@/lib/auth";
import { getGroupForUser, listGroupInvites, listGroupMembers } from "@/lib/groups";
import { AppError } from "@/lib/errors";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InviteManager } from "@/components/invite-manager";
import { LeaveGroupButton, RemoveMemberButton } from "@/components/member-actions";

export default async function GroupMembersPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;

  const user = await getOrCreateCurrentUser();
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href={`/groups/${groupId}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← {group.name}
        </Link>
        <h1 className="text-2xl font-semibold">Üyeler ve davetler</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Üyeler</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y divide-border">
            {members.map((member) => (
              <li
                key={member.userId}
                className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-medium">{member.displayName}</span>
                  {member.role === "OWNER" ? <Badge variant="secondary">Sahip</Badge> : null}
                  {member.userId === user.id ? <Badge variant="outline">Sen</Badge> : null}
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Davet linkleri</CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
}
