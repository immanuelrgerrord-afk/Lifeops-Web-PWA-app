import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import categoriesRouter from "./categories.js";
import incomesRouter from "./incomes.js";
import expensesRouter from "./expenses.js";
import loansRouter from "./loans.js";
import goalsRouter from "./goals.js";
import dashboardRouter from "./dashboard.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(categoriesRouter);
router.use(incomesRouter);
router.use(expensesRouter);
router.use(loansRouter);
router.use(goalsRouter);
router.use(dashboardRouter);

export default router;
