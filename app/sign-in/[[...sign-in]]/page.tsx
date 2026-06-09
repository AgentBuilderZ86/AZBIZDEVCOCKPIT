import { SignIn } from "@clerk/nextjs";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <SignIn />
    </div>
  );
}
