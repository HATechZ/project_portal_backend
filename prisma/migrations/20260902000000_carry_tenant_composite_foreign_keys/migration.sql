-- Phase 7: tenant-carrying foreign keys. Run preflight.sql before applying.
ALTER TABLE "projects" ADD CONSTRAINT "projects_id_tenant_id_key" UNIQUE ("id", "tenant_id");
ALTER TABLE "divisions" ADD CONSTRAINT "divisions_id_tenant_id_key" UNIQUE ("id", "tenant_id");
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_id_tenant_id_key" UNIQUE ("id", "tenant_id");
ALTER TABLE "documents" ADD CONSTRAINT "documents_id_tenant_id_key" UNIQUE ("id", "tenant_id");
ALTER TABLE "members" ADD CONSTRAINT "members_id_tenant_id_key" UNIQUE ("id", "tenant_id");
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_id_tenant_id_key" UNIQUE ("id", "tenant_id");
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_id_tenant_id_key" UNIQUE ("id", "tenant_id");
ALTER TABLE "actor_profiles" ADD CONSTRAINT "actor_profiles_id_tenant_id_key" UNIQUE ("id", "tenant_id");
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_id_project_id_key" UNIQUE ("id", "project_id");

CREATE INDEX "documents_project_id_tenant_id_idx" ON "documents"("project_id", "tenant_id");
CREATE INDEX "documents_work_request_id_project_id_idx" ON "documents"("work_request_id", "project_id");
CREATE INDEX "work_requests_project_id_tenant_id_idx" ON "work_requests"("project_id", "tenant_id");
CREATE INDEX "work_requests_assigned_division_id_tenant_id_idx" ON "work_requests"("assigned_division_id", "tenant_id");
CREATE INDEX "work_requests_origin_division_id_tenant_id_idx" ON "work_requests"("origin_division_id", "tenant_id");
CREATE INDEX "registry_documents_project_id_tenant_id_idx" ON "registry_documents"("project_id", "tenant_id");
CREATE INDEX "registry_documents_work_request_id_tenant_id_idx" ON "registry_documents"("work_request_id", "tenant_id");
CREATE INDEX "registry_documents_document_id_tenant_id_idx" ON "registry_documents"("document_id", "tenant_id");
CREATE INDEX "actor_profiles_member_id_tenant_id_idx" ON "actor_profiles"("member_id", "tenant_id");
CREATE INDEX "actor_profiles_client_contact_id_tenant_id_idx" ON "actor_profiles"("client_contact_id", "tenant_id");
CREATE INDEX "notification_recipients_notification_id_tenant_id_idx" ON "notification_recipients"("notification_id", "tenant_id");
CREATE INDEX "notification_recipients_actor_id_tenant_id_idx" ON "notification_recipients"("actor_id", "tenant_id");

ALTER TABLE "documents" DROP CONSTRAINT "documents_project_id_fkey";
ALTER TABLE "documents" DROP CONSTRAINT "documents_work_request_id_fkey";
ALTER TABLE "work_requests" DROP CONSTRAINT "work_requests_project_id_fkey";
ALTER TABLE "work_requests" DROP CONSTRAINT "work_requests_assigned_division_id_fkey";
ALTER TABLE "work_requests" DROP CONSTRAINT "work_requests_origin_division_id_fkey";
ALTER TABLE "registry_documents" DROP CONSTRAINT "registry_documents_project_id_fkey";
ALTER TABLE "registry_documents" DROP CONSTRAINT "registry_documents_work_request_id_fkey";
ALTER TABLE "registry_documents" DROP CONSTRAINT "registry_documents_document_id_fkey";
ALTER TABLE "actor_profiles" DROP CONSTRAINT "actor_profiles_member_id_fkey";
ALTER TABLE "actor_profiles" DROP CONSTRAINT "actor_profiles_client_contact_id_fkey";
ALTER TABLE "notification_recipients" DROP CONSTRAINT "notification_recipients_notification_id_fkey";
ALTER TABLE "notification_recipients" DROP CONSTRAINT "notification_recipients_actor_id_fkey";

ALTER TABLE "documents" ADD CONSTRAINT "documents_project_id_tenant_id_fkey" FOREIGN KEY ("project_id", "tenant_id") REFERENCES "projects"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_work_request_id_project_id_fkey" FOREIGN KEY ("work_request_id", "project_id") REFERENCES "work_requests"("id", "project_id") ON DELETE SET NULL ("work_request_id") ON UPDATE CASCADE;
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_project_id_tenant_id_fkey" FOREIGN KEY ("project_id", "tenant_id") REFERENCES "projects"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_assigned_division_id_tenant_id_fkey" FOREIGN KEY ("assigned_division_id", "tenant_id") REFERENCES "divisions"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_origin_division_id_tenant_id_fkey" FOREIGN KEY ("origin_division_id", "tenant_id") REFERENCES "divisions"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "registry_documents" ADD CONSTRAINT "registry_documents_project_id_tenant_id_fkey" FOREIGN KEY ("project_id", "tenant_id") REFERENCES "projects"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "registry_documents" ADD CONSTRAINT "registry_documents_work_request_id_tenant_id_fkey" FOREIGN KEY ("work_request_id", "tenant_id") REFERENCES "work_requests"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "registry_documents" ADD CONSTRAINT "registry_documents_document_id_tenant_id_fkey" FOREIGN KEY ("document_id", "tenant_id") REFERENCES "documents"("id", "tenant_id") ON DELETE SET NULL ("document_id") ON UPDATE CASCADE;
ALTER TABLE "actor_profiles" ADD CONSTRAINT "actor_profiles_member_id_tenant_id_fkey" FOREIGN KEY ("member_id", "tenant_id") REFERENCES "members"("id", "tenant_id") ON DELETE SET NULL ("member_id") ON UPDATE CASCADE;
ALTER TABLE "actor_profiles" ADD CONSTRAINT "actor_profiles_client_contact_id_tenant_id_fkey" FOREIGN KEY ("client_contact_id", "tenant_id") REFERENCES "client_contacts"("id", "tenant_id") ON DELETE SET NULL ("client_contact_id") ON UPDATE CASCADE;
ALTER TABLE "notification_recipients" ADD CONSTRAINT "notification_recipients_notification_id_tenant_id_fkey" FOREIGN KEY ("notification_id", "tenant_id") REFERENCES "notifications"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notification_recipients" ADD CONSTRAINT "notification_recipients_actor_id_tenant_id_fkey" FOREIGN KEY ("actor_id", "tenant_id") REFERENCES "actor_profiles"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
