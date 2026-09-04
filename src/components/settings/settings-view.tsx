"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { Role } from "@/lib/domain";
import { canAccessSettings, canManageUsers, roleLabel } from "@/lib/roles";
import { isCloudMode } from "@/lib/session";
import { useAppStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const ROLES: Role[] = ["admin", "designer", "operator"];

export function SettingsView() {
  const hydrated = useAppStore((s) => s.hydrated);
  const role = useAppStore((s) => s.role());
  const orgId = useAppStore((s) => s.currentOrganizationId);
  const currentUserId = useAppStore((s) => s.currentUserId);
  const organizations = useAppStore((s) => s.organizations);
  const users = useAppStore((s) => s.users);
  const memberships = useAppStore((s) => s.memberships);
  const updateOrganization = useAppStore((s) => s.updateOrganization);
  const addMember = useAppStore((s) => s.addMember);
  const updateMemberRole = useAppStore((s) => s.updateMemberRole);
  const removeMember = useAppStore((s) => s.removeMember);
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);
  const router = useRouter();
  const org = organizations.find((item) => item.id === orgId) ?? organizations[0];
  const [name, setName] = useState(org?.name ?? "");
  const [companyName, setCompanyName] = useState(org?.companyName ?? "");
  const [description, setDescription] = useState(org?.description ?? "");
  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<Role>("operator");
  const localDemo = !isCloudMode();

  useEffect(() => {
    if (!org) return;
    setName(org.name);
    setCompanyName(org.companyName ?? "");
    setDescription(org.description ?? "");
  }, [org?.id]);

  const members = useMemo(() => {
    return memberships
      .filter((item) => orgId && item.organizationId === orgId)
      .map((membership) => ({
        membership,
        user: users.find((item) => item.id === membership.userId),
      }))
      .filter((item) => item.user)
      .sort((a, b) => (a.user?.name || "").localeCompare(b.user?.name || "", undefined, { sensitivity: "base" }));
  }, [memberships, orgId, users]);

  if (!hydrated) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  if (role && !canAccessSettings(role)) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm text-muted-foreground">Operators can generate published labels. Workspace settings are for admins.</p>
        <Button onClick={() => router.push("/templates")}>Back to templates</Button>
      </div>
    );
  }

  const canMembers = !role || canManageUsers(role);

  function saveWorkspace() {
    if (!updateOrganization({ name, description, companyName })) {
      toast.error("Could not update workspace");
      return;
    }
    toast.success("Workspace saved");
  }

  function createMember() {
    const id = addMember({ name: memberName, email: memberEmail, role: memberRole });
    if (!id) {
      toast.error("Need a unique name and email");
      return;
    }
    setMemberName("");
    setMemberEmail("");
    setMemberRole("operator");
    toast.success("Member added");
  }

  return (
    <div className="h-full overflow-y-auto p-8">
      <h1 className="font-heading text-3xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 mb-6 max-w-2xl text-sm text-muted-foreground">
        {org?.name ? `${org.name} · ` : ""}Workspace, members, and how this pilot install behaves.
      </p>
      <Tabs defaultValue="workspace">
        <TabsList>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          {canMembers ? <TabsTrigger value="members">Members</TabsTrigger> : null}
          <TabsTrigger value="general">General</TabsTrigger>
        </TabsList>
        <TabsContent value="workspace" className="mt-4 max-w-xl space-y-3">
          <label className="block text-sm">
            Workspace name
            <Input className="mt-1" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="block text-sm">
            Company
            <Input
              className="mt-1"
              value={companyName}
              placeholder="Optional customer or plant name"
              onChange={(event) => setCompanyName(event.target.value)}
            />
          </label>
          <label className="block text-sm">
            Description
            <Textarea
              className="mt-1"
              value={description}
              placeholder="Optional notes for this plant or workflow"
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <Button onClick={saveWorkspace}>Save workspace</Button>
        </TabsContent>
        {canMembers ? (
          <TabsContent value="members" className="mt-4 max-w-3xl space-y-4">
            <p className="text-sm text-muted-foreground">
              Admins manage templates and members. Operators generate and print published labels only.
              {localDemo ? " Use a member below to preview that role in this browser." : ""}
            </p>
            <div className="overflow-hidden rounded-xl border border-[#d0d7de] bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#f8f9fa] text-[11px] tracking-wide text-[#5f6368] uppercase">
                  <tr>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Role</th>
                    <th className="px-3 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {members.map(({ membership, user }) => {
                    const active = user?.id === currentUserId;
                    return (
                      <tr key={membership.id} className="border-t border-[#e8eaed]">
                        <td className="px-3 py-2 font-medium">
                          {user?.name}
                          {active ? <span className="ml-2 text-[11px] font-normal text-[#5f6368]">Current</span> : null}
                        </td>
                        <td className="px-3 py-2 text-[#5f6368]">{user?.email}</td>
                        <td className="px-3 py-2">
                          <select
                            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                            value={membership.role}
                            onChange={(event) => {
                              if (!updateMemberRole(membership.id, event.target.value as Role)) {
                                toast.error("Keep at least one admin");
                              }
                            }}
                          >
                            {ROLES.map((item) => (
                              <option key={item} value={item}>
                                {roleLabel(item)}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {localDemo && !active && user ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="mr-2"
                              onClick={() => {
                                if (setCurrentUser(user.id)) toast.success(`Now using ${user.name}`);
                              }}
                            >
                              Use in this browser
                            </Button>
                          ) : null}
                          {!active ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (!removeMember(membership.id)) toast.error("Cannot remove this member");
                                else toast.success("Member removed");
                              }}
                            >
                              Remove
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="grid max-w-xl gap-2 rounded-xl border border-[#e8eaed] bg-white p-4">
              <p className="text-sm font-medium">Add member</p>
              <Input placeholder="Name" value={memberName} onChange={(event) => setMemberName(event.target.value)} />
              <Input
                placeholder="Email"
                type="email"
                value={memberEmail}
                onChange={(event) => setMemberEmail(event.target.value)}
              />
              <select
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                value={memberRole}
                onChange={(event) => setMemberRole(event.target.value as Role)}
              >
                {ROLES.map((item) => (
                  <option key={item} value={item}>
                    {roleLabel(item)}
                  </option>
                ))}
              </select>
              <Button className="w-fit" onClick={createMember}>
                Add member
              </Button>
            </div>
          </TabsContent>
        ) : null}
        <TabsContent value="general" className="mt-4 max-w-xl space-y-3 text-sm text-muted-foreground">
          <p>
            Local <code className="text-foreground">next dev</code> opens as Demo Admin in this workspace, with no login
            wall. Cloud sign-in stays behind <code className="text-foreground">NEXT_PUBLIC_LABELATOR_CLOUD=1</code>.
          </p>
          <p>
            Pilot workflow: choose a published template → add or upload data → validate → generate → review → print or
            download PDF → find the batch in History.
          </p>
          {localDemo ? (
            <p>Switch to Demo Operator from Members to check the operator path without authentication.</p>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
