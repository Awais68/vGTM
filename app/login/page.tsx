import { LoginForm } from "./LoginForm"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 pt-24 pb-8">
      <div className="w-full max-w-sm">
        <LoginForm initialError={error ?? null} />
      </div>
    </div>
  )
}
