# Member HTTP walkthrough

**Status:** Not executed — approved target is not implemented. This is the required Gate 5
evidence surface. Use the production AppModule/app_user/RLS path, isolated fixtures, and cleanup;
do not treat a static or unit result as HTTP proof.

| Case | Request | Expected status/evidence |
|---|---|---|
| Create/read/update/delete | Member CRUD routes | 201/200/204 as applicable; 409 for each dependency block |
| Unlinked Member | create and read with no User/Team | valid Member, no implicit identity or Team |
| Access sequence | existing User, role, profile, then access-link | each distinct; link neither creates User/role/profile nor changes default |
| Authorization | admin, division_lead, contextual Team Lead | only scoped system_admin can create new Member/link access |
| Isolation/validation | foreign IDs, ownership/security fields, invalid DTO | 404 or 400 as applicable; JWT Tenant wins |

For every call record method/path/body, status, success/error envelope and code, `x-request-id`,
fixture IDs, and cleanup. Mark PASS only after every case and cleanup succeeds.
