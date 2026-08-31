// backend/scripts/test-smtp-connectivity.ts
// TEMPORARY diagnostic script — run this via Railway to determine whether
// outbound SMTP (port 587) is reachable at all from this environment.
// Delete this file once the SMTP issue is resolved.

import net from "node:net";

const HOST = "smtp.ethereal.email";
const PORT = 587;
const TIMEOUT_MS = 10000;

console.log(`Attempting raw TCP connection to ${HOST}:${PORT} (timeout ${TIMEOUT_MS}ms)...`);

const socket = net.createConnection({ host: HOST, port: PORT, family: 4 });

const timer = setTimeout(() => {
  console.log("RESULT: TIMEOUT — no response within", TIMEOUT_MS, "ms. Outbound port", PORT, "is very likely BLOCKED by the host network.");
  socket.destroy();
  process.exit(1);
}, TIMEOUT_MS);

socket.on("connect", () => {
  clearTimeout(timer);
  console.log("RESULT: CONNECTED successfully. Outbound SMTP is reachable — the earlier timeout was NOT a network/port block. Investigate credentials or nodemailer config instead.");
  socket.end();
  process.exit(0);
});

socket.on("error", (err) => {
  clearTimeout(timer);
  console.log("RESULT: ERROR —", err.message, "(code:", (err as NodeJS.ErrnoException).code, ")");
  process.exit(1);
});
