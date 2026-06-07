const ts = () => Temporal.Now.instant().toString();
export const log = {
  info:  (msg) => process.stderr.write(`[sherpa-mcp] INFO  ${ts()} ${msg}\n`),
  warn:  (msg) => process.stderr.write(`[sherpa-mcp] WARN  ${ts()} ${msg}\n`),
  error: (msg) => process.stderr.write(`[sherpa-mcp] ERROR ${ts()} ${msg}\n`),
};
