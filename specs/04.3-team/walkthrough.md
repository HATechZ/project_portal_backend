# Team HTTP walkthrough

**Status:** Not executed — approved target is not implemented. This file is the required Gate 5
runtime evidence surface. Exercise the production AppModule using app_user/RLS and isolated
fixtures; do not mark PASS from static tests.

| Case | Request | Expected status/evidence |
|---|---|---|
| Team CRUD | Team routes | 201/200/204 as applicable; 409 when membership history blocks delete |
| Lead assignment | `PUT /api/v1/team/:id/lead` | same Tenant/Company/Division active Member only |
| Membership | list/add/end/re-add | 200/201/204; joined/left history preserved; duplicate active 409 |
| system_admin/division_head/division_lead | creation/manage/lead actions | own Company/all own-Company Divisions/own Division scope plus configured action |
| team_lead | exact Team add/end only | exact `leadMemberId` + `ASSIGN_MEMBER`; other Team/create-Team 403; Member creation is verified separately in 04.2 scope |
| Isolation/validation | foreign/mismatched Members and fields | 404/400/403 as applicable; JWT Tenant wins |

Record method/path/body, actual status, envelope/error code, `x-request-id`, actor/profile and
fixture IDs, and cleanup outcome for every row. Gate 5 passes only after all required calls and
cleanup pass.
