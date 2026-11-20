import { Router } from "express";
import { NotFoundError } from "../errors.js";
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

  // Lightweight source for the search combobox.
  router.get("/names", async (req, res) => {
    const search = parseSearch(req.query.search);
    const names = await repository.names(search);
    res.json({ data: names });
  });

  // POST /employees
  router.post("/", async (req, res) => {
    const employee = await repository.create(parseEmployeeInput(req.body));
    res.status(201).json({ data: employee });
  });

  // PUT /employees/:id
  router.put("/:id", async (req, res) => {
    const id = parseId(req.params.id);
    const employee = await repository.update(id, parseEmployeeInput(req.body));

    if (!employee) {
      throw new NotFoundError("Employee not found");
    }

    res.json({ data: employee });
  });

  // DELETE /employees/:id
  router.delete("/:id", async (req, res) => {
    const id = parseId(req.params.id);
    const deleted = await repository.remove(id);

    if (!deleted) {
      throw new NotFoundError("Employee not found");
    }

    res.status(204).send();
  });

  return router;
}
