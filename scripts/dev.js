const { spawn } = require("child_process");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");

const processes = [
  {
    name: "backend",
    command: "npm",
    args: ["run", "dev"],
    cwd: path.join(rootDir, "backend"),
  },
  {
    name: "frontend",
    command: "npm",
    args: ["run", "dev"],
    cwd: path.join(rootDir, "frontend"),
  },
];

const children = processes.map((processConfig) => {
  const child = spawn(processConfig.command, processConfig.args, {
    cwd: processConfig.cwd,
    stdio: "inherit",
    shell: true,
  });

  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`${processConfig.name} exited with code ${code}`);
      process.exitCode = code;
    }
  });

  return child;
});

const shutdown = () => {
  children.forEach((child) => {
    if (!child.killed) {
      child.kill();
    }
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
