import { Hono } from "hono";
import { container } from "../../container.mts";
import {
  currentUserMiddleware,
  type AppEnv,
} from "../../security/current-user.mts";
import { readRouter } from "./router/read-router.mts";
import { writeRouter } from "./router/write-router.mts";

export const gymModule = new Hono<AppEnv>();

gymModule.use("*", currentUserMiddleware(container.currentUserService));
gymModule.route("/", readRouter);
gymModule.route("/", writeRouter);
