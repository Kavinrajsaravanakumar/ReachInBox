import { Router } from "express";
import {
  getEmailByIdHandler,
  listEmailsHandler,
  scheduleEmailsHandler,
} from "../controllers/email.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { uploadRecipientsFile } from "../middleware/validation.middleware.js";

export const emailsRouter = Router();

emailsRouter.post(
  "/schedule",
  requireAuth,
  uploadRecipientsFile.single("recipientsFile"),
  (req, res, next) => {
    Promise.resolve(scheduleEmailsHandler(req, res)).catch(next);
  },
);

emailsRouter.get("/", requireAuth, (req, res, next) => {
  Promise.resolve(listEmailsHandler(req, res)).catch(next);
});

emailsRouter.get("/:id", requireAuth, (req, res, next) => {
  Promise.resolve(getEmailByIdHandler(req, res)).catch(next);
});
