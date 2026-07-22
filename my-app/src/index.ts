import { Hono } from "hono";
import auth from "@/src/routes/auth";
import masters from "@/src/routes/masters";
import relations from "@/src/routes/relations";
import weights from "@/src/routes/weights";
import grades from "@/src/routes/grades";
import years from "@/src/routes/years";
import reports from "@/src/routes/reports";
import csvRoutes from "@/src/routes/csv";

const app = new Hono().basePath("/api");

app.route("/auth", auth);
app.route("/masters", masters);
app.route("/relations", relations);
app.route("/weights", weights);
app.route("/grades", grades);
app.route("/years", years);
app.route("/reports", reports);
app.route("/csv", csvRoutes);

export default app;
