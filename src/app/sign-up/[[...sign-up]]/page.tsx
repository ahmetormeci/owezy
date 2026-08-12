import { SignUp } from "@clerk/nextjs";
import { PublicControls } from "@/components/public-controls";

export default function SignUpPage() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <PublicControls />
      <SignUp />
    </div>
  );
}
