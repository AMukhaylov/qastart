import { createFileRoute } from "@tanstack/react-router";
import { AdminArchiePanel } from "@/components/admin-archie-panel";

export const Route = createFileRoute("/admin/archie")({ component: AdminArchiePanel });
