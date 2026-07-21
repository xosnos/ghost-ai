import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listOwnedProjects, listSharedProjects, getProject } from "@/lib/projects/queries";
import { getAuthIdentity, hasProjectAccess } from "@/lib/project-access";
import { EditorChrome } from "@/components/editor/editor-chrome";
import { AccessDenied } from "@/components/editor/access-denied";
import { CanvasPlaceholder } from "@/components/editor/canvas-placeholder";

interface EditorWorkspacePageProps {
  params: Promise<{ roomId: string }>;
}

export default async function EditorWorkspacePage({ params }: EditorWorkspacePageProps) {
  const { roomId } = await params;
  const supabase = await createClient();
  const identity = await getAuthIdentity(supabase);

  if (!identity) {
    redirect("/login");
  }

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
      <CanvasPlaceholder />
    </EditorChrome>
  );
}
