import { redirect } from "next/navigation";
import { AccessDenied } from "@/components/editor/access-denied";
import { CanvasWrapper } from "@/components/editor/canvas-wrapper";
import { EditorChrome } from "@/components/editor/editor-chrome";
import { hasProjectAccess } from "@/lib/project-access";
import { getProject, listOwnedProjects, listSharedProjects } from "@/lib/projects/queries";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

interface EditorWorkspacePageProps {
  params: Promise<{ roomId: string }>;
}

export default async function EditorWorkspacePage({ params }: EditorWorkspacePageProps) {
  const supabase = await createClient();
  const { roomId } = await params;
  const user = await getCurrentUser(supabase);

  if (!user) {
    redirect("/login");
  }

  const identity = { userId: user.id, email: user.email ?? "" };

  const [ownedProjects, sharedProjects, project] = await Promise.all([
    listOwnedProjects(supabase, identity.userId),
    listSharedProjects(supabase, identity.email),
    getProject(supabase, roomId),
  ]);

  const allowed = project ? await hasProjectAccess(supabase, roomId, identity) : false;

  if (!project || !allowed) {
    return (
      <EditorChrome
        userEmail={identity.email}
        currentUserId={identity.userId}
        ownedProjects={ownedProjects}
        sharedProjects={sharedProjects}
      >
        <AccessDenied />
      </EditorChrome>
    );
  }

  return (
    <EditorChrome
      userEmail={identity.email}
      currentUserId={identity.userId}
      ownedProjects={ownedProjects}
      sharedProjects={sharedProjects}
      project={project}
      currentRoomId={roomId}
    >
      <CanvasWrapper
        projectId={project.id}
        user={{
          id: user.id,
          email: user.email ?? undefined,
          user_metadata: user.user_metadata,
        }}
      />
    </EditorChrome>
  );
}
