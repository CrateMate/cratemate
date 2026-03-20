import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f0e8]">
      <SignUp forceRedirectUrl="/app" />
    </div>
  );
}
