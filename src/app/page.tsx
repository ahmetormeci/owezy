import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 dark:bg-black">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
        SplitApp
      </h1>
      <Show when="signed-out">
        <div className="flex gap-4">
          <SignInButton mode="modal" />
          <SignUpButton mode="modal" />
        </div>
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </div>
  );
}
