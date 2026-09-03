import { createClient } from "@/lib/supabase/server";
import { Chat } from "@/components/chat";
import { signOut } from "@/app/login/actions";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <Chat
      userEmail={user?.email ?? ""}
      onSignOut={signOut}
      modelName={process.env.OLLAMA_MODEL ?? ""}
    />
  );
}
