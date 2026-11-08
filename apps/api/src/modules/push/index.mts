import { Hono } from "hono";
import { container } from "../../container.mts";
import {
  currentUserMiddleware,
  type AppEnv,
} from "../../security/current-user.mts";
import { readRouter } from "./router/read-router.mts";
import { writeRouter } from "./router/write-router.mts";

export const pushModule = new Hono<AppEnv>();

pushModule.use("*", currentUserMiddleware(container.currentUserService));
pushModule.route("/", readRouter);
pushModule.route("/", writeRouter);
