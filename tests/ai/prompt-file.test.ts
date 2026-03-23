import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("AI 测试指令文件校验", () => {
  it("应包含幂等与清理要求，以及三类测试覆盖点", () => {
    const filePath = path.resolve(
      process.cwd(),
      "tests/ai/prompts/t3-agent-regression-prompt.md",
    );
    const content = fs.readFileSync(filePath, "utf-8");

    expect(content).toContain("幂等");
    expect(content).toContain("测试结束后数据库状态与测试前一致");
    expect(content).toContain("前端交互测试");
    expect(content).toContain("后端接口/数据库测试");
    expect(content).toContain("save-favorite");
    expect(content).toContain("create-template");
    expect(content).toContain("cleanup");
  });
});
