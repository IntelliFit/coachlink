// Reads the result of the DevTools `cli upload` command from what it prints.
// The exit code says nothing: the CLI catches upload errors (expired login, 41002)
// and exits 0, and a port mismatch reaches us through cli.bat as 0 too.

const ANSI_ESCAPE = /\u001b\[[0-9;?]*[A-Za-z]/g
// The spinner draws √ × in a Windows console, ✔ ✖ when TERM=xterm-256color (Git Bash) or CI is set.
const UPLOAD_SUCCEEDED = /^[√✔]\s+upload$/
const PORT_MISMATCH = /^[×✖]\s.*(?:must be restarted on port|需要重启才能使用端口)/
const LISTENING_PORT = /https?:\/\/[^\s/:]+:(\d+)/

function parseDevtoolsUploadOutput(output) {
  const lines = output
    .replace(ANSI_ESCAPE, '')
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
  const mismatch = lines.find((line) => PORT_MISMATCH.test(line))
  const portMatch = mismatch ? mismatch.match(LISTENING_PORT) : null

  return {
    uploaded: lines.some((line) => UPLOAD_SUCCEEDED.test(line)),
    runningPort: portMatch ? Number(portMatch[1]) : null,
  }
}

module.exports = {
  parseDevtoolsUploadOutput,
}
