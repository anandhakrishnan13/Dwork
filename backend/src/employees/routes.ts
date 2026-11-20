import { Router } from "express";
import { requireRole } from "../auth/middleware.js";
import type { AccessRole } from "../auth/types.js";
import { HttpError, NotFoundError } from "../errors.js";
import { EmployeeRepository, PAGE_SIZE } from "./repository.js";
import { parseEmployeeInput, parseId } from "./schema.js";

function parsePage(raw: unknown): number {
  if (typeof raw !== "string") return 1;
  const page = Number(raw);
  return Number.isInteger(page) && page > 0 ? Math.min(page, 1_000_000) : 1;
}

function parseSearch(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const search = raw.trim().slice(0, 100);
  return search.length > 0 ? search : undefined;
}

export function employeesRouter(repository: EmployeeRepository): Router {
  const router = Router();

  // GET /employees?page=1&search=term — page size is enforced here, not by the client.
  router.get("/", async (req, res) => {
    const page = parsePage(req.query.page);
    const search = parseSearch(req.query.search);
    const { employees, totalRecords } = await repository.list({ page, search });

    res.json({
      data: employees,
      currentPage: page,
      pageSize: PAGE_SIZE,
      totalPages: Math.max(1, Math.ceil(totalRecords / PAGE_SIZE)),
      totalRecords,
    });
  });

  // Lightweight source for the search combobox and manager picker.
  router.get("/names", async (req, res) => {
    const search = parseSearch(req.query.search);
    const names = await repository.names(search);
    res.json({ data: names });
  });

  // POST /employees — managers create direct reports; admins choose the access role.
  router.post("/", requireRole("admin", "manager"), async (req, res) => {
    const auth = req.auth!;
    const input = parseEmployeeInput(req.body);

    let accessRole: AccessRole = input.accessRole ?? "employee";
    let managerId = input.managerId;

    if (auth.role === "manager") {
      if (auth.employeeId === null) {
        throw new HttpError(403, "Your account is not linked to an employee record");
      }

      accessRole = "employee";
      managerId = auth.employeeId;
    }

    const employee = await repository.create({ ...input, managerId }, accessRole);
    res.status(201).json({ data: employee });
  });

  // PUT /employees/:id — managers may edit only their direct reports.
  router.put("/:id", requireRole("admin", "manager"), async (req, res) => {
    const auth = req.auth!;
    const rawId = req.params.id;
    const id = parseId(typeof rawId === "string" ? rawId : "");
    const existing = await repository.findById(id);

    if (!existing) {
      throw new NotFoundError("Employee not found");
    }

    const input = parseEmployeeInput(req.body);

    if (auth.role === "manager") {
      if (auth.employeeId === null || existing.manager_id !== auth.employeeId) {
        throw new HttpError(403, "Managers can only edit employees who report to them");
      }

      // Managers cannot move someone to another manager or change access roles.
      const employee = await repository.update(id, {
        ...input,
        managerId: existing.manager_id,
      });

      res.json({ data: employee });
      return;
    }

    const employee = await repository.update(id, input, input.accessRole);
    res.json({ data: employee });
  });

  // DELETE /employees/:id — admins only.
  router.delete("/:id", requireRole("admin"), async (req, res) => {
    const rawId = req.params.id;
    const id = parseId(typeof rawId === "string" ? rawId : "");
    const deleted = await repository.remove(id);

    if (!deleted) {
      throw new NotFoundError("Employee not found");
    }

    res.status(204).send();
  });

  return router;
}
